import fetch from "node-fetch";

async function run() {
    const sarvamHeaders = {
        "api-subscription-key": "sk_0geo5scj_QloqfT0TDpRZ5dgK9D4AEzvR", // from .env
        "Content-Type": "application/json"
    };

    const createJobResponse = await fetch("https://api.sarvam.ai/speech-to-text/job/v1", {
        method: "POST",
        headers: sarvamHeaders,
        body: JSON.stringify({
            job_parameters: {
                model: "saaras:v3",
                mode: "transcribe",
                language_code: "en-IN",
                with_diarization: true,
                num_speakers: 2
            }
        })
    });

    const createJson: any = await createJobResponse.json();
    console.log("Create response:", createJson);

    const sarvamJobId = createJson.job_id;
    
    const uploadUrlsResponse = await fetch("https://api.sarvam.ai/speech-to-text/job/v1/upload-files", {
        method: "POST",
        headers: sarvamHeaders,
        body: JSON.stringify({
            job_id: sarvamJobId,
            files: ["audio.webm"],
            url: "https://example.com/audio.webm",
            file_url: "https://example.com/audio.webm",
            source_url: "https://example.com/audio.webm"
        })
    });
    
    console.log("Upload URL response:", await uploadUrlsResponse.json());
}

run().catch(console.error);
