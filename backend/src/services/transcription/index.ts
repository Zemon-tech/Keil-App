import { TranscriptionProvider, SttProvider } from "./types";
import { SarvamProvider } from "./sarvam.provider";
import { ElevenLabsProvider } from "./elevenlabs.provider";

export * from "./types";

// Singleton instances
let sarvamInstance: SarvamProvider | null = null;
let elevenlabsInstance: ElevenLabsProvider | null = null;

/**
 * Returns the appropriate transcription provider based on the provider name.
 */
export function getTranscriptionProvider(provider: SttProvider): TranscriptionProvider {
    switch (provider) {
        case "elevenlabs":
            if (!elevenlabsInstance) {
                elevenlabsInstance = new ElevenLabsProvider();
            }
            return elevenlabsInstance;
        case "sarvam":
        default:
            if (!sarvamInstance) {
                sarvamInstance = new SarvamProvider();
            }
            return sarvamInstance;
    }
}

/**
 * Validates that the given string is a valid STT provider.
 */
export function isValidSttProvider(value: string): value is SttProvider {
    return value === "sarvam" || value === "elevenlabs";
}
