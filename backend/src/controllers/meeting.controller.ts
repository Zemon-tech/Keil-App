import { Request, Response } from "express";
import { catchAsync } from "../utils/catchAsync";
import { ApiResponse } from "../utils/ApiResponse";
import { ApiError } from "../utils/ApiError";
import { config } from "../config";
import { getS3Client } from "../lib/s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import * as meetingService from "../services/meeting.service";
import { processFailedTranscription } from "../services/transcription-processor";
import { getTranscriptionProvider, isValidSttProvider } from "../services/transcription";
import * as userPreferencesService from "../services/user-preferences.service";
import { createServiceLogger } from "../lib/logger";

const log = createServiceLogger("meeting");

/**
 * Sanitizes MIME types (e.g. 'audio/webm;codecs=opus' -> 'audio/webm') to conform to S3 requirements.
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

        log.debug({ bucket: config.awsS3BucketName, s3Key }, "Generating presigned PUT URL");

        const command = new PutObjectCommand({
            Bucket: config.awsS3BucketName,
            Key: s3Key,
            ContentType: sanitizeMimeType(contentType),
        });

        const uploadUrl = await getSignedUrl(getS3Client(), command, { expiresIn: 3600 });

        // Create database row in pending state
        const recording = await meetingService.createRecording(userId, dbMeetingId, s3Key, "sarvam");

        log.info({ recordingId: recording.id }, "Sarvam flow: returning S3 upload URL");

        return res.status(200).json(
            new ApiResponse(200, {
                uploadUrl,
                s3Key,
                recordingId: recording.id,
                provider: "sarvam"
            }, "Presigned S3 upload URL generated")
        );
    } catch (err: any) {
        log.error({ err }, "getUploadUrl error");
        return res.status(500).json({ error: "Failed to generate upload URL" });
    }
});

/**
 * Starts a transcription job via ElevenLabs.
 * Frontend uploads audio to S3, then calls this endpoint with the s3Key.
 */
export const transcribeRecording = catchAsync(async (req: Request, res: Response) => {
    const { recordingId, s3Key, durationSeconds, contentType, provider: reqProvider } = req.body;
    const user = (req as any).user;

    try {
        if (!user || !user.id) {
            return res.status(401).json({ error: "User authentication required" });
        }

        if (!recordingId) {
            return res.status(400).json({ error: "Recording ID is required" });
        }

        // Fetch existing recording details if they exist in the DB
        const existingRecording = await meetingService.getRecordingById(recordingId);
        if (existingRecording && existingRecording.user_id !== user.id) {
            return res.status(403).json({ error: "Unauthorized to access this recording" });
        }

        const finalS3Key = s3Key || existingRecording?.audio_s3_key;
        const finalDuration = durationSeconds || existingRecording?.audio_duration_seconds || 0;

        if (!finalS3Key) {
            return res.status(400).json({ error: "s3Key is required for transcription" });
        }

        // Determine provider (body parameter -> user preferences -> default "sarvam")
        const userPrefProvider = await userPreferencesService.getSttProvider(user.id);
        const chosenProvider = (reqProvider && isValidSttProvider(reqProvider)) ? reqProvider : userPrefProvider;

        log.info({ recordingId, s3Key: finalS3Key, durationSeconds: finalDuration, contentType, provider: chosenProvider }, "Transcription flow started");

        // Update duration if provided
        if (finalDuration) {
            await meetingService.updateRecordingDuration(recordingId, finalDuration);
        }

        // Set recording to processing state
        await meetingService.updateRecordingJob(recordingId, `${chosenProvider}_pending_${Date.now()}`, finalDuration, chosenProvider);

        // Broadcast processing started
        try {
            const { broadcastMeetingUpdate } = require("../socket");
            const updatedRec = await meetingService.getRecordingById(recordingId);
            broadcastMeetingUpdate(user.id, {
                type: "transcription_started",
                recordingId,
                status: "processing",
                recording: updatedRec
            });
        } catch (sockErr) {
            log.warn({ sockErr, recordingId }, "Failed to broadcast WebSocket transcription start");
        }

        // Generate presigned GET URL for STT Provider to fetch the audio
        const getCommand = new GetObjectCommand({
            Bucket: config.awsS3BucketName,
            Key: finalS3Key,
        });
        const presignedAudioUrl = await getSignedUrl(getS3Client(), getCommand, { expiresIn: 3600 });

        // Fire-and-forget: run transcription in background
        (async () => {
            try {
                const providerInstance = getTranscriptionProvider(chosenProvider);
                const jobInfo = await providerInstance.startTranscription(presignedAudioUrl, {
                    recordingId,
                    durationSeconds: finalDuration,
                    contentType: contentType || "audio/webm",
                });

                log.info({ recordingId, jobId: jobInfo.jobId, completed: jobInfo.completed, provider: chosenProvider }, "Transcription provider returned");

                if (jobInfo.completed && jobInfo.result) {
                    // Synchronous completion — update job ID then save final results
                    await meetingService.updateRecordingJob(recordingId, jobInfo.jobId, jobInfo.result.audioDurationSeconds || finalDuration, chosenProvider);

                    const updated = await meetingService.updateRecordingResult(
                        recordingId,
                        "completed",
                        jobInfo.result.transcriptText,
                        jobInfo.result.transcriptDiarized,
                        jobInfo.result.languageDetected || undefined
                    );

                    try {
                        const { broadcastMeetingUpdate } = require("../socket");
                        broadcastMeetingUpdate(user.id, {
                            type: "transcription_complete",
                            recordingId,
                            status: "completed",
                            recording: updated
                        });
                    } catch (sockErr) {
                        log.warn({ sockErr }, "Failed to broadcast transcription completion");
                    }
                } else {
                    // Async path — update job ID for polling
                    await meetingService.updateRecordingJob(recordingId, jobInfo.jobId, finalDuration, chosenProvider);
                }
            } catch (bgError: any) {
                log.error({ err: bgError, recordingId, provider: chosenProvider }, "Background transcription error");
                const updated = await meetingService.updateRecordingStatus(recordingId, "failed").catch(e => {
                    log.error({ err: e }, "Could not update recording status to 'failed'");
                    return null;
                });
                if (updated) {
                    try {
                        const { broadcastMeetingUpdate } = require("../socket");
                        broadcastMeetingUpdate(user.id, {
                            type: "transcription_complete",
                            recordingId,
                            status: "failed",
                            recording: updated
                        });
                    } catch (sockErr) {
                        log.warn({ sockErr }, "Failed to broadcast transcription failure");
                    }
                }
            }
        })().catch(e => log.error({ err: e }, "Unhandled background rejection"));

        return res.status(200).json(
            new ApiResponse(200, {
                jobId: `${chosenProvider}_${recordingId}`,
                recordingId,
                provider: chosenProvider
            }, "Transcription triggered in background")
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
                        recordingId,
                        status: "failed",
                        recording: updated
                    });
                } catch (sockErr) {
                    log.warn({ sockErr }, "Failed to broadcast failure");
                }
            }
        }
        return res.status(500).json({ error: "Failed to trigger transcription pipeline" });
    }
});

/**
 * Checks the status of a transcription job.
 * ElevenLabs is synchronous — if the DB still shows "processing", the background task
 * hasn't finished yet. The WebSocket will deliver the result when it completes.
 */
export const getTranscriptionStatus = catchAsync(async (req: Request, res: Response) => {
    const { jobId, recordingId } = req.query;

    if (!jobId || !recordingId) {
        return res.status(400).json({ error: "Both jobId and recordingId query parameters are required" });
    }

    try {
        const localRecording = await meetingService.getRecordingById(recordingId as string);

        if (localRecording) {
            if (localRecording.transcription_status === "completed" || localRecording.transcription_status === "failed") {
                return res.status(200).json(
                    new ApiResponse(200, {
                        status: localRecording.transcription_status,
                        recording: localRecording
                    }, `Transcription status: ${localRecording.transcription_status}`)
                );
            }

            // Safety check: transcript saved but status not updated
            if (localRecording.transcript_text && localRecording.transcription_status === "processing") {
                log.warn({ recordingId }, "Recording has transcript but status is processing — fixing");
                const updated = await meetingService.updateRecordingStatus(recordingId as string, "completed");
                return res.status(200).json(
                    new ApiResponse(200, {
                        status: "completed",
                        recording: updated
                    }, "Transcription completed (status corrected)")
                );
            }
        }

        return res.status(200).json(
            new ApiResponse(200, { status: "processing" }, "Transcription is still processing in background")
        );
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
        log.error({ err }, "getMeetingHistory error");
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
        log.error({ err }, "searchMeetings error");
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

        const getCommand = new GetObjectCommand({
            Bucket: config.awsS3BucketName,
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
        log.error({ err }, "getRecordingReview error");
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

        if (recording.transcription_status !== "pending" && recording.transcription_status !== "processing") {
            return res.status(400).json({ error: "Can only cancel active transcription jobs" });
        }

        const updated = await meetingService.updateRecordingStatus(recordingId, "failed");

        try {
            const { broadcastMeetingUpdate } = require("../socket");
            broadcastMeetingUpdate(user.id, {
                type: "transcription_complete",
                recordingId,
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
        log.error({ err }, "cancelTranscription error");
        return res.status(500).json({ error: "Failed to cancel transcription" });
    }
});

/**
 * Permanently delete a meeting recording (audio file in S3 and database row)
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

        if (recording.audio_s3_key) {
            log.info({ recordingId, s3Key: recording.audio_s3_key }, "Deleting audio file from S3");
            try {
                const deleteCommand = new DeleteObjectCommand({
                    Bucket: config.awsS3BucketName,
                    Key: recording.audio_s3_key,
                });
                await getS3Client().send(deleteCommand).catch(s3Err => {
                    log.error({ s3Err }, "Failed to delete audio file from S3");
                });
            } catch (s3Err) {
                log.error({ s3Err }, "Failed to acquire S3 client or delete audio file");
            }
        }

        const deleted = await meetingService.deleteRecording(recordingId, user.id);

        if (!deleted) {
            return res.status(500).json({ error: "Failed to delete database record" });
        }

        try {
            const { broadcastMeetingUpdate } = require("../socket");
            broadcastMeetingUpdate(user.id, {
                type: "recording_deleted",
                recordingId,
                status: "deleted"
            });
        } catch (sockErr) {
            log.warn({ sockErr }, "Failed to broadcast WebSocket deletion update");
        }

        return res.status(200).json(
            new ApiResponse(200, { recordingId }, "Recording and audio data deleted successfully")
        );
    } catch (err: any) {
        log.error({ err }, "deleteRecording error");
        return res.status(500).json({ error: "Failed to delete recording" });
    }
});
