// src/components/chat/ChannelList.tsx

import { useChatChannels, useReadChannel } from "@/hooks/api/useChat";
import { useChatStore } from "@/store/useChatStore";
import { MessageCircle, Users } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { getOptimizedImageUrl } from "@/lib/image-optimizer";
import { useMe } from "@/hooks/api/useMe";

interface ChannelListProps {
  orgId: string | null;
  spaceId: string | null;
}

export function ChannelList({ orgId, spaceId }: ChannelListProps) {
  const { data: channels = [], isLoading } = useChatChannels(orgId, spaceId);
  const { setActiveChannel } = useChatStore();
  const readChannel = useReadChannel(orgId, spaceId);
  const { data: me } = useMe();

  const handleOpenChannel = (channelId: string) => {
    setActiveChannel(channelId);
    readChannel.mutate(channelId);
  };

  if (isLoading) {
    return (
      <div className="flex-1 overflow-hidden px-4 py-2 space-y-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="size-8 rounded-full shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-2 w-16" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (channels.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-2 text-muted-foreground text-sm p-4">
        <MessageCircle className="size-8 opacity-40" />
        <p>No conversations yet.</p>
      </div>
    );
  }

  return (
    <ul className="flex-1 overflow-y-auto py-2 space-y-0.5">
      {channels.map((channel) => {
        const otherMember = channel.type === "direct"
          ? channel.members.find((m) => m.id !== me?.id) || channel.members[0]
          : undefined;

        const displayName =
          channel.type === "direct"
            ? otherMember?.name ?? "Unknown"
            : channel.name ?? "Group";

        return (
          <li key={channel.id} className="px-2">
            <button
              onClick={() => handleOpenChannel(channel.id)}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-muted/65 transition-[transform,background-color] duration-150 ease-out text-left active:scale-[0.98]"
            >
              {channel.type === "group" ? (
                <div className="shrink-0 size-8.5 rounded-xl bg-primary/20 flex items-center justify-center text-primary font-semibold text-xs border border-primary/10">
                  <Users className="size-4" />
                </div>
              ) : (
                <Avatar className="shrink-0 size-8.5 rounded-full border border-border/10">
                  <AvatarImage src={getOptimizedImageUrl(otherMember?.avatar_url, { width: 96, height: 96 })} alt={displayName} />
                  <AvatarFallback className="text-xs font-semibold bg-primary/20 text-foreground uppercase rounded-full">
                    {displayName.charAt(0)}
                  </AvatarFallback>
                </Avatar>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground/90 truncate">{displayName}</p>
                {channel.last_message_at && (
                  <p className="text-xs text-muted-foreground/80">
                    {new Date(channel.last_message_at).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                )}
              </div>
              {channel.unread_count > 0 && (
                <span className="shrink-0 size-5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center shadow-xs">
                  {channel.unread_count > 9 ? "9+" : channel.unread_count}
                </span>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
