import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useSidebar } from "@/components/ui/sidebar";
import { HeroSection } from "./dashboard/HeroSection";
import { DashboardPanel } from "./dashboard/DashboardPanel";
import { HistorySidebar } from "./dashboard/HistorySidebar";
import { useOrgDashboard } from "@/hooks/api/useDashboard";
import { motion, AnimatePresence } from "motion/react";
import { useAppContext } from "@/contexts/AppContext";
import {
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
  List,
  Inbox,
  Layout,
  File,
  FilePlus,
  MessageSquare,
  MessageCircle,
  Building,
  Globe,
  Github,
  GitPullRequest,
  Users,
  GitBranch,
  BrainIcon,
  ChevronDown,
  ChevronUp,
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
  TruncatedMessage,
} from "@/components/ai-elements/message";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Shimmer } from "@/components/ai-elements/shimmer";
import type { PromptInputMessage } from "@/components/ai-elements/prompt-input";
import {
  ChainOfThought,
  ChainOfThoughtHeader,
  ChainOfThoughtContent,
  ChainOfThoughtStep,
} from "@/components/ai-elements/chain-of-thought";
import { getToolActivity, extractToolInvocations } from "@/lib/agent-activity";
import { extractStreamingActivities, buildChainOfThoughtTimeline } from "@/lib/activity-stream";
import { uploadChatAttachment } from "@/lib/s3-upload";
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

const getToolIcon = (toolName: string, result?: any) => {
  const iconHint = result?.activity?.icon;
  if (iconHint) {
    switch (iconHint) {
      case "search": return Search;
      case "list": return List;
      case "file-text": return FileText;
      case "plus-circle": return PlusCircle;
      case "edit": return FilePenLine;
      case "trash": return Trash2;
      case "calendar": return Calendar;
      case "inbox": return Inbox;
      case "clock": return Clock;
      case "layout": return Layout;
      case "file": return File;
      case "file-plus": return FilePlus;
      case "file-edit": return FilePenLine;
      case "message-square": return MessageSquare;
      case "message-circle": return MessageCircle;
      case "building": return Building;
      case "globe": return Globe;
      case "github": return Github;
      case "git-pull-request": return GitPullRequest;
      case "users": return Users;
      case "git-branch": return GitBranch;
    }
  }

  if (toolName.includes("schedule")) {
    return Calendar;
  }
  if (toolName.includes("task") || toolName.includes("org") || toolName.includes("workspace")) {
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

const getAgentIcon = (agentName: string) => {
  switch (agentName) {
    case "Task Manager": return ListTodo;
    case "Chat": return MessageSquareCode;
    case "Notes": return FileText;
    case "Scheduler": return Calendar;
    case "GitHub": return Github;
    default: return Bot;
  }
};

const getToolLabel = (toolName: string, args: any, result?: any) => {
  if (result?.activity?.action) {
    return result.activity.action;
  }
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
    case "list_tasks":
      return safeArgs.scope ? `Listing your ${safeArgs.scope} tasks` : "Listing tasks";
    case "get_task":
      return "Reading task details";
    case "create_task":
      return safeArgs.title ? `Creating task "${safeArgs.title}"` : "Creating task";
    case "update_task":
      return "Updating task details";
    case "delete_task":
      return "Deleting task";
    case "resolve_workspace":
      return "Looking up workspace";
    case "search_tasks":
      return `Searching tasks for "${safeArgs.query || ""}"`;
    case "get_calendar_events":
      return `Reading calendar schedule`;
    case "get_unscheduled_tasks":
      return "Retrieving unscheduled tasks";
    case "auto_schedule_tasks":
      return "Auto-scheduling tasks into calendar free slots";
    case "get_user_channels":
      return "Checking message channels";
    case "get_channel_messages":
      return "Reading messages in channel";
    case "list_motion_pages":
      return "Retrieving list of Motion pages";
    case "search_motion_pages":
      return `Searching notes for "${safeArgs.query || ""}"`;
    case "get_motion_page":
      return `Reading note page content`;
    case "create_motion_page":
      return safeArgs.title ? `Creating note "${safeArgs.title}"` : "Creating note page";
    case "update_motion_page":
      return "Updating note page";
    case "web_search_exa":
      return safeArgs.query ? `Searching the web for "${safeArgs.query}"` : "Searching the web";
    case "list_github_issues":
      return safeArgs.repo ? `Listing issues in ${safeArgs.repo}` : "Listing GitHub issues";
    case "get_github_issue":
      return safeArgs.issueNumber && safeArgs.repo ? `Reading issue #${safeArgs.issueNumber} in ${safeArgs.repo}` : "Reading GitHub issue";
    case "list_github_prs":
      return safeArgs.repo ? `Listing pull requests in ${safeArgs.repo}` : "Listing GitHub pull requests";
    case "list_github_contributors":
      return safeArgs.repo ? `Looking up contributors in ${safeArgs.repo}` : "Looking up GitHub contributors";
    case "create_github_issue_from_task":
      return "Creating GitHub issue from task";
    default:
      return `Running tool: ${toolName}`;
  }
};

const getToolDescription = (toolName: string, _args: any, result: any) => {
  if (result?.activity?.details) {
    return result.activity.details;
  }
  if (!result) return "";

  if (result.success === false || result.error) {
    return `Error: ${result.error || result.message || "Failed to execute"}`;
  }

  switch (toolName) {
    case "list_tasks":
      return `Found ${result.tasks?.length || 0} tasks`;
    case "get_task":
      return result.task ? `Fetched details for "${result.task.title}"` : "Read task details";
    case "create_task":
      return result.task ? `Created task successfully (ID: ${result.task.id})` : "Created task successfully";
    case "update_task":
      return "Updated task successfully";
    case "delete_task":
      return "Deleted task successfully";
    case "resolve_workspace":
      return `Found ${result.workspaces?.length || 0} workspace(s)`;
    case "get_unscheduled_tasks":
      return `Found ${result.tasks?.length || 0} unscheduled tasks`;
    case "auto_schedule_tasks":
      return `Successfully scheduled ${result.scheduledCount || 0} tasks`;
    case "get_calendar_events":
      return `Found ${result.events?.length || 0} events`;
    case "search_tasks":
      return `Found ${result.tasks?.length || 0} matches`;
    case "get_user_channels":
      return `Retrieved ${result.channels?.length || 0} channels`;
    case "get_channel_messages":
      return `Read ${result.messages?.length || 0} messages`;
    case "list_motion_pages":
      return `Found ${result.pages?.length || 0} pages`;
    case "search_motion_pages":
      return `Found ${result.pages?.length || 0} matching pages`;
    case "get_motion_page":
      return `Fetched page content (length: ${result.markdown?.length || result.content?.length || 0} characters)`;
    case "web_search_exa":
      return `Found ${result.results?.length || 0} search results`;
    case "list_github_issues":
      return `Found ${result.issues?.length || 0} open issue(s)`;
    case "get_github_issue":
      return result.issue ? `Fetched issue details: "${result.issue.title}"` : "Read issue details";
    case "list_github_prs":
      return `Found ${result.prs?.length || 0} PR(s)`;
    case "list_github_contributors":
      return `Found ${result.contributors?.length || 0} contributor(s)`;
    case "create_github_issue_from_task":
      return `Created issue successfully`;
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

const BACKGROUNDS = [
  { id: "none", name: "None", url: "" },
  { id: "lib-gate", name: "Library Gate", url: "/backgrounds/lib-gate.png" },
  { id: "mountain-garden", name: "Mountain Garden", url: "/backgrounds/mountain-garden.jpg" },
  { id: "open-garden", name: "Open Garden", url: "/backgrounds/open-garden.png" }
];

export function Dashboard() {
  const { state } = useSidebar();
  const [mounted, setMounted] = useState(false);

  const { threadId } = useParams<{ threadId?: string }>();
  const navigate = useNavigate();
  // Set when the user submits from the home page. Cleared once the message is sent.
  const pendingInitialMessageRef = useRef<{ text: string; files: any[] } | null>(null);
  // Set to true when we navigate to a brand-new thread from the home page.
  // Tells loadChat to skip the API call (there's no history yet).
  const isNewThreadRef = useRef(false);
  const currentWorkspaceRef = useRef<string>("");

  // ── Dashboard Data ─────────────────────────────────────────
  const { activeOrgId, activeSpaceId } = useAppContext();

  // ── Org/space-scoped dashboard ──────────
  const {
    data,
    isLoading: isDashboardLoading,
    isError,
  } = useOrgDashboard(activeOrgId, activeSpaceId);

  const [isDashboardExpanded, setIsDashboardExpanded] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("dashboard_expanded") === "true";
    }
    return false;
  });

  const handleToggleDashboard = useCallback(() => {
    setIsDashboardExpanded((prev) => {
      const next = !prev;
      localStorage.setItem("dashboard_expanded", String(next));
      return next;
    });
  }, []);

  const urgentCount = data?.immediate?.length ?? 0;
  const replyCount = data?.needsReply?.length ?? 0;
  const queuedCount = data?.today?.length ?? 0;

  const [modelSelection, setModelSelection] = useState<string>(() => {
    return localStorage.getItem("ai_model_selection") || "gemini";
  });
  const [dashboardBackground, setDashboardBackground] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("dashboard_background") || "open-garden";
    }
    return "open-garden";
  });
  const [isUploadingFiles, setIsUploadingFiles] = useState(false);

  useEffect(() => {
    const handleStorageChange = () => {
      const saved = localStorage.getItem("ai_model_selection");
      if (saved) {
        setModelSelection(saved);
      }
    };
    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("ai_model_selection_changed", handleStorageChange);
    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("ai_model_selection_changed", handleStorageChange);
    };
  }, []);

  useEffect(() => {
    const handleStorageChange = () => {
      const saved = localStorage.getItem("dashboard_background");
      if (saved) {
        setDashboardBackground(saved);
      }
    };
    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("dashboard_background_changed", handleStorageChange);
    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("dashboard_background_changed", handleStorageChange);
    };
  }, []);

  // Memoized transport — avoids recreating the object on every render which
  // can cause useChat to reset or drop streaming state mid-response.
  const chatTransport = useMemo(
    () =>
      new DefaultChatTransport({
        api: `${(import.meta.env.VITE_API_URL || "http://localhost:5001/api").replace(/\/api\/?$/, "")}/chat`,
        headers: async (): Promise<Record<string, string>> => {
          const {
            data: { session },
          } = await supabase.auth.getSession();
          if (session?.access_token)
            return { Authorization: `Bearer ${session.access_token}` };
          return {};
        },
        prepareSendMessagesRequest: ({ messages: msgs }) => {
          // threadId is always set here: either from the URL param (existing thread)
          // or because sendInitialMessage only fires after threadId is available.
          const tid = threadId || crypto.randomUUID();

          return {
            body: {
              messages: [msgs[msgs.length - 1]],
              modelSelection: modelSelection || "gemini",
              ...(modelSelection === "local" && {
                localAiBaseUrl:
                  localStorage.getItem("local_ai_base_url") ||
                  "http://localhost:8080/v1",
                localAiModel: localStorage.getItem("local_ai_model") || "gemma-4",
              }),
              ...(modelSelection === "openrouter" && {
                openRouterModel:
                  localStorage.getItem("openrouter_model") ||
                  "openai/gpt-4o-mini",
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [threadId, modelSelection, activeOrgId, activeSpaceId]
  );

  const { messages, sendMessage, setMessages, status, stop } = useChat({
    id: threadId,
    transport: chatTransport,
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

  const isStreaming = status === "streaming";
  const isLoading = status === "submitted" || status === "streaming" || isUploadingFiles;

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

  // useMemo instead of useCallback+call — avoids running filtering/extraction
  // on every render tick during streaming.
  const activeStatus = useMemo(() => {
    if (!isLoading) return null;

    const assistantMessages = messages.filter((m) => m.role === "assistant");
    if (assistantMessages.length === 0) {
      return { agent: "KeilHQ AI", status: "Orchestrating..." };
    }

    const lastAssistantMsg = assistantMessages[assistantMessages.length - 1];

    // First check live activity stream
    const streamingActivities = extractStreamingActivities(lastAssistantMsg);
    const runningActivity = streamingActivities.find((act) => act.status === "running");
    if (runningActivity) {
      return { agent: runningActivity.agent, status: `${runningActivity.action}...` };
    }

    // Fallback to traditional tool invocations
    const invocations = extractToolInvocations(lastAssistantMsg);
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
    const activity = getToolActivity(toolName, activeInvocation.state, activeInvocation.result, args);

    return { agent: activity.agent, status: `${activity.action}...` };
  }, [messages, isLoading]);

  const loadingText = activeStatus
    ? `[${activeStatus.agent}] ${activeStatus.status}`
    : assistantLoadingText;

  const containerClassName = cn(
    "mx-auto transition-all duration-500 ease-in-out px-4 sm:px-6 lg:px-10",
    isCollapsed ? "max-w-[1400px]" : "max-w-6xl",
  );

  const handlePromptSubmit = async (message: PromptInputMessage) => {
    if (isStreaming || isUploadingFiles) return;

    try {
      let text = message.text.trim();
      let uploadedFiles: any[] = [];

      if (message.files && message.files.length > 0) {
        setIsUploadingFiles(true);

        const textFiles = message.files.filter(f => 
            f.mediaType?.startsWith('text/') || 
            (f.filename && f.filename.match(/\.(md|txt|json|csv|log)$/i))
        );
        
        const otherFiles = message.files.filter(f => 
            !(f.mediaType?.startsWith('text/') || 
            (f.filename && f.filename.match(/\.(md|txt|json|csv|log)$/i)))
        );

        if (textFiles.length > 0) {
            for (const f of textFiles) {
                try {
                    const res = await fetch(f.url);
                    const decodedText = await res.text();
                    text += `\n\n--- File: ${f.filename} ---\n${decodedText}\n--- End of ${f.filename} ---`;
                } catch (e) {
                    console.error("Failed to read text file:", e);
                }
            }
        }

        const uploadedOtherFiles = await Promise.all(
          otherFiles.map((file) => uploadChatAttachment(file))
        );

        uploadedFiles = [
          ...uploadedOtherFiles,
          ...textFiles.map(f => ({
              id: (f as any).id || crypto.randomUUID(),
              type: "file",
              filename: f.filename,
              mediaType: f.mediaType || "text/plain",
              url: ""
          }))
        ];
      }

      const fileCount = message.files.length;
      const content = text.trim() || (fileCount > 0 ? `${fileCount} attachment${fileCount === 1 ? "" : "s"} added` : "");

      if (!content) return;

      const msgPayload = { text: content, files: uploadedFiles };

      if (!threadId) {
        // Home page: queue the message and navigate to a new thread.
        // The sendInitialMessage effect below will send it once threadId is set.
        const newThreadId = crypto.randomUUID();
        pendingInitialMessageRef.current = msgPayload;
        isNewThreadRef.current = true;
        navigate(`/c/${newThreadId}`);
        // Do NOT call sendMessage here — the new Dashboard instance will handle it.
        return;
      }

      // Auto-generate title if this is the first message on an existing thread
      if (messages.length === 0) {
        let title = content.trim();
        if (title.length > 40) {
          title = title.substring(0, 40) + "...";
        }
        api.put(`v1/ai/threads/${threadId}`, { title }).catch(() => {});
      }

      await sendMessage(msgPayload);
    } catch (error) {
      console.error("Failed to upload chat attachments to S3:", error);
    } finally {
      setIsUploadingFiles(false);
    }
  };

  const handleNewChat = useCallback(() => {
    navigate("/");
  }, [navigate]);

  const mapMastraMessageToFrontend = useCallback((msg: any) => {
    let text = "";
    let parts = msg.parts || [];
    let toolInvocations = msg.toolInvocations || [];

    // Safely parse content if it's a JSON string
    let parsedContent = msg.content;
    if (typeof parsedContent === "string" && parsedContent.trim().startsWith("{")) {
      try {
        parsedContent = JSON.parse(parsedContent);
      } catch (e) {
        // Not valid JSON, leave as string
      }
    }

    if (Array.isArray(parsedContent)) {
      text = parsedContent
        .filter((p: any) => p.type === "text" && p.text)
        .map((p: any) => p.text)
        .join("\n");
      if (parts.length === 0) parts = parsedContent;
    } else if (parsedContent && typeof parsedContent === "object") {
      if (parsedContent.content && typeof parsedContent.content === "string") {
        text = parsedContent.content;
      }
      if (Array.isArray(parsedContent.parts)) {
        if (parts.length === 0) parts = parsedContent.parts;
        if (!text) {
          text = parsedContent.parts
            .filter((p: any) => p.type === "text" && p.text)
            .map((p: any) => p.text)
            .join("\n");
        }
      }
      if (Array.isArray(parsedContent.toolInvocations)) {
        if (toolInvocations.length === 0) toolInvocations = parsedContent.toolInvocations;
      }
      // Extract tool invocations from parts of type 'tool-invocation' if toolInvocations array is empty
      if ((!Array.isArray(toolInvocations) || toolInvocations.length === 0) && Array.isArray(parsedContent.parts)) {
        toolInvocations = parsedContent.parts
          .filter((p: any) => p.type === "tool-invocation" && p.toolInvocation)
          .map((p: any) => p.toolInvocation);
      }
    } else if (typeof parsedContent === "string") {
      text = parsedContent;
    }

    return {
      ...msg,
      id: msg.id || crypto.randomUUID(),
      role: msg.role === "signal" ? "system" : msg.role,
      content: text,
      parts: Array.isArray(parts) ? parts : [],
      toolInvocations: Array.isArray(toolInvocations) ? toolInvocations : [],
      createdAt: msg.createdAt ? new Date(msg.createdAt) : undefined,
    };
  }, []);

  const handleSelectThread = useCallback((id: string) => {
    navigate(`/c/${id}`);
  }, [navigate]);

  const toggleHistory = useCallback(() => {
    setIsHistoryOpen((prev) => !prev);
  }, []);

  // Track workspace changes so we can reset the thread when the user switches
  // org/space — but only when a thread is already open (not on the home page).
  useEffect(() => {
    const workspaceKey = `${activeOrgId || "personal"}_${activeSpaceId || "default"}`;

    if (
      threadId &&
      currentWorkspaceRef.current &&
      currentWorkspaceRef.current !== workspaceKey
    ) {
      // Workspace switched while a thread was open → go back to home.
      navigate("/", { replace: true });
    }

    currentWorkspaceRef.current = workspaceKey;
  }, [threadId, activeOrgId, activeSpaceId, navigate]);

  // ── Send initial message for new threads (MUST be declared before loadChat) ──
  // When the user submits on the home page, handlePromptSubmit only navigates.
  // This effect fires once threadId is available and sends the queued message,
  // preventing the hero-flash that would occur if we sent before navigation.
  useEffect(() => {
    if (!threadId || !pendingInitialMessageRef.current) return;
    const msg = pendingInitialMessageRef.current;
    pendingInitialMessageRef.current = null;
    sendMessage(msg);

    // Auto-generate title
    let title = msg.text.trim();
    if (title.length > 40) {
      title = title.substring(0, 40) + "...";
    }
    api.put(`v1/ai/threads/${threadId}`, { title }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId]); // intentionally omit sendMessage — it's stable and we only want this to fire on threadId change

  // ── Load chat history for existing threads ────────────────────────────────
  useEffect(() => {
    const loadChat = async () => {
      if (!threadId) return;

      // Skip the API call for brand-new threads: there's no history and calling
      // setMessages([]) would clear the optimistic user message, causing a flash.
      if (isNewThreadRef.current) {
        isNewThreadRef.current = false; // reset so subsequent threadId changes load normally
        const key = `chat_thread_id_${activeOrgId || "personal"}_${activeSpaceId || "default"}`;
        localStorage.setItem(key, threadId);
        return;
      }

      const key = `chat_thread_id_${activeOrgId || "personal"}_${activeSpaceId || "default"}`;
      localStorage.setItem(key, threadId);

      setIsLoadingHistory(true);
      try {
        const res = await api.get(`v1/ai/threads/${threadId}/messages`);
        const rawMessages = res.data.data.messages || [];
        const mapped = rawMessages
          .filter((m: any) => m.role === "user" || m.role === "assistant")
          .map(mapMastraMessageToFrontend);
        setMessages(mapped);
      } catch (error: any) {
        if (error.response?.status === 404) {
          setMessages([]);
        } else {
          console.error("Failed to load chat history:", error);
          setMessages([]);
        }
      } finally {
        setIsLoadingHistory(false);
      }
    };

    loadChat();
  }, [threadId, activeOrgId, activeSpaceId, setMessages, mapMastraMessageToFrontend]);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const selectedBg = BACKGROUNDS.find(bg => bg.id === dashboardBackground);
  const bgUrl = selectedBg && selectedBg.id !== "none" ? selectedBg.url : null;
  const showDashboardBackground = !hasChatStarted && !isLoadingHistory && !!bgUrl;

  return (
    <div className="h-[100dvh] bg-background text-foreground overflow-hidden overscroll-none flex">
      {/* Main Viewport Container */}
      <main
        className={cn(
          "flex-1 min-w-0 h-full flex flex-col items-center relative overflow-hidden overscroll-none transition-all duration-300",
          showDashboardBackground && "bg-cover bg-center bg-no-repeat"
        )}
        style={
          showDashboardBackground && bgUrl
            ? {
              backgroundImage: `url("${bgUrl}")`,
            }
            : undefined
        }
      >
        {showDashboardBackground && (
          <div className="absolute inset-0 bg-gradient-to-b from-black/3 via-transparent to-background/12 dark:from-black/10 dark:to-background/40 z-0 pointer-events-none" />
        )}

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

          {!isHistoryOpen && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={toggleHistory}
                  disabled={isLoadingHistory}
                  className="size-8 rounded-full transition-colors text-muted-foreground hover:text-foreground hover:bg-muted/65"
                >
                  <History className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                Conversation history
              </TooltipContent>
            </Tooltip>
          )}
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
              "size-full flex flex-col items-center justify-center py-4 md:py-6 min-h-0 overflow-y-auto md:overflow-y-hidden no-scrollbar relative z-10",
            )}
          >
            <div
              className="w-full flex flex-col items-center max-w-[54rem]"
              style={{
                transform: isDashboardExpanded ? "translateY(0)" : "translateY(-56px)",
                transition: "transform 550ms cubic-bezier(0.16, 1, 0.3, 1)",
              }}
            >
              {/* Hero: greeting + input area */}
              <div className="w-full relative z-20">
                <HeroSection
                  onSubmit={handlePromptSubmit}
                />
              </div>



              {/* Attached Animating Dashboard Panel */}
              <div className="w-full relative z-10 -mt-5 px-4">
                <motion.div
                  initial={{ height: 52, opacity: 0 }}
                  animate={{ height: isDashboardExpanded ? "auto" : 52, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 170, damping: 24 }}
                  className="w-full bg-background/88 backdrop-blur-xl border border-border/70 border-t-0 rounded-b-[1.25rem] overflow-hidden shadow-[0_20px_50px_-30px_rgba(0,0,0,0.35)]"
                >
                  <AnimatePresence mode="popLayout" initial={false}>
                    {isDashboardExpanded ? (
                      <motion.div
                        key="expanded"
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.15 }}
                        className="w-full"
                      >
                        {/* Expanded Header control bar with padding shifting text below the prompt card */}
                        <div className="flex items-center justify-between pt-8 pb-2 px-4 border-b border-border/40 text-[11px] text-muted-foreground select-none">
                          <span className="font-mono uppercase tracking-[0.15em] text-[10px]">Workspace Dashboard</span>
                          <button
                            onClick={handleToggleDashboard}
                            className="flex items-center gap-1 hover:text-foreground cursor-pointer transition-colors text-xs"
                          >
                            <span>Minimize</span>
                            <ChevronUp className="size-3.5" />
                          </button>
                        </div>

                        {/* Expanded DashboardPanel */}
                        <DashboardPanel data={data} isLoading={isDashboardLoading} isError={isError} isAttached />
                      </motion.div>
                    ) : (
                      <motion.div
                        key="minimized"
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 4 }}
                        transition={{ duration: 0.15 }}
                        className="flex items-center justify-between w-full h-[52px] pt-7 pb-2 px-4 text-xs text-muted-foreground select-none"
                      >
                        <div className="flex items-center gap-2">
                          <span className="relative flex h-2 w-2">
                            {isError ? (
                              <>
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500 animate-pulse"></span>
                              </>
                            ) : (
                              <>
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                              </>
                            )}
                          </span>
                          <span>
                            {isDashboardLoading ? (
                              "Loading workspace snapshot..."
                            ) : isError ? (
                              <span className="text-red-400 font-medium">Failed to load dashboard data. Please try again.</span>
                            ) : (
                              <>
                                Workspace Status: <span className="text-foreground font-medium">{urgentCount} urgent</span> • <span className="text-foreground font-medium">{replyCount} replies</span> • <span className="text-foreground font-medium">{queuedCount} queued</span>
                              </>
                            )}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <button
                            onClick={handleToggleDashboard}
                            className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-4 cursor-pointer font-medium transition-colors"
                          >
                            View snapshot
                          </button>
                          <button
                            onClick={handleToggleDashboard}
                            className="p-1 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded transition-colors cursor-pointer"
                          >
                            <ChevronDown className="size-3.5" />
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex size-full flex-col items-center">
            <Conversation className="w-full flex-1">
              <ConversationContent className="w-full max-w-[54rem] mx-auto flex flex-col gap-6 px-4 sm:px-6 pt-10 lg:pt-14 pb-48">
                {messages.map((message: any) => {
                  const isAssistant = message.role === "assistant";
                  const messageParts = Array.isArray(message.parts) ? message.parts : [];
                  const rawText =
                    messageParts
                      .filter((p: any) => p.type === "text")
                      .map((p: any) => p.text)
                      .join("\n") ||
                    message.content ||
                    "";

                  const text = message.role === "user"
                    ? rawText.replace(/(?:\n\n)?--- File: .*? ---\n[\s\S]*?\n--- End of .*? ---/g, "").trim()
                    : rawText;


                  const timeline = buildChainOfThoughtTimeline(message);
                  const hasTimeline = timeline.length > 0;

                  const isLastMessage = messages[messages.length - 1]?.id === message.id;

                  // Show shimmer if assistant is active but we have no content or activities at all yet
                  const showShimmer =
                    isAssistant && isLoading && isLastMessage && !hasTimeline && text.trim() === "";

                  return (
                    <Message
                      from={message.role}
                      key={message.id}
                      className={cn(
                        message.role === "user" ? "w-fit ml-auto max-w-[50%]" : "max-w-full w-full"
                      )}
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
                            {/* 1. Chain of Thought Component */}
                            {hasTimeline && (
                              <ChainOfThought defaultOpen={true}>
                                <ChainOfThoughtHeader className="text-xs uppercase tracking-wider font-semibold py-1">
                                  {timeline.filter(t => t.status === "active").length === 0
                                    ? `${timeline.length} ${timeline.length === 1 ? "action" : "actions"} taken`
                                    : `${timeline.length} ${timeline.length === 1 ? "step" : "steps"} in progress`}
                                </ChainOfThoughtHeader>
                                <ChainOfThoughtContent className="mt-1.5 space-y-0">
                                  {timeline.map((item, idx) => {
                                    if (item.type === "thinking") {
                                      return (
                                        <ChainOfThoughtStep
                                          key={item.id}
                                          icon={BrainIcon}
                                          label="Thinking"
                                          status={item.status}
                                        >
                                          {item.text && (
                                            <div className="text-[12px] text-muted-foreground/90 pl-2 leading-relaxed whitespace-pre-line border-l border-border/40 ml-[7.5px] py-1">
                                              {item.text}
                                            </div>
                                          )}
                                        </ChainOfThoughtStep>
                                      );
                                    }

                                    const Icon = item.agent
                                      ? getAgentIcon(item.agent)
                                      : getToolIcon(item.tool || "", item.result);

                                    const label = getToolLabel(item.tool || "", item.args, item.result) || item.action || `Running: ${item.tool}`;
                                    const description = getToolDescription(item.tool || "", item.args, item.result);

                                    let agentDisplay = item.agent;
                                    if (!agentDisplay && item.tool) {
                                      if (item.tool.includes("task") || item.tool.includes("org") || item.tool.includes("workspace")) {
                                        agentDisplay = "Task Manager";
                                      } else if (item.tool.includes("chat") || item.tool.includes("message") || item.tool.includes("channel")) {
                                        agentDisplay = "Chat";
                                      } else if (item.tool.includes("motion") || item.tool.includes("page") || item.tool.includes("note")) {
                                        agentDisplay = "Notes";
                                      } else if (item.tool.includes("schedule") || item.tool.includes("calendar")) {
                                        agentDisplay = "Scheduler";
                                      } else if (item.tool.includes("github")) {
                                        agentDisplay = "GitHub";
                                      } else {
                                        agentDisplay = "KeilHQ AI";
                                      }
                                    }
                                    if (!agentDisplay) agentDisplay = "KeilHQ AI";

                                    if (agentDisplay === "keilhq-task-agent") agentDisplay = "Task Manager";
                                    if (agentDisplay === "keilhq-chat-agent") agentDisplay = "Chat";
                                    if (agentDisplay === "keilhq-motion-agent") agentDisplay = "Notes";
                                    if (agentDisplay === "keilhq-scheduler-agent") agentDisplay = "Scheduler";
                                    if (agentDisplay === "keilhq-github-agent") agentDisplay = "GitHub";
                                    if (agentDisplay === "keilhq-ai") agentDisplay = "KeilHQ AI";

                                    const status = item.status;

                                    return (
                                      <ChainOfThoughtStep
                                        key={item.id || `act-${idx}`}
                                        icon={Icon}
                                        label={
                                          <span className="font-medium text-foreground text-[13px] flex items-center gap-1.5 flex-wrap">
                                            <span className="text-[10px] text-muted-foreground/80 uppercase font-bold tracking-wider">
                                              {agentDisplay}
                                            </span>
                                            <span className="text-muted-foreground/40 text-[10px]">•</span>
                                            <span>{label}</span>
                                            {item.tool && !item.result && (
                                              <span className="text-[10px] text-muted-foreground/70 font-mono ml-0.5 bg-muted/40 px-1 py-0.5 rounded border border-border/10">
                                                (calling: {item.tool})
                                              </span>
                                            )}
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
                                        {item.result && (
                                          <div className="mt-1 max-w-full text-[11px] bg-muted/40 p-2 rounded-lg border border-border/40 font-mono overflow-auto max-h-36 no-scrollbar leading-relaxed">
                                            {formatToolResult(item.tool || "", item.result)}
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

                            {/* 4. Actions — only shown when streaming is complete and there is text */}
                            {!isLoading && text.trim() !== "" && (
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
                          </div>
                        ) : (
                          <div className="flex flex-col gap-2">
                            {text.trim() !== "" && (
                              <TruncatedMessage text={text} />
                            )}
                            {messageParts.length > 0 && (
                              <div className="flex flex-col gap-1.5 mt-1">
                                {messageParts.map((part: any, idx: number) => {
                                  const isFile = part.type === "file";
                                  if (!isFile) return null;
                                  const isImage = part.mediaType?.startsWith("image/") || part.mimeType?.startsWith("image/");
                                  if (isImage) {
                                    return (
                                      <div key={idx} className="max-w-[320px]">
                                        <img 
                                          src={part.url} 
                                          alt={part.filename || "Attached image"} 
                                          className="max-h-60 object-contain rounded-lg border border-border/40 hover:scale-[1.01] transition-transform cursor-pointer"
                                          onClick={() => window.open(part.url, "_blank")}
                                        />
                                      </div>
                                    );
                                  }
                                  return (
                                    <div key={idx} className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/40 border border-border/30 text-xs max-w-[280px]">
                                      <File className="size-3.5 text-muted-foreground flex-shrink-0" />
                                      <span className="font-medium truncate flex-1">{part.filename}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
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
              </ConversationContent>
              <ConversationScrollButton />
            </Conversation>

            <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center bg-gradient-to-t from-background via-background/95 to-transparent px-4 pb-3 pt-16 sm:px-6">
              <div className="pointer-events-auto w-full max-w-[54rem]">
                <HeroSection
                  isChatStarted
                  onSubmit={handlePromptSubmit}
                  status={status}
                  onStop={stop}
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
        currentThreadId={threadId}
        onSelectThread={handleSelectThread}
        onNewChat={handleNewChat}
      />
    </div>
  );
}

