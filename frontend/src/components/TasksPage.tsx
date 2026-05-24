
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
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { integrationKeys } from "@/hooks/api/useGoogleCalendar";
import api from "@/lib/api";

import type { AnyStatus } from "../types/task";
import {
  useOrgTasks,
  useOrgTask,
  useLocateTask,
  type TaskFilters,
  type SortBy,
  type SortOrder,
  type TaskDTO,
  normalizeTaskDTO,
  orgTaskKeys,
} from "../hooks/api/useTasks";
import { useSpaceMembers } from "../hooks/api/useSpaces";
const PAGE_SIZE = 20;
const EMPTY_BLOCKS: any[] = [];
const EMPTY_TASKS: TaskDTO[] = [];
const INITIAL_LIMIT = 10000; // Load all tasks within current month without pagination

export function TasksPage() {
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";
  const { user } = useAuth();

  // ── App context ────────────────────────────────────────
  const { activeOrgId, activeSpaceId, activeSpace, setActiveOrganisation } = useAppContext();

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
  const [orgFilter, setOrgFilter] = useState<string>("all");
  const [spaceFilter, setSpaceFilter] = useState<string>("all");

  // ── Subtask navigation stack ──
  // Tracks the parent task when user navigates into a subtask
  const [parentTaskStack, setParentTaskStack] = useState<Array<{ id: string; title: string }>>([]);

  // Reset org and space filters when active workspace/space changes
  useEffect(() => {
    setOrgFilter("all");
    setSpaceFilter("all");
  }, [activeOrgId, activeSpaceId]);

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

    if (activeSpace?.is_private) {
      filters.mirror = true;
      if (orgFilter !== "all") {
        filters.org_filter = orgFilter;
      }
      if (spaceFilter !== "all") {
        filters.space_filter = spaceFilter;
      }
    }

    return filters;
  }, [statusFilter, sortBy, sortOrder, limit, user?.id, activeSpace?.is_private, orgFilter, spaceFilter]);

  // ── Org tasks (org/space-scoped route) ──
  const { data: orgTasks, isLoading: orgLoading, isFetching: orgFetching } = useOrgTasks(
    activeOrgId,
    activeSpaceId,
    serverFilters
  );

  // Active task list and loading state
  const taskList = orgTasks ?? EMPTY_TASKS;
  const isLoading = orgLoading;
  const isFetching = orgFetching;

  // Derive pagination state from the result (no useEffect needed)
  const hasMore = taskList.length >= limit;

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


  // ── Space members for assignee picker ─────────────
  const { data: spaceMembers = [] } = useSpaceMembers(
    activeOrgId,
    activeSpaceId
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
    isLoading: isSelectedTaskLoading, 
    isError: isSelectedTaskError 
  } = useOrgTask(
    activeOrgId,
    activeSpaceId,
    selectedTaskId
  );

  // ── Helper to retrieve task's home org and space boundaries ──
  const getTaskCoordinates = useCallback((id: string) => {
    const task = taskList.find(t => t.id === id) || 
                 (selectedTaskDetail?.id === id ? selectedTaskDetail : null) || 
                 (selected?.id === id ? selected : null);
    return {
      orgId: task?.org_id || activeOrgId,
      spaceId: task?.space_id || activeSpaceId,
      title: task?.title || "",
      type: task?.type || "task"
    };
  }, [taskList, selectedTaskDetail, selected, activeOrgId, activeSpaceId]);

  // ── Dynamic Org Task mutations ───────────────────────────────────
  const updateTaskMutation = useMutation<TaskDTO, Error, { id: string; updates: any }>({
    mutationFn: async ({ id, updates }) => {
      const { orgId, spaceId } = getTaskCoordinates(id);
      const res = await api.patch<{ data: TaskDTO }>(
        `v1/orgs/${orgId}/spaces/${spaceId}/tasks/${id}`,
        updates
      );
      return normalizeTaskDTO(res.data.data);
    },
    onSuccess: (data, variables) => {
      const { orgId, spaceId } = getTaskCoordinates(variables.id);
      if (!orgId || !spaceId) return;
      queryClient.invalidateQueries({ queryKey: orgTaskKeys.lists(orgId, spaceId) });
      queryClient.invalidateQueries({
        queryKey: orgTaskKeys.detail(orgId, spaceId, data.id),
      });
      if (orgId !== activeOrgId || spaceId !== activeSpaceId) {
        queryClient.invalidateQueries({ queryKey: orgTaskKeys.lists(activeOrgId!, activeSpaceId!) });
      }
    },
    onError: () => {
      toast.error("Failed to update task. Please try again.");
    },
  });

  const deleteTaskMutation = useMutation<
    void,
    Error,
    { id: string },
    { previousTasksQueries?: [import("@tanstack/react-query").QueryKey, TaskDTO[] | undefined][]; previousDetail?: TaskDTO }
  >({
    onMutate: async ({ id: taskId }) => {
      const { orgId, spaceId } = getTaskCoordinates(taskId);
      if (!orgId || !spaceId) return {};

      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: orgTaskKeys.lists(orgId, spaceId) });
      await queryClient.cancelQueries({ queryKey: orgTaskKeys.detail(orgId, spaceId, taskId) });

      // Snapshot the previous value
      const previousTasksQueries = queryClient.getQueriesData<TaskDTO[]>({
        queryKey: orgTaskKeys.lists(orgId, spaceId)
      });
      const previousDetail = queryClient.getQueryData<TaskDTO>(
        orgTaskKeys.detail(orgId, spaceId, taskId)
      );

      // Optimistically remove from list
      queryClient.setQueriesData<TaskDTO[]>(
        { queryKey: orgTaskKeys.lists(orgId, spaceId) },
        (old) => old ? old.filter((t) => t.id !== taskId) : old
      );

      // Also optimistic remove from active list if different
      if (orgId !== activeOrgId || spaceId !== activeSpaceId) {
        queryClient.setQueriesData<TaskDTO[]>(
          { queryKey: orgTaskKeys.lists(activeOrgId!, activeSpaceId!) },
          (old) => old ? old.filter((t) => t.id !== taskId) : old
        );
      }

      return { previousTasksQueries, previousDetail };
    },
    mutationFn: async ({ id: taskId }) => {
      const { orgId, spaceId, title, type } = getTaskCoordinates(taskId);
      return new Promise((resolve, reject) => {
        let isUndone = false;

        const timerId = setTimeout(async () => {
          if (!isUndone) {
            try {
              await api.delete(`v1/orgs/${orgId}/spaces/${spaceId}/tasks/${taskId}`);
              resolve();
            } catch (err) {
              reject(err);
            }
          }
        }, 3000);

        toast(`${title} (${type}) deleted`, {
          action: {
            label: "Undo",
            onClick: () => {
              isUndone = true;
              clearTimeout(timerId);
              reject(new Error("UNDONE"));
            }
          },
          duration: 3000,
        });
      });
    },
    onSuccess: (_data, { id: taskId }) => {
      const { orgId, spaceId } = getTaskCoordinates(taskId);
      if (!orgId || !spaceId) return;
      queryClient.invalidateQueries({ queryKey: orgTaskKeys.lists(orgId, spaceId) });
      queryClient.removeQueries({
        queryKey: orgTaskKeys.detail(orgId, spaceId, taskId),
      });
      if (orgId !== activeOrgId || spaceId !== activeSpaceId) {
        queryClient.invalidateQueries({ queryKey: orgTaskKeys.lists(activeOrgId!, activeSpaceId!) });
      }
    },
    onError: (err, { id: taskId }, context) => {
      const { orgId, spaceId } = getTaskCoordinates(taskId);
      if (context?.previousTasksQueries) {
        context.previousTasksQueries.forEach(([key, data]) => {
          queryClient.setQueryData(key, data);
        });
      }
      if (context?.previousDetail && orgId && spaceId) {
        queryClient.setQueryData(
          orgTaskKeys.detail(orgId, spaceId, taskId),
          context.previousDetail
        );
      }
      
      if (err.message !== "UNDONE") {
        toast.error("Failed to delete task. Please try again.");
      }
    },
  });

  const assignUserMutation = useMutation<void, Error, { id: string; userId: string }>({
    mutationFn: async ({ id, userId }) => {
      const { orgId, spaceId } = getTaskCoordinates(id);
      await api.post(
        `v1/orgs/${orgId}/spaces/${spaceId}/tasks/${id}/assignees`,
        { user_id: userId }
      );
    },
    onSuccess: (_, { id }) => {
      const { orgId, spaceId } = getTaskCoordinates(id);
      if (!orgId || !spaceId) return;
      queryClient.invalidateQueries({
        queryKey: orgTaskKeys.detail(orgId, spaceId, id),
      });
      queryClient.invalidateQueries({ queryKey: orgTaskKeys.lists(orgId, spaceId) });
      if (orgId !== activeOrgId || spaceId !== activeSpaceId) {
        queryClient.invalidateQueries({ queryKey: orgTaskKeys.lists(activeOrgId!, activeSpaceId!) });
      }
      toast.success("Assignee added");
    },
    onError: () => {
      toast.error("Failed to assign user");
    },
  });

  const removeAssigneeMutation = useMutation<void, Error, { id: string; userId: string }>({
    mutationFn: async ({ id, userId }) => {
      const { orgId, spaceId } = getTaskCoordinates(id);
      await api.delete(
        `v1/orgs/${orgId}/spaces/${spaceId}/tasks/${id}/assignees/${userId}`
      );
    },
    onSuccess: (_, { id }) => {
      const { orgId, spaceId } = getTaskCoordinates(id);
      if (!orgId || !spaceId) return;
      queryClient.invalidateQueries({
        queryKey: orgTaskKeys.detail(orgId, spaceId, id),
      });
      queryClient.invalidateQueries({ queryKey: orgTaskKeys.lists(orgId, spaceId) });
      if (orgId !== activeOrgId || spaceId !== activeSpaceId) {
        queryClient.invalidateQueries({ queryKey: orgTaskKeys.lists(activeOrgId!, activeSpaceId!) });
      }
      toast.success("Assignee removed");
    },
    onError: () => {
      toast.error("Failed to remove assignee");
    },
  });

  // Unified mutation helpers
  const handleUpdateTask = useCallback((id: string, updates: any) => {
    updateTaskMutation.mutate({ id, updates });
  }, [updateTaskMutation]);

  const handleDeleteTask = useCallback((id: string) => {
    deleteTaskMutation.mutate({ id });
    if (id === selectedTaskId) navigate("/tasks");
  }, [deleteTaskMutation, selectedTaskId, navigate]);


  // ── Cross-workspace auto-switch ───────────────────────────────────────────────
  // When the task is not found in the current workspace and the current workspace
  // query has finished (not just loading), try to locate the task across all orgs
  // the user belongs to. If found, silently switch to that workspace.
  const needsLocate =
    !!selectedTaskId &&
    !isSelectedTaskLoading &&
    (isSelectedTaskError || !selectedTaskDetail) &&
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
    handleUpdateTask(taskId, { start_date: startISO, due_date: endISO, is_all_day: isAllDay });
  }, [handleUpdateTask]);

  const containerClassName = cn(
    "size-full transition-all duration-500 ease-in-out",
    isCollapsed ? "" : ""
  );

  return (
    <div className="h-dvh w-full bg-background text-foreground overflow-hidden overscroll-none">
      <main className={containerClassName}>
        <div className="flex size-full">
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
                assignUserMutation.mutate({ id: taskId, userId });
              }}
              onRemoveAssignee={(taskId, userId) => {
                removeAssigneeMutation.mutate({ id: taskId, userId });
              }}
              workspaceMembers={workspaceMembers}
              hasMore={hasMore}
              onLoadMore={handleLoadMore}
              isLoadingMore={isFetching && limit > PAGE_SIZE}
              orgFilter={orgFilter}
              onOrgFilterChange={setOrgFilter}
              spaceFilter={spaceFilter}
              onSpaceFilterChange={setSpaceFilter}
            />
          </div>

          <div className="flex-1 min-w-0 bg-background h-full">
            {selectedTaskId ? (
              isAnyTaskLoading && !selected ? (
                <div className="flex flex-col items-center justify-center py-6 h-full text-muted-foreground gap-2">
                  <Loader2 className="size-5 animate-spin" />
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
