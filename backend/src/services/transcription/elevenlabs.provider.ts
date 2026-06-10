import fetch from "node-fetch";
import FormData from "form-data";
import { config } from "../../config";
import { createServiceLogger } from "../../lib/logger";
import {
    TranscriptionProvider,
    TranscriptionJobInfo,
    TranscriptionStatusResult,
    TranscriptionResult,
    StartTranscriptionOptions,
} from "./types";

const log = createServiceLogger("elevenlabs-provider");

/**
 * ElevenLabs Scribe v2 transcription provider.
 * 
 * Uses the `source_url` approach — passes a presigned S3 URL
 * directly to ElevenLabs instead of re-uploading the file.
 * (Note: `cloud_storage_url` was deprecated by ElevenLabs in favor of `source_url`)
 * 
 * For files under ~10 min, the API returns results synchronously.
 * For longer files, it supports webhook-based async completion.
 */
export class ElevenLabsProvider implements TranscriptionProvider {
    readonly name = "elevenlabs" as const;

    async startTranscription(
        presignedAudioUrl: string,
        options: StartTranscriptionOptions
    ): Promise<TranscriptionJobInfo> {
        log.info({ recordingId: options.recordingId, contentType: options.contentType, durationSeconds: options.durationSeconds }, "[EL-STT] Starting ElevenLabs Scribe v2 transcription");

        try {
            // Use the REST API directly with source_url (cloud_storage_url is deprecated)
            const formData = new FormData();
            formData.append("model_id", "scribe_v2");
            formData.append("source_url", presignedAudioUrl);
            formData.append("diarize", "true");
            formData.append("timestamps_granularity", "word");
            formData.append("tag_audio_events", "true");

            log.debug({ recordingId: options.recordingId, apiKeyPrefix: config.elevenlabsApiKey?.substring(0, 8) }, "[EL-STT] Sending request to ElevenLabs API");

            const startTime = Date.now();
            const response = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
                method: "POST",
                headers: {
                    "xi-api-key": config.elevenlabsApiKey,
                    ...formData.getHeaders(),
                },
                body: formData,
            });
            const elapsed = Date.now() - startTime;

            log.info({ recordingId: options.recordingId, status: response.status, elapsed: `${elapsed}ms` }, "[EL-STT] ElevenLabs API responded");

            if (!response.ok) {
                const errText = await response.text();
                log.error({ status: response.status, errText, recordingId: options.recordingId }, "[EL-STT] ElevenLabs STT request FAILED (non-2xx)");
                throw new Error(`ElevenLabs STT failed (${response.status}): ${errText}`);
            }

            const result = (await response.json()) as any;
            log.info(
                {
                    recordingId: options.recordingId,
                    languageCode: result.language_code,
                    textLength: result.text?.length || 0,
                    wordsCount: result.words?.length || 0,
                    audioDurationSecs: result.audio_duration_secs,
                    transcriptionId: result.transcription_id,
                },
                "[EL-STT] ElevenLabs transcription completed synchronously"
            );

            // ElevenLabs returns results synchronously for most files
            const normalized = this.normalizeResult(result);
            log.debug({
                recordingId: options.recordingId,
                normalizedTextLength: normalized.transcriptText?.length || 0,
                hasDiarized: !!normalized.transcriptDiarized,
                diarizedEntries: normalized.transcriptDiarized?.entries?.length || 0,
            }, "[EL-STT] Normalized result ready");

            return {
                jobId: result.transcription_id || `el_${Date.now()}`,
                completed: true,
                result: normalized,
            };
        } catch (err: any) {
            log.error({ err, errMessage: err?.message, errStack: err?.stack, recordingId: options.recordingId }, "[EL-STT] ElevenLabs transcription THREW an exception");
            throw err;
        }
    }

    async checkStatus(jobId: string): Promise<TranscriptionStatusResult> {
        // ElevenLabs Scribe v2 batch API is synchronous — if we get here,
        // it means the job was started but we need to check if it completed.
        // Since we handle completion synchronously in startTranscription,
        // this is only called as a fallback/polling mechanism.
        
        // For the webhook flow, the webhook handler will process the result directly.
        // If polling is needed, we can check via the transcription ID.
        try {
            const response = await fetch(
                `https://api.elevenlabs.io/v1/speech-to-text/${jobId}`,
                {
                    method: "GET",
                    headers: {
                        "xi-api-key": config.elevenlabsApiKey,
                    },
                }
            );

            if (!response.ok) {
                if (response.status === 404) {
                    // Job not found — might still be processing or invalid
                    return { status: "processing" };
                }
                const errText = await response.text();
                log.error({ errText, jobId }, "ElevenLabs status check failed");
                return { status: "failed" };
            }

            const result = (await response.json()) as any;

            if (result.text !== undefined) {
                return {
                    status: "completed",
                    result: this.normalizeResult(result),
                };
            }

            return { status: "processing" };
        } catch (err: any) {
            log.error({ err, jobId }, "ElevenLabs checkStatus error");
            return { status: "failed" };
        }
    }

    /**
     * Normalizes ElevenLabs response to our standard TranscriptionResult format.
     * Diarized output format: { entries: [{ speaker_id, start_time_seconds, end_time_seconds, transcript }] }
     */
    private normalizeResult(elResult: any): TranscriptionResult {
        const transcriptText = elResult.text || "";
        const languageDetected = elResult.language_code || null;
        const audioDurationSeconds = elResult.audio_duration_secs || null;

        // Build diarized transcript from words array (group by speaker)
        // Output format: { entries: [{ speaker_id, start_time_seconds, end_time_seconds, transcript }] }
        let transcriptDiarized = null;
        if (elResult.words && Array.isArray(elResult.words)) {
            const entries: Array<{
                speaker_id: string;
                transcript: string;
                start_time_seconds: number;
                end_time_seconds: number;
            }> = [];

            let currentSpeaker: string | null = null;
            let currentEntry: { speaker_id: string; transcript: string; start_time_seconds: number; end_time_seconds: number } | null = null;

            for (const word of elResult.words) {
                if (word.type !== "word") continue;

                const speaker = word.speaker_id || "speaker_0";

                if (speaker !== currentSpeaker) {
                    // New speaker segment
                    if (currentEntry) {
                        entries.push(currentEntry);
                    }
                    currentSpeaker = speaker;
                    currentEntry = {
                        speaker_id: speaker,
                        transcript: word.text,
                        start_time_seconds: word.start,
                        end_time_seconds: word.end,
                    };
                } else if (currentEntry) {
                    // Same speaker, append
                    currentEntry.transcript += " " + word.text;
                    currentEntry.end_time_seconds = word.end;
                }
            }

            if (currentEntry) {
                entries.push(currentEntry);
            }

            transcriptDiarized = { entries };
        }

        return {
            transcriptText,
            transcriptDiarized,
            languageDetected,
            audioDurationSeconds,
        };
    }
}
