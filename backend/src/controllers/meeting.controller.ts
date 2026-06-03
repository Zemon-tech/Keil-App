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
import { processCompletedTranscription, processFailedTranscription } from "../services/transcription-processor";
import { getTranscriptionProvider, SttProvider } from "../services/transcription";
import * as userPreferencesService from "../services/user-preferences.service";
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

        log.debug({ bucket: config.awsS3BucketName, s3Key }, "Generating presigned PUT URL");

        const command = new PutObjectCommand({
            Bucket: config.awsS3BucketName,
            Key: s3Key,
            ContentType: sanitizeMimeType(contentType),
        });

        const uploadUrl = await getSignedUrl(getS3Client(), command, { expiresIn: 3600 });

        // Determine user's STT provider preference
        const sttProvider = await userPreferencesService.getSttProvider(userId);

        // Create database row in pending state
        const recording = await meetingService.createRecording(userId, dbMeetingId, s3Key, sttProvider);

        // For ElevenLabs, we only need the S3 upload URL — no Sarvam Azure staging needed
        if (sttProvider === "elevenlabs") {
            log.info({ recordingId: recording.id, provider: "elevenlabs" }, "ElevenLabs flow: returning S3 upload URL only");
            return res.status(200).json(
                new ApiResponse(200, {
                    uploadUrl,
                    s3Key,
                    recordingId: recording.id,
                    provider: "elevenlabs"
                }, "Presigned S3 upload URL generated (ElevenLabs provider)")
            );
        }

        // ─── Sarvam flow: Create batch job early for direct frontend upload ───
        const sarvamHeaders = {
            "api-subscription-key": config.sarvamApiKey,
            "Content-Type": "application/json"
        };

        log.info({ recordingId: recording.id }, "Creating Sarvam job early for direct frontend upload");

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
                },
                ...(config.sarvamWebhookSecret && config.backendUrl ? {
                    callback: {
                        url: `${config.backendUrl}/api/v1/meetings/webhook/sarvam`,
                        auth_token: config.sarvamWebhookSecret
                    }
                } : {})
            })
        });

        if (!createJobResponse.ok) {
            const errText = await createJobResponse.text();
            log.error({ errText }, "Sarvam job creation error during upload-url");
            // Fall back to returning just the S3 URL — transcribe endpoint will handle Sarvam job creation
            return res.status(200).json(
                new ApiResponse(200, {
                    uploadUrl,
                    s3Key,
                    recordingId: recording.id
                }, "Presigned S3 upload URL generated (Sarvam job creation deferred)")
            );
        }

        const { job_id: sarvamJobId } = await createJobResponse.json() as any;
        log.info({ sarvamJobId }, "Sarvam job created early");

        // Get Sarvam Azure upload URL
        const sarvamFileName = s3Key.split("/").pop() || "audio.webm";
        const uploadUrlsResponse = await fetch("https://api.sarvam.ai/speech-to-text/job/v1/upload-files", {
            method: "POST",
            headers: sarvamHeaders,
            body: JSON.stringify({
                job_id: sarvamJobId,
                files: [sarvamFileName]
            })
        });

        let sarvamUploadUrl: string | null = null;
        if (uploadUrlsResponse.ok) {
            const uploadData = await uploadUrlsResponse.json() as any;
            const sarvamUploadUrlObj = uploadData.upload_urls?.[sarvamFileName];
            sarvamUploadUrl = typeof sarvamUploadUrlObj === "string" 
                ? sarvamUploadUrlObj 
                : sarvamUploadUrlObj?.file_url || null;
        } else {
            log.warn("Failed to get Sarvam upload URL during upload-url — frontend will use legacy flow");
        }

        // Update DB with job ID immediately
        await meetingService.updateRecordingJob(recording.id, sarvamJobId, undefined);

        res.status(200).json(
            new ApiResponse(200, {
                uploadUrl,
                sarvamUploadUrl,
                sarvamJobId,
                s3Key,
                recordingId: recording.id
            }, "Upload URLs generated successfully")
        );
    } catch (err: any) {
        log.error({ err }, "getUploadUrl error");
        return res.status(500).json({ error: "Failed to generate upload URL" });
    }
});

/**
 * Creates, uploads, and starts a transcription job.
 * 
 * Supports multiple flows based on provider:
 * - SARVAM (NEW): Frontend passes sarvamJobId — audio already uploaded to Sarvam by frontend.
 * - SARVAM (LEGACY): Frontend passes s3Key — backend downloads from S3, uploads to Sarvam, starts job.
 * - ELEVENLABS: Backend generates presigned S3 GET URL and passes it to ElevenLabs cloud_storage_url.
 */
export const transcribeRecording = catchAsync(async (req: Request, res: Response) => {
    const { recordingId, s3Key, sarvamJobId: frontendJobId, durationSeconds, contentType, provider: requestProvider } = req.body;
    const user = (req as any).user;

    try {
        if (!user || !user.id) {
            return res.status(401).json({ error: "User authentication required" });
        }

        if (!recordingId) {
            return res.status(400).json({ error: "Recording ID is required" });
        }

        // Determine provider: use request body override or fall back to user preference
        const sttProvider: SttProvider = requestProvider || await userPreferencesService.getSttProvider(user.id);

        // ─── ELEVENLABS FLOW ───────────────────────────────────────────────────
        if (sttProvider === "elevenlabs") {
            log.info({ recordingId, provider: "elevenlabs", s3Key, durationSeconds, contentType }, "[EL-FLOW] Step 1: ElevenLabs transcription flow started");

            if (!s3Key) {
                log.error({ recordingId }, "[EL-FLOW] ABORT: s3Key is missing");
                return res.status(400).json({ error: "s3Key is required for ElevenLabs transcription" });
            }

            // Update duration if provided
            if (durationSeconds) {
                log.debug({ recordingId, durationSeconds }, "[EL-FLOW] Step 2: Updating recording duration");
                await meetingService.updateRecordingDuration(recordingId, durationSeconds);
            }

            // Update recording to processing state
            log.debug({ recordingId }, "[EL-FLOW] Step 3: Setting recording to processing state");
            await meetingService.updateRecordingJob(recordingId, `el_pending_${Date.now()}`, durationSeconds);

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
                log.debug({ recordingId }, "[EL-FLOW] Step 4: Broadcast transcription_started via WebSocket");
            } catch (sockErr) {
                log.warn({ sockErr, recordingId }, "[EL-FLOW] Step 4: Failed to broadcast WebSocket transcription start");
            }

            // Generate presigned GET URL for ElevenLabs to fetch the audio
            const getCommand = new GetObjectCommand({
                Bucket: config.awsS3BucketName,
                Key: s3Key,
            });
            const presignedAudioUrl = await getSignedUrl(getS3Client(), getCommand, { expiresIn: 3600 });
            log.info({ recordingId, presignedUrlPrefix: presignedAudioUrl.substring(0, 80) }, "[EL-FLOW] Step 5: Generated presigned GET URL for S3 audio");

            // Fire-and-forget: run ElevenLabs transcription in background
            (async () => {
                try {
                    log.info({ recordingId }, "[EL-FLOW] Step 6: Calling ElevenLabs provider.startTranscription()");
                    const provider = getTranscriptionProvider("elevenlabs");
                    const jobInfo = await provider.startTranscription(presignedAudioUrl, {
                        recordingId,
                        durationSeconds,
                        contentType,
                    });

                    log.info({ recordingId, jobId: jobInfo.jobId, completed: jobInfo.completed, hasResult: !!jobInfo.result }, "[EL-FLOW] Step 7: ElevenLabs provider returned");

                    if (jobInfo.completed && jobInfo.result) {
                        log.info({
                            recordingId,
                            jobId: jobInfo.jobId,
                            textLength: jobInfo.result.transcriptText?.length || 0,
                            language: jobInfo.result.languageDetected,
                            audioDuration: jobInfo.result.audioDurationSeconds,
                            hasDiarized: !!jobInfo.result.transcriptDiarized,
                        }, "[EL-FLOW] Step 8: Transcription completed synchronously, saving to DB");

                        // Synchronous completion — update job ID first, then save final results
                        await meetingService.updateRecordingJob(recordingId, jobInfo.jobId, jobInfo.result.audioDurationSeconds || durationSeconds);
                        log.debug({ recordingId }, "[EL-FLOW] Step 8a: Updated recording job ID in DB");

                        const updated = await meetingService.updateRecordingResult(
                            recordingId,
                            "completed",
                            jobInfo.result.transcriptText,
                            jobInfo.result.transcriptDiarized,
                            jobInfo.result.languageDetected || undefined
                        );
                        log.info({ recordingId, updatedStatus: updated?.transcription_status }, "[EL-FLOW] Step 8b: Saved transcription result to DB");

                        try {
                            const { broadcastMeetingUpdate } = require("../socket");
                            broadcastMeetingUpdate(user.id, {
                                type: "transcription_complete",
                                recordingId,
                                status: "completed",
                                recording: updated
                            });
                            log.info({ recordingId }, "[EL-FLOW] Step 9: Broadcast transcription_complete (success) via WebSocket");
                        } catch (sockErr) {
                            log.warn({ sockErr }, "[EL-FLOW] Step 9: Failed to broadcast ElevenLabs completion");
                        }
                    } else {
                        // Async — update job ID for polling
                        log.info({ recordingId, jobId: jobInfo.jobId }, "[EL-FLOW] Step 8: Async mode — updating job ID for polling");
                        await meetingService.updateRecordingJob(recordingId, jobInfo.jobId, durationSeconds);
                    }
                } catch (bgError: any) {
                    log.error({
                        err: bgError,
                        errMessage: bgError?.message,
                        errStack: bgError?.stack,
                        recordingId
                    }, "[EL-FLOW] FAILED: ElevenLabs background transcription error");
                    const updated = await meetingService.updateRecordingStatus(recordingId, "failed").catch(e => {
                        log.error({ err: e }, "[EL-FLOW] FAILED: Could not update recording status to 'failed' in DB");
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
                            log.warn({ recordingId }, "[EL-FLOW] Broadcast transcription_complete (failed) via WebSocket");
                        } catch (sockErr) {
                            log.warn({ sockErr }, "[EL-FLOW] Failed to broadcast ElevenLabs failure");
                        }
                    }
                }
            })().catch(e => log.error({ err: e, errMessage: (e as any)?.message, errStack: (e as any)?.stack }, "[EL-FLOW] Unhandled ElevenLabs background rejection"));

            return res.status(200).json(
                new ApiResponse(200, {
                    jobId: `el_${recordingId}`,
                    recordingId,
                    provider: "elevenlabs"
                }, "ElevenLabs transcription triggered in background")
            );
        }

        // ─── SARVAM FLOW (NEW): Frontend already uploaded to Sarvam Azure ─────
        if (frontendJobId) {
            log.info({ recordingId, sarvamJobId: frontendJobId }, "New flow: starting pre-created Sarvam job");

            // Update duration if provided
            if (durationSeconds) {
                await meetingService.updateRecordingDuration(recordingId, durationSeconds);
            }

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

            // Start the Sarvam job (audio already uploaded by frontend)
            const startResponse = await fetch(
                `https://api.sarvam.ai/speech-to-text/job/v1/${frontendJobId}/start`,
                {
                    method: "POST",
                    headers: { "api-subscription-key": config.sarvamApiKey, "Content-Type": "application/json" },
                    body: JSON.stringify({})
                }
            );

            if (!startResponse.ok) {
                const errText = await startResponse.text();
                log.error({ errText, sarvamJobId: frontendJobId }, "Failed to start Sarvam job");
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
                    log.warn({ sockErr }, "Failed to broadcast failure");
                }
                return res.status(500).json({ error: "Failed to start Sarvam job" });
            }

            log.info({ sarvamJobId: frontendJobId }, "Sarvam job started successfully (new flow)");

            return res.status(200).json(
                new ApiResponse(200, {
                    jobId: frontendJobId,
                    recordingId,
                    provider: "sarvam"
                }, "Transcription job started")
            );
        }

        // ─── SARVAM FLOW (LEGACY): Backend handles S3 download + Sarvam upload ─
        if (!s3Key) {
            return res.status(400).json({ error: "Either sarvamJobId or s3Key is required" });
        }

        // 1. Generate presigned S3 GET URL
        log.info({ s3Key, step: "1/6" }, "Legacy flow: Generating S3 presigned GET URL");
        const getCommand = new GetObjectCommand({
            Bucket: config.awsS3BucketName,
            Key: s3Key,
        });
        const presignedAudioUrl = await getSignedUrl(getS3Client(), getCommand, { expiresIn: 3600 });

        const sarvamHeaders = {
            "api-subscription-key": config.sarvamApiKey,
            "Content-Type": "application/json"
        };

        // 2. PARALLEL: Create Sarvam job + Download audio from S3 simultaneously
        log.info({ recordingId, step: "2/6" }, "Parallel: Creating Sarvam job + downloading S3 audio");

        const [createJobResponse, audioResponse] = await Promise.all([
            fetch("https://api.sarvam.ai/speech-to-text/job/v1", {
                method: "POST",
                headers: sarvamHeaders,
                body: JSON.stringify({
                    job_parameters: {
                        model: "saaras:v3",
                        mode: "transcribe",
                        language_code: "en-IN",
                        with_diarization: true,
                        num_speakers: 2
                    },
                    ...(config.sarvamWebhookSecret && config.backendUrl ? {
                        callback: {
                            url: `${config.backendUrl}/api/v1/meetings/webhook/sarvam`,
                            auth_token: config.sarvamWebhookSecret
                        }
                    } : {})
                })
            }),
            fetch(presignedAudioUrl)
        ]);

        if (!createJobResponse.ok) {
            const errText = await createJobResponse.text();
            log.error({ errText }, "Sarvam job creation error");
            return res.status(createJobResponse.status).json({ error: "Failed to create Sarvam job" });
        }

        const { job_id: sarvamJobId } = await createJobResponse.json() as any;
        log.info({ sarvamJobId }, "Sarvam job created");

        if (!audioResponse.ok) {
            log.error({ status: audioResponse.status }, "Failed to download audio from S3");
            return res.status(500).json({ error: "Failed to download audio from S3" });
        }

        const contentLength = audioResponse.headers.get("content-length");

        // 3. Request presigned upload URLs from Sarvam (depends on job_id)
        log.info({ step: "3/6" }, "Requesting Azure upload URLs from Sarvam");
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

        // 4. Update database record with the job ID and processing state
        log.info({ recordingId, step: "4/6" }, "Updating database record to processing state");
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

        // 5. Background: Upload audio to Sarvam Azure + Start job (fire-and-forget)
        log.info({ recordingId, sarvamJobId, step: "5/6" }, "Background: uploading to Sarvam Azure + starting job");
        
        (async () => {
            try {
                log.info({ sarvamJobId, step: "Background 1/2" }, "Streaming audio to Sarvam Azure storage");
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
                log.info({ sarvamJobId }, "Audio streamed successfully to Sarvam");

                log.info({ sarvamJobId, step: "Background 2/2" }, "Starting Sarvam job");
                const startResponse = await fetch(`https://api.sarvam.ai/speech-to-text/job/v1/${sarvamJobId}/start`, {
                    method: "POST",
                    headers: sarvamHeaders,
                    body: JSON.stringify({})
                });

                if (!startResponse.ok) {
                    const errText = await startResponse.text();
                    throw new Error(`Failed to start Sarvam job: status ${startResponse.status}, details: ${errText}`);
                }
                log.info({ sarvamJobId }, "Sarvam job successfully started");
            } catch (bgError: any) {
                log.error({ err: bgError, sarvamJobId, recordingId }, "Background upload/start pipeline failed");
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
                        log.warn({ sockErr }, "Failed to broadcast WebSocket failure on background error");
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
                    log.warn({ sockErr }, "Failed to broadcast WebSocket failure on trigger failure");
                }
            }
        }
        return res.status(500).json({ error: "Failed to trigger transcription pipeline" });
    }
});

/**
 * Checks the status of a transcription job and saves results upon completion.
 * Supports both Sarvam and ElevenLabs providers.
 */
export const getTranscriptionStatus = catchAsync(async (req: Request, res: Response) => {
    const { jobId, recordingId } = req.query;

    if (!jobId || !recordingId) {
        return res.status(400).json({ error: "Both jobId and recordingId query parameters are required" });
    }

    try {
        // Optimistically check database state first to avoid redundant API network calls
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

        // Determine provider from the recording's stt_provider column or job ID prefix
        const recordingProvider = (localRecording as any)?.stt_provider;
        const isElevenLabs = recordingProvider === "elevenlabs" || (jobId as string).startsWith("el_");

        if (isElevenLabs) {
            // ElevenLabs transcription is synchronous — if the DB still shows "processing",
            // it means the background task hasn't finished yet. We should NOT call the
            // ElevenLabs API to check status (there's nothing to poll).
            // Instead, just tell the frontend to keep waiting — the WebSocket will deliver
            // the result when the background task completes.
            
            // Safety check: if transcript data exists but status is still "processing",
            // it means the result was saved but status wasn't updated correctly — fix it.
            if (localRecording && localRecording.transcript_text && localRecording.transcription_status === "processing") {
                log.warn({ recordingId }, "ElevenLabs recording has transcript but status is processing — fixing");
                const updated = await meetingService.updateRecordingStatus(recordingId as string, "completed");
                return res.status(200).json(
                    new ApiResponse(200, {
                        status: "completed",
                        recording: updated
                    }, "Transcription completed (status corrected)")
                );
            }

            // Otherwise, just report current status — background task is still running
            return res.status(200).json(
                new ApiResponse(200, { status: "processing" }, "ElevenLabs transcription is still processing in background")
            );
        }

        // ─── Sarvam flow (existing logic) ──────────────────────────────────────
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
            log.info({ jobId }, "Sarvam job completed — fetching transcripts via shared processor");
            const userId = localRecording?.user_id || (req as any).user?.id;
            const updated = await processCompletedTranscription(jobId as string, recordingId as string, userId);

            return res.status(200).json(
                new ApiResponse(200, {
                    status: "completed",
                    recording: updated
                }, "Transcription completed successfully")
            );
        } else if (jobState === "Failed") {
            log.warn({ jobId }, "Sarvam job failed");
            const userId = localRecording?.user_id || (req as any).user?.id;
            const updated = await processFailedTranscription(jobId as string, recordingId as string, userId);

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
            try {
                const deleteCommand = new DeleteObjectCommand({
                    Bucket: config.awsS3BucketName,
                    Key: recording.audio_s3_key,
                });
                await getS3Client().send(deleteCommand).catch(s3Err => {
                    log.error({ s3Err }, "Failed to delete audio file from S3 bucket during recording deletion");
                });
            } catch (s3Err) {
                log.error({ s3Err }, "Failed to acquire S3 client or delete audio file from S3 bucket");
            }
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

/**
 * Webhook handler for Sarvam AI batch job completion callbacks.
 * This endpoint is NOT protected by auth middleware — Sarvam's servers call it directly.
 * Authentication is done via the auth_token in the request body.
 */
export const handleSarvamWebhook = catchAsync(async (req: Request, res: Response) => {
    const { auth_token, job_id, status: jobStatus } = req.body;

    log.info({ job_id, jobStatus }, "Sarvam webhook received");

    // 1. Verify auth_token
    if (!auth_token || auth_token !== config.sarvamWebhookSecret) {
        log.warn({ job_id }, "Sarvam webhook rejected: invalid auth_token");
        return res.status(401).json({ error: "Invalid auth token" });
    }

    if (!job_id) {
        return res.status(400).json({ error: "job_id is required" });
    }

    // 2. Look up recording by sarvam_job_id
    const recording = await meetingService.getRecordingByJobId(job_id);
    if (!recording) {
        log.warn({ job_id }, "Sarvam webhook: recording not found for job_id");
        return res.status(404).json({ error: "Recording not found for this job" });
    }

    // 3. Idempotency check — if already processed, return 200 immediately
    if (recording.transcription_status === "completed" || recording.transcription_status === "failed") {
        log.debug({ job_id, recordingId: recording.id }, "Sarvam webhook: already processed, skipping");
        return res.status(200).json({ received: true, already_processed: true });
    }

    // 4. Process based on status
    const normalizedStatus = (jobStatus || "").toLowerCase();

    if (normalizedStatus === "completed") {
        try {
            await processCompletedTranscription(job_id, recording.id, recording.user_id);
        } catch (err: any) {
            log.error({ err, job_id, recordingId: recording.id }, "Webhook: failed to process completed transcription");
            // Still return 200 to Sarvam so they don't retry — polling fallback will handle it
        }
    } else if (normalizedStatus === "failed") {
        try {
            await processFailedTranscription(job_id, recording.id, recording.user_id);
        } catch (err: any) {
            log.error({ err, job_id, recordingId: recording.id }, "Webhook: failed to process failed transcription");
        }
    } else {
        log.debug({ job_id, jobStatus }, "Sarvam webhook: intermediate status, ignoring");
    }

    return res.status(200).json({ received: true });
});
