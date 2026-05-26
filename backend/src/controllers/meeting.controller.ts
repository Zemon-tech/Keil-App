import { Request, Response } from "express";
import fetch from "node-fetch";
import { catchAsync } from "../utils/catchAsync";
import { ApiResponse } from "../utils/ApiResponse";
import { ApiError } from "../utils/ApiError";
import { config } from "../config";
import { getS3Client } from "../lib/s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
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

        // 4. Update database record with the job ID and processing state synchronously
        log.info({ recordingId, step: "4/7" }, "Updating database record to processing state");
        await meetingService.updateRecordingJob(recordingId, sarvamJobId, durationSeconds);

        // Broadcast real-time processing initiation notification via WebSockets
        try {
            const { broadcastMeetingUpdate } = require("../socket");
            const updatedRec = await meetingService.getRecordingById(recordingId);
            broadcastMeetingUpdate(user.id, {
                type: "transcription_started",
                recordingId: recordingId,
                status: "processing",
                recording: updatedRec
            });
        } catch (sockErr) {
            log.warn({ sockErr, recordingId }, "Failed to broadcast WebSocket transcription processing start update");
        }

        // 5. Fire off the heavy background streaming and starting asynchronously (fire-and-forget)
        log.info({ recordingId, sarvamJobId }, "Triggering async S3 streaming and start job pipeline in the background");
        
        (async () => {
            try {
                log.info({ sarvamJobId, step: "Background 1/3" }, "Downloading audio from S3 via presigned GET in background");
                const audioResponse = await fetch(presignedAudioUrl);
                if (!audioResponse.ok) {
                    throw new Error(`Failed to download audio file from S3: status ${audioResponse.status}`);
                }
                
                const contentLength = audioResponse.headers.get("content-length");
                
                log.info({ sarvamJobId, step: "Background 2/3" }, "Streaming audio to Sarvam Azure storage in background");
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
                    throw new Error(`Failed to upload audio to Sarvam storage: status ${sarvamUploadResponse.status}, details: ${errText}`);
                }
                log.info({ sarvamJobId }, "Audio streamed successfully to Sarvam in background");

                log.info({ sarvamJobId, step: "Background 3/3" }, "Triggering Sarvam job start in background");
                const startResponse = await fetch(`https://api.sarvam.ai/speech-to-text/job/v1/${sarvamJobId}/start`, {
                    method: "POST",
                    headers: sarvamHeaders,
                    body: JSON.stringify({})
                });

                if (!startResponse.ok) {
                    const errText = await startResponse.text();
                    throw new Error(`Failed to start Sarvam job: status ${startResponse.status}, details: ${errText}`);
                }
                log.info({ sarvamJobId }, "Sarvam job successfully started in background");
            } catch (bgError: any) {
                log.error({ err: bgError, sarvamJobId, recordingId }, "Asynchronous background streaming/starting pipeline failed");
                const updated = await meetingService.updateRecordingStatus(recordingId, "failed").catch(e => {
                    log.error({ err: e }, "Failed to update recording status on background failure");
                    return null;
                });
                if (updated) {
                    try {
                        const { broadcastMeetingUpdate } = require("../socket");
                        broadcastMeetingUpdate(updated.user_id, {
                            type: "transcription_complete",
                            recordingId: recordingId,
                            status: "failed",
                            recording: updated
                        });
                    } catch (sockErr) {
                        log.warn({ sockErr }, "Failed to broadcast WebSocket transcription failure update on background error");
                    }
                }
            }
        })().catch(e => log.error({ err: e }, "Unhandled background Promise rejection"));

        // 6. Return response to the frontend instantly
        return res.status(200).json(
            new ApiResponse(200, {
                jobId: sarvamJobId,
                recordingId
            }, "Transcription job triggered and processing in the background")
        );

    } catch (err: any) {
        log.error({ err, recordingId }, "Transcription pipeline trigger failed");
        if (recordingId) {
            const updated = await meetingService.updateRecordingStatus(recordingId, "failed").catch(e => {
                log.error({ err: e }, "Failed to update recording status on trigger failure");
                return null;
            });
            if (updated) {
                try {
                    const { broadcastMeetingUpdate } = require("../socket");
                    broadcastMeetingUpdate(updated.user_id, {
                        type: "transcription_complete",
                        recordingId: recordingId,
                        status: "failed",
                        recording: updated
                    });
                } catch (sockErr) {
                    log.warn({ sockErr }, "Failed to broadcast WebSocket transcription failure update on trigger failure");
                }
            }
        }
        return res.status(500).json({ error: "Failed to trigger transcription pipeline" });
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
        // Optimistically check database state first to avoid redundant Sarvam API network calls
        const localRecording = await meetingService.getRecordingById(recordingId as string);
        if (localRecording) {
            if (localRecording.transcription_status === "completed" || localRecording.transcription_status === "failed") {
                log.debug({ recordingId }, "Recording status resolved from database cache");
                return res.status(200).json(
                    new ApiResponse(200, {
                        status: localRecording.transcription_status,
                        recording: localRecording
                    }, `Transcription status resolved from database: ${localRecording.transcription_status}`)
                );
            }
        }

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

            // Broadcast real-time completion notification via WebSockets
            try {
                const { broadcastMeetingUpdate } = require("../socket");
                broadcastMeetingUpdate(updated.user_id, {
                    type: "transcription_complete",
                    recordingId: recordingId as string,
                    status: "completed",
                    recording: updated
                });
            } catch (sockErr) {
                log.warn({ sockErr }, "Failed to broadcast WebSocket transcription completion update");
            }

            return res.status(200).json(
                new ApiResponse(200, {
                    status: "completed",
                    recording: updated
                }, "Transcription completed successfully")
            );
        } else if (jobState === "Failed") {
            log.warn({ jobId }, "Sarvam job failed");
            const updated = await meetingService.updateRecordingStatus(recordingId as string, "failed");

            // Broadcast failure notification via WebSockets
            try {
                const { broadcastMeetingUpdate } = require("../socket");
                broadcastMeetingUpdate(updated.user_id, {
                    type: "transcription_complete",
                    recordingId: recordingId as string,
                    status: "failed",
                    recording: updated
                });
            } catch (sockErr) {
                log.warn({ sockErr }, "Failed to broadcast WebSocket transcription failure update");
            }

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

        // Generate pre-signed URL for the audio file in the bucket
        const getCommand = new GetObjectCommand({
            Bucket: config.sevallaS3BucketName,
            Key: recording.audio_s3_key,
        });
        const presignedAudioUrl = await getSignedUrl(getS3Client(), getCommand, { expiresIn: 3600 });

        return res.status(200).json(
            new ApiResponse(200, {
                ...recording,
                audio_url: presignedAudioUrl
            }, "Recording retrieved successfully")
        );
    } catch (err: any) {
        console.error(`❌ [getRecordingReview] Error:`, err);
        return res.status(500).json({ error: "Failed to retrieve recording" });
    }
});

/**
 * Stop/cancel transcription of an active processing or pending recording
 */
export const cancelTranscription = catchAsync(async (req: Request, res: Response) => {
    const user = (req as any).user;

    if (!user || !user.id) {
        throw new ApiError(401, "User authentication required");
    }

    const recordingId = req.params.recordingId as string;
    if (!recordingId) {
        return res.status(400).json({ error: "Recording ID is required" });
    }

    try {
        const recording = await meetingService.getRecordingById(recordingId);

        if (!recording) {
            return res.status(404).json({ error: "Recording not found" });
        }

        if (recording.user_id !== user.id) {
            return res.status(403).json({ error: "Unauthorized to cancel this transcription" });
        }

        // Only allow canceling if state is pending or processing
        if (recording.transcription_status !== "pending" && recording.transcription_status !== "processing") {
            return res.status(400).json({ error: "Can only cancel active transcription jobs" });
        }

        // Set status to failed/cancelled in database
        const updated = await meetingService.updateRecordingStatus(recordingId, "failed");

        // Broadcast failure update via WebSockets to instantly update lists and stop spinners
        try {
            const { broadcastMeetingUpdate } = require("../socket");
            broadcastMeetingUpdate(user.id, {
                type: "transcription_complete",
                recordingId: recordingId,
                status: "failed",
                recording: updated
            });
        } catch (sockErr) {
            log.warn({ sockErr }, "Failed to broadcast WebSocket transcription cancellation update");
        }

        return res.status(200).json(
            new ApiResponse(200, updated, "Transcription processing cancelled successfully")
        );
    } catch (err: any) {
        console.error(`❌ [cancelTranscription] Error:`, err);
        return res.status(500).json({ error: "Failed to cancel transcription" });
    }
});

/**
 * Permanently delete a meeting recording (audio file in S3 bucket and database row)
 */
export const deleteRecording = catchAsync(async (req: Request, res: Response) => {
    const user = (req as any).user;

    if (!user || !user.id) {
        throw new ApiError(401, "User authentication required");
    }

    const recordingId = req.params.recordingId as string;
    if (!recordingId) {
        return res.status(400).json({ error: "Recording ID is required" });
    }

    try {
        const recording = await meetingService.getRecordingById(recordingId);

        if (!recording) {
            return res.status(404).json({ error: "Recording not found" });
        }

        if (recording.user_id !== user.id) {
            return res.status(403).json({ error: "Unauthorized to delete this recording" });
        }

        // 1. Delete the raw audio file from the S3 bucket to save cloud storage costs
        if (recording.audio_s3_key) {
            log.info({ recordingId, s3Key: recording.audio_s3_key }, "Deleting audio file from S3 bucket");
            const deleteCommand = new DeleteObjectCommand({
                Bucket: config.sevallaS3BucketName,
                Key: recording.audio_s3_key,
            });
            await getS3Client().send(deleteCommand).catch(s3Err => {
                log.error({ s3Err }, "Failed to delete audio file from S3 bucket during recording deletion");
            });
        }

        // 2. Delete the record from the database
        log.info({ recordingId }, "Deleting recording database row");
        const deleted = await meetingService.deleteRecording(recordingId, user.id);

        if (!deleted) {
            return res.status(500).json({ error: "Failed to delete database record" });
        }

        // 3. Broadcast real-time deletion via WebSockets to clear it from any active frontend views
        try {
            const { broadcastMeetingUpdate } = require("../socket");
            broadcastMeetingUpdate(user.id, {
                type: "recording_deleted",
                recordingId: recordingId,
                status: "deleted"
            });
        } catch (sockErr) {
            log.warn({ sockErr }, "Failed to broadcast WebSocket deletion update");
        }

        return res.status(200).json(
            new ApiResponse(200, { recordingId }, "Recording and audio data deleted successfully")
        );
    } catch (err: any) {
        console.error(`❌ [deleteRecording] Error:`, err);
        return res.status(500).json({ error: "Failed to delete recording" });
    }
});
