// src/components/chat/ChannelList.tsx

import { useChatChannels, useReadChannel } from "@/hooks/api/useChat";
import { useChatStore } from "@/store/useChatStore";
import { MessageCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export function ChannelList() {
  const { data: channels = [], isLoading } = useChatChannels();
  const { setActiveChannel } = useChatStore();
  const readChannel = useReadChannel();

  // Called when the user clicks a conversation row
  const handleOpenChannel = (channelId: string) => {
    setActiveChannel(channelId);       // → switches view to MessageView
    readChannel.mutate(channelId);     // → tells backend "I've read this"
                                       //   → clears the red dot in the cache
  };

  // ── Loading state ──
  if (isLoading) {
    return (
      <div className="flex-1 overflow-hidden px-4 py-2 space-y-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-2 w-16" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  // ── Empty state ──
  if (channels.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-2 text-muted-foreground text-sm p-4">
        <MessageCircle className="h-8 w-8 opacity-40" />
        <p>No conversations yet.</p>
      </div>
    );
  }

  // ── Channel list ──
  return (
    <ul className="flex-1 overflow-y-auto divide-y divide-border">
      {channels.map((channel) => {
        // For DMs → show the other person's name
        // For groups → show the group's name
        const displayName =
          channel.type === "direct"
            ? channel.members[0]?.name ?? "Unknown"
            : channel.name ?? "Group";

        return (
          <li key={channel.id}>
            <button
              onClick={() => handleOpenChannel(channel.id)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors text-left"
            >
              {/* Avatar circle — just shows the first letter of the name */}
              <span className="flex-shrink-0 h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-semibold uppercase">
                {displayName.charAt(0)}
              </span>

              {/* Name + timestamp */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{displayName}</p>
                {channel.last_message_at && (
                  <p className="text-xs text-muted-foreground">
                    {new Date(channel.last_message_at).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                )}
              </div>

              {/* Red unread badge — only shown when unread_count > 0 */}
              {channel.unread_count > 0 && (
                <span className="flex-shrink-0 h-5 w-5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
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
