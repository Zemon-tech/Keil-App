import { useMemo, useState } from "react";
import { useSidebar } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Toaster } from "@/components/ui/sonner";
import { TaskListPane } from "@/components/tasks/TaskListPane";
import { TaskSchedulePane } from "@/components/tasks/TaskSchedulePane";
import { TaskTimelinePane } from "@/components/tasks/TaskTimelinePane";
import type { CalendarBlock, Task } from "@/types/task";
import { mockTasks } from "@/data/mockTasks";

const mockCalendarBlocks: CalendarBlock[] = [
  {
    id: "blk_01",
    type: "meeting",
    title: "Client sync",
    startISO: new Date(Date.now() + 1000 * 60 * 30).toISOString(),
    endISO: new Date(Date.now() + 1000 * 60 * 90).toISOString(),
    notes: "Agenda: gantt + calendar + task slot semantics",
  },
  {
    id: "blk_02",
    type: "focus_block",
    title: "Deep work: Task UI",
    startISO: new Date(Date.now() + 1000 * 60 * 120).toISOString(),
    endISO: new Date(Date.now() + 1000 * 60 * 240).toISOString(),
  },
  {
    id: "blk_03",
    type: "task_slot",
    title: "Work on: Define Task Module UI",
    taskId: "tsk_01",
    startISO: new Date(Date.now() + 1000 * 60 * 300).toISOString(),
    endISO: new Date(Date.now() + 1000 * 60 * 360).toISOString(),
  },
  {
    id: "blk_04",
    type: "deadline_marker",
    title: "Due: Stabilize auth refresh flow",
    taskId: "tsk_03",
    startISO: new Date(Date.now() + 1000 * 60 * 60 * 10).toISOString(),
  },
  {
    id: "blk_05",
    type: "reminder",
    title: "Send update to Aisha",
    startISO: new Date(Date.now() + 1000 * 60 * 60 * 3).toISOString(),
  },
];

export function SchedulePage() {
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [sortBy, setSortBy] = useState<any>("created_at");
  const [sortOrder, setSortOrder] = useState<any>("desc");
  const [selectedTaskId, setSelectedTaskId] = useState<string>("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [tasks, setTasks] = useState<Task[]>(mockTasks);
  const [activeTab, setActiveTab] = useState<"schedule" | "timeline">("schedule");

  // Handle task scheduling updates
  const handleTaskSchedule = (taskId: string, startISO: string, endISO: string) => {
    console.log("📅 Scheduling task:", { taskId, startISO, endISO });
    
    setTasks((prevTasks) =>
      prevTasks.map((task) =>
        task.id === taskId
          ? { ...task, plannedStartISO: startISO, plannedEndISO: endISO }
          : task
      )
    );
    
    console.log("✅ Task scheduled successfully");
  };



  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tasks.filter((t) => {
      if (statusFilter === "Mine" && (t as any).owner !== "Shivang") return false;
      if (statusFilter === "in-progress" && t.status !== "in-progress") return false;
      if (statusFilter === "Blocked") {
        const isBlocked = ((t as any).blocked_by_count || (t.dependencies?.length || 0)) > 0;
        if (!isBlocked) return false;
      }
      if (statusFilter === "High Priority" && t.priority !== "high" && t.priority !== "urgent") return false;
      if (!q) return true;
      return (
        t.title.toLowerCase().includes(q) ||
        t.projectTitle.toLowerCase().includes(q) ||
        (t.objective && t.objective.toLowerCase().includes(q))
      );
    });
  }, [query, statusFilter, tasks]);

  const selectedTask = useMemo(
    () => tasks.find((t) => t.id === selectedTaskId) ?? null,
    [selectedTaskId, tasks]
  );

  const containerClassName = cn(
    "h-full w-full transition-all duration-500 ease-in-out",
    isCollapsed ? "" : ""
  );

  return (
    <div className="h-dvh w-full bg-background text-foreground overflow-hidden overscroll-none">
      <Toaster />
      <main className={containerClassName}>
        <div className="flex h-full w-full">
          <div className="w-[300px] shrink-0 bg-card border-r border-border h-full">
            <TaskListPane
              query={query}
              onQueryChange={setQuery}
              statusFilter={statusFilter}
              onStatusFilterChange={setStatusFilter}
              sortBy={sortBy}
              sortOrder={sortOrder}
              onSortChange={(by, order) => {
                setSortBy(by);
                setSortOrder(order);
              }}
              tasks={filtered as any}
              selectedTaskId={selectedTaskId}
              onSelectTask={setSelectedTaskId}
              createDialogOpen={createDialogOpen}
              onCreateDialogOpenChange={setCreateDialogOpen}
              onTaskCreated={(taskId) => {
                setSelectedTaskId(taskId);
                setCreateDialogOpen(false);
              }}
              onUpdateTask={(id, updates) => {
                setTasks(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
              }}
            />
          </div>

          <div className="flex-1 min-w-0 bg-background h-full flex flex-col">
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="h-full flex flex-col w-full min-w-0">
              <div className="shrink-0 border-b border-border/60 bg-linear-to-b from-card/50 to-background px-4 pt-3 w-full">
                <TabsList className="rounded-xl">
                  <TabsTrigger value="schedule">Schedule</TabsTrigger>
                  <TabsTrigger value="timeline">Timeline</TabsTrigger>
                </TabsList>
              </div>

              <div className="flex-1 min-h-0 w-full min-w-0">
                <TabsContent value="schedule" className="h-full mt-0 focus-visible:outline-none flex flex-col w-full min-w-0">
                  <TaskSchedulePane 
                    tasks={tasks} 
                    blocks={mockCalendarBlocks as any} 
                    selectedTask={selectedTask}
                    onViewChange={(view) => {
                      console.log('📅 Calendar view changed to:', view);
                    }}
                    onTaskSchedule={handleTaskSchedule}
                  />
                </TabsContent>

                <TabsContent value="timeline" className="h-full mt-0 focus-visible:outline-none flex flex-col w-full min-w-0">
                  <TaskTimelinePane tasks={tasks} selectedTask={selectedTask} />
                </TabsContent>
              </div>
            </Tabs>
          </div>
        </div>
      </main>
    </div>
  );
}
