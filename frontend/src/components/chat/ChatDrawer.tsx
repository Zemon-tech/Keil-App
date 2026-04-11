// src/components/chat/ChatDrawer.tsx

import { useChatStore } from "@/store/useChatStore";
import { useChatSocketListeners } from "@/hooks/api/useChat";
import { ChannelList } from "./ChannelList";
import { MessageView } from "./MessageView";
import { NewChatDialog } from "./NewChatDialog";
import { X } from "lucide-react";

export function ChatDrawer() {
  // Read state from Zustand
  const { isChatOpen, activeChannelId, closeChat } = useChatStore();

  // ⚠️ Mount socket listeners here — once, at the drawer level.
  // They stay active even when you navigate between channel list and messages.
  useChatSocketListeners(activeChannelId);

  // Don't render anything if the drawer is closed
  if (!isChatOpen) return null;

  return (
    // Fixed panel pinned to the right side of the screen, on top of everything
    <div className="fixed inset-y-0 right-0 z-50 flex w-80 shadow-xl border-l border-border bg-background">
      <div className="flex flex-col w-full h-full">

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold text-sm">Chat</h2>
            <NewChatDialog />
          </div>
          <button
            onClick={closeChat}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Close chat"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* ── Body ──
            If a channel is selected → show its messages.
            If no channel selected → show the list of conversations. */}
        {activeChannelId ? (
          <MessageView channelId={activeChannelId} />
        ) : (
          <ChannelList />
        )}

      </div>
    </div>
  );
}
