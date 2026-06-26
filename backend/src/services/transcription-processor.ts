import * as meetingService from "./meeting.service";
import { MeetingRecording } from "./meeting.service";
import { broadcastMeetingUpdate } from "../socket";
import { createServiceLogger } from "../lib/logger";
import { generateTextResponse } from "./ai.service";
import { createPage } from "./motion-page.service";
import { markdownToTiptap } from "./notion.service";
import { taskRepository, organisationRepository, spaceRepository } from "../repositories";

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

            // Resolve target org_id and space_id
            let orgId: string | null = null;
            let spaceId: string | null = null;

            if (updated.meeting_id) {
                const task = await taskRepository.findById(updated.meeting_id);
                if (task) {
                    orgId = task.org_id ?? null;
                    spaceId = task.space_id ?? null;
                }
            }

            if (!orgId || !spaceId) {
                const orgs = await organisationRepository.findByUserId(userId);
                if (orgs && orgs.length > 0) {
                    orgId = orgs[0].id;
                    const defaultSpace = await spaceRepository.findDefaultSpace(orgId);
                    if (defaultSpace) {
                        spaceId = defaultSpace.id;
                    } else {
                        const visibleSpaces = await spaceRepository.findVisibleByOrgAndUser(orgId, userId);
                        if (visibleSpaces && visibleSpaces.length > 0) {
                            spaceId = visibleSpaces[0].id;
                        }
                    }
                }
            }

            if (!orgId || !spaceId) {
                log.warn({ recordingId, userId }, "Could not resolve org_id or space_id for saving meeting summary");
                return;
            }

            // Convert markdown to tiptap json
            const tiptapContent = markdownToTiptap(summaryText);

            // Save the summary as a MotionPage
            const pageTitle = `Meeting Summary: ${new Date(updated.created_at).toLocaleDateString()}`;
            await createPage(orgId, spaceId, userId, {
                title: pageTitle,
                content: tiptapContent
            });

            log.info({ recordingId, orgId, spaceId }, "Meeting summary successfully saved to Motion page");

            // Save summary_text to database
            const finalUpdatedWithSummary = await meetingService.updateRecordingSummary(recordingId, summaryText);

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
