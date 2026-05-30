/**
 * Shared types for the transcription provider abstraction layer.
 */

export type SttProvider = "sarvam" | "elevenlabs";

export interface TranscriptionResult {
    /** Full transcription text */
    transcriptText: string;
    /** Diarized transcript (speaker-segmented), provider-specific format normalized */
    transcriptDiarized: any | null;
    /** Detected language code (ISO 639) */
    languageDetected: string | null;
    /** Audio duration in seconds (if returned by provider) */
    audioDurationSeconds: number | null;
}

export interface TranscriptionJobInfo {
    /** Provider-specific job/transcription ID */
    jobId: string;
    /** Whether the result is already available (synchronous completion) */
    completed: boolean;
    /** If completed synchronously, the result is here */
    result?: TranscriptionResult;
}

export interface TranscriptionStatusResult {
    /** Normalized status: 'processing' | 'completed' | 'failed' */
    status: "processing" | "completed" | "failed";
    /** If completed, the transcription result */
    result?: TranscriptionResult;
}

export interface TranscriptionProvider {
    /** Unique provider identifier */
    readonly name: SttProvider;

    /**
     * Start a transcription job.
     * @param presignedAudioUrl - A presigned S3 GET URL for the audio file
     * @param options - Additional options (duration, content type, webhook URL, etc.)
     * @returns Job info with ID and optional synchronous result
     */
    startTranscription(
        presignedAudioUrl: string,
        options: StartTranscriptionOptions
    ): Promise<TranscriptionJobInfo>;

    /**
     * Check the status of an existing transcription job.
     * @param jobId - The provider-specific job ID
     * @returns Current status and result if completed
     */
    checkStatus(jobId: string): Promise<TranscriptionStatusResult>;
}

export interface StartTranscriptionOptions {
    /** Recording ID in our database */
    recordingId: string;
    /** Audio duration in seconds (if known) */
    durationSeconds?: number;
    /** MIME type of the audio */
    contentType?: string;
    /** Webhook callback URL for async completion */
    webhookUrl?: string;
    /** Webhook auth token */
    webhookSecret?: string;
}
