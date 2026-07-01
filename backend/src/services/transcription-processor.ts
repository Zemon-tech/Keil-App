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
            const prompt = `Please provide a concise, structured summary of the following meeting transcript.

Format your response using these sections:

## Meeting Summary
Provide a brief 2–4 sentence overview of the discussion.

## Key Points
- Summarize the main topics discussed.
- Include only the most important information.
- Group related points together where appropriate.

## Decisions Made
- List all decisions reached during the meeting.
- If no decisions were made, state "No decisions recorded."

## Action Items
For each action item, use the following format:

- **Task:** <Describe the action>
  - **Owner:** <Person responsible or "Not specified">
  - **Due Date:** <Date or "Not specified">
  - **Status:** Pending

If no action items are mentioned, state:
**No action items identified.**
- If an owner or due date is not specified, write "Not specified."

## Open Questions / Follow-ups
- List any unresolved questions or items requiring further discussion.
- If none, state "None."

Keep the summary clear, professional, and concise. Do not add information that is not present in the transcript. Use bullet points where appropriate.

${result.transcriptText}`;
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
