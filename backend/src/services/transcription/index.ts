import { TranscriptionProvider, SttProvider } from "./types";
import { SarvamProvider } from "./sarvam.provider";
import { ElevenLabsProvider } from "./elevenlabs.provider";

export * from "./types";

// Singletons
let sarvamInstance: SarvamProvider | null = null;
let elevenlabsInstance: ElevenLabsProvider | null = null;

/**
 * Returns the transcription provider for the given name.
 * Defaults to Sarvam (the primary provider).
 */
export function getTranscriptionProvider(provider?: SttProvider): TranscriptionProvider {
    const chosen = provider ?? "sarvam";

    if (chosen === "sarvam") {
        if (!sarvamInstance) {
            sarvamInstance = new SarvamProvider();
        }
        return sarvamInstance;
    }

    // Fallback: ElevenLabs
    if (!elevenlabsInstance) {
        elevenlabsInstance = new ElevenLabsProvider();
    }
    return elevenlabsInstance;
}

/**
 * Validates that the given string is a valid STT provider.
 */
export function isValidSttProvider(value: string): value is SttProvider {
    return value === "sarvam" || value === "elevenlabs";
}
