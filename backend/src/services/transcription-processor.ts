import * as meetingService from "./meeting.service";
import { MeetingRecording } from "./meeting.service";
import { broadcastMeetingUpdate } from "../socket";
import { createServiceLogger } from "../lib/logger";

const log = createServiceLogger("transcription-processor");

/**
 * Saves a completed transcription result to the database and broadcasts
 * a WebSocket completion event to the user.
 */
export async function processCompletedTranscription(
    jobId: string,
    recordingId: string,
    userId: string,
    result: { transcriptText: string; transcriptDiarized: any | null; languageDetected: string | null }
): Promise<MeetingRecording> {
    log.info({ jobId, recordingId }, "Saving completed transcription result");

    const updated = await meetingService.updateRecordingResult(
        recordingId,
        "completed",
        result.transcriptText,
        result.transcriptDiarized,
        result.languageDetected ?? undefined
    );

    try {
        broadcastMeetingUpdate(userId, {
            type: "transcription_complete",
            recordingId,
            status: "completed",
            recording: updated
        });
    } catch (sockErr) {
        log.warn({ sockErr, recordingId }, "Failed to broadcast WebSocket transcription completion");
    }

    log.info({ jobId, recordingId }, "Transcription processing completed successfully");
    return updated;
}

/**
 * Marks a transcription as failed in the database and broadcasts
 * a WebSocket failure event to the user.
 */
export async function processFailedTranscription(
    jobId: string,
    recordingId: string,
    userId: string
): Promise<MeetingRecording> {
    log.warn({ jobId, recordingId }, "Processing failed transcription");

    const updated = await meetingService.updateRecordingStatus(recordingId, "failed");

    try {
        broadcastMeetingUpdate(userId, {
            type: "transcription_complete",
            recordingId,
            status: "failed",
            recording: updated
        });
    } catch (sockErr) {
        log.warn({ sockErr, recordingId }, "Failed to broadcast WebSocket transcription failure");
    }

    return updated;
}
