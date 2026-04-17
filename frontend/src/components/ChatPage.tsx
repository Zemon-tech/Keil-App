import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

import { useChatStore } from "@/store/useChatStore";
import { useChatChannels, useReadChannel, useChatSocketListeners } from "@/hooks/api/useChat";
import { MessageView } from "./chat/MessageView";
import { NewChatDialog } from "./chat/NewChatDialog";
import { MessageCircle, Hash, X } from "lucide-react";
import { useNavigate } from "react-router-dom";

export function ChatPage() {
  const { activeChannelId, setActiveChannel } = useChatStore();
  const { data: channels = [] } = useChatChannels();
  const readChannel = useReadChannel();
  const navigate = useNavigate();

  // Mount global socket listeners at page level
  useChatSocketListeners(activeChannelId);

  const groupChannels = channels.filter(c => c.type === "group");
  const directChannels = channels.filter(c => c.type === "direct");

  const handleOpenChannel = (id: string) => {
    setActiveChannel(id);
    readChannel.mutate(id);
  };

  const handleClose = () => {
    navigate(-1);
  };

  return (
    <div className="flex h-[calc(100vh-3.5rem)] bg-background overflow-hidden">
      {/* ── Fixed-width Sidebar ── */}
      <div className="w-64 shrink-0 bg-card border-r border-border flex flex-col h-full">
        {/* Sidebar Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <span className="text-sm font-semibold">Chat</span>
          <div className="flex items-center gap-1">
            <NewChatDialog />
            <button
              onClick={handleClose}
              className="text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Close chat page"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Channels List */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-2">
            <div className="px-2 py-1.5">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Channels</span>
            </div>
            {groupChannels.map((channel) => (
              <button
                key={channel.id}
                onClick={() => handleOpenChannel(channel.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-2 py-2 rounded-lg text-left transition-all duration-200 group",
                  activeChannelId === channel.id
                    ? "bg-primary/10 text-primary"
                    : "hover:bg-muted text-foreground"
                )}
              >
                <Hash className={cn(
                  "h-4 w-4 flex-shrink-0",
                  activeChannelId === channel.id ? "text-primary" : "text-muted-foreground"
                )} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium truncate">{channel.name || "Group"}</span>
                    {channel.unread_count > 0 && (
                      <Badge variant="secondary" className="h-5 px-1.5 text-xs bg-primary/10 text-primary">
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
            ))}
          </div>

          <div className="p-2 mt-2">
            <div className="px-2 py-1.5">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Direct Messages</span>
            </div>
            {directChannels.map((channel) => {
              const displayName = channel.members[0]?.name ?? "Unknown";
              return (
                <button
                  key={channel.id}
                  onClick={() => handleOpenChannel(channel.id)}
                  className={cn(
                    "w-full flex items-center gap-3 px-2 py-2 rounded-lg text-left transition-all duration-200 group",
                    activeChannelId === channel.id
                      ? "bg-primary/10 text-primary"
                      : "hover:bg-muted text-foreground"
                  )}
                >
                  <div className="relative flex-shrink-0">
                    <Avatar className="h-6 w-6">
                      <AvatarFallback className="text-xs">{displayName.charAt(0).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="absolute -bottom-0.5 -right-0.5 h-2 w-2 bg-green-500 rounded-full border border-card" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium truncate">{displayName}</span>
                      {channel.unread_count > 0 && (
                        <Badge variant="secondary" className="h-5 px-1.5 text-xs bg-primary/10 text-primary">
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
            })}
          </div>
        </div>
      </div>

      {/* ── Main Chat Area ── */}
      <div className="flex-1 h-full overflow-hidden">
        {activeChannelId ? (
          <MessageView channelId={activeChannelId} />
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
      </div>
    </div>
  );
}
