import { useMemo, useState, useEffect } from "react";
import { Search, Plus, Flag } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { Task, TaskStatus } from "@/types/task";

type Props = {
  query: string;
  onQueryChange: (value: string) => void;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  tasks: Task[];
  selectedTaskId: string;
  onSelectTask: (id: string) => void;
  createDialogOpen: boolean;
  onCreateDialogOpenChange: (open: boolean) => void;
  onCreateTask: (task: Task) => void;
  onUpdateTask?: (id: string, updates: Partial<Task>) => void;
};

const STATUS_OPTIONS: TaskStatus[] = ["Backlog", "In Progress", "Blocked", "Done"];

const statusColorMap: Record<TaskStatus, string> = {
  "In Progress": "bg-blue-500",
  Blocked: "bg-red-500",
  Done: "bg-green-500",
  Backlog: "bg-zinc-500",
};

// Shortened labels so all 5 chips fit on one row at any pane width
const FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: "All", label: "All" },
  { value: "Mine", label: "Mine" },
  { value: "In Progress", label: "Active" },
  { value: "Blocked", label: "Blocked" },
  { value: "High Priority", label: "High" },
];

export function TaskListPane({
  query,
  onQueryChange,
  statusFilter,
  onStatusFilterChange,
  tasks,
  selectedTaskId,
  onSelectTask,
  createDialogOpen,
  onCreateDialogOpenChange,
  onCreateTask,
  onUpdateTask,
}: Props) {
  const [newProjectTitle, setNewProjectTitle] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newObjective, setNewObjective] = useState("");
  const [newSuccessCriteria, setNewSuccessCriteria] = useState("");
  const [newOwner, setNewOwner] = useState("");
  const [newDueDateISO, setNewDueDateISO] = useState("");
  const [newPlannedStartISO, setNewPlannedStartISO] = useState("");
  const [newPlannedEndISO, setNewPlannedEndISO] = useState("");
  const [newStatus, setNewStatus] = useState<TaskStatus>("Backlog");
  const [newPriority, setNewPriority] = useState<Task["priority"]>("Medium");
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());

  // Keyboard shortcut: press C to open create dialog
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        (e.target as HTMLElement).isContentEditable
      )
        return;
      if (e.key === "c" || e.key === "C") {
        e.preventDefault();
        onCreateDialogOpenChange(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onCreateDialogOpenChange]);

  const grouped = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const t of tasks) {
      const prev = map.get(t.projectTitle);
      if (prev) prev.push(t);
      else map.set(t.projectTitle, [t]);
    }
    return Array.from(map.entries()).map(([projectTitle, items]) => ({
      projectTitle,
      items,
    }));
  }, [tasks]);

  // Date helpers — convert ISO string to yyyy-mm-dd for <input type="date">
  const toDateInputValue = (iso: string) => {
    if (!iso) return "";
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
  };

  function resetCreateForm() {
    setNewProjectTitle("");
    setNewTitle("");
    setNewDescription("");
    setNewObjective("");
    setNewSuccessCriteria("");
    setNewOwner("");
    setNewDueDateISO("");
    setNewPlannedStartISO("");
    setNewPlannedEndISO("");
    setNewStatus("Backlog");
    setNewPriority("Medium");
  }

  function handleCreateSubmit(e: React.FormEvent) {
    e.preventDefault();
    const title = newTitle.trim();
    const projectTitle = newProjectTitle.trim();
    const objective = newObjective.trim();
    const successCriteria = newSuccessCriteria.trim();
    const owner = newOwner.trim();
    const dueISO = newDueDateISO ? new Date(newDueDateISO).toISOString() : "";
    if (!title || !projectTitle || !objective || !successCriteria || !owner || !dueISO)
      return;

    const task: Task = {
      id: `tsk_${Math.random().toString(16).slice(2, 10)}`,
      projectId: `prj_${Math.random().toString(16).slice(2, 10)}`,
      projectTitle,
      title,
      description: newDescription.trim() || undefined,
      objective,
      successCriteria,
      status: newStatus,
      priority: newPriority,
      owner,
      dueDateISO: dueISO,
      plannedStartISO: newPlannedStartISO
        ? new Date(newPlannedStartISO).toISOString()
        : undefined,
      plannedEndISO: newPlannedEndISO
        ? new Date(newPlannedEndISO).toISOString()
        : undefined,
      dependencies: [],
      context: [],
      subtasks: [],
      assignees: [],
      labels: [],
      activity: [{ id: "act_created", label: "Created", timestamp: "Just now" }],
      comments: [],
    };

    onCreateTask(task);
    resetCreateForm();
  }

  const toggleSelection = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const next = new Set(selectedTaskIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedTaskIds(next);
  };

  const handleBulkStatusChange = (status: TaskStatus) => {
    if (onUpdateTask) {
      selectedTaskIds.forEach((id) => onUpdateTask(id, { status }));
    }
    setSelectedTaskIds(new Set());
  };

  const isMultiSelecting = selectedTaskIds.size > 0;

  return (
    <div className="h-full min-h-0 flex flex-col w-full relative overflow-hidden">
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="px-3 pt-3 pb-2 border-b border-border/60 shrink-0">
        {/* Title row */}
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground leading-none mb-0.5">
              Work Queue
            </div>
            <div className="text-sm font-semibold leading-tight truncate">
              Pick a task to focus
            </div>
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0 shrink-0 rounded-md"
            onClick={() => onCreateDialogOpenChange(true)}
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Search */}
        <div className="relative mb-2">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Search tasks, projects…"
            className="pl-8 h-8 text-xs rounded-md"
          />
        </div>

        {/* Filter chips — single scrollable row, never wraps */}
        <div className="flex gap-1 overflow-x-auto scrollbar-none pb-0.5">
          {FILTER_OPTIONS.map(({ value, label }) => {
            const active = statusFilter === value;
            return (
              <button
                key={value}
                onClick={() => onStatusFilterChange(value)}
                className={cn(
                  "shrink-0 h-6 px-2.5 rounded text-[11px] font-medium transition-colors whitespace-nowrap",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Task list ──────────────────────────────────────────── */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="px-2 py-2 space-y-3 pb-20">
          {grouped.map((g) => (
            <div key={g.projectTitle}>
              {/* Group header */}
              <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500 px-2 pt-2 pb-1">
                {g.projectTitle}
              </div>

              {/* Task rows */}
              <div className="space-y-px">
                {g.items.map((t) => {
                  const active = t.id === selectedTaskId;
                  const isChecked = selectedTaskIds.has(t.id);
                  const isDone = t.status === "Done";
                  const isHighPriority =
                    t.priority === "High" || t.priority === "Critical";

                  return (
                    <div
                      key={t.id}
                      onClick={() => !isMultiSelecting && onSelectTask(t.id)}
                      className={cn(
                        "flex items-center gap-2 px-2 py-1.5 rounded-md transition-colors cursor-pointer group w-full min-w-0",
                        active && !isMultiSelecting
                          ? "bg-accent"
                          : "hover:bg-accent/50",
                        isDone && "opacity-50"
                      )}
                    >
                      {/* Multi-select checkbox */}
                      <div
                        className={cn(
                          "shrink-0 transition-opacity",
                          !isChecked && !isMultiSelecting
                            ? "opacity-0 group-hover:opacity-100"
                            : "opacity-100"
                        )}
                        onClick={(e) => toggleSelection(e, t.id)}
                      >
                        <Checkbox checked={isChecked} className="w-3.5 h-3.5" />
                      </div>

                      {/* Status dot — click opens popover */}
                      <Popover>
                        <PopoverTrigger asChild>
                          <button
                            onClick={(e) => e.stopPropagation()}
                            className={cn(
                              "w-2 h-2 rounded-full shrink-0 transition-transform hover:scale-125",
                              statusColorMap[t.status]
                            )}
                          />
                        </PopoverTrigger>
                        <PopoverContent
                          align="start"
                          className="w-36 p-1 rounded-lg shadow-lg"
                        >
                          {STATUS_OPTIONS.map((s) => (
                            <button
                              key={s}
                              onClick={(e) => {
                                e.stopPropagation();
                                onUpdateTask?.(t.id, { status: s });
                              }}
                              className="w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded-md hover:bg-accent/60 transition-colors"
                            >
                              <div
                                className={cn(
                                  "w-2 h-2 rounded-full shrink-0",
                                  statusColorMap[s]
                                )}
                              />
                              {s}
                            </button>
                          ))}
                        </PopoverContent>
                      </Popover>

                      {/* Title */}
                      <span className="text-sm font-medium truncate flex-1 leading-snug min-w-0">
                        {t.title}
                      </span>

                      {/* Right meta */}
                      <div className="flex items-center gap-1.5 shrink-0 text-[11px] text-muted-foreground">
                        {isHighPriority && (
                          <Flag className="w-3 h-3 text-orange-400 shrink-0" />
                        )}
                        {/* Owner — hide on very narrow panes */}
                        <span className="hidden sm:inline truncate max-w-[60px]">
                          {t.owner}
                        </span>
                        <span className="tabular-nums">
                          {t.dueDateISO
                            ? new Date(t.dueDateISO).toLocaleDateString(
                              undefined,
                              { month: "short", day: "numeric" }
                            )
                            : "—"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {grouped.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center gap-2">
              <p className="text-sm text-muted-foreground">No tasks found</p>
              <p className="text-xs text-muted-foreground/60">
                Press{" "}
                <kbd className="px-1.5 py-0.5 text-[10px] rounded border border-border bg-muted font-mono">
                  C
                </kbd>{" "}
                to create one
              </p>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* ── Floating bulk-action bar ───────────────────────────── */}
      {isMultiSelecting && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-popover border border-border shadow-lg px-3 py-2 rounded-full flex items-center gap-2.5 animate-in fade-in slide-in-from-bottom-3 z-10 whitespace-nowrap">
          <span className="text-xs font-medium">
            {selectedTaskIds.size} selected
          </span>

          <Select
            onValueChange={(v) => handleBulkStatusChange(v as TaskStatus)}
          >
            <SelectTrigger className="h-7 text-xs rounded-full border-border bg-background w-auto min-w-[110px]">
              <SelectValue placeholder="Change status" />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            size="sm"
            variant="ghost"
            className="h-7 rounded-full text-xs px-2"
            onClick={() => setSelectedTaskIds(new Set())}
          >
            Clear
          </Button>
        </div>
      )}

      {/* ── Create task dialog ────────────────────────────────── */}
      <Dialog
        open={createDialogOpen}
        onOpenChange={(open) => {
          onCreateDialogOpenChange(open);
          if (!open) resetCreateForm();
        }}
      >
        <DialogContent className="max-w-2xl p-0 gap-0">
          <form onSubmit={handleCreateSubmit}>
            {/* Modal header */}
            <div className="px-5 pt-5 pb-4 border-b border-border/60">
              <DialogHeader>
                <DialogTitle className="text-base">Create task</DialogTitle>
                <DialogDescription className="text-xs mt-0.5">
                  Capture the objective, criteria, owner, and dates.
                </DialogDescription>
              </DialogHeader>
            </div>

            <Tabs defaultValue="basics" className="w-full">
              <div className="px-5 pt-3">
                <TabsList className="h-8 text-xs w-full grid grid-cols-3">
                  <TabsTrigger value="basics" className="text-xs">
                    Basics
                  </TabsTrigger>
                  <TabsTrigger value="strategy" className="text-xs">
                    Strategy
                  </TabsTrigger>
                  <TabsTrigger value="schedule" className="text-xs">
                    Schedule
                  </TabsTrigger>
                </TabsList>
              </div>

              <div className="px-5 pt-3 pb-4 min-h-[220px]">
                {/* ── Basics tab ── */}
                <TabsContent value="basics" className="mt-0 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">
                        Project
                      </Label>
                      <Input
                        value={newProjectTitle}
                        onChange={(e) => setNewProjectTitle(e.target.value)}
                        placeholder="e.g. ClarityOS Launch"
                        className="h-8 text-xs"
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">
                        Title
                      </Label>
                      <Input
                        value={newTitle}
                        onChange={(e) => setNewTitle(e.target.value)}
                        placeholder="e.g. Draft dependency graph UI"
                        className="h-8 text-xs"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">
                      Description{" "}
                      <span className="opacity-50">(optional)</span>
                    </Label>
                    <Textarea
                      value={newDescription}
                      onChange={(e) => setNewDescription(e.target.value)}
                      placeholder="Optional context to help scanning in the list."
                      className="text-xs min-h-[70px] resize-none"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">
                        Owner
                      </Label>
                      <Input
                        value={newOwner}
                        onChange={(e) => setNewOwner(e.target.value)}
                        placeholder="e.g. Shivang"
                        className="h-8 text-xs"
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">
                        Status
                      </Label>
                      <Select
                        value={newStatus}
                        onValueChange={(v) => setNewStatus(v as TaskStatus)}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {STATUS_OPTIONS.map((s) => (
                            <SelectItem key={s} value={s} className="text-xs">
                              {s}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">
                        Priority
                      </Label>
                      <Select
                        value={newPriority}
                        onValueChange={(v) =>
                          setNewPriority(v as Task["priority"])
                        }
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {["Low", "Medium", "High", "Critical"].map((p) => (
                            <SelectItem key={p} value={p} className="text-xs">
                              {p}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </TabsContent>

                {/* ── Strategy tab ── */}
                <TabsContent value="strategy" className="mt-0 space-y-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">
                      Objective
                    </Label>
                    <Textarea
                      value={newObjective}
                      onChange={(e) => setNewObjective(e.target.value)}
                      placeholder="What are we trying to achieve?"
                      className="text-xs min-h-[90px] resize-none"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">
                      Success criteria
                    </Label>
                    <Textarea
                      value={newSuccessCriteria}
                      onChange={(e) => setNewSuccessCriteria(e.target.value)}
                      placeholder="How do we know it is done?"
                      className="text-xs min-h-[90px] resize-none"
                      required
                    />
                  </div>
                </TabsContent>

                {/* ── Schedule tab ── */}
                <TabsContent value="schedule" className="mt-0 space-y-3">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">
                        Due date
                      </Label>
                      <Input
                        type="date"
                        value={toDateInputValue(newDueDateISO)}
                        onChange={(e) =>
                          setNewDueDateISO(
                            e.target.value
                              ? new Date(e.target.value).toISOString()
                              : ""
                          )
                        }
                        className="h-8 text-xs"
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">
                        Planned start
                      </Label>
                      <Input
                        type="date"
                        value={toDateInputValue(newPlannedStartISO)}
                        onChange={(e) =>
                          setNewPlannedStartISO(
                            e.target.value
                              ? new Date(e.target.value).toISOString()
                              : ""
                          )
                        }
                        className="h-8 text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">
                        Planned end
                      </Label>
                      <Input
                        type="date"
                        value={toDateInputValue(newPlannedEndISO)}
                        onChange={(e) =>
                          setNewPlannedEndISO(
                            e.target.value
                              ? new Date(e.target.value).toISOString()
                              : ""
                          )
                        }
                        className="h-8 text-xs"
                      />
                    </div>
                  </div>
                </TabsContent>
              </div>
            </Tabs>

            {/* Modal footer */}
            <div className="px-5 py-3 border-t border-border/60 flex justify-end gap-2 bg-muted/20">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onCreateDialogOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm">
                Create task
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}