import { useEffect, useRef, useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { useSidebar } from "@/components/ui/sidebar";
import { HeroSection } from "./dashboard/HeroSection";
import { DashboardPanel } from "./dashboard/DashboardPanel";
import { HistorySidebar } from "./dashboard/HistorySidebar";
import { useOrgDashboard } from "@/hooks/api/useDashboard";
import { useAppContext } from "@/contexts/AppContext";
import {
  AlertCircle,
  SquarePen,
  History,
  Loader2,
  Sparkles,
  Clock,
  ListTodo,
  PlusCircle,
  FilePenLine,
  MessageSquareCode,
  FileText,
  Bot,
  Trash2,
  Search,
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
import {
  Reasoning,
  ReasoningTrigger,
  ReasoningContent,
} from "@/components/ai-elements/reasoning";
import {
  ChainOfThought,
  ChainOfThoughtHeader,
  ChainOfThoughtContent,
  ChainOfThoughtStep,
} from "@/components/ai-elements/chain-of-thought";
import { useChat } from "@ai-sdk/react";
import { supabase } from "@/lib/supabase";
import { DefaultChatTransport } from "ai";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// ─── AI Tool Helper Mapping Functions ──────────────────────────────────────────

const getToolIcon = (toolName: string) => {
  if (toolName.includes("schedule")) {
    return Calendar;
  }
  if (toolName.includes("task") || toolName.includes("org")) {
    if (toolName.includes("create")) return PlusCircle;
    if (toolName.includes("update")) return FilePenLine;
    if (toolName.includes("delete")) return Trash2;
    if (toolName.includes("search")) return Search;
    return ListTodo;
  }
  if (toolName.includes("motion") || toolName.includes("page")) {
    if (toolName.includes("search")) return Search;
    return FileText;
  }
  if (toolName.includes("channel") || toolName.includes("message")) {
    return MessageSquareCode;
  }
  if (toolName.includes("calendar")) {
    return Calendar;
  }
  if (toolName.includes("time") || toolName.includes("clock")) {
    return Clock;
  }
  if (toolName.startsWith("keilhq-")) {
    return Bot;
  }
  return Sparkles;
};

const getToolLabel = (toolName: string, args: any) => {
  const safeArgs = args || {};
  switch (toolName) {
    case "keilhq-task-agent":
      return "Delegated to Task Agent";
    case "keilhq-chat-agent":
      return "Delegated to Chat Agent";
    case "keilhq-motion-agent":
      return "Delegated to Motion Agent";
    case "keilhq-scheduler-agent":
      return "Delegated to Scheduler Agent";
    case "get_unscheduled_tasks":
      return "Retrieving unscheduled tasks";
    case "auto_schedule_tasks":
      return "Auto-scheduling tasks into calendar free slots";
    case "get_current_time":
      return "Checking current date and time context";
    case "get_calendar_events":
      return `Checking calendar events (${safeArgs.startDate || ""} to ${safeArgs.endDate || ""})`;
    case "get_personal_tasks":
      return "Retrieving personal tasks list";
    case "get_org_tasks":
      return "Retrieving organization tasks list";
    case "get_my_assigned_tasks":
      return "Retrieving tasks assigned to me";
    case "search_tasks":
      return `Searching tasks for "${safeArgs.query || ""}"`;
    case "create_org_task":
    case "create_personal_task":
      return `Creating task: "${safeArgs.title || ""}"`;
    case "update_org_task":
    case "update_personal_task":
      return `Updating task: "${safeArgs.title || safeArgs.id || ""}"`;
    case "delete_org_task":
    case "delete_personal_task":
      return `Deleting task ID: ${safeArgs.taskId || safeArgs.id || ""}`;
    case "get_user_channels":
      return "Retrieving chat channels";
    case "get_channel_messages":
      return "Reading messages in channel";
    case "check_unread_messages":
      return "Checking for unread messages";
    case "list_motion_pages":
      return "Retrieving list of Motion pages";
    case "search_motion_pages":
      return `Searching notes for "${safeArgs.query || ""}"`;
    case "get_motion_page":
      return `Reading note page context`;
    default:
      return `Running tool: ${toolName}`;
  }
};

const getToolDescription = (toolName: string, _args: any, result: any) => {
  if (!result) return "";

  if (result.success === false || result.error) {
    return `Error: ${result.error || result.message || "Failed to execute"}`;
  }

  switch (toolName) {
    case "get_unscheduled_tasks":
      return `Found ${result.tasks?.length || 0} unscheduled tasks`;
    case "auto_schedule_tasks":
      return `Successfully scheduled ${result.scheduledCount || 0} tasks`;
    case "get_current_time":
      return `Context: ${result.localTime || result.iso || ""}`;
    case "get_calendar_events":
      return `Found ${result.events?.length || 0} events`;
    case "get_personal_tasks":
    case "get_org_tasks":
    case "get_my_assigned_tasks":
      return `Found ${result.tasks?.length || 0} tasks`;
    case "search_tasks":
      return `Found ${result.tasks?.length || 0} matches`;
    case "create_org_task":
    case "create_personal_task":
      return `Created task successfully (ID: ${result.task?.id || ""})`;
    case "update_org_task":
    case "update_personal_task":
      return `Updated task successfully`;
    case "delete_org_task":
    case "delete_personal_task":
      return `Deleted task successfully`;
    case "get_user_channels":
      return `Retrieved ${result.channels?.length || 0} channels`;
    case "get_channel_messages":
      return `Read ${result.messages?.length || 0} messages`;
    case "check_unread_messages":
      return result.unreadCount !== undefined
        ? `Found ${result.unreadCount} unread messages`
        : "Checked unread messages";
    case "list_motion_pages":
      return `Found ${result.pages?.length || 0} pages`;
    case "search_motion_pages":
      return `Found ${result.pages?.length || 0} matching pages`;
    case "get_motion_page":
      return `Fetched page content (length: ${result.markdown?.length || result.content?.length || 0} characters)`;
    default:
      return "Completed successfully";
  }
};

const formatToolResult = (toolName: string, result: any) => {
  if (!result) return "";

  if (result.success === false || result.error) {
    return `Error: ${result.error || result.message || "Failed to execute"}`;
  }

  if (toolName === "auto_schedule_tasks") {
    const lines = [];
    if (result.message) lines.push(result.message);
    if (Array.isArray(result.scheduledTasks) && result.scheduledTasks.length > 0) {
      lines.push("\nScheduled Tasks:");
      result.scheduledTasks.forEach((t: any) => {
        if (!t.error) {
          lines.push(`- ${t.title}: ${new Date(t.start_date).toLocaleString()} to ${new Date(t.due_date).toLocaleString()}`);
        } else {
          lines.push(`- ${t.title}: Error (${t.error})`);
        }
      });
    }
    if (Array.isArray(result.unscheduledTasks) && result.unscheduledTasks.length > 0) {
      lines.push("\nCould not schedule (calendar full):");
      result.unscheduledTasks.forEach((t: any) => {
        lines.push(`- ${t.title} (Priority: ${t.priority || "Medium"})`);
      });
    }
    return lines.join("\n");
  }

  // Handle tasks lists
  if (Array.isArray(result.tasks)) {
    if (result.tasks.length === 0) return "No tasks found.";
    return result.tasks.map((t: any) => `- [${t.status || "TODO"}] ${t.title} (Priority: ${t.priority || "Medium"})`).join("\n");
  }

  // Handle single task result
  if (result.task) {
    const t = result.task;
    return `Task Details:
- Title: ${t.title}
- Status: ${t.status || "TODO"}
- Priority: ${t.priority || "Medium"}
- Due: ${t.due_date || "None"}`;
  }

  // Handle events lists
  if (Array.isArray(result.events)) {
    if (result.events.length === 0) return "No events found.";
    return result.events.map((e: any) => `- ${e.title} (${e.start_date || ""} to ${e.due_date || ""})`).join("\n");
  }

  // Handle channels lists
  if (Array.isArray(result.channels)) {
    if (result.channels.length === 0) return "No channels found.";
    return result.channels.map((c: any) => `# ${c.name} (ID: ${c.id})`).join("\n");
  }

  // Handle messages lists
  if (Array.isArray(result.messages)) {
    if (result.messages.length === 0) return "No messages found.";
    return result.messages.map((m: any) => `[${m.user_id?.substring(0, 8) || "User"}]: ${m.content}`).join("\n");
  }

  // Handle motion pages list
  if (Array.isArray(result.pages)) {
    if (result.pages.length === 0) return "No pages found.";
    return result.pages.map((p: any) => `- ${p.title} (ID: ${p.id})`).join("\n");
  }

  // Handle single motion page result
  if (result.page) {
    return `Page: ${result.page.title} (ID: ${result.page.id})\n\n${result.markdown || result.page.content || ""}`;
  }

  if (result.markdown) {
    return result.markdown;
  }

  // Fallback: pretty print the JSON, but limit length
  const jsonStr = JSON.stringify(result, null, 2);
  if (jsonStr.length > 500) {
    return jsonStr.substring(0, 500) + "\n... (truncated)";
  }
  return jsonStr;
};

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
  const [isHistoryOpen, setIsHistoryOpen] = useState<boolean>(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

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

  const getActiveAgentAndStatus = useCallback(() => {
    if (!isLoading) return null;

    const assistantMessages = messages.filter((m) => m.role === "assistant");
    if (assistantMessages.length === 0) {
      return { agent: "KeilHQ AI", status: "Orchestrating..." };
    }

    const lastAssistantMsg = assistantMessages[assistantMessages.length - 1];
    const invocations = (lastAssistantMsg as any).toolInvocations || [];
    if (invocations.length === 0) {
      return { agent: "KeilHQ AI", status: "Thinking..." };
    }

    const activeInvocation =
      invocations.find((inv: any) => inv.state === "call") ||
      invocations[invocations.length - 1];

    if (!activeInvocation) {
      return { agent: "KeilHQ AI", status: "Thinking..." };
    }

    const { toolName, args } = activeInvocation;
    let agent = "KeilHQ AI";
    let status = "Running...";

    if (toolName === "keilhq-task-agent") {
      agent = "Task Agent";
      status = "Delegating to task specialist...";
    } else if (toolName === "keilhq-chat-agent") {
      agent = "Chat Agent";
      status = "Delegating to chat specialist...";
    } else if (toolName === "keilhq-motion-agent") {
      agent = "Motion Agent";
      status = "Delegating to notes specialist...";
    } else if (toolName === "keilhq-scheduler-agent") {
      agent = "Scheduler Agent";
      status = "Delegating to calendar specialist...";
    } else {
      if (toolName.includes("schedule")) {
        agent = "Scheduler Agent";
      } else if (toolName.includes("task") || toolName.includes("org")) {
        agent = "Task Agent";
      } else if (
        toolName.includes("chat") ||
        toolName.includes("channel") ||
        toolName.includes("message")
      ) {
        agent = "Chat Agent";
      } else if (toolName.includes("motion") || toolName.includes("page")) {
        agent = "Motion Agent";
      }

      switch (toolName) {
        case "get_unscheduled_tasks":
          status = "Finding unscheduled tasks...";
          break;
        case "auto_schedule_tasks":
          status = "Calculating free calendar slots and scheduling...";
          break;
        case "get_org_tasks":
        case "get_personal_tasks":
          status = "Fetching tasks list...";
          break;
        case "get_my_assigned_tasks":
          status = "Retrieving tasks assigned to you...";
          break;
        case "search_tasks":
          status = `Searching for task query "${args.query || ""}"...`;
          break;
        case "create_org_task":
        case "create_personal_task":
          status = `Creating task "${args.title || ""}"...`;
          break;
        case "update_org_task":
        case "update_personal_task":
          status = "Updating task details...";
          break;
        case "delete_org_task":
        case "delete_personal_task":
          status = "Deleting task...";
          break;
        case "get_user_channels":
          status = "Retrieving message channels...";
          break;
        case "get_channel_messages":
          status = "Reading recent channel messages...";
          break;
        case "check_unread_messages":
          status = "Checking for unread messages...";
          break;
        case "list_motion_pages":
          status = "Browsing notes list...";
          break;
        case "search_motion_pages":
          status = `Searching notes for "${args.query || ""}"...`;
          break;
        case "get_motion_page":
          status = "Reading note content...";
          break;
        case "get_calendar_events":
          status = "Reading calendar schedule...";
          break;
        case "get_current_time":
          status = "Getting current date/time context...";
          break;
        default:
          status = `Running tool ${toolName}...`;
      }
    }

    return { agent, status };
  }, [messages, isLoading]);

  const activeStatus = getActiveAgentAndStatus();
  const loadingText = activeStatus
    ? `[${activeStatus.agent}] ${activeStatus.status}`
    : assistantLoadingText;

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

  const toggleHistory = useCallback(() => {
    setIsHistoryOpen((prev) => !prev);
  }, []);

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

                  // Extract reasoning parts
                  const reasoningParts = message.parts
                    ?.filter((p: any) => p.type === "reasoning")
                    ?.map((p: any) => p.text)
                    ?.join("") || "";
                  const reasoningText = reasoningParts || (message as any).reasoning || "";
                  const hasReasoning = reasoningText.length > 0;

                  // Extract tool invocations
                  const toolInvocations = (message as any).toolInvocations || [];
                  const hasToolInvocations = toolInvocations.length > 0;

                  const isMessageStreaming = isLoading && messages[messages.length - 1]?.id === message.id;

                  // Show shimmer if assistant is active but we have no content at all yet
                  const showShimmer =
                    isAssistant && isMessageStreaming && !hasReasoning && !hasToolInvocations && text.trim() === "";

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
                            <Shimmer className="font-medium" duration={1.6}>
                              {loadingText}
                            </Shimmer>
                          </div>
                        ) : isAssistant ? (
                          <div className="space-y-4">
                            {/* 1. Reasoning Component */}
                            {hasReasoning && (
                              <Reasoning isStreaming={isMessageStreaming}>
                                <ReasoningTrigger />
                                <ReasoningContent>{reasoningText}</ReasoningContent>
                              </Reasoning>
                            )}

                            {/* 2. Chain of Thought Component */}
                            {hasToolInvocations && (
                              <ChainOfThought defaultOpen={true}>
                                <ChainOfThoughtHeader className="text-xs uppercase tracking-wider font-semibold py-1">
                                  {toolInvocations.length} {toolInvocations.length === 1 ? "action" : "actions"} taken
                                </ChainOfThoughtHeader>
                                <ChainOfThoughtContent className="border-l border-border/60 pl-3 ml-2 space-y-3">
                                  {toolInvocations.map((inv: any) => {
                                    const status = inv.state === "result" ? "complete" : "active";
                                    const Icon = getToolIcon(inv.toolName);
                                    const label = getToolLabel(inv.toolName, inv.args);
                                    const description = getToolDescription(inv.toolName, inv.args, inv.result);

                                    return (
                                      <ChainOfThoughtStep
                                        key={inv.toolCallId}
                                        icon={Icon}
                                        label={
                                          <span className="font-medium text-foreground text-[13px]">
                                            {label}
                                          </span>
                                        }
                                        description={
                                          description && (
                                            <span className="text-muted-foreground text-xs block mt-0.5 font-normal">
                                              {description}
                                            </span>
                                          )
                                        }
                                        status={status}
                                      >
                                        {inv.state === "result" && inv.result && (
                                          <div className="mt-1 max-w-full text-[11px] bg-muted/40 p-2 rounded-lg border border-border/40 font-mono overflow-auto max-h-36 no-scrollbar leading-relaxed">
                                            {formatToolResult(inv.toolName, inv.result)}
                                          </div>
                                        )}
                                      </ChainOfThoughtStep>
                                    );
                                  })}
                                </ChainOfThoughtContent>
                              </ChainOfThought>
                            )}

                            {/* 3. Final Text Response */}
                            {text.trim() !== "" && (
                              <MessageResponse>{text}</MessageResponse>
                            )}

                            {/* 4. Actions */}
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
                          </div>
                        ) : (
                          <MessageResponse>{text}</MessageResponse>
                        )}
                      </MessageContent>
                    </Message>
                  );
                })}

                {isAssistantThinking && (
                  <Message from="assistant" className="max-w-full w-full">
                    <MessageContent className="px-0 py-0">
                      <div className="flex items-center gap-2 py-2 text-sm">
                        <Shimmer className="font-medium" duration={1.6}>
                          {loadingText}
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

      {/* History Sidebar — Sheet slides in from the right */}
      <HistorySidebar
        open={isHistoryOpen}
        onOpenChange={setIsHistoryOpen}
        activeOrgId={activeOrgId}
        activeSpaceId={activeSpaceId}
        onSelectThread={handleSelectThread}
        onNewChat={handleNewChat}
      />
    </div>
  );
}

