// src/components/chat/ChatDrawer.tsx

import { useChatStore } from "@/store/useChatStore";
import { useAppContext } from "@/contexts/AppContext";
import { ChannelList } from "./ChannelList";
import { MessageView } from "./MessageView";
import { NewChatDialog } from "./NewChatDialog";
import { X, Maximize2, ArrowLeft, Users } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { getOptimizedImageUrl } from "@/lib/image-optimizer";

import { useChatChannels } from "@/hooks/api/useChat";
import { useMe } from "@/hooks/api/useMe";
import { GroupSettingsDialog } from "./GroupSettingsDialog";

export function ChatDrawer() {
  const { isChatOpen, activeChannelId, closeChat, openChatDialog, setActiveChannel } =
    useChatStore();
  const width = 400;

  const { activeOrgId, activeSpaceId } = useAppContext();

  const { data: channels = [] } = useChatChannels(activeOrgId, activeSpaceId);
  const currentChannel = channels.find((c) => c.id === activeChannelId);
  const { data: me } = useMe();

  const otherMember = currentChannel?.type === "direct"
    ? currentChannel.members.find((m) => m.id !== me?.id) || currentChannel.members[0]
    : undefined;

  const channelName = currentChannel?.type === "direct"
    ? otherMember?.name ?? "Unknown"
    : currentChannel?.name ?? "Group Chat";

  const handleExpandClick = () => {
    openChatDialog();
    closeChat();
  };

  if (!isChatOpen) {
    return null;
  }

  return (
    <div
      style={{ width: `${width}px` }}
      className="absolute inset-y-0 right-0 z-50 flex shadow-2xl border-l border-border bg-background transition-[width] duration-300"
    >

      <div className="flex flex-col size-full relative">
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 h-14 shrink-0 bg-card/50 backdrop-blur-md">
          {activeChannelId && currentChannel ? (
            <>
              <div className="flex items-center gap-3 min-w-0">
                <button
                  onClick={() => setActiveChannel(null)}
                  className="flex items-center justify-center size-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-all duration-100 ease-out active:scale-90 shrink-0"
                  aria-label="Go back to chat list"
                >
                  <ArrowLeft className="size-4" />
                </button>
                
                <div className="flex items-center gap-2 min-w-0">
                  {currentChannel?.type === "group" ? (
                    <div className="size-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-semibold text-xs shrink-0 border border-primary/20">
                      <Users className="size-4" />
                    </div>
                  ) : (
                    <Avatar className="size-8 shrink-0 rounded-full">
                      <AvatarImage src={getOptimizedImageUrl(otherMember?.avatar_url, { width: 96, height: 96 })} alt={channelName} />
                      <AvatarFallback className="text-xs font-semibold bg-primary/20 text-foreground uppercase rounded-full">
                        {channelName.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  )}
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-semibold text-foreground leading-none truncate">{channelName}</span>
                    <span className="text-[10px] text-muted-foreground mt-1 truncate">
                      {currentChannel?.type === "group" ? `${currentChannel.members.length} members` : "Direct Message"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                {currentChannel?.type === "group" ? (
                  <GroupSettingsDialog
                    channel={currentChannel}
                    orgId={activeOrgId}
                    spaceId={activeSpaceId}
                  />
                ) : (
                  <button
                    onClick={handleExpandClick}
                    className="flex items-center justify-center size-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-all duration-100 ease-out active:scale-90"
                    aria-label="Maximize chat"
                  >
                    <Maximize2 className="size-4" />
                  </button>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <h2 className="font-semibold text-sm">Chat</h2>
                <NewChatDialog orgId={activeOrgId} spaceId={activeSpaceId} />
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={handleExpandClick}
                  className="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-all duration-100 ease-out active:scale-90"
                  aria-label="Open full chat page"
                >
                  <Maximize2 className="size-4" />
                </button>
                <button
                  onClick={closeChat}
                  className="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-all duration-100 ease-out active:scale-90"
                  aria-label="Close chat"
                >
                  <X className="size-4" />
                </button>
              </div>
            </>
          )}
        </div>

        {/* ── Body ── */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {activeChannelId ? (
            <MessageView
              channelId={activeChannelId}
              orgId={activeOrgId}
              spaceId={activeSpaceId}
              hideHeader={true}
            />
          ) : (
            <ChannelList orgId={activeOrgId} spaceId={activeSpaceId} />
          )}
        </div>
      </div>
    </div>
  );
}
