import {
    Dialog,
    DialogContent,
    DialogTitle,
} from "@/components/ui/dialog";
import { VisuallyHidden } from "radix-ui";
import { cn } from "@/lib/utils";
import { useChatStore } from "@/store/useChatStore";
import { useChatChannels, useReadChannel, useChatSocketListeners, useChatMessages, useSendMessage } from "@/hooks/api/useChat";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
    Hash, X, Search, Plus, Send, MoreVertical, 
    Phone, Video, Paperclip, Smile, CheckCheck,
    UserPlus, Users, MessageCircle
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useState, useRef, useEffect } from "react";
import { useMe } from "@/hooks/api/useMe";
import { useWorkspaceMembers } from "@/hooks/api/useWorkspace";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useOpenDM } from "@/hooks/api/useChat";
import { getSocket } from "@/lib/socket";

interface ChatDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function ChatDialog({ open, onOpenChange }: ChatDialogProps) {
    const { activeChannelId, setActiveChannel, typingUsers } = useChatStore();
    const { data: channels = [], isLoading } = useChatChannels();
    const readChannel = useReadChannel();
    const { data: messages = [], isLoading: messagesLoading } = useChatMessages(activeChannelId || "");
    const sendMessage = useSendMessage();
    const { data: me } = useMe();
    const { workspaceId } = useWorkspace();
    const { data: members } = useWorkspaceMembers(workspaceId ?? undefined);
    const openDM = useOpenDM();

    // Mount global socket listeners at dialog level
    useChatSocketListeners(activeChannelId);

    const [searchQuery, setSearchQuery] = useState("");
    const [messageText, setMessageText] = useState("");
    const [showUserSearch, setShowUserSearch] = useState(false);
    const [userSearchQuery, setUserSearchQuery] = useState("");
    const bottomRef = useRef<HTMLDivElement>(null);
    const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const groupChannels = channels.filter(c => c.type === "group");
    const directChannels = channels.filter(c => c.type === "direct");

    // Filter channels based on search
    const filteredGroupChannels = groupChannels.filter(c => 
        c.name?.toLowerCase().includes(searchQuery.toLowerCase())
    );
    const filteredDirectChannels = directChannels.filter(c => 
        c.members[0]?.name?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Filter users for adding new chat
    const filteredUsers = members?.filter(member => {
        if (member.user.id === (me as any)?.user?.id || member.user.id === (me as any)?.id) return false;
        const searchLower = userSearchQuery.toLowerCase();
        return member.user.name?.toLowerCase().includes(searchLower) ||
               member.user.email.toLowerCase().includes(searchLower);
    });

    const currentChannel = channels.find(c => c.id === activeChannelId);

    const handleOpenChannel = (id: string) => {
        setActiveChannel(id);
        readChannel.mutate(id);
    };

    const handleClose = () => {
        onOpenChange(false);
    };

    const handleStartChat = (userId: string) => {
        openDM.mutate(userId, {
            onSuccess: (channel: any) => {
                setActiveChannel(channel.id);
                setShowUserSearch(false);
                setUserSearchQuery("");
            }
        });
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
                showCloseButton={false}
                className="!max-w-[calc(100vw-40px)] !w-[calc(100vw-40px)] !h-[calc(100vh-40px)] !max-h-[calc(100vh-40px)] !rounded-2xl !p-0 !gap-0 border border-border shadow-2xl overflow-hidden"
            >
                <VisuallyHidden.Root>
                    <DialogTitle>Chat</DialogTitle>
                </VisuallyHidden.Root>

                <div className="flex h-full">
                    {/* ── Left Sidebar: Channels & Participants ── */}
                    <div className="w-80 shrink-0 bg-card border-r border-border flex flex-col h-full">
                        {/* Sidebar Header */}
                        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                            <span className="text-sm font-semibold">Messages</span>
                            <div className="flex items-center gap-1">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                    onClick={() => setShowUserSearch(true)}
                                >
                                    <Plus className="h-4 w-4" />
                                </Button>
                                <button
                                    onClick={handleClose}
                                    className="text-muted-foreground hover:text-foreground transition-colors"
                                    aria-label="Close chat dialog"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            </div>
                        </div>

                        {/* Search Bar */}
                        <div className="px-3 py-2 border-b border-border">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search messages or users..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-9 h-9 text-sm bg-muted/50 border-0 focus-visible:ring-1"
                                />
                            </div>
                        </div>

                        {/* Channels List */}
                        <ScrollArea className="flex-1">
                            {/* Group Channels Section */}
                            <div className="p-2">
                                <div className="px-2 py-1.5">
                                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                                        <Hash className="h-3 w-3" />
                                        Channels
                                    </span>
                                </div>
                                {isLoading ? (
                                    <div className="space-y-2">
                                        {[...Array(3)].map((_, i) => (
                                            <div key={i} className="flex items-center gap-3 px-2 py-2">
                                                <Skeleton className="h-4 w-4 rounded" />
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
                                                "h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0",
                                                activeChannelId === channel.id ? "bg-primary text-primary-foreground" : "bg-muted"
                                            )}>
                                                <Hash className="h-4 w-4" />
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
                                <div className="px-2 py-1.5">
                                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                                        <Users className="h-3 w-3" />
                                        Direct Messages
                                    </span>
                                </div>
                                {isLoading ? (
                                    <div className="space-y-2">
                                        {[...Array(3)].map((_, i) => (
                                            <div key={i} className="flex items-center gap-3 px-2 py-2">
                                                <Skeleton className="h-9 w-9 rounded-full" />
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
                                                    <Avatar className="h-9 w-9">
                                                        <AvatarFallback className="text-sm font-semibold bg-primary/20 text-foreground">
                                                            {displayName.charAt(0).toUpperCase()}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <div className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 bg-green-500 rounded-full border-2 border-card" />
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
                    <div className="flex-1 h-full overflow-hidden bg-background flex flex-col">
                        {activeChannelId && currentChannel ? (
                            <>
                                {/* Chat Header */}
                                <div className="h-14 border-b border-border flex items-center justify-between px-4 bg-card/50 backdrop-blur-sm">
                                    <div className="flex items-center gap-3">
                                        {currentChannel.type === 'direct' ? (
                                            <>
                                                <Avatar className="h-9 w-9">
                                                    <AvatarFallback className="text-sm font-semibold bg-primary/20">
                                                        {currentChannel.members[0]?.name?.charAt(0).toUpperCase() || "?"}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <div>
                                                    <h3 className="text-sm font-semibold text-foreground">
                                                        {currentChannel.members[0]?.name || "Unknown"}
                                                    </h3>
                                                    <p className="text-xs text-green-500 flex items-center gap-1">
                                                        <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                                                        Online
                                                    </p>
                                                </div>
                                            </>
                                        ) : (
                                            <>
                                                <div className="h-9 w-9 rounded-lg bg-primary/20 flex items-center justify-center">
                                                    <Hash className="h-4 w-4 text-primary" />
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
                                    <div className="flex items-center gap-1">
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                                            <Phone className="h-4 w-4" />
                                        </Button>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                                            <Video className="h-4 w-4" />
                                        </Button>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                                            <MoreVertical className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>

                                {/* Messages Area */}
                                <ScrollArea className="flex-1 px-4 py-4">
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
                                                <MessageCircle className="h-12 w-12 mb-3 opacity-40" />
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
                                                            {isMine && <CheckCheck className="w-3 h-3 text-primary" />}
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
                                <div className="p-4 border-t border-border bg-card/50 backdrop-blur-sm">
                                    <div className="flex items-end gap-2">
                                        <Button variant="ghost" size="icon" className="h-10 w-10 text-muted-foreground hover:text-foreground flex-shrink-0">
                                            <Paperclip className="h-5 w-5" />
                                        </Button>
                                        <div className="flex-1 relative">
                                            <input
                                                value={messageText}
                                                onChange={handleInputChange}
                                                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), handleSendMessage())}
                                                placeholder="Type a message..."
                                                className="w-full min-h-[44px] max-h-[120px] py-3 px-4 bg-muted rounded-2xl text-sm outline-none placeholder:text-muted-foreground resize-none focus:ring-2 focus:ring-primary/20 transition-all"
                                            />
                                        </div>
                                        <Button variant="ghost" size="icon" className="h-10 w-10 text-muted-foreground hover:text-foreground flex-shrink-0">
                                            <Smile className="h-5 w-5" />
                                        </Button>
                                        <Button 
                                            onClick={handleSendMessage}
                                            disabled={!messageText.trim()}
                                            className="h-10 w-10 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground flex-shrink-0 transition-all disabled:opacity-50"
                                        >
                                            <Send className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-muted-foreground bg-card p-12 text-center relative overflow-hidden group">
                                <div className="absolute inset-0 bg-grid-black/[0.02] dark:bg-grid-white/[0.02]" />
                                <div className="h-24 w-24 bg-primary/10 rounded-3xl flex items-center justify-center mb-6 ring-4 ring-background shadow-xs relative z-10 transition-transform duration-500 group-hover:scale-105">
                                    <MessageCircle className="h-10 w-10 text-primary opacity-80" />
                                </div>
                                <h3 className="text-xl font-bold text-foreground relative z-10 mb-2">Smart Workspace Comms</h3>
                                <p className="text-sm max-w-[320px] mb-8 relative z-10">
                                    Select any channel or team member from the directory to initiate encrypted collaboration instantly.
                                </p>
                            </div>
                        )}

                        {/* User Search Overlay */}
                        {showUserSearch && (
                            <div className="absolute inset-0 bg-background/95 backdrop-blur-sm z-50 flex flex-col">
                                <div className="h-14 border-b border-border flex items-center justify-between px-4">
                                    <div className="flex items-center gap-3">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => setShowUserSearch(false)}
                                            className="h-8 w-8"
                                        >
                                            <X className="h-4 w-4" />
                                        </Button>
                                        <h3 className="text-sm font-semibold">Start new chat</h3>
                                    </div>
                                </div>
                                <div className="p-4">
                                    <div className="relative mb-4">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            placeholder="Search users..."
                                            value={userSearchQuery}
                                            onChange={(e) => setUserSearchQuery(e.target.value)}
                                            className="pl-9"
                                            autoFocus
                                        />
                                    </div>
                                    <ScrollArea className="h-[calc(100vh-180px)]">
                                        <div className="space-y-1">
                                            {filteredUsers?.map((member) => {
                                                const displayName = member.user.name || member.user.email;
                                                const initials = displayName.charAt(0).toUpperCase();
                                                return (
                                                    <button
                                                        key={member.id}
                                                        onClick={() => handleStartChat(member.user.id)}
                                                        disabled={openDM.isPending}
                                                        className="w-full flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-muted/50 transition-colors text-left"
                                                    >
                                                        <Avatar className="h-10 w-10">
                                                            <AvatarFallback className="text-sm font-semibold bg-primary/20">
                                                                {initials}
                                                            </AvatarFallback>
                                                        </Avatar>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-sm font-medium truncate">{displayName}</p>
                                                            <p className="text-xs text-muted-foreground truncate">{member.user.email}</p>
                                                        </div>
                                                        <UserPlus className="h-4 w-4 text-muted-foreground" />
                                                    </button>
                                                );
                                            })}
                                            {filteredUsers?.length === 0 && (
                                                <div className="text-center py-8 text-sm text-muted-foreground">
                                                    {userSearchQuery ? "No users found" : "No users available"}
                                                </div>
                                            )}
                                        </div>
                                    </ScrollArea>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
