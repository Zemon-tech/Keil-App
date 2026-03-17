import { useMemo, useState } from "react";
import { useSidebar } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { TaskListPane } from "@/components/tasks/TaskListPane";
import { TaskDetailPane } from "@/components/tasks/TaskDetailPane";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { FileText } from "lucide-react";

import type { Task } from "../types/task";
import { mockTasks } from "../data/mockTasks";

export function TasksPage() {
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [selectedTaskId, setSelectedTaskId] = useState<string>("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [tasks, setTasks] = useState<Task[]>(mockTasks);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tasks.filter((t) => {
      if (statusFilter === "Mine" && t.owner !== "Shivang") return false;
      if (statusFilter === "In Progress" && t.status !== "In Progress") return false;
      if (statusFilter === "Blocked" && t.status !== "Blocked") return false;
      if (statusFilter === "High Priority" && t.priority !== "High" && t.priority !== "Critical") return false;
      if (!q) return true;
      return (
        t.title.toLowerCase().includes(q) ||
        t.projectTitle.toLowerCase().includes(q) ||
        (t.objective && t.objective.toLowerCase().includes(q))
      );
    });
  }, [query, statusFilter, tasks]);

  const selected = useMemo(
    () => tasks.find((t) => t.id === selectedTaskId) ?? null,
    [selectedTaskId, tasks]
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
              onCreateTask={(task: Task) => {
                setTasks((prev) => [task, ...prev]);
                setSelectedTaskId(task.id);
                setCreateDialogOpen(false);
              }}
              onUpdateTask={(id, updates) => {
                setTasks(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
              }}
            />
          </ResizablePanel>

          <ResizablePanel defaultSize={70} minSize="50%" className="bg-background">
            {selected ? (
              <TaskDetailPane
                task={selected}
                onUpdateTask={(id, updates) => {
                  setTasks(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
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

