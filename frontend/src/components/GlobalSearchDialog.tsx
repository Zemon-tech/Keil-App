/**
 * GlobalSearchDialog — Cmd+K command palette with real global search.
 *
 * Fixed dimensions: 560px wide, 480px tall with internal scroll on results.
 * Uses only app theme CSS variables — no hardcoded colour classes.
 *
 * Searches:
 *   - Navigation commands (instant, always shown when query is empty)
 *   - Tasks & Events (client-side filter on title/description/status)
 *   - Motion pages  (client-side filter on title from Zustand store)
 *   - Meetings      (debounced API search, fires when query ≥ 2 chars)
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  CheckSquare,
  FileText,
  Mic,
  Settings,
  MessageSquare,
  ArrowRight,
  Search,
  Loader2,
  CalendarDays,
  Hash,
  ChevronRight,
} from "lucide-react";
import { useAppContext } from "@/contexts/AppContext";
import { useOrgTasks } from "@/hooks/api/useTasks";
import { useMotionPages } from "@/hooks/api/useMotionPages";
import { useMeetingSearch } from "@/hooks/api/useMeetings";
import { useChatStore } from "@/store/useChatStore";
import { useSettingsStore } from "@/store/useSettingsStore";
import { useMeetingStore } from "@/store/useMeetingStore";

// ─── Types ────────────────────────────────────────────────────────────────────

type ResultKind = "nav" | "task" | "event" | "page" | "meeting";

interface SearchResult {
  id: string;
  kind: ResultKind;
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  action: () => void;
}

// ─── Debounce hook ────────────────────────────────────────────────────────────

function useDebounced<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

// ─── Kind config — uses only app theme tokens ─────────────────────────────────
// Each kind gets a label used in the badge, no coloured backgrounds.

const kindLabel: Record<ResultKind, string> = {
  nav: "Action",
  task: "Task",
  event: "Event",
  page: "Page",
  meeting: "Meeting",
};

// ─── Result row ───────────────────────────────────────────────────────────────

interface ResultRowProps {
  result: SearchResult;
  isActive: boolean;
  onSelect: () => void;
  onHover: () => void;
}

function ResultRow({ result, isActive, onSelect, onHover }: ResultRowProps) {
  return (
    <button
      id={`gs-result-${result.id}`}
      role="option"
      aria-selected={isActive}
      className={cn(
        "w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-left transition-colors",
        isActive
          ? "bg-accent text-accent-foreground"
          : "hover:bg-accent/60 text-foreground"
      )}
      onMouseMove={onHover}
      onClick={onSelect}
    >
      {/* Icon */}
      <span className={cn(
        "shrink-0 size-6 rounded flex items-center justify-center",
        "bg-muted text-muted-foreground"
      )}>
        {result.icon}
      </span>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-medium truncate leading-snug">{result.title}</p>
        {result.subtitle && (
          <p className="text-[11px] text-muted-foreground truncate leading-snug mt-0.5">
            {result.subtitle}
          </p>
        )}
      </div>

      {/* Kind badge */}
      <span className="shrink-0 text-[10px] font-medium text-muted-foreground/60 tabular-nums hidden sm:block">
        {kindLabel[result.kind]}
      </span>

      {isActive && (
        <ChevronRight className="shrink-0 size-3 text-muted-foreground" />
      )}
    </button>
  );
}

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHeader({ label }: { label: string }) {
  return (
    <p className="px-2.5 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 first:pt-1">
      {label}
    </p>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface GlobalSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GlobalSearchDialog({ open, onOpenChange }: GlobalSearchDialogProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // ── Hooks (all unconditional) ─────────────────────────────────────────────
  const { activeOrgId, activeSpaceId } = useAppContext();
  const { data: pages = [] } = useMotionPages(activeOrgId, activeSpaceId);
  const { data: allTasks = [] } = useOrgTasks(activeOrgId, activeSpaceId, {});
  const { openChat, openChatDialog } = useChatStore();
  const { openSettings } = useSettingsStore();
  const { openDialog: openMeeting, isMinimized, restoreDialog } = useMeetingStore();

  const debouncedQuery = useDebounced(query, 300);
  const meetingEnabled = debouncedQuery.trim().length >= 2;
  const { data: meetingResults = [], isFetching: meetingsFetching } =
    useMeetingSearch(meetingEnabled ? debouncedQuery.trim() : "");

  // ── Close helper ──────────────────────────────────────────────────────────
  const onClose = useCallback(() => {
    onOpenChange(false);
    setQuery("");
    setActiveIndex(0);
  }, [onOpenChange]);

  // Focus + reset on open
  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIndex(0);
      const id = setTimeout(() => inputRef.current?.focus(), 30);
      return () => clearTimeout(id);
    }
  }, [open]);

  // ── Navigation results ────────────────────────────────────────────────────
  const navResults = useMemo<SearchResult[]>(() => {
    const items: SearchResult[] = [
      {
        id: "nav-dashboard",
        kind: "nav",
        title: "Go to Dashboard",
        subtitle: "⌘G",
        icon: <LayoutDashboard className="size-3.5" />,
        action: () => { navigate("/"); onClose(); },
      },
      {
        id: "nav-tasks",
        kind: "nav",
        title: "Go to Tasks",
        subtitle: "⌘T",
        icon: <CheckSquare className="size-3.5" />,
        action: () => { navigate("/tasks"); onClose(); },
      },
      {
        id: "nav-motion",
        kind: "nav",
        title: "Go to Pages",
        subtitle: "⌘P",
        icon: <FileText className="size-3.5" />,
        action: () => { navigate("/motion"); onClose(); },
      },
      {
        id: "nav-meetings",
        kind: "nav",
        title: "Open Meeting Studio",
        subtitle: "⌘M",
        icon: <Mic className="size-3.5" />,
        action: () => {
          if (isMinimized) restoreDialog(); else openMeeting();
          onClose();
        },
      },
      {
        id: "nav-chat",
        kind: "nav",
        title: "Open Chat",
        subtitle: "⌘J",
        icon: <MessageSquare className="size-3.5" />,
        action: () => {
          const v = localStorage.getItem("default_chat_view") || "sidebar";
          if (v === "dialog") openChatDialog(); else openChat();
          onClose();
        },
      },
      {
        id: "nav-settings",
        kind: "nav",
        title: "Open Settings",
        subtitle: "⌘,",
        icon: <Settings className="size-3.5" />,
        action: () => { openSettings("account"); onClose(); },
      },
    ];

    if (!query.trim()) return items;
    const q = query.toLowerCase();
    return items.filter(
      (i) => i.title.toLowerCase().includes(q) || (i.subtitle ?? "").includes(q)
    );
  }, [query, navigate, onClose, isMinimized, restoreDialog, openMeeting, openChat, openChatDialog, openSettings]);

  // ── Task / event results ──────────────────────────────────────────────────
  const { taskResults, eventResults } = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return { taskResults: [], eventResults: [] };
    const taskR: SearchResult[] = [];
    const eventR: SearchResult[] = [];
    allTasks.forEach((t) => {
      if (
        !t.title.toLowerCase().includes(q) &&
        !(t.description ?? "").toLowerCase().includes(q) &&
        !(t.status ?? "").toLowerCase().includes(q)
      ) return;
      const isEvent = t.type === "event";
      const item: SearchResult = {
        id: `task-${t.id}`,
        kind: isEvent ? "event" : "task",
        title: t.title,
        subtitle: `${t.status ?? ""}${t.due_date ? ` · Due ${new Date(t.due_date).toLocaleDateString()}` : ""}`,
        icon: isEvent ? <CalendarDays className="size-3.5" /> : <CheckSquare className="size-3.5" />,
        action: () => { navigate(isEvent ? `/events/${t.id}` : `/tasks/${t.id}`); onClose(); },
      };
      if (isEvent) eventR.push(item); else taskR.push(item);
    });
    return { taskResults: taskR.slice(0, 6), eventResults: eventR.slice(0, 4) };
  }, [query, allTasks, navigate, onClose]);

  // ── Page results ──────────────────────────────────────────────────────────
  const pageResults = useMemo<SearchResult[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return pages
      .filter((p) => !p.deleted_at && p.title.toLowerCase().includes(q))
      .slice(0, 8)
      .map((p) => ({
        id: `page-${p.id}`,
        kind: "page" as ResultKind,
        title: p.title || "Untitled",
        subtitle: "Motion Page",
        icon: <Hash className="size-3.5" />,
        action: () => { navigate(`/motion/${p.id}`); onClose(); },
      }));
  }, [query, pages, navigate, onClose]);

  // ── Meeting results ───────────────────────────────────────────────────────
  const meetingSearchResults = useMemo<SearchResult[]>(() => {
    return meetingResults.slice(0, 5).map((m) => ({
      id: `meeting-${m.id}`,
      kind: "meeting" as ResultKind,
      title: `Meeting · ${new Date(m.created_at).toLocaleDateString()}`,
      subtitle: m.transcript_text ? m.transcript_text.slice(0, 70) + "…" : "No transcript",
      icon: <Mic className="size-3.5" />,
      action: () => { useMeetingStore.getState().openDialog(m.id); onClose(); },
    }));
  }, [meetingResults, onClose]);

  // ── Grouped list ──────────────────────────────────────────────────────────
  const grouped = useMemo<{ label: string; items: SearchResult[] }[]>(() => {
    const g: { label: string; items: SearchResult[] }[] = [];
    if (navResults.length > 0) g.push({ label: query.trim() ? "Commands" : "Quick Actions", items: navResults });
    if (taskResults.length > 0) g.push({ label: "Tasks", items: taskResults });
    if (eventResults.length > 0) g.push({ label: "Events", items: eventResults });
    if (pageResults.length > 0) g.push({ label: "Pages", items: pageResults });
    if (meetingSearchResults.length > 0) g.push({ label: "Meetings", items: meetingSearchResults });
    return g;
  }, [navResults, taskResults, eventResults, pageResults, meetingSearchResults, query]);

  const flatResults = useMemo(() => grouped.flatMap((g) => g.items), [grouped]);

  // Keep index in bounds
  useEffect(() => {
    setActiveIndex((p) => Math.min(p, Math.max(0, flatResults.length - 1)));
  }, [flatResults.length]);

  // Scroll active item into view
  useEffect(() => {
    document.getElementById(`gs-result-${flatResults[activeIndex]?.id}`)
      ?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, flatResults]);

  // ── Keyboard navigation ───────────────────────────────────────────────────
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const n = flatResults.length;
      if (e.key === "ArrowDown") { e.preventDefault(); setActiveIndex((i) => (i + 1) % Math.max(1, n)); }
      else if (e.key === "ArrowUp") { e.preventDefault(); setActiveIndex((i) => (i - 1 + Math.max(1, n)) % Math.max(1, n)); }
      else if (e.key === "Enter") { e.preventDefault(); flatResults[activeIndex]?.action(); }
      else if (e.key === "Escape") { onClose(); }
    },
    [flatResults, activeIndex, onClose]
  );

  const isEmpty = !meetingsFetching && flatResults.length === 0 && query.trim().length > 0;
  const isLoading = meetingsFetching && debouncedQuery.trim().length >= 2;

  // Flat index counter reset per render
  let flatIdx = 0;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent
        className="p-0 gap-0 overflow-hidden border border-border bg-popover shadow-lg"
        style={{ width: 560, maxWidth: "calc(100vw - 32px)", height: 380 }}
        onKeyDown={handleKeyDown}
        showCloseButton={false}
      >
        <VisuallyHidden>
          <DialogTitle>Global Search</DialogTitle>
        </VisuallyHidden>

        {/* ── Input ──────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-2.5 px-3.5 h-11 border-b border-border shrink-0">
          <Search className="shrink-0 size-4 text-muted-foreground" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setActiveIndex(0); }}
            placeholder="Search tasks, pages, meetings, commands…"
            className="flex-1 bg-transparent text-sm placeholder:text-muted-foreground/50 outline-none border-none"
            role="combobox"
            aria-expanded={flatResults.length > 0}
            aria-controls="gs-listbox"
            aria-activedescendant={flatResults[activeIndex] ? `gs-result-${flatResults[activeIndex].id}` : undefined}
            autoComplete="off"
            spellCheck={false}
          />
          {isLoading
            ? <Loader2 className="shrink-0 size-3.5 text-muted-foreground animate-spin" />
            : <kbd className="shrink-0 rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">ESC</kbd>
          }
        </div>

        {/* ── Results ────────────────────────────────────────────────────── */}
        <div
          id="gs-listbox"
          role="listbox"
          className="flex-1 overflow-y-auto overscroll-contain px-2 pb-2"
          style={{ height: "calc(480px - 44px - 36px)" }}
        >
          {isEmpty ? (
            <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground">
              <Search className="size-7 opacity-20" />
              <p className="text-sm">No results for &ldquo;{query}&rdquo;</p>
            </div>
          ) : (
            grouped.map((group) => (
              <div key={group.label}>
                <SectionHeader label={group.label} />
                {group.items.map((result) => {
                  const idx = flatIdx++;
                  return (
                    <ResultRow
                      key={result.id}
                      result={result}
                      isActive={activeIndex === idx}
                      onSelect={result.action}
                      onHover={() => setActiveIndex(idx)}
                    />
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* ── Footer ─────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-3.5 h-9 border-t border-border bg-muted/30 shrink-0">
          <div className="flex items-center gap-2.5">
            {(["↑", "↓"] as const).map((k) => (
              <span key={k} className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <kbd className="rounded border border-border bg-muted px-1 py-0.5 text-[10px]">{k}</kbd>
              </span>
            ))}
            <span className="text-[11px] text-muted-foreground">Navigate</span>
            <span className="text-[11px] text-muted-foreground flex items-center gap-1">
              <kbd className="rounded border border-border bg-muted px-1 py-0.5 text-[10px]">↵</kbd>
              Open
            </span>
          </div>
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground/60">
            <ArrowRight className="size-3" />
            {flatResults.length > 0
              ? `${flatResults.length} result${flatResults.length !== 1 ? "s" : ""}`
              : query ? "No results" : "Type to search"}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
