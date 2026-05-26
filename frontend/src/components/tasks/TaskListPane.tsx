import { useEffect, useMemo, useRef, useState } from "react";
import { format, isSameDay, isSameMonth, isSameYear } from "date-fns";
import { Draggable } from "@fullcalendar/interaction";
import {
  Search, Plus, GripVertical, Flag, Zap, X, Trash2, Calendar, User,
  AlertCircle, ChevronDown, ChevronRight, MoreHorizontal, Pencil,
  SlidersHorizontal, CalendarClock, UserCheck,
  CalendarRange, ShieldAlert, Check, CheckSquare,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
  PopoverClose,
} from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Task, AnyStatus, TaskPriority } from "@/types/task";
import { type TaskDTO, type SortBy, type SortOrder, useOrgSubtasks } from "@/hooks/api/useTasks";
import { useAppContext } from "@/contexts/AppContext";
import { CreateTaskDialog } from "./CreateTaskDialog";
import { STATUS_OPTIONS as TASK_STATUS_OPTIONS, EVENT_STATUS_OPTIONS, STATUS_COLOR } from "./task-detail-shared";
import { useSpaceRole } from "@/hooks/useSpaceRole";
import { useSpaces } from "@/hooks/api/useSpaces";

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
  onTaskCreated: (newTaskId: string, taskType: "task" | "event") => void;
  onUpdateTask?: (id: string, updates: Partial<Task>) => void;
  onDeleteTask?: (id: string) => void;
  onAssignUser?: (taskId: string, userId: string) => void;
  onRemoveAssignee?: (taskId: string, userId: string) => void;
  isLoading?: boolean;
  /** Pagination props */
  hasMore?: boolean;
  onLoadMore?: () => void;
  isLoadingMore?: boolean;
  /** Workspace members for bulk assign */
  workspaceMembers?: Array<{ id: string; name: string | null; email: string }>;
  orgFilter?: string;
  onOrgFilterChange?: (value: string) => void;
  spaceFilter?: string;
  onSpaceFilterChange?: (value: string) => void;
};

function formatTaskDateRange(start?: string, end?: string) {
  if (!end) return start ? format(new Date(start), "MMM d") : "\u2014";
  if (!start) return format(new Date(end), "MMM d");

  const startDate = new Date(start);
  const endDate = new Date(end);
  
  if (isSameDay(startDate, endDate)) {
    return format(startDate, "MMM d");
  }

  if (isSameMonth(startDate, endDate) && isSameYear(startDate, endDate)) {
    return `${format(startDate, "MMM d")}–${format(endDate, "d")}`;
  }

  return `${format(startDate, "MMM d")} – ${format(endDate, "MMM d")}`;
}

function getStatusTextColor(status: AnyStatus): string {
  switch (status) {
    case "done":
    case "completed":
      return "text-green-500 dark:text-[#86EFAC]";
    case "in-progress":
    case "confirmed":
      return "text-blue-500";
    case "in-review":
    case "todo":
      return "text-violet-500";
    case "backlog":
    case "cancelled":
      return "text-red-500";
    case "tentative":
      return "text-yellow-500";
    default:
      return "text-zinc-500";
  }
}

// Using STATUS_COLOR from task-detail-shared

// ── Filter state types ────────────────────────────────────────────────────────

type TypeFilter = "all" | "tasks" | "events" | "blocked";
type PriorityFilter = "all" | "urgent" | "high" | "medium" | "low";
type SortPreset = "due-soon" | "due-latest" | "highest-priority" | "recently-created" | "oldest-created";
type QuickPreset = "focus" | "urgent" | "meetings" | "assigned-to-me" | "upcoming" | "blocked";

// Maps a SortPreset to the SortBy + SortOrder the parent expects
const SORT_PRESET_MAP: Record<SortPreset, { by: SortBy; order: SortOrder }> = {
  "due-soon":          { by: "due_date",   order: "asc"  },
  "due-latest":        { by: "due_date",   order: "desc" },
  "highest-priority":  { by: "priority",   order: "desc" },
  "recently-created":  { by: "created_at", order: "desc" },
  "oldest-created":    { by: "created_at", order: "asc"  },
};

const SORT_PRESET_LABELS: Record<SortPreset, string> = {
  "due-soon":         "Due Soon",
  "due-latest":       "Due Latest",
  "highest-priority": "Highest Priority",
  "recently-created": "Recently Created",
  "oldest-created":   "Oldest Created",
};

/** Inline component to fetch & render subtasks when expanded */
function SubtaskList({
  parentTaskId,
  selectedTaskId,
  onSelectTask,
  onUpdateTask,
}: {
  parentTaskId: string;
  selectedTaskId: string;
  onSelectTask: (id: string) => void;
  onUpdateTask?: (id: string, updates: Partial<Task>) => void;
}) {
  const { activeOrgId, activeSpaceId } = useAppContext();
  const { data: subtasks = [], isLoading } = useOrgSubtasks(activeOrgId, activeSpaceId, parentTaskId);

  if (isLoading) {
    return (
      <div className="pl-6 space-y-px">
        {[1, 2].map((i) => (
          <div key={i} className="flex items-center gap-2 px-2 py-1 animate-pulse">
            <div className="size-1.5 rounded-full bg-muted-foreground/20" />
            <div className="h-2.5 rounded bg-muted-foreground/12 flex-1" />
          </div>
        ))}
      </div>
    );
  }

  if (subtasks.length === 0) {
    return (
      <div className="pl-4 border-l border-border/40 ml-5 py-2">
        <span className="text-[11px] text-muted-foreground/60 italic">No subtasks</span>
      </div>
    );
  }

  return (
    <div className="pl-4 border-l border-border/40 ml-5 space-y-px">
      {subtasks.map((sub) => {
        const active = sub.id === selectedTaskId;
        const isDone = sub.status === "done";
        const isHighPriority = sub.priority === "high" || sub.priority === "urgent";

        return (
          <div
            key={sub.id}
            onClick={() => onSelectTask(sub.id)}
            className={cn(
              "flex items-center justify-between gap-2 px-2 py-1.5 rounded-md transition-colors cursor-pointer group w-full min-w-0",
              active ? "bg-[#EEF2FF] dark:bg-[#1E1B4B]" : "hover:bg-[#F4F4F5] dark:hover:bg-[#18181B]",
              isDone && "opacity-50"
            )}
          >
            <div className="flex items-center gap-2 flex-1 min-w-0">
              {/* Status icon */}
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    onClick={(e) => e.stopPropagation()}
                    className="shrink-0 transition-transform hover:scale-110 flex items-center justify-center"
                  >
                    {(sub as any).type === "event" ? (
                      <Calendar className={cn("size-3.5 shrink-0", getStatusTextColor(sub.status as AnyStatus))} />
                    ) : (
                      <CheckSquare className={cn("size-3.5 shrink-0", getStatusTextColor(sub.status as AnyStatus))} />
                    )}
                  </button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-36 p-1 rounded-lg shadow-lg">
                  {((sub as any).type === "event" ? EVENT_STATUS_OPTIONS : TASK_STATUS_OPTIONS).map((s) => (
                    <PopoverClose asChild key={s}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onUpdateTask?.(sub.id, { status: s });
                        }}
                        className="w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded-md hover:bg-accent/60 transition-colors capitalize"
                      >
                        {(sub as any).type === "event" ? (
                          <Calendar className={cn("size-3 shrink-0", getStatusTextColor(s))} />
                        ) : (
                          <CheckSquare className={cn("size-3 shrink-0", getStatusTextColor(s))} />
                        )}
                        {s}
                      </button>
                    </PopoverClose>
                  ))}
                </PopoverContent>
              </Popover>

              <div className="task-name-container">
                <span className={cn(
                  "task-name-scroll text-[13px] font-medium leading-snug",
                  isDone && "line-through opacity-60"
                )} title={sub.title}>
                  {sub.title}
                </span>
              </div>
            </div>

            {/* Right block: Badge and Date */}
            <div className="flex items-center gap-1.5 shrink-0 text-[10px] text-muted-foreground ml-auto">
              {(sub as any).type === "event" && (
                <span className="text-[9px] bg-[#EEF2FF] text-[#3730A3] dark:bg-[#1E1B4B] dark:text-[#C7D2FE] font-medium leading-none px-1 py-0.5 rounded uppercase tracking-wider whitespace-nowrap">
                  event
                </span>
              )}
              {isHighPriority && <Flag className="size-2.5 text-orange-400 shrink-0" />}
              <span className="tabular-nums text-right leading-tight">
                {formatTaskDateRange(sub.start_date ?? undefined, sub.due_date ?? undefined)}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

type SpaceRole = "admin" | "manager" | "member";
const SPACE_RANK: Record<SpaceRole, number> = { admin: 3, manager: 2, member: 1 };

function getTaskPermissions(
  task: { org_id?: string; space_id?: string; user_space_role?: string },
  activeOrgId: string | null,
  activeSpaceId: string | null,
  activeSpaceRole: string | null
) {
  const spaceRole = (
    task.org_id === activeOrgId && task.space_id === activeSpaceId
      ? (activeSpaceRole ?? "member")
      : (task.user_space_role ?? "member")
  ) as SpaceRole;

  const spaceRank = SPACE_RANK[spaceRole] ?? 1;

  return {
    canEditTask: spaceRank >= SPACE_RANK.manager,
    canDeleteTask: spaceRank >= SPACE_RANK.manager,
  };
}

export function TaskListPane({
  query,
  onQueryChange,
  onStatusFilterChange,
  onSortChange,
  tasks,
  allTasks,
  selectedTaskId,
  onSelectTask,
  createDialogOpen,
  onCreateDialogOpenChange,
  onTaskCreated,
  onUpdateTask,
  onDeleteTask,
  onAssignUser,
  onRemoveAssignee,
  isLoading = false,
  hasMore = false,
  onLoadMore,
  isLoadingMore = false,
  workspaceMembers = [],
  onOrgFilterChange,
  onSpaceFilterChange,
}: Props) {
  const draggableRef = useRef<Draggable | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(!!query);
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [editingTask, setEditingTask] = useState<TaskDTO | null>(null);

  // Unified filter panel state
  const [mineOnly, setMineOnly] = useState(false);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>("all");
  const [sortPreset, setSortPreset] = useState<SortPreset>("due-soon");
  const [activeQuickPresets, setActiveQuickPresets] = useState<Set<QuickPreset>>(new Set());
  const [selectedOrgId, setSelectedOrgId] = useState<string>("all");
  const [selectedSpaceId, setSelectedSpaceId] = useState<string>("all");

  const { activeOrgId, activeSpace, organisations } = useAppContext();


  const { canCreateTask } = useSpaceRole();

  // Sync internal filter state → parent props
  useEffect(() => {
    // Type → statusFilter
    if (typeFilter === "tasks") onStatusFilterChange("Task");
    else if (typeFilter === "events") onStatusFilterChange("Event");
    else if (typeFilter === "blocked") onStatusFilterChange("Blocked");
    else if (mineOnly) onStatusFilterChange("Mine");
    else onStatusFilterChange("All");
  }, [typeFilter, mineOnly]);

  useEffect(() => {
    // Sort preset → parent sortBy + sortOrder
    const { by, order } = SORT_PRESET_MAP[sortPreset];
    onSortChange(by, order);
  }, [sortPreset]);

  useEffect(() => {
    // Org/space → parent
    onOrgFilterChange?.(selectedOrgId);
  }, [selectedOrgId]);

  useEffect(() => {
    onSpaceFilterChange?.(selectedSpaceId);
  }, [selectedSpaceId]);

  // Spaces for selected org
  const { data: orgSpaces = [] } = useSpaces(selectedOrgId !== "all" ? selectedOrgId : null);

  // Active filter chips for the "active filters" strip
  const activeFilterChips = useMemo(() => {
    const chips: { label: string; onRemove: () => void }[] = [];
    if (mineOnly) chips.push({ label: "Mine", onRemove: () => setMineOnly(false) });
    if (typeFilter !== "all") chips.push({ label: typeFilter.charAt(0).toUpperCase() + typeFilter.slice(1), onRemove: () => setTypeFilter("all") });
    if (priorityFilter !== "all") chips.push({ label: priorityFilter.charAt(0).toUpperCase() + priorityFilter.slice(1) + " Priority", onRemove: () => setPriorityFilter("all") });
    if (selectedOrgId !== "all") {
      const org = organisations.find(o => o.id === selectedOrgId);
      chips.push({ label: org?.name ?? "Workspace", onRemove: () => { setSelectedOrgId("all"); setSelectedSpaceId("all"); } });
    }
    if (selectedSpaceId !== "all") {
      const sp = orgSpaces.find(s => s.id === selectedSpaceId);
      chips.push({ label: sp?.name ?? "Space", onRemove: () => setSelectedSpaceId("all") });
    }
    activeQuickPresets.forEach(p => {
      const labels: Record<QuickPreset, string> = {
        focus: "Focus", urgent: "Urgent", meetings: "Meetings",
        "assigned-to-me": "Assigned to Me", upcoming: "Upcoming", blocked: "Blocked",
      };
      chips.push({ label: labels[p], onRemove: () => {
        const next = new Set(activeQuickPresets);
        next.delete(p);
        setActiveQuickPresets(next);
      }});
    });
    return chips;
  }, [mineOnly, typeFilter, priorityFilter, selectedOrgId, selectedSpaceId, activeQuickPresets, organisations, orgSpaces]);

  const toggleQuickPreset = (p: QuickPreset) => {
    const next = new Set(activeQuickPresets);
    if (next.has(p)) next.delete(p); else next.add(p);
    setActiveQuickPresets(next);
  };

  // Toggle subtask expansion for a task
  const toggleExpanded = (e: React.MouseEvent, taskId: string) => {
    e.stopPropagation();
    const next = new Set(expandedTasks);
    if (next.has(taskId)) next.delete(taskId);
    else next.add(taskId);
    setExpandedTasks(next);
  };

  // Re-structure task list to include subtasks and stack them on top of parents
  const taskList = useMemo(() => {
    const parents = tasks.filter(t => !t.parent_task_id);
    const subtasks = tasks.filter(t => t.parent_task_id);

    const result: TaskDTO[] = [];
    parents.forEach(p => {
      // Find children for this parent
      const children = subtasks.filter(s => s.parent_task_id === p.id);
      // Stack children on TOP of parent
      result.push(...children);
      result.push(p);
    });

    // Add any subtasks whose parents are not in the current list
    const orphans = subtasks.filter(s => !parents.some(p => p.id === s.parent_task_id));
    result.push(...orphans);

    return result;
  }, [tasks]);

  // Keyboard shortcut: press C to open create dialog
  const onCreateDialogOpenChangeRef = useRef(onCreateDialogOpenChange);
  onCreateDialogOpenChangeRef.current = onCreateDialogOpenChange;
  const canCreateTaskRef = useRef(canCreateTask);
  canCreateTaskRef.current = canCreateTask;

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
        if (!canCreateTaskRef.current) return;
        e.preventDefault();
        onCreateDialogOpenChangeRef.current(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Logic handle by useMemo above
  // const taskList = tasks.filter(t => !t.parent_task_id);

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

  const handleBulkStatusChange = (status: AnyStatus) => {
    if (onUpdateTask) {
      selectedTaskIds.forEach((id) => onUpdateTask(id, { status }));
    }
    setSelectedTaskIds(new Set());
  };

  const handleBulkPriorityChange = (priority: TaskPriority) => {
    if (onUpdateTask) {
      selectedTaskIds.forEach((id) => onUpdateTask(id, { priority }));
    }
    setSelectedTaskIds(new Set());
  };

  const handleBulkDueDateChange = (dueDate: string) => {
    if (onUpdateTask) {
      selectedTaskIds.forEach((id) => {
        const task = tasks.find((t) => t.id === id);
        const isDone = task?.status === "done" || task?.status === "completed";
        if (!isDone) {
          onUpdateTask(id, { dueDateISO: dueDate });
        }
      });
    }
    setSelectedTaskIds(new Set());
  };

  const handleBulkAssign = (userId: string) => {
    if (onAssignUser) {
      selectedTaskIds.forEach((taskId) => onAssignUser(taskId, userId));
    }
    setSelectedTaskIds(new Set());
  };

  const handleBulkUnassign = () => {
    // Get first selected task to check assignees
    const firstTaskId = Array.from(selectedTaskIds)[0];
    const firstTask = tasks.find((t) => t.id === firstTaskId);
    if (firstTask?.assignees && onRemoveAssignee) {
      // Remove all assignees from each selected task
      selectedTaskIds.forEach((taskId) => {
        const task = tasks.find((t) => t.id === taskId);
        task?.assignees?.forEach((assignee) => {
          onRemoveAssignee(taskId, assignee.id);
        });
      });
    }
    setSelectedTaskIds(new Set());
  };

  const handleBulkDelete = () => {
    if (onDeleteTask) {
      selectedTaskIds.forEach((id) => onDeleteTask(id));
    }
    setDeleteDialogOpen(false);
    setSelectedTaskIds(new Set());
  };

  const confirmDelete = () => {
    setDeleteDialogOpen(true);
  };

  return (
    <div className="h-full min-h-0 flex flex-col w-full relative overflow-hidden">
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="px-3 pt-3 pb-2 border-b border-border/60 shrink-0">

        {/* Top bar: Mine/All toggle + icons */}
        <div className="flex items-center justify-between gap-2 min-h-[32px]">
          {isSearchOpen ? (
            <div className="relative flex-1 animate-in fade-in slide-in-from-right-2 duration-200">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
              <Input
                autoFocus
                value={query}
                onChange={(e) => onQueryChange(e.target.value)}
                placeholder="Search tasks…"
                className="pl-8 pr-8 h-8 text-xs rounded-md w-full"
                onBlur={(e) => { if (!e.target.value) setIsSearchOpen(false); }}
              />
              <Button
                variant="ghost" size="sm"
                className="absolute right-1 top-1/2 -translate-y-1/2 size-6 p-0 hover:bg-transparent"
                onClick={() => { onQueryChange(""); setIsSearchOpen(false); }}
              >
                <X className="size-3.5 text-muted-foreground" />
              </Button>
            </div>
          ) : (
            <>
              {/* Mine / All pill toggle */}
              <div className="flex bg-muted/40 rounded-lg p-0.5 gap-0.5">
                <button
                  onClick={() => setMineOnly(false)}
                  className={cn(
                    "px-3 py-1 text-xs font-medium rounded-md transition-all",
                    !mineOnly ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  All
                </button>
                <button
                  onClick={() => setMineOnly(true)}
                  className={cn(
                    "px-3 py-1 text-xs font-medium rounded-md transition-all",
                    mineOnly ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Mine
                </button>
              </div>

              {/* Icon actions */}
              <div className="flex items-center gap-0.5 shrink-0">
                <Button size="sm" variant="ghost" className="size-7 p-0 rounded-md"
                  onClick={() => setIsSearchOpen(true)}>
                  <Search className="size-3.5 text-muted-foreground" />
                </Button>

                {/* ── Filter dropdown menu ── */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" variant="ghost"
                      className={cn("size-7 p-0 rounded-md relative",
                        activeFilterChips.length > 0 && "bg-muted"
                      )}>
                      <SlidersHorizontal className="size-3.5 text-muted-foreground" />
                      {activeFilterChips.length > 0 && (
                        <span className="absolute top-0.5 right-0.5 size-1.5 rounded-full bg-primary" />
                      )}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48 rounded-xl">

                    {/* Type */}
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger className="text-xs gap-2">
                        <span className="size-3.5 flex items-center justify-center text-muted-foreground">
                          <ChevronRight className="size-3" />
                        </span>
                        Type
                        {typeFilter !== "all" && (
                          <span className="ml-auto text-[10px] text-primary font-medium capitalize">{typeFilter}</span>
                        )}
                      </DropdownMenuSubTrigger>
                      <DropdownMenuSubContent className="w-40 rounded-xl">
                        {(["all", "tasks", "events", "blocked"] as TypeFilter[]).map(t => (
                          <DropdownMenuItem key={t} className="text-xs capitalize gap-2"
                            onClick={() => setTypeFilter(t)}>
                            {typeFilter === t && <Check className="size-3 text-primary shrink-0" />}
                            <span className={typeFilter === t ? "ml-0" : "ml-5"}>
                              {t === "all" ? "All" : t.charAt(0).toUpperCase() + t.slice(1)}
                            </span>
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>

                    {/* Priority */}
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger className="text-xs gap-2">
                        <Flag className="size-3.5 text-muted-foreground shrink-0" />
                        Priority
                        {priorityFilter !== "all" && (
                          <span className="ml-auto text-[10px] text-primary font-medium capitalize">{priorityFilter}</span>
                        )}
                      </DropdownMenuSubTrigger>
                      <DropdownMenuSubContent className="w-40 rounded-xl">
                        {(["all", "urgent", "high", "medium", "low"] as PriorityFilter[]).map(p => (
                          <DropdownMenuItem key={p} className="text-xs capitalize gap-2"
                            onClick={() => setPriorityFilter(p)}>
                            {priorityFilter === p && <Check className="size-3 text-primary shrink-0" />}
                            <span className={priorityFilter === p ? "ml-0" : "ml-5"}>
                              {p === "all" ? "Any" : p.charAt(0).toUpperCase() + p.slice(1)}
                            </span>
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>

                    {/* Sort */}
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger className="text-xs gap-2">
                        <Calendar className="size-3.5 text-muted-foreground shrink-0" />
                        Sort
                        <span className="ml-auto text-[10px] text-primary font-medium truncate max-w-[60px]">
                          {SORT_PRESET_LABELS[sortPreset].split(" ").slice(0, 2).join(" ")}
                        </span>
                      </DropdownMenuSubTrigger>
                      <DropdownMenuSubContent className="w-44 rounded-xl">
                        {(Object.keys(SORT_PRESET_LABELS) as SortPreset[]).map(p => (
                          <DropdownMenuItem key={p} className="text-xs gap-2"
                            onClick={() => setSortPreset(p)}>
                            {sortPreset === p && <Check className="size-3 text-primary shrink-0" />}
                            <span className={sortPreset === p ? "ml-0" : "ml-5"}>
                              {SORT_PRESET_LABELS[p]}
                            </span>
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>

                    {/* Quick Filters */}
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger className="text-xs gap-2">
                        <Zap className="size-3.5 text-muted-foreground shrink-0" />
                        Quick Filters
                        {activeQuickPresets.size > 0 && (
                          <span className="ml-auto text-[10px] text-primary font-medium">{activeQuickPresets.size} on</span>
                        )}
                      </DropdownMenuSubTrigger>
                      <DropdownMenuSubContent className="w-44 rounded-xl">
                        {([
                          { id: "focus",          label: "Focus",          icon: Zap },
                          { id: "urgent",         label: "Urgent",         icon: ShieldAlert },
                          { id: "meetings",       label: "Meetings",       icon: CalendarClock },
                          { id: "assigned-to-me", label: "Assigned to Me", icon: UserCheck },
                          { id: "upcoming",       label: "Upcoming",       icon: CalendarRange },
                          { id: "blocked",        label: "Blocked",        icon: ShieldAlert },
                        ] as { id: QuickPreset; label: string; icon: any }[]).map(({ id, label, icon: Icon }) => (
                          <DropdownMenuItem key={id} className="text-xs gap-2"
                            onClick={(e) => { e.preventDefault(); toggleQuickPreset(id); }}>
                            {activeQuickPresets.has(id)
                              ? <Check className="size-3 text-primary shrink-0" />
                              : <Icon className="size-3 text-muted-foreground shrink-0" />
                            }
                            {label}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>

                    {/* Workspace */}
                    {(activeSpace?.is_private || organisations.length > 1) && (
                      <DropdownMenuSub>
                        <DropdownMenuSubTrigger className="text-xs gap-2">
                          <User className="size-3.5 text-muted-foreground shrink-0" />
                          Workspace
                          {selectedOrgId !== "all" && (
                            <span className="ml-auto text-[10px] text-primary font-medium truncate max-w-[50px]">
                              {organisations.find(o => o.id === selectedOrgId)?.name ?? ""}
                            </span>
                          )}
                        </DropdownMenuSubTrigger>
                        <DropdownMenuSubContent className="w-48 rounded-xl">
                          <DropdownMenuItem className="text-xs gap-2"
                            onClick={() => { setSelectedOrgId("all"); setSelectedSpaceId("all"); }}>
                            {selectedOrgId === "all" && <Check className="size-3 text-primary shrink-0" />}
                            <span className={selectedOrgId === "all" ? "ml-0" : "ml-5"}>All workspaces</span>
                          </DropdownMenuItem>
                          {organisations.map(org => (
                            <DropdownMenuItem key={org.id} className="text-xs gap-2"
                              onClick={() => { setSelectedOrgId(org.id); setSelectedSpaceId("all"); }}>
                              {selectedOrgId === org.id && <Check className="size-3 text-primary shrink-0" />}
                              <span className={selectedOrgId === org.id ? "ml-0" : "ml-5 truncate"}>
                                {org.name}{org.is_personal ? " (Personal)" : ""}
                              </span>
                            </DropdownMenuItem>
                          ))}
                          {selectedOrgId !== "all" && orgSpaces.length > 0 && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-xs gap-2"
                                onClick={() => setSelectedSpaceId("all")}>
                                {selectedSpaceId === "all" && <Check className="size-3 text-primary shrink-0" />}
                                <span className={selectedSpaceId === "all" ? "ml-0" : "ml-5"}>All spaces</span>
                              </DropdownMenuItem>
                              {orgSpaces.map(sp => (
                                <DropdownMenuItem key={sp.id} className="text-xs gap-2"
                                  onClick={() => setSelectedSpaceId(sp.id)}>
                                  {selectedSpaceId === sp.id && <Check className="size-3 text-primary shrink-0" />}
                                  <span className={selectedSpaceId === sp.id ? "ml-0" : "ml-5 truncate"}>{sp.name}</span>
                                </DropdownMenuItem>
                              ))}
                            </>
                          )}
                        </DropdownMenuSubContent>
                      </DropdownMenuSub>
                    )}

                    {/* Clear all */}
                    {activeFilterChips.length > 0 && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-xs text-muted-foreground"
                          onClick={() => {
                            setTypeFilter("all"); setPriorityFilter("all");
                            setSelectedOrgId("all"); setSelectedSpaceId("all");
                            setActiveQuickPresets(new Set()); setMineOnly(false);
                          }}>
                          <X className="size-3 mr-2" />
                          Clear all filters
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>

                {canCreateTask && (
                  <Button size="sm" variant="ghost" className="size-7 p-0 rounded-md"
                    onClick={() => onCreateDialogOpenChange(true)}>
                    <Plus className="size-3.5" />
                  </Button>
                )}
              </div>
            </>
          )}
        </div>

        {/* Active filter chips strip */}
        {activeFilterChips.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2 animate-in fade-in duration-150">
            {activeFilterChips.map(chip => (
              <span
                key={chip.label}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-primary/10 text-primary border border-primary/20"
              >
                {chip.label}
                <button onClick={chip.onRemove} className="hover:text-primary/60 transition-colors">
                  <X className="size-2.5" />
                </button>
              </span>
            ))}
            <button
              onClick={() => {
                setTypeFilter("all"); setPriorityFilter("all");
                setSelectedOrgId("all"); setSelectedSpaceId("all");
                setActiveQuickPresets(new Set()); setMineOnly(false);
              }}
              className="text-[10px] text-muted-foreground hover:text-foreground transition-colors px-1"
            >
              Clear all
            </button>
          </div>
        )}
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
                  <div className="size-2 rounded-full bg-muted-foreground/20 shrink-0" />
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
            const isDone = t.status === "done" || t.status === "completed";
            const isDraggable = t.status !== "done" && t.status !== "completed";
            const isBlocked = ((t as any).blocked_by_count || (t.dependencies?.length || 0)) > 0;

            const { canEditTask: itemCanEdit, canDeleteTask: itemCanDelete } = getTaskPermissions(
              t,
              activeOrgId,
              activeSpace?.id ?? null,
              activeSpace?.role ?? null
            );

            return (
              <div key={t.id} className="group/item">
                <div
                  onClick={() => !isMultiSelecting && onSelectTask(t.id)}
                  data-task-id={t.id}
                  data-task-title={t.title}
                  data-task-status={t.status}
                  className={cn(
                    "flex items-center justify-between gap-2 px-2 py-1.5 rounded-md transition-colors cursor-pointer group w-full min-w-0",
                    active && !isMultiSelecting
                      ? "bg-[#EEF2FF] dark:bg-[#1E1B4B]"
                      : "hover:bg-[#F4F4F5] dark:hover:bg-[#18181B]",
                    isDone && "opacity-50",
                    isDraggable && "draggable-task-card cursor-grab active:cursor-grabbing"
                  )}
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
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
                          <GripVertical className="size-3.5 text-muted-foreground" />
                        </div>
                      ) : (
                        <div className="w-[22px] shrink-0" />
                      )}

                      {/* Multi-select checkbox */}
                      <div
                        className="shrink-0"
                        onClick={(e) => toggleSelection(e, t.id)}
                      >
                        <Checkbox checked={isChecked} className="size-3.5" />
                      </div>
                    </div>

                    {/* Icon/Dot — click opens popover or expands if parent hovered */}
                    <div className="size-5 flex items-center justify-center relative shrink-0">
                      {/* Status icon — visible by default, hidden on hover if parent */}
                      <Popover>
                        <PopoverTrigger asChild>
                          <button
                            onClick={(e) => e.stopPropagation()}
                            className="shrink-0 transition-transform hover:scale-110 group-hover/item:opacity-0 transition-opacity flex items-center justify-center"
                          >
                            {t.type === "event" ? (
                              <Calendar className={cn("size-4 shrink-0", getStatusTextColor(t.status))} />
                            ) : (
                              <CheckSquare className={cn("size-4 shrink-0", getStatusTextColor(t.status))} />
                            )}
                          </button>
                        </PopoverTrigger>
                        <PopoverContent
                          align="start"
                          className="w-36 p-1 rounded-lg shadow-lg"
                        >
                          {(t.type === "event" ? EVENT_STATUS_OPTIONS : TASK_STATUS_OPTIONS).map((s) => (
                            <PopoverClose asChild key={s}>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onUpdateTask?.(t.id, { status: s });
                                }}
                                className="w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded-md hover:bg-accent/60 transition-colors capitalize"
                              >
                                {t.type === "event" ? (
                                  <Calendar className={cn("size-3.5 shrink-0", getStatusTextColor(s))} />
                                ) : (
                                  <CheckSquare className={cn("size-3.5 shrink-0", getStatusTextColor(s))} />
                                )}
                                {s}
                              </button>
                            </PopoverClose>
                          ))}
                        </PopoverContent>
                      </Popover>

                      {/* Chevron — visible ALWAYS on hover for all tasks */}
                      <button
                        onClick={(e) => toggleExpanded(e, t.id)}
                        className="absolute inset-0 opacity-0 group-hover/item:opacity-100 flex items-center justify-center transition-opacity hover:text-foreground"
                      >
                        {expandedTasks.has(t.id) ? (
                          <ChevronDown className="size-3.5" />
                        ) : (
                          <ChevronRight className="size-3.5" />
                        )}
                      </button>
                    </div>

                    <div className="task-name-container flex flex-col items-start gap-0.5">
                      <span className={cn(
                        "task-name-scroll text-sm font-medium leading-snug",
                        isDone && "line-through opacity-60"
                      )} title={t.title}>
                        {t.title}
                      </span>
                    </div>
                  </div>

                  {/* Right block: Badge and Date */}
                  <div className="flex items-center gap-2 shrink-0 text-[11px] text-muted-foreground justify-end relative ml-auto min-w-fit">
                    {/* Badges & Icons */}
                    <div className="flex items-center gap-1.5">
                      {t.type === "event" ? (
                        <span className="text-[10px] bg-[#EEF2FF] text-[#3730A3] dark:bg-[#1E1B4B] dark:text-[#C7D2FE] font-medium leading-none px-1.5 py-0.5 rounded uppercase tracking-wider whitespace-nowrap">
                          event
                        </span>
                      ) : null}
                      
                      {isBlocked && (
                        <Zap className="size-3 text-yellow-400 shrink-0" />
                      )}
                    </div>
                    
                    {/* Date / Action Menu */}
                    <div className="relative flex items-center justify-end min-w-fit ml-2">
                      <span className={cn(
                        "tabular-nums transition-opacity group-hover/item:opacity-0 text-right leading-tight",
                        isDone && "opacity-40"
                      )}>
                        {formatTaskDateRange(t.start_date, t.due_date)}
                      </span>
                      
                      <div className="absolute right-0 opacity-0 group-hover/item:opacity-100 transition-opacity">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="size-6 p-0 hover:bg-muted-foreground/10"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MoreHorizontal className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => onSelectTask(t.id)}>
                              View Details
                            </DropdownMenuItem>
                            {itemCanEdit && (
                              <DropdownMenuItem onClick={() => setEditingTask(t)}>
                                <Pencil className="size-3.5 mr-2" />
                                Edit
                              </DropdownMenuItem>
                            )}
                            {itemCanDelete && (
                              <DropdownMenuItem 
                                className="text-destructive focus:text-destructive" 
                                onClick={() => {
                                  if (onDeleteTask) onDeleteTask(t.id);
                                }}
                              >
                                <Trash2 className="size-3.5 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Expanded subtasks dropdown — available for all tasks */}
                {expandedTasks.has(t.id) && (
                  <SubtaskList
                    parentTaskId={t.id}
                    selectedTaskId={selectedTaskId}
                    onSelectTask={onSelectTask}
                    onUpdateTask={onUpdateTask}
                  />
                )}
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

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs rounded-full border-border bg-background px-3"
              >
                Actions
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" className="w-48">
              {/* Status submenu */}
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className="text-xs">
                  <div className="size-2 rounded-full bg-blue-500 mr-2" />
                  Change status
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger className="text-xs">Task Status</DropdownMenuSubTrigger>
                    <DropdownMenuSubContent>
                      {TASK_STATUS_OPTIONS.map((s) => (
                        <DropdownMenuItem
                          key={s}
                          className="text-xs capitalize gap-2"
                          onClick={() => handleBulkStatusChange(s)}
                        >
                          <CheckSquare
                            className={cn(
                              "size-3 shrink-0",
                              getStatusTextColor(s)
                            )}
                          />
                          {s}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger className="text-xs">Event Status</DropdownMenuSubTrigger>
                    <DropdownMenuSubContent>
                      {EVENT_STATUS_OPTIONS.map((s) => (
                        <DropdownMenuItem
                          key={s}
                          className="text-xs capitalize gap-2"
                          onClick={() => handleBulkStatusChange(s)}
                        >
                          <Calendar
                            className={cn(
                              "size-3 shrink-0",
                              getStatusTextColor(s)
                            )}
                          />
                          {s}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                </DropdownMenuSubContent>
              </DropdownMenuSub>

              {/* Priority submenu */}
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className="text-xs">
                  <Flag className="size-3 mr-2" />
                  Change priority
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  {(["low", "medium", "high", "urgent"] as TaskPriority[]).map(
                    (p) => (
                      <DropdownMenuItem
                        key={p}
                        className="text-xs"
                        onClick={() => handleBulkPriorityChange(p)}
                      >
                        <Flag
                          className={cn(
                            "size-3 mr-2",
                            p === "high" || p === "urgent"
                              ? "text-orange-400"
                              : "text-muted-foreground"
                          )}
                        />
                        {p}
                      </DropdownMenuItem>
                    )
                  )}
                </DropdownMenuSubContent>
              </DropdownMenuSub>

              {/* Due date submenu */}
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className="text-xs">
                  <Calendar className="size-3 mr-2" />
                  Set due date
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuItem
                    className="text-xs"
                    onClick={() =>
                      handleBulkDueDateChange(
                        new Date().toISOString().split("T")[0]
                      )
                    }
                  >
                    Today
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-xs"
                    onClick={() => {
                      const tomorrow = new Date();
                      tomorrow.setDate(tomorrow.getDate() + 1);
                      handleBulkDueDateChange(
                        tomorrow.toISOString().split("T")[0]
                      );
                    }}
                  >
                    Tomorrow
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-xs"
                    onClick={() => {
                      const nextWeek = new Date();
                      nextWeek.setDate(nextWeek.getDate() + 7);
                      handleBulkDueDateChange(
                        nextWeek.toISOString().split("T")[0]
                      );
                    }}
                  >
                    Next week
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-xs"
                    onClick={() => handleBulkDueDateChange("")}
                  >
                    Clear due date
                  </DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>

              {/* Assign submenu */}
              {workspaceMembers.length > 0 && (
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger className="text-xs">
                    <User className="size-3 mr-2" />
                    Assign to
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="max-h-48 overflow-y-auto">
                    {workspaceMembers.map((member) => (
                      <DropdownMenuItem
                        key={member.id}
                        className="text-xs"
                        onClick={() => handleBulkAssign(member.id)}
                      >
                        <div className="size-5 rounded-full bg-muted flex items-center justify-center mr-2 text-[10px] font-medium">
                          {member.name
                            ? member.name.charAt(0).toUpperCase()
                            : member.email.charAt(0).toUpperCase()}
                        </div>
                        {member.name || member.email}
                      </DropdownMenuItem>
                    ))}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-xs text-destructive"
                      onClick={handleBulkUnassign}
                    >
                      Unassign all
                    </DropdownMenuItem>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              )}

              <DropdownMenuSeparator />

              {/* Delete action */}
              <DropdownMenuItem
                className="text-xs text-destructive focus:text-destructive"
                onClick={confirmDelete}
              >
                <Trash2 className="size-3 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

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

      {/* ── Delete confirmation dialog ─────────────────────────── */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="size-5" />
              Delete Tasks
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to permanently delete{" "}
              <span className="font-semibold">{selectedTaskIds.size}</span>{" "}
              {selectedTaskIds.size === 1 ? "task" : "tasks"}? This action cannot
              be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDeleteDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleBulkDelete}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Create task dialog ────────────────────────────────── */}
      <CreateTaskDialog
        open={createDialogOpen}
        onOpenChange={onCreateDialogOpenChange}
        onTaskCreated={onTaskCreated}
        allTasks={allTasks ?? tasks}
      />

      {/* ── Edit task dialog ──────────────────────────────────── */}
      {editingTask && (
        <CreateTaskDialog
          open={!!editingTask}
          onOpenChange={(open) => !open && setEditingTask(null)}
          mode="edit"
          taskId={editingTask.id}
          initialValues={editingTask}
          onTaskUpdated={() => setEditingTask(null)}
          allTasks={allTasks ?? tasks}
          orgId={editingTask.org_id}
          spaceId={editingTask.space_id}
        />
      )}
    </div>
  );
}