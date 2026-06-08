import React, { useState, useEffect, useRef } from "react";
import { motion } from "motion/react";
import {
  Sparkles, Check, Languages, Sliders,
  ChevronRight, ArrowLeft, ArrowUp, RefreshCw, X
} from "lucide-react";

interface AiBubbleMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (action: string, payload?: any) => void;
}

const BUBBLE_ACTIONS = [
  { id: "proofread", title: "Improve writing", subtitle: "Correct grammar and spelling", action: "proofread" },
  { id: "simplify", title: "Simplify language", subtitle: "Make it easier to read", action: "simplify" },
  { id: "longer", title: "Make longer", subtitle: "Add details and expand", action: "longer" },
  { id: "shorter", title: "Make shorter", subtitle: "Trim down and condense", action: "shorter" }
];

const TONES = [
  { id: "professional", name: "Professional" },
  { id: "casual", name: "Casual" },
  { id: "straightforward", name: "Straightforward" },
  { id: "confident", name: "Confident" },
  { id: "friendly", name: "Friendly" }
];

const LANGUAGES = [
  { name: "Spanish", val: "Spanish" },
  { name: "French", val: "French" },
  { name: "German", val: "German" },
  { name: "Chinese", val: "Chinese" },
  { name: "Japanese", val: "Japanese" },
  { name: "Hindi", val: "Hindi" }
];

export function AiBubbleMenu({ isOpen, onSubmit }: AiBubbleMenuProps) {
  const [activeTab, setActiveTab] = useState<"main" | "tone" | "translate">("main");
  const [customPrompt, setCustomPrompt] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setActiveTab("main");
      setCustomPrompt("");
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (customPrompt.trim()) {
      onSubmit("custom", { prompt: customPrompt.trim() });
    }
  };

  if (!isOpen) return null;

  return (
    <motion.div
      ref={containerRef}
      initial={{ opacity: 0, scale: 0.95, y: 5 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: 5 }}
      transition={{ duration: 0.15 }}
      className="w-[280px] bg-card border border-border shadow-[0_10px_30px_rgba(0,0,0,0.25)] rounded-xl overflow-hidden flex flex-col z-[120]"
    >
      {activeTab === "main" && (
        <>
          {/* Custom Edit Input */}
          <form onSubmit={handleCustomSubmit} className="flex items-center gap-2 p-2 border-b border-border/40 bg-muted/20">
            <Sparkles className="size-3.5 text-purple-400 shrink-0" />
            <input
              ref={inputRef}
              type="text"
              className="w-full bg-transparent border-none outline-none text-xs placeholder:text-muted-foreground/50 text-foreground"
              placeholder="Ask AI to edit selection..."
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
            />
            {customPrompt.trim() && (
              <button
                type="submit"
                className="size-5 rounded bg-purple-600 hover:bg-purple-500 text-white flex items-center justify-center transition-colors shrink-0"
              >
                <ArrowUp className="size-3" />
              </button>
            )}
          </form>

          {/* Quick Actions List */}
          <div className="p-1 max-h-[220px] overflow-y-auto custom-scrollbar">
            <div className="px-2 py-1 text-[9px] font-semibold text-muted-foreground/50 tracking-wider uppercase select-none">
              Edit text
            </div>
            {BUBBLE_ACTIONS.map((item) => (
              <div
                key={item.id}
                onClick={() => onSubmit(item.action)}
                className="px-2 py-1.5 flex flex-col cursor-pointer rounded-lg text-foreground hover:bg-accent/50 transition-colors"
              >
                <span className="text-[12px] font-medium text-foreground/90">{item.title}</span>
                <span className="text-[9.5px] text-muted-foreground/60">{item.subtitle}</span>
              </div>
            ))}

            <div className="h-px bg-border/40 my-1" />

            {/* Change Tone */}
            <div
              onClick={() => setActiveTab("tone")}
              className="px-2 py-1.5 flex items-center justify-between cursor-pointer rounded-lg text-foreground hover:bg-accent/50 text-[12px] font-medium transition-colors"
            >
              <div className="flex items-center gap-2">
                <Sliders className="size-3.5 text-indigo-400" />
                <span>Change tone...</span>
              </div>
              <ChevronRight className="size-3 text-muted-foreground/45" />
            </div>

            {/* Translate */}
            <div
              onClick={() => setActiveTab("translate")}
              className="px-2 py-1.5 flex items-center justify-between cursor-pointer rounded-lg text-foreground hover:bg-accent/50 text-[12px] font-medium transition-colors"
            >
              <div className="flex items-center gap-2">
                <Languages className="size-3.5 text-emerald-400" />
                <span>Translate...</span>
              </div>
              <ChevronRight className="size-3 text-muted-foreground/45" />
            </div>
          </div>
        </>
      )}

      {activeTab === "tone" && (
        <div className="flex flex-col">
          <div className="flex items-center gap-2 p-2 border-b border-border/20 bg-muted/10 shrink-0">
            <button
              onClick={() => setActiveTab("main")}
              className="p-1 rounded hover:bg-accent/40 text-muted-foreground"
            >
              <ArrowLeft className="size-3.5" />
            </button>
            <span className="text-[11px] font-semibold text-muted-foreground/60 uppercase">Change Tone</span>
          </div>
          <div className="p-1 max-h-[200px] overflow-y-auto custom-scrollbar">
            {TONES.map((item) => (
              <div
                key={item.id}
                onClick={() => onSubmit("rewrite", { tone: item.id })}
                className="px-2.5 py-1.5 cursor-pointer rounded-lg text-[12px] text-foreground/90 hover:bg-accent/50 transition-colors"
              >
                {item.name}
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === "translate" && (
        <div className="flex flex-col">
          <div className="flex items-center gap-2 p-2 border-b border-border/20 bg-muted/10 shrink-0">
            <button
              onClick={() => setActiveTab("main")}
              className="p-1 rounded hover:bg-accent/40 text-muted-foreground"
            >
              <ArrowLeft className="size-3.5" />
            </button>
            <span className="text-[11px] font-semibold text-muted-foreground/60 uppercase">Translate</span>
          </div>
          <div className="p-1 max-h-[200px] overflow-y-auto custom-scrollbar">
            {LANGUAGES.map((item) => (
              <div
                key={item.val}
                onClick={() => onSubmit("translate", { language: item.val })}
                className="px-2.5 py-1.5 cursor-pointer rounded-lg text-[12px] text-foreground/90 hover:bg-accent/50 transition-colors"
              >
                {item.name}
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}

// ─── AI Response Floating Toolbar ─────────────────────────────────────────────

interface AiStreamToolbarProps {
  isStreaming: boolean;
  onKeep: () => void;
  onTryAgain: () => void;
  onDiscard: () => void;
  onClose: () => void;
}

export function AiStreamToolbar({ isStreaming, onKeep, onTryAgain, onDiscard }: AiStreamToolbarProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 10, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[110] flex items-center gap-1.5 p-1.5 bg-card border border-border/80 shadow-[0_10px_40px_rgba(0,0,0,0.3)] rounded-full backdrop-blur-md"
    >
      {isStreaming ? (
        <div className="flex items-center gap-2 px-3 py-1.5">
          <Sparkles className="size-3.5 text-purple-400 animate-pulse" />
          <span className="text-[11px] font-medium text-muted-foreground">AI is writing...</span>
          <RefreshCw className="size-3 text-purple-400 animate-spin ml-1" />
        </div>
      ) : (
        <>
          <button
            onClick={onKeep}
            className="px-3 py-1.5 rounded-full bg-purple-600 hover:bg-purple-500 text-white text-[11px] font-semibold transition-colors flex items-center gap-1"
          >
            <Check className="size-3" />
            Keep text
          </button>
          <button
            onClick={onTryAgain}
            className="px-3 py-1.5 rounded-full hover:bg-accent text-foreground text-[11px] font-medium transition-colors flex items-center gap-1"
          >
            <RefreshCw className="size-3 text-purple-400" />
            Try again
          </button>
          <div className="w-px h-4 bg-border/60 mx-0.5" />
          <button
            onClick={onDiscard}
            className="px-3 py-1.5 rounded-full hover:bg-accent text-destructive text-[11px] font-medium transition-colors flex items-center gap-1"
          >
            <X className="size-3" />
            Discard
          </button>
        </>
      )}
    </motion.div>
  );
}
