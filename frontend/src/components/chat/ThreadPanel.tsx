// src/components/chat/ThreadPanel.tsx
// Side panel for threaded conversations (Huly superpower)

import { useState, useRef, useEffect } from "react";
import { X, Send, Check, SmilePlus } from "lucide-react";
import { useChatStore } from "@/store/useChatStore";
import { useSendMessage, useThreadMessages } from "@/hooks/api/useChat";
import { useMe } from "@/hooks/api/useMe";
import type { ChatMessage } from "@/hooks/api/useChat";
import { getSocket } from "@/lib/socket";

// Local thread messages are stored in component state (mock; real backend would persist them)
export function ThreadPanel() {
  const { threadMessage, closeThread } = useChatStore();
  const { data: me } = useMe();
  const sendMessage = useSendMessage();

  const { data: threadReplies = [] } = useThreadMessages(
    threadMessage?.channel_id ?? null,
    threadMessage?.id ?? null
  );

  const [text, setText] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [threadReplies]);

  if (!threadMessage) return null;

  const handleSend = () => {
    if (!text.trim()) return;
    sendMessage(threadMessage.channel_id, text.trim(), threadMessage.id);
    getSocket()?.emit("typing_end", { channel_id: threadMessage.channel_id });
    setText("");
  };

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="flex flex-col w-full sm:w-[340px] lg:w-[380px] h-full border-l border-border bg-background shrink-0 animate-in slide-in-from-right duration-200">

      {/* ── Thread Header ── */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-border shrink-0">
        <div>
          <h3 className="font-semibold text-base text-foreground">Thread</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Reply to {threadMessage.sender.name}
          </p>
        </div>
        <button
          onClick={closeThread}
          className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-full transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* ── Parent Message ── */}
      <div className="px-4 py-4 border-b border-border/60 bg-muted/20 shrink-0">
        <div className="flex items-start gap-2.5">
          <span className="flex-shrink-0 h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary uppercase">
            {threadMessage.sender.name.charAt(0)}
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-semibold text-foreground">{threadMessage.sender.name}</span>
              <span className="text-[11px] text-muted-foreground">{formatTime(threadMessage.created_at)}</span>
            </div>
            <p className="text-sm text-foreground leading-relaxed bg-muted/60 px-3 py-2 rounded-xl rounded-tl-sm border border-border">
              {threadMessage.content}
            </p>
          </div>
        </div>
      </div>

      {/* ── Reply Counter ── */}
      {threadReplies.length > 0 && (
        <div className="px-4 py-2 shrink-0">
          <p className="text-xs font-semibold text-primary">
            {threadReplies.length} {threadReplies.length === 1 ? "reply" : "replies"}
          </p>
        </div>
      )}

      {/* ── Reply List ── */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {threadReplies.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground text-sm gap-2 pt-12">
            <p className="text-2xl">💬</p>
            <p className="font-medium">No replies yet</p>
            <p className="text-xs">Be the first to reply in this thread</p>
          </div>
        )}

        {threadReplies.map((reply) => {
          const isMine = reply.sender.id === me?.user?.id;
          return (
            <div key={reply.id} className={`flex items-start gap-2.5 ${isMine ? "flex-row-reverse" : "flex-row"}`}>
              <span className={`flex-shrink-0 h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold uppercase ${
                isMine ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              }`}>
                {reply.sender.name.charAt(0)}
              </span>
              <div className={`flex flex-col gap-1 ${isMine ? "items-end" : "items-start"}`}>
                <div className={`px-3 py-2 rounded-xl text-sm leading-relaxed max-w-[240px] ${
                  isMine
                    ? "bg-primary text-primary-foreground rounded-tr-sm"
                    : "bg-muted/60 border border-border text-foreground rounded-tl-sm"
                }`}>
                  {reply.content}
                </div>
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <span>{formatTime(reply.created_at)}</span>
                  {isMine && <Check className="w-3 h-3 text-primary" />}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* ── Reply Input ── */}
      <div className="p-3 border-t border-border bg-background shrink-0">
        <div className="flex items-center gap-2 bg-muted/40 rounded-2xl px-3 py-1.5 border border-border focus-within:border-primary/40 focus-within:ring-1 focus-within:ring-primary/20 transition-all">
          <button className="p-1 text-muted-foreground hover:text-foreground transition-colors shrink-0">
            <SmilePlus className="w-4 h-4" />
          </button>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Reply in thread..."
            className="flex-1 text-sm bg-transparent outline-none placeholder:text-muted-foreground text-foreground py-1.5"
          />
          <button
            onClick={handleSend}
            disabled={!text.trim()}
            className="p-2 rounded-xl bg-primary text-primary-foreground disabled:opacity-40 hover:bg-primary/90 transition-all shrink-0"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
