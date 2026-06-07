import React, { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "motion/react"
import { 
  Sparkles, CornerDownLeft, CheckSquare, 
  FileText, List, Languages, Sliders, ArrowUp,
  ArrowLeft, ChevronRight, PencilLine, SpellCheck,
  AlignLeft, Scissors
} from "lucide-react"

interface AiCommandMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (prompt: string, action?: string, payload?: any) => void;
  position: { left: number; top: number; bottom: number; direction: "up" | "down"; maxHeight: number } | null;
  selectedText?: string;
}

export interface AiActionItem {
  id: string;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  action: string;
  category: "generate" | "rewrite" | "translate" | "tone";
  payload?: any;
}

const GENERATE_ACTIONS: AiActionItem[] = [
  {
    id: "brainstorm",
    title: "Brainstorm ideas",
    subtitle: "Generate creative concepts and lists",
    icon: <Sparkles className="size-4 text-muted-foreground" />,
    action: "generate",
    category: "generate"
  },
  {
    id: "outline",
    title: "Write an outline",
    subtitle: "Structure a topic or project",
    icon: <List className="size-4 text-muted-foreground" />,
    action: "generate",
    category: "generate"
  },
  {
    id: "summarize",
    title: "Summarize page",
    subtitle: "Create a brief overview of the document",
    icon: <FileText className="size-4 text-muted-foreground" />,
    action: "summarize",
    category: "generate"
  },
  {
    id: "action_items",
    title: "Find action items",
    subtitle: "Extract tasks and checklists from document",
    icon: <CheckSquare className="size-4 text-muted-foreground" />,
    action: "custom",
    category: "generate"
  }
];

const EDIT_ACTIONS: AiActionItem[] = [
  {
    id: "proofread",
    title: "Improve writing",
    subtitle: "Correct spelling, grammar and phrasing",
    icon: <PencilLine className="size-4 text-muted-foreground" />,
    action: "proofread",
    category: "rewrite"
  },
  {
    id: "simplify",
    title: "Simplify language",
    subtitle: "Make the selection easier to read",
    icon: <SpellCheck className="size-4 text-muted-foreground" />,
    action: "simplify",
    category: "rewrite"
  },
  {
    id: "longer",
    title: "Make longer",
    subtitle: "Expand selection with more details",
    icon: <AlignLeft className="size-4 text-muted-foreground" />,
    action: "longer",
    category: "rewrite"
  },
  {
    id: "shorter",
    title: "Make shorter",
    subtitle: "Condense selection to core ideas",
    icon: <Scissors className="size-4 text-muted-foreground" />,
    action: "shorter",
    category: "rewrite"
  }
];

const TONE_OPTIONS = [
  { name: "Professional", val: "professional" },
  { name: "Casual", val: "casual" },
  { name: "Straightforward", val: "straightforward" },
  { name: "Confident", val: "confident" },
  { name: "Friendly", val: "friendly" }
];

const TRANSLATION_LANGUAGES = [
  { name: "Spanish", val: "Spanish" },
  { name: "French", val: "French" },
  { name: "German", val: "German" },
  { name: "Chinese", val: "Chinese" },
  { name: "Japanese", val: "Japanese" },
  { name: "Hindi", val: "Hindi" }
];

export function AiCommandMenu({ isOpen, onClose, onSubmit, position, selectedText = "" }: AiCommandMenuProps) {
  const [prompt, setPrompt] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [activeTab, setActiveTab] = useState<"actions" | "tone" | "translate">("actions");
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const hasSelection = selectedText.trim().length > 0;
  const currentActions = hasSelection ? EDIT_ACTIONS : GENERATE_ACTIONS;

  useEffect(() => {
    if (isOpen) {
      setPrompt("");
      setSelectedIndex(0);
      setActiveTab("actions");
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, onClose]);

  const filteredItemsLength = (() => {
    if (activeTab === "tone") return TONE_OPTIONS.length;
    if (activeTab === "translate") return TRANSLATION_LANGUAGES.length;
    return currentActions.length + (prompt.trim() ? 1 : 2);
  })();

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % filteredItemsLength);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filteredItemsLength) % filteredItemsLength);
    } else if (e.key === "Enter") {
      e.preventDefault();
      handleSelectCurrent();
    }
  };

  const handleSelectCurrent = () => {
    const isCustomText = prompt.trim().length > 0;
    
    if (activeTab === "actions") {
      if (isCustomText && selectedIndex === 0) {
        if (hasSelection) {
          onSubmit(prompt.trim(), "custom", { text: selectedText });
        } else {
          onSubmit(prompt.trim(), "generate");
        }
        return;
      }

      const listIndex = isCustomText ? selectedIndex - 1 : selectedIndex;

      if (listIndex >= 0 && listIndex < currentActions.length) {
        const item = currentActions[listIndex];
        if (item.id === "action_items") {
          onSubmit("Extract action items.", "custom");
        } else {
          onSubmit(item.title, item.action);
        }
      } else if (listIndex === currentActions.length) {
        setActiveTab("tone");
        setSelectedIndex(0);
      } else if (listIndex === currentActions.length + 1) {
        setActiveTab("translate");
        setSelectedIndex(0);
      }
    } else if (activeTab === "tone") {
      const selectedTone = TONE_OPTIONS[selectedIndex];
      if (selectedTone) {
        onSubmit(`Rewrite in a ${selectedTone.name} tone`, "rewrite", { tone: selectedTone.val });
      }
    } else if (activeTab === "translate") {
      const selectedLang = TRANSLATION_LANGUAGES[selectedIndex];
      if (selectedLang) {
        onSubmit(`Translate to ${selectedLang.name}`, "translate", { language: selectedLang.name });
      }
    }
  };

  if (!isOpen || !position) return null;

  const isUp = position.direction === "up";

  return (
    <AnimatePresence>
      <div
        ref={menuRef}
        className={`fixed z-[120] w-[340px] flex ${isUp ? "flex-col-reverse" : "flex-col"} gap-2 pointer-events-auto`}
        style={{
          left: position.left,
          ...(isUp ? { bottom: position.bottom } : { top: position.top }),
        }}
        onKeyDown={handleKeyDown}
      >
        {/* Pill-shaped Input Bar */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ type: "spring", stiffness: 400, damping: 28 }}
          className="w-full h-11 rounded-full flex items-center justify-between gap-3 px-3 backdrop-blur-md transition-all duration-150"
          style={{
            background: "var(--card)",
            border: "1px solid var(--border)",
            boxShadow: "var(--shadow-md)"
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = "rgba(139, 92, 246, 0.4)";
            e.currentTarget.style.boxShadow = "0 0 0 2px rgba(139, 92, 246, 0.1), var(--shadow-md)";
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = "var(--border)";
            e.currentTarget.style.boxShadow = "var(--shadow-md)";
          }}
        >
          {/* Logo on the left */}
          <div 
            className="size-7 rounded-full flex items-center justify-center shrink-0 border"
            style={{
              background: "var(--muted)",
              borderColor: "var(--border)",
            }}
          >
            <svg viewBox="0 0 100 100" className="size-4" fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round" style={{ color: "var(--foreground)" }}>
              {/* Eyes */}
              <circle cx="35" cy="42" r="4" fill="currentColor" />
              <circle cx="65" cy="42" r="4" fill="currentColor" />
              {/* Nose/mouth line */}
              <path d="M 50,47 L 50,65 C 50,69 45,71 41,69" />
            </svg>
          </div>

          {/* Text Input */}
          <input
            ref={inputRef}
            type="text"
            className="w-full bg-transparent border-none outline-none text-[12.5px] font-medium placeholder:text-muted-foreground/60"
            style={{
              color: "var(--foreground)"
            }}
            placeholder={
              hasSelection 
                ? "Edit selection with AI..." 
                : "Ask AI to write or edit anything..."
            }
            value={prompt}
            onChange={(e) => {
              setPrompt(e.target.value);
              setSelectedIndex(0);
            }}
          />

          {/* Arrow Up Send Button */}
          <button
            onClick={handleSelectCurrent}
            disabled={!prompt.trim() && !hasSelection}
            className={`size-7 rounded-full flex items-center justify-center transition-all border-none shrink-0 ${
              prompt.trim() || hasSelection
                ? "bg-purple-600 hover:bg-purple-500 text-white cursor-pointer shadow-sm hover:scale-105 active:scale-95"
                : "cursor-default"
            }`}
            style={
              !(prompt.trim() || hasSelection)
                ? { background: "var(--muted)", color: "var(--muted-foreground)" }
                : undefined
            }
          >
            <ArrowUp className="size-4" />
          </button>
        </motion.div>

        {/* Dropdown Suggestions Card */}
        <motion.div
          initial={{ opacity: 0, y: isUp ? -6 : 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: isUp ? -6 : 6 }}
          className="w-full rounded-xl overflow-hidden flex flex-col backdrop-blur-md"
          style={{
            maxHeight: `${position.maxHeight - 50}px`,
            background: "var(--popover)",
            border: "1px solid var(--border)",
            boxShadow: "var(--shadow-lg)",
            color: "var(--foreground)"
          }}
        >
          {/* Dynamic Lists */}
          <div className="overflow-y-auto p-1 max-h-[240px] custom-scrollbar flex-grow">
            {activeTab === "actions" && (
              <>
                {/* Custom generate/edit option when typing */}
                {prompt.trim() && (
                  <div
                    onClick={handleSelectCurrent}
                    className="px-3 py-2 flex items-center justify-between cursor-pointer rounded-lg select-none outline-none border transition-all duration-100"
                    style={{
                      borderColor: selectedIndex === 0 ? "rgba(139, 92, 246, 0.2)" : "transparent",
                      background: selectedIndex === 0 ? "color-mix(in oklch, var(--primary) 8%, transparent)" : "transparent",
                    }}
                    onMouseEnter={() => setSelectedIndex(0)}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Sparkles className="size-4 text-purple-500 dark:text-purple-400" />
                      <span className="text-[12.5px] font-semibold truncate">
                        {hasSelection ? `Edit: "${prompt}"` : `Generate: "${prompt}"`}
                      </span>
                    </div>
                    <kbd 
                      className="text-[9px] px-1.5 py-0.5 rounded font-mono shrink-0 flex items-center gap-0.5 border"
                      style={{
                        background: "var(--card)",
                        borderColor: "var(--border)",
                        color: "var(--muted-foreground)"
                      }}
                    >
                      <CornerDownLeft className="size-2.5" />
                      <span>Enter</span>
                    </kbd>
                  </div>
                )}

                <div 
                  className="px-3 py-2 text-[9.5px] font-bold tracking-wider uppercase select-none"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  {hasSelection ? "Edit selection" : "Draft with AI"}
                </div>

                {currentActions.map((item, index) => {
                  const adjustedIndex = prompt.trim() ? index + 1 : index;
                  return (
                    <div
                      key={item.id}
                      onClick={() => {
                        if (item.id === "action_items") {
                          onSubmit("Extract action items.", "custom");
                        } else {
                          onSubmit(item.title, item.action);
                        }
                      }}
                      className="px-3 py-2 flex items-center gap-3 cursor-pointer rounded-lg select-none outline-none transition-all duration-100"
                      style={{
                        background: selectedIndex === adjustedIndex
                          ? "var(--accent)"
                          : "transparent",
                      }}
                      onMouseEnter={() => setSelectedIndex(adjustedIndex)}
                    >
                      <span className="shrink-0 flex items-center justify-center size-5">{item.icon}</span>
                      <div className="flex flex-col min-w-0 leading-normal">
                        <span className="text-[12.5px] font-semibold" style={{ color: "var(--foreground)" }}>{item.title}</span>
                        <span className="text-[10px]" style={{ color: "var(--muted-foreground)" }}>{item.subtitle}</span>
                      </div>
                    </div>
                  );
                })}

                <div className="h-px my-1" style={{ background: "var(--border)" }} />

                {/* Submenus shortcuts */}
                <div
                  onClick={() => {
                    setActiveTab("tone");
                    setSelectedIndex(0);
                  }}
                  className="px-3 py-2 flex items-center justify-between cursor-pointer rounded-lg transition-all duration-100 text-[12.5px] font-semibold"
                  style={{
                    background: selectedIndex === (prompt.trim() ? currentActions.length + 1 : currentActions.length)
                      ? "var(--accent)"
                      : "transparent"
                  }}
                  onMouseEnter={() => setSelectedIndex(prompt.trim() ? currentActions.length + 1 : currentActions.length)}
                >
                  <div className="flex items-center gap-3">
                    <Sliders className="size-4 text-muted-foreground" />
                    <span>Change tone...</span>
                  </div>
                  <ChevronRight className="size-3.5" style={{ color: "var(--muted-foreground)" }} />
                </div>

                <div
                  onClick={() => {
                    setActiveTab("translate");
                    setSelectedIndex(0);
                  }}
                  className="px-3 py-2 flex items-center justify-between cursor-pointer rounded-lg transition-all duration-100 text-[12.5px] font-semibold"
                  style={{
                    background: selectedIndex === (prompt.trim() ? currentActions.length + 2 : currentActions.length + 1)
                      ? "var(--accent)"
                      : "transparent"
                  }}
                  onMouseEnter={() => setSelectedIndex(prompt.trim() ? currentActions.length + 2 : currentActions.length + 1)}
                >
                  <div className="flex items-center gap-3">
                    <Languages className="size-4 text-muted-foreground" />
                    <span>Translate...</span>
                  </div>
                  <ChevronRight className="size-3.5" style={{ color: "var(--muted-foreground)" }} />
                </div>
              </>
            )}

            {activeTab === "tone" && (
              <>
                <div className="flex items-center justify-between px-3 py-2 border-b shrink-0" style={{ borderColor: "var(--border)" }}>
                  <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>Change Tone</span>
                  <button 
                    onClick={() => { setActiveTab("actions"); setSelectedIndex(0); }}
                    className="text-[10px] text-purple-600 dark:text-purple-400 hover:text-purple-500 dark:hover:text-purple-300 font-semibold flex items-center gap-0.5 cursor-pointer border-none bg-transparent"
                  >
                    <ArrowLeft className="size-3" />
                    Back
                  </button>
                </div>
                {TONE_OPTIONS.map((item, index) => (
                  <div
                    key={item.val}
                    onClick={() => onSubmit(`Rewrite in a ${item.name} tone`, "rewrite", { tone: item.val })}
                    className="px-3.5 py-2 flex items-center cursor-pointer rounded-lg select-none outline-none transition-colors text-[12.5px] font-medium"
                    style={{
                      background: selectedIndex === index
                        ? "var(--accent)"
                        : "transparent"
                    }}
                    onMouseEnter={() => setSelectedIndex(index)}
                  >
                    {item.name}
                  </div>
                ))}
              </>
            )}

            {activeTab === "translate" && (
              <>
                <div className="flex items-center justify-between px-3 py-2 border-b shrink-0" style={{ borderColor: "var(--border)" }}>
                  <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>Translate Text</span>
                  <button 
                    onClick={() => { setActiveTab("actions"); setSelectedIndex(0); }}
                    className="text-[10px] text-purple-600 dark:text-purple-400 hover:text-purple-500 dark:hover:text-purple-300 font-semibold flex items-center gap-0.5 cursor-pointer border-none bg-transparent"
                  >
                    <ArrowLeft className="size-3" />
                    Back
                  </button>
                </div>
                {TRANSLATION_LANGUAGES.map((item, index) => (
                  <div
                    key={item.val}
                    onClick={() => onSubmit(`Translate to ${item.name}`, "translate", { language: item.val })}
                    className="px-3.5 py-2 flex items-center cursor-pointer rounded-lg select-none outline-none transition-colors text-[12.5px] font-medium"
                    style={{
                      background: selectedIndex === index
                        ? "var(--accent)"
                        : "transparent"
                    }}
                    onMouseEnter={() => setSelectedIndex(index)}
                  >
                    {item.name}
                  </div>
                ))}
              </>
            )}
          </div>

          {/* Footer info */}
          <div 
            className="border-t p-2.5 flex justify-between items-center text-[10px] shrink-0 select-none"
            style={{
              borderColor: "var(--border)",
              background: "var(--muted)",
              color: "var(--muted-foreground)"
            }}
          >
            <span className="flex items-center gap-1.5">
              <Sparkles className="size-3 text-purple-500 animate-pulse" />
              GitHub Model
            </span>
            <div className="flex items-center gap-1.5">
              <kbd 
                className="font-mono text-[9px] px-1.5 py-0.5 rounded border"
                style={{
                  background: "var(--card)",
                  borderColor: "var(--border)",
                  color: "var(--muted-foreground)"
                }}
              >
                esc
              </kbd>
              <span>Dismiss</span>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
