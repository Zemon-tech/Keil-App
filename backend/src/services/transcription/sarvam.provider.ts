import fetch from "node-fetch";
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

const sarvamHeaders = {
    "api-subscription-key": config.sarvamApiKey,
    "Content-Type": "application/json",
};

/**
 * Sarvam AI batch transcription provider.
 * Uses the Sarvam batch job API with Azure blob staging.
 */
export class SarvamProvider implements TranscriptionProvider {
    readonly name = "sarvam" as const;

    async startTranscription(
        presignedAudioUrl: string,
        options: StartTranscriptionOptions
    ): Promise<TranscriptionJobInfo> {
        // 1. Create Sarvam batch job
        log.info({ recordingId: options.recordingId }, "Creating Sarvam batch job");

        const createJobResponse = await fetch("https://api.sarvam.ai/speech-to-text/job/v1", {
            method: "POST",
            headers: sarvamHeaders,
            body: JSON.stringify({
                job_parameters: {
                    model: "saaras:v3",
                    mode: "transcribe",
                    language_code: "en-IN",
                    with_diarization: true,
                    num_speakers: 2,
                },
                ...(options.webhookSecret && options.webhookUrl
                    ? {
                          callback: {
                              url: options.webhookUrl,
                              auth_token: options.webhookSecret,
                          },
                      }
                    : {}),
            }),
        });

        if (!createJobResponse.ok) {
            const errText = await createJobResponse.text();
            log.error({ errText }, "Sarvam job creation failed");
            throw new Error(`Sarvam job creation failed: ${errText}`);
        }

        const { job_id: sarvamJobId } = (await createJobResponse.json()) as any;
        log.info({ sarvamJobId }, "Sarvam job created");

        // 2. Download audio from S3
        const audioResponse = await fetch(presignedAudioUrl);
        if (!audioResponse.ok) {
            throw new Error(`Failed to download audio from S3: status ${audioResponse.status}`);
        }
        const contentLength = audioResponse.headers.get("content-length");

        // 3. Get Sarvam Azure upload URL
        const fileName = `audio-${Date.now()}.webm`;
        const uploadUrlsResponse = await fetch("https://api.sarvam.ai/speech-to-text/job/v1/upload-files", {
            method: "POST",
            headers: sarvamHeaders,
            body: JSON.stringify({
                job_id: sarvamJobId,
                files: [fileName],
            }),
        });

        if (!uploadUrlsResponse.ok) {
            const errText = await uploadUrlsResponse.text();
            throw new Error(`Failed to get Sarvam upload URL: ${errText}`);
        }

        const uploadData = (await uploadUrlsResponse.json()) as any;
        const sarvamUploadUrlObj = uploadData.upload_urls?.[fileName];
        const sarvamUploadUrl =
            typeof sarvamUploadUrlObj === "string"
                ? sarvamUploadUrlObj
                : sarvamUploadUrlObj?.file_url;

        if (!sarvamUploadUrl) {
            throw new Error("Sarvam did not return an upload URL for the audio file");
        }

        // 4. Upload audio to Sarvam Azure
        const contentType = options.contentType || "audio/webm";
        const sanitizedMime = contentType.split(";")[0].trim();

        const sarvamUploadResponse = await fetch(sarvamUploadUrl, {
            method: "PUT",
            headers: {
                "x-ms-blob-type": "BlockBlob",
                "Content-Type": sanitizedMime,
                ...(contentLength ? { "Content-Length": contentLength } : {}),
            },
            body: audioResponse.body,
        });

        if (!sarvamUploadResponse.ok) {
            const errText = await sarvamUploadResponse.text();
            throw new Error(`Failed to upload audio to Sarvam storage: ${errText}`);
        }
        log.info({ sarvamJobId }, "Audio uploaded to Sarvam Azure");

        // 5. Start the job
        const startResponse = await fetch(
            `https://api.sarvam.ai/speech-to-text/job/v1/${sarvamJobId}/start`,
            {
                method: "POST",
                headers: sarvamHeaders,
                body: JSON.stringify({}),
            }
        );

        if (!startResponse.ok) {
            const errText = await startResponse.text();
            throw new Error(`Failed to start Sarvam job: ${errText}`);
        }
        log.info({ sarvamJobId }, "Sarvam job started");

        return {
            jobId: sarvamJobId,
            completed: false,
        };
    }

    async checkStatus(jobId: string): Promise<TranscriptionStatusResult> {
        const statusResponse = await fetch(
            `https://api.sarvam.ai/speech-to-text/job/v1/${jobId}/status`,
            {
                method: "GET",
                headers: sarvamHeaders,
            }
        );

        if (!statusResponse.ok) {
            const errText = await statusResponse.text();
            log.error({ errText, jobId }, "Sarvam status check failed");
            throw new Error(`Failed to fetch Sarvam job status: ${errText}`);
        }

        const statusData = (await statusResponse.json()) as any;
        const jobState = statusData.job_state; // Accepted | Pending | Running | Completed | Failed

        if (jobState === "Completed") {
            const result = await this.fetchResult(jobId, statusData);
            return { status: "completed", result };
        } else if (jobState === "Failed") {
            return { status: "failed" };
        } else {
            return { status: "processing" };
        }
    }

    /**
     * Fetches the transcription result from Sarvam download URLs.
     */
    private async fetchResult(jobId: string, statusData: any): Promise<TranscriptionResult> {
        const jobDetails = statusData.job_details || [];
        let transcriptText = "";
        let transcriptDiarized = null;
        let languageDetected = null;

        const successDetail = jobDetails.find(
            (d: any) => d.state === "Success" && d.outputs && d.outputs.length > 0
        );

        if (successDetail) {
            const outputFile = successDetail.outputs[0];
            const outputFileName = outputFile.file_name;

            // Request download URL
            const downloadUrlsResponse = await fetch(
                "https://api.sarvam.ai/speech-to-text/job/v1/download-files",
                {
                    method: "POST",
                    headers: sarvamHeaders,
                    body: JSON.stringify({
                        job_id: jobId,
                        files: [outputFileName],
                    }),
                }
            );

            if (!downloadUrlsResponse.ok) {
                const errText = await downloadUrlsResponse.text();
                throw new Error(`Failed to get Sarvam download URL: ${errText}`);
            }

            const downloadData = (await downloadUrlsResponse.json()) as any;
            const downloadUrlObj = downloadData.download_urls?.[outputFileName];
            const downloadUrl =
                typeof downloadUrlObj === "string" ? downloadUrlObj : downloadUrlObj?.file_url;

            if (!downloadUrl) {
                throw new Error("Sarvam did not return a download URL for the result file");
            }

            // Download and parse result
            const resultFileResponse = await fetch(downloadUrl);
            if (!resultFileResponse.ok) {
                throw new Error(
                    `Failed to download transcription results: status ${resultFileResponse.status}`
                );
            }

            const resultJson = (await resultFileResponse.json()) as any;
            transcriptText = resultJson.transcript || resultJson.text || "";
            transcriptDiarized = resultJson.diarized_transcript || null;
            languageDetected = resultJson.language_code || resultJson.language || null;
        }

        return {
            transcriptText,
            transcriptDiarized,
            languageDetected,
            audioDurationSeconds: null,
        };
    }
}
