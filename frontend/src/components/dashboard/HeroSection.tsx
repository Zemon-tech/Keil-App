import { HeroPromptInput } from "./HeroPromptInput";

export function HeroSection() {
  const handlePromptSubmit = (message: { text: string; files: unknown[] }) => {
    console.log("Hero Submit:", message);
  };

  return <HeroPromptInput onSubmit={handlePromptSubmit} />;
}
