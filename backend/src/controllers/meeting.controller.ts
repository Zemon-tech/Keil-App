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
import { createServiceLogger } from "../lib/logger";

const log = createServiceLogger("meeting");

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

        log.debug({ bucket: config.sevallaS3BucketName, s3Key }, "Generating presigned PUT URL");

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
        log.error({ err }, "getUploadUrl error");
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
        log.info({ s3Key, step: "1/7" }, "Generating S3 presigned GET URL");
        const getCommand = new GetObjectCommand({
            Bucket: config.sevallaS3BucketName,
            Key: s3Key,
        });
        const presignedAudioUrl = await getSignedUrl(getS3Client(), getCommand, { expiresIn: 3600 });
        log.debug("S3 GET URL generated successfully");

        const sarvamHeaders = {
            "api-subscription-key": config.sarvamApiKey,
            "Content-Type": "application/json"
        };

        log.info({ recordingId, step: "2/7" }, "Initiating Sarvam STT job");

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
            log.error({ errText }, "Sarvam job creation error");
            return res.status(createJobResponse.status).json({ error: "Failed to create Sarvam job" });
        }

        const { job_id: sarvamJobId } = await createJobResponse.json() as any;
        log.info({ sarvamJobId }, "Sarvam job created");

        // 3. Request presigned upload URLs from Sarvam
        log.info({ step: "3/7" }, "Requesting Azure upload URLs from Sarvam");
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
            log.error({ errText }, "Sarvam upload URLs error");
            return res.status(uploadUrlsResponse.status).json({ error: "Failed to get Sarvam upload URL" });
        }

        const uploadData = await uploadUrlsResponse.json() as any;
        const sarvamUploadUrlObj = uploadData.upload_urls?.[fileName];
        const sarvamUploadUrl = typeof sarvamUploadUrlObj === "string" 
            ? sarvamUploadUrlObj 
            : sarvamUploadUrlObj?.file_url;

        if (!sarvamUploadUrl) {
            log.error({ uploadData }, "Sarvam did not return upload URL");
            return res.status(500).json({ error: "Sarvam did not return an upload URL for the audio file" });
        }

        // 4. Stream S3 audio directly to Sarvam storage
        log.info({ step: "4/7" }, "Downloading audio from S3 via presigned GET");
        const audioResponse = await fetch(presignedAudioUrl);
        if (!audioResponse.ok) {
            return res.status(audioResponse.status).json({ error: "Failed to download audio file from S3" });
        }
        
        const contentLength = audioResponse.headers.get("content-length");
        
        log.info({ step: "5/7" }, "Streaming audio to Sarvam Azure storage");
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
            log.error({ errText }, "Sarvam storage upload error");
            return res.status(sarvamUploadResponse.status).json({ error: "Failed to upload audio to Sarvam storage" });
        }
        log.debug("Audio streamed successfully");

        // 5. Start the processing on Sarvam
        log.info({ sarvamJobId, step: "6/7" }, "Starting Sarvam job processing");
        const startResponse = await fetch(`https://api.sarvam.ai/speech-to-text/job/v1/${sarvamJobId}/start`, {
            method: "POST",
            headers: sarvamHeaders,
            body: JSON.stringify({})
        });

        if (!startResponse.ok) {
            const errText = await startResponse.text();
            log.error({ errText }, "Sarvam start job error");
            return res.status(startResponse.status).json({ error: "Failed to start Sarvam job" });
        }
        log.info("Sarvam job started successfully");

        // 6. Update database record with the job ID and processing state
        log.info({ recordingId, step: "7/7" }, "Updating database record");
        await meetingService.updateRecordingJob(recordingId, sarvamJobId, durationSeconds);
        log.info("Database record updated successfully");

        return res.status(200).json(
            new ApiResponse(200, {
                jobId: sarvamJobId,
                recordingId
            }, "Transcription job triggered successfully")
        );
    } catch (err: any) {
        log.error({ err, recordingId }, "Transcription pipeline failed");
        if (recordingId) {
            await meetingService.updateRecordingStatus(recordingId, "failed").catch(e => log.error({ err: e }, "Failed to update recording status"));
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

        log.debug({ jobId, recordingId }, "Checking transcription job status");

        const statusResponse = await fetch(`https://api.sarvam.ai/speech-to-text/job/v1/${jobId}/status`, {
            method: "GET",
            headers: sarvamHeaders
        });

        if (!statusResponse.ok) {
            const errText = await statusResponse.text();
            log.error({ errText }, "Sarvam get status error");
            return res.status(statusResponse.status).json({ error: "Failed to fetch Sarvam job status" });
        }

        const statusData = await statusResponse.json() as any;
        const jobState = statusData.job_state; // Accepted | Pending | Running | Completed | Failed

        if (jobState === "Completed") {
            log.info({ jobId }, "Sarvam job completed — fetching transcripts");
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
                    log.error({ errText }, "Sarvam download URLs error");
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
            log.warn({ jobId }, "Sarvam job failed");
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
        log.error({ err, recordingId }, "getTranscriptionStatus error");
        if (recordingId) {
            await meetingService.updateRecordingStatus(recordingId as string, "failed").catch(e => log.error({ err: e }, "Failed to update recording status"));
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
        log.error({ err }, "getMeetingRecordings error");
        return res.status(500).json({ error: "Failed to retrieve meeting recordings" });
    }
});

/**
 * Retrieves paginated meeting history for the authenticated user
 */
export const getMeetingHistory = catchAsync(async (req: Request, res: Response) => {
    const user = (req as any).user;

    if (!user || !user.id) {
        throw new ApiError(401, "User authentication required");
    }

    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(Math.max(1, parseInt(req.query.limit as string) || 20), 50);

    try {
        const { recordings, total } = await meetingService.getMeetingHistory(user.id, page, limit);

        return res.status(200).json(
            new ApiResponse(200, {
                recordings,
                pagination: { page, limit, total, hasMore: page * limit < total }
            }, "Meeting history retrieved successfully")
        );
    } catch (err: any) {
        console.error(`❌ [getMeetingHistory] Error:`, err);
        return res.status(500).json({ error: "Failed to retrieve meeting history" });
    }
});

/**
 * Searches meetings by transcript content
 */
export const searchMeetings = catchAsync(async (req: Request, res: Response) => {
    const user = (req as any).user;

    if (!user || !user.id) {
        throw new ApiError(401, "User authentication required");
    }

    const q = req.query.q as string;
    if (!q || q.trim().length === 0) {
        return res.status(400).json({ error: "Search query required" });
    }

    try {
        const recordings = await meetingService.searchMeetings(user.id, q.trim());

        return res.status(200).json(
            new ApiResponse(200, recordings, "Search results retrieved successfully")
        );
    } catch (err: any) {
        console.error(`❌ [searchMeetings] Error:`, err);
        return res.status(500).json({ error: "Search failed" });
    }
});

/**
 * Retrieves a single recording by ID for review (with ownership check)
 */
export const getRecordingReview = catchAsync(async (req: Request, res: Response) => {
    const user = (req as any).user;

    if (!user || !user.id) {
        throw new ApiError(401, "User authentication required");
    }

    const { recordingId } = req.params;
    if (!recordingId) {
        return res.status(400).json({ error: "Recording ID is required" });
    }

    try {
        const recording = await meetingService.getRecordingById(recordingId as string);

        if (!recording) {
            return res.status(404).json({ error: "Recording not found" });
        }

        if (recording.user_id !== user.id) {
            return res.status(403).json({ error: "Unauthorized" });
        }

        return res.status(200).json(
            new ApiResponse(200, recording, "Recording retrieved successfully")
        );
    } catch (err: any) {
        console.error(`❌ [getRecordingReview] Error:`, err);
        return res.status(500).json({ error: "Failed to retrieve recording" });
    }
});
