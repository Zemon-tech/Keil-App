import {
  Ghost,
  Asterisk,
  Plus,
  AudioLines
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  PromptInputTextarea,
  PromptInputTools,
  PromptInputSelect,
  PromptInputSelectTrigger,
  PromptInputSelectValue,
  PromptInputSelectContent,
  PromptInputSelectItem,
  PromptInputButton,
  type PromptInputMessage,
} from "@/components/ai-elements/prompt-input";

export function HeroSection() {
  const { user } = useAuth();

  const handlePromptSubmit = (message: PromptInputMessage) => {
    // Handle submission - in a real app this might navigate to a chat page
    console.log("Hero Submit:", message);
  };

  const userName =
    user?.user_metadata?.full_name ||
    user?.email?.split("@")[0] ||
    "phantom";

  return (
    <section className="w-full max-w-4xl flex flex-col items-center gap-10 relative px-4 pt-16">
      {/* Ghost icon - Top right corner of screen */}
      <div className="fixed top-6 right-6 opacity-40 hover:opacity-100 transition-opacity">
        <Ghost className="h-6 w-6" />
      </div>

      {/* Greeting */}
      <div className="flex items-center gap-5 text-center">
        <Asterisk className="h-10 w-10 text-[#d97757] animate-spin-slow" />
        <h1 className="text-5xl md:text-6xl font-medium tracking-tight font-serif text-[#dcdcdc]">
          Hey there, {userName}
        </h1>
      </div>

      {/* Chat input using PromptInput */}
      <div className="w-full max-w-3xl">
        <PromptInput
          onSubmit={handlePromptSubmit}
          className="w-full rounded-2xl border border-border/60 bg-card/90 shadow-lg overflow-hidden"
        >
          <PromptInputBody>
            <PromptInputTextarea
              placeholder="How can I help you today?"
              className="min-h-[88px] bg-transparent border-none px-6 pt-5 pb-4 text-[15px] sm:text-base text-foreground placeholder:text-muted-foreground/60 focus-visible:ring-0 resize-none font-normal"
            />
          </PromptInputBody>
          <PromptInputFooter className="px-6 pb-4 pt-0 border-none flex justify-between items-center text-xs text-muted-foreground">
            <PromptInputTools>
              <PromptInputButton
                variant="ghost"
                size="icon-sm"
                className="h-8 w-8 text-muted-foreground/60 hover:text-foreground hover:bg-muted/40 rounded-full transition-colors"
              >
                <Plus className="h-5 w-5" />
              </PromptInputButton>
            </PromptInputTools>

            <div className="flex items-center gap-4">
              <PromptInputSelect defaultValue="sonnet-4.6">
                <PromptInputSelectTrigger className="bg-muted/40 border border-border/60 h-8 px-3 rounded-full text-[12px] font-medium text-muted-foreground/80 hover:text-foreground hover:bg-muted/60 gap-1.5 shadow-none focus-visible:ring-0">
                  <PromptInputSelectValue placeholder="Sonnet 4.6 Extended" />
                </PromptInputSelectTrigger>
                <PromptInputSelectContent>
                  <PromptInputSelectItem value="sonnet-4.6">Sonnet 4.6 Extended</PromptInputSelectItem>
                  <PromptInputSelectItem value="opus-3">Claude 3 Opus</PromptInputSelectItem>
                </PromptInputSelectContent>
              </PromptInputSelect>

              <div className="h-4 w-[1px] bg-white/10 mx-1" />

              <PromptInputButton
                variant="ghost"
                size="icon-sm"
                className="h-9 w-9 text-muted-foreground/40 hover:text-foreground hover:bg-white/5 rounded-xl transition-all"
              >
                <AudioLines className="h-4 w-4" />
              </PromptInputButton>
            </div>
          </PromptInputFooter>
        </PromptInput>
      </div>
    </section>
  );
}
