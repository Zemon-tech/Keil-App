import { HeroPromptInput } from "./HeroPromptInput";
import type { PromptInputMessage } from "@/components/ai-elements/prompt-input";

interface HeroSectionProps {
  isChatStarted?: boolean;
  onSubmit?: (message: PromptInputMessage) => void;
  status?: "submitted" | "streaming" | "ready" | "error";
  onStop?: () => void;
}

export function HeroSection({
  isChatStarted = false,
  onSubmit,
  status,
  onStop,
}: HeroSectionProps) {
  return (
    <HeroPromptInput
      isChatStarted={isChatStarted}
      onSubmit={onSubmit}
      status={status}
      onStop={onStop}
    />
  );
}
