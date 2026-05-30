/**
 * Quick test script to debug ElevenLabs STT API calls.
 * Run with: npx tsx scratch/test-elevenlabs-stt.ts
 */
import dotenv from "dotenv";
dotenv.config();

import fetch from "node-fetch";
import FormData from "form-data";
import { S3Client } from "@aws-sdk/client-s3";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY!;
const AWS_S3_REGION = process.env.AWS_S3_REGION || "ap-south-1";
const AWS_S3_ACCESS_KEY_ID = process.env.AWS_S3_ACCESS_KEY_ID!;
const AWS_S3_SECRET_ACCESS_KEY = process.env.AWS_S3_SECRET_ACCESS_KEY!;
const AWS_S3_BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME!;

// Use the S3 key from the failed recording
const S3_KEY = "meetings/6231a5bb-2888-4f57-a77c-cfd918cbf519/general/1780151096501-recording-1780151096038.webm";

async function main() {
    console.log("=== ElevenLabs STT Debug Test ===\n");
    console.log("API Key present:", !!ELEVENLABS_API_KEY, `(${ELEVENLABS_API_KEY.substring(0, 8)}...)`);
    console.log("S3 Bucket:", AWS_S3_BUCKET_NAME);
    console.log("S3 Key:", S3_KEY);

    // Step 1: Generate presigned GET URL
    const s3Client = new S3Client({
        region: AWS_S3_REGION,
        credentials: {
            accessKeyId: AWS_S3_ACCESS_KEY_ID,
            secretAccessKey: AWS_S3_SECRET_ACCESS_KEY,
        },
    });

    const getCommand = new GetObjectCommand({
        Bucket: AWS_S3_BUCKET_NAME,
        Key: S3_KEY,
    });

    const presignedUrl = await getSignedUrl(s3Client, getCommand, { expiresIn: 3600 });
    console.log("\nPresigned URL generated:", presignedUrl.substring(0, 100) + "...");

    // Step 2: Verify the file exists by doing a HEAD-like fetch
    console.log("\n--- Verifying S3 file accessibility ---");
    const headResp = await fetch(presignedUrl, { method: "GET", headers: { Range: "bytes=0-0" } });
    console.log("S3 file check status:", headResp.status);
    console.log("Content-Type:", headResp.headers.get("content-type"));
    console.log("Content-Length:", headResp.headers.get("content-range") || headResp.headers.get("content-length"));

    if (headResp.status !== 206 && headResp.status !== 200) {
        console.error("ERROR: Cannot access file from S3. The file may not exist.");
        return;
    }

    // Step 3: Call ElevenLabs STT with source_url
    console.log("\n--- Calling ElevenLabs STT API (source_url approach) ---");
    const formData = new FormData();
    formData.append("model_id", "scribe_v2");
    formData.append("source_url", presignedUrl);
    formData.append("diarize", "true");
    formData.append("timestamps_granularity", "word");
    formData.append("tag_audio_events", "true");

    console.log("Sending request to https://api.elevenlabs.io/v1/speech-to-text ...");
    const startTime = Date.now();

    const response = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
        method: "POST",
        headers: {
            "xi-api-key": ELEVENLABS_API_KEY,
            ...formData.getHeaders(),
        },
        body: formData,
    });

    const elapsed = Date.now() - startTime;
    console.log(`Response received in ${elapsed}ms`);
    console.log("Status:", response.status, response.statusText);
    console.log("Headers:", Object.fromEntries(response.headers.entries()));

    const responseText = await response.text();
    
    if (!response.ok) {
        console.error("\n❌ ElevenLabs API ERROR:");
        console.error(responseText);
    } else {
        const result = JSON.parse(responseText);
        console.log("\n✅ ElevenLabs API SUCCESS:");
        console.log("Language:", result.language_code);
        console.log("Text length:", result.text?.length || 0);
        console.log("Words count:", result.words?.length || 0);
        console.log("First 200 chars:", result.text?.substring(0, 200));
    }
}

main().catch(err => {
    console.error("Script error:", err);
    process.exit(1);
});
