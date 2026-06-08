import { HeroPromptInput } from "./HeroPromptInput";
import type { PromptInputMessage } from "@/components/ai-elements/prompt-input";

interface HeroSectionProps {
  isChatStarted?: boolean;
  onSubmit?: (message: PromptInputMessage) => void;
  modelSelection?: string;
  onModelSelectionChange?: (value: string) => void;
  status?: "submitted" | "streaming" | "ready" | "error";
  onStop?: () => void;
}

export function HeroSection({
  isChatStarted = false,
  onSubmit,
  modelSelection,
  onModelSelectionChange,
  status,
  onStop,
}: HeroSectionProps) {
  return (
    <HeroPromptInput
      isChatStarted={isChatStarted}
      onSubmit={onSubmit}
      modelSelection={modelSelection}
      onModelSelectionChange={onModelSelectionChange}
      status={status}
      onStop={onStop}
    />
  );
}
