// src/components/chat/ChatDrawer.tsx

import { useChatStore } from "@/store/useChatStore";
import { useAppContext } from "@/contexts/AppContext";
import { ChannelList } from "./ChannelList";
import { MessageView } from "./MessageView";
import { NewChatDialog } from "./NewChatDialog";
import { X, Maximize2 } from "lucide-react";
import { useRef, useEffect } from "react";

export function ChatDrawer() {
  const { isChatOpen, activeChannelId, closeChat, openChatDialog, width, setWidth } =
    useChatStore();
  const isResizing = useRef(false);

  const { activeOrgId, activeSpaceId } = useAppContext();

  const handleExpandClick = () => {
    openChatDialog();
    closeChat();
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing.current) return;
      const newWidth = window.innerWidth - e.clientX;
      if (newWidth > 320 && newWidth < 800) setWidth(newWidth);
    };

    const handleMouseUp = () => {
      if (isResizing.current) {
        isResizing.current = false;
        document.body.style.cursor = "default";
        document.body.style.userSelect = "auto";
      }
    };

    if (isChatOpen) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isChatOpen]);

  if (!isChatOpen) {
    return null;
  }

  return (
    <div
      style={{ width: `${width}px` }}
      className="fixed inset-y-0 right-0 z-50 flex shadow-2xl border-l border-border bg-background transition-[width] duration-300"
    >
      {/* Resize Handle */}
      <div
        className="absolute left-0 top-0 bottom-0 w-1.5 cursor-ew-resize hover:bg-primary/40 active:bg-primary/60 transition-colors z-[70]"
        onMouseDown={(e) => {
          e.preventDefault();
          isResizing.current = true;
          document.body.style.cursor = "ew-resize";
          document.body.style.userSelect = "none";
        }}
      />

      <div className="flex flex-col w-full h-full relative">
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold text-sm">Chat</h2>
            <NewChatDialog orgId={activeOrgId} spaceId={activeSpaceId} />
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={handleExpandClick}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Open full chat page"
            >
              <Maximize2 className="h-4 w-4" />
            </button>
            <button
              onClick={closeChat}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Close chat"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* ── Body ── */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {activeChannelId ? (
            <MessageView
              channelId={activeChannelId}
              orgId={activeOrgId}
              spaceId={activeSpaceId}
            />
          ) : (
            <ChannelList orgId={activeOrgId} spaceId={activeSpaceId} />
          )}
        </div>
      </div>
    </div>
  );
}
