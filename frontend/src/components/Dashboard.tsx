import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { useSidebar } from "@/components/ui/sidebar";
import { HeroSection } from "./dashboard/HeroSection";
import { CurrentFocusCard } from "./dashboard/CurrentFocusCard";
import { NextEventCard } from "./dashboard/NextEventCard";
import { ImmediateBlockersCard } from "./dashboard/ImmediateBlockersCard";
import { NeedsReplyCard } from "./dashboard/NeedsReplyCard";
import { UpNextCard } from "./dashboard/UpNextCard";
import { useDashboard, useOrgDashboard } from "@/hooks/api/useDashboard";
import api from "@/lib/api";
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

type DashboardChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

export function Dashboard() {
  const { state } = useSidebar();
  const [mounted, setMounted] = useState(false);
  const [messages, setMessages] = useState<DashboardChatMessage[]>([]);
  const [isAssistantThinking, setIsAssistantThinking] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // ── Mode awareness ─────────────────────────────────────────
  const { mode, activeOrgId, activeSpaceId } = useAppContext();
  const isOrgMode = mode === "organisation" && !!activeOrgId && !!activeSpaceId;

  // ── Legacy workspace dashboard (personal mode or fallback) ──
  const { data: legacyData, isLoading: legacyLoading, isError: legacyError } = useDashboard();

  // ── Org/space-scoped dashboard (organisation mode) ──────────
  const { data: orgData, isLoading: orgLoading, isError: orgError } = useOrgDashboard(
    isOrgMode ? activeOrgId : null,
    isOrgMode ? activeSpaceId : null
  );

  // Use the correct source based on mode
  const data = isOrgMode ? orgData : legacyData;
  const isLoading = isOrgMode ? orgLoading : legacyLoading;
  const isError = isOrgMode ? orgError : legacyError;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, isAssistantThinking]);

  const isCollapsed = state === "collapsed";
  const hasChatStarted = messages.length > 0 || isAssistantThinking;
  const assistantLoadingText =
    ["Fetching the output", "Be ready", "Forging a response"][messages.length % 3];
  const containerClassName = cn(
    "mx-auto transition-all duration-500 ease-in-out px-4 sm:px-6 lg:px-10",
    isCollapsed ? "max-w-[1400px]" : "max-w-6xl"
  );

  const handlePromptSubmit = async (message: PromptInputMessage) => {
    const text = message.text.trim();
    const fileCount = message.files.length;
    const content =
      text ||
      `${fileCount} attachment${fileCount === 1 ? "" : "s"} added`;

    const userMessage: DashboardChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content,
    };

    const conversation = [
      ...messages,
      userMessage,
    ];

    setMessages(conversation);
    setIsAssistantThinking(true);

    try {
      const response = await api.post<{ data: { content: string } }>("v1/ai/chat", {
        messages: conversation.map((msg) => ({
          role: msg.role,
          content: msg.content,
        })),
      });

      const replyContent = response.data.data.content;

      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: replyContent,
        },
      ]);
    } catch (error) {
      console.error("AI request failed:", error);
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: "I'm sorry, I encountered an issue connecting to the AI assistant. Please check your backend server status and ensure your OPENROUTER_API_KEY is configured.",
        },
      ]);
    } finally {
      setIsAssistantThinking(false);
    }
  };

  if (!mounted) return null;

  return (
    <div
      className="h-[100dvh] bg-background text-foreground overflow-hidden overscroll-none"
    >
      <main
        className={cn(
          containerClassName,
          "h-full flex flex-col items-center relative overflow-hidden overscroll-none"
        )}
      >
        {!hasChatStarted ? (
          <div className="w-full flex flex-col items-center pt-25 lg:pt-30">
            {/* Hero: greeting + input area */}
            <HeroSection onSubmit={handlePromptSubmit} />

            {isError && (
              <div className="w-full max-w-4xl mt-4 flex items-center justify-center p-4 bg-destructive/10 text-destructive rounded-lg gap-2 text-sm border border-destructive/20">
                <AlertCircle className="w-4 h-4" />
                <span>Failed to load dashboard data. Please try again.</span>
              </div>
            )}

            {/* Widgets grid */}
            <section className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full max-w-4xl mt-10 opacity-90 hover:opacity-100 transition-opacity">
              <CurrentFocusCard task={data?.immediate?.[0] ?? null} isLoading={isLoading} />
              <NextEventCard />
              <ImmediateBlockersCard tasks={data?.immediate ?? []} isLoading={isLoading} />
              <NeedsReplyCard />
              <UpNextCard tasks={data?.today ?? []} isLoading={isLoading} />
            </section>
          </div>
        ) : (
          <div className="flex h-full w-full flex-col items-center">
            <section className="w-full max-w-4xl flex-1 overflow-y-auto px-2 pb-40 pt-10 sm:px-4 lg:pt-14">
              <div className="flex flex-col gap-6">
                {messages.map((message) => (
                  <Message from={message.role} key={message.id}>
                    <MessageContent
                      className={cn(
                        message.role === "assistant" &&
                          "w-full max-w-[46rem] text-[0.95rem] leading-7"
                      )}
                    >
                      <MessageResponse>{message.content}</MessageResponse>
                    </MessageContent>
                  </Message>
                ))}

                {isAssistantThinking && (
                  <Message from="assistant">
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
                <HeroSection isChatStarted onSubmit={handlePromptSubmit} />
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
