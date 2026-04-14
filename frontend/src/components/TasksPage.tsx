import { useCallback, useMemo, useState } from "react";
import { useSidebar } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { TaskListPane } from "@/components/tasks/TaskListPane";
import { TaskDetailPane } from "@/components/tasks/TaskDetailPane";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { FileText } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

import type { TaskStatus, TaskPriority } from "../types/task";
import { useTasks, useUpdateTask, type TaskFilters, type SortBy, type SortOrder } from "../hooks/api/useTasks";

const PAGE_SIZE = 20;

export function TasksPage() {
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";
  const { user } = useAuth();

  // ── Filter / search / sort state ──
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [sortBy, setSortBy] = useState<SortBy>("created_at");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [selectedTaskId, setSelectedTaskId] = useState<string>("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

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

  // ── Update mutation (wired to onUpdateTask callbacks) ──
  const updateTask = useUpdateTask();

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
              onSelectTask={setSelectedTaskId}
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
              hasMore={hasMore}
              onLoadMore={handleLoadMore}
              isLoadingMore={isFetching && limit > PAGE_SIZE}
            />
          </div>

          <div className="flex-1 min-w-0 bg-background h-full">
            {selected ? (
              <TaskDetailPane
                task={selected}
                onUpdateTask={(id, updates) => {
                  updateTask.mutate({ id, updates });
                }}
                onTaskDeleted={() => {
                  setSelectedTaskId("");
                }}
              />
            ) : (
              <div className="h-full bg-background">
                <div className="h-full p-6">
                  <Empty className="h-full">
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <FileText />
                      </EmptyMedia>
                      <EmptyTitle>No task selected</EmptyTitle>
                      <EmptyDescription>
                        Select a task from the list, or create a new one to get started.
                      </EmptyDescription>
                    </EmptyHeader>
                    <EmptyContent>
                      <Button
                        variant="outline"
                        className="rounded-xl"
                        onClick={() => setCreateDialogOpen(true)}
                      >
                        Create task
                      </Button>
                    </EmptyContent>
                  </Empty>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

