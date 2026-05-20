// src/components/chat/MessageView.tsx

import { useState, useRef, useEffect } from "react";
import { useChatMessages, useSendMessage, useChatChannels, useDeleteChannel } from "@/hooks/api/useChat";
import { useChatStore } from "@/store/useChatStore";
import { ArrowLeft, Send, Check, Trash2, Users } from "lucide-react";
import { getSocket } from "@/lib/socket";
import { Skeleton } from "@/components/ui/skeleton";
import { useMe } from "@/hooks/api/useMe";
import { GroupSettingsDialog } from "./GroupSettingsDialog";
import { motion, AnimatePresence } from "motion/react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface MessageViewProps {
  channelId: string;
  orgId: string | null;
  spaceId: string | null;
}

export function MessageView({ channelId, orgId, spaceId }: MessageViewProps) {
  const { data: channels = [] } = useChatChannels(orgId, spaceId);
  const currentChannel = channels.find((c) => c.id === channelId);
  const { data: messages = [], isLoading } = useChatMessages(channelId, orgId, spaceId);
  const { data: me } = useMe();
  const sendMessage = useSendMessage();
  const deleteChannel = useDeleteChannel(orgId, spaceId);
  const { setActiveChannel, typingUsers } = useChatStore();
  const [text, setText] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typingUsers]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setText(e.target.value);
    const socket = getSocket();
    if (socket) {
      // Throttle: only emit typing_start once per burst, not on every keystroke
      if (!typingTimeoutRef.current) {
        socket.emit("typing_start", { channel_id: channelId });
      }
      clearTimeout(typingTimeoutRef.current ?? undefined);
      typingTimeoutRef.current = setTimeout(() => {
        socket.emit("typing_end", { channel_id: channelId });
        typingTimeoutRef.current = null;
      }, 2000);
    }
  };

  const handleSend = () => {
    if (!text.trim()) return;
    sendMessage(channelId, text.trim());
    setText("");
    const socket = getSocket();
    if (socket) {
      socket.emit("typing_end", { channel_id: channelId });
    }
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
  };

  const channelName = currentChannel?.type === "direct"
    ? currentChannel.members.find((m) => m.id !== me?.id)?.name ?? "Unknown"
    : currentChannel?.name ?? "Group Chat";

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setActiveChannel(null)}
            className="flex items-center justify-center w-8 h-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-xs">
              {currentChannel?.type === "group" ? <Users className="w-4 h-4" /> : channelName.charAt(0).toUpperCase()}
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-foreground leading-none">{channelName}</span>
              <span className="text-[10px] text-muted-foreground mt-1">
                {currentChannel?.type === "group" ? `${currentChannel.members.length} members` : "Direct Message"}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {currentChannel?.type === "group" ? (
            <GroupSettingsDialog
              channel={currentChannel}
              orgId={orgId}
              spaceId={spaceId}
            />
          ) : (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button
                  className="flex items-center justify-center w-8 h-8 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                  aria-label="Delete chat"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Conversation</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete this direct message? This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction 
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={() => {
                      deleteChannel.mutate(channelId);
                      setActiveChannel(null);
                    }}
                  >
                    Delete Chat
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>

      {/* ── Message list ── */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 bg-muted/30">
        {isLoading && (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className={`flex flex-col gap-1 ${i % 2 === 0 ? "items-start" : "items-end"}`}
              >
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-10 w-2/3 rounded-lg" />
              </div>
            ))}
          </div>
        )}

        <AnimatePresence initial={false}>
          {messages.map((msg) => {
            const isMine = msg.sender.id === me?.id;
            return (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                className={`flex flex-col gap-1 w-full ${isMine ? "items-end" : "items-start"}`}
              >
                {!isMine && (
                  <span className="text-[10px] font-medium text-muted-foreground ml-1">
                    {msg.sender.name ?? "Unknown"}
                  </span>
                )}
                <div
                  className={`relative text-[13px] rounded-2xl px-4 py-2 w-fit max-w-[85%] leading-relaxed shadow-sm ${
                    isMine 
                      ? "bg-primary text-primary-foreground rounded-tr-sm" 
                      : "bg-card text-card-foreground border border-border/50 rounded-tl-sm"
                  }`}
                >
                  {msg.content}
                </div>
                <div className={`flex items-center gap-1 text-[10px] text-muted-foreground ${isMine ? "mr-1" : "ml-1"}`}>
                  <span>
                    {new Date(msg.created_at).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  {isMine && <Check className="w-3 h-3 text-primary" />}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {typingUsers[channelId] && typingUsers[channelId].length > 0 && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex gap-2 items-center text-[11px] text-muted-foreground italic px-2"
          >
            <div className="flex gap-1">
              <span className="w-1.5 h-1.5 bg-muted-foreground/60 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
              <span className="w-1.5 h-1.5 bg-muted-foreground/60 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
              <span className="w-1.5 h-1.5 bg-muted-foreground/60 rounded-full animate-bounce"></span>
            </div>
            {typingUsers[channelId].map((u) => u.name).join(", ")} is typing...
          </motion.div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* ── Send input ── */}
      <div className="flex items-center gap-3 px-4 py-3 bg-card border-t border-border">
        <input
          value={text}
          onChange={handleInputChange}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder="Message..."
          className="flex-1 text-sm bg-muted rounded-full px-5 py-2.5 outline-none placeholder:text-muted-foreground border border-transparent focus:border-primary/20 transition-colors"
        />
        <button
          onClick={handleSend}
          disabled={!text.trim()}
          className="flex items-center justify-center w-10 h-10 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 disabled:hover:bg-primary transition-all active:scale-95"
          aria-label="Send message"
        >
          <Send className="h-4 w-4 ml-0.5" />
        </button>
      </div>
    </div>
  );
}
