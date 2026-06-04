import { useEffect, useRef, useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { useSidebar } from "@/components/ui/sidebar";
import { HeroSection } from "./dashboard/HeroSection";
import { DashboardPanel } from "./dashboard/DashboardPanel";
import { useOrgDashboard } from "@/hooks/api/useDashboard";
import { useAppContext } from "@/contexts/AppContext";
import {
  AlertCircle,
  SquarePen,
  History,
  Trash2,
  Pen,
  X,
  Search,
  Check,
  Loader2,
  Calendar,
} from "lucide-react";
import api from "@/lib/api";
import {
  Message,
  MessageContent,
  MessageResponse,
  MessageActions,
  LikeAction,
  DislikeAction,
  CopyAction,
} from "@/components/ai-elements/message";
import { Shimmer } from "@/components/ai-elements/shimmer";
import type { PromptInputMessage } from "@/components/ai-elements/prompt-input";
import { MessageCircle } from "lucide-react";
import { useChat } from "@ai-sdk/react";
import { supabase } from "@/lib/supabase";
import { DefaultChatTransport } from "ai";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function Dashboard() {
  const { state } = useSidebar();
  const [mounted, setMounted] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // ── Dashboard Data ─────────────────────────────────────────
  const { activeOrgId, activeSpaceId } = useAppContext();

  // ── Org/space-scoped dashboard ──────────
  const {
    data,
    isLoading: isDashboardLoading,
    isError,
  } = useOrgDashboard(activeOrgId, activeSpaceId);

  const [modelSelection, setModelSelection] = useState<string>(() => {
    return localStorage.getItem("ai_model_selection") || "gemini";
  });

  const { messages, sendMessage, setMessages, status } = useChat({
    transport: new DefaultChatTransport({
      api: `${(import.meta.env.VITE_API_URL || "http://localhost:5000/api").replace(/\/api\/?$/, "")}/chat`,
      headers: async (): Promise<Record<string, string>> => {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (session?.access_token)
          return { Authorization: `Bearer ${session.access_token}` };
        return {};
      },
      prepareSendMessagesRequest: ({ messages: msgs }) => {
        const key = `chat_thread_id_${activeOrgId || "personal"}_${activeSpaceId || "default"}`;
        let tid = localStorage.getItem(key);
        if (!tid) {
          tid = crypto.randomUUID();
          localStorage.setItem(key, tid);
        }

        return {
          body: {
            messages: [msgs[msgs.length - 1]],
            modelSelection:
              localStorage.getItem("ai_model_selection") || "gemini",
            ...(localStorage.getItem("ai_model_selection") === "local" && {
              localAiBaseUrl:
                localStorage.getItem("local_ai_base_url") ||
                "http://localhost:8080/v1",
              localAiModel: localStorage.getItem("local_ai_model") || "gemma-4",
            }),
            ...(activeOrgId && { orgId: activeOrgId }),
            ...(activeSpaceId && { spaceId: activeSpaceId }),
            memory: {
              thread: {
                id: tid,
              },
            },
          },
        };
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
              text: "I'm sorry, I encountered an issue connecting to the AI assistant. Please check your backend server status and ensure your API keys are configured.",
            },
          ],
        },
      ]);
    },
  });

  const isLoading = status === "submitted" || status === "streaming";

  const [liked, setLiked] = useState<Record<string, boolean>>({});
  const [disliked, setDisliked] = useState<Record<string, boolean>>({});

  // ── History Sidebar State ──────────────────────────────────
  const [isHistoryOpen, setIsHistoryOpen] = useState<boolean>(() => {
    return localStorage.getItem("history_sidebar_open") === "true";
  });
  const [threads, setThreads] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Renaming state
  const [editingThreadId, setEditingThreadId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");

  const handleToggleLike = useCallback((key: string) => {
    setLiked((prev) => {
      const isCurrentlyLiked = prev[key] ?? false;
      if (!isCurrentlyLiked) {
        setDisliked((dPrev) => ({ ...dPrev, [key]: false }));
      }
      return { ...prev, [key]: !isCurrentlyLiked };
    });
  }, []);

  const handleToggleDislike = useCallback((key: string) => {
    setDisliked((prev) => {
      const isCurrentlyDisliked = prev[key] ?? false;
      if (!isCurrentlyDisliked) {
        setLiked((lPrev) => ({ ...lPrev, [key]: false }));
      }
      return { ...prev, [key]: !isCurrentlyDisliked };
    });
  }, []);

  const isAssistantThinking =
    isLoading && messages[messages.length - 1]?.role === "user";

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

  const handleNewChat = useCallback(() => {
    const key = `chat_thread_id_${activeOrgId || "personal"}_${activeSpaceId || "default"}`;
    const newThreadId = crypto.randomUUID();
    localStorage.setItem(key, newThreadId);
    setMessages([]);
  }, [activeOrgId, activeSpaceId, setMessages]);

  const mapMastraMessageToFrontend = useCallback((msg: any) => {
    let text = "";
    if (msg.content && typeof msg.content === "object") {
      if (msg.content.content && typeof msg.content.content === "string") {
        text = msg.content.content;
      } else if (Array.isArray(msg.content.parts)) {
        text = msg.content.parts
          .filter((p: any) => p.type === "text" && p.text)
          .map((p: any) => p.text)
          .join("\n");
      }
    } else if (typeof msg.content === "string") {
      text = msg.content;
    }

    return {
      id: msg.id || crypto.randomUUID(),
      role: msg.role === "signal" ? "system" : msg.role,
      content: text,
      createdAt: msg.createdAt ? new Date(msg.createdAt) : undefined,
    };
  }, []);

  const handleSelectThread = useCallback(async (id: string) => {
    const key = `chat_thread_id_${activeOrgId || "personal"}_${activeSpaceId || "default"}`;
    localStorage.setItem(key, id);
    setIsLoadingHistory(true);
    try {
      const res = await api.get(`v1/ai/threads/${id}/messages`);
      const rawMessages = res.data.data.messages || [];
      const mapped = rawMessages
        .filter((m: any) => m.role === "user" || m.role === "assistant")
        .map(mapMastraMessageToFrontend);
      setMessages(mapped);
    } catch (error) {
      console.error("Failed to load selected thread:", error);
    } finally {
      setIsLoadingHistory(false);
    }
  }, [activeOrgId, activeSpaceId, setMessages, mapMastraMessageToFrontend]);

  const handleDeleteThread = useCallback(async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this conversation?")) return;
    try {
      await api.delete(`v1/ai/threads/${id}`);
      setThreads((prev) => prev.filter((t) => t.id !== id));
      const key = `chat_thread_id_${activeOrgId || "personal"}_${activeSpaceId || "default"}`;
      const activeId = localStorage.getItem(key);
      if (activeId === id) {
        handleNewChat();
      }
    } catch (error) {
      console.error("Failed to delete thread:", error);
    }
  }, [activeOrgId, activeSpaceId, handleNewChat]);

  const handleStartRename = useCallback((id: string, currentTitle: string | null, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingThreadId(id);
    setEditingTitle(currentTitle || "Untitled conversation");
  }, []);

  const handleSaveRename = useCallback(async (id: string) => {
    if (!editingTitle.trim()) return;
    try {
      await api.put(`v1/ai/threads/${id}`, { title: editingTitle.trim() });
      setThreads((prev) =>
        prev.map((t) => (t.id === id ? { ...t, title: editingTitle.trim() } : t))
      );
      setEditingThreadId(null);
    } catch (error) {
      console.error("Failed to rename thread:", error);
    }
  }, [editingTitle]);

  const fetchThreads = useCallback(async () => {
    try {
      const res = await api.get<{ data: { threads: any[] } }>("v1/ai/threads");
      setThreads(res.data.data.threads || []);
    } catch (error) {
      console.error("Failed to fetch threads:", error);
    }
  }, []);

  const toggleHistory = useCallback(() => {
    setIsHistoryOpen((prev) => {
      const next = !prev;
      localStorage.setItem("history_sidebar_open", String(next));
      return next;
    });
  }, []);

  useEffect(() => {
    if (isHistoryOpen) {
      fetchThreads();
    }
  }, [isHistoryOpen, fetchThreads]);

  useEffect(() => {
    const loadLastChat = async () => {
      const key = `chat_thread_id_${activeOrgId || "personal"}_${activeSpaceId || "default"}`;
      const savedThreadId = localStorage.getItem(key);
      if (savedThreadId) {
        setIsLoadingHistory(true);
        try {
          const res = await api.get(`v1/ai/threads/${savedThreadId}/messages`);
          const rawMessages = res.data.data.messages || [];
          const mapped = rawMessages
            .filter((m: any) => m.role === "user" || m.role === "assistant")
            .map(mapMastraMessageToFrontend);
          setMessages(mapped);
        } catch (error) {
          console.error("Failed to load last chat history:", error);
          localStorage.removeItem(key);
        } finally {
          setIsLoadingHistory(false);
        }
      } else {
        setMessages([]);
      }
    };

    loadLastChat();
  }, [activeOrgId, activeSpaceId, setMessages, mapMastraMessageToFrontend]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({
        behavior: "smooth",
        block: "end",
      });
    }
  }, [messages, isAssistantThinking]);

  if (!mounted) return null;

  const filteredThreads = threads.filter((t) => {
    const title = t.title || "Untitled conversation";
    return title.toLowerCase().includes(searchQuery.toLowerCase());
  });

  return (
    <div className="h-[100dvh] bg-background text-foreground overflow-hidden overscroll-none flex">
      {/* Main Viewport Container */}
      <main className="flex-1 min-w-0 h-full flex flex-col items-center relative overflow-hidden overscroll-none transition-all duration-300">
        
        {/* Top-Right Control Buttons */}
        <div className="absolute top-3 right-4 z-20 flex items-center gap-1.5">
          {hasChatStarted && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleNewChat}
                  disabled={isLoading || isLoadingHistory}
                  className="size-8 text-muted-foreground hover:text-foreground rounded-full hover:bg-muted/65"
                >
                  <SquarePen className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">New chat</TooltipContent>
            </Tooltip>
          )}

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleHistory}
                disabled={isLoadingHistory}
                className={cn(
                  "size-8 rounded-full transition-colors",
                  isHistoryOpen 
                    ? "text-primary bg-primary/5 hover:bg-primary/10" 
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/65"
                )}
              >
                <History className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {isHistoryOpen ? "Close history" : "Conversation history"}
            </TooltipContent>
          </Tooltip>
        </div>

        {isLoadingHistory ? (
          <div className="flex size-full flex-col items-center justify-center gap-3">
            <Loader2 className="size-6 animate-spin text-muted-foreground/60" />
            <span className="text-xs text-muted-foreground font-medium">Loading conversation...</span>
          </div>
        ) : !hasChatStarted ? (
          <div
            className={cn(
              containerClassName,
              "size-full flex flex-col items-center justify-center py-4 md:py-6 min-h-0 overflow-y-auto md:overflow-y-hidden no-scrollbar",
            )}
          >
            <div className="w-full flex flex-col items-center gap-1 sm:gap-2">
              {/* Hero: greeting + input area */}
              <HeroSection
                onSubmit={handlePromptSubmit}
                modelSelection={modelSelection}
                onModelSelectionChange={setModelSelection}
              />

              {isError && (
                <div className="w-full max-w-[54rem] mt-2 flex items-center justify-center p-4 bg-destructive/10 text-destructive rounded-lg gap-2 text-sm border border-destructive/20">
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
              <div className="w-full max-w-[54rem] mx-auto flex flex-col gap-6 px-4 sm:px-6">
                {messages.map((message: any) => {
                  const isAssistant = message.role === "assistant";
                  const text =
                    message.parts
                      ?.filter((p: any) => p.type === "text")
                      ?.map((p: any) => p.text)
                      ?.join("\n") ||
                    message.content ||
                    "";

                  const showShimmer =
                    isAssistant && isLoading && text.trim() === "";

                  return (
                    <Message
                      from={message.role}
                      key={message.id}
                      className="max-w-full w-full"
                    >
                      <MessageContent
                        className={cn(
                          isAssistant && "w-full text-[0.95rem] leading-7",
                          showShimmer && "px-0 py-0",
                        )}
                      >
                        {showShimmer ? (
                          <div className="flex items-center gap-2 py-2 text-sm">
                            <span className="flex size-7 items-center justify-center rounded-full border border-border/70 bg-card/80 text-muted-foreground">
                              <MessageCircle className="size-3.5" />
                            </span>
                            <Shimmer className="font-medium" duration={1.6}>
                              {assistantLoadingText}
                            </Shimmer>
                          </div>
                        ) : (
                          <>
                            <MessageResponse>{text}</MessageResponse>
                            {isAssistant && (
                              <MessageActions className="mt-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                                <LikeAction
                                  isLiked={liked[message.id] ?? false}
                                  messageKey={message.id}
                                  onToggle={handleToggleLike}
                                />
                                <DislikeAction
                                  isDisliked={disliked[message.id] ?? false}
                                  messageKey={message.id}
                                  onToggle={handleToggleDislike}
                                />
                                <CopyAction content={text} />
                              </MessageActions>
                            )}
                          </>
                        )}
                      </MessageContent>
                    </Message>
                  );
                })}

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
              <div className="pointer-events-auto w-full max-w-[54rem]">
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

      {/* History Sidebar */}
      {isHistoryOpen && (
        <aside className="w-80 h-full bg-card/60 backdrop-blur-xl border-l border-border/75 flex flex-col shadow-2xl transition-all duration-300 shrink-0 select-none">
          <div className="p-4 border-b border-border/60 flex items-center justify-between">
            <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <History className="size-3.5 text-primary" /> Conversations
            </h2>
            <Button
              variant="ghost"
              size="icon"
              className="size-7 hover:bg-muted/80 text-muted-foreground hover:text-foreground rounded-full"
              onClick={toggleHistory}
            >
              <X className="size-4" />
            </Button>
          </div>

          {/* Search bar */}
          <div className="p-3 border-b border-border/50">
            <div className="relative flex items-center rounded-lg border border-border bg-muted/40 px-3 py-1.5 focus-within:border-primary/40 focus-within:ring-1 focus-within:ring-primary/20 transition-all">
              <Search className="size-3.5 text-muted-foreground/60 mr-2 shrink-0" />
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-transparent text-[13px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none py-0"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery("")} className="text-muted-foreground hover:text-foreground">
                  <X className="size-3" />
                </button>
              )}
            </div>
          </div>

          {/* Scrollable list of threads */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1 no-scrollbar">
            {filteredThreads.length === 0 ? (
              <div className="text-center py-8 text-xs text-muted-foreground/75">
                {searchQuery ? "No matching conversations" : "No past conversations"}
              </div>
            ) : (
              filteredThreads.map((t) => {
                const key = `chat_thread_id_${activeOrgId || "personal"}_${activeSpaceId || "default"}`;
                const isActive = localStorage.getItem(key) === t.id;
                const isEditing = editingThreadId === t.id;

                return (
                  <div
                    key={t.id}
                    onClick={() => !isEditing && handleSelectThread(t.id)}
                    className={cn(
                      "flex flex-col gap-0.5 px-3 py-2.5 rounded-xl cursor-pointer group border border-transparent transition-all",
                      isActive
                        ? "bg-primary/5 border-primary/10 text-primary"
                        : "hover:bg-muted/50 text-foreground"
                    )}
                  >
                    {isEditing ? (
                      <div className="flex items-center gap-1.5 py-0.5" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="text"
                          value={editingTitle}
                          onChange={(e) => setEditingTitle(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleSaveRename(t.id);
                            if (e.key === "Escape") setEditingThreadId(null);
                          }}
                          autoFocus
                          className="flex-1 bg-background border border-border/80 rounded px-1.5 py-0.5 text-xs text-foreground focus:outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/10"
                        />
                        <button
                          onClick={() => handleSaveRename(t.id)}
                          className="size-6 rounded-md hover:bg-muted flex items-center justify-center text-primary"
                        >
                          <Check className="size-3.5" />
                        </button>
                        <button
                          onClick={() => setEditingThreadId(null)}
                          className="size-6 rounded-md hover:bg-muted flex items-center justify-center text-muted-foreground"
                        >
                          <X className="size-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <span className="text-[13px] font-medium block truncate">
                            {t.title || "Untitled conversation"}
                          </span>
                          <span className="text-[10px] text-muted-foreground/80 flex items-center gap-1 mt-0.5">
                            <Calendar className="size-3 text-muted-foreground/60" />
                            {new Date(t.createdAt).toLocaleDateString()}
                          </span>
                        </div>

                        {/* Inline controls (rename, delete) */}
                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => handleStartRename(t.id, t.title, e)}
                            className="size-6 rounded-md hover:bg-muted/80 flex items-center justify-center text-muted-foreground hover:text-foreground"
                            title="Rename"
                          >
                            <Pen className="size-3" />
                          </button>
                          <button
                            onClick={(e) => handleDeleteThread(t.id, e)}
                            className="size-6 rounded-md hover:bg-muted/80 flex items-center justify-center text-muted-foreground hover:text-destructive"
                            title="Delete"
                          >
                            <Trash2 className="size-3" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          <div className="p-3 border-t border-border/60">
            <Button
              variant="outline"
              size="sm"
              className="w-full text-xs hover:bg-muted bg-transparent border-border/80 text-foreground flex items-center justify-center gap-1.5"
              onClick={handleNewChat}
            >
              <SquarePen className="size-3.5" /> New conversation
            </Button>
          </div>
        </aside>
      )}
    </div>
  );
}

