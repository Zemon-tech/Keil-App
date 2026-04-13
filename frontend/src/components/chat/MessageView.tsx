// src/components/chat/MessageView.tsx

import { useState, useRef, useEffect } from "react";
import { useChatMessages, useSendMessage, useChatChannels, useEditMessage, useDeleteMessage, usePinMessage, useReactMessage, useTaskFromMessage } from "@/hooks/api/useChat";
import { useChatStore } from "@/store/useChatStore";
import {
  CheckCheck, SmilePlus, MessageSquareReply,
  Pin, Languages, Pencil, Trash2, CheckCircle2, Search,
  Menu,
} from "lucide-react";
import { getSocket } from "@/lib/socket";
import { Skeleton } from "@/components/ui/skeleton";
import { useMe } from "@/hooks/api/useMe";
import { GroupSettingsDialog } from "./GroupSettingsDialog";
import { SmartInput } from "./SmartInput";
import { MessageTaskModal } from "./MessageTaskModal";
import type { ChatMessage } from "@/hooks/api/useChat";

interface MessageViewProps {
  channelId: string;
  onOpenSidebar?: () => void;
}

const QUICK_EMOJIS = ["👍", "❤️", "😂", "🔥", "👀", "✅"];

// ── Render message content with @mentions, `code`, ```blocks``` ──────────────
function renderContent(content: string) {
  const codeBlockRe = /```([\s\S]*?)```/g;
  const parts: React.ReactNode[] = [];
  let last = 0;
  let match: RegExpExecArray | null;

  codeBlockRe.lastIndex = 0;
  while ((match = codeBlockRe.exec(content)) !== null) {
    if (match.index > last) parts.push(renderInline(content.slice(last, match.index), match.index));
    parts.push(
      <pre key={`block-${match.index}`} className="mt-1.5 mb-1 bg-black/25 rounded-xl px-3 py-2.5 text-xs font-mono overflow-x-auto whitespace-pre-wrap border border-white/10 leading-relaxed">
        {match[1].trim()}
      </pre>
    );
    last = match.index + match[0].length;
  }
  if (last < content.length) parts.push(renderInline(content.slice(last), last));
  return <>{parts}</>;
}

function renderInline(text: string, keyBase: number = 0) {
  const parts: React.ReactNode[] = [];
  const combined = /`([^`]+)`|@(\w+)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  combined.lastIndex = 0;
  while ((m = combined.exec(text)) !== null) {
    if (m.index > last) parts.push(<span key={`t-${keyBase}-${m.index}`}>{text.slice(last, m.index)}</span>);
    if (m[1]) {
      parts.push(<code key={`c-${keyBase}-${m.index}`} className="bg-black/20 px-1.5 py-0.5 rounded text-xs font-mono border border-white/10">{m[1]}</code>);
    } else if (m[2]) {
      parts.push(<span key={`m-${keyBase}-${m.index}`} className="text-blue-300 font-semibold cursor-pointer hover:underline">@{m[2]}</span>);
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(<span key={`tail-${keyBase}`}>{text.slice(last)}</span>);
  return <span key={keyBase}>{parts}</span>;
}

// ── Animated typing dots ──────────────────────────────────────────────────────
function TypingDots() {
  return (
    <span className="inline-flex items-end gap-[3px] h-4">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce"
          style={{ animationDelay: `${i * 150}ms`, animationDuration: "900ms" }}
        />
      ))}
    </span>
  );
}

export function MessageView({ channelId, onOpenSidebar }: MessageViewProps) {
  const { data: channels = [] } = useChatChannels();
  const currentChannel = channels.find((c) => c.id === channelId);
  const { data: messages = [], isLoading } = useChatMessages(channelId);
  const { data: me } = useMe();
  const sendMessage = useSendMessage();
  const {
    typingUsers, openThread,
    openSearch,
  } = useChatStore();

  const editMessage = useEditMessage();
  const deleteMessage = useDeleteMessage();
  const pinMessage = usePinMessage();
  const reactMessage = useReactMessage();
  const taskMessage = useTaskFromMessage();

  const [emojiPickerMsgId, setEmojiPickerMsgId] = useState<string | null>(null);
  const [hoveredMsgId, setHoveredMsgId] = useState<string | null>(null);
  const [taskMsg, setTaskMsg] = useState<ChatMessage | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typingUsers]);

  const handleSend = (text: string) => {
    if (!text.trim()) return;
    sendMessage(channelId, text.trim());
  };

  const handleTypingStart = () => {
    getSocket()?.emit("typing_start", { channel_id: channelId });
  };

  const handleTypingEnd = () => {
    getSocket()?.emit("typing_end", { channel_id: channelId });
  };

  const myId = me?.user?.id ?? "";

  const displayName = currentChannel?.type === "direct"
    ? (currentChannel.members[0]?.name ?? "Direct Message")
    : (currentChannel?.name ?? "Group");

  const channelTyping = typingUsers[channelId] ?? [];
  const members = currentChannel?.members ?? [];

  return (
    <div className="flex flex-col flex-1 overflow-hidden h-full">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 md:px-5 py-3.5 border-b border-border bg-background/95 backdrop-blur shrink-0 shadow-sm z-20">
        <div className="flex items-center gap-3">
          {onOpenSidebar && (
            <button
              onClick={onOpenSidebar}
              className="flex md:hidden p-2 -ml-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-full transition-colors"
            >
              <Menu className="h-5 w-5" />
            </button>
          )}
          <span className="hidden sm:flex h-9 w-9 rounded-full bg-primary/10 items-center justify-center text-sm font-bold text-primary uppercase shrink-0">
            {displayName.charAt(0)}
          </span>
          <div>
            <h2 className="font-semibold text-base text-foreground leading-tight">{displayName}</h2>
            <p className="text-[11px] font-medium text-emerald-500">
              {currentChannel?.type === "group"
                ? `${currentChannel.members.length} members`
                : "● Active now"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={openSearch}
            className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-full transition-colors"
            title="Search"
          >
            <Search className="w-4 h-4" />
          </button>
          {currentChannel?.type === "group" && <GroupSettingsDialog channel={currentChannel} />}
        </div>
      </div>

      {/* ── Message list ────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 md:px-5 py-4 space-y-1 scroll-smooth">

        {isLoading && (
          <div className="space-y-5">
            {[...Array(5)].map((_, i) => (
              <div key={i} className={`flex flex-col gap-1 ${i % 2 === 0 ? "items-start" : "items-end"}`}>
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-12 w-2/3 rounded-2xl" />
              </div>
            ))}
          </div>
        )}

        {messages.map((msg: ChatMessage, idx: number) => {
          const isMine = msg.sender.id === myId;
          const prev = messages[idx - 1];
          const isFirstInGroup = !prev || prev.sender.id !== msg.sender.id;
          const msgReactions = msg.reactions ?? {};

          return (
            <div
              key={msg.id}
              className={`flex flex-col w-full group ${isMine ? "items-end" : "items-start"} ${isFirstInGroup ? "mt-4" : "mt-0.5"}`}
              onMouseEnter={() => setHoveredMsgId(msg.id)}
              onMouseLeave={() => { setHoveredMsgId(null); setEmojiPickerMsgId(null); }}
            >
              {/* Sender label + avatar — first in group only */}
              {isFirstInGroup && (
                <div className={`flex items-center gap-2 mb-1.5 ${isMine ? "flex-row-reverse" : "flex-row"}`}>
                  <span className={`h-6 w-6 rounded-full flex items-center justify-center text-[11px] font-bold uppercase shrink-0 ${
                    isMine ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  }`}>
                    {msg.sender.name.charAt(0)}
                  </span>
                  <span className="text-[12px] font-semibold text-foreground">
                    {isMine ? "You" : msg.sender.name}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              )}

              {/* Bubble row */}
              <div className={`relative flex items-start gap-2 max-w-[80%] md:max-w-[65%] ${isMine ? "flex-row-reverse" : "flex-row"}`}>

                {/* ── Hover Action Bar ── */}
                {hoveredMsgId === msg.id && (
                  <div className={`
                    absolute top-0 z-30 flex items-center bg-background border border-border shadow-lg rounded-full px-1 py-1 shrink-0
                    ${isMine ? "right-full mr-2" : "left-full ml-2"}
                  `}>
                    {/* Emoji picker toggle */}
                    <div className="relative">
                      <button
                        className="p-1.5 text-muted-foreground hover:text-primary rounded-full hover:bg-muted transition-colors"
                        title="React"
                        onClick={() => setEmojiPickerMsgId(emojiPickerMsgId === msg.id ? null : msg.id)}
                      >
                        <SmilePlus className="w-3.5 h-3.5" />
                      </button>
                      {emojiPickerMsgId === msg.id && (
                        <div className={`absolute top-9 z-40 flex gap-1 bg-background border border-border shadow-xl rounded-2xl px-2 py-1.5 ${
                          isMine ? "right-0" : "left-0"
                        }`}>
                          {QUICK_EMOJIS.map((e) => (
                            <button
                              key={e}
                              onClick={() => { reactMessage.mutate({channelId, messageId: msg.id, emoji: e}); setEmojiPickerMsgId(null); }}
                              className="text-xl hover:scale-125 transition-transform p-0.5"
                            >
                              {e}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <button className="p-1.5 text-muted-foreground hover:text-primary rounded-full hover:bg-muted transition-colors" title="Reply in Thread" onClick={() => openThread(msg)}>
                      <MessageSquareReply className="w-3.5 h-3.5" />
                    </button>
                    <button className={`p-1.5 rounded-full transition-colors ${msg.is_pinned ? "text-amber-500 bg-amber-500/10 hover:bg-amber-500/20" : "text-muted-foreground hover:text-amber-500 hover:bg-muted"}`} title={msg.is_pinned ? "Unpin" : "Pin"} onClick={() => pinMessage.mutate({ channelId, messageId: msg.id, is_pinned: !msg.is_pinned })}>
                      <Pin className="w-3.5 h-3.5" />
                    </button>
                    <button
                      className="p-1.5 text-muted-foreground hover:text-emerald-500 rounded-full hover:bg-muted transition-colors"
                      title="Convert to Task"
                      onClick={() => setTaskMsg(msg)}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    </button>
                    <button className="p-1.5 text-muted-foreground hover:text-blue-400 rounded-full hover:bg-muted transition-colors" title="Translate">
                      <Languages className="w-3.5 h-3.5" />
                    </button>
                    {isMine && !msg.is_deleted && (
                      <>
                        <button className="p-1.5 text-muted-foreground hover:text-blue-500 rounded-full hover:bg-muted transition-colors" title="Edit" onClick={() => {
                          const newContent = prompt("Edit message:", msg.content);
                          if (newContent && newContent !== msg.content) editMessage.mutate({ channelId, messageId: msg.id, content: newContent });
                        }}>
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button className="p-1.5 text-muted-foreground hover:text-destructive rounded-full hover:bg-muted transition-colors" title="Delete" onClick={() => {
                          if (confirm("Are you sure you want to delete this message?")) deleteMessage.mutate({ channelId, messageId: msg.id });
                        }}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                )}

                {/* Message bubble */}
                <div className={`px-4 py-2.5 text-[15px] leading-relaxed shadow-sm ${
                  isMine
                    ? msg.is_deleted ? "bg-muted text-muted-foreground italic rounded-2xl rounded-tr-sm" : "bg-primary text-primary-foreground rounded-2xl rounded-tr-sm"
                    : msg.is_deleted ? "bg-muted text-muted-foreground italic border-border rounded-2xl rounded-tl-sm" : "bg-card border border-border text-foreground rounded-2xl rounded-tl-sm"
                }`}>
                  {renderContent(msg.content)}
                  {msg.is_edited && !msg.is_deleted && <span className="text-[10px] opacity-70 ml-2">(edited)</span>}
                  {msg.threadCount ? <span className="text-[11px] text-blue-400 font-semibold block mt-1 cursor-pointer hover:underline" onClick={() => openThread(msg)}>💬 {msg.threadCount} Replies</span> : null}
                </div>
              </div>

              {/* Reactions */}
              {Object.keys(msgReactions).length > 0 && (
                <div className={`flex flex-wrap gap-1 mt-1 ${isMine ? "justify-end" : "justify-start"}`}>
                  {Object.entries(msgReactions).map(([emoji, users]) => (
                    <button
                      key={emoji}
                      onClick={() => reactMessage.mutate({ channelId, messageId: msg.id, emoji })}
                      className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border transition-colors ${
                        users.includes(myId)
                          ? "bg-primary/10 border-primary/40 text-primary"
                          : "bg-muted/60 border-border text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      <span>{emoji}</span>
                      <span className="font-semibold">{users.length}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Timestamp ticks (secondary messages in group) */}
              {!isFirstInGroup && (
                <div className={`flex items-center gap-1 text-[10px] text-muted-foreground mt-0.5 ${isMine ? "flex-row-reverse" : "flex-row"}`}>
                  <span>{new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                  {isMine && <CheckCheck className="w-3 h-3 text-primary" />}
                </div>
              )}
            </div>
          );
        })}

        {/* Typing indicator */}
        {channelTyping.length > 0 && (
          <div className="flex items-center gap-2 mt-3">
            <div className="flex -space-x-1.5">
              {channelTyping.slice(0, 3).map((u) => (
                <span key={u.userId} className="h-6 w-6 rounded-full bg-muted border-2 border-background flex items-center justify-center text-[10px] font-bold uppercase">
                  {u.name.charAt(0)}
                </span>
              ))}
            </div>
            <div className="flex items-center gap-2 bg-card border border-border rounded-2xl rounded-tl-sm px-3 py-2 text-[13px] text-muted-foreground shadow-sm">
              <TypingDots />
              <span className="italic">
                {channelTyping.map((u) => u.name).join(", ")}
                {channelTyping.length === 1 ? " is" : " are"} typing
              </span>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* ── Smart Input ─────────────────────────────────────────────────────── */}
      <SmartInput
        channelId={channelId}
        members={members}
        onSend={handleSend}
        onTypingStart={handleTypingStart}
        onTypingEnd={handleTypingEnd}
      />

      {/* ── Message → Task Modal ─────────────────────────────────────────────── */}
      {taskMsg && (
        <MessageTaskModal
          message={taskMsg}
          members={members}
          onClose={() => setTaskMsg(null)}
          onCreated={() => {
            taskMessage.mutate({ channelId, messageId: taskMsg.id });
          }}
        />
      )}
    </div>
  );
}
