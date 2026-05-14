import { HeroPromptInput } from "./HeroPromptInput";
import type { PromptInputMessage } from "@/components/ai-elements/prompt-input";

interface HeroSectionProps {
  isChatStarted?: boolean;
  onSubmit?: (message: PromptInputMessage) => void;
}

export function HeroSection({ isChatStarted = false, onSubmit }: HeroSectionProps) {
  return <HeroPromptInput isChatStarted={isChatStarted} onSubmit={onSubmit} />;
}
