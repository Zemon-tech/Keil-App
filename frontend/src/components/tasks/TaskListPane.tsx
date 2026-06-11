import { useEffect, useMemo, useRef, useState } from "react";
import {
  format,
  isSameDay,
  isSameMonth,
  isSameYear,
  subDays,
  startOfDay,
  differenceInDays,
  isAfter,
  isBefore,
  addDays,
  startOfWeek,
  endOfWeek,
} from "date-fns";
import { Draggable } from "@fullcalendar/interaction";
import {
  Search, Plus, GripVertical, Flag, Zap, X, Trash2, Calendar, User,
  AlertCircle, ChevronDown, ChevronRight, MoreHorizontal, Pencil,
  SlidersHorizontal, CalendarClock, Rocket,
  Check, PanelLeftClose,
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
import { STATUS_OPTIONS as TASK_STATUS_OPTIONS, EVENT_STATUS_OPTIONS, StatusIcon } from "./task-detail-shared";
import { useSpaceRole } from "@/hooks/useSpaceRole";
import { useSpaces } from "@/hooks/api/useSpaces";
import { useAuth } from "@/contexts/AuthContext";

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
  /** Callback to collapse/hide the task list sidebar */
  onCollapse?: () => void;
};

function formatTaskDateRange(start?: string, end?: string, isAllDay?: boolean) {
  if (!end) return start ? format(new Date(start), "MMM d") : "\u2014";
  if (!start) return format(new Date(end), "MMM d");

  const startDate = new Date(start);
  const endDate = isAllDay ? subDays(startOfDay(new Date(end)), 1) : new Date(end);

  if (isSameDay(startDate, endDate)) {
    return format(startDate, "MMM d");
  }

  if (isSameMonth(startDate, endDate) && isSameYear(startDate, endDate)) {
    return `${format(startDate, "MMM d")}–${format(endDate, "d")}`;
  }

  return `${format(startDate, "MMM d")} – ${format(endDate, "MMM d")}`;
}

function getSprintStatus(dateStr?: string): "current" | "next" | "backlog" {
  if (!dateStr) return "backlog";
  const date = new Date(dateStr);
  const today = new Date();

  const currentSprintStart = startOfWeek(today, { weekStartsOn: 1 });
  const currentSprintEnd = endOfWeek(addDays(currentSprintStart, 7), { weekStartsOn: 1 });

  const nextSprintStart = addDays(currentSprintEnd, 1);
  const nextSprintEnd = endOfWeek(addDays(nextSprintStart, 7), { weekStartsOn: 1 });

  if (isBefore(date, addDays(currentSprintEnd, 1))) {
    return "current";
  }
  if (isAfter(date, subDays(nextSprintStart, 1)) && isBefore(date, addDays(nextSprintEnd, 1))) {
    return "next";
  }
  return "backlog";
}

function calculateAttentionScore(
  task: TaskDTO,
  userId: string,
  allTasks: TaskDTO[]
): number {
  let score = 0;

  // 1. Priority Weight
  const priority = task.priority || "medium";
  if (priority === "urgent") score += 100;
  else if (priority === "high") score += 60;
  else if (priority === "medium") score += 30;
  else if (priority === "low") score += 10;
  else score += 10;

  // 2. Due Date Weight (Urgency Weight)
  if (task.due_date) {
    const due = startOfDay(new Date(task.due_date));
    const today = startOfDay(new Date());
    const isCompleted = task.status === "done" || task.status === "completed";

    if (!isCompleted && isBefore(due, today)) {
      score += 120;
    } else if (isSameDay(due, today)) {
      score += 90;
    } else if (isSameDay(due, addDays(today, 1))) {
      score += 60;
    } else if (isBefore(due, addDays(today, 7)) && isAfter(due, today)) {
      score += 40;
    }
  }

  // 3. Assignment Weight
  const isAssignedToMe = task.assignees?.some(a => a.id === userId) || false;
  if (isAssignedToMe) score += 40;
  if (task.created_by === userId) score += 10;

  const isWatching = (task as any).watchers?.includes(userId) || (task as any).watchers?.some((w: any) => w.id === userId);
  if (isWatching) score += 15;

  // 4. Dependency Weight
  const dependentCount = allTasks.filter(other =>
    other.id !== task.id &&
    other.dependencies?.some(dep => dep.id === task.id)
  ).length;
  score += dependentCount * 10;

  // 5. Sprint Weight
  const sprintStatus = getSprintStatus(task.due_date || task.start_date);
  if (sprintStatus === "current") score += 50;
  else if (sprintStatus === "next") score += 20;

  // 6. Activity Weight
  if (task.updated_at) {
    const hoursSinceUpdate = differenceInDays(new Date(), new Date(task.updated_at)) * 24;
    if (hoursSinceUpdate <= 24) {
      score += 15;
    }
  }

  // 7. Aging Weight
  const isCompleted = task.status === "done" || task.status === "completed";
  if (!isCompleted && task.updated_at) {
    const daysWithoutUpdate = Math.max(0, differenceInDays(new Date(), new Date(task.updated_at)));
    score += Math.min(40, daysWithoutUpdate * 2);
  }

  return score;
}

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
      <div className="h-7 pl-6 text-xs font-medium italic leading-7 text-muted-foreground/50 select-none">
        No subtasks
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
                    <StatusIcon
                      status={sub.status as AnyStatus}
                      type={(sub as any).type === "event" ? "event" : "task"}
                      className="size-3.5 shrink-0"
                    />
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
                        <StatusIcon
                          status={s}
                          type={(sub as any).type === "event" ? "event" : "task"}
                          className="size-3 shrink-0"
                        />
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
                <span title="Event">
                  <CalendarClock className="size-3 text-muted-foreground shrink-0" />
                </span>
              )}
              {isHighPriority && <Flag className="size-2.5 text-orange-400 shrink-0" />}
              <span className="tabular-nums text-right leading-tight">
                {formatTaskDateRange(sub.start_date ?? undefined, sub.due_date ?? undefined, (sub as any).is_all_day)}
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

interface SectionHeaderProps {
  title: string;
  icon?: React.ReactNode;
  count?: number;
  isCollapsed: boolean;
  onToggle: () => void;
  badgeColor?: string;
  extraWidget?: React.ReactNode;
  onCreateClick?: () => void;
}

function SectionHeader({
  title,
  isCollapsed,
  onToggle,
  extraWidget,
  onCreateClick,
}: SectionHeaderProps) {
  return (
    <div className="group/section flex h-8 items-center justify-between mt-2 first:mt-0 select-none">
      <button
        type="button"
        onClick={onToggle}
        className="flex min-w-0 flex-1 items-center gap-1.5 px-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <div
          className={cn(
            "transition-transform duration-200 text-muted-foreground/60",
            isCollapsed && "-rotate-90"
          )}
        >
          <ChevronDown className="size-3 shrink-0" />
        </div>
        <span className="truncate">{title}</span>
      </button>

      <div className="flex items-center gap-1 shrink-0 px-2">
        {onCreateClick && (
          <Button
            variant="ghost"
            size="icon"
            className="size-6 opacity-0 text-muted-foreground hover:bg-muted-foreground/10 hover:text-foreground group-hover/section:opacity-100 transition-opacity"
            onClick={(e) => {
              e.stopPropagation();
              onCreateClick();
            }}
            aria-label={`Add to ${title}`}
          >
            <Plus className="size-3.5" />
          </Button>
        )}
        {extraWidget}
      </div>
    </div>
  );
}

function SprintCapacityWidget({ hours, percentage, color }: { hours: number; percentage: number; color: string }) {
  return (
    <div className="flex items-center gap-1.5 shrink-0 text-[9px] font-medium text-muted-foreground">
      <span>{hours}h/80h</span>
      <div className="w-8 h-1 rounded-full bg-muted overflow-hidden shrink-0">
        <div className={cn("h-full transition-all duration-300", color)} style={{ width: `${percentage}%` }} />
      </div>
    </div>
  );
}

export function TaskListPane({
  query,
  onQueryChange,
  onStatusFilterChange,
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
  onCollapse,
}: Props) {
  const { user } = useAuth();
  const draggableRef = useRef<Draggable | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(!!query);
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [editingTask, setEditingTask] = useState<TaskDTO | null>(null);

  // Additive filter state
  const [filters, setFilters] = useState<{
    statuses: string[];
    priorities: string[];
    assignments: string[];
    sprints: string[];
    orgId: string;
    spaceId: string;
  }>(() => {
    let defaults = {
      statuses: [],
      priorities: [],
      assignments: [],
      sprints: [],
      orgId: "all",
      spaceId: "all",
    };
    try {
      const stored = localStorage.getItem("task_default_filters");
      if (stored) {
        const parsed = JSON.parse(stored);
        defaults = { ...defaults, ...parsed };
      }
    } catch (e) {
      // Fallback
    }
    return defaults;
  });

  const [visibleSections, setVisibleSections] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem("task_visible_sections");
      return stored ? JSON.parse(stored) : ["needsAttention", "currentSprint"];
    } catch {
      return ["needsAttention", "currentSprint"];
    }
  });

  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({
    needsAttention: false,
    myFocus: false,
    currentSprint: false,
    upcomingWork: false,
    recentlyCompleted: true,
  });

  const [collapsedSubFilters, setCollapsedSubFilters] = useState<Record<string, boolean>>({});

  const toggleSubFilter = (groupKey: string) => {
    setCollapsedSubFilters(prev => ({ ...prev, [groupKey]: !prev[groupKey] }));
  };

  // Global settings change listener
  useEffect(() => {
    const handleSettingsChange = () => {
      try {
        const storedSections = localStorage.getItem("task_visible_sections");
        if (storedSections) {
          setVisibleSections(JSON.parse(storedSections));
        }
        const storedFilters = localStorage.getItem("task_default_filters");
        if (storedFilters) {
          const parsed = JSON.parse(storedFilters);
          setFilters(prev => ({
            ...prev,
            ...parsed
          }));
        }
      } catch (e) {
        console.error("Error loading task settings", e);
      }
    };

    window.addEventListener("task_settings_changed", handleSettingsChange);
    return () => {
      window.removeEventListener("task_settings_changed", handleSettingsChange);
    };
  }, []);

  const { activeOrgId, activeSpace, organisations } = useAppContext();
  const { canCreateTask } = useSpaceRole();

  const toggleSectionCollapse = (section: string) => {
    setCollapsedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const toggleFilter = (category: keyof typeof filters, value: string) => {
    setFilters(prev => {
      const current = prev[category];
      if (Array.isArray(current)) {
        const next = current.includes(value)
          ? current.filter(x => x !== value)
          : [...current, value];
        return { ...prev, [category]: next };
      }
      return prev;
    });
  };

  // Reset filters when changing active organisation or space
  useEffect(() => {
    setFilters(prev => ({ ...prev, orgId: "all", spaceId: "all" }));
  }, [activeOrgId, activeSpace?.id]);

  // Sync workspace filters up to parent
  useEffect(() => {
    onOrgFilterChange?.(filters.orgId);
  }, [filters.orgId]);

  useEffect(() => {
    onSpaceFilterChange?.(filters.spaceId);
  }, [filters.spaceId]);

  // Sync assignment filters up to parent
  useEffect(() => {
    if (filters.assignments.length === 1 && filters.assignments[0] === "assigned-to-me") {
      onStatusFilterChange("Mine");
    } else {
      onStatusFilterChange("All");
    }
  }, [filters.assignments]);

  // Fetch spaces for selected workspace
  const { data: orgSpaces = [] } = useSpaces(filters.orgId !== "all" ? filters.orgId : null);

  const isFiltered = useMemo(() => {
    return (
      query.trim().length > 0 ||
      filters.statuses.length > 0 ||
      filters.priorities.length > 0 ||
      filters.assignments.length > 0 ||
      filters.sprints.length > 0 ||
      filters.orgId !== "all" ||
      filters.spaceId !== "all"
    );
  }, [query, filters]);

  // Apply additive filters
  const filteredTasks = useMemo(() => {
    return tasks.filter(t => {
      // Filter out events as we are not showing events in TaskListPane
      if (t.type === "event") return false;

      // 1. Status Filter
      if (filters.statuses.length > 0) {
        if (!filters.statuses.includes(t.status)) return false;
      }

      // 2. Priority Filter
      if (filters.priorities.length > 0) {
        if (!filters.priorities.includes(t.priority)) return false;
      }

      // 3. Assignment Filter
      if (filters.assignments.length > 0) {
        const matches = filters.assignments.some(a => {
          if (a === "assigned-to-me") return t.assignees?.some(as => as.id === user?.id);
          if (a === "created-by-me") return t.created_by === user?.id;
          if (a === "watching") return (t as any).watchers?.includes(user?.id) || (t as any).watchers?.some((w: any) => w.id === user?.id);
          if (a === "unassigned") return !t.assignees || t.assignees.length === 0;
          return false;
        });
        if (!matches) return false;
      }

      // 4. Sprint Filter
      if (filters.sprints.length > 0) {
        const sStatus = getSprintStatus(t.due_date || t.start_date);
        if (!filters.sprints.includes(sStatus)) return false;
      }

      // 5. Workspace Filter
      if (filters.orgId !== "all") {
        if (t.org_id !== filters.orgId) return false;
      }

      // 6. Space Filter
      if (filters.spaceId !== "all") {
        if (t.space_id !== filters.spaceId) return false;
      }

      return true;
    });
  }, [tasks, filters, user]);

  // Deduplicate subtasks inside main top-level views if not filtered
  const displayedTasks = useMemo(() => {
    if (isFiltered) {
      return filteredTasks;
    } else {
      return filteredTasks.filter(t => !t.parent_task_id);
    }
  }, [filteredTasks, isFiltered]);

  // Sections construction
  const sections = useMemo(() => {
    const today = startOfDay(new Date());
    const tomorrow = addDays(today, 1);
    const sevenDaysOut = addDays(today, 7);
    const yesterday = subDays(today, 1);
    const startOfCurrentWeek = startOfWeek(today, { weekStartsOn: 1 });

    const sourceTasks = allTasks || tasks;

    // Calculate metadata for scoring
    const tasksWithMetadata = displayedTasks.map(t => {
      const score = calculateAttentionScore(t, user?.id || "", sourceTasks);
      const sprint = getSprintStatus(t.due_date || t.start_date);
      return { ...t, score, sprint };
    });

    // 1. Needs Attention (max 10)
    const needsAttentionRaw = tasksWithMetadata.filter(t => {
      if (t.type === "event") return false;
      const isCompleted = t.status === "done" || t.status === "completed";
      if (isCompleted) return false;

      const overdue = t.due_date && isBefore(startOfDay(new Date(t.due_date)), today);
      const blocked = ((t as any).blocked_by_count || (t.dependencies?.length || 0)) > 0;
      const dueToday = t.due_date && isSameDay(new Date(t.due_date), today);
      const critical = t.priority === "urgent" || t.priority === "high";

      return overdue || blocked || dueToday || critical;
    });
    const needsAttention = [...needsAttentionRaw]
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);

    // 2. My Focus (max 25)
    const myFocusRaw = tasksWithMetadata.filter(t => {
      if (t.type === "event") return false;
      const isCompleted = t.status === "done" || t.status === "completed";
      if (isCompleted) return false;

      const isAssigned = t.assignees?.some(a => a.id === user?.id);
      const currentSprint = t.sprint === "current";

      return isAssigned && currentSprint;
    });
    const myFocus = [...myFocusRaw]
      .sort((a, b) => b.score - a.score)
      .slice(0, 25);

    // 3. Current Sprint
    const currentSprintTasks = tasksWithMetadata.filter(t => t.type !== "event" && t.sprint === "current");
    const currentSprintGrouped = {
      todo: [...currentSprintTasks.filter(t => t.status === "todo" || t.status === "backlog")].sort((a, b) => b.score - a.score),
      inProgress: [...currentSprintTasks.filter(t => t.status === "in-progress")].sort((a, b) => b.score - a.score),
      review: [...currentSprintTasks.filter(t => t.status === "in-review")].sort((a, b) => b.score - a.score),
      done: [...currentSprintTasks.filter(t => t.status === "done" || t.status === "completed")].sort((a, b) => b.score - a.score),
    };

    // 4. Upcoming Work
    const upcomingTasks = tasksWithMetadata.filter(t => {
      if (t.type === "event") return false;
      const isCompleted = t.status === "done" || t.status === "completed";
      if (isCompleted) return false;
      if (!t.due_date) return false;

      const due = startOfDay(new Date(t.due_date));
      return isAfter(due, subDays(today, 1)) && isBefore(due, addDays(sevenDaysOut, 1));
    });

    const upcomingGrouped = {
      today: [...upcomingTasks.filter(t => t.due_date && isSameDay(new Date(t.due_date), today))].sort((a, b) => b.score - a.score),
      tomorrow: [...upcomingTasks.filter(t => t.due_date && isSameDay(new Date(t.due_date), tomorrow))].sort((a, b) => b.score - a.score),
      thisWeek: [...upcomingTasks.filter(t => {
        if (!t.due_date) return false;
        const due = startOfDay(new Date(t.due_date));
        return isAfter(due, tomorrow) && isBefore(due, addDays(sevenDaysOut, 1));
      })].sort((a, b) => b.score - a.score),
    };

    // 5. Events
    const allEvents = filteredTasks.filter(t => t.type === "event");
    const eventsGrouped = {
      today: allEvents.filter(t => t.start_date && isSameDay(new Date(t.start_date), today)),
      tomorrow: allEvents.filter(t => t.start_date && isSameDay(new Date(t.start_date), tomorrow)),
      thisWeek: allEvents.filter(t => {
        if (!t.start_date) return false;
        const start = startOfDay(new Date(t.start_date));
        return isAfter(start, tomorrow) && isBefore(start, addDays(sevenDaysOut, 1));
      }),
    };

    // 6. Recently Completed
    const completedTasks = tasksWithMetadata.filter(t => t.type !== "event" && (t.status === "done" || t.status === "completed"));
    const recentlyCompletedGrouped = {
      today: completedTasks.filter(t => t.updated_at && isSameDay(new Date(t.updated_at), today)),
      yesterday: completedTasks.filter(t => t.updated_at && isSameDay(new Date(t.updated_at), yesterday)),
      thisWeek: completedTasks.filter(t => {
        if (!t.updated_at) return false;
        const updated = startOfDay(new Date(t.updated_at));
        return isAfter(updated, startOfCurrentWeek) && !isSameDay(updated, today) && !isSameDay(updated, yesterday);
      }),
    };

    return {
      needsAttention,
      myFocus,
      currentSprint: currentSprintGrouped,
      upcomingWork: upcomingGrouped,
      events: eventsGrouped,
      recentlyCompleted: recentlyCompletedGrouped,
    };
  }, [displayedTasks, filteredTasks, allTasks, tasks, user]);

  // Sprint Capacity widget calculations
  const sprintCapacity = useMemo(() => {
    if (!user) return { hours: 0, percentage: 0, color: "bg-emerald-500" };
    const sourceTasks = allTasks || tasks;
    const userSprintTasks = sourceTasks.filter(t => {
      if (t.type === "event") return false;
      const sprint = getSprintStatus(t.due_date || t.start_date);
      const isAssigned = t.assignees?.some(a => a.id === user.id);
      const isNotDone = t.status !== "done" && t.status !== "completed";
      return sprint === "current" && isAssigned && isNotDone;
    });

    const totalMinutes = userSprintTasks.reduce((acc, t) => acc + (t.time_estimate || 0), 0);
    const hours = Math.round((totalMinutes / 60) * 10) / 10;
    const capacityHours = 80;
    const percentage = Math.min(100, Math.round((hours / capacityHours) * 100));

    let color = "bg-emerald-500";
    if (percentage > 100) {
      color = "bg-rose-500";
    } else if (percentage > 80) {
      color = "bg-amber-500";
    }

    return { hours, percentage, color };
  }, [allTasks, tasks, user]);

  // Active filter chips list
  const activeFilterChips = useMemo(() => {
    const chips: { label: string; onRemove: () => void }[] = [];

    // Status
    filters.statuses.forEach(s => {
      chips.push({
        label: `Status: ${s.charAt(0).toUpperCase() + s.slice(1)}`,
        onRemove: () => setFilters(prev => ({ ...prev, statuses: prev.statuses.filter(x => x !== s) }))
      });
    });

    // Priority
    filters.priorities.forEach(p => {
      chips.push({
        label: `Priority: ${p.charAt(0).toUpperCase() + p.slice(1)}`,
        onRemove: () => setFilters(prev => ({ ...prev, priorities: prev.priorities.filter(x => x !== p) }))
      });
    });

    // Assignment
    filters.assignments.forEach(a => {
      const labels: Record<string, string> = {
        "assigned-to-me": "Assigned to Me",
        "created-by-me": "Created by Me",
        "watching": "Watching",
        "unassigned": "Unassigned"
      };
      chips.push({
        label: labels[a] || a,
        onRemove: () => setFilters(prev => ({ ...prev, assignments: prev.assignments.filter(x => x !== a) }))
      });
    });

    // Sprint
    filters.sprints.forEach(s => {
      const labels: Record<string, string> = {
        current: "Current Sprint",
        next: "Next Sprint",
        backlog: "Backlog Sprint"
      };
      chips.push({
        label: labels[s] || s,
        onRemove: () => setFilters(prev => ({ ...prev, sprints: prev.sprints.filter(x => x !== s) }))
      });
    });

    if (filters.orgId !== "all") {
      const org = organisations.find(o => o.id === filters.orgId);
      chips.push({
        label: org?.name ?? "Workspace",
        onRemove: () => setFilters(prev => ({ ...prev, orgId: "all", spaceId: "all" }))
      });
    }
    if (filters.spaceId !== "all") {
      const sp = orgSpaces.find(s => s.id === filters.spaceId);
      chips.push({
        label: sp?.name ?? "Space",
        onRemove: () => setFilters(prev => ({ ...prev, spaceId: "all" }))
      });
    }

    return chips;
  }, [filters, organisations, orgSpaces]);

  // Toggle subtask expansion
  const toggleExpanded = (e: React.MouseEvent, taskId: string) => {
    e.stopPropagation();
    const next = new Set(expandedTasks);
    if (next.has(taskId)) next.delete(taskId);
    else next.add(taskId);
    setExpandedTasks(next);
  };

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

  // Initialize FullCalendar Draggable
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
          duration: "01:00",
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
    const firstTaskId = Array.from(selectedTaskIds)[0];
    const firstTask = tasks.find((t) => t.id === firstTaskId);
    if (firstTask?.assignees && onRemoveAssignee) {
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

  const renderTaskRow = (t: TaskDTO, isSubtask = false) => {
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
            "flex items-center justify-between gap-2 px-2 py-1 rounded-md transition-colors cursor-pointer group w-full min-w-0",
            active && !isMultiSelecting
              ? "bg-[#EEF2FF] dark:bg-[#1E1B4B]"
              : "hover:bg-[#F4F4F5] dark:hover:bg-[#18181B]",
            isDone && "opacity-50",
            isDraggable && "draggable-task-card cursor-grab active:cursor-grabbing",
            isSubtask && "pl-5"
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

            {/* Icon/Dot — click opens popover or expands on hover */}
            <div className="size-4 flex items-center justify-center relative shrink-0">
              {/* Status/Event icon — visible by default, hidden on hover */}
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    onClick={(e) => e.stopPropagation()}
                    className="shrink-0 transition-transform hover:scale-110 group-hover/item:opacity-0 transition-opacity flex items-center justify-center"
                  >
                    {t.type === "event" ? (
                      <CalendarClock className="size-3.5 shrink-0 text-muted-foreground" />
                    ) : (
                      <StatusIcon
                        status={t.status}
                        type="task"
                        className="size-3.5 shrink-0"
                      />
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
                        <StatusIcon
                          status={s}
                          type={t.type === "event" ? "event" : "task"}
                          className="size-3.5 shrink-0"
                        />
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
                  <ChevronDown className="size-3" />
                ) : (
                  <ChevronRight className="size-3" />
                )}
              </button>
            </div>

            <div className="task-name-container flex flex-col items-start gap-0.5">
              <span className={cn(
                "task-name-scroll text-xs font-medium leading-snug",
                isDone && "line-through opacity-60"
              )} title={t.title}>
                {t.title}
              </span>
            </div>
          </div>

          {/* Right block: Badge and Date */}
          <div className="flex items-center gap-1.5 shrink-0 text-[10px] text-muted-foreground justify-end relative ml-auto min-w-fit">
            {/* Badges & Icons */}
            <div className="flex items-center gap-1">
              {isBlocked && (
                <Zap className="size-2.5 text-yellow-400 shrink-0" />
              )}
            </div>

            {/* Date / Action Menu */}
            <div className="relative flex items-center justify-end min-w-fit ml-1">
              <span className={cn(
                "tabular-nums transition-opacity group-hover/item:opacity-0 text-right leading-tight",
                isDone && "opacity-40"
              )}>
                {formatTaskDateRange(t.start_date, t.due_date, t.is_all_day)}
              </span>

              <div className="absolute right-0 opacity-0 group-hover/item:opacity-100 transition-opacity">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="size-5 p-0 hover:bg-muted-foreground/10"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MoreHorizontal className="size-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onSelectTask(t.id)}>
                      View Details
                    </DropdownMenuItem>
                    {itemCanEdit && (
                      <DropdownMenuItem onClick={() => setEditingTask(t)}>
                        <Pencil className="size-3 mr-2" />
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
                        <Trash2 className="size-3 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>
        </div>

        {/* Expanded subtasks dropdown — only rendered when expanded and NOT in filtered flat view */}
        {!isFiltered && expandedTasks.has(t.id) && (
          <SubtaskList
            parentTaskId={t.id}
            selectedTaskId={selectedTaskId}
            onSelectTask={onSelectTask}
            onUpdateTask={onUpdateTask}
          />
        )}
      </div>
    );
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
                  onClick={() => setFilters(prev => ({ ...prev, assignments: prev.assignments.filter(x => x !== "assigned-to-me") }))}
                  className={cn(
                    "px-3 py-1 text-xs font-medium rounded-md transition-all",
                    !filters.assignments.includes("assigned-to-me") ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  All
                </button>
                <button
                  onClick={() => setFilters(prev => ({ ...prev, assignments: Array.from(new Set([...prev.assignments, "assigned-to-me"])) }))}
                  className={cn(
                    "px-3 py-1 text-xs font-medium rounded-md transition-all",
                    filters.assignments.includes("assigned-to-me") ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
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

                    {/* Status */}
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger className="text-xs gap-2">
                        Status
                        {filters.statuses.length > 0 && (
                          <span className="ml-auto text-[10px] text-primary font-medium">{filters.statuses.length} selected</span>
                        )}
                      </DropdownMenuSubTrigger>
                      <DropdownMenuSubContent className="w-40 rounded-xl">
                        {TASK_STATUS_OPTIONS.map(s => (
                          <DropdownMenuItem key={s} className="text-xs capitalize gap-2"
                            onClick={(e) => { e.preventDefault(); toggleFilter("statuses", s); }}>
                            {filters.statuses.includes(s) ? <Check className="size-3 text-primary shrink-0" /> : <div className="size-3 shrink-0" />}
                            {s}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>

                    {/* Priority */}
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger className="text-xs gap-2">
                        <Flag className="size-3.5 text-muted-foreground shrink-0" />
                        Priority
                        {filters.priorities.length > 0 && (
                          <span className="ml-auto text-[10px] text-primary font-medium">{filters.priorities.length} selected</span>
                        )}
                      </DropdownMenuSubTrigger>
                      <DropdownMenuSubContent className="w-40 rounded-xl">
                        {(["urgent", "high", "medium", "low"] as TaskPriority[]).map(p => (
                          <DropdownMenuItem key={p} className="text-xs capitalize gap-2"
                            onClick={(e) => { e.preventDefault(); toggleFilter("priorities", p); }}>
                            {filters.priorities.includes(p) ? <Check className="size-3 text-primary shrink-0" /> : <div className="size-3 shrink-0" />}
                            {p}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>

                    {/* Assignment */}
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger className="text-xs gap-2">
                        <User className="size-3.5 text-muted-foreground shrink-0" />
                        Assignment
                        {filters.assignments.length > 0 && (
                          <span className="ml-auto text-[10px] text-primary font-medium">{filters.assignments.length} selected</span>
                        )}
                      </DropdownMenuSubTrigger>
                      <DropdownMenuSubContent className="w-44 rounded-xl">
                        {([
                          { id: "assigned-to-me", label: "Assigned to Me" },
                          { id: "created-by-me", label: "Created by Me" },
                          { id: "watching", label: "Watching" },
                          { id: "unassigned", label: "Unassigned" },
                        ]).map(a => (
                          <DropdownMenuItem key={a.id} className="text-xs gap-2"
                            onClick={(e) => { e.preventDefault(); toggleFilter("assignments", a.id); }}>
                            {filters.assignments.includes(a.id) ? <Check className="size-3 text-primary shrink-0" /> : <div className="size-3 shrink-0" />}
                            {a.label}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>

                    {/* Sprint */}
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger className="text-xs gap-2">
                        <Rocket className="size-3.5 text-muted-foreground shrink-0" />
                        Sprint
                        {filters.sprints.length > 0 && (
                          <span className="ml-auto text-[10px] text-primary font-medium">{filters.sprints.length} selected</span>
                        )}
                      </DropdownMenuSubTrigger>
                      <DropdownMenuSubContent className="w-44 rounded-xl">
                        {([
                          { id: "current", label: "Current Sprint" },
                          { id: "next", label: "Next Sprint" },
                          { id: "backlog", label: "Backlog" },
                        ]).map(s => (
                          <DropdownMenuItem key={s.id} className="text-xs gap-2"
                            onClick={(e) => { e.preventDefault(); toggleFilter("sprints", s.id); }}>
                            {filters.sprints.includes(s.id) ? <Check className="size-3 text-primary shrink-0" /> : <div className="size-3 shrink-0" />}
                            {s.label}
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
                          {filters.orgId !== "all" && (
                            <span className="ml-auto text-[10px] text-primary font-medium truncate max-w-[50px]">
                              {organisations.find(o => o.id === filters.orgId)?.name ?? ""}
                            </span>
                          )}
                        </DropdownMenuSubTrigger>
                        <DropdownMenuSubContent className="w-48 rounded-xl">
                          <DropdownMenuItem className="text-xs gap-2"
                            onClick={() => setFilters(prev => ({ ...prev, orgId: "all", spaceId: "all" }))}>
                            {filters.orgId === "all" ? <Check className="size-3 text-primary shrink-0" /> : <div className="size-3 shrink-0" />}
                            All workspaces
                          </DropdownMenuItem>
                          {organisations.map(org => (
                            <DropdownMenuItem key={org.id} className="text-xs gap-2"
                              onClick={() => setFilters(prev => ({ ...prev, orgId: org.id, spaceId: "all" }))}>
                              {filters.orgId === org.id ? <Check className="size-3 text-primary shrink-0" /> : <div className="size-3 shrink-0" />}
                              <span className="truncate">{org.name}{org.is_personal ? " (Personal)" : ""}</span>
                            </DropdownMenuItem>
                          ))}
                          {filters.orgId !== "all" && orgSpaces.length > 0 && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-xs gap-2"
                                onClick={() => setFilters(prev => ({ ...prev, spaceId: "all" }))}>
                                {filters.spaceId === "all" ? <Check className="size-3 text-primary shrink-0" /> : <div className="size-3 shrink-0" />}
                                All spaces
                              </DropdownMenuItem>
                              {orgSpaces.map(sp => (
                                <DropdownMenuItem key={sp.id} className="text-xs gap-2"
                                  onClick={() => setFilters(prev => ({ ...prev, spaceId: sp.id }))}>
                                  {filters.spaceId === sp.id ? <Check className="size-3 text-primary shrink-0" /> : <div className="size-3 shrink-0" />}
                                  <span className="truncate">{sp.name}</span>
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
                            setFilters({
                              statuses: [],
                              priorities: [],
                              assignments: [],
                              sprints: [],
                              orgId: "all",
                              spaceId: "all",
                            });
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

                {onCollapse && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="size-7 p-0 rounded-md"
                    onClick={onCollapse}
                    title="Close sidebar"
                  >
                    <PanelLeftClose className="size-3.5 text-muted-foreground" />
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
                setFilters({
                  statuses: [],
                  priorities: [],
                  assignments: [],
                  sprints: [],
                  orgId: "all",
                  spaceId: "all",
                });
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
        <div ref={containerRef} className="px-2 py-2 space-y-1 pb-20">

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

          {/* 1. Needs Attention */}
          {!isLoading && visibleSections.includes("needsAttention") && (
            <>
              <SectionHeader
                title="Needs Attention"
                isCollapsed={collapsedSections.needsAttention}
                onToggle={() => toggleSectionCollapse("needsAttention")}
                onCreateClick={canCreateTask ? () => onCreateDialogOpenChange(true) : undefined}
              />
              {!collapsedSections.needsAttention && (
                <div className="flex flex-col gap-px">
                  {sections.needsAttention.map(t => renderTaskRow(t))}
                  {sections.needsAttention.length === 0 && (
                    <div className="h-7 pl-6 text-xs font-medium italic leading-7 text-muted-foreground/50 select-none">No urgent tasks</div>
                  )}
                </div>
              )}
            </>
          )}

          {/* 2. My Focus */}
          {!isLoading && visibleSections.includes("myFocus") && (
            <>
              <SectionHeader
                title="My Focus"
                isCollapsed={collapsedSections.myFocus}
                onToggle={() => toggleSectionCollapse("myFocus")}
                onCreateClick={canCreateTask ? () => onCreateDialogOpenChange(true) : undefined}
              />
              {!collapsedSections.myFocus && (
                <div className="flex flex-col gap-px">
                  {sections.myFocus.map(t => renderTaskRow(t))}
                  {sections.myFocus.length === 0 && (
                    <div className="h-7 pl-6 text-xs font-medium italic leading-7 text-muted-foreground/50 select-none">No focus tasks</div>
                  )}
                </div>
              )}
            </>
          )}

          {/* 3. Current Sprint */}
          {!isLoading && visibleSections.includes("currentSprint") && (
            <>
              <SectionHeader
                title="Current Sprint"
                isCollapsed={collapsedSections.currentSprint}
                onToggle={() => toggleSectionCollapse("currentSprint")}
                extraWidget={<SprintCapacityWidget {...sprintCapacity} />}
                onCreateClick={canCreateTask ? () => onCreateDialogOpenChange(true) : undefined}
              />
              {!collapsedSections.currentSprint && (
                <div className="flex flex-col gap-2">
                  {([
                    { id: "todo", label: "Todo", tasks: sections.currentSprint.todo },
                    { id: "inProgress", label: "In Progress", tasks: sections.currentSprint.inProgress },
                    { id: "review", label: "Review", tasks: sections.currentSprint.review },
                    { id: "done", label: "Done", tasks: sections.currentSprint.done },
                  ]).map(group => {
                    const groupKey = `sprint-${group.id}`;
                    const isCollapsed = collapsedSubFilters[groupKey] !== undefined
                      ? collapsedSubFilters[groupKey]
                      : group.tasks.length === 0;
                    return (
                      <div key={group.id} className="space-y-px">
                        <button
                          type="button"
                          onClick={() => toggleSubFilter(groupKey)}
                          className="flex items-center gap-1 px-3 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors"
                        >
                          <ChevronDown className={cn("size-2.5 text-muted-foreground/60 transition-transform duration-200", isCollapsed && "-rotate-90")} />
                          <span>{group.label}</span>
                          <span className="text-muted-foreground/50 font-bold ml-1">({group.tasks.length})</span>
                        </button>
                        {!isCollapsed && (
                          <div className="flex flex-col gap-px">
                            {group.tasks.map(t => renderTaskRow(t))}
                            {group.tasks.length === 0 && (
                              <div className="h-7 pl-3 text-[11px] font-medium italic leading-7 text-muted-foreground/45 select-none font-medium">Empty</div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {/* 4. Upcoming Work */}
          {!isLoading && visibleSections.includes("upcomingWork") && (
            <>
              <SectionHeader
                title="Upcoming Work"
                isCollapsed={collapsedSections.upcomingWork}
                onToggle={() => toggleSectionCollapse("upcomingWork")}
                onCreateClick={canCreateTask ? () => onCreateDialogOpenChange(true) : undefined}
              />
              {!collapsedSections.upcomingWork && (
                <div className="flex flex-col gap-2">
                  {([
                    { id: "today", label: "Today", tasks: sections.upcomingWork.today },
                    { id: "tomorrow", label: "Tomorrow", tasks: sections.upcomingWork.tomorrow },
                    { id: "thisWeek", label: "This Week", tasks: sections.upcomingWork.thisWeek },
                  ]).map(group => {
                    const groupKey = `upcoming-${group.id}`;
                    const isCollapsed = collapsedSubFilters[groupKey] !== undefined
                      ? collapsedSubFilters[groupKey]
                      : group.tasks.length === 0;
                    return (
                      <div key={group.id} className="space-y-px">
                        <button
                          type="button"
                          onClick={() => toggleSubFilter(groupKey)}
                          className="flex items-center gap-1 px-3 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors"
                        >
                          <ChevronDown className={cn("size-2.5 text-muted-foreground/60 transition-transform duration-200", isCollapsed && "-rotate-90")} />
                          <span>{group.label}</span>
                          <span className="text-muted-foreground/50 font-bold ml-1">({group.tasks.length})</span>
                        </button>
                        {!isCollapsed && (
                          <div className="flex flex-col gap-px">
                            {group.tasks.map(t => renderTaskRow(t))}
                            {group.tasks.length === 0 && (
                              <div className="h-7 pl-3 text-[11px] font-medium italic leading-7 text-muted-foreground/45 select-none font-medium">Empty</div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {/* 6. Recently Completed */}
          {!isLoading && visibleSections.includes("recentlyCompleted") && (
            <>
              <SectionHeader
                title="Recently Completed"
                isCollapsed={collapsedSections.recentlyCompleted}
                onToggle={() => toggleSectionCollapse("recentlyCompleted")}
              />
              {!collapsedSections.recentlyCompleted && (
                <div className="flex flex-col gap-2">
                  {([
                    { id: "today", label: "Today", tasks: sections.recentlyCompleted.today },
                    { id: "yesterday", label: "Yesterday", tasks: sections.recentlyCompleted.yesterday },
                    { id: "thisWeek", label: "This Week", tasks: sections.recentlyCompleted.thisWeek },
                  ]).map(group => {
                    const groupKey = `completed-${group.id}`;
                    const isCollapsed = collapsedSubFilters[groupKey] !== undefined
                      ? collapsedSubFilters[groupKey]
                      : group.tasks.length === 0;
                    return (
                      <div key={group.id} className="space-y-px">
                        <button
                          type="button"
                          onClick={() => toggleSubFilter(groupKey)}
                          className="flex items-center gap-1 px-3 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors"
                        >
                          <ChevronDown className={cn("size-2.5 text-muted-foreground/60 transition-transform duration-200", isCollapsed && "-rotate-90")} />
                          <span>{group.label}</span>
                          <span className="text-muted-foreground/50 font-bold ml-1">({group.tasks.length})</span>
                        </button>
                        {!isCollapsed && (
                          <div className="flex flex-col gap-px">
                            {group.tasks.map(t => renderTaskRow(t))}
                            {group.tasks.length === 0 && (
                              <div className="h-7 pl-3 text-[11px] font-medium italic leading-7 text-muted-foreground/45 select-none font-medium">Empty</div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {/* Load more button */}
          {!isLoading && hasMore && filteredTasks.length > 0 && (
            <div className="flex justify-center py-3">
              <Button
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
                          <StatusIcon
                            status={s}
                            type="task"
                            className="size-3 shrink-0"
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
                          <StatusIcon
                            status={s}
                            type="event"
                            className="size-3 shrink-0"
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