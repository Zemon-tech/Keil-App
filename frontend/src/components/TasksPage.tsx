import { useMemo, useState } from "react";
import { useSidebar } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { TaskListPane } from "@/components/tasks/TaskListPane";
import { TaskDetailPane } from "@/components/tasks/TaskDetailPane";

export type TaskStatus = "Backlog" | "In Progress" | "Blocked" | "Done";
export type TaskPriority = "Low" | "Medium" | "High" | "Critical";

export type Subtask = {
  id: string;
  title: string;
  done: boolean;
};

export type Task = {
  id: string;
  projectId: string;
  projectTitle: string;
  title: string;
  description?: string;
  objective: string;
  successCriteria: string;
  status: TaskStatus;
  priority: TaskPriority;
  owner: string;
  dueDateISO: string;
  dependencies: { id: string; title: string; status: TaskStatus }[];
  context: { title: string; kind: "link" | "file" | "doc"; href?: string }[];
  subtasks: Subtask[];
  activity: { id: string; label: string; timestamp: string }[];
  comments: { id: string; author: string; body: string; timestamp: string }[];
};

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

export function TasksPage() {
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<TaskStatus | "All">("All");
  const [selectedTaskId, setSelectedTaskId] = useState<string>(mockTasks[0]?.id ?? "");

  const tasks = mockTasks;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tasks.filter((t) => {
      if (statusFilter !== "All" && t.status !== statusFilter) return false;
      if (!q) return true;
      return (
        t.title.toLowerCase().includes(q) ||
        t.projectTitle.toLowerCase().includes(q) ||
        t.objective.toLowerCase().includes(q)
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
          <ResizablePanel defaultSize={36} minSize={26} className="bg-card">
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

          <ResizablePanel defaultSize={64} minSize={40} className="bg-background">
            <TaskDetailPane task={selected} />
          </ResizablePanel>
        </ResizablePanelGroup>
      </main>
    </div>
  );
}
