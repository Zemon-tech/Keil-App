// src/components/chat/SmartInput.tsx
// Huly/Slack-level smart input: slash commands, @mentions, drag-drop, voice mock

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Send, Paperclip, SmilePlus, CheckCircle2, Mic, MicOff,
  X, FileText, Image as ImageIcon,
} from "lucide-react";
import type { ChatMember } from "@/hooks/api/useChat";

// ── Slash commands catalogue ──────────────────────────────────────────────────
const SLASH_COMMANDS = [
  { trigger: "/task",   icon: "✅", label: "Create Task",    desc: "Convert this message into a task" },
  { trigger: "/remind", icon: "⏰", label: "Set Reminder",   desc: "Remind you about something later" },
  { trigger: "/assign", icon: "👤", label: "Assign to User", desc: "Assign work to a team member" },
  { trigger: "/pin",    icon: "📌", label: "Pin Message",    desc: "Pin this content to the channel" },
  { trigger: "/poll",   icon: "📊", label: "Create Poll",    desc: "Ask your team a question" },
  { trigger: "/meet",   icon: "📹", label: "Start Meeting",  desc: "Invite team to a video call" },
];

// ── AI suggestions (static mockup) ───────────────────────────────────────────
const AI_SUGGESTIONS = [
  "Sounds good, I'll take care of it.",
  "Can you share more details?",
  "Let's sync up tomorrow morning.",
  "I'll create a task for this.",
];

interface AttachedFile {
  name: string;
  size: number;
  type: string;
  url: string; // Object URL for preview
}

interface SmartInputProps {
  channelId: string;
  members: ChatMember[];
  onSend: (text: string) => void;
  onTypingStart: () => void;
  onTypingEnd: () => void;
}

export function SmartInput({ members, onSend, onTypingStart, onTypingEnd }: SmartInputProps) {
  const [text, setText] = useState("");
  const [slashSuggestions, setSlashSuggestions] = useState<typeof SLASH_COMMANDS>([]);
  const [mentionSuggestions, setMentionSuggestions] = useState<ChatMember[]>([]);
  const [showAI, setShowAI] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [attachments, setAttachments] = useState<AttachedFile[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [selectedSuggestion, setSelectedSuggestion] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Parse input for triggers ──────────────────────────────────────────────
  useEffect(() => {
    // Slash commands
    if (text.startsWith("/")) {
      const q = text.slice(1).toLowerCase();
      setSlashSuggestions(
        SLASH_COMMANDS.filter((c) => c.trigger.slice(1).startsWith(q))
      );
      setMentionSuggestions([]);
      setShowAI(false);
      return;
    }
    setSlashSuggestions([]);

    // @mention
    const mentionMatch = text.match(/@(\w*)$/);
    if (mentionMatch) {
      const q = mentionMatch[1].toLowerCase();
      setMentionSuggestions(
        members.filter((m) => m.name.toLowerCase().includes(q)).slice(0, 6)
      );
      setShowAI(false);
      return;
    }
    setMentionSuggestions([]);

    // AI suggestions when idle ≥ 2 words typed
    if (text.trim().split(" ").length >= 2) {
      const t = setTimeout(() => setShowAI(true), 1200);
      return () => clearTimeout(t);
    }
    setShowAI(false);
  }, [text, members]);

  // ── Typing events ─────────────────────────────────────────────────────────
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setText(e.target.value);
    onTypingStart();
    if (typingRef.current) clearTimeout(typingRef.current);
    typingRef.current = setTimeout(onTypingEnd, 2000);
  };

  // ── Keyboard navigation in suggestion lists ───────────────────────────────
  const totalSuggestions = slashSuggestions.length || mentionSuggestions.length;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (totalSuggestions > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedSuggestion((s) => (s + 1) % totalSuggestions);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedSuggestion((s) => (s - 1 + totalSuggestions) % totalSuggestions);
        return;
      }
      if (e.key === "Tab" || e.key === "Enter") {
        e.preventDefault();
        if (slashSuggestions.length > 0) applySlash(slashSuggestions[selectedSuggestion]);
        if (mentionSuggestions.length > 0) applyMention(mentionSuggestions[selectedSuggestion]);
        return;
      }
      if (e.key === "Escape") {
        setSlashSuggestions([]);
        setMentionSuggestions([]);
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const applySlash = (cmd: typeof SLASH_COMMANDS[0]) => {
    setText(cmd.trigger + " ");
    setSlashSuggestions([]);
    setSelectedSuggestion(0);
    inputRef.current?.focus();
  };

  const applyMention = (member: ChatMember) => {
    const replaced = text.replace(/@\w*$/, `@${member.name} `);
    setText(replaced);
    setMentionSuggestions([]);
    setSelectedSuggestion(0);
    inputRef.current?.focus();
  };

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed && attachments.length === 0) return;
    // Build message — prefix attachment names if any
    const attachStr = attachments.map((f) => `[${f.name}]`).join(" ");
    onSend(attachStr ? `${attachStr}\n${trimmed}` : trimmed);
    setText("");
    setAttachments([]);
    setShowAI(false);
    onTypingEnd();
  };

  // ── File handling ─────────────────────────────────────────────────────────
  const addFiles = useCallback((files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach((file) => {
      const url = URL.createObjectURL(file);
      setAttachments((prev) => [...prev, { name: file.name, size: file.size, type: file.type, url }]);
    });
  }, []);

  const removeAttachment = (idx: number) => {
    setAttachments((prev) => {
      URL.revokeObjectURL(prev[idx].url);
      return prev.filter((_, i) => i !== idx);
    });
  };

  // Drag & drop
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = () => setIsDragging(false);
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    addFiles(e.dataTransfer.files);
  };

  // ── Voice mock ─────────────────────────────────────────────────────────────
  const toggleVoice = () => {
    setIsRecording((r) => {
      if (!r) {
        // In production: navigator.mediaDevices.getUserMedia(...)
        setTimeout(() => {
          setIsRecording(false);
          setText((t) => t + " [voice note]");
        }, 3000);
      }
      return !r;
    });
  };

  const hasSuggestions = slashSuggestions.length > 0 || mentionSuggestions.length > 0;

  return (
    <div
      className={`relative px-4 md:px-5 py-3 border-t border-border bg-background/95 backdrop-blur shrink-0 transition-all ${
        isDragging ? "ring-2 ring-primary ring-inset bg-primary/5" : ""
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* ── Drag overlay label ─────────────────────────────────────────────── */}
      {isDragging && (
        <div className="absolute inset-0 z-20 flex items-center justify-center rounded-xl border-2 border-dashed border-primary bg-primary/10 pointer-events-none">
          <p className="text-primary font-semibold text-sm">Drop files to attach</p>
        </div>
      )}

      {/* ── Suggestion dropdown ────────────────────────────────────────────── */}
      {hasSuggestions && (
        <div className="absolute bottom-full left-4 right-4 mb-2 bg-background border border-border rounded-2xl shadow-2xl overflow-hidden z-30">
          {slashSuggestions.length > 0 && (
            <>
              <div className="px-3 py-1.5 border-b border-border bg-muted/40">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Commands</p>
              </div>
              {slashSuggestions.map((cmd, i) => (
                <button
                  key={cmd.trigger}
                  onClick={() => applySlash(cmd)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                    i === selectedSuggestion ? "bg-primary/10 text-primary" : "hover:bg-muted/60"
                  }`}
                >
                  <span className="text-xl w-7 shrink-0">{cmd.icon}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">{cmd.trigger}</p>
                    <p className="text-xs text-muted-foreground truncate">{cmd.desc}</p>
                  </div>
                </button>
              ))}
            </>
          )}

          {mentionSuggestions.length > 0 && (
            <>
              <div className="px-3 py-1.5 border-b border-border bg-muted/40">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">People</p>
              </div>
              {mentionSuggestions.map((m, i) => (
                <button
                  key={m.id}
                  onClick={() => applyMention(m)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                    i === selectedSuggestion ? "bg-primary/10 text-primary" : "hover:bg-muted/60"
                  }`}
                >
                  <span className="h-7 w-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold uppercase">
                    {m.name.charAt(0)}
                  </span>
                  <p className="text-sm font-medium text-foreground">@{m.name}</p>
                </button>
              ))}
            </>
          )}
        </div>
      )}

      {/* ── AI quick suggestions ───────────────────────────────────────────── */}
      {showAI && !hasSuggestions && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          <p className="w-full text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-0.5">
            ✨ AI Suggestions
          </p>
          {AI_SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => { setText(s); setShowAI(false); inputRef.current?.focus(); }}
              className="text-xs px-3 py-1.5 rounded-full border border-border bg-muted/60 hover:bg-primary/10 hover:border-primary/40 hover:text-primary transition-colors text-muted-foreground"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* ── Attachments preview ────────────────────────────────────────────── */}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {attachments.map((f, idx) => (
            <div key={idx} className="relative flex items-center gap-2 bg-muted/60 border border-border rounded-xl px-3 py-2 max-w-[200px]">
              {f.type.startsWith("image/") ? (
                <img src={f.url} alt={f.name} className="h-8 w-8 rounded object-cover shrink-0" />
              ) : f.type.includes("pdf") ? (
                <FileText className="h-6 w-6 text-red-400 shrink-0" />
              ) : (
                <ImageIcon className="h-6 w-6 text-blue-400 shrink-0" />
              )}
              <div className="min-w-0">
                <p className="text-xs font-medium text-foreground truncate">{f.name}</p>
                <p className="text-[10px] text-muted-foreground">{(f.size / 1024).toFixed(1)} KB</p>
              </div>
              <button onClick={() => removeAttachment(idx)} className="absolute -top-1.5 -right-1.5 h-4 w-4 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center">
                <X className="w-2.5 h-2.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── Main input row ─────────────────────────────────────────────────── */}
      <div className="flex items-end gap-2 bg-muted/50 border border-border focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/20 rounded-2xl px-3 py-2 transition-all">
        {/* Left buttons */}
        <div className="flex items-center gap-0.5 shrink-0 pb-0.5">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-full transition-colors"
            title="Attach file"
          >
            <Paperclip className="w-4 h-4" />
          </button>
          <button
            className="p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-full transition-colors"
            title="Attach task"
          >
            <CheckCircle2 className="w-4 h-4" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => addFiles(e.target.files)}
          />
        </div>

        {/* Text input */}
        <input
          ref={inputRef}
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="Message… (/ for commands, @ to mention)"
          className="flex-1 text-sm bg-transparent outline-none placeholder:text-muted-foreground text-foreground py-1.5 min-w-0"
        />

        {/* Right buttons */}
        <div className="flex items-center gap-0.5 shrink-0 pb-0.5">
          <button className="p-1.5 text-muted-foreground hover:text-foreground rounded-full transition-colors" title="Emoji">
            <SmilePlus className="w-4 h-4" />
          </button>
          <button
            onClick={toggleVoice}
            className={`p-1.5 rounded-full transition-colors ${
              isRecording
                ? "bg-destructive/20 text-destructive animate-pulse"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
            title={isRecording ? "Stop recording" : "Voice message"}
          >
            {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>
          <button
            onClick={handleSend}
            disabled={!text.trim() && attachments.length === 0}
            className="flex items-center justify-center h-8 w-8 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 transition-all shadow-sm"
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Hint row */}
      <p className="text-[11px] text-muted-foreground mt-1.5 px-1 flex items-center gap-2">
        <span><kbd className="px-1 py-0.5 rounded bg-muted font-mono text-[10px]">Enter</kbd> send</span>
        <span className="opacity-50">·</span>
        <span className="font-mono">/</span> commands
        <span className="opacity-50">·</span>
        <span className="font-mono">@</span> mention
        <span className="opacity-50">·</span>
        Drag &amp; drop files
      </p>
    </div>
  );
}
