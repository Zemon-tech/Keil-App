import { useMemo, useState } from "react";
import { useSidebar } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { TaskListPane } from "@/components/tasks/TaskListPane";
import { TaskDetailPane } from "@/components/tasks/TaskDetailPane";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { FileText } from "lucide-react";

import type { TaskStatus, TaskPriority } from "../types/task";
import { useTasks, useUpdateTask, type TaskFilters } from "../hooks/api/useTasks";

export function TasksPage() {
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";

  // ── Filter / search state ──
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [selectedTaskId, setSelectedTaskId] = useState<string>("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  // ── Build server-side filter params ──
  const serverFilters = useMemo((): TaskFilters => {
    const filters: TaskFilters = {};

    // Map UI filter chips to API params
    if (statusFilter === "in-progress") {
      filters.status = "in-progress" as TaskStatus;
    } else if (statusFilter === "High Priority") {
      filters.priority = "high" as TaskPriority;
    }
    // "Mine" and "All" are handled client-side via text search / future assignee_id
    return filters;
  }, [statusFilter]);

  // ── Fetch real tasks from backend ──
  const { data: tasks = [], isLoading } = useTasks(serverFilters);

  // ── Update mutation (wired to onUpdateTask callbacks) ──
  const updateTask = useUpdateTask();

  // ── Client-side text filter on top of server results ──
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tasks.filter((t) => {
      if (!q) return true;
      return (
        t.title.toLowerCase().includes(q) ||
        (t.objective && t.objective.toLowerCase().includes(q))
      );
    });
  }, [query, tasks]);

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
    <div className="h-[100dvh] w-full bg-background text-foreground overflow-hidden overscroll-none">
      <main className={containerClassName}>
        <ResizablePanelGroup direction="horizontal" className="h-full w-full">
          <ResizablePanel defaultSize={20} minSize="25%" className="bg-card">
            <TaskListPane
              query={query}
              onQueryChange={setQuery}
              statusFilter={statusFilter}
              onStatusFilterChange={setStatusFilter}
              tasks={filtered}
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
            />
          </ResizablePanel>

          <ResizablePanel defaultSize={70} minSize="50%" className="bg-background">
            {selected ? (
              <TaskDetailPane
                task={selected}
                onUpdateTask={(id, updates) => {
                  updateTask.mutate({ id, updates });
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
          </ResizablePanel>
        </ResizablePanelGroup>
      </main>
    </div>
  );
}
