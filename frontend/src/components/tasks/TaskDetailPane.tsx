import { useState } from "react";
import {
  Calendar,
  ChevronRight,
  Flag,
  Plus,
  ArrowRight,
  Zap,
  Github,
  Link2,
  FileText,
  Box,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

// ShadCN components — all properly imported
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

import type { Task, TaskPriority, TaskStatus, Dependency } from "@/types/task";

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = {
  task: Task | null;
  onUpdateTask?: (id: string, updates: Partial<Task>) => void;
};

// ─── Constants & Helpers ──────────────────────────────────────────────────────

const STATUS_OPTIONS: TaskStatus[] = ["Backlog", "In Progress", "Blocked", "Done"];

const STATUS_COLOR: Record<TaskStatus, string> = {
  Done: "bg-emerald-500",
  Blocked: "bg-red-500",
  "In Progress": "bg-blue-500",
  Backlog: "bg-zinc-500",
};

const PRIORITY_CONFIG: Record<TaskPriority, { color: string; dot: string }> = {
  Critical: { color: "text-red-400 border-red-500/20", dot: "bg-red-400" },
  High: { color: "text-orange-400 border-orange-500/20", dot: "bg-orange-400" },
  Medium: { color: "text-yellow-400 border-yellow-500/20", dot: "bg-yellow-400" },
  Low: { color: "text-zinc-500 border-zinc-600/30", dot: "bg-zinc-500" },
};

const formatDate = (dateStr: string) => format(new Date(dateStr), "d MMM");
const formatRelTime = (dateStr: string) =>
  formatDistanceToNow(new Date(dateStr), { addSuffix: true });

const ContextIcon = ({ type, className }: { type: string; className?: string }) => {
  const icons: Record<string, React.ReactNode> = {
    doc: <FileText className={className} />,
    figma: <Box className={className} />,
    github: <Github className={className} />,
    notion: <FileText className={className} />,
    link: <Link2 className={className} />,
  };
  return <>{icons[type] ?? <Link2 className={className} />}</>;
};

// ─── Header Sub-components ────────────────────────────────────────────────────

/** Clickable status badge that opens a popover to change status */
const StatusBadge = ({
  status,
  onStatusChange,
}: {
  status: TaskStatus;
  onStatusChange: (s: TaskStatus) => void;
}) => (
  <Popover>
    <PopoverTrigger asChild>
      <Badge
        variant="outline"
        className="h-5 gap-1 px-1.5 text-[11px] cursor-pointer hover:bg-accent transition-colors"
      >
        <span className={cn("h-1.5 w-1.5 rounded-full", STATUS_COLOR[status])} />
        {status}
      </Badge>
    </PopoverTrigger>
    <PopoverContent className="w-40 p-1" align="start">
      {STATUS_OPTIONS.map((s) => (
        <button
          key={s}
          onClick={() => onStatusChange(s)}
          className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm
                     hover:bg-accent transition-colors text-left"
        >
          <span className={cn("h-1.5 w-1.5 rounded-full", STATUS_COLOR[s])} />
          {s}
        </button>
      ))}
    </PopoverContent>
  </Popover>
);

/** Priority badge with colored flag */
const PriorityBadge = ({ priority }: { priority: TaskPriority }) => {
  const cfg = PRIORITY_CONFIG[priority] ?? PRIORITY_CONFIG.Low;
  return (
    <Badge variant="outline" className={cn("h-5 gap-1 px-1.5 text-[11px]", cfg.color)}>
      <Flag className="h-3 w-3" />
      {priority}
    </Badge>
  );
};

/** Stacked avatar chips with tooltip for each assignee */
const AssigneesChip = ({ assignees }: { assignees: string[] }) => (
  <TooltipProvider delayDuration={300}>
    <div className="flex items-center -space-x-1.5">
      {assignees.slice(0, 3).map((a) => (
        <Tooltip key={a}>
          <TooltipTrigger asChild>
            <Avatar className="h-5 w-5 cursor-default ring-1 ring-background">
              <AvatarFallback className="text-[9px] font-semibold bg-accent">
                {a.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            {a}
          </TooltipContent>
        </Tooltip>
      ))}
      {assignees.length > 3 && (
        <Avatar className="h-5 w-5 ring-1 ring-background">
          <AvatarFallback className="text-[9px] bg-muted text-muted-foreground">
            +{assignees.length - 3}
          </AvatarFallback>
        </Avatar>
      )}
    </div>
  </TooltipProvider>
);

// ─── Zone 1: Header ───────────────────────────────────────────────────────────

const TaskDetailHeader = ({
  task,
  onUpdateTask,
}: {
  task: Task;
  onUpdateTask?: (id: string, updates: Partial<Task>) => void;
}) => {
  const handleStatusChange = (newStatus: TaskStatus) =>
    onUpdateTask?.(task.id, { status: newStatus });

  const handleMarkDone = () =>
    onUpdateTask?.(task.id, { status: "Done" });

  return (
    <div className="shrink-0 border-b border-border px-5 pt-4 pb-3">

      {/* Breadcrumb + Mark done — same row */}
      <div className="flex items-center justify-between mb-2">
        <Breadcrumb>
          <BreadcrumbList className="text-[11px]">
            <BreadcrumbItem>
              <span className="cursor-pointer text-muted-foreground hover:text-foreground transition-colors">
                {task.projectTitle}
              </span>
            </BreadcrumbItem>
            <BreadcrumbSeparator>
              <ChevronRight className="h-3 w-3" />
            </BreadcrumbSeparator>
            <BreadcrumbItem>
              <BreadcrumbPage className="font-medium text-foreground">
                {task.id}
              </BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <Button
          size="sm"
          variant={task.status === "Done" ? "secondary" : "default"}
          className="h-6 px-3 text-xs"
          onClick={handleMarkDone}
          disabled={task.status === "Done"}
        >
          {task.status === "Done" ? "Done ✓" : "Mark done"}
        </Button>
      </div>

      {/* Title — using div NOT h1 to avoid global heading style overrides */}
      <div className="text-xl font-semibold leading-snug tracking-tight mb-2.5">
        {task.title}
      </div>

      {/* Chips row — status, priority, assignees, date, story points, labels */}
      <div className="flex flex-wrap items-center gap-1.5">
        <StatusBadge status={task.status} onStatusChange={handleStatusChange} />
        <PriorityBadge priority={task.priority} />
        <AssigneesChip assignees={task.assignees} />

        {task.dueDateISO && (
          <Badge variant="outline" className="h-5 gap-1 px-1.5 text-[11px]">
            <Calendar className="h-3 w-3" />
            {formatDate(task.dueDateISO)}
          </Badge>
        )}

        {task.storyPoints != null && (
          <Badge variant="outline" className="h-5 px-1.5 font-mono text-[11px]">
            {task.storyPoints}p
          </Badge>
        )}

        {task.labels?.map((label) => (
          <Badge key={label} variant="secondary" className="h-5 px-1.5 text-[10px]">
            {label}
          </Badge>
        ))}
      </div>
    </div>
  );
};

// ─── Tab: Overview ────────────────────────────────────────────────────────────

const OverviewTab = ({
  task,
  onUpdateTask,
}: {
  task: Task;
  onUpdateTask?: (id: string, updates: Partial<Task>) => void;
}) => {
  const completedCount = task.subtasks.filter((s) => s.done).length;
  const progressPercent =
    task.subtasks.length > 0
      ? Math.round((completedCount / task.subtasks.length) * 100)
      : 0;

  const toggleSubtask = (subId: string) => {
    const updated = task.subtasks.map((s) =>
      s.id === subId ? { ...s, done: !s.done } : s
    );
    onUpdateTask?.(task.id, { subtasks: updated });
  };

  return (
    /* Responsive: single column on mobile, two-col sidebar on xl+ */
    <div className="flex h-full flex-col xl:flex-row xl:divide-x xl:divide-border">

      {/* ── LEFT: Main content ── */}
      <ScrollArea className="flex-1">
        <div className="space-y-6 p-5">

          {/* Objective + Success Criteria */}
          <div className="grid grid-cols-1 gap-px bg-border sm:grid-cols-2 rounded-md overflow-hidden border border-border/40">
            <div className="bg-background p-3">
              <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Objective
              </span>
              {task.objective ? (
                <p className="text-sm leading-relaxed">{task.objective}</p>
              ) : (
                <p className="text-sm italic text-muted-foreground">No objective set</p>
              )}
            </div>
            <div className="bg-background p-3">
              <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Success Criteria
              </span>
              {task.successCriteria ? (
                <p className="text-sm leading-relaxed">{task.successCriteria}</p>
              ) : (
                <p className="text-sm italic text-muted-foreground">No criteria set</p>
              )}
            </div>
          </div>

          {/* Subtasks */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Subtasks
              </span>
              <span className="font-mono text-[11px] text-muted-foreground">
                {completedCount}/{task.subtasks.length} complete
              </span>
            </div>

            {/* ShadCN Progress component */}
            <Progress value={progressPercent} className="mb-3 h-1" />

            <div>
              {task.subtasks.map((sub) => (
                <label
                  key={sub.id}
                  className="group flex cursor-pointer items-center gap-2.5 rounded px-2 py-1.5 hover:bg-accent/40"
                >
                  <Checkbox
                    checked={sub.done}
                    onCheckedChange={() => toggleSubtask(sub.id)}
                    className="h-3.5 w-3.5 shrink-0"
                  />
                  <span className={cn("flex-1 text-sm", sub.done && "line-through text-muted-foreground")}>
                    {sub.title}
                  </span>
                  {sub.assignee && (
                    <span className="text-[10px] text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
                      {sub.assignee}
                    </span>
                  )}
                </label>
              ))}

              {task.subtasks.length === 0 && (
                <p className="px-2 py-1.5 text-xs italic text-muted-foreground">
                  No subtasks yet
                </p>
              )}

              <button className="flex w-full items-center gap-1.5 px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground">
                <Plus className="h-3.5 w-3.5" />
                Add subtask
              </button>
            </div>
          </div>

          {/* Context */}
          <div>
            <span className="mb-2 block text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Context
            </span>
            {task.context.length > 0 ? (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {task.context.map((item) => (
                  <a
                    key={item.id}
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex items-center gap-2 rounded-md border border-border p-2 transition-colors hover:bg-accent/40"
                  >
                    <ContextIcon
                      type={item.type}
                      className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-foreground"
                    />
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium">{item.title}</p>
                      <p className="text-[10px] uppercase text-muted-foreground">{item.type}</p>
                    </div>
                  </a>
                ))}
              </div>
            ) : (
              <p className="text-xs italic text-muted-foreground">No context items</p>
            )}
          </div>

        </div>
      </ScrollArea>

      {/* ── RIGHT: Sidebar ── 
          Hidden below xl, shown as a separate pane on wide screens */}
      <ScrollArea className="w-full shrink-0 xl:w-[220px]">
        <div className="space-y-5 p-4">

          {/* Assignees */}
          <div>
            <span className="mb-2 block text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Assignees
            </span>
            <div className="space-y-1.5">
              {task.assignees.map((a) => (
                <div key={a} className="flex items-center gap-2">
                  <Avatar className="h-6 w-6">
                    <AvatarFallback className="text-[10px] font-semibold bg-accent">
                      {a.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm">{a}</span>
                </div>
              ))}
              <button className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground">
                <Plus className="h-3 w-3" />
                Add assignee
              </button>
            </div>
          </div>

          <Separator />

          {/* Dates */}
          <div>
            <span className="mb-2 block text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Dates
            </span>
            {task.dueDateISO || task.plannedStartISO || task.plannedEndISO ? (
              <div className="space-y-1.5 text-xs">
                {task.dueDateISO && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Due</span>
                    <span className="font-medium">{formatDate(task.dueDateISO)}</span>
                  </div>
                )}
                {task.plannedStartISO && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Start</span>
                    <span className="font-medium">{formatDate(task.plannedStartISO)}</span>
                  </div>
                )}
                {task.plannedEndISO && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">End</span>
                    <span className="font-medium">{formatDate(task.plannedEndISO)}</span>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs italic text-muted-foreground">No dates set</p>
            )}
          </div>

          <Separator />

          {/* Estimation */}
          <div>
            <span className="mb-2 block text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Estimation
            </span>
            <div className="space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Story points</span>
                <span className="font-mono font-medium">{task.storyPoints ?? "—"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Time estimate</span>
                <span className="font-mono font-medium">
                  {task.timeEstimateMinutes
                    ? `${Math.floor(task.timeEstimateMinutes / 60)}h ${task.timeEstimateMinutes % 60}m`
                    : "—"}
                </span>
              </div>
            </div>
          </div>

          {/* Labels */}
          {task.labels?.length > 0 && (
            <>
              <Separator />
              <div>
                <span className="mb-2 block text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Labels
                </span>
                <div className="flex flex-wrap gap-1">
                  {task.labels.map((label) => (
                    <Badge key={label} variant="secondary" className="h-5 px-1.5 text-[10px]">
                      {label}
                    </Badge>
                  ))}
                </div>
              </div>
            </>
          )}

        </div>
      </ScrollArea>
    </div>
  );
};

// ─── Tab: Activity ────────────────────────────────────────────────────────────

const ActivityTab = ({
  task,
  onAddComment,
}: {
  task: Task;
  onAddComment: (body: string) => void;
}) => {
  const [input, setInput] = useState("");

  const handleSend = () => {
    if (!input.trim()) return;
    onAddComment(input.trim());
    setInput("");
  };

  return (
    <div className="flex h-full flex-col">
      <ScrollArea className="flex-1">
        <div className="mx-auto w-full max-w-2xl px-5 py-4">
          {task.comments.length > 0 ? (
            <div className="space-y-0">
              {task.comments.map((comment, i) => (
                <div key={comment.id}>
                  {i > 0 && <Separator className="my-1" />}
                  <div className="py-3">
                    <div className="mb-1.5 flex items-center gap-2">
                      <Avatar className="h-6 w-6 shrink-0">
                        <AvatarFallback className="text-[10px] font-semibold bg-accent">
                          {comment.author.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-xs font-semibold">{comment.author}</span>
                      <span className="text-[11px] text-muted-foreground">{comment.timestamp}</span>
                    </div>
                    <p className="pl-8 text-sm leading-relaxed text-foreground">
                      {comment.body}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="py-4 text-xs italic text-muted-foreground">
              No activity yet. Be the first to comment.
            </p>
          )}
        </div>
      </ScrollArea>

      {/* Sticky comment input */}
      <div className="shrink-0 border-t border-border px-5 py-3">
        <div className="mx-auto flex w-full max-w-2xl gap-2">
          <Input
            placeholder="Add a comment…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
            className="h-8 text-sm"
          />
          <Button size="sm" className="h-8 shrink-0 px-3 text-xs" onClick={handleSend}>
            Send
          </Button>
        </div>
      </div>
    </div>
  );
};

// ─── Tab: Dependencies ────────────────────────────────────────────────────────

const DependencyRow = ({ dep }: { dep: Dependency }) => (
  <div
    className={cn(
      "flex items-center gap-3 rounded-md border px-3 py-2",
      dep.status === "Blocked"
        ? "border-red-500/30 bg-red-500/5"
        : "border-border bg-muted/20"
    )}
  >
    <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", STATUS_COLOR[dep.status as TaskStatus] ?? "bg-zinc-500")} />
    <div className="min-w-0 flex-1">
      <p className="truncate text-sm font-medium">{dep.title}</p>
      <p className="font-mono text-[10px] uppercase text-muted-foreground">{dep.taskId}</p>
    </div>
    <Badge variant="outline" className="h-4 shrink-0 px-1.5 text-[10px]">
      {dep.status}
    </Badge>
  </div>
);

const DependenciesTab = ({ task }: { task: Task }) => {
  const blockedByCount = task.dependencies.length;
  const blockingCount = 0; // populated from API in the future
  const blockingTasks: Dependency[] = [];
  const blockedByTasks = task.dependencies;

  return (
    <ScrollArea className="h-full">
      <div className="mx-auto w-full max-w-2xl space-y-5 p-5">

        {/* Impact Summary Banner */}
        {task.dependencies.length > 0 && (
          <div className="flex items-start gap-3 rounded-md border border-border bg-muted/30 p-3">
            <Zap className="mt-0.5 h-4 w-4 shrink-0 text-yellow-400" />
            <div>
              <p className="mb-0.5 text-xs font-semibold">Impact Summary</p>
              <p className="text-xs leading-relaxed text-muted-foreground">
                This task is blocking{" "}
                <span className="font-medium text-foreground">{blockingCount}</span> downstream{" "}
                task{blockingCount !== 1 ? "s" : ""} and is waiting on{" "}
                <span className="font-medium text-foreground">{blockedByCount}</span> upstream{" "}
                task{blockedByCount !== 1 ? "s" : ""}.
                {task.status === "Blocked" && (
                  <span className="ml-1 font-medium text-red-400">
                    This task is currently blocked.
                  </span>
                )}
              </p>
            </div>
          </div>
        )}

        {/* Blocking */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Blocking
            </span>
            <button className="flex items-center gap-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground">
              <Plus className="h-3 w-3" /> Add
            </button>
          </div>
          <div className="space-y-1.5">
            {blockingTasks.length > 0 ? (
              blockingTasks.map((dep) => <DependencyRow key={dep.id} dep={dep} />)
            ) : (
              <p className="px-2 text-xs italic text-muted-foreground">
                Not blocking any tasks
              </p>
            )}
          </div>
        </div>

        {/* Blocked By */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Blocked By
            </span>
            <button className="flex items-center gap-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground">
              <Plus className="h-3 w-3" /> Add
            </button>
          </div>
          <div className="space-y-1.5">
            {blockedByTasks.length > 0 ? (
              blockedByTasks.map((dep) => <DependencyRow key={dep.id} dep={dep} />)
            ) : (
              <p className="px-2 text-xs italic text-muted-foreground">
                Not blocked by anything
              </p>
            )}
          </div>
        </div>

      </div>
    </ScrollArea>
  );
};

// ─── Tab: History ─────────────────────────────────────────────────────────────

const HistoryTab = ({ task }: { task: Task }) => (
  <ScrollArea className="h-full">
    <div className="mx-auto w-full max-w-2xl p-5">
      {task.history.length > 0 ? (
        <div>
          {task.history.map((entry, i) => (
            <div key={entry.id}>
              {i > 0 && <Separator />}
              <div className="flex items-start gap-3 py-3">

                {/* Field tag */}
                <Badge
                  variant="outline"
                  className="mt-0.5 h-5 w-20 shrink-0 justify-center bg-muted/30 font-mono text-[10px] px-1.5"
                >
                  {entry.field}
                </Badge>

                {/* Change */}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5 text-xs">
                    {entry.from && (
                      <>
                        <span className="text-muted-foreground line-through opacity-60">
                          {entry.from}
                        </span>
                        <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground" />
                      </>
                    )}
                    <span className="font-medium text-foreground">{entry.to}</span>
                  </div>
                  {entry.note && (
                    <p className="mt-0.5 text-[11px] text-muted-foreground">{entry.note}</p>
                  )}
                </div>

                {/* User + timestamp */}
                <div className="shrink-0 text-right">
                  <p className="text-[11px] font-medium">{entry.user}</p>
                  <p className="text-[10px] text-muted-foreground">{formatRelTime(entry.timestamp)}</p>
                </div>

              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="py-4 text-center text-xs italic text-muted-foreground">
          No history yet
        </p>
      )}
    </div>
  </ScrollArea>
);

// ─── Root Component ───────────────────────────────────────────────────────────

export function TaskDetailPane({ task, onUpdateTask }: Props) {
  const [activeTab, setActiveTab] = useState("overview");

  // ── Empty state ──
  if (!task) {
    return (
      <div className="flex h-full flex-col items-center justify-center bg-background">
        <Empty className="w-full max-w-sm border-none shadow-none">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <FileText />
            </EmptyMedia>
            <EmptyTitle>No task selected</EmptyTitle>
            <EmptyDescription>
              Select a task from the list, or press{" "}
              <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-xs">
                C
              </kbd>{" "}
              to create a new one.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    );
  }

  const handleAddComment = (body: string) => {
    const newComment = {
      id: `c_${Date.now()}`,
      author: "You",
      body,
      timestamp: "Just now",
    };
    onUpdateTask?.(task.id, { comments: [...task.comments, newComment] });
  };

  return (
    <div className="flex h-full flex-col bg-background">

      {/* Zone 1: Compact header — never scrolls */}
      <TaskDetailHeader task={task} onUpdateTask={onUpdateTask} />

      {/* Zone 2 + 3: Tab bar + content */}
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="flex min-h-0 flex-1 flex-col"
      >
        {/* Tab bar — never scrolls, underline style */}
        <TabsList
          className="h-9 w-full shrink-0 justify-start gap-0 rounded-none border-b
                     border-border bg-transparent px-4"
        >
          {(
            [
              { value: "overview", label: "Overview" },
              { value: "activity", label: "Activity" },
              {
                value: "dependencies",
                label: "Dependencies",
                count: task.dependencies.length,
              },
              { value: "history", label: "History" },
            ] as const
          ).map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className={cn(
                // Reset ShadCN defaults that cause the box/card look
                "relative h-9 rounded-none border-b-2 border-transparent bg-transparent",
                "px-3 text-xs text-muted-foreground shadow-none transition-none",
                // Active state: underline + foreground text, no background
                "data-[state=active]:border-foreground data-[state=active]:bg-transparent",
                "data-[state=active]:text-foreground data-[state=active]:shadow-none",
                "hover:text-foreground"
              )}
            >
              {tab.label}
              {"count" in tab && tab.count > 0 && (
                <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0 text-[10px] text-muted-foreground">
                  {tab.count}
                </span>
              )}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* Tab content — each fills remaining height and scrolls independently */}
        <TabsContent value="overview" className="m-0 min-h-0 flex-1">
          <OverviewTab task={task} onUpdateTask={onUpdateTask} />
        </TabsContent>

        <TabsContent value="activity" className="m-0 min-h-0 flex-1">
          <ActivityTab task={task} onAddComment={handleAddComment} />
        </TabsContent>

        <TabsContent value="dependencies" className="m-0 min-h-0 flex-1">
          <DependenciesTab task={task} />
        </TabsContent>

        <TabsContent value="history" className="m-0 min-h-0 flex-1">
          <HistoryTab task={task} />
        </TabsContent>
      </Tabs>

    </div>
  );
}