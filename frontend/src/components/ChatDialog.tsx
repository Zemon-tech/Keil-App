import {
    Dialog,
    DialogContent,
    DialogTitle,
} from "@/components/ui/dialog";
import { VisuallyHidden } from "radix-ui";
import { cn } from "@/lib/utils";
import { useChatStore } from "@/store/useChatStore";
import { useChatChannels, useReadChannel, useChatMessages, useSendMessage, useDeleteChannel } from "@/hooks/api/useChat";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
    Hash, Search, Send, 
    Paperclip, Smile, CheckCheck,
    Users, MessageCircle, Trash2, Minimize2,
    File, Download, Loader2, X
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useState, useRef, useEffect } from "react";
import { useMe } from "@/hooks/api/useMe";
import { useAppContext } from "@/contexts/AppContext";
import { getSocket } from "@/lib/socket";
import api from "@/lib/api";
import { NewChatDialog } from "@/components/chat/NewChatDialog";
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
import { GroupSettingsDialog } from "@/components/chat/GroupSettingsDialog";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { EmojiPicker } from "@/components/chat/EmojiPicker";


interface ChatDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function ChatDialog({ open, onOpenChange }: ChatDialogProps) {
    const { activeChannelId, setActiveChannel, typingUsers, closeChatDialog, openChat } = useChatStore();
    // Phase D will fully migrate this component; for now we pass org/space context
    // to the new hook signatures while keeping the legacy member list intact.
    const { activeOrgId, activeSpaceId } = useAppContext();
    const { data: channels = [], isLoading } = useChatChannels(activeOrgId, activeSpaceId);
    const readChannel = useReadChannel(activeOrgId, activeSpaceId);
    const { data: messages = [], isLoading: messagesLoading } = useChatMessages(activeChannelId || "", activeOrgId, activeSpaceId);
    const sendMessage = useSendMessage();
    const deleteChannel = useDeleteChannel(activeOrgId, activeSpaceId);
    const { data: me } = useMe();

    const [searchQuery, setSearchQuery] = useState("");
    const [searchOpen, setSearchOpen] = useState(false);
    const [messageText, setMessageText] = useState("");
    const bottomRef = useRef<HTMLDivElement>(null);
    const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const [replyingTo, setReplyingTo] = useState<{ messageId: string; senderName: string; text: string } | null>(null);
    const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);

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
                channelId: activeChannelId,
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

    const handleSelectEmoji = (emoji: string) => {
        const input = inputRef.current;
        if (input) {
            const start = input.selectionStart ?? messageText.length;
            const end = input.selectionEnd ?? messageText.length;
            const newText = messageText.substring(0, start) + emoji + messageText.substring(end);
            setMessageText(newText);
            
            const newCursorPos = start + emoji.length;
            setTimeout(() => {
                input.focus();
                input.setSelectionRange(newCursorPos, newCursorPos);
            }, 0);
        } else {
            setMessageText(prev => prev + emoji);
        }
    };


    const groupChannels = channels.filter(c => c.type === "group");
    const directChannels = channels.filter(c => c.type === "direct");

    // Filter channels based on search
    const filteredGroupChannels = groupChannels.filter(c => 
        c.name?.toLowerCase().includes(searchQuery.toLowerCase())
    );
    const filteredDirectChannels = directChannels.filter(c => 
        c.members[0]?.name?.toLowerCase().includes(searchQuery.toLowerCase())
    );



    const currentChannel = channels.find(c => c.id === activeChannelId);

    const handleOpenChannel = (id: string) => {
        setActiveChannel(id);
        readChannel.mutate(id);
    };


    const handleSendMessage = () => {
        const hasText = messageText.trim().length > 0;
        const hasAttachment = !!uploadedAttachment;
        if ((!hasText && !hasAttachment) || !activeChannelId) return;

        sendMessage(
            activeChannelId, 
            messageText.trim(), 
            replyingTo, 
            uploadedAttachment ? [uploadedAttachment] : undefined
        );
        
        setMessageText("");
        setReplyingTo(null);
        setAttachmentFile(null);
        setUploadedAttachment(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
        getSocket()?.emit("typing_end", { channel_id: activeChannelId });
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setMessageText(e.target.value);
        
        const socket = getSocket();
        if (socket && activeChannelId) {
            socket.emit("typing_start", { channel_id: activeChannelId });
            
            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
            typingTimeoutRef.current = setTimeout(() => {
                socket.emit("typing_end", { channel_id: activeChannelId });
            }, 2000);
        }
    };

    // Auto-scroll to bottom when messages change
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, typingUsers]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
             <DialogContent
                showCloseButton={true}
                className="!flex !flex-col !max-w-[calc(100vw-40px)] !w-[calc(100vw-40px)] !h-[calc(100vh-40px)] !max-h-[calc(100vh-40px)] !rounded-2xl !p-0 !gap-0 border border-border shadow-2xl overflow-hidden [&_[data-slot=dialog-close]]:!top-5 [&_[data-slot=dialog-close]]:text-red-500 hover:[&_[data-slot=dialog-close]]:text-red-600 [&_[data-slot=dialog-close]]:opacity-90 transition-colors"
            >
                <VisuallyHidden.Root>
                    <DialogTitle>Chat</DialogTitle>
                </VisuallyHidden.Root>

                {/* Minimize button — collapses back to the side drawer */}
                <button
                    onClick={() => { closeChatDialog(); openChat(); }}
                    className="absolute top-5 right-10 z-50 opacity-70 hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
                    aria-label="Minimize chat to sidebar"
                >
                    <Minimize2 className="size-4" />
                </button>

                <div className="flex flex-row h-full w-full overflow-hidden min-h-0">
                    {/* ── Left Sidebar: Channels & Participants ── */}
                    <div className="w-80 shrink-0 grow-0 bg-card border-r border-border flex flex-col h-full overflow-hidden">
                        {/* Sidebar Header */}
                        {searchOpen ? (
                            <div className="flex items-center gap-2 px-3 py-2 shrink-0 border-b border-border h-14">
                                <div className="relative flex-1">
                                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                                    <Input
                                        autoFocus
                                        placeholder="Search messages or users..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="pl-8 h-8 text-xs bg-muted/50 border-0 focus-visible:ring-1 w-full"
                                    />
                                </div>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground shrink-0"
                                    onClick={() => {
                                        setSearchOpen(false);
                                        setSearchQuery("");
                                    }}
                                >
                                    Cancel
                                </Button>
                            </div>
                        ) : (
                            <div className="flex items-center justify-between px-4 py-3 shrink-0 border-b border-border h-14">
                                <span className="text-sm font-semibold">Messages</span>
                                <div className="flex items-center gap-1">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="size-7 text-muted-foreground hover:text-foreground"
                                        onClick={() => setSearchOpen(true)}
                                    >
                                        <Search className="size-4" />
                                    </Button>
                                    <NewChatDialog orgId={activeOrgId} spaceId={activeSpaceId} />
                                </div>
                            </div>
                        )}

                        {/* Channels List */}
                        <ScrollArea className="flex-1 h-0">
                            {/* Group Channels Section */}
                            <div className="p-2">
                                <div className="px-2 py-1.5 flex items-center justify-between">
                                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                                        <Hash className="size-3" />
                                        Channels
                                    </span>
                                </div>
                                {isLoading ? (
                                    <div className="space-y-2">
                                        {[...Array(3)].map((_, i) => (
                                            <div key={i} className="flex items-center gap-3 px-2 py-2">
                                                <Skeleton className="size-4 rounded" />
                                                <Skeleton className="h-3 w-20" />
                                            </div>
                                        ))}
                                    </div>
                                ) : filteredGroupChannels.length === 0 ? (
                                    <div className="px-2 py-4 text-center text-xs text-muted-foreground">
                                        {searchQuery ? "No channels found" : "No channels yet"}
                                    </div>
                                ) : (
                                    filteredGroupChannels.map((channel) => (
                                        <button
                                            key={channel.id}
                                            onClick={() => handleOpenChannel(channel.id)}
                                            className={cn(
                                                "w-full flex items-center gap-3 px-2 py-2.5 rounded-lg text-left transition-all duration-200 group",
                                                activeChannelId === channel.id
                                                    ? "bg-primary/10 text-primary"
                                                    : "hover:bg-muted text-foreground"
                                            )}
                                        >
                                            <div className={cn(
                                                "size-9 rounded-lg flex items-center justify-center flex-shrink-0",
                                                activeChannelId === channel.id ? "bg-primary text-primary-foreground" : "bg-muted"
                                            )}>
                                                <Hash className="size-4" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-sm font-medium truncate">{channel.name || "Group"}</span>
                                                    {channel.unread_count > 0 && (
                                                        <Badge variant="secondary" className="h-5 px-1.5 text-xs bg-primary text-primary-foreground">
                                                            {channel.unread_count > 9 ? "9+" : channel.unread_count}
                                                        </Badge>
                                                    )}
                                                </div>
                                                {channel.last_message_at && (
                                                    <span className="text-xs text-muted-foreground">
                                                        {new Date(channel.last_message_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                )}
                                            </div>
                                        </button>
                                    ))
                                )}
                            </div>

                            <Separator className="my-2" />

                            {/* Direct Messages Section */}
                            <div className="p-2">
                                <div className="px-2 py-1.5 flex items-center justify-between">
                                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                                        <Users className="size-3" />
                                        Direct Messages
                                    </span>
                                </div>
                                {isLoading ? (
                                    <div className="space-y-2">
                                        {[...Array(3)].map((_, i) => (
                                            <div key={i} className="flex items-center gap-3 px-2 py-2">
                                                <Skeleton className="size-9 rounded-full" />
                                                <Skeleton className="h-3 w-20" />
                                            </div>
                                        ))}
                                    </div>
                                ) : filteredDirectChannels.length === 0 ? (
                                    <div className="px-2 py-4 text-center text-xs text-muted-foreground">
                                        {searchQuery ? "No users found" : "No direct messages yet"}
                                    </div>
                                ) : (
                                    filteredDirectChannels.map((channel) => {
                                        const displayName = channel.members[0]?.name ?? "Unknown";
                                        return (
                                            <button
                                                key={channel.id}
                                                onClick={() => handleOpenChannel(channel.id)}
                                                className={cn(
                                                    "w-full flex items-center gap-3 px-2 py-2.5 rounded-lg text-left transition-all duration-200 group",
                                                    activeChannelId === channel.id
                                                        ? "bg-primary/10 text-primary"
                                                        : "hover:bg-muted text-foreground"
                                                )}
                                            >
                                                <div className="relative flex-shrink-0">
                                                    <Avatar className="size-9">
                                                        <AvatarImage src={channel.members[0]?.avatar_url || undefined} alt={displayName} />
                                                        <AvatarFallback className="text-sm font-semibold bg-primary/20 text-foreground">
                                                            {displayName.charAt(0).toUpperCase()}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <div className="absolute -bottom-0.5 -right-0.5 size-2.5 bg-green-500 rounded-full border-2 border-card" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-sm font-medium truncate">{displayName}</span>
                                                        {channel.unread_count > 0 && (
                                                            <Badge variant="secondary" className="h-5 px-1.5 text-xs bg-primary text-primary-foreground">
                                                                {channel.unread_count > 9 ? "9+" : channel.unread_count}
                                                            </Badge>
                                                        )}
                                                    </div>
                                                    {channel.last_message_at && (
                                                        <span className="text-xs text-muted-foreground">
                                                            {new Date(channel.last_message_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </span>
                                                    )}
                                                </div>
                                            </button>
                                        );
                                    })
                                )}
                            </div>
                        </ScrollArea>
                    </div>

                    {/* ── Right Content Area: Messages ── */}
                    <div className="flex-1 h-full overflow-hidden bg-background flex flex-col min-h-0">
                        {activeChannelId && currentChannel ? (
                            <>
                                {/* Chat Header */}
                                <div className="h-14 shrink-0 border-b border-border flex items-center justify-between pl-4 pr-14 bg-card/50 backdrop-blur-sm">
                                    <div className="flex items-center gap-3">
                                        {currentChannel.type === 'direct' ? (
                                            <>
                                                <Avatar className="size-9">
                                                    <AvatarImage src={currentChannel.members[0]?.avatar_url || undefined} alt={currentChannel.members[0]?.name || "Unknown"} />
                                                    <AvatarFallback className="text-sm font-semibold bg-primary/20">
                                                        {currentChannel.members[0]?.name?.charAt(0).toUpperCase() || "?"}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <div>
                                                    <h3 className="text-sm font-semibold text-foreground">
                                                        {currentChannel.members[0]?.name || "Unknown"}
                                                    </h3>
                                                </div>
                                            </>
                                        ) : (
                                            <>
                                                <div className="size-9 rounded-lg bg-primary/20 flex items-center justify-center">
                                                    <Hash className="size-4 text-primary" />
                                                </div>
                                                <div>
                                                    <h3 className="text-sm font-semibold text-foreground">
                                                        {currentChannel.name || "Group"}
                                                    </h3>
                                                    <p className="text-xs text-muted-foreground">
                                                        {currentChannel.members.length} members
                                                    </p>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {currentChannel?.type === "group" ? (
                                            <GroupSettingsDialog
                                                channel={currentChannel}
                                                orgId={activeOrgId}
                                                spaceId={activeSpaceId}
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
                                                                if (activeChannelId) {
                                                                    deleteChannel.mutate(activeChannelId);
                                                                    setActiveChannel(null);
                                                                }
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

                                {/* Messages Area */}
                                <ScrollArea className="flex-1 h-0 px-4 py-4">
                                    <div className="space-y-4">
                                        {messagesLoading ? (
                                            <div className="space-y-4">
                                                {[...Array(5)].map((_, i) => (
                                                    <div key={i} className={`flex flex-col gap-1 ${i % 2 === 0 ? "items-start" : "items-end"}`}>
                                                        <Skeleton className="h-3 w-16" />
                                                        <Skeleton className="h-12 w-2/3 rounded-lg" />
                                                    </div>
                                                ))}
                                            </div>
                                        ) : messages.length === 0 ? (
                                            <div className="h-full flex flex-col items-center justify-center text-muted-foreground py-12">
                                                <MessageCircle className="size-12 mb-3 opacity-40" />
                                                <p className="text-sm">No messages yet. Start the conversation!</p>
                                            </div>
                                        ) : (
                                            messages.map((msg) => {
                                                const isMine = msg.sender.id === me?.id;
                                                return (
                                                    <div
                                                        key={msg.id}
                                                        id={`msg-${msg.id}`}
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
                                                        <span className="text-[11px] font-semibold text-muted-foreground px-1">
                                                            {isMine ? "You" : (msg.sender.name ?? "Unknown")}
                                                        </span>
                                                        <div className={`flex items-start gap-2 max-w-[70%] ${isMine ? "flex-row-reverse" : "flex-row"}`}>
                                                             <div className={`flex flex-col gap-1.5 ${isMine ? "items-end" : "items-start"}`}>
                                                                 {(msg.reply_to || msg.content) && (
                                                                     <div className={cn(
                                                                         "rounded-2xl px-4 py-2.5 text-sm transition-all duration-300",
                                                                         isMine 
                                                                             ? "bg-primary text-primary-foreground rounded-tr-md" 
                                                                             : "bg-muted text-foreground rounded-bl-md",
                                                                         highlightedMessageId === msg.id && (isMine ? "ring-4 ring-primary/30 scale-102" : "ring-4 ring-muted-foreground/20 scale-102")
                                                                     )}>
                                                                         {msg.reply_to && (
                                                                             <div
                                                                                 onClick={() => scrollToMessage(msg.reply_to!.messageId)}
                                                                                 className={`mb-1.5 p-2 rounded-lg text-xs cursor-pointer border-l-2 border-foreground select-none text-left ${
                                                                                     isMine
                                                                                         ? "bg-primary-foreground/15 text-primary-foreground/90"
                                                                                         : "bg-background text-foreground border border-border"
                                                                                 }`}
                                                                             >
                                                                                 <div className="font-bold text-[10px] truncate">
                                                                                     {msg.reply_to.senderName}
                                                                                 </div>
                                                                                 <div className="truncate text-[11px] leading-tight opacity-90">
                                                                                     {msg.reply_to.text}
                                                                                 </div>
                                                                             </div>
                                                                         )}
                                                                         {msg.content && <p className="mb-1 last:mb-0">{msg.content}</p>}
                                                                     </div>
                                                                 )}

                                                                 {msg.attachments && msg.attachments.map((att, idx) => {
                                                                     const isImage = att.mimeType.startsWith("image/");
                                                                     if (isImage) {
                                                                         return (
                                                                             <div key={idx} className="max-w-xs sm:max-w-sm">
                                                                                 <img 
                                                                                     src={att.downloadUrl} 
                                                                                     alt={att.fileName} 
                                                                                     className="max-h-60 object-contain rounded-lg border border-border hover:scale-[1.01] transition-transform cursor-pointer"
                                                                                     onClick={() => window.open(att.downloadUrl, "_blank")}
                                                                                 />
                                                                             </div>
                                                                        );
                                                                     }
                                                                     return (
                                                                         <div key={idx} className="flex items-center justify-between gap-4 p-3 rounded-lg bg-card/60 border border-border/50 text-card-foreground text-xs min-w-[200px] max-w-xs sm:max-w-sm">
                                                                             <div className="flex items-center gap-2.5 min-w-0">
                                                                                 <File className="size-4 text-muted-foreground flex-shrink-0" />
                                                                                 <div className="flex flex-col min-w-0 text-left">
                                                                                     <span className="font-semibold truncate text-[11px]">{att.fileName}</span>
                                                                                     <span className="text-[10px] text-muted-foreground mt-0.5">{(att.fileSize / 1024 / 1024).toFixed(2)} MB</span>
                                                                                 </div>
                                                                             </div>
                                                                             <a 
                                                                                 href={att.downloadUrl} 
                                                                                 download={att.fileName}
                                                                                 target="_blank"
                                                                                 rel="noopener noreferrer"
                                                                                 className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors flex-shrink-0"
                                                                                 title="Download File"
                                                                             >
                                                                                 <Download className="size-3.5" />
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
                                                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground px-1">
                                                            <span>
                                                                {new Date(msg.created_at).toLocaleTimeString([], {
                                                                    hour: '2-digit',
                                                                    minute: '2-digit',
                                                                })}
                                                            </span>
                                                            {isMine && <CheckCheck className="size-3 text-primary" />}
                                                        </div>
                                                    </div>
                                                );
                                            })
                                        )}

                                        {/* Typing indicator */}
                                        {(() => {
                                            const otherTypingUsers = (typingUsers[activeChannelId] || []).filter((u) => u.userId !== me?.id);
                                            if (otherTypingUsers.length === 0) return null;
                                            return (
                                                <div className="flex gap-1 text-[11px] text-muted-foreground italic px-1">
                                                    {otherTypingUsers.map(u => u.name).join(", ")} is typing...
                                                </div>
                                            );
                                        })()}

                                        <div ref={bottomRef} />
                                    </div>
                                </ScrollArea>

                                {/* Message Input */}
                                <div className="p-4 shrink-0 border-t border-border bg-card/50 backdrop-blur-sm">
                                    {replyingTo && (
                                        <div className="flex items-center justify-between bg-muted rounded-xl px-4 py-2.5 mb-2.5 text-xs border-l-4 border-foreground animate-in slide-in-from-bottom-2 duration-200">
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
                                        <div className="flex items-center justify-between bg-muted/80 backdrop-blur-[2px] rounded-xl px-4 py-3 mb-2.5 text-xs border border-border animate-in slide-in-from-bottom-2 duration-200">
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
                                    <div className="flex items-end gap-2">
                                        <input 
                                            type="file" 
                                            ref={fileInputRef} 
                                            onChange={handleFileSelect} 
                                            className="hidden" 
                                        />
                                        <Button 
                                            variant="ghost" 
                                            size="icon" 
                                            onClick={() => fileInputRef.current?.click()}
                                            disabled={isUploading || !!attachmentFile}
                                            className="size-10 text-muted-foreground hover:text-foreground flex-shrink-0 disabled:opacity-40"
                                        >
                                            <Paperclip className="size-5" />
                                        </Button>
                                        <div className="flex-1 relative">
                                            <input
                                                ref={inputRef}
                                                value={messageText}
                                                onChange={handleInputChange}
                                                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), handleSendMessage())}
                                                placeholder="Type a message..."
                                                className="w-full min-h-[44px] max-h-[120px] py-3 px-4 bg-muted rounded-2xl text-sm outline-none placeholder:text-muted-foreground resize-none focus:ring-2 focus:ring-primary/20 transition-all"
                                            />
                                        </div>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <Button variant="ghost" size="icon" className="size-10 text-muted-foreground hover:text-foreground flex-shrink-0">
                                                    <Smile className="size-5" />
                                                </Button>
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
 
                                        <Button 
                                            onClick={handleSendMessage}
                                            disabled={isUploading || (!messageText.trim() && !uploadedAttachment)}
                                            className="size-10 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground flex-shrink-0 transition-all disabled:opacity-50"
                                        >
                                            <Send className="size-4" />
                                        </Button>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-muted-foreground bg-card p-12 text-center relative overflow-hidden group">
                                <div className="absolute inset-0 bg-grid-black/[0.02] dark:bg-grid-white/[0.02]" />
                                <div className="size-24 bg-primary/10 rounded-3xl flex items-center justify-center mb-6 ring-4 ring-background shadow-xs relative z-10 transition-transform duration-500 group-hover:scale-105">
                                    <MessageCircle className="size-10 text-primary opacity-80" />
                                </div>
                                <h3 className="text-xl font-bold text-foreground relative z-10 mb-2">Smart Organisation Comms</h3>
                                <p className="text-sm max-w-[320px] mb-8 relative z-10">
                                    Select any channel or team member from the directory to initiate encrypted collaboration instantly.
                                </p>
                            </div>
                        )}


                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
