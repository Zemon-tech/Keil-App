import { useCallback, useMemo, useState, useEffect } from "react";
import { useSidebar } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { TaskListPane } from "@/components/tasks/TaskListPane";
import { TaskDetailPane } from "@/components/tasks/TaskDetailPane";
import { TaskSchedulePane } from "@/components/tasks/TaskSchedulePane";
import { useAuth } from "@/contexts/AuthContext";
import { useSearchParams } from "react-router-dom";

import type { TaskStatus, TaskPriority } from "../types/task";
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
} from "../hooks/api/useTasks";
import { useWorkspaceMembers } from "../hooks/api/useWorkspace";

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

  // ── Pagination: just increase the limit to fetch more ──
  const [limit, setLimit] = useState(PAGE_SIZE);

  // ── Build server-side filter params ──
  const serverFilters = useMemo((): TaskFilters => {
    const filters: TaskFilters = { limit, sort_by: sortBy, sort_order: sortOrder };

    // Map UI filter chips to API params
    if (statusFilter === "Mine" && user?.id) {
      filters.assignee_id = user.id;
    } else if (statusFilter === "in-progress") {
      filters.status = "in-progress" as TaskStatus;
    } else if (statusFilter === "todo") {
      filters.status = "todo" as TaskStatus;
    } else if (statusFilter === "backlog") {
      filters.status = "backlog" as TaskStatus;
    } else if (statusFilter === "done") {
      filters.status = "done" as TaskStatus;
    } else if (statusFilter === "High Priority") {
      filters.priority = "high" as TaskPriority;
    }
    return filters;
  }, [statusFilter, sortBy, sortOrder, limit, user?.id]);

  // ── Fetch real tasks from backend ──
  const { data: tasks, isLoading, isFetching } = useTasks(serverFilters);

  // Stable reference — never creates a new [] on each render
  const taskList = tasks ?? [];

  // Derive pagination state from the result (no useEffect needed)
  const hasMore = taskList.length >= limit;

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

  // ── Mutations (wired to callbacks) ──
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const assignUser = useAssignUser();
  const removeAssignee = useRemoveAssignee();

  // ── Fetch workspace members for bulk assign ──
  const { data: members } = useWorkspaceMembers(tasks?.[0]?.workspace_id);
  const workspaceMembers = members?.map((m) => ({
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
              onUpdateTask={(id, updates) => {
                updateTask.mutate({ id, updates });
              }}
              onDeleteTask={(id) => {
                deleteTask.mutate(id);
                // Clear selection if deleted task was selected
                if (id === selectedTaskId) {
                  setSelectedTaskId("");
                }
              }}
              onAssignUser={(taskId, userId) => {
                assignUser.mutate({ id: taskId, userId });
              }}
              onRemoveAssignee={(taskId, userId) => {
                removeAssignee.mutate({ id: taskId, userId });
              }}
              workspaceMembers={workspaceMembers}
              hasMore={hasMore}
              onLoadMore={handleLoadMore}
              isLoadingMore={isFetching && limit > PAGE_SIZE}
            />
          </div>

          <div className="flex-1 min-w-0 bg-background h-full">
            {selected || selectedTaskDetail ? (
              <TaskDetailPane
                task={(selectedTaskDetail || selected)!}
                onUpdateTask={(id, updates) => {
                  updateTask.mutate({ id, updates });
                }}
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
            ) : (
              <TaskSchedulePane
                tasks={taskList as any}
                blocks={[] as any}
                selectedTask={null as any}
              />
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
