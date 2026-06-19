import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import api from "@/lib/api";
import { useAppContext } from "@/contexts/AppContext";
import { useMe } from "@/hooks/api/useMe";
import { useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getToolActivity, extractToolInvocations } from "@/lib/agent-activity";
import { extractStreamingActivities, buildChainOfThoughtTimeline } from "@/lib/activity-stream";
import { uploadChatAttachment } from "@/lib/s3-upload";

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
    PromptInput,
    PromptInputBody,
    PromptInputTextarea,
    PromptInputProvider,
    PromptInputFooter,
    PromptInputTools,
    PromptInputButton,
    PromptInputSubmit,
    PromptInputActionMenu,
    PromptInputActionMenuTrigger,
    PromptInputActionMenuContent,
    PromptInputActionAddAttachments,
    PromptInputHeader,
    type PromptInputMessage,
} from "@/components/ai-elements/prompt-input";
import {
    ChainOfThought,
    ChainOfThoughtHeader,
    ChainOfThoughtContent,
    ChainOfThoughtStep,
} from "@/components/ai-elements/chain-of-thought";
import { Shimmer } from "@/components/ai-elements/shimmer";
import {
    Attachment,
    AttachmentInfo,
    AttachmentPreview,
    AttachmentRemove,
    Attachments,
} from "@/components/ai-elements/attachments";
import { usePromptInputAttachments } from "@/components/ai-elements/prompt-input-context";
import {
    X,
    PanelRight,
    Sparkles,
    FileText,
    Languages,
    Search,
    ListChecks,
    MessageSquare,
    RotateCcw,
    History,
    Trash2,
    Calendar,
    Github,
    Bot,
    Globe,
    Camera,
    ListTodo,
    Inbox,
    Layout,
    File,
    FilePlus,
    MessageSquareCode,
    MessageCircle,
    Building,
    GitPullRequest,
    Users,
    GitBranch,
    PlusCircle,
    FilePenLine,
    Clock,
    BrainIcon,
} from "lucide-react";

// ─── Types ─────────────────────────────────────────────────────────
type AiMode = "hidden" | "floating" | "sidebar";

type ModelSelection = "gemini" | "github" | "github-models" | "openrouter" | "local";

interface ThreadItem {
    id: string;
    title: string | null;
    createdAt: string;
}

interface SuggestionCard {
    icon: React.ElementType;
    label: string;
    description?: string;
    prompt: string;
}

// ─── Constants ─────────────────────────────────────────────────────
const API_BASE = (import.meta.env.VITE_API_URL || "http://localhost:5001/api").replace(/\/$/, "");
const CHAT_API = API_BASE.replace(/\/api\/?$/, "") + "/chat";

const QUICK_SUGGESTIONS: SuggestionCard[] = [
    { icon: FileText, label: "Summarize this page", prompt: "Summarize the current page content for me." },
    { icon: Languages, label: "Translate this page", prompt: "Translate the current page content." },
    { icon: Search, label: "Analyze for insights", prompt: "Analyze the current data and provide key insights." },
    { icon: ListChecks, label: "Create a task tracker", prompt: "Create a task tracker from the current context." },
];
// ─── Mascot SVG ────────────────────────────────────────────────────
const KeilMascot = ({ size = 48, className }: { size?: number; className?: string }) => (
    <svg width={size} height={size} viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
        <circle cx="60" cy="65" r="38" fill="#E8E0D8" />
        <circle cx="60" cy="68" r="30" fill="#F5F0EB" />
        <ellipse cx="48" cy="64" rx="4" ry="5" fill="#1a1a2e" />
        <circle cx="46.5" cy="62.5" r="1.5" fill="white" />
        <ellipse cx="72" cy="64" rx="4" ry="5" fill="#1a1a2e" />
        <circle cx="70.5" cy="62.5" r="1.5" fill="white" />
        <ellipse cx="60" cy="72" rx="3" ry="2" fill="#C4A882" />
        <path d="M54 76 Q60 80 66 76" stroke="#1a1a2e" strokeWidth="1.5" fill="none" strokeLinecap="round" />
        <path d="M30 52 Q30 28 60 25 Q90 28 90 52 L85 55 L35 55 Z" fill="#E63946" />
        <rect x="35" y="52" rx="2" width="50" height="6" fill="#C1272D" />
        <circle cx="60" cy="40" r="6" fill="#FF8C42" />
        <circle cx="60" cy="40" r="3.5" fill="#FFD166" />
        <circle cx="60" cy="40" r="1.5" fill="#E63946" />
        <ellipse cx="28" cy="58" rx="8" ry="10" fill="#E8E0D8" />
        <ellipse cx="28" cy="58" rx="5" ry="7" fill="#F5C6C0" />
        <ellipse cx="92" cy="58" rx="8" ry="10" fill="#E8E0D8" />
        <ellipse cx="92" cy="58" rx="5" ry="7" fill="#F5C6C0" />
    </svg>
);

// ─── Helper: get auth token ────────────────────────────────────────
async function getAuthToken(): Promise<string | null> {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ?? null;
}

// ─── Helper: get icon for agent ────────────────────────────────────
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

// ─── Helper: get icon for tool ─────────────────────────────────────
const getToolIcon = (toolName: string, result?: any) => {
    const iconHint = result?.activity?.icon;
    if (iconHint) {
        switch (iconHint) {
            case "search": return Search;
            case "list": return ListTodo;
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

// ─── Helper: get tool label ────────────────────────────────────────
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

// ─── Helper: get tool description ──────────────────────────────────
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

// ─── Helper: format tool result ────────────────────────────────────
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

// ─── Prompt Input Attachments Display ──────────────────────────────
const PromptInputAttachmentsDisplay = () => {
    const attachments = usePromptInputAttachments();

    if (attachments.files.length === 0) {
        return null;
    }

    return (
        <Attachments variant="inline" className="w-full gap-1.5 px-1 py-1 max-h-24 overflow-y-auto">
            {attachments.files.map((attachment) => (
                <Attachment
                    key={attachment.id}
                    className="h-8 rounded-lg border border-border/65 bg-muted/40 pr-1 shadow-sm text-[11px] gap-1"
                    data={attachment}
                    onRemove={() => attachments.remove(attachment.id)}
                >
                    <AttachmentPreview className="size-5 rounded bg-background/80" />
                    <AttachmentInfo className="text-[11px]" />
                    <AttachmentRemove className="size-5 opacity-100 [&>svg]:size-2.5 p-0" />
                </Attachment>
            ))}
        </Attachments>
    );
};

// ─── Main Component ────────────────────────────────────────────────
export function AiAssistant() {
    const [mode, setMode] = useState<AiMode>("hidden");
    const [threadId, setThreadId] = useState<string>(crypto.randomUUID());
    const [threads, setThreads] = useState<ThreadItem[]>([]);
    const [showThreadList, setShowThreadList] = useState(false);
    const [liked, setLiked] = useState<Record<string, boolean>>({});
    const [disliked, setDisliked] = useState<Record<string, boolean>>({});
    const [modelSelection, setModelSelection] = useState<ModelSelection>(() => {
        return (localStorage.getItem("ai_model_selection") as ModelSelection) || "gemini";
    });

    useEffect(() => {
        const handleStorageChange = () => {
            const saved = localStorage.getItem("ai_model_selection");
            if (saved) {
                setModelSelection(saved as ModelSelection);
            }
        };
        window.addEventListener("storage", handleStorageChange);
        window.addEventListener("ai_model_selection_changed", handleStorageChange);
        return () => {
            window.removeEventListener("storage", handleStorageChange);
            window.removeEventListener("ai_model_selection_changed", handleStorageChange);
        };
    }, []);

    const [fabHovered, setFabHovered] = useState(false);
    const [isUploadingFiles, setIsUploadingFiles] = useState(false);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const chatEndRef = useRef<HTMLDivElement>(null);
    const { activeOrgId, activeSpaceId } = useAppContext();
    const { data: me } = useMe();
    const userId = me?.id;

    // ─── Page Context Detection ────────────────────────────────────────────
    // NOTE: AiAssistant lives in Layout (parent of all routes), so useParams()
    // never captures child-route params. We parse them directly from pathname.
    const location = useLocation();
    const pageContext = useMemo(() => {
        const pathname = location.pathname;

        // /tasks/:taskId
        const taskDetailMatch = pathname.match(/^\/tasks\/([^/]+)$/);
        if (taskDetailMatch) {
            return `The user has a specific task open (task ID: ${taskDetailMatch[1]}).`;
        }
        if (pathname === "/tasks") {
            return `The user is on the Tasks page.`;
        }
        if (pathname === "/my-tasks") {
            return `The user is viewing their personal task list.`;
        }

        // /events/:eventId
        const eventDetailMatch = pathname.match(/^\/events\/([^/]+)$/);
        if (eventDetailMatch) {
            return `The user has a specific calendar event open (event ID: ${eventDetailMatch[1]}).`;
        }
        if (pathname === "/events" || pathname === "/schedule") {
            return `The user is on the Calendar/Schedule page.`;
        }

        // /motion/:pageId (skip /motion/profile)
        const motionPageMatch = pathname.match(/^\/motion\/([^/]+)$/);
        if (motionPageMatch && motionPageMatch[1] !== "profile") {
            return `The user has a Motion/Notes page open (page ID: ${motionPageMatch[1]}). When creating new content, first create the page, navigate to it, then add content.`;
        }
        if (pathname === "/motion") {
            return `The user is on the Motion/Notes page list.`;
        }

        if (pathname === "/meetings" || pathname.startsWith("/meetings/")) {
            return `The user is on the Meetings page.`;
        }

        if (pathname === "/" || pathname.startsWith("/c/")) {
            return `The user is on the Dashboard/AI Chat page.`;
        }

        return null;
    }, [location.pathname]);

    // ─── AI SDK useChat with streaming ─────────────────────────────────
    const transport = useMemo(() => new DefaultChatTransport({
        api: CHAT_API,
        headers: async (): Promise<Record<string, string>> => {
            const token = await getAuthToken();
            if (token) return { Authorization: `Bearer ${token}` };
            return {};
        },
        prepareSendMessagesRequest: ({ messages: msgs }) => ({
            body: {
                messages: [msgs[msgs.length - 1]],
                memory: { thread: threadId, resource: userId },
                modelSelection,
                ...(modelSelection === "local" && {
                    localAiBaseUrl: localStorage.getItem("local_ai_base_url") || "http://localhost:8080/v1",
                    localAiModel: localStorage.getItem("local_ai_model") || "gemma-4",
                }),
                ...(modelSelection === "openrouter" && {
                    openRouterModel: localStorage.getItem("openrouter_model") || "openai/gpt-4o-mini",
                }),
                ...(activeOrgId && { orgId: activeOrgId }),
                ...(activeSpaceId && { spaceId: activeSpaceId }),
                ...(pageContext && { pageContext }),
            },
        }),
    }), [threadId, userId, modelSelection, activeOrgId, activeSpaceId, pageContext]);

    const { messages, sendMessage, status, setMessages } = useChat({ transport });

    const isStreaming = status === "streaming";
    const isLoading = status === "submitted" || status === "streaming" || isUploadingFiles;

    const isAssistantThinking =
        isLoading && messages[messages.length - 1]?.role === "user";

    const assistantLoadingText = useMemo(() => {
        return [
            "Fetching the output",
            "Be ready",
            "Forging a response",
        ][messages.length % 3] || "Forging a response";
    }, [messages.length]);

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

    // ─── Thread management ─────────────────────────────────────────────
    const fetchThreads = useCallback(async () => {
        try {
            const res = await api.get<{ data: { threads: ThreadItem[] } }>("v1/ai/threads");
            setThreads(res.data.data.threads ?? []);
        } catch {
            // silently fail
        }
    }, []);

    const handleNewChat = useCallback(() => {
        setThreadId(crypto.randomUUID());
        setMessages([]);
        setShowThreadList(false);
    }, [setMessages]);

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
            parts: msg.parts || (msg.content && typeof msg.content === "object" ? msg.content.parts : undefined),
            toolInvocations: msg.toolInvocations,
            createdAt: msg.createdAt ? new Date(msg.createdAt) : undefined,
        };
    }, []);

    const handleSelectThread = useCallback(async (id: string) => {
        setThreadId(id);
        setShowThreadList(false);
        try {
            const res = await api.get(`v1/ai/threads/${id}/messages`);
            const rawMessages = res.data.data.messages || [];
            const mapped = rawMessages
                .filter((m: any) => m.role === "user" || m.role === "assistant")
                .map(mapMastraMessageToFrontend);
            setMessages(mapped);
        } catch (error) {
            console.error("Failed to load selected thread:", error);
        }
    }, [setMessages, mapMastraMessageToFrontend]);

    const handleDeleteThread = useCallback(async (id: string) => {
        try {
            await api.delete(`v1/ai/threads/${id}`);
            setThreads((prev) => prev.filter((t) => t.id !== id));
            if (id === threadId) handleNewChat();
        } catch {
            // silently fail
        }
    }, [threadId, handleNewChat]);

    // ─── Effects ───────────────────────────────────────────────────────
    // Only scroll when a NEW message appears (ID change), not on every
    // streaming chunk — avoids continuous scroll animation cancellation.
    const lastMessageId = messages[messages.length - 1]?.id;
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [lastMessageId]);

    useEffect(() => {
        if (mode !== "hidden") {
            const t = setTimeout(() => inputRef.current?.focus(), 300);
            return () => clearTimeout(t);
        }
    }, [mode]);

    useEffect(() => {
        if (showThreadList) fetchThreads();
    }, [showThreadList, fetchThreads]);

    // Keyboard shortcuts
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === "Escape" && mode !== "hidden") setMode("hidden");
            if (e.key === "j" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                setMode((prev) => (prev === "hidden" ? "floating" : "hidden"));
            }
        };
        document.addEventListener("keydown", handler);
        return () => document.removeEventListener("keydown", handler);
    }, [mode]);

    // Sidebar body class
    useEffect(() => {
        const body = document.body;
        if (mode === "sidebar") body.classList.add("ai-sidebar-open");
        else body.classList.remove("ai-sidebar-open");
        return () => { body.classList.remove("ai-sidebar-open"); };
    }, [mode]);

    // ─── Handlers ──────────────────────────────────────────────────────
    const handleToggleLike = useCallback((key: string) => {
        setLiked((prev) => {
            const isCurrentlyLiked = prev[key] ?? false;
            if (!isCurrentlyLiked) setDisliked((d) => ({ ...d, [key]: false }));
            return { ...prev, [key]: !isCurrentlyLiked };
        });
    }, []);

    const handleToggleDislike = useCallback((key: string) => {
        setDisliked((prev) => {
            const isCurrentlyDisliked = prev[key] ?? false;
            if (!isCurrentlyDisliked) setLiked((l) => ({ ...l, [key]: false }));
            return { ...prev, [key]: !isCurrentlyDisliked };
        });
    }, []);

    const handlePromptSubmit = useCallback(async (message: PromptInputMessage) => {
        if (isStreaming || isUploadingFiles) return;

        try {
            let text = message.text.trim();
            let uploadedFiles: any[] = [];

            if (message.files && message.files.length > 0) {
                setIsUploadingFiles(true);

                const textFiles = message.files.filter(f => 
                    f.mediaType?.startsWith('text/') || 
                    f.filename.match(/\.(md|txt|json|csv|log)$/i)
                );
                
                const otherFiles = message.files.filter(f => 
                    !(f.mediaType?.startsWith('text/') || 
                    f.filename.match(/\.(md|txt|json|csv|log)$/i))
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
                        id: f.id || crypto.randomUUID(),
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

            sendMessage({ text: content, files: uploadedFiles });
        } catch (error) {
            console.error("Failed to upload chat attachments to S3:", error);
        } finally {
            setIsUploadingFiles(false);
        }
    }, [isStreaming, isUploadingFiles, sendMessage]);

    const handleSuggestionClick = useCallback((prompt: string) => {
        if (isStreaming) return;
        sendMessage({ text: prompt });
    }, [isStreaming, sendMessage]);

    const switchMode = (newMode: AiMode) => setMode(newMode);

    // ─── Render: Chain of Thought Display ──────────────────────────────
    const renderToolInvocations = (msg: any) => {
        const timeline = buildChainOfThoughtTimeline(msg);

        if (timeline.length === 0) return null;

        const activeStepsCount = timeline.filter(t => t.status === "active").length;
        const totalStepsCount = timeline.length;

        return (
            <ChainOfThought defaultOpen={true} className="mt-2 border-t border-border/40 pt-2 shrink-0">
                <ChainOfThoughtHeader className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider py-1 hover:text-foreground">
                    {activeStepsCount === 0
                        ? `${totalStepsCount} ${totalStepsCount === 1 ? "action" : "actions"} taken`
                        : `${totalStepsCount} ${totalStepsCount === 1 ? "step" : "steps"} in progress`}
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
                                        <div className="text-[11px] text-muted-foreground/90 pl-2 leading-relaxed whitespace-pre-line border-l border-border/40 ml-[7.5px] py-1">
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
                                    <span className="font-semibold text-foreground text-[11px] flex items-center gap-1.5 flex-wrap">
                                        <span className="text-[9px] text-muted-foreground/80 uppercase font-bold tracking-wider">
                                            {agentDisplay}
                                        </span>
                                        <span className="text-muted-foreground/45 text-[9px]">•</span>
                                        <span>{label}</span>
                                        {item.tool && !item.result && (
                                            <span className="text-[9px] text-muted-foreground/70 font-mono ml-0.5 bg-muted/40 px-1 py-0.5 rounded border border-border/10">
                                                (calling: {item.tool})
                                            </span>
                                        )}
                                    </span>
                                }
                                description={
                                    description && (
                                        <span className="text-muted-foreground text-[10px] block mt-0.5 font-normal">
                                            {description}
                                        </span>
                                    )
                                }
                                status={status}
                            >
                                {item.result && (
                                    <div className="mt-1 max-w-full text-[10px] bg-muted/40 p-2 rounded-lg border border-border/40 font-mono overflow-auto max-h-24 no-scrollbar leading-relaxed">
                                        {formatToolResult(item.tool || "", item.result)}
                                    </div>
                                )}
                            </ChainOfThoughtStep>
                        );
                    })}
                </ChainOfThoughtContent>
            </ChainOfThought>
        );
    };

    // ─── Render: Thread List ───────────────────────────────────────────
    const renderThreadList = () => (
        <div className="absolute inset-0 z-10 bg-card flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/60">
                <span className="text-[13px] font-bold text-foreground">Conversations</span>
                <Button variant="ghost" size="icon" className="size-7" onClick={() => setShowThreadList(false)}>
                    <X className="size-3.5" />
                </Button>
            </div>
            <ScrollArea className="flex-1">
                <div className="p-2 space-y-1">
                    {threads.length === 0 && (
                        <p className="text-[12px] text-muted-foreground text-center py-8">No past conversations</p>
                    )}
                    {threads.map((t) => (
                        <div key={t.id} className={cn(
                            "flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer group hover:bg-muted/60 transition-colors",
                            t.id === threadId && "bg-primary/10"
                        )}>
                            <button className="flex-1 text-left" onClick={() => handleSelectThread(t.id)}>
                                <span className="text-[12px] font-medium text-foreground line-clamp-1">
                                    {t.title || "Untitled conversation"}
                                </span>
                                <span className="text-[10px] text-muted-foreground">
                                    {new Date(t.createdAt).toLocaleDateString()}
                                </span>
                            </button>
                            <Button
                                variant="ghost" size="icon"
                                className="size-6 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                                onClick={(e) => { e.stopPropagation(); handleDeleteThread(t.id); }}
                            >
                                <Trash2 className="size-3" />
                            </Button>
                        </div>
                    ))}
                </div>
            </ScrollArea>
            <div className="p-3 border-t border-border/60">
                <Button variant="outline" size="sm" className="w-full text-[12px]" onClick={handleNewChat}>
                    <RotateCcw className="size-3 mr-1.5" /> New conversation
                </Button>
            </div>
        </div>
    );

    // ─── Render: Header ────────────────────────────────────────────────
    const renderHeader = () => (
        <div className="flex items-center justify-between px-3 py-2 border-b border-border/40 bg-card/95 backdrop-blur-sm shrink-0">
            {/* Left: Icon + Title + Status */}
            <div className="flex items-center gap-2">
                <div className="flex items-center justify-center size-6 rounded-md bg-primary/10">
                    <Sparkles className="size-3.5 text-primary" />
                </div>
                <div className="flex flex-col">
                    <span className="text-[12px] font-semibold text-foreground leading-tight">KeilHQ AI</span>
                    {pageContext && (
                        <span className="text-[9px] text-muted-foreground/70 leading-tight truncate max-w-[140px]">{pageContext}</span>
                    )}
                </div>
                <div className={cn(
                    "size-1.5 rounded-full ml-0.5 mt-0.5",
                    isStreaming ? "bg-amber-400 animate-pulse" : "bg-emerald-400"
                )} />
            </div>
            {/* Right: Controls */}
            <div className="flex items-center gap-0.5">
                <Button variant="ghost" size="icon" className="size-6 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60" title="History" onClick={() => setShowThreadList(!showThreadList)}>
                    <History className="size-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="size-6 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60" title="New chat" onClick={handleNewChat}>
                    <RotateCcw className="size-3.5" />
                </Button>
                <div className="w-px h-3 bg-border/60 mx-0.5" />
                <Button variant="ghost" size="icon" className={cn("size-6 rounded-md hover:bg-muted/60", mode === "floating" ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground")} title="Floating" onClick={() => switchMode("floating")}>
                    <MessageSquare className="size-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className={cn("size-6 rounded-md hover:bg-muted/60", mode === "sidebar" ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground")} title="Sidebar" onClick={() => switchMode("sidebar")}>
                    <PanelRight className="size-3.5" />
                </Button>
                <div className="w-px h-3 bg-border/60 mx-0.5" />
                <Button variant="ghost" size="icon" className="size-6 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60" title="Close" onClick={() => switchMode("hidden")}>
                    <X className="size-3.5" />
                </Button>
            </div>
        </div>
    );

    // ─── Render: Input ─────────────────────────────────────────────────
    const renderInput = () => {
        return (
            <div className="border-t border-border/40 bg-card shrink-0">
                <PromptInputProvider>
                    <PromptInput
                        globalDrop
                        multiple
                        onSubmit={handlePromptSubmit}
                        className={cn(
                            "w-full bg-transparent overflow-visible",
                            "[&_[data-slot=input-group]]:relative [&_[data-slot=input-group]]:overflow-visible",
                            "[&_[data-slot=input-group]]:rounded-none [&_[data-slot=input-group]]:border-none",
                            "[&_[data-slot=input-group]]:bg-transparent",
                            "[&_[data-slot=input-group]]:px-3 [&_[data-slot=input-group]]:py-2",
                            "[&_[data-slot=input-group]]:flex [&_[data-slot=input-group]]:flex-col [&_[data-slot=input-group]]:items-stretch [&_[data-slot=input-group]]:gap-1.5",
                            "transition-all"
                        )}
                    >
                        <PromptInputHeader className="p-0 border-none">
                            <PromptInputAttachmentsDisplay />
                        </PromptInputHeader>
                        <PromptInputBody>
                            <PromptInputTextarea
                                placeholder="Ask anything..."
                                className="w-full resize-none bg-transparent text-[12.5px] text-foreground placeholder:text-muted-foreground/50 focus-visible:ring-0 p-0 border-none min-h-[36px] max-h-[100px]"
                            />
                        </PromptInputBody>
                        <PromptInputFooter className="border-t border-border/30 pt-1.5 mt-0">
                            <PromptInputTools>
                                <PromptInputActionMenu>
                                    <PromptInputActionMenuTrigger />
                                    <PromptInputActionMenuContent>
                                        <PromptInputActionAddAttachments />
                                        <DropdownMenuItem onSelect={(e) => { e.preventDefault(); alert("Screenshot feature is coming soon!"); }}>
                                            <Camera className="mr-2 size-4" /> Add screenshot
                                        </DropdownMenuItem>
                                    </PromptInputActionMenuContent>
                                </PromptInputActionMenu>
                                <PromptInputButton>
                                    <Globe size={14} />
                                    <span>Search</span>
                                </PromptInputButton>
                            </PromptInputTools>
                            <PromptInputSubmit status={isStreaming ? "streaming" : "ready"} />
                        </PromptInputFooter>
                    </PromptInput>
                </PromptInputProvider>
            </div>
        );
    };

    // ─── Render: Messages ──────────────────────────────────────────────
    const renderMessages = () => (
        <ScrollArea className="flex-1 overflow-y-auto">
            <div className="p-4 space-y-4">
                {messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8">
                        <KeilMascot size={64} className="mb-4 ai-mascot-bounce" />
                        <h3 className="text-sm font-bold text-foreground mb-1">On call and ready, how can I help?</h3>
                        <div className="w-full space-y-1.5 mt-4">
                            {QUICK_SUGGESTIONS.map((s) => (
                                <button key={s.label} onClick={() => handleSuggestionClick(s.prompt)} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left hover:bg-muted/65 border border-transparent hover:border-border/60 transition-all group bg-card/80">
                                    <s.icon className="size-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                                    <span className="text-[12px] font-medium text-muted-foreground group-hover:text-foreground transition-colors">{s.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                ) : (
                    messages.map((msg: any) => {
                        const isAssistant = msg.role === "assistant";
                        const messageParts = Array.isArray(msg.parts) ? msg.parts : [];
                        const rawText =
                            messageParts
                                ?.filter((p: any) => p.type === "text")
                                ?.map((p: any) => p.text)
                                ?.join("\n") ||
                            msg.content ||
                            "";

                        const text = msg.role === "user"
                            ? rawText.replace(/(?:\n\n)?--- File: .*? ---\n[\s\S]*?\n--- End of .*? ---/g, "").trim()
                            : rawText;


                        const timeline = buildChainOfThoughtTimeline(msg);
                        const hasTimeline = timeline.length > 0;

                        const isLastMessage = messages[messages.length - 1]?.id === msg.id;

                        // Show shimmer if assistant is active but we have no content or activities at all yet
                        const showShimmer =
                            isAssistant && isLoading && isLastMessage && !hasTimeline && text.trim() === "";

                        return (
                            <div key={msg.id} className={cn("flex gap-2 items-start ai-message-appear", msg.role === "user" ? "justify-end" : "justify-start")}>
                                <Message
                                    from={msg.role}
                                    className={cn(
                                        msg.role === "user" ? "w-fit ml-auto max-w-[50%]" : "max-w-full w-full"
                                    )}
                                >
                                    <MessageContent className={cn(
                                        isAssistant ? "w-full text-[12.5px] leading-relaxed" : "text-[12.5px] px-3 py-2 rounded-xl",
                                        showShimmer && "px-0 py-0"
                                    )}>
                                        {showShimmer ? (
                                            <div className="flex items-center gap-2 py-1.5 text-xs">
                                                <Shimmer className="font-medium" duration={1.6}>
                                                    {loadingText}
                                                </Shimmer>
                                            </div>
                                        ) : isAssistant ? (
                                            <div className="space-y-2.5 w-full">
                                                {/* 1. Chain of Thought / Tools */}
                                                {renderToolInvocations(msg)}

                                                {/* 2. Final Text Response */}
                                                {text.trim() !== "" && (
                                                    <MessageResponse>{text}</MessageResponse>
                                                )}

                                                {/* 4. Message Actions inline */}
                                                {!isLoading && text.trim() !== "" && (
                                                    <MessageActions className="mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                                                        <LikeAction
                                                            isLiked={liked[msg.id] ?? false}
                                                            messageKey={msg.id}
                                                            onToggle={handleToggleLike}
                                                        />
                                                        <DislikeAction
                                                            isDisliked={disliked[msg.id] ?? false}
                                                            messageKey={msg.id}
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
                                                                    <div key={idx} className="max-w-[200px]">
                                                                        <img 
                                                                            src={part.url} 
                                                                            alt={part.filename || "Attached image"} 
                                                                            className="max-h-40 object-contain rounded-lg border border-border/40 hover:scale-[1.01] transition-transform cursor-pointer"
                                                                            onClick={() => window.open(part.url, "_blank")}
                                                                        />
                                                                    </div>
                                                                );
                                                            }
                                                            return (
                                                                <div key={idx} className="flex items-center gap-2 p-2 rounded-lg bg-muted/40 border border-border/30 text-[11px] max-w-[200px]">
                                                                    <File className="size-3 text-muted-foreground flex-shrink-0" />
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
                            </div>
                        );
                    })
                )}
                {isAssistantThinking && (
                    <div className="flex gap-2.5 items-start ai-message-appear w-full">
                        <Message from="assistant" className="max-w-full w-full">
                            <MessageContent className="px-0 py-0">
                                <div className="flex items-center gap-2 py-2 text-[12.5px]">
                                    <Shimmer className="font-medium" duration={1.6}>
                                        {loadingText}
                                    </Shimmer>
                                </div>
                            </MessageContent>
                        </Message>
                    </div>
                )}
                <div ref={chatEndRef} />
            </div>
        </ScrollArea>
    );

    // ═══════════════════════════════════════════════════════════════════
    // ─── RENDER ──────────────────────────────────────────────────────
    // ═══════════════════════════════════════════════════════════════════
    return (
        <>
            {/* ─── FLOATING FAB ──────────────────────────────────────── */}
            {mode === "hidden" && (
                <div className="fixed bottom-6 right-6 z-50">
                    <button
                        onClick={() => switchMode("floating")}
                        onMouseEnter={() => setFabHovered(true)}
                        onMouseLeave={() => setFabHovered(false)}
                        className="group relative ai-fab-appear"
                    >
                        <div className="absolute inset-0 rounded-full bg-gradient-to-r from-primary via-indigo-500 to-violet-500 opacity-0 group-hover:opacity-30 blur-lg transition-opacity duration-500" />
                        <div className="relative size-14 rounded-full bg-card border border-border shadow-xl shadow-black/20 flex items-center justify-center transition-all duration-300 group-hover:scale-110 group-hover:shadow-2xl group-hover:shadow-primary/30 group-active:scale-95">
                            <KeilMascot size={38} className={cn("transition-transform duration-500", fabHovered && "scale-105")} />
                        </div>
                        <div className={cn(
                            "absolute bottom-full right-0 mb-3 px-3 py-1.5 bg-popover text-popover-foreground text-[11px] font-bold rounded-lg whitespace-nowrap border border-border/60 shadow-lg transition-all duration-200 pointer-events-none",
                            fabHovered ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1"
                        )}>
                            KeilHQ AI
                            <kbd className="ml-2 bg-muted text-muted-foreground px-1.5 py-0.5 rounded text-[9px] border border-border/60">⌘J</kbd>
                            <div className="absolute top-full right-5 size-0 border-l-[5px] border-r-[5px] border-t-[5px] border-transparent border-t-popover" />
                        </div>
                    </button>
                </div>
            )}

            {/* ─── FLOATING CHAT POPOVER ─────────────────────────────── */}
            {mode === "floating" && (
                <div className="fixed bottom-6 right-6 z-50 ai-panel-appear">
                    <div className="w-[380px] h-[520px] bg-card rounded-2xl shadow-2xl shadow-black/40 border border-border flex flex-col overflow-hidden relative">
                        {showThreadList && renderThreadList()}
                        {renderHeader()}
                        {renderMessages()}
                        {renderInput()}
                    </div>
                </div>
            )}

            {/* ─── SIDEBAR PANEL ─────────────────────────────────────── */}
            {mode === "sidebar" && (
                <div className="absolute top-0 right-0 bottom-0 z-30 w-[400px] bg-card border-l border-border flex flex-col ai-sidebar-appear shadow-2xl shadow-black/40">
                    {showThreadList && renderThreadList()}
                    {renderHeader()}
                    {renderMessages()}
                    {renderInput()}
                </div>
            )}
        </>
    );
}
