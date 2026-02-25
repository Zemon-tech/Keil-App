import { useState, useRef, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
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
} from "lucide-react";

// ─── Types ─────────────────────────────────────────────────────────
type AiMode = "hidden" | "floating" | "sidebar" | "fullscreen";

interface AiMessage {
    id: string;
    role: "user" | "assistant";
    content: string;
    timestamp: Date;
}

interface SuggestionCard {
    icon: React.ElementType;
    label: string;
    description?: string;
    prompt: string;
}

// ─── Mascot SVG ────────────────────────────────────────────────────
const KeilMascot = ({ size = 48, className }: { size?: number; className?: string }) => (
    <svg
        width={size}
        height={size}
        viewBox="0 0 120 120"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
    >
        {/* Head */}
        <circle cx="60" cy="65" r="38" fill="#E8E0D8" />
        {/* Inner face */}
        <circle cx="60" cy="68" r="30" fill="#F5F0EB" />
        {/* Left eye */}
        <ellipse cx="48" cy="64" rx="4" ry="5" fill="#1a1a2e" />
        <circle cx="46.5" cy="62.5" r="1.5" fill="white" />
        {/* Right eye */}
        <ellipse cx="72" cy="64" rx="4" ry="5" fill="#1a1a2e" />
        <circle cx="70.5" cy="62.5" r="1.5" fill="white" />
        {/* Nose */}
        <ellipse cx="60" cy="72" rx="3" ry="2" fill="#C4A882" />
        {/* Mouth - subtle smile */}
        <path d="M54 76 Q60 80 66 76" stroke="#1a1a2e" strokeWidth="1.5" fill="none" strokeLinecap="round" />
        {/* Hard hat */}
        <path d="M30 52 Q30 28 60 25 Q90 28 90 52 L85 55 L35 55 Z" fill="#E63946" />
        <rect x="35" y="52" rx="2" width="50" height="6" fill="#C1272D" />
        {/* Hat emblem */}
        <circle cx="60" cy="40" r="6" fill="#FF8C42" />
        <circle cx="60" cy="40" r="3.5" fill="#FFD166" />
        <circle cx="60" cy="40" r="1.5" fill="#E63946" />
        {/* Left ear */}
        <ellipse cx="28" cy="58" rx="8" ry="10" fill="#E8E0D8" />
        <ellipse cx="28" cy="58" rx="5" ry="7" fill="#F5C6C0" />
        {/* Right ear */}
        <ellipse cx="92" cy="58" rx="8" ry="10" fill="#E8E0D8" />
        <ellipse cx="92" cy="58" rx="5" ry="7" fill="#F5C6C0" />
    </svg>
);

// ─── Suggestion Data ───────────────────────────────────────────────
const QUICK_SUGGESTIONS: SuggestionCard[] = [
    {
        icon: FileText,
        label: "Summarize this page",
        prompt: "Summarize the current page content for me.",
    },
    {
        icon: Languages,
        label: "Translate this page",
        prompt: "Translate the current page content.",
    },
    {
        icon: Search,
        label: "Analyze for insights",
        prompt: "Analyze the current data and provide key insights.",
    },
    {
        icon: ListChecks,
        label: "Create a task tracker",
        prompt: "Create a task tracker from the current context.",
    },
];

const FULLSCREEN_SUGGESTIONS: SuggestionCard[] = [
    {
        icon: Sparkles,
        label: "What's new in KeilHQ",
        description: "Latest updates and features",
        prompt: "What are the latest updates in KeilHQ?",
    },
    {
        icon: FileText,
        label: "Write meeting agenda",
        description: "Generate structured meeting notes",
        prompt: "Help me write a meeting agenda.",
    },
    {
        icon: BarChart3,
        label: "Analyze PDFs or images",
        description: "Extract data from documents",
        prompt: "I want to analyze a document.",
    },
    {
        icon: ListChecks,
        label: "Create a task tracker",
        description: "Organize your work items",
        prompt: "Help me create a task tracker for my projects.",
    },
];

// ─── Mock AI Responses ─────────────────────────────────────────────
const getMockResponse = (userMessage: string): string => {
    const lower = userMessage.toLowerCase();
    if (lower.includes("summarize")) {
        return "Here's a summary of your current dashboard:\n\n• **3 active priorities** — Finalize Homepage UX Wireframes is the most urgent, blocking the client review milestone.\n• **2 blockers** need attention — API Integration is waiting on Security API Keys (3 days).\n• **Efficiency score: 88%** — Up 5.2% this week with strong deep work metrics.\n\nWould you like me to dive deeper into any of these areas?";
    }
    if (lower.includes("task") || lower.includes("tracker")) {
        return "I can help you set up a task tracker! Based on your current workstream, here are the items I'd suggest tracking:\n\n1. ⚡ **Homepage UX Wireframes** — Due Friday, urgent\n2. 📄 **Backend API Documentation** — Important for integration\n3. 🗓️ **Weekly Design Sync** — Scheduled, 30min\n4. 📊 **Budget Tracker Update** — Low priority\n\nShall I create this as a structured tracker?";
    }
    if (lower.includes("insight") || lower.includes("analyze")) {
        return "Based on your dashboard data, here are key insights:\n\n📈 **Positive Trends:**\n- Deep work time is up 12% — great focus improvement\n- Overall efficiency score at 88%, trending upward\n\n⚠️ **Areas of Concern:**\n- Context switches at 4 — try to reduce to improve flow\n- 2 active blockers could cascade if not resolved\n\n💡 **Recommendation:** Prioritize resolving the API Integration blocker today to unblock downstream tasks.";
    }
    return "I understand your request. Let me help you with that.\n\nI'm KeilHQ's AI assistant, and I can help you with:\n• **Summarizing** your dashboard and project data\n• **Analyzing** patterns and providing insights\n• **Creating** task trackers and action items\n• **Translating** and transforming content\n\nWhat would you like to explore?";
};

// ═══════════════════════════════════════════════════════════════════
// ─── MAIN COMPONENT ────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════

export function AiAssistant() {
    const [mode, setMode] = useState<AiMode>("hidden");
    const [messages, setMessages] = useState<AiMessage[]>([]);
    const [inputValue, setInputValue] = useState("");
    const [isTyping, setIsTyping] = useState(false);
    const [fabHovered, setFabHovered] = useState(false);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const chatEndRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom on new messages
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, isTyping]);

    // Focus input when mode changes
    useEffect(() => {
        if (mode !== "hidden") {
            setTimeout(() => inputRef.current?.focus(), 300);
        }
    }, [mode]);

    // Keyboard shortcut: Escape to close, Cmd+J to toggle
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === "Escape" && mode !== "hidden") {
                setMode("hidden");
            }
            if (e.key === "j" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                setMode((prev) => (prev === "hidden" ? "floating" : "hidden"));
            }
        };
        document.addEventListener("keydown", handler);
        return () => document.removeEventListener("keydown", handler);
    }, [mode]);

    const handleSend = useCallback(() => {
        const text = inputValue.trim();
        if (!text) return;

        const userMsg: AiMessage = {
            id: crypto.randomUUID(),
            role: "user",
            content: text,
            timestamp: new Date(),
        };
        setMessages((prev) => [...prev, userMsg]);
        setInputValue("");
        setIsTyping(true);

        // Simulate AI response
        setTimeout(() => {
            const aiMsg: AiMessage = {
                id: crypto.randomUUID(),
                role: "assistant",
                content: getMockResponse(text),
                timestamp: new Date(),
            };
            setMessages((prev) => [...prev, aiMsg]);
            setIsTyping(false);
        }, 1200 + Math.random() * 800);
    }, [inputValue]);

    const handleSuggestionClick = (prompt: string) => {
        setInputValue(prompt);
        setTimeout(() => {
            const userMsg: AiMessage = {
                id: crypto.randomUUID(),
                role: "user",
                content: prompt,
                timestamp: new Date(),
            };
            setMessages((prev) => [...prev, userMsg]);
            setInputValue("");
            setIsTyping(true);

            setTimeout(() => {
                const aiMsg: AiMessage = {
                    id: crypto.randomUUID(),
                    role: "assistant",
                    content: getMockResponse(prompt),
                    timestamp: new Date(),
                };
                setMessages((prev) => [...prev, aiMsg]);
                setIsTyping(false);
            }, 1200 + Math.random() * 800);
        }, 100);
    };

    const handleNewChat = () => {
        setMessages([]);
        setInputValue("");
        setIsTyping(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const switchMode = (newMode: AiMode) => {
        setMode(newMode);
    };

    // Keep body layout in sync with sidebar mode so that
    // the main app content is pushed left when the AI
    // sidebar is visible instead of being covered.
    useEffect(() => {
        const body = document.body;
        if (!body) return;

        if (mode === "sidebar") {
            body.classList.add("ai-sidebar-open");
        } else {
            body.classList.remove("ai-sidebar-open");
        }

        return () => {
            body.classList.remove("ai-sidebar-open");
        };
    }, [mode]);

    // ─── Render Helpers ───────────────────────────────────────────────

    const renderModeControls = () => (
        <div className="flex items-center gap-1">
            <Button
                variant="ghost"
                size="icon"
                className="size-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60"
                title="New chat"
                onClick={handleNewChat}
            >
                <RotateCcw className="size-3.5" />
            </Button>
            <Button
                variant="ghost"
                size="icon"
                className={cn(
                    "size-7 rounded-lg hover:bg-muted/60",
                    mode === "floating" ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground"
                )}
                title="Floating chat"
                onClick={() => switchMode("floating")}
            >
                <MessageSquare className="size-3.5" />
            </Button>
            <Button
                variant="ghost"
                size="icon"
                className={cn(
                    "size-7 rounded-lg hover:bg-muted/60",
                    mode === "sidebar" ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground"
                )}
                title="Sidebar"
                onClick={() => switchMode("sidebar")}
            >
                <PanelRight className="size-3.5" />
            </Button>
            <Button
                variant="ghost"
                size="icon"
                className={cn(
                    "size-7 rounded-lg hover:bg-muted/60",
                    mode === "fullscreen" ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground"
                )}
                title="Full screen"
                onClick={() => switchMode("fullscreen")}
            >
                <Maximize2 className="size-3.5" />
            </Button>
            <div className="w-px h-4 bg-border/60 mx-1" />
            <Button
                variant="ghost"
                size="icon"
                className="size-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60"
                title="Minimize"
                onClick={() => switchMode("hidden")}
            >
                <Minus className="size-3.5" />
            </Button>
        </div>
    );

    const renderHeader = (showTitle: boolean = true) => (
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/60 bg-card/90 backdrop-blur-sm shrink-0">
            <div className="flex items-center gap-2">
                {showTitle && (
                    <>
                        <div className="flex items-center gap-1.5">
                            <Sparkles className="size-3.5 text-amber-400" />
                            <span className="text-[13px] font-bold text-foreground">KeilHQ AI</span>
                        </div>
                        <Badge className="bg-emerald-500/10 text-emerald-400 border-none text-[9px] font-bold px-1.5 py-0 hover:bg-emerald-500/20">
                            Online
                        </Badge>
                    </>
                )}
            </div>
            {renderModeControls()}
        </div>
    );

    const renderInput = () => (
        <div className="p-3 border-t border-border/60 bg-card shrink-0">
            <div className="relative flex items-end gap-2 rounded-2xl border border-border bg-muted/40 px-4 py-2 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 transition-all">
                <div className="flex items-center gap-2 shrink-0 pb-0.5">
                    <button className="text-muted-foreground/50 hover:text-muted-foreground transition-colors" title="Attach file">
                        <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                        </svg>
                    </button>
                    <button className="text-muted-foreground/50 hover:text-muted-foreground transition-colors" title="Settings">
                        <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                    </button>
                </div>
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
                    <span className="text-[10px] font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded-md select-none">Auto</span>
                    <button
                        onClick={handleSend}
                        disabled={!inputValue.trim()}
                        className={cn(
                            "size-7 rounded-full flex items-center justify-center transition-all",
                            inputValue.trim()
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

    const renderMessages = () => (
        <ScrollArea className="flex-1 overflow-y-auto" ref={scrollRef}>
            <div className="p-4 space-y-4">
                {messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8">
                        <KeilMascot size={64} className="mb-4 ai-mascot-bounce" />
                        <h3 className="text-sm font-bold text-foreground mb-1">On call and ready, how can I help?</h3>
                        <div className="w-full space-y-1.5 mt-4">
                            {QUICK_SUGGESTIONS.map((suggestion) => (
                                <button
                                    key={suggestion.label}
                                    onClick={() => handleSuggestionClick(suggestion.prompt)}
                                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left hover:bg-muted/60 border border-transparent hover:border-border/60 transition-all group bg-card/80"
                                >
                                    <suggestion.icon className="size-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                                    <span className="text-[12px] font-medium text-muted-foreground group-hover:text-foreground transition-colors">{suggestion.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                ) : (
                    messages.map((msg) => (
                        <div
                            key={msg.id}
                            className={cn(
                                "flex gap-2.5 ai-message-appear",
                                msg.role === "user" ? "justify-end" : "justify-start"
                            )}
                        >
                            {msg.role === "assistant" && (
                                <div className="shrink-0 mt-0.5">
                                    <KeilMascot size={28} />
                                </div>
                            )}
                            <div
                                className={cn(
                                    "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[12.5px] leading-relaxed",
                                    msg.role === "user"
                                        ? "bg-primary text-primary-foreground rounded-br-md"
                                        : "bg-card border border-border text-foreground rounded-bl-md"
                                )}
                            >
                                {msg.content.split("\n").map((line, i) => (
                                    <p key={i} className={cn(line === "" ? "h-2" : "")}>
                                        {line.split(/(\*\*.*?\*\*)/).map((part, j) =>
                                            part.startsWith("**") && part.endsWith("**") ? (
                                                <strong key={j} className="font-bold">{part.slice(2, -2)}</strong>
                                            ) : (
                                                <span key={j}>{part}</span>
                                            )
                                        )}
                                    </p>
                                ))}
                            </div>
                        </div>
                    ))
                )}

                {/* Typing indicator */}
                {isTyping && (
                    <div className="flex gap-2.5 items-start ai-message-appear">
                        <div className="shrink-0 mt-0.5">
                            <KeilMascot size={28} />
                        </div>
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

    // ─── Fullscreen Messages (centered layout like Notion) ───────────
    const renderFullscreenContent = () => (
        <div className="flex-1 flex flex-col items-center overflow-y-auto">
            {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center flex-1 w-full max-w-2xl mx-auto px-6">
                    <KeilMascot size={80} className="mb-5 ai-mascot-bounce" />
                    <h2 className="text-2xl font-bold text-foreground mb-8">On call and ready, how can I help?</h2>

                    {/* Get started cards */}
                    <div className="w-full max-w-lg">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Get started</span>
                            <button className="text-muted-foreground/60 hover:text-muted-foreground transition-colors">
                                <X className="size-4" />
                            </button>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            {FULLSCREEN_SUGGESTIONS.map((suggestion) => (
                                <button
                                    key={suggestion.label}
                                    onClick={() => handleSuggestionClick(suggestion.prompt)}
                                    className="flex items-start gap-3 p-4 rounded-2xl text-left bg-card border border-border hover:border-border/80 hover:shadow-md transition-all group"
                                >
                                    <suggestion.icon className="size-5 text-muted-foreground group-hover:text-primary transition-colors shrink-0 mt-0.5" />
                                    <div>
                                        <span className="text-[13px] font-bold text-foreground group-hover:text-primary transition-colors block">{suggestion.label}</span>
                                        {suggestion.description && (
                                            <span className="text-[11px] text-muted-foreground mt-0.5 block">{suggestion.description}</span>
                                        )}
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            ) : (
                <div className="w-full max-w-2xl mx-auto px-6 py-6 space-y-4 flex-1">
                    {messages.map((msg) => (
                        <div
                            key={msg.id}
                            className={cn(
                                "flex gap-3 ai-message-appear",
                                msg.role === "user" ? "justify-end" : "justify-start"
                            )}
                        >
                            {msg.role === "assistant" && (
                                <div className="shrink-0 mt-0.5">
                                    <KeilMascot size={32} />
                                </div>
                            )}
                            <div
                                className={cn(
                                    "max-w-[75%] rounded-2xl px-4 py-3 text-[13.5px] leading-relaxed",
                                    msg.role === "user"
                                        ? "bg-primary text-primary-foreground rounded-br-md"
                                        : "bg-card border border-border text-foreground rounded-bl-md shadow-sm"
                                )}
                            >
                                {msg.content.split("\n").map((line, i) => (
                                    <p key={i} className={cn(line === "" ? "h-2" : "")}>
                                        {line.split(/(\*\*.*?\*\*)/).map((part, j) =>
                                            part.startsWith("**") && part.endsWith("**") ? (
                                                <strong key={j} className="font-bold">{part.slice(2, -2)}</strong>
                                            ) : (
                                                <span key={j}>{part}</span>
                                            )
                                        )}
                                    </p>
                                ))}
                            </div>
                        </div>
                    ))}

                    {isTyping && (
                        <div className="flex gap-3 items-start ai-message-appear">
                            <div className="shrink-0 mt-0.5">
                                <KeilMascot size={32} />
                            </div>
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
                        {/* Glow ring */}
                        <div className="absolute inset-0 rounded-full bg-gradient-to-r from-primary via-indigo-500 to-violet-500 opacity-0 group-hover:opacity-30 blur-lg transition-opacity duration-500" />

                        {/* Main button */}
                        <div className="relative size-14 rounded-full bg-card border border-border shadow-xl shadow-black/20 flex items-center justify-center transition-all duration-300 group-hover:scale-110 group-hover:shadow-2xl group-hover:shadow-primary/30 group-active:scale-95">
                            <KeilMascot size={38} className={cn("transition-transform duration-500", fabHovered && "scale-105")} />
                        </div>

                        {/* Tooltip */}
                        <div className={cn(
                            "absolute bottom-full right-0 mb-3 px-3 py-1.5 bg-popover text-popover-foreground text-[11px] font-bold rounded-lg whitespace-nowrap border border-border/60 shadow-lg transition-all duration-200 pointer-events-none",
                            fabHovered ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1"
                        )}>
                            KeilHQ AI
                            <kbd className="ml-2 bg-muted text-muted-foreground px-1.5 py-0.5 rounded text-[9px] border border-border/60">⌘J</kbd>
                            <div className="absolute top-full right-5 w-0 h-0 border-l-[5px] border-r-[5px] border-t-[5px] border-transparent border-t-popover" />
                        </div>
                    </button>
                </div>
            )}

            {/* ─── FLOATING CHAT POPOVER ─────────────────────────────── */}
            {mode === "floating" && (
                <div className="fixed bottom-6 right-6 z-50 ai-panel-appear">
                    <div className="w-[380px] h-[520px] bg-card rounded-2xl shadow-2xl shadow-black/40 border border-border flex flex-col overflow-hidden">
                        {renderHeader()}
                        {renderMessages()}
                        {renderInput()}
                    </div>
                </div>
            )}

            {/* ─── SIDEBAR PANEL ─────────────────────────────────────── */}
            {mode === "sidebar" && (
                <div className="fixed top-0 right-0 bottom-0 z-30 w-[400px] bg-card border-l border-border flex flex-col ai-sidebar-appear shadow-2xl shadow-black/40">
                    {renderHeader()}
                    {renderMessages()}
                    {renderInput()}
                </div>
            )}

            {/* ─── FULLSCREEN ────────────────────────────────────────── */}
            {mode === "fullscreen" && (
                <div className="fixed inset-0 z-50 bg-background flex flex-col ai-fullscreen-appear">
                    {/* Fullscreen Header */}
                    <div className="flex items-center justify-between px-6 py-3 border-b border-border/60 bg-card/90 backdrop-blur-sm shrink-0">
                        <div className="flex items-center gap-3">
                            <button className="text-muted-foreground hover:text-foreground transition-colors" title="History">
                                <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                                </svg>
                            </button>
                            <button className="text-slate-400 hover:text-slate-600 transition-colors" title="History">
                                <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </button>
                        </div>

                        <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1.5">
                                <Sparkles className="size-3.5 text-amber-400" />
                                <span className="text-[13px] font-bold text-foreground">KeilHQ AI</span>
                            </div>
                            <Badge className="bg-emerald-500/10 text-emerald-400 border-none text-[9px] font-bold px-1.5 py-0 hover:bg-emerald-500/20">
                                Online
                            </Badge>
                        </div>

                        <div className="flex items-center gap-1">
                            <Button
                                variant="ghost"
                                size="icon"
                                className="size-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60"
                                title="New chat"
                                onClick={handleNewChat}
                            >
                                <RotateCcw className="size-3.5" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="size-7 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                                title="Sidebar mode"
                                onClick={() => switchMode("sidebar")}
                            >
                                <PanelRight className="size-3.5" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="size-7 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                                title="Minimize"
                                onClick={() => switchMode("floating")}
                            >
                                <Minimize2 className="size-3.5" />
                            </Button>
                            <div className="w-px h-4 bg-border/60 mx-1" />
                            <Button
                                variant="ghost"
                                size="icon"
                                className="size-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60"
                                title="Close"
                                onClick={() => switchMode("hidden")}
                            >
                                <X className="size-3.5" />
                            </Button>
                        </div>
                    </div>

                    {/* Fullscreen Content */}
                    {renderFullscreenContent()}

                    {/* Fullscreen Input */}
                    <div className="shrink-0 flex justify-center pb-8 pt-2 px-6">
                        <div className="w-full max-w-2xl">
                            <div className="relative flex items-end gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 focus-within:border-blue-300 focus-within:ring-2 focus-within:ring-blue-100 transition-all shadow-sm">
                                <div className="flex items-center gap-2 shrink-0 pb-0.5">
                                    <button className="text-slate-300 hover:text-slate-500 transition-colors" title="Attach file">
                                        <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                                        </svg>
                                    </button>
                                    <button className="text-slate-300 hover:text-slate-500 transition-colors" title="Settings">
                                        <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                        </svg>
                                    </button>
                                </div>
                                <textarea
                                    ref={inputRef}
                                    value={inputValue}
                                    onChange={(e) => setInputValue(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    placeholder="Do anything with AI..."
                                    rows={1}
                                    className="flex-1 resize-none bg-transparent text-[14px] text-slate-700 placeholder:text-slate-400 focus:outline-none py-0.5 max-h-[120px] min-h-[20px]"
                                    style={{ overflow: inputValue.split("\n").length > 3 ? "auto" : "hidden" }}
                                />
                                <div className="flex items-center gap-2 shrink-0 pb-0.5">
                                    <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md select-none">Auto</span>
                                    <button
                                        onClick={handleSend}
                                        disabled={!inputValue.trim()}
                                        className={cn(
                                            "size-8 rounded-full flex items-center justify-center transition-all",
                                            inputValue.trim()
                                                ? "bg-blue-500 text-white hover:bg-blue-600 shadow-sm shadow-blue-200"
                                                : "bg-slate-200 text-slate-400 cursor-not-allowed"
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
