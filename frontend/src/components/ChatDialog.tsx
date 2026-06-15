import {
    Dialog,
    DialogContent,
    DialogTitle,
} from "@/components/ui/dialog";
import { VisuallyHidden } from "radix-ui";
import { cn } from "@/lib/utils";
import { useChatStore } from "@/store/useChatStore";
import { useChatChannels, useReadChannel, useDeleteChannel } from "@/hooks/api/useChat";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { getOptimizedImageUrl } from "@/lib/image-optimizer";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
    Hash, Search,
    Users, MessageCircle, Trash2, Minimize2
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";
import { useAppContext } from "@/contexts/AppContext";
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
import { MessageView } from "@/components/chat/MessageView";

interface ChatDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function ChatDialog({ open, onOpenChange }: ChatDialogProps) {
    const { activeChannelId, setActiveChannel, closeChatDialog, openChat } = useChatStore();
    const { activeOrgId, activeSpaceId } = useAppContext();
    const { data: channels = [], isLoading } = useChatChannels(activeOrgId, activeSpaceId);
    const readChannel = useReadChannel(activeOrgId, activeSpaceId);
    const deleteChannel = useDeleteChannel(activeOrgId, activeSpaceId);

    const [searchQuery, setSearchQuery] = useState("");
    const [searchOpen, setSearchOpen] = useState(false);

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

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
             <DialogContent
                showCloseButton={true}
                className="!flex !flex-col !max-w-[calc(100vw-40px)] !w-[calc(100vw-40px)] !h-[calc(100vh-40px)] !max-h-[calc(100vh-40px)] !rounded-2xl !p-0 !gap-0 border border-border/80 bg-background shadow-2xl overflow-hidden"
            >
                <VisuallyHidden.Root>
                    <DialogTitle>Chat</DialogTitle>
                </VisuallyHidden.Root>

                {/* Minimize button — collapses back to the side drawer */}
                <button
                    onClick={() => { closeChatDialog(); openChat(); }}
                    className="absolute top-4 right-11 z-50 flex size-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-all duration-100 ease-out active:scale-90"
                    aria-label="Minimize chat to sidebar"
                >
                    <Minimize2 className="size-4" />
                </button>                 <div className="flex flex-row h-full w-full overflow-hidden min-h-0">
                    {/* ── Left Sidebar: Channels & Participants ── */}
                    <div className="w-80 shrink-0 grow-0 bg-card/60 backdrop-blur-xs border-r border-border/50 flex flex-col h-full overflow-hidden">
                        {/* Sidebar Header */}
                        {searchOpen ? (
                            <div className="flex items-center gap-2 px-3 py-2 shrink-0 border-b border-border/50 h-14">
                                <div className="relative flex-1">
                                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                                    <Input
                                        autoFocus
                                        placeholder="Search messages or users..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="pl-8 h-8 text-xs bg-muted/65 hover:bg-muted/90 border border-border/40 focus-visible:ring-1 focus-visible:ring-primary/20 w-full rounded-xl"
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
                                                "w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left transition-[transform,background-color] duration-150 ease-out active:scale-[0.98] group",
                                                activeChannelId === channel.id
                                                    ? "bg-primary/10 text-primary font-medium"
                                                    : "hover:bg-muted/65 text-foreground/90"
                                            )}
                                        >
                                            <div className={cn(
                                                "size-8.5 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors",
                                                activeChannelId === channel.id ? "bg-primary text-primary-foreground" : "bg-muted/80"
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
                                                    <span className="text-xs text-muted-foreground/80">
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
                                                    "w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left transition-[transform,background-color] duration-150 ease-out active:scale-[0.98] group",
                                                    activeChannelId === channel.id
                                                        ? "bg-primary/10 text-primary font-medium"
                                                        : "hover:bg-muted/65 text-foreground/90"
                                                )}
                                            >
                                                <div className="relative flex-shrink-0">
                                                    <Avatar className="size-8.5 border border-border/10 shadow-2xs">
                                                        <AvatarImage src={getOptimizedImageUrl(channel.members[0]?.avatar_url, { width: 108, height: 108 })} alt={displayName} />
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
                                                        <span className="text-xs text-muted-foreground/80">
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
                                                    <AvatarImage src={getOptimizedImageUrl(currentChannel.members[0]?.avatar_url, { width: 108, height: 108 })} alt={currentChannel.members[0]?.name || "Unknown"} />
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
                                <MessageView
                                    channelId={activeChannelId}
                                    orgId={activeOrgId}
                                    spaceId={activeSpaceId}
                                    hideHeader={true}
                                />
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
