// src/components/chat/ChatDrawer.tsx

import { useState, useEffect } from "react";
import { useChatStore } from "@/store/useChatStore";
import { useChatSocketListeners } from "@/hooks/api/useChat";
import { ChannelList } from "./ChannelList";
import { MessageView } from "./MessageView";
import { ThreadPanel } from "./ThreadPanel";
import { NewChatDialog } from "./NewChatDialog";
import { ChatSearch } from "./ChatSearch";
import { ChatDemoView } from "./ChatDemoView";
import { X, MessageCircle, Menu, Maximize2, Minimize2, Search, Sparkles } from "lucide-react";

export function ChatDrawer() {
  const {
    isChatOpen, activeChannelId, closeChat,
    threadMessage,
    searchOpen, openSearch,
  } = useChatStore();

  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(!activeChannelId);
  const [isFullScreen, setIsFullScreen] = useState(true);
  const [demoMode, setDemoMode] = useState(false);

  // Auto-close mobile sidebar on channel select
  useEffect(() => {
    if (activeChannelId) setMobileSidebarOpen(false);
  }, [activeChannelId]);

  useChatSocketListeners(activeChannelId);

  if (!isChatOpen) return null;

  const threadOpen = !!threadMessage;

  return (
    <>
      {/* ── Global Search Overlay (portal-level, always on top) ── */}
      <ChatSearch />

      {/* ── Main drawer container ── */}
      <div
        className={`fixed z-50 flex bg-background overflow-hidden animate-in duration-200 ${
          isFullScreen
            ? "inset-0 w-screen h-screen"
            : "right-4 top-20 bottom-4 w-[440px] rounded-2xl shadow-2xl border border-border"
        }`}
      >
        {/* ── Mobile overlay for sidebar ── */}
        {isFullScreen && (
          <div
            className={`md:hidden fixed inset-0 z-40 bg-black/50 transition-opacity duration-300 ${
              mobileSidebarOpen ? "opacity-100" : "opacity-0 pointer-events-none"
            }`}
            onClick={() => setMobileSidebarOpen(false)}
          />
        )}

        {/* ═══════════════════════════════════════════
            LEFT SIDEBAR
        ═══════════════════════════════════════════ */}
        <div
          className={`
            flex flex-col border-r border-border h-full bg-background shrink-0
            ${isFullScreen
              ? `fixed md:relative inset-y-0 left-0 z-50 md:z-auto
                 w-[80vw] sm:w-72 md:w-72 lg:w-80
                 transition-transform duration-300 ease-in-out shadow-2xl md:shadow-none
                 ${mobileSidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}`
              : `w-full ${activeChannelId ? "hidden" : "flex flex-col"}`
            }
          `}
        >
          {/* Sidebar header */}
          <div className="flex items-center justify-between px-4 py-4 border-b border-border shrink-0">
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-lg tracking-tight text-foreground">Messages</h2>
              <NewChatDialog />
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={openSearch}
                className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-full transition-colors"
                title="Search"
              >
                <Search className="w-4 h-4" />
              </button>
              <button
                onClick={() => setIsFullScreen(!isFullScreen)}
                className="hidden md:flex p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-full transition-colors"
                title={isFullScreen ? "Dock to side" : "Full screen"}
              >
                {isFullScreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </button>
              <button
                onClick={closeChat}
                className="hidden md:flex p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-full transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
              <button
                onClick={() => {
                  if (isFullScreen) setMobileSidebarOpen(false);
                  else closeChat();
                }}
                className="md:hidden p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-full transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Channel list */}
          <div className="flex-1 overflow-hidden flex flex-col min-h-0">
            <ChannelList />
          </div>
        </div>

        {/* ═══════════════════════════════════════════
            MAIN CHAT AREA
        ═══════════════════════════════════════════ */}
        <div
          className={`flex flex-1 flex-col h-full bg-muted/20 w-full relative min-w-0 ${
            isFullScreen
              ? activeChannelId ? "flex" : "hidden md:flex"
              : activeChannelId ? "flex" : "hidden"
          }`}
        >
          {demoMode ? (
            <ChatDemoView onBack={() => setDemoMode(false)} />
          ) : activeChannelId ? (
            <MessageView
              channelId={activeChannelId}
              onOpenSidebar={() => {
                if (isFullScreen) setMobileSidebarOpen(true);
                else useChatStore.getState().setActiveChannel(null);
              }}
            />
          ) : (
            /* Empty state */
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground relative px-6">
              {isFullScreen && (
                <button
                  onClick={() => setMobileSidebarOpen(true)}
                  className="md:hidden absolute top-4 left-4 p-2 text-foreground bg-background rounded-full shadow-sm border border-border"
                >
                  <Menu className="w-5 h-5" />
                </button>
              )}
              <div className="absolute top-4 right-4 flex items-center gap-2">
                <button onClick={openSearch} className="hidden md:flex p-2 text-muted-foreground hover:bg-muted rounded-full transition-colors border border-border">
                  <Search className="w-4 h-4" />
                </button>
                {isFullScreen && (
                  <button onClick={() => setIsFullScreen(false)} className="hidden md:flex p-2 text-muted-foreground hover:bg-muted rounded-full transition-colors border border-border">
                    <Minimize2 className="w-4 h-4" />
                  </button>
                )}
                <button onClick={closeChat} className="p-2 text-foreground bg-background rounded-full shadow-sm border border-border">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex items-center justify-center w-16 h-16 mb-5 rounded-2xl bg-primary/10 shadow-sm">
                <MessageCircle className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-xl font-bold text-foreground mb-2">Welcome to Chat</h3>
              <p className="text-sm text-center max-w-xs text-muted-foreground mb-6">
                Select a conversation to start chatting, or invite teammates to collaborate.
              </p>

              {/* Quick action cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full max-w-sm text-left">
                <button onClick={() => setMobileSidebarOpen(true)} className="md:hidden flex flex-col gap-1 p-3 rounded-xl border border-border hover:bg-muted/60 transition-colors">
                  <span className="text-lg">💬</span>
                  <p className="text-sm font-semibold text-foreground">Open Chat</p>
                  <p className="text-xs text-muted-foreground">Browse conversations</p>
                </button>
                <NewChatDialog defaultTab="dm">
                  <button className="hidden md:flex flex-col gap-1 p-3 rounded-xl border border-border hover:bg-muted/60 transition-colors">
                    <span className="text-lg">💬</span>
                    <p className="text-sm font-semibold text-foreground">Start Chat</p>
                    <p className="text-xs text-muted-foreground">Message a teammate</p>
                  </button>
                </NewChatDialog>
                <NewChatDialog defaultTab="channel">
                  <button className="flex flex-col gap-1 p-3 rounded-xl border border-border hover:bg-muted/60 transition-colors">
                    <span className="text-lg">📢</span>
                    <p className="text-sm font-semibold text-foreground">Create Channel</p>
                    <p className="text-xs text-muted-foreground">For a team or topic</p>
                  </button>
                </NewChatDialog>
                <button
                  onClick={() => setDemoMode(true)}
                  className="flex flex-col gap-1 p-3 rounded-xl border border-violet-500/30 bg-violet-500/5 hover:bg-violet-500/10 transition-colors"
                >
                  <Sparkles className="w-4 h-4 text-violet-400" />
                  <p className="text-sm font-semibold text-foreground">Preview Demo</p>
                  <p className="text-xs text-muted-foreground">See sample chats</p>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ═══════════════════════════════════════════
            THREAD PANEL (right side, slides in)
        ═══════════════════════════════════════════ */}
        {threadOpen && activeChannelId && (
          <ThreadPanel />
        )}
      </div>
    </>
  );
}
