
import { useCallback, useMemo, useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { useSidebar } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { TaskListPane } from "@/components/tasks/TaskListPane";
import { TaskDetailPane } from "@/components/tasks/TaskDetailPane";
import { EventDetailPane } from "@/components/tasks/EventDetailPane";
import { TaskSchedulePane } from "@/components/tasks/TaskSchedulePane";
import { useAuth } from "@/contexts/AuthContext";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useAppContext } from "@/contexts/AppContext";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { integrationKeys } from "@/hooks/api/useGoogleCalendar";

import type { AnyStatus } from "../types/task";
import {
  useOrgTasks,
  useOrgTask,
  useLocateTask,
  useUpdateOrgTask,
  useDeleteOrgTask,
  useAssignOrgUser,
  useRemoveOrgAssignee,
  type TaskFilters,
  type SortBy,
  type SortOrder,
  type TaskDTO,
} from "../hooks/api/useTasks";
import { useSpaceMembers } from "../hooks/api/useSpaces";
import {
  usePersonalTasks,
  useUpdatePersonalTask,
  useDeletePersonalTask,
  type PersonalTaskDTO,
} from "../hooks/api/usePersonalTasks";

const PAGE_SIZE = 20;
const EMPTY_BLOCKS: any[] = [];
const EMPTY_TASKS: TaskDTO[] = [];
const INITIAL_LIMIT = 10000; // Load all tasks within current month without pagination

export function TasksPage() {
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";
  const { user } = useAuth();

  // ── Read ?taskId from URL (e.g. navigated from a task preview dialog) ──
  const [searchParams, setSearchParams] = useSearchParams();

  // ── Filter / search / sort state ──
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [calendarMonth, setCalendarMonth] = useState<Date>(new Date());
  const [sortBy, setSortBy] = useState<SortBy>("due_date");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");
  const { taskId: urlTaskId, eventId: urlEventId } = useParams<{ taskId?: string, eventId?: string }>();
  const navigate = useNavigate();
  const selectedTaskId = urlTaskId ?? urlEventId ?? "";
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  // ── Subtask navigation stack ──
  // Tracks the parent task when user navigates into a subtask
  const [parentTaskStack, setParentTaskStack] = useState<Array<{ id: string; title: string }>>([]);

  // When ?taskId appears in the URL (including when already on this page),
  // select that task and immediately clean the param so the URL stays tidy.
  useEffect(() => {
    const taskIdFromUrl = searchParams.get("taskId");
    if (taskIdFromUrl) {
      navigate(`/tasks/${taskIdFromUrl}`);
      setParentTaskStack([]);
      setSearchParams({}, { replace: true });
    }
    // searchParams identity changes on every navigation — this is intentional
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Handle Google Calendar OAuth redirect back (?gcal=connected or ?gcal=error)
  // Runs once on mount — cleans the param immediately after showing the toast
  const queryClient = useQueryClient();
  useEffect(() => {
    const gcal = searchParams.get("gcal");
    if (gcal === "connected") {
      toast.success("Google Calendar connected successfully");
      // Invalidate status so the Connectors tab reflects the new state
      queryClient.invalidateQueries({ queryKey: integrationKeys.googleStatus });
      setSearchParams({}, { replace: true });
    } else if (gcal === "error") {
      toast.error("Failed to connect Google Calendar. Please try again.");
      setSearchParams({}, { replace: true });
    }
    // Run once on mount only — intentionally omitting deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Pagination: just increase the limit to fetch more ──
  const [limit, setLimit] = useState(INITIAL_LIMIT);

  // ── Build server-side filter params ──
  const serverFilters = useMemo((): TaskFilters => {
    const filters: TaskFilters = { limit, sort_by: sortBy, sort_order: sortOrder };

    // Map UI filter chips to API params
    if (statusFilter === "Mine" && user?.id) {
      filters.assignee_id = user.id;
    } else if (
      statusFilter === "in-progress" ||
      statusFilter === "todo" ||
      statusFilter === "backlog" ||
      statusFilter === "done" ||
      statusFilter === "confirmed" ||
      statusFilter === "tentative" ||
      statusFilter === "cancelled" ||
      statusFilter === "completed"
    ) {
      filters.status = statusFilter as AnyStatus;
    } else if (statusFilter === "Highest Priority") {
      // Handled client-side to show both high and urgent
    }
    return filters;
  }, [statusFilter, sortBy, sortOrder, limit, user?.id]);

  // ── App mode ──────────────────────────────────────────
  const { mode, activeOrgId, activeSpaceId, setActiveOrganisation } = useAppContext();
  const isPersonalMode = mode === "personal";

  // ── Org tasks (org/space-scoped route) ──
  const { data: orgTasks, isLoading: orgLoading, isFetching: orgFetching } = useOrgTasks(
    isPersonalMode ? null : activeOrgId,
    isPersonalMode ? null : activeSpaceId,
    isPersonalMode ? {} : serverFilters
  );

  // ── Personal tasks (active in personal mode) ────────────────────
  const { data: personalTasksRaw, isLoading: personalLoading } = usePersonalTasks(
    isPersonalMode
      ? {
        status: (serverFilters.status as any) ?? undefined,
        priority: (serverFilters.priority as any) ?? undefined,
        limit: serverFilters.limit,
      }
      : {}
  );

  // Shape PersonalTaskDTO into the same TaskDTO interface the list/detail panes expect.
  const personalTasks: TaskDTO[] = useMemo(() => {
    if (!isPersonalMode || !personalTasksRaw) return [];
    return personalTasksRaw.map((pt: PersonalTaskDTO): TaskDTO => ({
      id: pt.id,
      title: pt.title,
      type: "task",
      description: pt.description ?? undefined,
      objective: pt.objective ?? undefined,
      success_criteria: pt.success_criteria ?? undefined,
      status: pt.status,       // already TaskStatus — no cast needed
      priority: pt.priority,   // already TaskPriority — no cast needed
      due_date: pt.due_date ?? undefined,
      start_date: pt.start_date ?? undefined,
      parent_task_id: pt.parent_task_id ?? undefined,
      workspace_id: "",        // personal tasks have no workspace
      created_by: pt.owner_user_id,
      created_at: pt.created_at,
      updated_at: pt.updated_at,
    }));
  }, [isPersonalMode, personalTasksRaw]);

  // Active task list and loading state depend on mode
  const tasks = isPersonalMode ? personalTasks : (orgTasks ?? EMPTY_TASKS);
  const isLoading = isPersonalMode ? personalLoading : orgLoading;
  const isFetching = isPersonalMode ? false : orgFetching;

  // Stable reference — never creates a new [] on each render
  const taskList = tasks;

  // Derive pagination state from the result (no useEffect needed)
  const hasMore = !isPersonalMode && taskList.length >= limit;

  const handleLoadMore = useCallback(() => {
    setLimit((prev) => prev + PAGE_SIZE);
  }, []);

  // Reset limit when filter or sort changes
  const handleStatusFilterChange = useCallback((value: string) => {
    setStatusFilter(value);
    setLimit(INITIAL_LIMIT);
  }, []);

  const handleSortChange = useCallback((by: SortBy, order: SortOrder) => {
    setSortBy(by);
    setSortOrder(order);
    setLimit(INITIAL_LIMIT);
  }, []);

  // ── Org task mutations ─────────────────────────────────────────
  const updateOrgTask = useUpdateOrgTask(activeOrgId, activeSpaceId);
  const deleteOrgTask = useDeleteOrgTask(activeOrgId, activeSpaceId);
  const assignUser = useAssignOrgUser(activeOrgId, activeSpaceId);
  const removeAssignee = useRemoveOrgAssignee(activeOrgId, activeSpaceId);

  // Personal task mutations
  const updatePersonalTask = useUpdatePersonalTask();
  const deletePersonalTask = useDeletePersonalTask();

  // Unified mutation helpers that dispatch to the correct endpoint
  const handleUpdateTask = useCallback((id: string, updates: any) => {
    if (isPersonalMode) {
      updatePersonalTask.mutate({ id, updates });
    } else {
      updateOrgTask.mutate({ id, updates });
    }
  }, [isPersonalMode, updatePersonalTask, updateOrgTask]);

  const handleDeleteTask = useCallback((id: string) => {
    const taskToDelete = taskList.find(t => t.id === id);
    if (!taskToDelete) return;

    if (isPersonalMode) {
      deletePersonalTask.mutate({ id, title: taskToDelete.title });
    } else {
      deleteOrgTask.mutate({ id, title: taskToDelete.title, type: taskToDelete.type });
    }
    if (id === selectedTaskId) navigate("/tasks");
  }, [isPersonalMode, deletePersonalTask, deleteOrgTask, selectedTaskId, taskList, navigate]);

  // ── Space members for assignee picker (org mode only) ─────────────
  // In personal mode, assignees don't exist — pass null so the hook is disabled.
  const { data: spaceMembers = [] } = useSpaceMembers(
    isPersonalMode ? null : activeOrgId,
    isPersonalMode ? null : activeSpaceId
  );
  const workspaceMembers = spaceMembers.map((m) => ({
    id: m.user_id,
    name: m.name,
    email: m.email,
  }));

  // ── Client-side text filter on top of server results ──
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = taskList.filter((t) => {
      // "Blocked" is a derived filter — not sent to backend
      if (statusFilter === "Blocked") {
        const isBlocked = ((t as any).blocked_by_count || (t.dependencies?.length || 0)) > 0;
        if (!isBlocked) return false;
      }

      if (statusFilter === "Highest Priority" && t.priority !== "high" && t.priority !== "urgent") return false;

      // Type filters (client-side only)
      if (statusFilter === "Task" && t.type !== "task") return false;
      if (statusFilter === "Event" && t.type !== "event") return false;

      // Filter by currently viewed calendar month
      if (!t.start_date && !t.due_date) {
        // No due date tasks always appear
      } else {
        let tStart = t.start_date ? new Date(t.start_date) : null;
        let tEnd = t.due_date ? new Date(t.due_date) : null;

        if (!tStart && tEnd) tStart = tEnd;
        if (!tEnd && tStart) tEnd = tStart;

        if (tStart && tEnd) {
          const monthStart = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1);
          const monthEnd = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0, 23, 59, 59, 999);

          if (tStart > monthEnd || tEnd < monthStart) {
            return false;
          }
        }
      }

      if (!q) return true;
      return (
        t.title.toLowerCase().includes(q) ||
        (t.objective && t.objective.toLowerCase().includes(q))
      );
    });

    // Client-side sort implementation
    return [...list].sort((a, b) => {
      // 1. Completion status - always at bottom
      const isDoneA = a.status === "done" || a.status === "completed";
      const isDoneB = b.status === "done" || b.status === "completed";
      if (isDoneA !== isDoneB) return isDoneA ? 1 : -1;

      // 2. Main sort field
      if (sortBy === "due_date") {
        const dateA = a.due_date ? new Date(a.due_date).getTime() : Infinity;
        const dateB = b.due_date ? new Date(b.due_date).getTime() : Infinity;

        if (dateA !== dateB) {
          return sortOrder === "asc" ? dateA - dateB : dateB - dateA;
        }
      } else if (sortBy === "created_at") {
        const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
        if (dateA !== dateB) {
          return sortOrder === "asc" ? dateA - dateB : dateB - dateA;
        }
      } else if (sortBy === "priority") {
        const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
        const pA = a.priority ? priorityOrder[a.priority] ?? 4 : 4;
        const pB = b.priority ? priorityOrder[b.priority] ?? 4 : 4;
        if (pA !== pB) {
          return sortOrder === "asc" ? pA - pB : pB - pA;
        }
      }

      // 3. Priority Tiebreaker (only for due_date or created_at)
      if (sortBy !== "priority") {
        const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
        const pA = a.priority ? priorityOrder[a.priority] ?? 4 : 4;
        const pB = b.priority ? priorityOrder[b.priority] ?? 4 : 4;
        if (pA !== pB) return pA - pB;
      }

      return 0;
    });
  }, [query, taskList, statusFilter, sortBy, sortOrder, calendarMonth]);

  // ── Selected task ──
  const selected = useMemo(
    () => filtered.find((t) => t.id === selectedTaskId) ?? null,
    [selectedTaskId, filtered]
  );

  // Fetch full task data for the selected task (handles subtask detail too)
  const {
    data: selectedTaskDetail,
    isLoading: isOrgTaskLoading,
    isError: isOrgTaskError
  } = useOrgTask(
    isPersonalMode ? null : activeOrgId,
    isPersonalMode ? null : activeSpaceId,
    selectedTaskId
  );

  const isSelectedTaskLoading = isPersonalMode ? false : isOrgTaskLoading;
  const isSelectedTaskError = isPersonalMode ? false : isOrgTaskError;

  // ── Cross-workspace auto-switch ───────────────────────────────────────────────
  // When the task is not found in the current workspace and the current workspace
  // query has finished (not just loading), try to locate the task across all orgs
  // the user belongs to. If found, silently switch to that workspace.
  const needsLocate =
    !isPersonalMode &&
    !!selectedTaskId &&
    !isOrgTaskLoading &&
    (isOrgTaskError || !selectedTaskDetail) &&
    !selected; // not in the current filtered list either

  const {
    data: locatedTask,
    isLoading: isLocating,
    isError: locateFailed,
  } = useLocateTask(selectedTaskId, needsLocate);

  // When the locator returns a result, switch to that org+space immediately.
  useEffect(() => {
    if (!locatedTask) return;
    const { orgId, spaceId } = locatedTask;
    // Don't switch if we're already in the correct org+space
    if (orgId === activeOrgId && spaceId === activeSpaceId) return;
    setActiveOrganisation(orgId, spaceId);
  }, [locatedTask, activeOrgId, activeSpaceId, setActiveOrganisation]);

  // Aggregate loading: also show spinner while the cross-workspace lookup is running
  const isAnyTaskLoading = isSelectedTaskLoading || (needsLocate && isLocating);
  // Only show "not found" after both the primary fetch AND the locate lookup have settled
  const isDefinitelyNotFound = !isAnyTaskLoading && (isSelectedTaskError || !selectedTaskDetail) && !selected && (locateFailed || !needsLocate);

  // The parentTask for breadcrumb (top of the navigation stack)
  const parentTask = parentTaskStack.length > 0
    ? parentTaskStack[parentTaskStack.length - 1]
    : null;

  // Navigate into a subtask (push current task onto parent stack)
  const handleNavigateToSubtask = useCallback((subtaskId: string) => {
    const currentTask = selectedTaskDetail || selected;
    if (currentTask) {
      setParentTaskStack((prev) => [...prev, { id: currentTask.id, title: currentTask.title }]);
    }
    const subtask = taskList.find(t => t.id === subtaskId);
    const routeBase = subtask?.type === "event" ? "events" : "tasks";
    navigate(`/${routeBase}/${subtaskId}`);
  }, [selected, selectedTaskDetail, navigate, taskList]);

  // Navigate back to parent task (pop the stack)
  const handleNavigateToParent = useCallback((parentId: string) => {
    setParentTaskStack((prev) => prev.slice(0, -1));
    const parentTask = taskList.find(t => t.id === parentId);
    const routeBase = parentTask?.type === "event" ? "events" : "tasks";
    navigate(`/${routeBase}/${parentId}`);
  }, [navigate, taskList]);

  // Handle task scheduling from calendar
  const handleTaskSchedule = useCallback((taskId: string, startISO: string, endISO: string, isAllDay: boolean) => {
    if (isPersonalMode) {
      // Personal tasks have no is_all_day column — only update the dates
      handleUpdateTask(taskId, { start_date: startISO, due_date: endISO });
    } else {
      handleUpdateTask(taskId, { start_date: startISO, due_date: endISO, is_all_day: isAllDay });
    }
  }, [isPersonalMode, handleUpdateTask]);

  const containerClassName = cn(
    "h-full w-full transition-all duration-500 ease-in-out",
    isCollapsed ? "" : ""
  );

  return (
    <div className="h-dvh w-full bg-background text-foreground overflow-hidden overscroll-none">
      <main className={containerClassName}>
        <div className="flex h-full w-full">
          <div className="w-[300px] shrink-0 bg-card border-r border-border h-full">
            <TaskListPane
              query={query}
              onQueryChange={setQuery}
              statusFilter={statusFilter}
              onStatusFilterChange={handleStatusFilterChange}
              sortBy={sortBy}
              sortOrder={sortOrder}
              onSortChange={handleSortChange}
              tasks={filtered}
              allTasks={taskList}
              isPersonalMode={isPersonalMode}
              selectedTaskId={selectedTaskId}
              onSelectTask={(id) => {
                // When selecting from list, check if it's a subtask to set the parent stack
                const selectedTask = taskList.find(t => t.id === id);
                if (selectedTask?.parent_task_id) {
                  const parent = taskList.find(t => t.id === selectedTask.parent_task_id);
                  if (parent) {
                    setParentTaskStack([{ id: parent.id, title: parent.title }]);
                  } else {
                    setParentTaskStack([]);
                  }
                } else {
                  setParentTaskStack([]);
                }
                const routeBase = selectedTask?.type === "event" ? "events" : "tasks";
                navigate(`/${routeBase}/${id}`);
              }}
              createDialogOpen={createDialogOpen}
              onCreateDialogOpenChange={setCreateDialogOpen}
              isLoading={isLoading}
              onTaskCreated={(newTaskId, taskType) => {
                const routeBase = taskType === "event" ? "events" : "tasks";
                navigate(`/${routeBase}/${newTaskId}`);
                setCreateDialogOpen(false);
              }}
              onUpdateTask={handleUpdateTask}
              onDeleteTask={handleDeleteTask}
              onAssignUser={(taskId, userId) => {
                if (!isPersonalMode) assignUser.mutate({ id: taskId, userId });
              }}
              onRemoveAssignee={(taskId, userId) => {
                if (!isPersonalMode) removeAssignee.mutate({ id: taskId, userId });
              }}
              workspaceMembers={workspaceMembers}
              hasMore={hasMore}
              onLoadMore={handleLoadMore}
              isLoadingMore={isFetching && limit > PAGE_SIZE}
            />
          </div>

          <div className="flex-1 min-w-0 bg-background h-full">
            {selectedTaskId ? (
              isAnyTaskLoading && !selected ? (
                <div className="flex flex-col items-center justify-center py-6 h-full text-muted-foreground gap-2">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span className="text-sm">Loading task...</span>
                </div>
              ) : isDefinitelyNotFound ? (
                <div className="flex flex-col items-center justify-center h-full">
                  <p className="text-lg font-medium text-foreground mb-1">Task not found</p>
                  <p className="text-sm text-muted-foreground mb-4">The task you're looking for doesn't exist or you don't have access.</p>
                  <button
                    onClick={() => { navigate("/tasks"); setParentTaskStack([]); }}
                    className="text-sm font-medium text-primary hover:underline"
                  >
                    Go back to tasks
                  </button>
                </div>
              ) : (selectedTaskDetail || selected)?.type === "event" ? (
                <EventDetailPane
                  event={(selectedTaskDetail || selected)!}
                  onUpdateEvent={handleUpdateTask}
                  onEventDeleted={() => {
                    navigate("/tasks");
                    setParentTaskStack([]);
                  }}
                  onClose={() => {
                    navigate("/tasks");
                    setParentTaskStack([]);
                  }}
                />
              ) : (
                <TaskDetailPane
                  task={(selectedTaskDetail || selected)!}
                  isPersonalMode={isPersonalMode}
                  onUpdateTask={handleUpdateTask}
                  onTaskDeleted={() => {
                    navigate("/tasks");
                    setParentTaskStack([]);
                  }}
                  onClose={() => {
                    navigate("/tasks");
                    setParentTaskStack([]);
                  }}
                  onNavigateToSubtask={handleNavigateToSubtask}
                  onNavigateToParent={handleNavigateToParent}
                  parentTask={parentTask}
                />
              )
            ) : (
              <TaskSchedulePane
                tasks={taskList as any}
                blocks={EMPTY_BLOCKS}
                selectedTask={null as any}
                statusFilter={statusFilter}
                onDateChange={setCalendarMonth}
                onTaskSchedule={handleTaskSchedule}
              />
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
