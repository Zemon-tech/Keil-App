// src/components/chat/MessageView.tsx

import { useState, useRef, useEffect } from "react";
import { useChatMessages, useSendMessage, useChatChannels, useDeleteChannel } from "@/hooks/api/useChat";
import { useChatStore } from "@/store/useChatStore";
import { ArrowLeft, Send, Check, Trash2, Users, Paperclip, File, Download, Loader2, X, Smile } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { EmojiPicker } from "./EmojiPicker";
import { getSocket } from "@/lib/socket";
import { Skeleton } from "@/components/ui/skeleton";
import { useMe } from "@/hooks/api/useMe";
import api from "@/lib/api";
import { GroupSettingsDialog } from "./GroupSettingsDialog";
import { motion, AnimatePresence } from "motion/react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { getOptimizedImageUrl } from "@/lib/image-optimizer";
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

import { MessageContent } from "./MessageContent";

interface MessageViewProps {
  channelId: string;
  orgId: string | null;
  spaceId: string | null;
  hideHeader?: boolean;
}

export function MessageView({ channelId, orgId, spaceId, hideHeader }: MessageViewProps) {
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
  const [replyingTo, setReplyingTo] = useState<{ messageId: string; senderName: string; text: string } | null>(null);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSelectEmoji = (emoji: string) => {
    const input = inputRef.current;
    if (input) {
      const start = input.selectionStart ?? text.length;
      const end = input.selectionEnd ?? text.length;
      const newText = text.substring(0, start) + emoji + text.substring(end);
      setText(newText);
      
      const newCursorPos = start + emoji.length;
      setTimeout(() => {
        input.focus();
        input.setSelectionRange(newCursorPos, newCursorPos);
      }, 0);
    } else {
      setText(prev => prev + emoji);
    }
  };

  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadedAttachment, setUploadedAttachment] = useState<any | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Size validation (25MB limit)
    const MAX_SIZE = 25 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      alert("File size exceeds the 25MB limit.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setAttachmentFile(file);
    setIsUploading(true);
    setUploadProgress(0);
    setUploadedAttachment(null);

    try {
      // Get S3 presigned upload URL
      const res = await api.post("v1/s3-upload/chat/upload", {
        channelId: channelId,
        fileName: file.name,
        contentType: file.type || "application/octet-stream"
      });

      const { uploadUrl, s3Key } = res.data.data;

      // Perform direct S3 upload via XMLHttpRequest for progress support
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", uploadUrl, true);
      xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percent = Math.round((event.loaded / event.total) * 100);
          setUploadProgress(percent);
        }
      };

      xhr.onload = () => {
        if (xhr.status === 200) {
          setUploadedAttachment({
            s3Key,
            fileName: file.name,
            mimeType: file.type || "application/octet-stream",
            fileSize: file.size
          });
          setIsUploading(false);
        } else {
          console.error("S3 upload failed with status:", xhr.status);
          alert("Failed to upload attachment. Please try again.");
          setAttachmentFile(null);
          setIsUploading(false);
          if (fileInputRef.current) fileInputRef.current.value = "";
        }
      };

      xhr.onerror = () => {
        console.error("S3 upload network error");
        alert("Attachment upload network error.");
        setAttachmentFile(null);
        setIsUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      };

      xhr.send(file);
    } catch (err) {
      console.error("Failed to get S3 upload URL:", err);
      alert("Failed to initiate file upload.");
      setAttachmentFile(null);
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const scrollToMessage = (msgId: string) => {
    const el = document.getElementById(`msg-${msgId}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      setHighlightedMessageId(msgId);
      setTimeout(() => {
        setHighlightedMessageId(null);
      }, 1500);
    }
  };

  useEffect(() => {
    const scrollToBottom = () => {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    };
    scrollToBottom();
    const timeout = setTimeout(scrollToBottom, 100);
    return () => clearTimeout(timeout);
  }, [messages, typingUsers, channelId]);

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
    const hasText = text.trim().length > 0;
    const hasAttachment = !!uploadedAttachment;
    if (!hasText && !hasAttachment) return;

    sendMessage(
      channelId, 
      text.trim(), 
      replyingTo, 
      uploadedAttachment ? [uploadedAttachment] : undefined
    );

    setText("");
    setReplyingTo(null);
    setAttachmentFile(null);
    setUploadedAttachment(null);
    if (fileInputRef.current) fileInputRef.current.value = "";

    const socket = getSocket();
    if (socket) {
      socket.emit("typing_end", { channel_id: channelId });
    }
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
  };

  const otherMember = currentChannel?.type === "direct"
    ? currentChannel.members.find((m) => m.id !== me?.id) || currentChannel.members[0]
    : undefined;

  const channelName = otherMember?.name ?? currentChannel?.name ?? "Group Chat";

  return (
    <div className="flex flex-col flex-1 overflow-hidden min-h-0">
      {/* ── Header ── */}
      {!hideHeader && (
        <div className="flex items-center justify-between px-4 py-3 shrink-0 border-b border-border bg-card">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setActiveChannel(null)}
              className="flex items-center justify-center size-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <ArrowLeft className="size-4" />
            </button>
            
            <div className="flex items-center gap-2">
              {currentChannel?.type === "group" ? (
                <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-xs">
                  <Users className="size-4" />
                </div>
              ) : (
                <Avatar className="size-8">
                  <AvatarImage src={getOptimizedImageUrl(otherMember?.avatar_url, { width: 96, height: 96 })} alt={channelName} />
                  <AvatarFallback className="text-xs font-semibold bg-primary/10 text-primary">
                    {channelName.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              )}
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
                    className="flex items-center justify-center size-8 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                    aria-label="Delete chat"
                  >
                    <Trash2 className="size-4" />
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
      )}

      {/* ── Message list ── */}
      <div className="flex-1 h-0 overflow-y-auto px-4 py-4 space-y-4 bg-muted/30">
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
                id={`msg-${msg.id}`}
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                className={`flex flex-col gap-1 w-full group transition-all duration-300 ${isMine ? "items-end" : "items-start"}`}
                onTouchStart={(e) => {
                  const touch = e.touches[0];
                  (e.currentTarget as any).startX = touch.clientX;
                }}
                onTouchEnd={(e) => {
                  const startX = (e.currentTarget as any).startX;
                  if (startX === undefined) return;
                  const touch = e.changedTouches[0];
                  const diffX = touch.clientX - startX;
                  if (diffX > 60) {
                    setReplyingTo({
                      messageId: msg.id,
                      senderName: isMine ? "You" : (msg.sender.name ?? "Unknown"),
                      text: msg.content,
                    });
                  }
                }}
              >
                {!isMine && (
                  <span className="text-[10px] font-medium text-muted-foreground ml-1">
                    {msg.sender.name ?? "Unknown"}
                  </span>
                )}
                <div className={`flex items-start gap-2 max-w-[85%] ${isMine ? "flex-row-reverse" : "flex-row"}`}>
                  <div className={`flex flex-col gap-1.5 ${isMine ? "items-end" : "items-start"}`}>
                    {(msg.reply_to || msg.content) && (
                      <div
                        className={`relative text-[13px] rounded-2xl px-4 py-2 w-fit leading-relaxed shadow-sm transition-all duration-300 break-all ${
                          isMine 
                            ? "bg-primary text-primary-foreground rounded-tr-sm" 
                            : "bg-card text-card-foreground border border-border/50 rounded-tl-sm"
                        } ${
                          highlightedMessageId === msg.id
                            ? isMine
                              ? "ring-4 ring-primary/30 scale-102"
                              : "bg-muted/80 ring-4 ring-muted-foreground/20 scale-102"
                            : ""
                        }`}
                      >
                        {msg.reply_to && (
                          <div
                            onClick={() => scrollToMessage(msg.reply_to!.messageId)}
                            className={`mb-1.5 p-2 rounded-lg text-xs cursor-pointer border-l-2 border-foreground select-none text-left ${
                              isMine
                                ? "bg-primary-foreground/15 text-primary-foreground/90"
                                : "bg-muted text-muted-foreground"
                            }`}
                          >
                            <div className="font-bold text-[10px] truncate">
                              {msg.reply_to.senderName}
                            </div>
                            <div className="line-clamp-3 text-[11px] leading-tight opacity-90 break-words">
                              {msg.reply_to.text}
                            </div>
                          </div>
                        )}
                        {msg.content && <MessageContent content={msg.content} isMine={isMine} />}
                      </div>
                    )}

                    {msg.attachments && msg.attachments.map((att, idx) => {
                      const isImage = att.mimeType.startsWith("image/");
                      if (isImage) {
                        return (
                          <div key={idx} className="max-w-[240px]">
                            <img 
                              src={getOptimizedImageUrl(att.downloadUrl, { width: 800 })} 
                              alt={att.fileName} 
                              className="max-h-48 object-contain rounded-lg border border-border hover:scale-[1.01] transition-transform cursor-pointer"
                              onClick={() => window.open(att.downloadUrl, "_blank")}
                            />
                          </div>
                        );
                      }
                      return (
                        <div key={idx} className="flex items-center justify-between gap-3 p-2.5 rounded-lg bg-card/60 border border-border/50 text-card-foreground text-xs min-w-[180px] max-w-[240px]">
                          <div className="flex items-center gap-2 min-w-0">
                            <File className="size-3.5 text-muted-foreground flex-shrink-0" />
                            <div className="flex flex-col min-w-0 text-left">
                              <span className="font-semibold truncate text-[10px]">{att.fileName}</span>
                              <span className="text-[9px] text-muted-foreground mt-0.5">{(att.fileSize / 1024 / 1024).toFixed(2)} MB</span>
                            </div>
                          </div>
                          <a 
                            href={att.downloadUrl} 
                            download={att.fileName}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors flex-shrink-0"
                            title="Download File"
                          >
                            <Download className="size-3" />
                          </a>
                        </div>
                      );
                    })}
                  </div>

                  <button
                    onClick={() => setReplyingTo({
                      messageId: msg.id,
                      senderName: isMine ? "You" : (msg.sender.name ?? "Unknown"),
                      text: msg.content,
                    })}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-full hover:bg-muted text-muted-foreground cursor-pointer flex items-center justify-center shrink-0 self-center"
                    title="Reply"
                  >
                    <span className="text-xs font-semibold">↩</span>
                  </button>
                </div>
                <div className={`flex items-center gap-1 text-[10px] text-muted-foreground ${isMine ? "mr-1" : "ml-1"}`}>
                  <span>
                    {new Date(msg.created_at).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  {isMine && <Check className="size-3 text-primary" />}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {(() => {
          const otherTypingUsers = (typingUsers[channelId] || []).filter((u) => u.userId !== me?.id);
          if (otherTypingUsers.length === 0) return null;
          return (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex gap-2 items-center text-[11px] text-muted-foreground italic px-2"
            >
              <div className="flex gap-1">
                <span className="size-1.5 bg-muted-foreground/60 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                <span className="size-1.5 bg-muted-foreground/60 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                <span className="size-1.5 bg-muted-foreground/60 rounded-full animate-bounce"></span>
              </div>
              {otherTypingUsers.map((u) => u.name).join(", ")} is typing...
            </motion.div>
          );
        })()}

        <div ref={bottomRef} />
      </div>

      {/* ── Send input ── */}
      <div className="flex flex-col gap-2 px-4 py-3 shrink-0 bg-card border-t border-border">
        {replyingTo && (
          <div className="flex items-center justify-between bg-muted rounded-xl px-4 py-2.5 text-xs border-l-4 border-foreground animate-in slide-in-from-bottom-2 duration-200">
            <div className="flex flex-col min-w-0 pr-4 text-left">
              <span className="font-bold text-[11px] text-foreground">
                Reply to {replyingTo.senderName}
              </span>
              <span className="text-muted-foreground truncate text-[11px] mt-0.5">
                {replyingTo.text}
              </span>
            </div>
            <button
              onClick={() => setReplyingTo(null)}
              className="text-muted-foreground hover:text-foreground p-1 cursor-pointer font-bold shrink-0 text-sm"
              aria-label="Cancel reply"
            >
              ✕
            </button>
          </div>
        )}
        {attachmentFile && (
          <div className="flex items-center justify-between bg-muted/80 backdrop-blur-[2px] rounded-xl px-4 py-3 mb-1 text-xs border border-border animate-in slide-in-from-bottom-2 duration-200">
            <div className="flex items-center gap-3 min-w-0 pr-4">
              <div className="size-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary flex-shrink-0">
                {isUploading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <File className="size-4" />
                )}
              </div>
              <div className="flex flex-col min-w-0 text-left">
                <span className="font-semibold text-foreground truncate">
                  {attachmentFile.name}
                </span>
                <span className="text-muted-foreground text-[10px] mt-0.5">
                  {isUploading ? `Uploading: ${uploadProgress}%` : `${(attachmentFile.size / 1024 / 1024).toFixed(2)} MB`}
                </span>
              </div>
            </div>
            <button
              onClick={() => {
                setAttachmentFile(null);
                setUploadedAttachment(null);
                setIsUploading(false);
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
              className="text-muted-foreground hover:text-foreground p-1 cursor-pointer font-bold shrink-0"
              aria-label="Remove attachment"
            >
              <X className="size-4" />
            </button>
          </div>
        )}
        <div className="flex items-center gap-3">
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileSelect} 
            className="hidden" 
          />
          <button 
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading || !!attachmentFile}
            className="flex items-center justify-center size-10 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors flex-shrink-0 disabled:opacity-40"
            title="Attach file"
          >
            <Paperclip className="size-5" />
          </button>
          <input
            ref={inputRef}
            value={text}
            onChange={handleInputChange}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Message..."
            className="flex-1 text-sm bg-muted rounded-full px-5 py-2.5 outline-none placeholder:text-muted-foreground border border-transparent focus:border-primary/20 transition-colors"
          />
          <Popover>
            <PopoverTrigger asChild>
              <button 
                type="button"
                className="flex items-center justify-center size-10 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors flex-shrink-0 cursor-pointer"
                title="Choose emoji"
              >
                <Smile className="size-5" />
              </button>
            </PopoverTrigger>
            <PopoverContent 
              side="top" 
              align="end" 
              sideOffset={12} 
              className="w-auto p-0 bg-transparent border-0 shadow-none"
            >
              <EmojiPicker onSelect={handleSelectEmoji} />
            </PopoverContent>
          </Popover>
          <button
            onClick={handleSend}
            disabled={isUploading || (!text.trim() && !uploadedAttachment)}
            className="flex items-center justify-center size-10 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 disabled:hover:bg-primary transition-all active:scale-95"
            aria-label="Send message"
          >
            <Send className="size-4 ml-0.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
