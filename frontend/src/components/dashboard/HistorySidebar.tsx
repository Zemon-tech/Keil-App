import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarFooter,
  SidebarProvider,
  SidebarInput,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import {
  History,
  X,
  Pen,
  Check,
  Trash2,
  SquarePen,
  Calendar,
} from "lucide-react";
import api from "@/lib/api";
import { ScrollArea } from "@/components/ui/scroll-area";

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
  onSelectThread: (id: string) => void;
  onNewChat: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function HistorySidebar({
  open,
  onOpenChange,
  activeOrgId,
  activeSpaceId,
  onSelectThread,
  onNewChat,
}: HistorySidebarProps) {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingThreadId, setEditingThreadId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");

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

  // ── Thread Actions ──────────────────────────────────────────────────────────

  const handleDeleteThread = useCallback(
    async (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      if (!confirm("Are you sure you want to delete this conversation?")) return;
      try {
        await api.delete(`v1/ai/threads/${id}`);
        setThreads((prev) => prev.filter((t) => t.id !== id));
        const key = `chat_thread_id_${activeOrgId || "personal"}_${activeSpaceId || "default"}`;
        if (localStorage.getItem(key) === id) {
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
    /*
     * We wrap with a *second* SidebarProvider (controlled) so this sidebar
     * is independent from the main left-nav SidebarProvider in Layout.tsx.
     * `style` overrides the CSS width variable to match our w-80 design.
     */
    <SidebarProvider
      open={open}
      onOpenChange={onOpenChange}
      style={{ "--sidebar-width": "20rem" } as React.CSSProperties}
      /* Prevent this wrapper from adding flex/min-h that breaks the
         Dashboard's own layout — the Dashboard already handles its flex. */
      className="contents"
    >
      <Sidebar
        side="right"
        collapsible="offcanvas"
        /* Match the background of the Dashboard (bg-background) so there's
           no card/shadow contrast. The Sidebar primitive uses bg-sidebar which
           is aliased to var(--background) in index.css, so this is automatic.
           We suppress the default border and any shadow. */
        className="border-l border-border/60 shadow-none bg-background z-10"
      >
        {/* ── Header ────────────────────────────────────────────────────── */}
        <SidebarHeader className="px-4 py-3 border-b border-border/60">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <History className="size-3.5 text-primary" />
              Conversations
            </h2>
            <Button
              variant="ghost"
              size="icon"
              className="size-7 rounded-full hover:bg-muted/80 text-muted-foreground hover:text-foreground"
              onClick={() => onOpenChange(false)}
            >
              <X className="size-3.5" />
            </Button>
          </div>

          {/* Search */}
          <SidebarInput
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="mt-2 h-8 text-[13px]"
          />
        </SidebarHeader>

        {/* ── Thread list ───────────────────────────────────────────────── */}
        <SidebarContent className="overflow-hidden">
          <ScrollArea className="h-full">
            <div className="p-2 space-y-0.5">
              {filteredThreads.length === 0 ? (
                <div className="text-center py-10 text-xs text-muted-foreground/70">
                  {searchQuery
                    ? "No matching conversations"
                    : "No past conversations"}
                </div>
              ) : (
                filteredThreads.map((t) => {
                  const storageKey = `chat_thread_id_${activeOrgId || "personal"}_${activeSpaceId || "default"}`;
                  const isActive = localStorage.getItem(storageKey) === t.id;
                  const isEditing = editingThreadId === t.id;

                  return (
                    <div
                      key={t.id}
                      onClick={() => !isEditing && handleSelectThread(t.id)}
                      className={cn(
                        "flex flex-col gap-0.5 px-3 py-2.5 rounded-xl cursor-pointer group border border-transparent transition-all",
                        isActive
                          ? "bg-primary/5 border-primary/10 text-primary"
                          : "hover:bg-sidebar-accent text-sidebar-foreground"
                      )}
                    >
                      {isEditing ? (
                        <div
                          className="flex items-center gap-1.5 py-0.5"
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
                            className="flex-1 bg-background border border-border/80 rounded px-1.5 py-0.5 text-xs text-foreground focus:outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/10"
                          />
                          <button
                            onClick={() => handleSaveRename(t.id)}
                            className="size-6 rounded-md hover:bg-muted flex items-center justify-center text-primary"
                          >
                            <Check className="size-3.5" />
                          </button>
                          <button
                            onClick={() => setEditingThreadId(null)}
                            className="size-6 rounded-md hover:bg-muted flex items-center justify-center text-muted-foreground"
                          >
                            <X className="size-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <span className="text-[13px] font-medium block truncate">
                              {t.title || "Untitled conversation"}
                            </span>
                            <span className="text-[10px] text-muted-foreground/80 flex items-center gap-1 mt-0.5">
                              <Calendar className="size-3 text-muted-foreground/60" />
                              {new Date(t.createdAt).toLocaleDateString()}
                            </span>
                          </div>

                          {/* Inline controls */}
                          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={(e) =>
                                handleStartRename(t.id, t.title, e)
                              }
                              className="size-6 rounded-md hover:bg-muted/80 flex items-center justify-center text-muted-foreground hover:text-foreground"
                              title="Rename"
                            >
                              <Pen className="size-3" />
                            </button>
                            <button
                              onClick={(e) => handleDeleteThread(t.id, e)}
                              className="size-6 rounded-md hover:bg-muted/80 flex items-center justify-center text-muted-foreground hover:text-destructive"
                              title="Delete"
                            >
                              <Trash2 className="size-3" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </ScrollArea>
        </SidebarContent>

        {/* ── Footer ────────────────────────────────────────────────────── */}
        <SidebarFooter className="border-t border-border/60 p-3">
          <Button
            variant="outline"
            size="sm"
            className="w-full text-xs hover:bg-muted bg-transparent border-border/80 text-foreground flex items-center justify-center gap-1.5"
            onClick={handleNewChat}
          >
            <SquarePen className="size-3.5" />
            New conversation
          </Button>
        </SidebarFooter>
      </Sidebar>
    </SidebarProvider>
  );
}
