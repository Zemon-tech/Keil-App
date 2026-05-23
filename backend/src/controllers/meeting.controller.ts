import { Request, Response } from "express";
import fetch from "node-fetch";
import { catchAsync } from "../utils/catchAsync";
import { ApiResponse } from "../utils/ApiResponse";
import { ApiError } from "../utils/ApiError";
import { config } from "../config";
import { getS3Client } from "../lib/s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import * as meetingService from "../services/meeting.service";

/**
 * Sanitizes MIME types (e.g. 'audio/webm;codecs=opus' -> 'audio/webm') to conform to S3/Sarvam requirements.
 */
const sanitizeMimeType = (mime: any): string => {
    if (typeof mime !== "string") return "audio/webm";
    return mime.split(";")[0].trim();
};

export const getUploadUrl = catchAsync(async (req: Request, res: Response) => {
    try {
        const { meetingId, fileName, contentType } = req.body;
        const user = (req as any).user;

        if (!user || !user.id) {
            throw new ApiError(401, "User authentication required");
        }

        const userId = user.id;

        // Strictly validate UUID to prevent PostgreSQL type syntax errors
        const isValidUuid = (id: any) => typeof id === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
        const dbMeetingId = isValidUuid(meetingId) ? meetingId : null;

        const safeFileName = fileName ? fileName.replace(/[^a-zA-Z0-9.-]/g, "_") : "audio.webm";
        const timestamp = Date.now();
        const meetingFolder = dbMeetingId ? dbMeetingId : "general";
        
        // Unique S3 key matching pattern: meetings/${userId}/${meetingId}/${timestamp}-${fileName}
        const s3Key = `meetings/${userId}/${meetingFolder}/${timestamp}-${safeFileName}`;

        console.log(`Generating presigned PUT URL for bucket: ${config.sevallaS3BucketName}, key: ${s3Key}`);

        const command = new PutObjectCommand({
            Bucket: config.sevallaS3BucketName,
            Key: s3Key,
            ContentType: sanitizeMimeType(contentType),
        });

        const uploadUrl = await getSignedUrl(getS3Client(), command, { expiresIn: 3600 });

        // Create database row in pending state
        const recording = await meetingService.createRecording(userId, dbMeetingId, s3Key);

        res.status(200).json(
            new ApiResponse(200, {
                uploadUrl,
                s3Key,
                recordingId: recording.id
            }, "Presigned S3 upload URL generated successfully")
        );
    } catch (err: any) {
        console.error("❌ [getUploadUrl] Error occurred:", err);
        return res.status(500).json({ error: "Failed to generate upload URL" });
    }
});

/**
 * Creates, uploads, and starts a Sarvam Batch STT job
 */
export const transcribeRecording = catchAsync(async (req: Request, res: Response) => {
    const { recordingId, s3Key, durationSeconds, contentType } = req.body;
    const user = (req as any).user;

    try {
        if (!user || !user.id) {
            return res.status(401).json({ error: "User authentication required" });
        }

        if (!recordingId || !s3Key) {
            return res.status(400).json({ error: "Recording ID and S3 key are required" });
        }

        // 1. Generate presigned S3 GET URL for Sarvam to fetch or for our server fetch
        console.log(`[transcribe] 1/7: Generating S3 presigned GET URL for key: ${s3Key}...`);
        const getCommand = new GetObjectCommand({
            Bucket: config.sevallaS3BucketName,
            Key: s3Key,
        });
        const presignedAudioUrl = await getSignedUrl(getS3Client(), getCommand, { expiresIn: 3600 });
        console.log(`[transcribe] S3 GET URL generated successfully.`);

        const sarvamHeaders = {
            "api-subscription-key": config.sarvamApiKey,
            "Content-Type": "application/json"
        };

        console.log(`[transcribe] 2/7: Initiating Sarvam STT job for recording: ${recordingId}...`);

        // 2. Create the STT Job on Sarvam
        const createJobResponse = await fetch("https://api.sarvam.ai/speech-to-text/job/v1", {
            method: "POST",
            headers: sarvamHeaders,
            body: JSON.stringify({
                job_parameters: {
                    model: "saaras:v3",
                    mode: "transcribe",
                    language_code: "en-IN",
                    with_diarization: true,
                    num_speakers: 2
                }
            })
        });

        if (!createJobResponse.ok) {
            const errText = await createJobResponse.text();
            console.error("❌ Sarvam Job Creation Error:", errText);
            return res.status(createJobResponse.status).json({ error: "Failed to create Sarvam job" });
        }

        const { job_id: sarvamJobId } = await createJobResponse.json() as any;
        console.log(`[transcribe] Sarvam Job Created with ID: ${sarvamJobId}`);

        // 3. Request presigned upload URLs from Sarvam
        console.log(`[transcribe] 3/7: Requesting Azure upload URLs from Sarvam...`);
        const fileName = s3Key.split("/").pop() || "audio.webm";
        const uploadUrlsResponse = await fetch("https://api.sarvam.ai/speech-to-text/job/v1/upload-files", {
            method: "POST",
            headers: sarvamHeaders,
            body: JSON.stringify({
                job_id: sarvamJobId,
                files: [fileName]
            })
        });

        if (!uploadUrlsResponse.ok) {
            const errText = await uploadUrlsResponse.text();
            console.error("❌ Sarvam Upload Urls Error:", errText);
            return res.status(uploadUrlsResponse.status).json({ error: "Failed to get Sarvam upload URL" });
        }

        const uploadData = await uploadUrlsResponse.json() as any;
        const sarvamUploadUrlObj = uploadData.upload_urls?.[fileName];
        const sarvamUploadUrl = typeof sarvamUploadUrlObj === "string" 
            ? sarvamUploadUrlObj 
            : sarvamUploadUrlObj?.file_url;

        if (!sarvamUploadUrl) {
            console.error("❌ Sarvam did not return upload URL inside:", uploadData);
            return res.status(500).json({ error: "Sarvam did not return an upload URL for the audio file" });
        }

        // 4. Stream S3 audio directly to Sarvam storage
        console.log(`[transcribe] 4/7: Downloading audio from S3 via presigned GET...`);
        const audioResponse = await fetch(presignedAudioUrl);
        if (!audioResponse.ok) {
            return res.status(audioResponse.status).json({ error: "Failed to download audio file from S3" });
        }
        
        const contentLength = audioResponse.headers.get("content-length");
        
        console.log(`[transcribe] 5/7: Streaming audio to Sarvam Azure storage presigned URL...`);
        const sarvamUploadResponse = await fetch(sarvamUploadUrl, {
            method: "PUT",
            headers: {
                "x-ms-blob-type": "BlockBlob",
                "Content-Type": sanitizeMimeType(contentType),
                ...(contentLength ? { "Content-Length": contentLength } : {})
            },
            body: audioResponse.body
        });

        if (!sarvamUploadResponse.ok) {
            const errText = await sarvamUploadResponse.text();
            console.error("❌ Sarvam Storage Upload Error:", errText);
            return res.status(sarvamUploadResponse.status).json({ error: "Failed to upload audio to Sarvam storage" });
        }
        console.log(`[transcribe] Audio streamed successfully.`);

        // 5. Start the processing on Sarvam
        console.log(`[transcribe] 6/7: Starting processing for Sarvam Job: ${sarvamJobId}...`);
        const startResponse = await fetch(`https://api.sarvam.ai/speech-to-text/job/v1/${sarvamJobId}/start`, {
            method: "POST",
            headers: sarvamHeaders,
            body: JSON.stringify({})
        });

        if (!startResponse.ok) {
            const errText = await startResponse.text();
            console.error("❌ Sarvam Start Job Error:", errText);
            return res.status(startResponse.status).json({ error: "Failed to start Sarvam job" });
        }
        console.log(`[transcribe] Sarvam job started successfully.`);

        // 6. Update database record with the job ID and processing state
        console.log(`[transcribe] 7/7: Updating database record for recording: ${recordingId}...`);
        await meetingService.updateRecordingJob(recordingId, sarvamJobId, durationSeconds);
        console.log(`[transcribe] Database record updated successfully.`);

        return res.status(200).json(
            new ApiResponse(200, {
                jobId: sarvamJobId,
                recordingId
            }, "Transcription job triggered successfully")
        );
    } catch (err: any) {
        console.error(`❌ [transcribeRecording] Pipeline failed for recordingId: ${recordingId}`, err);
        if (recordingId) {
            await meetingService.updateRecordingStatus(recordingId, "failed").catch(console.error);
        }
        return res.status(500).json({ error: "Transcription pipeline failed" });
    }
});

/**
 * Checks the status of a Sarvam Batch job and saves results upon completion
 */
export const getTranscriptionStatus = catchAsync(async (req: Request, res: Response) => {
    const { jobId, recordingId } = req.query;

    if (!jobId || !recordingId) {
        return res.status(400).json({ error: "Both jobId and recordingId query parameters are required" });
    }

    try {
        const sarvamHeaders = {
            "api-subscription-key": config.sarvamApiKey,
            "Content-Type": "application/json"
        };

        console.log(`Checking status for job: ${jobId}, recording: ${recordingId}`);

        const statusResponse = await fetch(`https://api.sarvam.ai/speech-to-text/job/v1/${jobId}/status`, {
            method: "GET",
            headers: sarvamHeaders
        });

        if (!statusResponse.ok) {
            const errText = await statusResponse.text();
            console.error("Sarvam Get Status Error:", errText);
            return res.status(statusResponse.status).json({ error: "Failed to fetch Sarvam job status" });
        }

        const statusData = await statusResponse.json() as any;
        const jobState = statusData.job_state; // Accepted | Pending | Running | Completed | Failed

        if (jobState === "Completed") {
            console.log(`Sarvam job completed! Fetching transcripts...`);
            const jobDetails = statusData.job_details || [];
            let transcriptText = "";
            let transcriptDiarized = null;
            let languageDetected = null;

            const successDetail = jobDetails.find((d: any) => d.state === "Success" && d.outputs && d.outputs.length > 0);
            if (successDetail) {
                const outputFile = successDetail.outputs[0];
                const outputFileName = outputFile.file_name;

                // Generate presigned GET url to download the JSON results from Sarvam
                const downloadUrlsResponse = await fetch("https://api.sarvam.ai/speech-to-text/job/v1/download-files", {
                    method: "POST",
                    headers: sarvamHeaders,
                    body: JSON.stringify({
                        job_id: jobId,
                        files: [outputFileName]
                    })
                });

                if (!downloadUrlsResponse.ok) {
                    const errText = await downloadUrlsResponse.text();
                    console.error("❌ Sarvam Download Urls Error:", errText);
                    return res.status(downloadUrlsResponse.status).json({ error: "Failed to request result download URL" });
                }

                const downloadData = await downloadUrlsResponse.json() as any;
                const downloadUrlObj = downloadData.download_urls?.[outputFileName];
                const downloadUrl = typeof downloadUrlObj === "string" ? downloadUrlObj : downloadUrlObj?.file_url;

                if (!downloadUrl) {
                    return res.status(500).json({ error: "Sarvam did not return a download URL for the result file" });
                }

                // Download and parse transcription output JSON
                const resultFileResponse = await fetch(downloadUrl);
                if (!resultFileResponse.ok) {
                    return res.status(resultFileResponse.status).json({ error: "Failed to download transcription results" });
                }

                const resultJson = await resultFileResponse.json() as any;

                transcriptText = resultJson.transcript || resultJson.text || "";
                transcriptDiarized = resultJson.diarized_transcript || null;
                languageDetected = resultJson.language_code || resultJson.language || null;
            }

            // Update database with final transcript text, JSON diarization and completed status
            const updated = await meetingService.updateRecordingResult(
                recordingId as string,
                "completed",
                transcriptText,
                transcriptDiarized,
                languageDetected
            );

            return res.status(200).json(
                new ApiResponse(200, {
                    status: "completed",
                    recording: updated
                }, "Transcription completed successfully")
            );
        } else if (jobState === "Failed") {
            console.warn(`Sarvam job ${jobId} failed.`);
            const updated = await meetingService.updateRecordingStatus(recordingId as string, "failed");

            return res.status(200).json(
                new ApiResponse(200, {
                    status: "failed",
                    recording: updated
                }, "Transcription job failed")
            );
        } else {
            // Still processing (Accepted, Pending, Running)
            return res.status(200).json(
                new ApiResponse(200, {
                    status: jobState.toLowerCase()
                }, `Transcription is in state: ${jobState}`)
            );
        }
    } catch (err: any) {
        console.error(`❌ [getTranscriptionStatus] Error for recordingId: ${recordingId}`, err);
        if (recordingId) {
            await meetingService.updateRecordingStatus(recordingId as string, "failed").catch(console.error);
        }
        return res.status(500).json({ error: "Failed to fetch transcription status" });
    }
});

/**
 * Retrieves recordings associated with a meeting ID
 */
export const getMeetingRecordings = catchAsync(async (req: Request, res: Response) => {
    const { meetingId } = req.params;
    
    if (!meetingId) {
        return res.status(400).json({ error: "Meeting ID param is required" });
    }

    try {
        const recordings = await meetingService.getRecordingsByMeetingId(meetingId as string);

        return res.status(200).json(
            new ApiResponse(200, recordings, "Meeting recordings retrieved successfully")
        );
    } catch (err: any) {
        console.error(`❌ [getMeetingRecordings] Error:`, err);
        return res.status(500).json({ error: "Failed to retrieve meeting recordings" });
    }
});
