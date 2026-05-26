import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { useSidebar } from "@/components/ui/sidebar";
import { HeroSection } from "./dashboard/HeroSection";
import { DashboardPanel } from "./dashboard/DashboardPanel";
import { useOrgDashboard } from "@/hooks/api/useDashboard";
import { useAppContext } from "@/contexts/AppContext";
import { AlertCircle } from "lucide-react";
import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import { Shimmer } from "@/components/ai-elements/shimmer";
import type { PromptInputMessage } from "@/components/ai-elements/prompt-input";
import { MessageCircle } from "lucide-react";
import { useChat } from "@ai-sdk/react";
import { supabase } from "@/lib/supabase";
import { DefaultChatTransport } from "ai";

export function Dashboard() {
  const { state } = useSidebar();
  const [mounted, setMounted] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // ── Dashboard Data ─────────────────────────────────────────
  const { activeOrgId, activeSpaceId } = useAppContext();

  // ── Org/space-scoped dashboard ──────────
  const { data, isLoading: isDashboardLoading, isError } = useOrgDashboard(
    activeOrgId,
    activeSpaceId,
  );

  const [modelSelection, setModelSelection] = useState<string>(() => {
    return localStorage.getItem("ai_model_selection") || "openrouter";
  });

  const { messages, sendMessage, setMessages, status } = useChat({
    transport: new DefaultChatTransport({
      api: `${import.meta.env.VITE_API_URL || "http://localhost:5001/api"}/v1/ai/chat`,
      fetch: async (input, init) => {
        const { data: { session } } = await supabase.auth.getSession();
        const headers = new Headers(init?.headers);
        if (session?.access_token) {
          headers.set("Authorization", `Bearer ${session.access_token}`);
        }

        // Intercept and inject custom model selection options into the request body
        let newInit = { ...init };
        if (init?.body && typeof init.body === "string") {
          try {
            const parsedBody = JSON.parse(init.body);
            parsedBody.modelSelection = localStorage.getItem("ai_model_selection") || "openrouter";
            parsedBody.localAiBaseUrl = localStorage.getItem("local_ai_base_url") || "http://localhost:8080/v1";
            parsedBody.localAiModel = localStorage.getItem("local_ai_model") || "gemma-4";
            newInit.body = JSON.stringify(parsedBody);
          } catch (e) {
            console.error("Failed to parse request body in fetch:", e);
          }
        }

        return fetch(input, {
          ...newInit,
          headers,
        });
      },
      body: {
        orgId: activeOrgId ?? undefined,
        spaceId: activeSpaceId ?? undefined,
      },
    }),
    onError: (error: Error) => {
      console.error("AI request failed:", error);
      setMessages((current: any[]) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "assistant" as const,
          parts: [
            {
              type: "text" as const,
              text: "I'm sorry, I encountered an issue connecting to the AI assistant. Please check your backend server status and ensure your OPENROUTER_API_KEY is configured.",
            },
          ],
        },
      ]);
    }
  });

  const isLoading = status === "submitted" || status === "streaming";

  useEffect(() => {
    setMounted(true);
  }, []);

  const isAssistantThinking = isLoading && messages[messages.length - 1]?.role === "user";

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  }, [messages, isAssistantThinking]);

  const isCollapsed = state === "collapsed";
  const hasChatStarted = messages.length > 0 || isAssistantThinking;
  const assistantLoadingText = [
    "Fetching the output",
    "Be ready",
    "Forging a response",
  ][messages.length % 3];
  const containerClassName = cn(
    "mx-auto transition-all duration-500 ease-in-out px-4 sm:px-6 lg:px-10",
    isCollapsed ? "max-w-[1400px]" : "max-w-6xl",
  );

  const handlePromptSubmit = async (message: PromptInputMessage) => {
    const text = message.text.trim();
    const fileCount = message.files.length;
    const content =
      text || `${fileCount} attachment${fileCount === 1 ? "" : "s"} added`;

    await sendMessage({
      text: content,
    });
  };

  if (!mounted) return null;

  return (
    <div className="h-[100dvh] bg-background text-foreground overflow-hidden overscroll-none">
      <main
        className="w-full h-full flex flex-col items-center relative overflow-hidden overscroll-none"
      >
        {!hasChatStarted ? (
          <div className={cn(containerClassName, "size-full flex flex-col items-center justify-center py-4 md:py-6 min-h-0 overflow-y-auto md:overflow-y-hidden no-scrollbar")}>
            <div className="w-full flex flex-col items-center gap-1 sm:gap-2">
              {/* Hero: greeting + input area */}
              <HeroSection
                onSubmit={handlePromptSubmit}
                modelSelection={modelSelection}
                onModelSelectionChange={setModelSelection}
              />

              {isError && (
                <div className="w-full max-w-4xl mt-2 flex items-center justify-center p-4 bg-destructive/10 text-destructive rounded-lg gap-2 text-sm border border-destructive/20">
                  <AlertCircle className="size-4" />
                  <span>Failed to load dashboard data. Please try again.</span>
                </div>
              )}

              {/* Dashboard Panel with 3D Wheels */}
              <DashboardPanel data={data} isLoading={isDashboardLoading} />
            </div>
          </div>
        ) : (
          <div className="flex size-full flex-col items-center">
            <section className="w-full flex-1 overflow-y-auto pb-48 pt-10 lg:pt-14">
              <div className="w-full max-w-4xl mx-auto flex flex-col gap-6 px-4 sm:px-6">
                {messages.map((message: any) => (
                  <Message from={message.role} key={message.id} className="max-w-full w-full">
                    <MessageContent
                      className={cn(
                        message.role === "assistant" &&
                          "w-full max-w-[46rem] text-[0.95rem] leading-7",
                      )}
                    >
                      <MessageResponse>
                        {message.parts
                          ?.filter((p: any) => p.type === "text")
                          ?.map((p: any) => p.text)
                          ?.join("\n") || message.content || ""}
                      </MessageResponse>
                    </MessageContent>
                  </Message>
                ))}

                {isAssistantThinking && (
                  <Message from="assistant" className="max-w-full w-full">
                    <MessageContent className="px-0 py-0">
                      <div className="flex items-center gap-2 py-2 text-sm">
                        <span className="flex size-7 items-center justify-center rounded-full border border-border/70 bg-card/80 text-muted-foreground">
                          <MessageCircle className="size-3.5" />
                        </span>
                        <Shimmer className="font-medium" duration={1.6}>
                          {assistantLoadingText}
                        </Shimmer>
                      </div>
                    </MessageContent>
                  </Message>
                )}

                <div ref={messagesEndRef} />
              </div>
            </section>

            <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center bg-gradient-to-t from-background via-background/95 to-transparent px-4 pb-3 pt-16 sm:px-6">
              <div className="pointer-events-auto w-full max-w-4xl">
                <HeroSection
                  isChatStarted
                  onSubmit={handlePromptSubmit}
                  modelSelection={modelSelection}
                  onModelSelectionChange={setModelSelection}
                />
                <p className="px-4 pb-1 text-center text-[11px] text-muted-foreground/70">
                  Keil AI can make mistakes. Check important details.
                </p>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
