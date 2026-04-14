import { useEffect, useRef, useState } from "react";
import { Draggable } from "@fullcalendar/interaction";
import { Search, Plus, GripVertical, Flag, Zap, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { Task, TaskStatus } from "@/types/task";
import { type TaskDTO, type SortBy, type SortOrder } from "@/hooks/api/useTasks";
import { CreateTaskDialog } from "./CreateTaskDialog";

type Props = {
  query: string;
  onQueryChange: (value: string) => void;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  /** Sort state — controlled by parent */
  sortBy: SortBy;
  sortOrder: SortOrder;
  onSortChange: (by: SortBy, order: SortOrder) => void;
  tasks: TaskDTO[];
  /** All tasks (unfiltered) — used for the parent task dropdown */
  allTasks?: TaskDTO[];
  selectedTaskId: string;
  onSelectTask: (id: string) => void;
  createDialogOpen: boolean;
  onCreateDialogOpenChange: (open: boolean) => void;
  /** Called with the new task's id after a successful create */
  onTaskCreated: (newTaskId: string) => void;
  onUpdateTask?: (id: string, updates: Partial<Task>) => void;
  isLoading?: boolean;
  /** Pagination props */
  hasMore?: boolean;
  onLoadMore?: () => void;
  isLoadingMore?: boolean;
};

const STATUS_OPTIONS: TaskStatus[] = ["backlog", "todo", "in-progress", "done"];

const statusColorMap: Record<TaskStatus, string> = {
  "in-progress": "bg-blue-500",
  done: "bg-green-500",
  backlog: "bg-zinc-500",
  todo: "bg-violet-500",
};

const FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: "All", label: "All" },
  { value: "Mine", label: "Mine" },
  { value: "backlog", label: "Backlog" },
  { value: "todo", label: "To Do" },
  { value: "in-progress", label: "Active" },
  { value: "done", label: "Done" },
  { value: "Blocked", label: "Blocked" },
  { value: "High Priority", label: "High Priority" },
];

const SORT_OPTIONS: { value: SortBy; label: string }[] = [
  { value: "created_at", label: "Created" },
  { value: "due_date", label: "Due Date" },
  { value: "priority", label: "Priority" },
];

export function TaskListPane({
  query,
  onQueryChange,
  statusFilter,
  onStatusFilterChange,
  sortBy,
  sortOrder,
  onSortChange,
  tasks,
  allTasks,
  selectedTaskId,
  onSelectTask,
  createDialogOpen,
  onCreateDialogOpenChange,
  onTaskCreated,
  onUpdateTask,
  isLoading = false,
  hasMore = false,
  onLoadMore,
  isLoadingMore = false,
}: Props) {
  const draggableRef = useRef<Draggable | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(!!query);
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());

  // Keyboard shortcut: press C to open create dialog
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        (e.target as HTMLElement).isContentEditable
      )
        return;
      if (e.key === "c" || e.key === "C") {
        e.preventDefault();
        onCreateDialogOpenChange(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onCreateDialogOpenChange]);

  // No grouping needed — tasks are flat from the API
  const taskList = tasks;

  // Initialize FullCalendar Draggable for task cards
  useEffect(() => {
    if (!containerRef.current) return;

    draggableRef.current = new Draggable(containerRef.current, {
      itemSelector: ".draggable-task-card",
      eventData: (eventEl) => {
        const taskId = eventEl.getAttribute("data-task-id");
        const taskTitle = eventEl.getAttribute("data-task-title");
        const taskStatus = eventEl.getAttribute("data-task-status");

        console.log("🎯 Dragging task:", { taskId, taskTitle, taskStatus });

        return {
          id: taskId,
          title: taskTitle,
          duration: "01:00", // 1 hour default duration
          extendedProps: {
            taskId,
            taskTitle,
            taskStatus,
            isDraggedTask: true,
          },
        };
      },
    });

    return () => {
      draggableRef.current?.destroy();
    };
  }, [tasks]);

  const isMultiSelecting = selectedTaskIds.size > 0;

  const toggleSelection = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const next = new Set(selectedTaskIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedTaskIds(next);
  };

  const handleBulkStatusChange = (status: TaskStatus) => {
    if (onUpdateTask) {
      selectedTaskIds.forEach((id) => onUpdateTask(id, { status }));
    }
    setSelectedTaskIds(new Set());
  };



  return (
    <div className="h-full min-h-0 flex flex-col w-full relative overflow-hidden">
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="px-3 pt-3 pb-2 border-b border-border/60 shrink-0">
        {/* Title row */}
        <div className="flex items-center justify-between gap-2 min-h-[28px]">
          {isSearchOpen ? (
            <div className="relative flex-1 animate-in fade-in slide-in-from-right-2 duration-200">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <Input
                autoFocus
                value={query}
                onChange={(e) => onQueryChange(e.target.value)}
                placeholder="Search tasks, projects…"
                className="pl-8 pr-8 h-8 text-xs rounded-md w-full"
                onBlur={(e) => {
                  if (!e.target.value) setIsSearchOpen(false);
                }}
              />
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 p-0 hover:bg-transparent"
                onClick={() => {
                  onQueryChange("");
                  setIsSearchOpen(false);
                }}
              >
                <X className="h-3.5 w-3.5 text-muted-foreground" />
              </Button>
            </div>
          ) : (
            <>
              <div className="min-w-0">
                <div className="text-sm font-semibold leading-tight truncate">
                  Pick a task to focus
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0 shrink-0 rounded-md"
                  onClick={() => setIsSearchOpen(true)}
                >
                  <Search className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0 shrink-0 rounded-md"
                  onClick={() => onCreateDialogOpenChange(true)}
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
            </>
          )}
        </div>

        {/* Filters & Sort row */}
        <div className="flex items-center gap-1.5 mt-2.5 pb-0.5">
          {/* Status Filter Dropdown */}
          <Select
            value={statusFilter}
            onValueChange={onStatusFilterChange}
          >
            <SelectTrigger className="h-7 text-[11px] flex-1 overflow-hidden min-w-0 rounded-md border-border/60 bg-muted/20 px-2.5 hover:bg-muted/50 transition-colors [&>span]:truncate">
              <SelectValue placeholder="Filter" />
            </SelectTrigger>
            <SelectContent>
              {FILTER_OPTIONS.map(({ value, label }) => (
                <SelectItem key={value} value={value} className="text-xs">
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Sort By Dropdown */}
          <Select
            value={sortBy}
            onValueChange={(v) => onSortChange(v as SortBy, sortOrder)}
          >
            <SelectTrigger className="h-7 text-[11px] flex-1 overflow-hidden min-w-0 rounded-md border-border/60 bg-muted/20 px-2.5 hover:bg-muted/50 transition-colors [&>span]:truncate">
              <SelectValue placeholder="Sort" />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map(({ value, label }) => (
                <SelectItem key={value} value={value} className="text-xs">
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Sort Order Dropdown */}
          <Select
            value={sortOrder}
            onValueChange={(v) => onSortChange(sortBy, v as SortOrder)}
          >
            <SelectTrigger className="h-7 w-[72px] shrink-0 text-[11px] rounded-md border-border/60 bg-muted/20 px-2.5 hover:bg-muted/50 transition-colors">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="desc" className="text-xs">Desc</SelectItem>
              <SelectItem value="asc" className="text-xs">Asc</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* ── Task list ──────────────────────────────────────────── */}
      <ScrollArea className="flex-1 min-h-0">
        <div ref={containerRef} className="px-2 py-2 space-y-px pb-20">

          {/* Loading skeleton */}
          {isLoading && (
            <div className="space-y-px px-2 py-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-md animate-pulse"
                >
                  <div className="w-2 h-2 rounded-full bg-muted-foreground/20 shrink-0" />
                  <div
                    className="h-3 rounded bg-muted-foreground/15 flex-1"
                    style={{ width: `${50 + (i % 3) * 20}%` }}
                  />
                  <div className="h-3 w-10 rounded bg-muted-foreground/10 shrink-0" />
                </div>
              ))}
            </div>
          )}

          {/* Task rows */}
          {!isLoading && taskList.map((t) => {
            const active = t.id === selectedTaskId;
            const isChecked = selectedTaskIds.has(t.id);
            const isDone = t.status === "done";
            const isHighPriority =
              t.priority === "high" || t.priority === "urgent";
            const isDraggable = t.status !== "done";
            // Use backend date field, falling back to dueDateISO for compat
            const displayDate = t.due_date || t.dueDateISO;
            const isBlocked = ((t as any).blocked_by_count || (t.dependencies?.length || 0)) > 0;

            return (
              <div
                key={t.id}
                onClick={() => !isMultiSelecting && onSelectTask(t.id)}
                data-task-id={t.id}
                data-task-title={t.title}
                data-task-status={t.status}
                className={cn(
                  "flex items-center gap-2 px-2 py-1.5 rounded-md transition-colors cursor-pointer group w-full min-w-0",
                  active && !isMultiSelecting
                    ? "bg-accent"
                    : "hover:bg-accent/50",
                  isDone && "opacity-50",
                  isDraggable && "draggable-task-card cursor-grab active:cursor-grabbing"
                )}
              >
                {/* Selection & Drag actions */}
                <div
                  className={cn(
                    "flex items-center overflow-hidden transition-all duration-200 shrink-0",
                    !isChecked && !isMultiSelecting
                      ? "w-0 opacity-0 group-hover:w-[36px] group-hover:opacity-100"
                      : "w-[36px] opacity-100"
                  )}
                >
                  {/* Drag handle */}
                  {isDraggable ? (
                    <div className="shrink-0 opacity-40 hover:opacity-100 mr-2">
                      <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                  ) : (
                    <div className="w-[22px] shrink-0" />
                  )}

                  {/* Multi-select checkbox */}
                  <div
                    className="shrink-0"
                    onClick={(e) => toggleSelection(e, t.id)}
                  >
                    <Checkbox checked={isChecked} className="w-3.5 h-3.5" />
                  </div>
                </div>

                {/* Status dot — click opens popover */}
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      onClick={(e) => e.stopPropagation()}
                      className={cn(
                        "w-2 h-2 rounded-full shrink-0 transition-transform hover:scale-125",
                        statusColorMap[t.status]
                      )}
                    />
                  </PopoverTrigger>
                  <PopoverContent
                    align="start"
                    className="w-36 p-1 rounded-lg shadow-lg"
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <button
                        key={s}
                        onClick={(e) => {
                          e.stopPropagation();
                          onUpdateTask?.(t.id, { status: s });
                        }}
                        className="w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded-md hover:bg-accent/60 transition-colors"
                      >
                        <div
                          className={cn(
                            "w-2 h-2 rounded-full shrink-0",
                            statusColorMap[s]
                          )}
                        />
                        {s}
                      </button>
                    ))}
                  </PopoverContent>
                </Popover>

                {/* Title */}
                <span className="text-sm font-medium truncate flex-1 leading-snug min-w-0">
                  {t.title}
                </span>

                {/* Right meta */}
                <div className="flex items-center gap-1.5 shrink-0 text-[11px] text-muted-foreground">
                  {isBlocked && (
                    <Zap className="w-3 h-3 text-yellow-400 shrink-0" />
                  )}
                  {isHighPriority && (
                    <Flag className="w-3 h-3 text-orange-400 shrink-0" />
                  )}
                  <span className="tabular-nums">
                    {displayDate
                      ? new Date(displayDate).toLocaleDateString(
                        undefined,
                        { month: "short", day: "numeric" }
                      )
                      : "—"}
                  </span>
                </div>
              </div>
            );
          })}

          {/* Empty state */}
          {!isLoading && taskList.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center gap-2">
              <p className="text-sm text-muted-foreground">No tasks yet</p>
              <p className="text-xs text-muted-foreground/60">
                Press{" "}
                <kbd className="px-1.5 py-0.5 text-[10px] rounded border border-border bg-muted font-mono">
                  C
                </kbd>{" "}
                to create one
              </p>
            </div>
          )}

          {/* Load more button */}
          {!isLoading && hasMore && taskList.length > 0 && (
            <div className="flex justify-center py-3">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-muted-foreground hover:text-foreground"
                onClick={onLoadMore}
                disabled={isLoadingMore}
              >
                {isLoadingMore ? "Loading…" : "Load more tasks"}
              </Button>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* ── Floating bulk-action bar ───────────────────────────── */}
      {isMultiSelecting && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-popover border border-border shadow-lg px-3 py-2 rounded-full flex items-center gap-2.5 animate-in fade-in slide-in-from-bottom-3 z-10 whitespace-nowrap">
          <span className="text-xs font-medium">
            {selectedTaskIds.size} selected
          </span>

          <Select
            onValueChange={(v) => handleBulkStatusChange(v as TaskStatus)}
          >
            <SelectTrigger className="h-7 text-xs rounded-full border-border bg-background w-auto min-w-[110px]">
              <SelectValue placeholder="Change status" />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            size="sm"
            variant="ghost"
            className="h-7 rounded-full text-xs px-2"
            onClick={() => setSelectedTaskIds(new Set())}
          >
            Clear
          </Button>
        </div>
      )}

      {/* ── Create task dialog ────────────────────────────────── */}
      <CreateTaskDialog 
        open={createDialogOpen} 
        onOpenChange={onCreateDialogOpenChange} 
        onTaskCreated={onTaskCreated} 
        allTasks={allTasks ?? tasks}
      />
    </div>
  );
}