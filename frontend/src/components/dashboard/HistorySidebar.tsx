import { useCallback, useEffect, useState, useRef } from "react";
import { cn } from "@/lib/utils";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarFooter,
  SidebarProvider,
} from "@/components/ui/sidebar";
import {
  X,
  Pen,
  Check,
  Trash2,
  SquarePen,
  Search,
  BookOpen,
  Folder,
  LayoutGrid,
  MoreHorizontal,
  ChevronDown,
  ChevronRight,
  MessageSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import api from "@/lib/api";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Thread {
  id: string;
  title: string | null;
  createdAt: string;
}

interface HistorySidebarProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeOrgId: string | null | undefined;
  activeSpaceId: string | null | undefined;
  currentThreadId: string | undefined;
  onSelectThread: (id: string) => void;
  onNewChat: () => void;
}

const mainTabs = [
  { id: "chats", title: "Chats", icon: MessageSquare },
  { id: "lib", title: "Lib", icon: BookOpen },
  { id: "projects", title: "Projects", icon: Folder },
  { id: "apps", title: "Apps", icon: LayoutGrid },
];

// ─── Component ────────────────────────────────────────────────────────────────

export function HistorySidebar({
  open,
  onOpenChange,
  activeOrgId,
  activeSpaceId,
  currentThreadId,
  onSelectThread,
  onNewChat,
}: HistorySidebarProps) {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingThreadId, setEditingThreadId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [sidebarMode, setSidebarMode] = useState<"chats" | "lib" | "projects" | "apps">("chats");
  const [recentsOpen, setRecentsOpen] = useState(true);
  
  const searchInputRef = useRef<HTMLInputElement>(null);

  // ── Data Fetching ───────────────────────────────────────────────────────────

  const fetchThreads = useCallback(async () => {
    try {
      const res = await api.get<{ data: { threads: Thread[] } }>("v1/ai/threads");
      setThreads(res.data.data.threads || []);
    } catch {
      // silently fail — thread list is non-critical
    }
  }, []);

  useEffect(() => {
    if (open) fetchThreads();
  }, [open, fetchThreads]);

  // Focus search input when toggled on
  useEffect(() => {
    if (showSearch && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [showSearch]);

  // ── Thread Actions ──────────────────────────────────────────────────────────

  const handleDeleteThread = useCallback(
    async (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      if (!confirm("Are you sure you want to delete this conversation?")) return;
      try {
        await api.delete(`v1/ai/threads/${id}`);
        setThreads((prev) => prev.filter((t) => t.id !== id));
        const key = `chat_thread_id_${activeOrgId || "personal"}_${activeSpaceId || "default"}`;
        if (sessionStorage.getItem(key) === id) {
          onNewChat();
        }
      } catch {
        // silently fail
      }
    },
    [activeOrgId, activeSpaceId, onNewChat]
  );

  const handleStartRename = useCallback(
    (id: string, currentTitle: string | null, e: React.MouseEvent) => {
      e.stopPropagation();
      setEditingThreadId(id);
      setEditingTitle(currentTitle || "Untitled conversation");
    },
    []
  );

  const handleSaveRename = useCallback(
    async (id: string) => {
      if (!editingTitle.trim()) return;
      try {
        await api.put(`v1/ai/threads/${id}`, { title: editingTitle.trim() });
        setThreads((prev) =>
          prev.map((t) =>
            t.id === id ? { ...t, title: editingTitle.trim() } : t
          )
        );
        setEditingThreadId(null);
      } catch {
        // silently fail
      }
    },
    [editingTitle]
  );

  const handleSelectThread = useCallback(
    (id: string) => {
      onSelectThread(id);
      onOpenChange(false);
    },
    [onSelectThread, onOpenChange]
  );

  const handleNewChat = useCallback(() => {
    onNewChat();
    onOpenChange(false);
  }, [onNewChat, onOpenChange]);

  // ── Filtered list ───────────────────────────────────────────────────────────

  const filteredThreads = threads.filter((t) => {
    const title = t.title || "Untitled conversation";
    return title.toLowerCase().includes(searchQuery.toLowerCase());
  });

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <SidebarProvider
      open={open}
      onOpenChange={onOpenChange}
      style={{ "--sidebar-width": "20rem" } as React.CSSProperties}
      className="contents"
    >
      <Sidebar
        side="right"
        collapsible="offcanvas"
        className="border-l border-sidebar-border shadow-none bg-sidebar text-sidebar-foreground z-20"
      >
        {/* ── Header: Motion-style Tabs ── */}
        <SidebarHeader className="h-12 justify-center px-3 border-b border-sidebar-border shrink-0 bg-sidebar">
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar w-full">
            {mainTabs.map((tab) => {
              const isActive = sidebarMode === tab.id;

              return (
                <Button
                  key={tab.id}
                  variant="ghost"
                  size="sm"
                  onClick={() => setSidebarMode(tab.id as any)}
                  className={cn(
                    "h-8 px-2.5 rounded-lg transition-all flex items-center gap-1.5 border border-transparent hover:bg-sidebar-accent cursor-pointer text-xs",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-foreground border-sidebar-border/10 shadow-sm"
                      : "text-muted-foreground"
                  )}
                >
                  <tab.icon className="h-4 w-4 shrink-0" />
                  {isActive && (
                    <span className="font-semibold tracking-tight leading-none">
                      {tab.title}
                    </span>
                  )}
                </Button>
              );
            })}
            
            <div className="flex-1" />

            {/* New Chat Button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={handleNewChat}
              className="size-8 shrink-0 rounded-full text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground cursor-pointer"
              title="New Chat"
            >
              <SquarePen className="h-4 w-4" />
            </Button>

            {/* Close Sidebar Button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onOpenChange(false)}
              className="size-8 shrink-0 text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground cursor-pointer"
              title="Close history"
            >
              <X className="size-4" />
            </Button>
          </div>
        </SidebarHeader>

        {/* ── Content ───────────────────────────────────────────────────── */}
        <SidebarContent className="overflow-hidden bg-sidebar flex flex-col pt-2 select-none">
          {sidebarMode === "chats" && (
            <div className="flex-1 flex flex-col min-h-0">
              <div className="px-2.5 space-y-0.5 shrink-0">
                {/* Search chats toggle */}
                <div className="w-full">
                  <button
                    onClick={() => setShowSearch(!showSearch)}
                    className="w-full flex items-center justify-between px-3 py-2 text-[13px] font-medium text-sidebar-foreground hover:bg-sidebar-accent rounded-lg transition-colors cursor-pointer select-none"
                  >
                    <div className="flex items-center gap-3">
                      <Search className="size-4 text-muted-foreground" />
                      <span>Search chats</span>
                    </div>
                    {searchQuery && (
                      <span className="text-[10px] bg-sidebar-accent px-1.5 py-0.5 rounded text-muted-foreground">
                        Active
                      </span>
                    )}
                  </button>
                  {showSearch && (
                    <div className="px-3 pb-2 pt-0.5 animate-in slide-in-from-top-1 duration-150">
                      <input
                        ref={searchInputRef}
                        type="text"
                        placeholder="Search conversations..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full h-8 bg-background/50 border border-sidebar-border rounded-lg px-2.5 text-xs text-sidebar-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/10"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Recents section header */}
              <div className="flex items-center justify-between px-5 py-2 mt-3 text-[10px] font-bold text-muted-foreground tracking-wider select-none uppercase font-sans">
                <div 
                  onClick={() => setRecentsOpen(!recentsOpen)}
                  className="flex items-center gap-1.5 cursor-pointer hover:text-sidebar-foreground transition-colors"
                >
                  {recentsOpen ? (
                    <ChevronDown className="size-3 text-muted-foreground shrink-0" />
                  ) : (
                    <ChevronRight className="size-3 text-muted-foreground shrink-0" />
                  )}
                  <span>Recents</span>
                </div>
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <button onClick={handleNewChat} className="hover:text-sidebar-foreground transition-colors cursor-pointer">
                    <SquarePen className="size-3" />
                  </button>
                  <MoreHorizontal className="size-3 cursor-pointer hover:text-sidebar-foreground transition-colors" />
                </div>
              </div>

              {/* Thread list */}
              <div className="flex-1 overflow-y-auto overflow-x-hidden no-scrollbar px-2.5 pb-4 mt-1">
                {recentsOpen && (
                  <div className="space-y-0.5 animate-in fade-in duration-200">
                    {filteredThreads.length === 0 ? (
                      <div className="text-center py-10 text-xs text-muted-foreground/60">
                        {searchQuery
                          ? "No matching conversations"
                          : "No past conversations"}
                      </div>
                    ) : (
                      filteredThreads.map((t) => {
                        const isActive = currentThreadId === t.id;
                        const isEditing = editingThreadId === t.id;

                        return (
                          <div
                            key={t.id}
                            onClick={() => !isEditing && handleSelectThread(t.id)}
                            className={cn(
                              "flex items-center justify-between px-3 py-2.5 rounded-lg cursor-pointer group border border-transparent transition-colors w-full min-w-0 mb-0.5",
                              isActive
                                ? "bg-sidebar-accent text-sidebar-foreground font-medium"
                                : "hover:bg-sidebar-accent/50 text-sidebar-foreground"
                            )}
                          >
                            {isEditing ? (
                              <div
                                className="flex items-center gap-1.5 py-0.5 w-full"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <input
                                  type="text"
                                  value={editingTitle}
                                  onChange={(e) => setEditingTitle(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") handleSaveRename(t.id);
                                    if (e.key === "Escape") setEditingThreadId(null);
                                  }}
                                  autoFocus
                                  className="flex-1 bg-background border border-sidebar-border rounded px-1.5 py-0.5 text-xs text-sidebar-foreground focus:outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/10 min-w-0"
                                />
                                <button
                                  onClick={() => handleSaveRename(t.id)}
                                  className="size-6 rounded-md hover:bg-sidebar-accent flex items-center justify-center text-primary transition-colors cursor-pointer"
                                >
                                  <Check className="size-3.5" />
                                </button>
                                <button
                                  onClick={() => setEditingThreadId(null)}
                                  className="size-6 rounded-md hover:bg-sidebar-accent flex items-center justify-center text-muted-foreground hover:text-sidebar-foreground transition-colors cursor-pointer"
                                >
                                  <X className="size-3.5" />
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center justify-between gap-2 w-full min-w-0">
                                <span className="text-[13px] font-normal block truncate w-full flex-1">
                                  {t.title || "Untitled conversation"}
                                </span>

                                <div className="flex items-center gap-1.5 shrink-0">
                                  {isActive && (
                                    <div className="size-2 rounded-full border border-primary bg-transparent" />
                                  )}
                                  
                                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                      onClick={(e) => handleStartRename(t.id, t.title, e)}
                                      className="size-5 rounded-md hover:bg-sidebar-accent flex items-center justify-center text-muted-foreground hover:text-sidebar-foreground transition-colors cursor-pointer"
                                      title="Rename"
                                    >
                                      <Pen className="size-3" />
                                    </button>
                                    <button
                                      onClick={(e) => handleDeleteThread(t.id, e)}
                                      className="size-5 rounded-md hover:bg-sidebar-accent flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors cursor-pointer"
                                      title="Delete"
                                    >
                                      <Trash2 className="size-3" />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {sidebarMode === "lib" && (
            <div className="p-6 text-center text-xs text-muted-foreground animate-in fade-in duration-200">
              <BookOpen className="size-8 mx-auto mb-2 opacity-40 text-muted-foreground" />
              <p className="font-medium text-sidebar-foreground">Library</p>
              <p className="mt-1 text-[11px] text-muted-foreground/60">Your saved snippets and files will appear here.</p>
            </div>
          )}

          {sidebarMode === "projects" && (
            <div className="p-6 text-center text-xs text-muted-foreground animate-in fade-in duration-200">
              <Folder className="size-8 mx-auto mb-2 opacity-40 text-muted-foreground" />
              <p className="font-medium text-sidebar-foreground">Projects</p>
              <p className="mt-1 text-[11px] text-muted-foreground/60">Your active workspace projects and pipelines.</p>
            </div>
          )}

          {sidebarMode === "apps" && (
            <div className="p-6 text-center text-xs text-muted-foreground animate-in fade-in duration-200">
              <LayoutGrid className="size-8 mx-auto mb-2 opacity-40 text-muted-foreground" />
              <p className="font-medium text-sidebar-foreground">Connected Apps</p>
              <p className="mt-1 text-[11px] text-muted-foreground/60">Integrate Slack, GitHub, and other plugins.</p>
            </div>
          )}
        </SidebarContent>
        <SidebarFooter className="border-t border-sidebar-border bg-sidebar p-3 text-center text-[10.5px] text-muted-foreground/50 select-none">
          Keil AI — Powered by Mastra
        </SidebarFooter>
      </Sidebar>
    </SidebarProvider>
  );
}