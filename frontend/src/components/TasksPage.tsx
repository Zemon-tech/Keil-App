import { useCallback, useMemo, useState, useEffect } from "react";
import { useSidebar } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { TaskListPane } from "@/components/tasks/TaskListPane";
import { TaskDetailPane } from "@/components/tasks/TaskDetailPane";
import { EventDetailPane } from "@/components/tasks/EventDetailPane";
import { TaskSchedulePane } from "@/components/tasks/TaskSchedulePane";
import { useAuth } from "@/contexts/AuthContext";
import { useSearchParams } from "react-router-dom";
import { useAppContext } from "@/contexts/AppContext";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { integrationKeys } from "@/hooks/api/useGoogleCalendar";

import type { TaskPriority, AnyStatus } from "../types/task";
import {
  useTasks,
  useTask,
  useUpdateTask,
  useDeleteTask,
  useAssignUser,
  useRemoveAssignee,
  type TaskFilters,
  type SortBy,
  type SortOrder,
  type TaskDTO,
} from "../hooks/api/useTasks";
import { useWorkspaceMembers } from "../hooks/api/useWorkspace";
import {
  usePersonalTasks,
  useUpdatePersonalTask,
  useDeletePersonalTask,
  type PersonalTaskDTO,
} from "../hooks/api/usePersonalTasks";

const PAGE_SIZE = 20;

export function TasksPage() {
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";
  const { user } = useAuth();

  // ── Read ?taskId from URL (e.g. navigated from a task preview dialog) ──
  const [searchParams, setSearchParams] = useSearchParams();

  // ── Filter / search / sort state ──
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [sortBy, setSortBy] = useState<SortBy>("created_at");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [selectedTaskId, setSelectedTaskId] = useState<string>(() => {
    // Pre-select from URL on first render
    return searchParams.get("taskId") ?? "";
  });
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  // ── Subtask navigation stack ──
  // Tracks the parent task when user navigates into a subtask
  const [parentTaskStack, setParentTaskStack] = useState<Array<{ id: string; title: string }>>([]);

  // When ?taskId appears in the URL (including when already on this page),
  // select that task and immediately clean the param so the URL stays tidy.
  useEffect(() => {
    const taskIdFromUrl = searchParams.get("taskId");
    if (taskIdFromUrl) {
      setSelectedTaskId(taskIdFromUrl);
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
  const [limit, setLimit] = useState(PAGE_SIZE);

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
    } else if (statusFilter === "High Priority") {
      filters.priority = "high" as TaskPriority;
    }
    return filters;
  }, [statusFilter, sortBy, sortOrder, limit, user?.id]);

  // ── App mode ──────────────────────────────────────────
  const { mode } = useAppContext();
  const isPersonalMode = mode === "personal";

  // ── Org tasks (legacy route — active in organisation mode) ──
  const { data: orgTasks, isLoading: orgLoading, isFetching: orgFetching } = useTasks(
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
  const tasks = isPersonalMode ? personalTasks : (orgTasks ?? []);
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
    setLimit(PAGE_SIZE);
  }, []);

  const handleSortChange = useCallback((by: SortBy, order: SortOrder) => {
    setSortBy(by);
    setSortOrder(order);
    setLimit(PAGE_SIZE);
  }, []);

  // ── Org task mutations ─────────────────────────────────────────
  const updateOrgTask = useUpdateTask();
  const deleteOrgTask = useDeleteTask();
  const assignUser = useAssignUser();
  const removeAssignee = useRemoveAssignee();

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
    if (isPersonalMode) {
      deletePersonalTask.mutate(id);
    } else {
      deleteOrgTask.mutate(id);
    }
    if (id === selectedTaskId) setSelectedTaskId("");
  }, [isPersonalMode, deletePersonalTask, deleteOrgTask, selectedTaskId]);

  // ── Workspace members for bulk assign (org mode only) ─────────────
  // In personal mode, assignees don't exist — pass empty array.
  const { data: members } = useWorkspaceMembers(
    isPersonalMode ? undefined : (orgTasks?.[0]?.workspace_id)
  );
  const workspaceMembers = isPersonalMode
    ? []
    : members?.map((m) => ({
        id: m.user.id,
        name: m.user.name,
        email: m.user.email,
      })) ?? [];

  // ── Client-side text filter on top of server results ──
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return taskList.filter((t) => {
      // "Blocked" is a derived filter — not sent to backend
      if (statusFilter === "Blocked") {
        const isBlocked = ((t as any).blocked_by_count || (t.dependencies?.length || 0)) > 0;
        if (!isBlocked) return false;
      }
      if (!q) return true;
      return (
        t.title.toLowerCase().includes(q) ||
        (t.objective && t.objective.toLowerCase().includes(q))
      );
    });
  }, [query, taskList, statusFilter]);

  // ── Selected task ──
  const selected = useMemo(
    () => filtered.find((t) => t.id === selectedTaskId) ?? null,
    [selectedTaskId, filtered]
  );

  // Fetch full task data for the selected task (handles subtask detail too)
  const { data: selectedTaskDetail } = useTask(selectedTaskId);

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
    setSelectedTaskId(subtaskId);
  }, [selected, selectedTaskDetail]);

  // Navigate back to parent task (pop the stack)
  const handleNavigateToParent = useCallback((parentId: string) => {
    setParentTaskStack((prev) => prev.slice(0, -1));
    setSelectedTaskId(parentId);
  }, []);

  // Handle task scheduling from calendar (org mode only — personal tasks use simpler update)
  const handleTaskSchedule = useCallback((taskId: string, startISO: string, endISO: string) => {
    // In personal mode fall back to a regular update (same fields exist on PersonalTaskDTO)
    handleUpdateTask(taskId, { start_date: startISO, due_date: endISO });
  }, [handleUpdateTask]);

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
                setSelectedTaskId(id);
              }}
              createDialogOpen={createDialogOpen}
              onCreateDialogOpenChange={setCreateDialogOpen}
              isLoading={isLoading}
              onTaskCreated={(newTaskId) => {
                setSelectedTaskId(newTaskId);
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
            {selected || selectedTaskDetail ? (
              (selectedTaskDetail || selected)?.type === "event" ? (
                <EventDetailPane
                  event={(selectedTaskDetail || selected)!}
                  onUpdateEvent={handleUpdateTask}
                  onEventDeleted={() => {
                    setSelectedTaskId("");
                    setParentTaskStack([]);
                  }}
                  onClose={() => {
                    setSelectedTaskId("");
                    setParentTaskStack([]);
                  }}
                />
              ) : (
                <TaskDetailPane
                  task={(selectedTaskDetail || selected)!}
                  isPersonalMode={isPersonalMode}
                  onUpdateTask={handleUpdateTask}
                  onTaskDeleted={() => {
                    setSelectedTaskId("");
                    setParentTaskStack([]);
                  }}
                  onClose={() => {
                    setSelectedTaskId("");
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
                blocks={[] as any}
                selectedTask={null as any}
                onTaskSchedule={handleTaskSchedule}
              />
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
