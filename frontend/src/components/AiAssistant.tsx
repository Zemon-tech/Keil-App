import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import api from "@/lib/api";
import { useAppContext } from "@/contexts/AppContext";
import { useMe } from "@/hooks/api/useMe";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
    Send,
    X,
    Maximize2,
    Minimize2,
    PanelRight,
    Sparkles,
    FileText,
    Languages,
    Search,
    ListChecks,
    BarChart3,
    Minus,
    MessageSquare,
    RotateCcw,
    History,
    Trash2,
} from "lucide-react";

// ─── Types ─────────────────────────────────────────────────────────
type AiMode = "hidden" | "floating" | "sidebar" | "fullscreen";

type ModelSelection = "gemini" | "openrouter" | "local";

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

const FULLSCREEN_SUGGESTIONS: SuggestionCard[] = [
    { icon: Sparkles, label: "What's new in KeilHQ", description: "Latest updates and features", prompt: "What are the latest updates in KeilHQ?" },
    { icon: FileText, label: "Write meeting agenda", description: "Generate structured meeting notes", prompt: "Help me write a meeting agenda." },
    { icon: BarChart3, label: "Analyze PDFs or images", description: "Extract data from documents", prompt: "I want to analyze a document." },
    { icon: ListChecks, label: "Create a task tracker", description: "Organize your work items", prompt: "Help me create a task tracker for my projects." },
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

// ═══════════════════════════════════════════════════════════════════
// ─── MAIN COMPONENT ────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════

export function AiAssistant() {
    const [mode, setMode] = useState<AiMode>("hidden");
    const [threadId, setThreadId] = useState<string>(crypto.randomUUID());
    const [threads, setThreads] = useState<ThreadItem[]>([]);
    const [showThreadList, setShowThreadList] = useState(false);
    const [modelSelection, setModelSelection] = useState<ModelSelection>("gemini");
    const [fabHovered, setFabHovered] = useState(false);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const chatEndRef = useRef<HTMLDivElement>(null);
    const { activeOrgId, activeSpaceId } = useAppContext();
    const { data: me } = useMe();
    const userId = me?.id;

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
                ...(activeOrgId && { orgId: activeOrgId }),
                ...(activeSpaceId && { spaceId: activeSpaceId }),
            },
        }),
    }), [threadId, userId, modelSelection, activeOrgId, activeSpaceId]);

    const { messages, sendMessage, status, setMessages } = useChat({ transport });

    const isStreaming = status === "streaming";
    const isReady = status === "ready";

    // ─── Thread management ─────────────────────────────────────────────
    const fetchThreads = useCallback(async () => {
        try {
            const res = await api.get<{ data: { threads: ThreadItem[] } }>("v1/ai/threads");
            setThreads(res.data.data.threads ?? []);
        } catch {
            // silently fail — threads list is non-critical
        }
    }, []);

    const handleNewChat = useCallback(() => {
        setThreadId(crypto.randomUUID());
        setMessages([]);
        setShowThreadList(false);
    }, [setMessages]);

    const handleSelectThread = useCallback((id: string) => {
        setThreadId(id);
        setMessages([]); // messages will be loaded from memory by the backend
        setShowThreadList(false);
    }, [setMessages]);

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
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, isStreaming]);

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
    const [inputValue, setInputValue] = useState("");

    const handleSend = useCallback(() => {
        const text = inputValue.trim();
        if (!text || isStreaming) return;
        sendMessage({ text });
        setInputValue("");
    }, [inputValue, isStreaming, sendMessage]);

    const handleSuggestionClick = useCallback((prompt: string) => {
        if (isStreaming) return;
        sendMessage({ text: prompt });
    }, [isStreaming, sendMessage]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const cycleModel = useCallback(() => {
        setModelSelection((prev) => {
            const order: ModelSelection[] = ["gemini", "openrouter", "local"];
            const idx = order.indexOf(prev);
            return order[(idx + 1) % order.length];
        });
    }, []);

    const switchMode = (newMode: AiMode) => setMode(newMode);

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

    // ─── Render: Mode Controls ─────────────────────────────────────────
    const renderModeControls = () => (
        <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="size-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60" title="History" onClick={() => setShowThreadList(!showThreadList)}>
                <History className="size-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="size-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60" title="New chat" onClick={handleNewChat}>
                <RotateCcw className="size-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className={cn("size-7 rounded-lg hover:bg-muted/60", mode === "floating" ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground")} title="Floating chat" onClick={() => switchMode("floating")}>
                <MessageSquare className="size-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className={cn("size-7 rounded-lg hover:bg-muted/60", mode === "sidebar" ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground")} title="Sidebar" onClick={() => switchMode("sidebar")}>
                <PanelRight className="size-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className={cn("size-7 rounded-lg hover:bg-muted/60", mode === "fullscreen" ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground")} title="Full screen" onClick={() => switchMode("fullscreen")}>
                <Maximize2 className="size-3.5" />
            </Button>
            <div className="w-px h-4 bg-border/60 mx-1" />
            <Button variant="ghost" size="icon" className="size-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60" title="Minimize" onClick={() => switchMode("hidden")}>
                <Minus className="size-3.5" />
            </Button>
        </div>
    );

    // ─── Render: Header ────────────────────────────────────────────────
    const renderHeader = () => (
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/60 bg-card/90 backdrop-blur-sm shrink-0">
            <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5">
                    <Sparkles className="size-3.5 text-amber-400" />
                    <span className="text-[13px] font-bold text-foreground">KeilHQ AI</span>
                </div>
                <Badge className="bg-emerald-500/10 text-emerald-400 border-none text-[9px] font-bold px-1.5 py-0 hover:bg-emerald-500/20">
                    {isStreaming ? "Thinking" : "Online"}
                </Badge>
            </div>
            {renderModeControls()}
        </div>
    );

    // ─── Render: Input ─────────────────────────────────────────────────
    const renderInput = () => (
        <div className="p-3 border-t border-border/60 bg-card shrink-0">
            <div className="relative flex items-end gap-2 rounded-2xl border border-border bg-muted/40 px-4 py-2 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 transition-all">
                <textarea
                    ref={inputRef}
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Do anything with AI..."
                    rows={1}
                    className="flex-1 resize-none bg-transparent text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none py-0.5 max-h-[120px] min-h-[20px]"
                    style={{ overflow: inputValue.split("\n").length > 3 ? "auto" : "hidden" }}
                />
                <div className="flex items-center gap-2 shrink-0 pb-0.5">
                    <button
                        onClick={cycleModel}
                        className="text-[10px] font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded-md select-none capitalize hover:bg-muted/80 hover:text-foreground transition-colors cursor-pointer"
                        title="Click to switch model"
                    >
                        {modelSelection}
                    </button>
                    <button
                        onClick={handleSend}
                        disabled={!inputValue.trim() || isStreaming}
                        className={cn(
                            "size-7 rounded-full flex items-center justify-center transition-all",
                            inputValue.trim() && !isStreaming
                                ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm shadow-primary/30"
                                : "bg-muted text-muted-foreground cursor-not-allowed"
                        )}
                    >
                        <Send className="size-3.5" />
                    </button>
                </div>
            </div>
        </div>
    );

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
                                <button key={s.label} onClick={() => handleSuggestionClick(s.prompt)} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left hover:bg-muted/60 border border-transparent hover:border-border/60 transition-all group bg-card/80">
                                    <s.icon className="size-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                                    <span className="text-[12px] font-medium text-muted-foreground group-hover:text-foreground transition-colors">{s.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                ) : (
                    messages.map((msg) => (
                        <div key={msg.id} className={cn("flex gap-2.5 ai-message-appear", msg.role === "user" ? "justify-end" : "justify-start")}>
                            {msg.role === "assistant" && (
                                <div className="shrink-0 mt-0.5"><KeilMascot size={28} /></div>
                            )}
                            <div className={cn(
                                "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[12.5px] leading-relaxed",
                                msg.role === "user"
                                    ? "bg-primary text-primary-foreground rounded-br-md"
                                    : "bg-card border border-border text-foreground rounded-bl-md"
                            )}>
                                {msg.parts.map((part, i) => {
                                    if (part.type === "text") {
                                        return part.text.split("\n").map((line, j) => (
                                            <p key={`${i}-${j}`} className={cn(line === "" ? "h-2" : "")}>
                                                {line.split(/(\*\*.*?\*\*)/).map((seg, k) =>
                                                    seg.startsWith("**") && seg.endsWith("**")
                                                        ? <strong key={k} className="font-bold">{seg.slice(2, -2)}</strong>
                                                        : <span key={k}>{seg}</span>
                                                )}
                                            </p>
                                        ));
                                    }
                                    return null;
                                })}
                            </div>
                        </div>
                    ))
                )}
                {isStreaming && messages[messages.length - 1]?.role !== "assistant" && (
                    <div className="flex gap-2.5 items-start ai-message-appear">
                        <div className="shrink-0 mt-0.5"><KeilMascot size={28} /></div>
                        <div className="bg-card border border-border rounded-2xl rounded-bl-md px-4 py-3">
                            <div className="flex gap-1.5">
                                <span className="size-2 rounded-full bg-muted-foreground/60 ai-typing-dot" style={{ animationDelay: "0ms" }} />
                                <span className="size-2 rounded-full bg-muted-foreground/60 ai-typing-dot" style={{ animationDelay: "150ms" }} />
                                <span className="size-2 rounded-full bg-muted-foreground/60 ai-typing-dot" style={{ animationDelay: "300ms" }} />
                            </div>
                        </div>
                    </div>
                )}
                <div ref={chatEndRef} />
            </div>
        </ScrollArea>
    );

    // ─── Render: Fullscreen Content ────────────────────────────────────
    const renderFullscreenContent = () => (
        <div className="flex-1 flex flex-col items-center overflow-y-auto">
            {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center flex-1 w-full max-w-2xl mx-auto px-6">
                    <KeilMascot size={80} className="mb-5 ai-mascot-bounce" />
                    <h2 className="text-2xl font-bold text-foreground mb-8">On call and ready, how can I help?</h2>
                    <div className="w-full max-w-lg">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Get started</span>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            {FULLSCREEN_SUGGESTIONS.map((s) => (
                                <button key={s.label} onClick={() => handleSuggestionClick(s.prompt)} className="flex items-start gap-3 p-4 rounded-2xl text-left bg-card border border-border hover:border-border/80 hover:shadow-md transition-all group">
                                    <s.icon className="size-5 text-muted-foreground group-hover:text-primary transition-colors shrink-0 mt-0.5" />
                                    <div>
                                        <span className="text-[13px] font-bold text-foreground group-hover:text-primary transition-colors block">{s.label}</span>
                                        {s.description && <span className="text-[11px] text-muted-foreground mt-0.5 block">{s.description}</span>}
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            ) : (
                <div className="w-full max-w-2xl mx-auto px-6 py-6 space-y-4 flex-1">
                    {messages.map((msg) => (
                        <div key={msg.id} className={cn("flex gap-3 ai-message-appear", msg.role === "user" ? "justify-end" : "justify-start")}>
                            {msg.role === "assistant" && <div className="shrink-0 mt-0.5"><KeilMascot size={32} /></div>}
                            <div className={cn(
                                "max-w-[75%] rounded-2xl px-4 py-3 text-[13.5px] leading-relaxed",
                                msg.role === "user" ? "bg-primary text-primary-foreground rounded-br-md" : "bg-card border border-border text-foreground rounded-bl-md shadow-sm"
                            )}>
                                {msg.parts.map((part, i) => {
                                    if (part.type === "text") {
                                        return part.text.split("\n").map((line, j) => (
                                            <p key={`${i}-${j}`} className={cn(line === "" ? "h-2" : "")}>
                                                {line.split(/(\*\*.*?\*\*)/).map((seg, k) =>
                                                    seg.startsWith("**") && seg.endsWith("**")
                                                        ? <strong key={k} className="font-bold">{seg.slice(2, -2)}</strong>
                                                        : <span key={k}>{seg}</span>
                                                )}
                                            </p>
                                        ));
                                    }
                                    return null;
                                })}
                            </div>
                        </div>
                    ))}
                    {isStreaming && messages[messages.length - 1]?.role !== "assistant" && (
                        <div className="flex gap-3 items-start ai-message-appear">
                            <div className="shrink-0 mt-0.5"><KeilMascot size={32} /></div>
                            <div className="bg-card border border-border rounded-2xl rounded-bl-md px-4 py-3 shadow-sm">
                                <div className="flex gap-1.5">
                                    <span className="size-2 rounded-full bg-muted-foreground/60 ai-typing-dot" style={{ animationDelay: "0ms" }} />
                                    <span className="size-2 rounded-full bg-muted-foreground/60 ai-typing-dot" style={{ animationDelay: "150ms" }} />
                                    <span className="size-2 rounded-full bg-muted-foreground/60 ai-typing-dot" style={{ animationDelay: "300ms" }} />
                                </div>
                            </div>
                        </div>
                    )}
                    <div ref={chatEndRef} />
                </div>
            )}
        </div>
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

            {/* ─── FULLSCREEN ────────────────────────────────────────── */}
            {mode === "fullscreen" && (
                <div className="fixed inset-0 z-50 bg-background flex flex-col ai-fullscreen-appear">
                    <div className="flex items-center justify-between px-6 py-3 border-b border-border/60 bg-card/90 backdrop-blur-sm shrink-0">
                        <div className="flex items-center gap-3">
                            <Button variant="ghost" size="icon" className="size-7" title="History" onClick={() => setShowThreadList(!showThreadList)}>
                                <History className="size-4 text-muted-foreground" />
                            </Button>
                            <Button variant="ghost" size="icon" className="size-7" title="New chat" onClick={handleNewChat}>
                                <RotateCcw className="size-4 text-muted-foreground" />
                            </Button>
                        </div>
                        <div className="flex items-center gap-2">
                            <Sparkles className="size-3.5 text-amber-400" />
                            <span className="text-[13px] font-bold text-foreground">KeilHQ AI</span>
                            <Badge className="bg-emerald-500/10 text-emerald-400 border-none text-[9px] font-bold px-1.5 py-0 hover:bg-emerald-500/20">
                                {isStreaming ? "Thinking" : "Online"}
                            </Badge>
                        </div>
                        <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" className="size-7" title="Sidebar mode" onClick={() => switchMode("sidebar")}>
                                <PanelRight className="size-3.5 text-muted-foreground" />
                            </Button>
                            <Button variant="ghost" size="icon" className="size-7" title="Minimize" onClick={() => switchMode("floating")}>
                                <Minimize2 className="size-3.5 text-muted-foreground" />
                            </Button>
                            <div className="w-px h-4 bg-border/60 mx-1" />
                            <Button variant="ghost" size="icon" className="size-7" title="Close" onClick={() => switchMode("hidden")}>
                                <X className="size-3.5 text-muted-foreground" />
                            </Button>
                        </div>
                    </div>
                    {showThreadList && (
                        <div className="absolute top-14 left-0 bottom-0 w-[280px] z-10 bg-card border-r border-border shadow-lg">
                            {renderThreadList()}
                        </div>
                    )}
                    {renderFullscreenContent()}
                    <div className="shrink-0 flex justify-center pb-8 pt-2 px-6">
                        <div className="w-full max-w-2xl">
                            <div className="relative flex items-end gap-2 rounded-2xl border border-border bg-muted/40 px-4 py-3 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 transition-all">
                                <textarea
                                    ref={inputRef}
                                    value={inputValue}
                                    onChange={(e) => setInputValue(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    placeholder="Do anything with AI..."
                                    rows={1}
                                    className="flex-1 resize-none bg-transparent text-[14px] text-foreground placeholder:text-muted-foreground focus:outline-none py-0.5 max-h-[120px] min-h-[20px]"
                                    style={{ overflow: inputValue.split("\n").length > 3 ? "auto" : "hidden" }}
                                />
                                <div className="flex items-center gap-2 shrink-0 pb-0.5">
                                    <button
                                        onClick={cycleModel}
                                        className="text-[10px] font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded-md select-none capitalize hover:bg-muted/80 hover:text-foreground transition-colors cursor-pointer"
                                        title="Click to switch model"
                                    >
                                        {modelSelection}
                                    </button>
                                    <button
                                        onClick={handleSend}
                                        disabled={!inputValue.trim() || isStreaming}
                                        className={cn(
                                            "size-8 rounded-full flex items-center justify-center transition-all",
                                            inputValue.trim() && isReady
                                                ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm shadow-primary/30"
                                                : "bg-muted text-muted-foreground cursor-not-allowed"
                                        )}
                                    >
                                        <Send className="size-4" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
