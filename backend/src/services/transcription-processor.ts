import fetch from "node-fetch";
import { config } from "../config";
import * as meetingService from "./meeting.service";
import { MeetingRecording } from "./meeting.service";
import { broadcastMeetingUpdate } from "../socket";
import { createServiceLogger } from "../lib/logger";

const log = createServiceLogger("transcription-processor");

const sarvamHeaders = {
    "api-subscription-key": config.sarvamApiKey,
    "Content-Type": "application/json"
};

/**
 * Processes a completed Sarvam transcription job:
 * 1. Fetches download URLs from Sarvam
 * 2. Downloads the result JSON
 * 3. Parses transcript text, diarized transcript, and language
 * 4. Updates the database
 * 5. Broadcasts WebSocket completion event
 */
export async function processCompletedTranscription(
    jobId: string,
    recordingId: string,
    userId: string
): Promise<MeetingRecording> {
    log.info({ jobId, recordingId }, "Processing completed transcription");

    // 1. Get the job status to find output file names
    const statusResponse = await fetch(`https://api.sarvam.ai/speech-to-text/job/v1/${jobId}/status`, {
        method: "GET",
        headers: sarvamHeaders
    });

    if (!statusResponse.ok) {
        const errText = await statusResponse.text();
        log.error({ errText, jobId }, "Failed to fetch job status during completion processing");
        throw new Error(`Failed to fetch Sarvam job status: ${errText}`);
    }

    const statusData = await statusResponse.json() as any;
    const jobDetails = statusData.job_details || [];

    let transcriptText = "";
    let transcriptDiarized = null;
    let languageDetected = null;

    const successDetail = jobDetails.find((d: any) => d.state === "Success" && d.outputs && d.outputs.length > 0);
    if (successDetail) {
        const outputFile = successDetail.outputs[0];
        const outputFileName = outputFile.file_name;

        // 2. Request download URL from Sarvam
        const downloadUrlsResponse = await fetch("https://api.sarvam.ai/speech-to-text/job/v1/download-files", {
            method: "POST",
            headers: sarvamHeaders,
            body: JSON.stringify({
                job_id: jobId,
                files: [outputFileName]
            })
        });

        if (!downloadUrlsResponse.ok) {
            const errText = await downloadUrlsResponse.text();
            log.error({ errText, jobId }, "Failed to get download URLs from Sarvam");
            throw new Error(`Failed to get Sarvam download URL: ${errText}`);
        }

        const downloadData = await downloadUrlsResponse.json() as any;
        const downloadUrlObj = downloadData.download_urls?.[outputFileName];
        const downloadUrl = typeof downloadUrlObj === "string" ? downloadUrlObj : downloadUrlObj?.file_url;

        if (!downloadUrl) {
            throw new Error("Sarvam did not return a download URL for the result file");
        }

        // 3. Download and parse the transcription result JSON
        const resultFileResponse = await fetch(downloadUrl);
        if (!resultFileResponse.ok) {
            throw new Error(`Failed to download transcription results: status ${resultFileResponse.status}`);
        }

        const resultJson = await resultFileResponse.json() as any;

        transcriptText = resultJson.transcript || resultJson.text || "";
        transcriptDiarized = resultJson.diarized_transcript || null;
        languageDetected = resultJson.language_code || resultJson.language || null;
    }

    // 4. Update database with final results
    const updated = await meetingService.updateRecordingResult(
        recordingId,
        "completed",
        transcriptText,
        transcriptDiarized,
        languageDetected
    );

    // 5. Broadcast WebSocket completion event
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
 * Processes a failed Sarvam transcription job:
 * 1. Updates the database status to failed
 * 2. Broadcasts WebSocket failure event
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
