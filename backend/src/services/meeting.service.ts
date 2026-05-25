import pool from "../config/pg";

export interface MeetingRecording {
    id: string;
    user_id: string;
    meeting_id: string | null;
    audio_s3_key: string;
    audio_duration_seconds: number | null;
    sarvam_job_id: string | null;
    transcription_status: string;
    transcript_text: string | null;
    transcript_diarized: any | null;
    language_detected: string | null;
    created_at: Date;
    updated_at: Date;
}

/**
 * Creates a pending meeting recording database row
 */
export const createRecording = async (
    userId: string,
    meetingId: string | null,
    audioS3Key: string
): Promise<MeetingRecording> => {
    const queryText = `
        INSERT INTO public.meeting_recordings (
            user_id,
            meeting_id,
            audio_s3_key,
            transcription_status
        ) VALUES ($1, $2, $3, 'pending')
        RETURNING *
    `;
    const result = await pool.query(queryText, [userId, meetingId, audioS3Key]);
    return result.rows[0];
};

/**
 * Updates the recording with the Sarvam batch job ID and sets status to processing
 */
export const updateRecordingJob = async (
    recordingId: string,
    sarvamJobId: string,
    audioDurationSeconds?: number
): Promise<MeetingRecording> => {
    const queryText = `
        UPDATE public.meeting_recordings
        SET sarvam_job_id = $1,
            transcription_status = 'processing',
            audio_duration_seconds = COALESCE($2, audio_duration_seconds),
            updated_at = NOW()
        WHERE id = $3
        RETURNING *
    `;
    const result = await pool.query(queryText, [sarvamJobId, audioDurationSeconds || null, recordingId]);
    return result.rows[0];
};

/**
 * Updates the recording transcription status (e.g. failed)
 */
export const updateRecordingStatus = async (
    recordingId: string,
    status: string
): Promise<MeetingRecording> => {
    const queryText = `
        UPDATE public.meeting_recordings
        SET transcription_status = $1,
            updated_at = NOW()
        WHERE id = $2
        RETURNING *
    `;
    const result = await pool.query(queryText, [status, recordingId]);
    return result.rows[0];
};

/**
 * Updates the final transcription result
 */
export const updateRecordingResult = async (
    recordingId: string,
    status: string,
    transcriptText: string,
    transcriptDiarized: any,
    languageDetected?: string
): Promise<MeetingRecording> => {
    const queryText = `
        UPDATE public.meeting_recordings
        SET transcription_status = $1,
            transcript_text = $2,
            transcript_diarized = $3,
            language_detected = COALESCE($4, language_detected),
            updated_at = NOW()
        WHERE id = $5
        RETURNING *
    `;
    const result = await pool.query(queryText, [
        status,
        transcriptText,
        JSON.stringify(transcriptDiarized),
        languageDetected || null,
        recordingId
    ]);
    return result.rows[0];
};

/**
 * Fetches a recording by its ID
 */
export const getRecordingById = async (recordingId: string): Promise<MeetingRecording | null> => {
    const queryText = `
        SELECT * FROM public.meeting_recordings
        WHERE id = $1
    `;
    const result = await pool.query(queryText, [recordingId]);
    if (result.rows.length === 0) return null;
    return result.rows[0];
};

/**
 * Fetches recordings associated with a specific meeting
 */
export const getRecordingsByMeetingId = async (meetingId: string): Promise<MeetingRecording[]> => {
    const queryText = `
        SELECT * FROM public.meeting_recordings
        WHERE meeting_id = $1
        ORDER BY created_at DESC
    `;
    const result = await pool.query(queryText, [meetingId]);
    return result.rows;
};

/**
 * Fetches paginated meeting history for a user
 */
export const getMeetingHistory = async (
    userId: string,
    page: number = 1,
    limit: number = 20
): Promise<{ recordings: MeetingRecording[]; total: number }> => {
    const offset = (page - 1) * limit;

    const countQuery = `
        SELECT COUNT(*) as total FROM public.meeting_recordings
        WHERE user_id = $1
    `;
    const countResult = await pool.query(countQuery, [userId]);
    const total = parseInt(countResult.rows[0].total, 10);

    const queryText = `
        SELECT * FROM public.meeting_recordings
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT $2 OFFSET $3
    `;
    const result = await pool.query(queryText, [userId, limit, offset]);
    return { recordings: result.rows, total };
};

/**
 * Searches meetings by transcript text or title-like content
 */
export const searchMeetings = async (
    userId: string,
    query: string
): Promise<MeetingRecording[]> => {
    const queryText = `
        SELECT * FROM public.meeting_recordings
        WHERE user_id = $1
          AND (
            transcript_text ILIKE $2
            OR audio_s3_key ILIKE $2
          )
        ORDER BY created_at DESC
        LIMIT 20
    `;
    const result = await pool.query(queryText, [userId, `%${query}%`]);
    return result.rows;
};
