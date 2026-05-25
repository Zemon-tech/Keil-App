import {
    Dialog,
    DialogContent,
    DialogTitle,
} from "@/components/ui/dialog";
import { VisuallyHidden } from "radix-ui";
import { cn } from "@/lib/utils";
import { useChatStore } from "@/store/useChatStore";
import { useChatChannels, useReadChannel, useChatMessages, useSendMessage, useDeleteChannel } from "@/hooks/api/useChat";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
    Hash, Search, Send, 
    Paperclip, Smile, CheckCheck,
    Users, MessageCircle, Trash2
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useState, useRef, useEffect } from "react";
import { useMe } from "@/hooks/api/useMe";
import { useAppContext } from "@/contexts/AppContext";
import { getSocket } from "@/lib/socket";
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
    const { activeChannelId, setActiveChannel, typingUsers } = useChatStore();
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
        if (!messageText.trim() || !activeChannelId) return;
        sendMessage(activeChannelId, messageText.trim());
        setMessageText("");
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
                className="!flex !flex-col !max-w-[calc(100vw-40px)] !w-[calc(100vw-40px)] !h-[calc(100vh-40px)] !max-h-[calc(100vh-40px)] !rounded-2xl !p-0 !gap-0 border border-border shadow-2xl overflow-hidden [&_[data-slot=dialog-close]]:text-red-500 hover:[&_[data-slot=dialog-close]]:text-red-600 [&_[data-slot=dialog-close]]:opacity-90 transition-colors"
            >
                <VisuallyHidden.Root>
                    <DialogTitle>Chat</DialogTitle>
                </VisuallyHidden.Root>

                <div className="flex flex-row h-full w-full overflow-hidden min-h-0">
                    {/* ── Left Sidebar: Channels & Participants ── */}
                    <div className="w-80 shrink-0 grow-0 bg-card border-r border-border flex flex-col h-full overflow-hidden">
                        {/* Sidebar Header */}
                        {searchOpen ? (
                            <div className="flex items-center gap-2 px-3 py-2 shrink-0 border-b border-border h-12">
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
                            <div className="flex items-center justify-between px-4 py-3 shrink-0 border-b border-border h-12">
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
                                                    <AvatarFallback className="text-sm font-semibold bg-primary/20">
                                                        {currentChannel.members[0]?.name?.charAt(0).toUpperCase() || "?"}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <div>
                                                    <h3 className="text-sm font-semibold text-foreground">
                                                        {currentChannel.members[0]?.name || "Unknown"}
                                                    </h3>
                                                    <p className="text-xs text-green-500 flex items-center gap-1">
                                                        <span className="size-1.5 rounded-full bg-green-500" />
                                                        Online
                                                    </p>
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
                                                    <div key={msg.id} className={`flex flex-col gap-1 w-full ${isMine ? "items-end" : "items-start"}`}>
                                                        <span className="text-[11px] font-semibold text-muted-foreground px-1">
                                                            {isMine ? "You" : (msg.sender.name ?? "Unknown")}
                                                        </span>
                                                        <div className={cn(
                                                            "max-w-[70%] rounded-2xl px-4 py-2.5 text-sm",
                                                            isMine 
                                                                ? "bg-primary text-primary-foreground rounded-br-md" 
                                                                : "bg-muted text-foreground rounded-bl-md"
                                                        )}>
                                                            <p>{msg.content}</p>
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
                                        {typingUsers[activeChannelId] && typingUsers[activeChannelId].length > 0 && (
                                            <div className="flex gap-1 text-[11px] text-muted-foreground italic px-1">
                                                {typingUsers[activeChannelId].map(u => u.name).join(", ")} is typing...
                                            </div>
                                        )}

                                        <div ref={bottomRef} />
                                    </div>
                                </ScrollArea>

                                {/* Message Input */}
                                <div className="p-4 shrink-0 border-t border-border bg-card/50 backdrop-blur-sm">
                                    <div className="flex items-end gap-2">
                                        <Button variant="ghost" size="icon" className="size-10 text-muted-foreground hover:text-foreground flex-shrink-0">
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
                                            disabled={!messageText.trim()}
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
