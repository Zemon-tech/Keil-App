// src/components/chat/MessageView.tsx

import { useState, useRef, useEffect } from "react";
import { useChatMessages, useSendMessage } from "@/hooks/api/useChat";
import { useChatStore } from "@/store/useChatStore";
import { ArrowLeft, Send, Check } from "lucide-react";
import { getSocket } from "@/lib/socket";
import { Skeleton } from "@/components/ui/skeleton";
import { useMe } from "@/hooks/api/useMe";
import { useChatChannels } from "@/hooks/api/useChat";
import { GroupSettingsDialog } from "./GroupSettingsDialog";

interface MessageViewProps {
  channelId: string;
}

export function MessageView({ channelId }: MessageViewProps) {
  const { data: channels = [] } = useChatChannels();
  const currentChannel = channels.find(c => c.id === channelId);
  const { data: messages = [], isLoading } = useChatMessages(channelId);
  const { data: me } = useMe();
  const sendMessage = useSendMessage();
  const { setActiveChannel, typingUsers } = useChatStore();
  const [text, setText] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null); // invisible div at the bottom
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-scroll: every time the messages array changes, scroll to the bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typingUsers]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setText(e.target.value);
    
    // Typing indicator logic
    const socket = getSocket();
    if (socket) {
      socket.emit("typing_start", { channel_id: channelId });
      
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        socket.emit("typing_end", { channel_id: channelId });
      }, 2000);
    }
  };

  const handleSend = () => {
    if (!text.trim()) return;           // don't send empty messages
    sendMessage(channelId, text.trim()); // emits via socket
    setText("");                          // clear the input
    getSocket()?.emit("typing_end", { channel_id: channelId });
  };

  return (
    <div className="flex flex-col flex-1 overflow-hidden">

      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border">
        <button
          onClick={() => setActiveChannel(null)} // null = show channel list
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" /> Back
        </button>

        {currentChannel?.type === 'group' && (
          <GroupSettingsDialog channel={currentChannel} />
        )}
      </div>

      {/* ── Message list ── */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {isLoading && (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className={`flex flex-col gap-1 ${i % 2 === 0 ? "items-start" : "items-end"}`}>
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-10 w-2/3 rounded-lg" />
              </div>
            ))}
          </div>
        )}

        {messages.map((msg) => {
          const isMine = msg.sender.id === me?.user?.id;
          return (
            <div key={msg.id} className={`flex flex-col gap-1 w-full ${isMine ? "items-end" : "items-start"}`}>
              {/* Sender name */}
              <span className="text-[11px] font-semibold text-foreground">
                {isMine ? "You" : (msg.sender.name ?? "Unknown")}
              </span>

              {/* Message bubble */}
              <p className={`text-sm rounded-lg px-3 py-2 w-fit max-w-[90%] ${isMine ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                {msg.content}
              </p>

              {/* Timestamp & Status */}
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground mr-1">
                <span>
                  {new Date(msg.created_at).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
                {isMine && <Check className="w-3 h-3 text-primary" />}
              </div>
            </div>
          );
        })}

        {/* Typing indicator */}
        {typingUsers[channelId] && typingUsers[channelId].length > 0 && (
          <div className="flex gap-1 text-[11px] text-muted-foreground italic truncate">
            {typingUsers[channelId].map(u => u.name).join(", ")} is typing...
          </div>
        )}

        {/* Invisible anchor — scrolled into view whenever messages change */}
        <div ref={bottomRef} />
      </div>

      {/* ── Send input ── */}
      <div className="flex items-center gap-2 px-3 py-2 border-t border-border">
        <input
          value={text}
          onChange={handleInputChange}
          onKeyDown={(e) => e.key === "Enter" && handleSend()} // Enter to send
          placeholder="Type a message…"
          className="flex-1 text-sm bg-muted rounded-md px-3 py-2 outline-none placeholder:text-muted-foreground"
        />
        <button
          onClick={handleSend}
          disabled={!text.trim()} // disable when input is empty
          className="text-primary hover:text-primary/80 disabled:opacity-40 transition-opacity"
          aria-label="Send message"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>

    </div>
  );
}
