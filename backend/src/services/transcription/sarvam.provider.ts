import fs from "fs";
import os from "os";
import path from "path";
import fetch from "node-fetch";
import { SarvamAIClient } from "sarvamai";
import { config } from "../../config";
import { createServiceLogger } from "../../lib/logger";
import {
    TranscriptionProvider,
    TranscriptionJobInfo,
    TranscriptionStatusResult,
    TranscriptionResult,
    StartTranscriptionOptions,
} from "./types";

const log = createServiceLogger("sarvam-provider");

/**
 * Sarvam AI Saaras v3 transcription provider.
 *
 * Uses the Batch API — required because the REST API only handles up to 30s of audio.
 * Flow:
 *   1. createJob (saaras:v3, with_diarization)
 *   2. Download audio from presigned S3 URL to a temp file
 *   3. uploadFiles (via SDK — needs local path)
 *   4. start()
 *   5. Poll getStatus until Completed / Failed
 *   6. downloadOutputs → parse 0.json → normalise result
 *
 * Auth: `api-subscription-key` header (NOT Authorization: Bearer)
 */
export class SarvamProvider implements TranscriptionProvider {
    readonly name = "sarvam" as const;

    private getClient(): SarvamAIClient {
        if (!config.sarvamApiKey) {
            throw new Error("SARVAM_API_KEY is not configured");
        }
        return new SarvamAIClient({ apiSubscriptionKey: config.sarvamApiKey });
    }

    async startTranscription(
        presignedAudioUrl: string,
        options: StartTranscriptionOptions
    ): Promise<TranscriptionJobInfo> {
        const { recordingId, durationSeconds, contentType } = options;

        log.info({ recordingId, durationSeconds, contentType }, "[Sarvam] Starting Saaras v3 Batch transcription");

        const client = this.getClient();
        let tempFilePath: string | null = null;
        let tempDir: string | null = null;
        let outputDir: string | null = null;

        try {
            // Step 1: Create batch job
            const job = await client.speechToTextJob.createJob({
                model: "saaras:v3",
                mode: "transcribe",
                withDiarization: true,
                // Let Sarvam auto-detect language — works well for Indian languages + English
                // languageCode: "hi-IN",  // uncomment to pin language
            });

            log.info({ recordingId, jobId: job.jobId }, "[Sarvam] Batch job created");

            // Step 2: Download audio from S3 presigned URL to a temp file
            const ext = this.guessExtension(contentType);
            tempDir = fs.mkdtempSync(path.join(os.tmpdir(), `sarvam-${recordingId}-`));
            tempFilePath = path.join(tempDir, `audio${ext}`);

            log.debug({ recordingId, tempFilePath }, "[Sarvam] Downloading audio from S3 to temp file");

            const audioResponse = await fetch(presignedAudioUrl);
            if (!audioResponse.ok) {
                throw new Error(`Failed to download audio from S3: ${audioResponse.status} ${audioResponse.statusText}`);
            }

            const audioBuffer = Buffer.from(await audioResponse.arrayBuffer());
            fs.writeFileSync(tempFilePath, audioBuffer);
            log.debug({ recordingId, sizeBytes: audioBuffer.length }, "[Sarvam] Audio downloaded to temp file");

            // Step 3: Upload to Sarvam
            await job.uploadFiles([tempFilePath]);
            log.debug({ recordingId, jobId: job.jobId }, "[Sarvam] Audio uploaded to Sarvam storage");

            // Step 4: Start the job
            await job.start();
            log.info({ recordingId, jobId: job.jobId }, "[Sarvam] Batch job started");

            // Step 5: Poll for completion (fire-and-forget background loop)
            // We do this inline so the entire transcription completes before returning.
            // The controller already wraps this in a fire-and-forget IIFE.
            const MAX_POLLS = 120;       // up to 10 minutes (5s intervals)
            const POLL_INTERVAL_MS = 5000;

            let polls = 0;
            while (polls < MAX_POLLS) {
                await sleep(POLL_INTERVAL_MS);
                polls++;

                const status = await this.checkStatus(job.jobId);
                log.debug({ recordingId, jobId: job.jobId, status: status.status, poll: polls }, "[Sarvam] Status poll");

                if (status.status === "completed" && status.result) {
                    log.info({ recordingId, jobId: job.jobId, polls }, "[Sarvam] Transcription completed");
                    return {
                        jobId: job.jobId,
                        completed: true,
                        result: status.result,
                    };
                }

                if (status.status === "failed") {
                    throw new Error(`Sarvam batch job ${job.jobId} failed during processing`);
                }
                // status === "processing" → keep polling
            }

            throw new Error(`Sarvam batch job ${job.jobId} timed out after ${MAX_POLLS} polls`);

        } finally {
            // Clean up temp files
            try {
                if (tempFilePath && fs.existsSync(tempFilePath)) {
                    fs.unlinkSync(tempFilePath);
                }
                if (tempDir && fs.existsSync(tempDir)) {
                    fs.rmSync(tempDir, { recursive: true, force: true });
                }
                if (outputDir && fs.existsSync(outputDir)) {
                    fs.rmSync(outputDir, { recursive: true, force: true });
                }
            } catch (cleanupErr) {
                log.warn({ cleanupErr, recordingId }, "[Sarvam] Temp file cleanup failed (non-fatal)");
            }
        }
    }

    async checkStatus(jobId: string): Promise<TranscriptionStatusResult> {
        try {
            const client = this.getClient();
            const statusResponse = await client.speechToTextJob.getStatus(jobId);
            const state: string = (statusResponse as any).job_state ?? (statusResponse as any).jobState ?? "";

            log.debug({ jobId, state }, "[Sarvam] checkStatus response");

            if (state === "Completed") {
                // Download and parse results
                const result = await this.downloadAndParseResult(jobId, statusResponse);
                return { status: "completed", result };
            }

            if (state === "Failed") {
                return { status: "failed" };
            }

            // Accepted / Pending / Running → still processing
            return { status: "processing" };

        } catch (err: any) {
            log.error({ err, jobId }, "[Sarvam] checkStatus error");
            return { status: "failed" };
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Private helpers
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Downloads output JSON from a completed Sarvam batch job and normalises it
     * into our standard TranscriptionResult shape.
     */
    private async downloadAndParseResult(jobId: string, statusResponse: any): Promise<TranscriptionResult> {
        const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), `sarvam-out-${jobId}-`));

        try {
            const client = this.getClient();
            const jobInstance = client.speechToTextJob.getJob(jobId);

            // downloadOutputs saves output JSON files to the given directory
            await jobInstance.downloadOutputs(outputDir);

            // Find the first JSON output file (e.g. "0.json")
            const files = fs.readdirSync(outputDir).filter(f => f.endsWith(".json"));
            if (files.length === 0) {
                throw new Error(`No output JSON files found in ${outputDir}`);
            }

            const raw = JSON.parse(fs.readFileSync(path.join(outputDir, files[0]), "utf-8"));
            log.debug({ jobId, outputFile: files[0], keys: Object.keys(raw) }, "[Sarvam] Parsed output JSON");

            return this.normalizeResult(raw);
        } finally {
            try {
                fs.rmSync(outputDir, { recursive: true, force: true });
            } catch (_) { /* non-fatal */ }
        }
    }

    /**
     * Normalises Sarvam batch output JSON into our TranscriptionResult format.
     *
     * Sarvam output shape:
     * {
     *   transcript: string,
     *   language_code: string,
     *   diarized_transcript?: {
     *     entries: [{ transcript, start_time_seconds, end_time_seconds, speaker_id }]
     *   },
     *   timestamps?: { words, start_time_seconds, end_time_seconds }
     * }
     */
    private normalizeResult(raw: any): TranscriptionResult {
        const transcriptText: string = raw.transcript ?? "";
        const languageDetected: string | null = raw.language_code ?? null;

        // Diarized output: already in our preferred format
        let transcriptDiarized: any | null = null;
        if (raw.diarized_transcript?.entries?.length > 0) {
            // Normalise speaker_id to a consistent format (Sarvam returns "0", "1", etc.)
            const entries = raw.diarized_transcript.entries.map((e: any) => ({
                speaker_id: `speaker_${e.speaker_id}`,
                transcript: e.transcript,
                start_time_seconds: e.start_time_seconds,
                end_time_seconds: e.end_time_seconds,
            }));
            transcriptDiarized = { entries };
        }

        return {
            transcriptText,
            transcriptDiarized,
            languageDetected,
            audioDurationSeconds: null, // Sarvam batch doesn't return duration directly
        };
    }

    /**
     * Guesses a safe file extension from a MIME type.
     * Falls back to .webm since that's what the browser MediaRecorder produces.
     */
    private guessExtension(contentType?: string): string {
        if (!contentType) return ".webm";
        const mime = contentType.split(";")[0].trim().toLowerCase();
        const map: Record<string, string> = {
            "audio/webm": ".webm",
            "audio/ogg": ".ogg",
            "audio/mp4": ".mp4",
            "audio/mpeg": ".mp3",
            "audio/wav": ".wav",
            "audio/x-wav": ".wav",
            "audio/flac": ".flac",
            "audio/aac": ".aac",
        };
        return map[mime] ?? ".webm";
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Utility
// ─────────────────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}
