// src/components/chat/ChatDrawer.tsx

import { useChatStore } from "@/store/useChatStore";
import { useChatSocketListeners } from "@/hooks/api/useChat";
import { ChannelList } from "./ChannelList";
import { MessageView } from "./MessageView";
import { NewChatDialog } from "./NewChatDialog";
import { X, Maximize2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState, useRef, useEffect } from "react";

export function ChatDrawer() {
  // Read state from Zustand
  const { isChatOpen, activeChannelId, closeChat } = useChatStore();
  const [width, setWidth] = useState(360);
  const isResizing = useRef(false);
  const navigate = useNavigate();

  const handleExpandClick = () => {
    navigate('/chat');
    closeChat();
  };

  // ⚠️ Mount socket listeners here — once, at the drawer level.
  // They stay active even when you navigate between channel list and messages.
  useChatSocketListeners(activeChannelId);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing.current) return;
      // Calculate from the right edge
      const newWidth = window.innerWidth - e.clientX;
      if (newWidth > 320 && newWidth < 800) {
        setWidth(newWidth);
      }
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

  // Don't render anything if the drawer is closed
  if (!isChatOpen) return null;

  return (
    // Fixed panel pinned to the right side of the screen, on top of everything
    <div 
      style={{ width: `${width}px` }}
      className="fixed inset-y-0 right-0 z-[60] flex shadow-2xl border-l border-border bg-background transition-colors duration-200"
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
            <NewChatDialog />
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

        {/* ── Body ──
            If a channel is selected → show its messages.
            If no channel selected → show the list of conversations. */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {activeChannelId ? (
            <MessageView channelId={activeChannelId} />
          ) : (
            <ChannelList />
          )}
        </div>

      </div>
    </div>
  );
}
