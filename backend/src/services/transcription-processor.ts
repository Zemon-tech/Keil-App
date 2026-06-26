import * as meetingService from "./meeting.service";
import { MeetingRecording } from "./meeting.service";
import { broadcastMeetingUpdate } from "../socket";
import { createServiceLogger } from "../lib/logger";
import { generateTextResponse } from "./ai.service";
import { saveMeetingSummaryToMotion } from "./meeting-motion.service";

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

    // Trigger AI summarization and page creation in the background
    (async () => {
        try {
            if (!result.transcriptText || result.transcriptText.trim().length === 0) {
                log.info({ recordingId }, "Transcript text is empty, skipping AI summary page creation");
                return;
            }

            log.info({ recordingId }, "Generating AI summary for meeting transcript");
            const prompt = `Please provide a concise, structured summary of the following meeting transcript. Highlight key points, decisions, and action items with clear formatting:\n\n${result.transcriptText}`;
            const aiResult = await generateTextResponse([
                { role: "user", content: prompt }
            ]);

            const summaryText = aiResult.text;
            if (!summaryText) {
                log.warn({ recordingId }, "AI summary text is empty");
                return;
            }

            // Save summary_text to database before creating Motion/Notion pages
            const finalUpdatedWithSummary = await meetingService.updateRecordingSummary(recordingId, summaryText);

            try {
                const { page, notionExported } = await saveMeetingSummaryToMotion(
                    finalUpdatedWithSummary,
                    userId
                );
                log.info(
                    { recordingId, pageId: page.id, notionExported },
                    "Meeting summary saved to Motion page"
                );
            } catch (saveErr) {
                log.warn({ err: saveErr, recordingId }, "Could not save meeting summary to Motion");
            }

            // Re-broadcast transcription complete with the newly populated summary
            try {
                broadcastMeetingUpdate(userId, {
                    type: "transcription_complete",
                    recordingId,
                    status: "completed",
                    recording: finalUpdatedWithSummary
                });
            } catch (sockErr) {
                log.warn({ sockErr, recordingId }, "Failed to broadcast WebSocket transcription summary update");
            }
        } catch (err) {
            log.error({ err, recordingId }, "Error generating and saving meeting summary");
        }
    })();

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
