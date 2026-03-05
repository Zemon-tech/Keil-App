import { useMemo, useState } from "react";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TaskListPane } from "@/components/tasks/TaskListPane";
import { TaskSchedulePane } from "@/components/tasks/TaskSchedulePane";
import { TaskTimelinePane } from "@/components/tasks/TaskTimelinePane";
import type { CalendarBlock, Task, TaskStatus } from "@/components/TasksPage";

const mockTasks: Task[] = [
  {
    id: "tsk_01",
    projectId: "prj_01",
    projectTitle: "ClarityOS Launch",
    title: "Define Task Module UI",
    description: "Ship a task detail experience that keeps the project context visible while staying fast to scan.",
    objective: "Make task work feel structured: objective, criteria, owner, due date, dependencies, and context in one place.",
    successCriteria: "Users can find the next step in < 10 seconds and update status/subtasks without leaving the page.",
    status: "In Progress",
    priority: "High",
    owner: "Shivang",
    dueDateISO: new Date(Date.now() + 1000 * 60 * 60 * 24 * 2).toISOString(),
    plannedStartISO: new Date(Date.now() - 1000 * 60 * 60 * 24 * 1).toISOString(),
    plannedEndISO: new Date(Date.now() + 1000 * 60 * 60 * 24 * 2).toISOString(),
    dependencies: [
      { id: "tsk_03", title: "Finalize sidebar nav", status: "Done" },
      { id: "tsk_04", title: "Decide task statuses", status: "In Progress" },
    ],
    context: [
      { title: "Module spec (Tasks)", kind: "doc", href: "#" },
      { title: "Figma export", kind: "link", href: "#" },
      { title: "API contract", kind: "doc", href: "#" },
    ],
    subtasks: [
      { id: "sub_01", title: "Two-pane layout (list + details)", done: true },
      { id: "sub_02", title: "Objective / Success criteria blocks", done: true },
      { id: "sub_03", title: "Dependencies + context panel", done: false },
      { id: "sub_04", title: "Comments & history tabs", done: false },
    ],
    activity: [
      { id: "act_01", label: "Status set to In Progress", timestamp: "Today, 09:42" },
      { id: "act_02", label: "Subtask completed: Two-pane layout", timestamp: "Today, 09:55" },
    ],
    comments: [
      {
        id: "c_01",
        author: "Design",
        body: "Make the hierarchy visible even when you’re deep inside a subtask.",
        timestamp: "Today, 09:14",
      },
      {
        id: "c_02",
        author: "You",
        body: "Agree — I’ll keep a breadcrumb + project chip in the header.",
        timestamp: "Today, 09:28",
      },
    ],
  },
  {
    id: "tsk_02",
    projectId: "prj_01",
    projectTitle: "ClarityOS Launch",
    title: "Dependency graph (v1)",
    objective: "Represent prerequisite relationships without overwhelming the page.",
    successCriteria: "Users can see what is blocking a task and what it unblocks.",
    status: "Backlog",
    priority: "Medium",
    owner: "Aisha",
    dueDateISO: new Date(Date.now() + 1000 * 60 * 60 * 24 * 8).toISOString(),
    plannedStartISO: new Date(Date.now() + 1000 * 60 * 60 * 24 * 4).toISOString(),
    plannedEndISO: new Date(Date.now() + 1000 * 60 * 60 * 24 * 10).toISOString(),
    dependencies: [{ id: "tsk_01", title: "Define Task Module UI", status: "In Progress" }],
    context: [{ title: "Notes: graph UI", kind: "doc", href: "#" }],
    subtasks: [
      { id: "sub_11", title: "Decide edge rules", done: false },
      { id: "sub_12", title: "Draft minimal visualization", done: false },
    ],
    activity: [{ id: "act_11", label: "Created", timestamp: "Yesterday, 17:10" }],
    comments: [],
  },
  {
    id: "tsk_03",
    projectId: "prj_02",
    projectTitle: "KeilHQ Core",
    title: "Stabilize auth refresh flow",
    objective: "Reduce surprise logouts and prevent token-expired cascades.",
    successCriteria: "No forced relogin during a 24h session; errors surface with actionable messaging.",
    status: "Blocked",
    priority: "Critical",
    owner: "Rohan",
    dueDateISO: new Date(Date.now() + 1000 * 60 * 60 * 10).toISOString(),
    plannedStartISO: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(),
    plannedEndISO: new Date(Date.now() + 1000 * 60 * 60 * 14).toISOString(),
    dependencies: [{ id: "tsk_05", title: "Supabase session audit", status: "In Progress" }],
    context: [
      { title: "Supabase docs", kind: "link", href: "#" },
      { title: "AuthContext.tsx", kind: "file" },
    ],
    subtasks: [
      { id: "sub_21", title: "Reproduce on slow network", done: true },
      { id: "sub_22", title: "Add retry/backoff", done: false },
      { id: "sub_23", title: "Surface toast + CTA", done: false },
    ],
    activity: [{ id: "act_21", label: "Status set to Blocked", timestamp: "Today, 08:03" }],
    comments: [
      {
        id: "c_21",
        author: "You",
        body: "Blocked on deciding whether we force refresh on tab-focus.",
        timestamp: "Today, 08:12",
      },
    ],
  },
];

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
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<TaskStatus | "All">("All");
  const [selectedTaskId, setSelectedTaskId] = useState<string>(mockTasks[0]?.id ?? "");
  const [activeTab, setActiveTab] = useState<"schedule" | "timeline">("schedule");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return mockTasks.filter((t) => {
      if (statusFilter !== "All" && t.status !== statusFilter) return false;
      if (!q) return true;
      return (
        t.title.toLowerCase().includes(q) ||
        t.projectTitle.toLowerCase().includes(q) ||
        t.objective.toLowerCase().includes(q)
      );
    });
  }, [query, statusFilter]);

  const selectedTask = useMemo(
    () => mockTasks.find((t) => t.id === selectedTaskId) ?? null,
    [selectedTaskId]
  );

  return (
    <div className="h-[100dvh] w-full bg-background text-foreground overflow-hidden overscroll-none">
      <main className="h-full w-full">
        <ResizablePanelGroup direction="horizontal" className="h-full w-full">
          <ResizablePanel defaultSize={34} minSize={26} className="bg-card">
            <TaskListPane
              query={query}
              onQueryChange={setQuery}
              statusFilter={statusFilter}
              onStatusFilterChange={setStatusFilter}
              tasks={filtered}
              selectedTaskId={selectedTaskId}
              onSelectTask={setSelectedTaskId}
            />
          </ResizablePanel>

          <ResizableHandle withHandle className="bg-border/60" />

          <ResizablePanel defaultSize={66} minSize={40} className="bg-background">
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="h-full">
              <div className="border-b border-border/60 bg-gradient-to-b from-card/50 to-background px-4 pt-3">
                <TabsList className="rounded-xl">
                  <TabsTrigger value="schedule">Schedule</TabsTrigger>
                  <TabsTrigger value="timeline">Timeline</TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="schedule" className="h-[calc(100%-52px)]">
                <TaskSchedulePane tasks={mockTasks} blocks={mockCalendarBlocks} selectedTask={selectedTask} />
              </TabsContent>

              <TabsContent value="timeline" className="h-[calc(100%-52px)]">
                <TaskTimelinePane tasks={mockTasks} selectedTask={selectedTask} />
              </TabsContent>
            </Tabs>
          </ResizablePanel>
        </ResizablePanelGroup>
      </main>
    </div>
  );
}
