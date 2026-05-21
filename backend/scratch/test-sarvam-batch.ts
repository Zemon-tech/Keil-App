import { config } from "dotenv";
config();
async function test() {
    const res = await fetch("https://api.sarvam.ai/speech-to-text/job/v1", {
        method: "POST",
        headers: {
            "api-subscription-key": process.env.SARVAM_API_KEY || "",
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            job_parameters: {
                model: "saaras:v3",
                mode: "transcribe",
                language_code: "unknown",
                with_diarization: true,
                num_speakers: 2
            }
        })
    });
    console.log(res.status, await res.text());
}
test();
