// src/components/chat/ChatDemoView.tsx
// Zero-backend demo mode — renders mock conversations with full Huly/Slack feature set

import { useState, useRef, useEffect } from "react";
import {
  SmilePlus, MessageSquareReply, Pin, CheckCircle2,
  Languages, Pencil, Trash2, CheckCheck, Mic, File,
  ArrowLeft, Sparkles,
} from "lucide-react";
import { DEMO_CHANNELS, DEMO_MY_ID, type MockChannel, type MockMessage } from "@/data/mockChatData";
import { useChatStore } from "@/store/useChatStore";
import type { ChatMessage } from "@/hooks/api/useChat";
import { MessageTaskModal } from "./MessageTaskModal";

const QUICK_EMOJIS = ["👍", "❤️", "😂", "🔥", "👀", "✅"];

// ── Render message content with code blocks + mentions ────────────────────
function renderContent(content: string) {
  const codeRe = /```([\s\S]*?)```/g;
  const parts: React.ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  codeRe.lastIndex = 0;
  while ((m = codeRe.exec(content)) !== null) {
    if (m.index > last) parts.push(renderInline(content.slice(last, m.index), `pre-${m.index}`));
    parts.push(
      <pre key={`block-${m.index}`} className="mt-1.5 mb-1 bg-black/25 rounded-xl px-3 py-2.5 text-xs font-mono overflow-x-auto whitespace-pre-wrap border border-white/10 leading-relaxed">
        {m[1].trim()}
      </pre>
    );
    last = m.index + m[0].length;
  }
  if (last < content.length) parts.push(renderInline(content.slice(last), "tail"));
  return <>{parts}</>;
}

function renderInline(text: string, key: string) {
  const parts: React.ReactNode[] = [];
  const re = /`([^`]+)`|@(\w+)|\*\*([^*]+)\*\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  re.lastIndex = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    if (m[1]) parts.push(<code key={`c-${m.index}`} className="bg-black/20 px-1.5 py-0.5 rounded text-xs font-mono border border-white/10">{m[1]}</code>);
    else if (m[2]) parts.push(<span key={`at-${m.index}`} className="text-blue-300 font-semibold">@{m[2]}</span>);
    else if (m[3]) parts.push(<strong key={`b-${m.index}`}>{m[3]}</strong>);
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <span key={key}>{parts}</span>;
}

function TypingDots() {
  return (
    <span className="inline-flex items-end gap-[3px] h-4">
      {[0, 1, 2].map((i) => (
        <span key={i} className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce"
          style={{ animationDelay: `${i * 150}ms`, animationDuration: "900ms" }} />
      ))}
    </span>
  );
}

const USER_COLORS: Record<string, string> = {
  u1: "bg-violet-500",
  u2: "bg-blue-500",
  u3: "bg-emerald-500",
  u4: "bg-amber-500",
  bot: "bg-gradient-to-br from-violet-600 to-indigo-500",
};

// ── Channel sidebar ────────────────────────────────────────────────────────
function DemoSidebar({
  channels,
  active,
  onSelect,
}: {
  channels: MockChannel[];
  active: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="flex flex-col gap-0.5 p-2 w-full">
      {channels.map((ch) => (
        <button
          key={ch.id}
          onClick={() => onSelect(ch.id)}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all ${
            active === ch.id
              ? "bg-primary text-primary-foreground"
              : "hover:bg-muted/60 text-foreground"
          }`}
        >
          <span className="text-lg shrink-0">{ch.emoji}</span>
          <div className="min-w-0">
            <p className={`text-sm font-semibold truncate ${active === ch.id ? "text-primary-foreground" : ""}`}>
              {ch.name}
            </p>
            <p className={`text-xs truncate ${active === ch.id ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
              {ch.description}
            </p>
          </div>
        </button>
      ))}
    </div>
  );
}

// ── Message bubble ─────────────────────────────────────────────────────────
function DemoMessageBubble({
  msg,
  isFirstInGroup,
  onEdit,
  onDelete,
  onPin,
  onTask,
}: {
  msg: MockMessage & { is_pinned?: boolean, is_deleted?: boolean, is_edited?: boolean };
  isFirstInGroup: boolean;
  onEdit: (id: string, text: string) => void;
  onDelete: (id: string) => void;
  onPin: (id: string) => void;
  onTask: (msg: any) => void;
}) {
  const isMine = msg.sender.id === DEMO_MY_ID;
  const isBot = msg.sender.id === "bot";
  const [localReactions, setLocalReactions] = useState<Record<string, string[]>>(msg.reactions ?? {});
  const [hovered, setHovered] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);

  const toggle = (emoji: string) => {
    setLocalReactions((prev) => {
      const users = prev[emoji] ?? [];
      const next = users.includes(DEMO_MY_ID)
        ? users.filter((u) => u !== DEMO_MY_ID)
        : [...users, DEMO_MY_ID];
      if (next.length === 0) { const r = { ...prev }; delete r[emoji]; return r; }
      return { ...prev, [emoji]: next };
    });
    setEmojiOpen(false);
  };

  const color = USER_COLORS[msg.sender.id] ?? "bg-slate-500";

  return (
    <div
      className={`flex flex-col w-full ${isMine ? "items-end" : "items-start"} ${isFirstInGroup ? "mt-4" : "mt-0.5"}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setEmojiOpen(false); }}
    >
      {/* Sender row */}
      {isFirstInGroup && (
        <div className={`flex items-center gap-2 mb-1.5 ${isMine ? "flex-row-reverse" : "flex-row"}`}>
          <span className={`h-6 w-6 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0 ${color}`}>
            {isBot ? "✨" : msg.sender.name.charAt(0)}
          </span>
          <span className="text-[12px] font-semibold text-foreground">
            {isMine ? "You" : msg.sender.name}
            {msg.sender.role && <span className="ml-1 text-muted-foreground font-normal">· {msg.sender.role}</span>}
          </span>
          <span className="text-[11px] text-muted-foreground">
            {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>
      )}

      {/* Bubble + toolbar */}
      <div className={`relative flex items-start gap-2 max-w-[80%] md:max-w-[68%] ${isMine ? "flex-row-reverse" : "flex-row"}`}>

        {/* Hover toolbar */}
        {hovered && (
          <div className={`absolute top-0 z-30 flex items-center bg-background border border-border shadow-lg rounded-full px-1 py-1 ${
            isMine ? "right-full mr-2" : "left-full ml-2"
          }`}>
            <div className="relative">
              <button className="p-1.5 text-muted-foreground hover:text-primary rounded-full hover:bg-muted" onClick={() => setEmojiOpen((e) => !e)}>
                <SmilePlus className="w-3.5 h-3.5" />
              </button>
              {emojiOpen && (
                <div className={`absolute top-9 z-40 flex gap-1 bg-background border border-border shadow-xl rounded-2xl px-2 py-1.5 ${isMine ? "right-0" : "left-0"}`}>
                  {QUICK_EMOJIS.map((e) => (
                    <button key={e} onClick={() => toggle(e)} className="text-xl hover:scale-125 transition-transform p-0.5">{e}</button>
                  ))}
                </div>
              )}
            </div>
            <button className="p-1.5 text-muted-foreground hover:text-primary rounded-full hover:bg-muted" title="Reply in Thread" onClick={() => useChatStore.getState().openThread(toChatMessage(msg))}><MessageSquareReply className="w-3.5 h-3.5" /></button>
            <button className={`p-1.5 rounded-full transition-colors ${msg.is_pinned ? "text-amber-500 bg-amber-500/10 hover:bg-amber-500/20" : "text-muted-foreground hover:text-amber-500 hover:bg-muted"}`} title={msg.is_pinned ? "Unpin" : "Pin"} onClick={() => onPin(msg.id)}><Pin className="w-3.5 h-3.5" /></button>
            <button className="p-1.5 text-muted-foreground hover:text-emerald-500 rounded-full hover:bg-muted" title="Create Task" onClick={() => onTask(msg)}><CheckCircle2 className="w-3.5 h-3.5" /></button>
            <button className="p-1.5 text-muted-foreground hover:text-blue-400 rounded-full hover:bg-muted" title="Translate"><Languages className="w-3.5 h-3.5" /></button>
            {isMine && !msg.is_deleted && (
              <>
                <button className="p-1.5 text-muted-foreground hover:text-blue-500 rounded-full hover:bg-muted" onClick={() => {
                  const newContent = prompt("Edit message:", msg.content);
                  if (newContent && newContent !== msg.content) onEdit(msg.id, newContent);
                }}><Pencil className="w-3.5 h-3.5" /></button>
                <button className="p-1.5 text-muted-foreground hover:text-destructive rounded-full hover:bg-muted" onClick={() => {
                  if (confirm("Delete this message?")) onDelete(msg.id);
                }}><Trash2 className="w-3.5 h-3.5" /></button>
              </>
            )}
          </div>
        )}

        <div className={`relative px-4 py-2.5 text-[15px] leading-relaxed shadow-sm ${
          msg.is_deleted
            ? isMine ? "bg-muted text-muted-foreground italic rounded-2xl rounded-tr-sm" : "bg-muted text-muted-foreground italic border-border rounded-2xl rounded-tl-sm"
            : isBot
              ? "bg-gradient-to-br from-violet-500/10 to-indigo-500/10 border border-violet-500/30 text-foreground rounded-2xl rounded-tl-sm"
              : isMine
                ? "bg-primary text-primary-foreground rounded-2xl rounded-tr-sm"
                : msg.isHighlighted
                  ? "bg-amber-500/10 border border-amber-500/40 text-foreground rounded-2xl rounded-tl-sm"
                  : "bg-card border border-border text-foreground rounded-2xl rounded-tl-sm"
        }`}>
          {/* Special message types */}
          {msg.type === "voice" ? (
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center">
                <Mic className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium">{msg.content}</p>
                <div className="flex items-center gap-1 mt-1">
                  {[...Array(12)].map((_, i) => (
                    <div key={i} className="w-1 rounded-full bg-current opacity-40" style={{ height: `${Math.random() * 16 + 4}px` }} />
                  ))}
                </div>
              </div>
            </div>
          ) : msg.type === "file" && msg.attachment ? (
            <div className="flex flex-col gap-2">
              <p className="text-sm opacity-80">{renderContent(msg.content.replace(msg.attachment.name, "").trim())}</p>
              <div className="flex items-center gap-2 bg-black/10 rounded-xl px-3 py-2.5 border border-white/10">
                {msg.attachment.kind === "image" ? (
                  <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white text-xs font-bold">IMG</div>
                ) : (
                  <File className="w-6 h-6 text-current opacity-70" />
                )}
                <div>
                  <p className="text-sm font-semibold">{msg.attachment.name}</p>
                  <p className="text-xs opacity-60">Click to download</p>
                </div>
              </div>
            </div>
          ) : msg.type === "ai" ? (
            <div>
              <div className="flex items-center gap-1.5 mb-1.5">
                <Sparkles className="w-3.5 h-3.5 text-violet-400" />
                <span className="text-[11px] font-semibold text-violet-400 uppercase tracking-wider">Keil AI</span>
              </div>
              {renderContent(msg.content)}
            </div>
          ) : (
            msg.is_deleted ? "This message was deleted." : renderContent(msg.content)
          )}
          {msg.is_edited && !msg.is_deleted && <span className="text-[10px] opacity-70 ml-2">(edited)</span>}
        </div>
      </div>

      {/* Thread count indicator */}
      {msg.threadCount && msg.threadCount > 0 && (
        <button className={`flex items-center gap-1.5 mt-1 text-xs font-semibold text-primary hover:underline ${isMine ? "flex-row-reverse" : "flex-row"}`}>
          <MessageSquareReply className="w-3 h-3" />
          {msg.threadCount} {msg.threadCount === 1 ? "reply" : "replies"}
        </button>
      )}

      {/* Reactions */}
      {Object.keys(localReactions).length > 0 && (
        <div className={`flex flex-wrap gap-1 mt-1 ${isMine ? "justify-end" : "justify-start"}`}>
          {Object.entries(localReactions).map(([emoji, users]) => (
            <button
              key={emoji}
              onClick={() => toggle(emoji)}
              className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border transition-colors ${
                users.includes(DEMO_MY_ID)
                  ? "bg-primary/10 border-primary/40 text-primary"
                  : "bg-muted/60 border-border text-muted-foreground hover:bg-muted"
              }`}
            >
              {emoji} <span className="font-semibold">{users.length}</span>
            </button>
          ))}
        </div>
      )}

      {/* Timestamp ticks for secondary messages */}
      {!isFirstInGroup && (
        <div className={`flex items-center gap-1 text-[10px] text-muted-foreground mt-0.5 ${isMine ? "flex-row-reverse" : "flex-row"}`}>
          <span>{new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
          {isMine && <CheckCheck className="w-3 h-3 text-primary" />}
        </div>
      )}
    </div>
  );
}

// ── Main Demo View ─────────────────────────────────────────────────────────
export function ChatDemoView({ onBack }: { onBack: () => void }) {
  const [activeChannelId, setActiveChannelId] = useState(DEMO_CHANNELS[0].id);
  const [demoText, setDemoText] = useState("");
  const [localMessages, setLocalMessages] = useState<Record<string, any[]>>({});
  const [showSidebar, setShowSidebar] = useState(true);
  const [taskMsg, setTaskMsg] = useState<any>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const { openThread } = useChatStore();

  const channel = DEMO_CHANNELS.find((c) => c.id === activeChannelId)!;
  const initialMessages = channel.messages;
  
  // Combine defaults and local overrides
  const overrides = localMessages[activeChannelId] ?? [];
  const overlayMap = new Map(overrides.map(m => [m.id, m]));
  
  const allMessages = [...initialMessages, ...overrides.filter(m => !m.isVirtualOverride)]
    .map((m: any) => overlayMap.get(m.id) ?? m);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeChannelId, localMessages]);

  const sendDemo = () => {
    if (!demoText.trim()) return;
    const msg: MockMessage = {
      id: `local-${Date.now()}`,
      sender: { id: DEMO_MY_ID, name: "Ritik" },
      content: demoText.trim(),
      created_at: new Date().toISOString(),
    };
    setLocalMessages((prev) => ({
      ...prev,
      [activeChannelId]: [...(prev[activeChannelId] ?? []), msg],
    }));
    setDemoText("");
  };

  const overrideMsg = (id: string, updates: any) => {
    const existingDefault = initialMessages.find(m => m.id === id);
    setLocalMessages((prev) => {
      const channelMsgs = prev[activeChannelId] || [];
      const clone = [...channelMsgs];
      const idx = clone.findIndex(m => m.id === id);
      if (idx >= 0) {
        clone[idx] = { ...clone[idx], ...updates };
      } else if (existingDefault) {
        clone.push({ ...existingDefault, ...updates, isVirtualOverride: true });
      }
      return { ...prev, [activeChannelId]: clone };
    });
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Demo banner */}
      <div className="flex items-center justify-between px-4 py-2 bg-gradient-to-r from-violet-600/10 to-indigo-600/10 border-b border-violet-500/20 shrink-0">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-violet-400" />
          <p className="text-xs font-semibold text-violet-400">Demo Mode — Realistic Startup Chat Preview</p>
        </div>
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to real chat
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* ── Demo Sidebar ── */}
        <div className={`border-r border-border bg-background flex flex-col shrink-0 overflow-y-auto ${
          showSidebar ? "w-56 lg:w-64" : "hidden"
        }`}>
          <div className="p-3 border-b border-border">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Demo Channels</p>
          </div>
          <DemoSidebar
            channels={DEMO_CHANNELS}
            active={activeChannelId}
            onSelect={(id) => { setActiveChannelId(id); setShowSidebar(window.innerWidth >= 768); }}
          />
        </div>

        {/* ── Chat area ── */}
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3.5 border-b border-border bg-background/95 shrink-0">
            <div className="flex items-center gap-3">
              <button className="md:hidden p-1.5 text-muted-foreground" onClick={() => setShowSidebar(true)}>
                ←
              </button>
              <span className="text-xl">{channel.emoji}</span>
              <div>
                <h2 className="font-bold text-base text-foreground">{channel.name}</h2>
                <p className="text-xs text-muted-foreground">{channel.description}</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              {["🟢", "🟡", "🔴"].map((dot, i) => (
                <span key={i} className="text-xs">{dot}</span>
              ))}
              <span className="text-[11px] text-muted-foreground ml-0.5">3 online</span>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 md:px-5 py-4">
            {allMessages.map((msg, idx) => {
              const prev = allMessages[idx - 1];
              const isFirstInGroup = !prev || prev.sender.id !== msg.sender.id;
              return (
                <DemoMessageBubble 
                  key={msg.id} 
                  msg={msg} 
                  isFirstInGroup={isFirstInGroup} 
                  onEdit={(id, text) => overrideMsg(id, { content: text, is_edited: true })}
                  onDelete={(id) => overrideMsg(id, { is_deleted: true })}
                  onPin={(id) => overrideMsg(id, { is_pinned: !msg.is_pinned })}
                  onTask={(m) => setTaskMsg(m)}
                />
              );
            })}

            {/* Mock typing indicator */}
            <div className="flex items-center gap-2 mt-4">
              <div className="flex -space-x-1.5">
                <span className="h-6 w-6 rounded-full bg-emerald-500 border-2 border-background flex items-center justify-center text-[10px] font-bold text-white">P</span>
              </div>
              <div className="flex items-center gap-2 bg-card border border-border rounded-2xl rounded-tl-sm px-3 py-2">
                <TypingDots />
                <span className="text-xs text-muted-foreground italic">Priya is typing</span>
              </div>
            </div>

            <div ref={bottomRef} />
          </div>

          {/* Demo input */}
          <div className="px-4 py-3 border-t border-border bg-background/95 shrink-0">
            <div className="flex items-center gap-2 bg-muted/50 border border-border focus-within:border-primary/50 rounded-2xl px-3 py-2 transition-all">
              <input
                value={demoText}
                onChange={(e) => setDemoText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendDemo()}
                placeholder={`Message ${channel.name}… (/ for commands, @ to mention)`}
                className="flex-1 text-sm bg-transparent outline-none placeholder:text-muted-foreground"
              />
              <button
                onClick={sendDemo}
                disabled={!demoText.trim()}
                className="px-3 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-semibold disabled:opacity-40 transition-all"
              >
                Send
              </button>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1.5 px-1">
              ✨ Demo mode — Messages appear locally. Connect backend to persist.
            </p>
          </div>
        </div>
      </div>

      {taskMsg && (
        <MessageTaskModal
          message={toChatMessage(taskMsg)}
          members={[{ id: DEMO_MY_ID, name: "Ritik" }]}
          onClose={() => setTaskMsg(null)}
          onCreated={() => {}}
        />
      )}
    </div>
  );
}

// Convert MockMessage → ChatMessage shape for openThread compatibility
export function toChatMessage(m: MockMessage): ChatMessage {
  return {
    id: m.id,
    channel_id: "demo",
    sender: { id: m.sender.id, name: m.sender.name },
    content: m.content,
    created_at: m.created_at,
  };
}
