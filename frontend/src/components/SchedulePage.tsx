import { useMemo, useState } from "react";
import { subDays, addDays } from "date-fns";
import { useSidebar } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Toaster } from "@/components/ui/sonner";
import { TaskListPane } from "@/components/tasks/TaskListPane";
import { TaskSchedulePane } from "@/components/tasks/TaskSchedulePane";
import { TaskTimelinePane } from "@/components/tasks/TaskTimelinePane";
import { ScheduleTaskModal } from "@/components/schedule/ScheduleTaskModal";
import { useTasks, type SortBy, type SortOrder } from "@/hooks/api/useTasks";
import { useCalendarTasks, useGanttTasks, useUpdateTaskTimeblock, useUpdateTaskDeadline, useDeleteTaskTimeblock } from "@/hooks/api/useSchedule";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import type { CalendarBlock, CalendarBlockType, Task, TaskStatus, TaskPriority } from "@/types/task";

// Minimum pixel widths for each calendar view
const MIN_WIDTHS = {
  timeGridWeek: 750,  // 7 days + time column fully visible
  timeGridDay: 450,   // Single day + time column comfortable
  dayGridMonth: 650,  // All dates visible without wrap
  listWeek: 400,      // List items readable
} as const;

export function SchedulePage() {
  const { state } = useSidebar();
  const { workspaceId, workspaceRole } = useWorkspace();
  const isCollapsed = state === "collapsed";

  // ── Task list state ──
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [selectedTaskId, setSelectedTaskId] = useState<string>("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [sortBy, setSortBy] = useState<SortBy>("created_at");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [activeTab, setActiveTab] = useState<"schedule" | "timeline">("schedule");
  const [calendarView, setCalendarView] = useState<string>("timeGridWeek");

  // ── Calendar range state ──
  // Initialize with a wide range so FullCalendar week view has data on first render
  const [calStart, setCalStart] = useState(subDays(new Date(), 7).toISOString());
  const [calEnd, setCalEnd] = useState(addDays(new Date(), 30).toISOString());

  // ── ScheduleTaskModal state ──
  const [modalOpen, setModalOpen] = useState(false);
  const [modalDefaultStart, setModalDefaultStart] = useState("");
  const [modalDefaultEnd, setModalDefaultEnd] = useState("");

  // ── Real API hooks ──
  const { data: tasks = [], isLoading: tasksLoading } = useTasks({
    query,
    status: statusFilter === "All" ? undefined : (statusFilter as TaskStatus),
    sort_by: sortBy,
    sort_order: sortOrder,
  });

  const { data: calendarBlocks } = useCalendarTasks({
    start_range: calStart,
    end_range: calEnd,
  });

  const { data: ganttTasks } = useGanttTasks({ scope: "workspace" });

  const updateTimeblock = useUpdateTaskTimeblock();
  const updateDeadline = useUpdateTaskDeadline();
  const deleteTimeblock = useDeleteTaskTimeblock();

  // ── Convert ScheduleBlockDTO[] → CalendarBlock[] for TaskSchedulePane ──
  const calendarBlockItems: CalendarBlock[] = useMemo(() => {
    if (!calendarBlocks) return [];
    return calendarBlocks.map((b) => ({
      id: b.id,
      type: "task_slot" as CalendarBlockType,
      title: b.task_title,
      taskId: b.task_id,
      startISO: b.scheduled_start,
      endISO: b.scheduled_end,
    }));
  }, [calendarBlocks]);

  // ── Convert GanttTaskDTO[] → Task[] for TaskTimelinePane ──
  const ganttTaskItems: Task[] = useMemo(() => {
    if (!ganttTasks) return [];
    return ganttTasks.map((g) => ({
      id: g.id,
      title: g.title,
      status: g.status as TaskStatus,
      priority: "medium" as TaskPriority,
      projectId: "",
      projectTitle: "",
      owner: "",
      objective: "",
      success_criteria: "",
      labels: [],
      plannedStartISO: g.start_date,
      plannedEndISO: g.due_date,
      dueDateISO: g.due_date,
      dependencies: g.dependencies.map((id) => ({ id, title: "", status: "backlog" as TaskStatus, priority: "medium" as TaskPriority, due_date: g.due_date })),
      subtasks: [],
      context: [],
      comments: [],
      activity: [],
      assignees: [],
    }));
  }, [ganttTasks]);

  // ── Handlers ──
  const handleTaskSchedule = async (taskId: string, startISO: string, endISO: string) => {
    await updateTimeblock.mutateAsync({ taskId, scheduled_start: startISO, scheduled_end: endISO });
  };

  const handleDeadlineChange = (taskId: string, newStart: string, newEnd: string) => {
    updateDeadline.mutate({ id: taskId, start_date: newStart, due_date: newEnd });
  };

  const handleSlotSelect = (start: string, end: string) => {
    setModalDefaultStart(start);
    setModalDefaultEnd(end);
    setModalOpen(true);
  };

  const handleSortChange = (by: SortBy, order: SortOrder) => {
    setSortBy(by);
    setSortOrder(order);
  };

  // ── Derived ──
  const calendarMinPixels = useMemo(() => {
    const minPixels = MIN_WIDTHS[calendarView as keyof typeof MIN_WIDTHS] || MIN_WIDTHS.timeGridWeek;
    return `${minPixels}px`;
  }, [calendarView]);

  const selectedTask = useMemo(
    () => tasks.find((t) => t.id === selectedTaskId) ?? null,
    [selectedTaskId, tasks]
  );

  const isGanttReadOnly = workspaceRole !== "admin" && workspaceRole !== "owner";

  const containerClassName = cn(
    "h-full w-full transition-all duration-500 ease-in-out",
    isCollapsed ? "" : ""
  );

  return (
    <div className="h-dvh w-full bg-background text-foreground overflow-hidden overscroll-none">
      <Toaster />
      <main className={containerClassName}>
        <ResizablePanelGroup direction="horizontal" className="h-full w-full">
          <ResizablePanel defaultSize={30} minSize={20} className="bg-card">
            <TaskListPane
              query={query}
              onQueryChange={setQuery}
              statusFilter={statusFilter}
              onStatusFilterChange={setStatusFilter}
              sortBy={sortBy}
              sortOrder={sortOrder}
              onSortChange={handleSortChange}
              tasks={tasks}
              selectedTaskId={selectedTaskId}
              onSelectTask={setSelectedTaskId}
              createDialogOpen={createDialogOpen}
              onCreateDialogOpenChange={setCreateDialogOpen}
              onTaskCreated={(newTaskId: string) => {
                setSelectedTaskId(newTaskId);
                setCreateDialogOpen(false);
              }}
              isLoading={tasksLoading}
            />
          </ResizablePanel>

          <ResizableHandle withHandle className="bg-border/60" />

          <ResizablePanel 
            defaultSize={70} 
            minSize={30}
            className="bg-background"
          >
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="h-full flex flex-col">
              <div className="shrink-0 border-b border-border/60 bg-linear-to-b from-card/50 to-background px-4 pt-3">
                <TabsList className="rounded-xl">
                  <TabsTrigger value="schedule">Schedule</TabsTrigger>
                  <TabsTrigger value="timeline">Timeline</TabsTrigger>
                </TabsList>
              </div>

              <div className="flex-1 min-h-0">
                <TabsContent value="schedule" className="h-full mt-0 focus-visible:outline-none">
                  <TaskSchedulePane 
                    tasks={tasks.map((t) => ({
                      ...t,
                      projectTitle: t.projectTitle ?? "",
                      owner: t.owner ?? "",
                      plannedStartISO: t.plannedStartISO ?? t.start_date ?? null,
                      plannedEndISO: t.plannedEndISO ?? t.due_date ?? null,
                      dueDateISO: t.dueDateISO ?? t.due_date ?? null,
                      dependencies: (t.dependencies ?? []).map((d) => typeof d === "string" ? { id: d, title: "", status: "backlog" as TaskStatus, priority: "medium" as TaskPriority, due_date: t.due_date ?? "" } : d),
                      subtasks: t.subtasks ?? [],
                      context: t.context ?? [],
                      comments: t.comments ?? [],
                      assignees: t.assignees ?? [],
                    })) as Task[]} 
                    blocks={calendarBlockItems} 
                    selectedTask={selectedTask ? {
                      ...selectedTask,
                      projectTitle: selectedTask.projectTitle ?? "",
                      owner: selectedTask.owner ?? "",
                      plannedStartISO: selectedTask.plannedStartISO ?? selectedTask.start_date ?? null,
                      plannedEndISO: selectedTask.plannedEndISO ?? selectedTask.due_date ?? null,
                      dueDateISO: selectedTask.dueDateISO ?? selectedTask.due_date ?? null,
                      dependencies: (selectedTask.dependencies ?? []).map((d) => typeof d === "string" ? { id: d, title: "", status: "backlog" as TaskStatus, priority: "medium" as TaskPriority, due_date: selectedTask.due_date ?? "" } : d),
                      subtasks: selectedTask.subtasks ?? [],
                      context: selectedTask.context ?? [],
                      comments: selectedTask.comments ?? [],
                      assignees: selectedTask.assignees ?? [],
                    } as Task : null}
                    onViewChange={setCalendarView}
                    onRangeChange={(start, end) => {
                      setCalStart(start);
                      setCalEnd(end);
                    }}
                    onTaskSchedule={handleTaskSchedule}
                    onSlotSelect={handleSlotSelect}
                    onDeleteBlock={async (taskId) => {
                      await deleteTimeblock.mutateAsync(taskId);
                    }}
                  />
                </TabsContent>

                <TabsContent value="timeline" className="h-full mt-0 focus-visible:outline-none">
                  <TaskTimelinePane 
                    tasks={ganttTaskItems} 
                    selectedTask={null}
                    onDeadlineChange={handleDeadlineChange}
                    isReadOnly={isGanttReadOnly}
                  />
                </TabsContent>
              </div>
            </Tabs>
          </ResizablePanel>
        </ResizablePanelGroup>
      </main>

      <ScheduleTaskModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        defaultStart={modalDefaultStart}
        defaultEnd={modalDefaultEnd}
        onScheduled={() => {
          setModalOpen(false);
        }}
      />
    </div>
  );
}
