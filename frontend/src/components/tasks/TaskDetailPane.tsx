import { useState } from "react";
import {
  Calendar,
  ChevronRight,
  Flag,
  Plus,
  Zap,
  Github,
  Link2,
  FileText,
  Box,
  MoreVertical,
  Trash2,
  Search,
  X,
  Loader2,
  MessageSquare,
  Undo2,
  Download,
  PanelRightClose,
  Pencil,
} from "lucide-react";
import { format, formatDistanceToNow, isToday, isYesterday, differenceInDays } from "date-fns";
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
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { EditableText, EditableTextarea } from "@/components/ui/editable-text";
import { CreateTaskDialog } from "@/components/tasks/CreateTaskDialog";

import type { Task, TaskPriority, TaskStatus, Dependency } from "@/types/task";
import type { TaskDTO, UpdateTaskInput } from "@/hooks/api/useTasks";
import {
  useChangeTaskStatus,
  useTask,
  useUpdateTask,
  useDeleteTask,
  useAssignUser,
  useRemoveAssignee,
  useAddDependency,
  useRemoveDependency
} from "@/hooks/api/useTasks";
import { useWorkspaceMembers } from "@/hooks/api/useWorkspace";
import { useTaskComments, useCreateComment, useDeleteComment } from "@/hooks/api/useComments";
import type { Comment, ActivityLogEntry } from "@/types/task";
import { useAuth } from "@/contexts/AuthContext";
import { useTaskActivity } from "@/hooks/api/useActivity";

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = {
  task: TaskDTO | null;
  onUpdateTask?: (id: string, updates: Partial<Task>) => void;
  /** Called when the user deletes the displayed task */
  onTaskDeleted?: (id: string) => void;
  /** Called when the user wants to close the detail pane */
  onClose?: () => void;
};

// ─── Constants & Helpers ──────────────────────────────────────────────────────

const STATUS_OPTIONS: TaskStatus[] = ["backlog", "todo", "in-progress", "done"];

const STATUS_COLOR: Record<TaskStatus, string> = {
  done: "bg-emerald-500",
  "in-progress": "bg-blue-500",
  backlog: "bg-zinc-500",
  todo: "bg-violet-500",
};

const PRIORITY_OPTIONS: TaskPriority[] = ["low", "medium", "high", "urgent"];

const PRIORITY_CONFIG: Record<TaskPriority, { color: string; dot: string }> = {
  urgent: { color: "text-red-400 border-red-500/20", dot: "bg-red-400" },
  high: { color: "text-orange-400 border-orange-500/20", dot: "bg-orange-400" },
  medium: { color: "text-yellow-400 border-yellow-500/20", dot: "bg-yellow-400" },
  low: { color: "text-zinc-500 border-zinc-600/30", dot: "bg-zinc-500" },
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

/** Clickable priority badge that opens a popover to change priority */
const PriorityBadge = ({
  priority,
  onPriorityChange,
}: {
  priority: TaskPriority;
  onPriorityChange?: (p: TaskPriority) => void;
}) => {
  const cfg = PRIORITY_CONFIG[priority] ?? PRIORITY_CONFIG.low;

  if (!onPriorityChange) {
    return (
      <Badge variant="outline" className={cn("h-5 gap-1 px-1.5 text-[11px]", cfg.color)}>
        <Flag className="h-3 w-3" />
        {priority}
      </Badge>
    );
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Badge
          variant="outline"
          className={cn("h-5 gap-1 px-1.5 text-[11px] cursor-pointer hover:bg-accent transition-colors", cfg.color)}
        >
          <Flag className="h-3 w-3" />
          {priority}
        </Badge>
      </PopoverTrigger>
      <PopoverContent className="w-40 p-1" align="start">
        {PRIORITY_OPTIONS.map((p) => {
          const pcfg = PRIORITY_CONFIG[p];
          return (
            <button
              key={p}
              onClick={() => onPriorityChange(p)}
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm
                         hover:bg-accent transition-colors text-left"
            >
              <span className={cn("h-1.5 w-1.5 rounded-full", pcfg.dot)} />
              {p}
            </button>
          );
        })}
      </PopoverContent>
    </Popover>
  );
};

/** Stacked avatar chips with tooltip for each assignee */
const AssigneesChip = ({ assignees }: { assignees: { id: string, name: string | null, email: string }[] }) => (
  <TooltipProvider delayDuration={300}>
    <div className="flex items-center -space-x-1.5">
      {assignees.slice(0, 3).map((a) => (
        <Tooltip key={a.id}>
          <TooltipTrigger asChild>
            <Avatar className="h-5 w-5 cursor-default ring-1 ring-background">
              <AvatarFallback className="text-[9px] font-semibold bg-accent">
                {(a.name || a.email).charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            {a.name || a.email}
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
  onUpdateField,
  onDelete,
  onClose,
  onEditTask,
}: {
  task: TaskDTO;
  onUpdateField?: (updates: UpdateTaskInput) => void;
  onDelete?: () => void;
  onClose?: () => void;
  onEditTask?: () => void;
}) => {
  const changeStatus = useChangeTaskStatus();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const handleStatusChange = (newStatus: TaskStatus) => {
    changeStatus.mutate({ id: task.id, status: newStatus });
  };

  const handleMarkDone = () => {
    changeStatus.mutate({ id: task.id, status: "done" });
  };

  const handlePriorityChange = (newPriority: TaskPriority) => {
    onUpdateField?.({ priority: newPriority });
  };

  return (
    <div className="shrink-0 border-b border-border px-5 pt-4 pb-3">

      {/* Breadcrumb + Actions row */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 flex-1 min-w-0 pr-4">
          {/* Close detail pane button */}
          {onClose && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
              onClick={onClose}
              title="Close detail pane"
            >
              <PanelRightClose className="h-3.5 w-3.5" />
            </Button>
          )}

          <Breadcrumb className="flex-1 min-w-0">
            <BreadcrumbList className="text-sm items-center flex-nowrap shrink-0">
              <BreadcrumbItem className="hidden sm:block">
                <span className="cursor-pointer font-medium text-muted-foreground hover:text-foreground transition-colors">
                  Task
                </span>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden sm:block">
                <ChevronRight className="h-4 w-4" />
              </BreadcrumbSeparator>
              <BreadcrumbItem className="flex-1 min-w-0">
                <EditableText
                  value={task.title}
                  onSave={(title) => onUpdateField?.({ title })}
                  placeholder="Untitled task"
                  className="text-sm font-medium text-foreground truncate"
                  inputClassName="text-sm font-medium text-foreground truncate"
                />
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            variant={task.status === "done" ? "secondary" : "default"}
            className="h-6 px-3 text-xs"
            onClick={handleMarkDone}
            disabled={task.status === "done" || changeStatus.isPending}
          >
            {task.status === "done" ? "Done ✓" : "Mark done"}
          </Button>

          {/* Actions dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                <MoreVertical className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onClick={() => onEditTask?.()}>
                <Pencil className="mr-2 h-3.5 w-3.5" />
                Edit task
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => setDeleteDialogOpen(true)}
              >
                <Trash2 className="mr-2 h-3.5 w-3.5" />
                Delete task
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Action buttons area (status/labels below will follow) */}

      {/* Chips row */}
      <div className="flex flex-wrap items-center gap-1.5">
        <StatusBadge status={task.status} onStatusChange={handleStatusChange} />
        <PriorityBadge priority={task.priority} onPriorityChange={handlePriorityChange} />
        <AssigneesChip assignees={task.assignees ?? []} />

        {(task.due_date || task.dueDateISO) && (
          <Badge variant="outline" className="h-5 gap-1 px-1.5 text-[11px]">
            <Calendar className="h-3 w-3" />
            {formatDate(task.due_date || task.dueDateISO!)}
          </Badge>
        )}

        {task.story_points != null && (
          <Badge variant="outline" className="h-5 px-1.5 font-mono text-[11px]">
            {task.story_points}p
          </Badge>
        )}

        {(task.labels ?? []).map((label) => (
          <Badge key={label} variant="secondary" className="h-5 px-1.5 text-[10px]">
            {label}
          </Badge>
        ))}
      </div>

      {/* Delete confirmation dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete task</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>"{task.title}"</strong>? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => onDelete?.()}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

// ─── Bulleted List Editor ─────────────────────────────────────────────────────

const BulletListEditor = ({
  title,
  value,
  onSave,
  placeholder,
}: {
  title: string;
  value: string;
  onSave: (val: string) => void;
  placeholder: string;
}) => {
  const points = value ? value.split("\n").filter(Boolean) : [];
  const [newPoint, setNewPoint] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  const handleAdd = () => {
    if (newPoint.trim()) {
      onSave([...points, newPoint.trim()].join("\n"));
      setNewPoint("");
      setIsAdding(false);
    }
  };

  const handleDelete = (index: number) => {
    const newPoints = points.filter((_, i) => i !== index);
    onSave(newPoints.join("\n"));
  };

  return (
    <div className="flex flex-col h-full">
      {/* Title & Add Button header */}
      <div className="flex items-center justify-between mb-3 shrink-0">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          {title}
        </span>
        {!isAdding && (
          <button
            onClick={() => setIsAdding(true)}
            className="flex items-center gap-1 text-[10px] uppercase font-semibold text-muted-foreground transition-colors hover:text-foreground"
          >
            <Plus className="h-3.5 w-3.5" />
            Add
          </button>
        )}
      </div>

      <ScrollArea className="flex-1 min-h-0 max-h-[160px] pr-2">
        {points.length > 0 ? (
          <ul className="space-y-1.5">
            {points.map((pt, i) => (
              <li key={i} className="group flex items-start gap-2.5 text-sm text-foreground">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/60" />
                <span className="flex-1 leading-snug">{pt}</span>
                <button
                  onClick={() => handleDelete(i)}
                  className="mt-0.5 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity shrink-0"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs italic text-muted-foreground">{placeholder}</p>
        )}
      </ScrollArea>

      {isAdding && (
        <div className="pt-2 shrink-0">
          <div className="flex items-center gap-2">
            <Input
              autoFocus
              value={newPoint}
              onChange={(e) => setNewPoint(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAdd();
                if (e.key === "Escape") {
                  setIsAdding(false);
                  setNewPoint("");
                }
              }}
              onBlur={() => {
                // If clicked outside and it's empty, close input. Otherwise keep it or save it.
                if (newPoint.trim()) handleAdd();
                else setIsAdding(false);
              }}
              placeholder="Type a point and press Enter..."
              className="h-8 text-xs"
            />
            <Button size="sm" variant="ghost" className="h-8 w-8 p-0 shrink-0" onClick={() => setIsAdding(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Tab: Overview ────────────────────────────────────────────────────────────

const OverviewTab = ({
  task,
  onUpdateTask,
  onUpdateField,
}: {
  task: TaskDTO;
  onUpdateTask?: (id: string, updates: Partial<Task>) => void;
  onUpdateField?: (updates: UpdateTaskInput) => void;
}) => {
  const [isAssigneePickerOpen, setIsAssigneePickerOpen] = useState(false);
  const [assigneeSearch, setAssigneeSearch] = useState("");

  const { data: members } = useWorkspaceMembers(task.workspace_id);
  const assignUser = useAssignUser();
  const removeAssignee = useRemoveAssignee();

  const handleAssignUser = (userId: string) => {
    assignUser.mutate({ id: task.id, userId });
  };

  const handleRemoveAssignee = (userId: string) => {
    removeAssignee.mutate({ id: task.id, userId });
  };
  const completedCount = (task.subtasks ?? []).filter((s) => s.done).length;
  const progressPercent =
    (task.subtasks ?? []).length > 0
      ? Math.round((completedCount / (task.subtasks ?? []).length) * 100)
      : 0;

  const toggleSubtask = (subId: string) => {
    const updated = (task.subtasks ?? []).map((s) =>
      s.id === subId ? { ...s, done: !s.done } : s
    );
    onUpdateTask?.(task.id, { subtasks: updated });
  };

  return (
    <div className="flex h-full flex-col md:flex-row md:divide-x md:divide-border w-full min-w-0">

      {/* ── LEFT: Main content ── */}
      <ScrollArea className="flex-1 min-w-0">
        <div className="space-y-6 p-5 pr-6 w-full">

          {/* Description */}
          <div>
            <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Description
            </span>
            <EditableTextarea
              value={task.description ?? ""}
              onSave={(description) => onUpdateField?.({ description })}
              placeholder="Add a description…"
              minRows={2}
            />
          </div>

          {/* Objective + Success Criteria */}
          <div className="grid grid-cols-1 gap-px bg-border sm:grid-cols-2 rounded-md overflow-hidden border border-border/40">
            <div className="bg-background p-4 min-h-[120px]">
              <BulletListEditor
                title="Objective"
                value={task.objective ?? ""}
                onSave={(objective) => onUpdateField?.({ objective })}
                placeholder="No objective points set"
              />
            </div>
            <div className="bg-background p-4 min-h-[120px]">
              <BulletListEditor
                title="Success Criteria"
                value={task.success_criteria ?? ""}
                onSave={(success_criteria) => onUpdateField?.({ success_criteria })}
                placeholder="No criteria points set"
              />
            </div>
          </div>

          {/* Subtasks */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Subtasks
              </span>
              <span className="font-mono text-[11px] text-muted-foreground">
                {completedCount}/{(task.subtasks ?? []).length} complete
              </span>
            </div>

            {/* ShadCN Progress component */}
            <Progress value={progressPercent} className="mb-3 h-1" />

            <div>
              {(task.subtasks ?? []).map((sub) => (
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

              {(task.subtasks ?? []).length === 0 && (
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
            {(task.context ?? []).length > 0 ? (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {(task.context ?? []).map((item) => (
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

      {/* ── RIGHT: Sidebar ── */}
      <ScrollArea className="w-full shrink-0 md:w-[280px] lg:w-[300px]">
        <div className="space-y-5 p-5 pl-6">

          {/* Assignees */}
          <div>
            <span className="mb-2 block text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Assignees
            </span>
            <div className="space-y-1.5">
              {(task.assignees ?? []).map((a) => {
                const name = a.name || a.email;
                return (
                  <div key={a.id} className="group flex items-center justify-between rounded hover:bg-accent/40 px-1 -mx-1">
                    <div className="flex items-center gap-2">
                      <Avatar className="h-6 w-6">
                        <AvatarFallback className="text-[10px] font-semibold bg-accent">
                          {name.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm">{name}</span>
                    </div>
                    <button
                      onClick={() => handleRemoveAssignee(a.id)}
                      className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-red-500 transition-all rounded-md"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })}

              <Popover open={isAssigneePickerOpen} onOpenChange={setIsAssigneePickerOpen}>
                <PopoverTrigger asChild>
                  <button className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground">
                    <Plus className="h-3 w-3" />
                    Add assignee
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-56 p-2" align="start">
                  <div className="flex items-center gap-2 border-b border-border pb-2 mb-2 px-1">
                    <Search className="h-4 w-4 text-muted-foreground shrink-0" />
                    <Input
                      placeholder="Search members..."
                      value={assigneeSearch}
                      onChange={(e) => setAssigneeSearch(e.target.value)}
                      className="h-7 border-none shadow-none focus-visible:ring-0 px-0 outline-none"
                    />
                  </div>
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {members
                      ?.filter(m => !(task.assignees ?? []).some(a => a.id === m.user_id))
                      .filter(m => (m.user.name || m.user.email).toLowerCase().includes(assigneeSearch.toLowerCase()))
                      .map((m) => {
                        const mName = m.user.name || m.user.email;
                        return (
                          <button
                            key={m.id}
                            onClick={() => {
                              handleAssignUser(m.user_id);
                              setIsAssigneePickerOpen(false);
                            }}
                            className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-accent transition-colors text-left"
                          >
                            <Avatar className="h-5 w-5 shrink-0">
                              <AvatarFallback className="text-[9px] bg-accent">
                                {mName.charAt(0).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <span className="truncate">{mName}</span>
                          </button>
                        );
                      })
                    }
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <Separator />

          {/* Dates */}
          <div>
            <span className="mb-2 block text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Dates
            </span>
            {(task.due_date || task.dueDateISO || task.plannedStartISO || task.plannedEndISO) ? (
              <div className="space-y-1.5 text-xs">
                {(task.due_date || task.dueDateISO) && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Due</span>
                    <span className="font-medium">{formatDate(task.due_date || task.dueDateISO!)}</span>
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
                <span className="font-mono font-medium">{task.story_points ?? "—"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Time estimate</span>
                <span className="font-mono font-medium">
                  {task.time_estimate
                    ? `${Math.floor(task.time_estimate / 60)}h ${task.time_estimate % 60}m`
                    : "—"}
                </span>
              </div>
            </div>
          </div>

          {/* Labels */}
          {(task.labels ?? []).length > 0 && (
            <>
              <Separator />
              <div>
                <span className="mb-2 block text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Labels
                </span>
                <div className="flex flex-wrap gap-1">
                  {(task.labels ?? []).map((label) => (
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

// ─── Comment Node ─────────────────────────────────────────────────────────────

const CommentNode = ({ comment, taskId }: { comment: Comment; taskId: string }) => {
  const authorName = comment.user?.name || comment.user?.email || "Unknown";
  const [isReplying, setIsReplying] = useState(false);
  const [replyInput, setReplyInput] = useState("");
  const createComment = useCreateComment();
  const deleteComment = useDeleteComment();
  const { user } = useAuth();

  const handleReplySubmit = () => {
    if (!replyInput.trim()) return;
    createComment.mutate(
      { taskId, content: replyInput.trim(), parent_comment_id: comment.id },
      {
        onSuccess: () => {
          setReplyInput("");
          setIsReplying(false);
        }
      }
    );
  };

  const handleDelete = () => {
    if (window.confirm("Are you sure you want to delete this comment?")) {
      deleteComment.mutate({ commentId: comment.id, taskId });
    }
  };

  return (
    <div className="group relative flex items-start gap-4 px-4 py-1.5 hover:bg-black/5 dark:hover:bg-accent/40 transition-colors -mx-4 rounded-md">
      {/* Author Avatar */}
      <Avatar className="h-10 w-10 shrink-0 rounded-full cursor-pointer hover:opacity-80 transition-opacity mt-0.5">
        <AvatarFallback className="text-[15px] font-semibold bg-indigo-500 text-white">
          {authorName.charAt(0).toUpperCase()}
        </AvatarFallback>
      </Avatar>

      {/* Content Column */}
      <div className="flex-1 min-w-0 flex flex-col pt-0.5">
        {/* Author Name & Time */}
        <div className="flex items-baseline gap-2 leading-none mb-1">
          <span className="text-[15px] font-medium text-foreground hover:underline cursor-pointer">
            {authorName}
          </span>
          <span className="text-xs text-muted-foreground font-medium">
            {formatRelTime(comment.created_at)}
          </span>
        </div>

        {/* Message Content */}
        <p className="text-[15px] leading-relaxed text-foreground/90 whitespace-pre-wrap">
          {comment.content}
        </p>

        {/* Floating Action Menu */}
        <div className="absolute right-4 -top-3 opacity-0 group-hover:opacity-100 transition-opacity bg-background border border-border shadow-sm rounded-md flex items-center overflow-hidden z-10">
          <button
            onClick={() => setIsReplying(!isReplying)}
            className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors flex items-center justify-center"
            title="Reply"
          >
            <span className="text-xs font-semibold px-2">Reply</span>
          </button>
          
          {user?.id === comment.user_id && (
            <button
              onClick={handleDelete}
              disabled={deleteComment.isPending}
              className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors flex items-center justify-center disabled:opacity-50"
              title="Delete message"
            >
              {deleteComment.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
            </button>
          )}
        </div>

        {/* Reply Box Toggle */}
        {isReplying && (
          <div className="mt-2 flex items-center gap-2 max-w-2xl bg-muted/50 p-1 rounded-md border border-border/40 focus-within:border-border/80">
            <Input
              autoFocus
              placeholder="Write a reply..."
              value={replyInput}
              onChange={(e) => setReplyInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleReplySubmit()}
              className="h-8 flex-1 text-sm bg-transparent border-none shadow-none focus-visible:ring-0"
            />
            <Button
              size="sm"
              className="h-7 shrink-0 px-3 text-xs rounded"
              onClick={handleReplySubmit}
              disabled={createComment.isPending || !replyInput.trim()}
            >
              {createComment.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Post"}
            </Button>
          </div>
        )}

        {/* Nested Replies tree */}
        {(comment.replies?.length ?? 0) > 0 && (
          <div className="mt-2 space-y-0 relative border-l-2 border-muted pl-4 ml-2">
            {comment.replies.map((reply) => (
              <CommentNode key={reply.id} comment={reply} taskId={taskId} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Tab: Activity ────────────────────────────────────────────────────────────

const ActivityTab = ({
  task,
}: {
  task: TaskDTO;
}) => {
  const [input, setInput] = useState("");
  const { data: comments, isPending } = useTaskComments(task.id);
  const createComment = useCreateComment();

  const handleSend = () => {
    if (!input.trim()) return;
    createComment.mutate(
      { taskId: task.id, content: input.trim() },
      { onSuccess: () => setInput("") }
    );
  };

  return (
    <div className="flex flex-1 min-h-0 flex-col bg-background h-full">
      <ScrollArea className="flex-1 min-h-0">
        <div className="w-full px-8 py-6 flex flex-col min-h-full justify-end max-w-5xl mx-auto">
          {isPending ? (
            <div className="flex justify-center py-8 my-auto">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (comments ?? []).length > 0 ? (
            <div className="space-y-0.5 mt-auto">
              {(comments ?? []).map((comment) => (
                <CommentNode key={comment.id} comment={comment} taskId={task.id} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center my-auto py-12 text-center">
              <div className="h-16 w-16 bg-accent rounded-full mb-4 flex items-center justify-center">
                <MessageSquare className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="font-semibold text-lg text-foreground">Welcome to the conversation</h3>
              <p className="mt-1 text-sm text-muted-foreground">This is the start of the activity history for this task.</p>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Sticky comment input - Discord Style */}
      <div className="shrink-0 px-6 pb-6 pt-2">
        <div className="flex items-center gap-3 w-full max-w-5xl mx-auto bg-muted/60 dark:bg-muted/40 rounded-xl px-4 py-2 border border-border/30 focus-within:ring-1 focus-within:ring-muted-foreground/30 transition-all">
          <button className="flex items-center justify-center h-6 w-6 rounded-full bg-muted-foreground/20 hover:bg-muted-foreground/40 text-muted-foreground transition-colors shrink-0">
            <Plus className="h-4 w-4" />
          </button>
          <Input
            placeholder="Add a new comment..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
            className="h-9 text-[15px] border-none shadow-none bg-transparent focus-visible:ring-0 p-0 text-foreground placeholder:text-muted-foreground/70"
          />
          <Button
            size="sm"
            variant="ghost"
            className="h-8 shrink-0 px-3 text-sm hover:bg-accent/50 text-muted-foreground hover:text-foreground font-semibold rounded"
            onClick={handleSend}
            disabled={createComment.isPending || !input.trim()}
          >
            {createComment.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send"}
          </Button>
        </div>
      </div>
    </div>
  );
};

// ─── Tab: Dependencies ────────────────────────────────────────────────────────

const DependencyRow = ({ dep, onRemove }: { dep: Dependency, onRemove?: () => void }) => {
  const priorityCfg = PRIORITY_CONFIG[dep.priority as TaskPriority] ?? PRIORITY_CONFIG.low;

  return (
    <div
      className={cn(
        "group flex items-center gap-3 rounded-md border px-3 py-2",
        dep.status !== "done"
          ? "border-border bg-muted/20"
          : "border-border bg-muted/20"
      )}
    >
      <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", STATUS_COLOR[dep.status as TaskStatus] ?? "bg-zinc-500")} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium">{dep.title}</p>
          <Badge variant="outline" className={cn("h-4 shrink-0 px-1 gap-1 text-[9px]", priorityCfg.color)}>
            <Flag className="h-2 w-2" />
            {dep.priority}
          </Badge>
        </div>
        <p className="font-mono text-[10px] uppercase text-muted-foreground">{dep.id}</p>
      </div>
      <Badge variant="outline" className="h-4 shrink-0 px-1.5 text-[10px]">
        {dep.status}
      </Badge>
      {onRemove && (
        <button
          onClick={onRemove}
          className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-red-500 transition-all rounded-md shrink-0"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
};

const DependenciesTab = ({ task }: { task: TaskDTO }) => {
  const [dependencyInput, setDependencyInput] = useState("");
  const addDependency = useAddDependency();
  const removeDependency = useRemoveDependency();

  const handleAddDependency = (e: React.FormEvent) => {
    e.preventDefault();
    if (!dependencyInput.trim()) return;
    addDependency.mutate(
      { id: task.id, dependsOnTaskId: dependencyInput.trim() },
      { onSuccess: () => setDependencyInput("") }
    );
  };

  const handleRemoveDependency = (blockedByTaskId: string) => {
    removeDependency.mutate({ id: task.id, blockedByTaskId });
  };

  const blockedByCount = (task.dependencies ?? []).length;
  const blockedByTasks = task.dependencies ?? [];

  return (
    <ScrollArea className="h-full">
      <div className="mx-auto w-full max-w-2xl space-y-5 p-5">

        {/* Impact Summary Banner */}
        {(task.dependencies ?? []).length > 0 && (
          <div className="flex items-start gap-3 rounded-md border border-border bg-muted/30 p-3">
            <Zap className="mt-0.5 h-4 w-4 shrink-0 text-yellow-400" />
            <div>
              <p className="mb-0.5 text-xs font-semibold">Impact Summary</p>
              <p className="text-xs leading-relaxed text-muted-foreground">
                This task is waiting on{" "}
                <span className="font-medium text-foreground">{blockedByCount}</span> upstream{" "}
                task{blockedByCount !== 1 ? "s" : ""}.
              </p>
            </div>
          </div>
        )}

        {/* Blocked By */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Blocked By
            </span>
          </div>

          <form className="mb-3 flex items-center gap-2" onSubmit={handleAddDependency}>
            <Input
              placeholder="Paste Task ID to add dependency..."
              value={dependencyInput}
              onChange={(e) => setDependencyInput(e.target.value)}
              className="h-8 text-xs"
            />
            <Button size="sm" type="submit" className="h-8 text-xs shrink-0" disabled={addDependency.isPending}>
              Add
            </Button>
          </form>

          <div className="space-y-1.5">
            {blockedByTasks.length > 0 ? (
              blockedByTasks.map((dep) => (
                <DependencyRow
                  key={dep.id}
                  dep={dep}
                  onRemove={() => handleRemoveDependency(dep.id)}
                />
              ))
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

/** Maps a raw action_type string to a human-readable action past-tense description. */
function getActionDescOnly(entry: ActivityLogEntry): string {
  switch (entry.action_type) {
    case "task_created": return "created task";
    case "status_changed": return "changed status";
    case "priority_changed": return "changed priority";
    case "assignment_added": return "assigned task";
    case "assignment_removed": return "removed assignee";
    case "due_date_changed": return "updated due date";
    case "dependency_added": return "added dependency";
    case "dependency_removed": return "removed dependency";
    case "comment_created": return "added comment";
    case "comment_deleted": return "deleted comment";
    case "objective_updated": return "updated objective";
    case "success_criteria_updated": return "updated success criteria";
    case "title_updated": return "updated title";
    case "description_updated": return "updated description";
    default: return `performed ${entry.action_type}`;
  }
}

/** Legacy overall label for fallback */
function formatActionLabel(entry: ActivityLogEntry): string {
  switch (entry.action_type) {
    case "task_created": return "Task created";
    case "status_changed": return `Status changed from "${entry.old_value?.status}" to "${entry.new_value?.status}"`;
    case "priority_changed": return `Priority changed from "${entry.old_value?.priority}" to "${entry.new_value?.priority}"`;
    case "assignment_added": return "Assigned to a user";
    case "assignment_removed": return "Unassigned a user";
    case "due_date_changed": return "Due date updated";
    case "dependency_added": return "Dependency added";
    case "dependency_removed": return "Dependency removed";
    case "comment_created": return "Comment added";
    case "comment_deleted": return "Comment deleted";
    case "objective_updated": return "Objective updated";
    case "success_criteria_updated": return "Success criteria updated";
    case "title_updated": return "Title updated";
    case "description_updated": return "Description updated";
    default: return entry.action_type;
  }
}

const HistoryTab = ({ task }: { task: TaskDTO }) => {
  const { data: entries, isPending } = useTaskActivity(task.id);
  const [filter, setFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredEntries = (entries ?? []).filter((entry) => {
    if (filter === "status" && entry.action_type !== "status_changed") return false;
    if (filter === "fields" && !["title_updated", "description_updated", "due_date_changed", "objective_updated", "success_criteria_updated", "priority_changed"].includes(entry.action_type)) return false;
    if (filter === "people" && !["assignment_added", "assignment_removed"].includes(entry.action_type)) return false;

    if (searchQuery) {
      const searchStr = `${entry.user?.name} ${entry.user?.email} ${formatActionLabel(entry)}`.toLowerCase();
      if (!searchStr.includes(searchQuery.toLowerCase())) return false;
    }

    return true;
  });

  // Group by relative day
  const groupedEntries = filteredEntries.reduce((acc, entry) => {
    const d = new Date(entry.created_at);
    let groupPrefix = "Date";
    if (isToday(d)) groupPrefix = "Today";
    else if (isYesterday(d)) groupPrefix = "Yesterday";
    else groupPrefix = format(d, "MMM d, yyyy");

    const groupKey = (isToday(d) || isYesterday(d)) ? `${groupPrefix} · ${format(d, "MMM d, yyyy")}` : groupPrefix;
    if (!acc[groupKey]) acc[groupKey] = [];
    acc[groupKey].push(entry);
    return acc;
  }, {} as Record<string, typeof filteredEntries>);

  // Summary Metrics
  const totalChanges = (entries ?? []).length;
  const fieldEdits = (entries ?? []).filter(e => ["title_updated", "description_updated", "due_date_changed", "objective_updated", "success_criteria_updated", "priority_changed"].includes(e.action_type)).length;
  const statusChangesCount = (entries ?? []).filter(e => e.action_type === "status_changed").length;
  const taskAge = differenceInDays(new Date(), new Date(task.created_at));

  // Most active users
  const userCounts = (entries ?? []).reduce((acc, entry) => {
    const u = entry.user;
    if (!u) return acc;
    const name = u.name || u.email;
    if (!acc[name]) acc[name] = { count: 0, initials: name.charAt(0).toUpperCase() };
    acc[name].count++;
    return acc;
  }, {} as Record<string, { count: number; initials: string; }>);
  const mostActive = Object.entries(userCounts).sort((a, b) => b[1].count - a[1].count).slice(0, 5);

  // Field change log summary
  const fieldLog = {
    dueDate: (entries ?? []).filter(e => e.action_type === "due_date_changed").length,
    priority: (entries ?? []).filter(e => e.action_type === "priority_changed").length,
    assignees: (entries ?? []).filter(e => ["assignment_added", "assignment_removed"].includes(e.action_type)).length,
  };

  return (
    <div className="flex h-full flex-1 min-h-0 flex-col md:flex-row md:divide-x md:divide-border/40 w-full min-w-0 bg-background text-foreground overflow-hidden">
      {/* ── LEFT: Main History List ── */}
      <div className="flex flex-1 flex-col min-h-0 min-w-0">
        {/* Top Filter Bar */}
        <div className="px-6 py-4 border-b border-border/40 shrink-0 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
            {["All changes", "Status", "Fields", "People"].map((f) => {
              const fKey = f.split(" ")[0].toLowerCase();
              const isActive = filter === fKey || (f === "All changes" && filter === "all");
              return (
                <button
                  key={f}
                  onClick={() => setFilter(fKey)}
                  className={cn(
                    "px-4 py-1.5 text-[13px] font-semibold rounded-md border transition-colors whitespace-nowrap",
                    isActive 
                      ? "bg-muted border-border text-foreground" 
                      : "bg-transparent border-border/50 hover:bg-muted/50 text-muted-foreground hover:text-foreground"
                  )}
                >
                  {f}
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search history"
                className="h-9 pl-9 text-sm w-[200px] bg-muted/40 border-border/60 hover:bg-muted/60 transition-colors"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            {/* Download/Export Button Placehoder */}
            <div className="h-9 w-9 flex items-center justify-center rounded-md border border-border/60 bg-transparent hover:bg-muted/50 cursor-pointer text-muted-foreground hover:text-foreground transition-colors">
              <Download className="h-4 w-4" />
            </div>
          </div>
        </div>

        {/* History List Component */}
        <ScrollArea className="flex-1 min-w-0 min-h-0 bg-accent/20">
          <div className="p-8 max-w-4xl mx-auto w-full">
            {isPending ? (
              <div className="flex justify-center py-10">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : Object.keys(groupedEntries).length > 0 ? (
              <div className="space-y-8">
                {Object.entries(groupedEntries).map(([dateLabel, groupEntries]) => (
                  <div key={dateLabel}>
                    {/* Date separator */}
                    <div className="flex items-center gap-4 mb-5">
                      <div className="flex-1 h-px bg-border/60" />
                      <span className="text-xs font-medium text-muted-foreground px-2">
                        {dateLabel}
                      </span>
                      <div className="flex-1 h-px bg-border/60" />
                    </div>

                    {/* Group entries */}
                    <div className="relative space-y-0 text-foreground">
                      {groupEntries.map((entry, idx) => {
                        const actor = entry.user?.name ?? entry.user?.email ?? "System";
                        const isLast = idx === groupEntries.length - 1;
                        
                        // Action Detail Component Parsing
                        let detailUi = null;
                        if (entry.action_type === "status_changed") {
                          detailUi = (
                            <div className="flex items-center gap-2 mt-2 px-3 py-1.5 bg-background border border-border/50 rounded-full w-fit text-xs font-mono shadow-sm">
                              <span className="opacity-50 line-through">{entry.old_value?.status || "None"}</span>
                              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                              <span className="text-foreground">{entry.new_value?.status}</span>
                            </div>
                          );
                        } else if (entry.action_type === "priority_changed") {
                           detailUi = (
                            <div className="flex items-center gap-2 mt-2 px-3 py-1.5 bg-background border border-border/50 rounded-full w-fit text-xs font-mono shadow-sm">
                              <span className="opacity-50 line-through">{entry.old_value?.priority || "None"}</span>
                              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                              <span className="text-foreground">{entry.new_value?.priority}</span>
                            </div>
                          );
                        } else if (entry.action_type === "description_updated") {
                           detailUi = (
                             <div className="mt-2 text-[14px] text-muted-foreground max-w-xl line-clamp-2 leading-relaxed">
                               {entry.new_value?.description || "Description removed"}
                             </div>
                           );
                        } else if (entry.action_type === "assignment_added") {
                          detailUi = (
                            <div className="flex items-center gap-2 mt-2 px-3 py-1.5 bg-background border border-border/50 rounded-full w-fit text-xs font-medium shadow-sm">
                              <span className="text-indigo-400">Assigned</span>
                              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                              <span className="text-foreground shrink-0">{entry.new_value?.assignment || "New User"}</span>
                            </div>
                          );
                        }

                        const initials = actor.charAt(0).toUpperCase();
                        // Generate consistent static hue based on string to match ui diversity
                        const colorCode = ["bg-indigo-500", "bg-emerald-500", "bg-blue-500", "bg-rose-500", "bg-amber-500"][actor.length % 5];

                        return (
                          <div key={entry.id} className="relative flex items-start gap-4 pb-8 group">
                            {/* Vertical line connecting nodes */}
                            {!isLast && (
                              <div className="absolute left-[17px] top-[36px] bottom-0 w-[2px] bg-border/40" />
                            )}

                            {/* Node Avatar Icon */}
                            <Avatar className="h-9 w-9 shrink-0 border border-border/20 relative z-10 shadow-sm mt-0.5">
                              <AvatarFallback className={cn("text-xs font-semibold text-white", colorCode)}>
                                {initials}
                              </AvatarFallback>
                            </Avatar>

                            {/* Node Content */}
                            <div className="flex-1 min-w-0 pt-1.5 px-2">
                              <div className="flex items-baseline justify-between gap-2">
                                <div className="text-[15px] leading-snug">
                                  <span className="font-semibold text-foreground mr-2">{actor}</span>
                                  <span className="text-muted-foreground/80 font-medium">{getActionDescOnly(entry)}</span>
                                </div>
                                <span className="text-[12px] text-muted-foreground shrink-0 whitespace-nowrap hidden sm:block">
                                  {format(new Date(entry.created_at), "hh:mm a")}
                                </span>
                              </div>
                              
                              {detailUi}

                              {/* Undo Button (Appear on Hover like in Reference) */}
                              <div className="mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button className="text-[13px] font-semibold px-4 py-1.5 rounded bg-background border border-border/60 text-foreground hover:bg-muted transition-colors flex items-center gap-2 shadow-sm">
                                  <Undo2 className="w-3.5 h-3.5" /> Revert
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <FileText className="h-10 w-10 text-muted-foreground/30 mb-3" />
                <p className="text-sm font-medium text-foreground">No matching history found.</p>
                <p className="text-xs text-muted-foreground mt-1">Try adjusting your filters or search.</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* ── RIGHT: Sidebar Summary ── */}
      <ScrollArea className="w-full h-full shrink-0 md:w-[280px] lg:w-[320px] bg-background border-l border-border/40">
        <div className="space-y-10 p-8">
          
          {/* Summary Section */}
          <section>
            <h4 className="text-[11px] font-bold tracking-widest text-muted-foreground mb-4 opacity-80 uppercase">Summary</h4>
            <div className="space-y-3">
              <div className="flex justify-between items-center text-[14px]">
                <span className="text-muted-foreground font-medium">Total changes</span>
                <span className="font-mono text-foreground">{totalChanges}</span>
              </div>
              <div className="flex justify-between items-center text-[14px]">
                <span className="text-muted-foreground font-medium">Field edits</span>
                <span className="font-mono text-foreground">{fieldEdits}</span>
              </div>
              <div className="flex justify-between items-center text-[14px]">
                <span className="text-muted-foreground font-medium">Status changes</span>
                <span className="font-mono text-foreground">{statusChangesCount}</span>
              </div>
              <div className="flex justify-between items-center text-[14px]">
                <span className="text-muted-foreground font-medium">Revertable</span>
                <span className="font-mono text-indigo-400 font-medium">0</span>
              </div>
              <div className="flex justify-between items-center text-[14px]">
                <span className="text-muted-foreground font-medium">Age</span>
                <span className="text-foreground">{taskAge > 0 ? `${taskAge} days` : 'Today'}</span>
              </div>
            </div>
          </section>

          {/* Most Active Section */}
          <section>
            <h4 className="text-[11px] font-bold tracking-widest text-muted-foreground mb-4 opacity-80 uppercase">Most Active</h4>
            <div className="space-y-5">
              {mostActive.length > 0 ? mostActive.map(([name, data]) => {
                const colorCode = ["bg-indigo-500", "bg-emerald-500", "bg-blue-500", "bg-rose-500", "bg-amber-500"][name.length % 5];
                return(
                <div key={name} className="flex items-center gap-3.5">
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarFallback className={cn("text-[10px] font-semibold text-white shadow-sm", colorCode)}>
                      {data.initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-semibold text-foreground leading-none mb-1 truncate">{name}</p>
                    <p className="text-[12px] font-medium text-muted-foreground leading-none">{data.count} changes</p>
                  </div>
                </div>
              )}) : (
                <p className="text-[13px] italic text-muted-foreground">No activity yet</p>
              )}
            </div>
          </section>

          {/* Field Change Log */}
          <section>
            <h4 className="text-[11px] font-bold tracking-widest text-muted-foreground mb-4 opacity-80 uppercase">Field Change Log</h4>
            <div className="space-y-4">
              <div className="flex justify-between items-center text-[14px]">
                <span className="text-muted-foreground font-medium">Due date</span>
                <span className="text-foreground">{fieldLog.dueDate}x changed</span>
              </div>
              <div className="flex justify-between items-center text-[14px]">
                <span className="text-muted-foreground font-medium">Priority</span>
                <span className="text-foreground">{fieldLog.priority}x changed</span>
              </div>
              <div className="flex justify-between items-center text-[14px]">
                <span className="text-muted-foreground font-medium">Assignees</span>
                <span className="text-foreground">{fieldLog.assignees}x changed</span>
              </div>
            </div>
          </section>

        </div>
      </ScrollArea>
    </div>
  );
};

// ─── Root Component ───────────────────────────────────────────────────────────

const TAB_HEADERS = {
  overview: {
    title: "Overview",
    description: "View your task details, nested subtasks, and relevant context links.",
  },
  activity: {
    title: "Activity",
    description: "Connect with your team and track the conversation around this task.",
  },
  dependencies: {
    title: "Dependencies",
    description: "Manage task blockers and upstream items required to complete this task.",
  },
  history: {
    title: "History",
    description: "A complete audit log of changes made to this task.",
  },
} as const;

export function TaskDetailPane({ task, onUpdateTask, onTaskDeleted, onClose }: Props) {
  const [activeTab, setActiveTab] = useState("overview");
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  // Fetch fresh server data whenever a task is selected
  const { data: freshTask } = useTask(task?.id ?? "");

  // Mutations
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();

  // Use fresh data from server if available, fall back to prop (list data)
  const displayTask = freshTask ?? task;

  // Centralized field-update handler — used by header, overview tab, etc.
  const handleUpdateField = (updates: UpdateTaskInput) => {
    if (!displayTask) return;
    updateTask.mutate({ id: displayTask.id, updates });
  };

  const handleDelete = () => {
    if (!displayTask) return;
    deleteTask.mutate(displayTask.id, {
      onSuccess: () => onTaskDeleted?.(displayTask.id),
    });
  };

  if (!displayTask) {
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


  return (
    <div className="flex h-full flex-col bg-background overflow-hidden overscroll-none">

      {/* Zone 1: Compact header — never scrolls */}
      <TaskDetailHeader
        task={displayTask}
        onUpdateField={handleUpdateField}
        onDelete={handleDelete}
        onClose={onClose}
        onEditTask={() => setEditDialogOpen(true)}
      />

      {/* Edit task dialog */}
      <CreateTaskDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        mode="edit"
        taskId={displayTask.id}
        initialValues={displayTask}
        onTaskCreated={() => {}}
        onTaskUpdated={() => setEditDialogOpen(false)}
      />

      {/* Zone 2 + 3: Tab bar + content */}
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="flex min-h-0 flex-1 flex-col w-full"
      >
        <div className="py-5 px-6 border-b border-border/40 shrink-0 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          <div>
            <h3 className="font-semibold text-lg leading-none tracking-tight">
              {TAB_HEADERS[activeTab as keyof typeof TAB_HEADERS]?.title}
            </h3>
            <p className="text-sm text-muted-foreground mt-1.5">
              {TAB_HEADERS[activeTab as keyof typeof TAB_HEADERS]?.description}
            </p>
          </div>
          <TabsList className="grid w-full xl:w-[450px] grid-cols-4">
            {(
              [
                { value: "overview", label: "Overview" },
                { value: "activity", label: "Activity" },
                {
                  value: "dependencies",
                  label: "Dependencies",
                  count: (displayTask.dependencies ?? []).length,
                },
                { value: "history", label: "History" },
              ] as const
            ).map((tab) => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="text-sm font-medium"
              >
                {tab.label}
                {"count" in tab && tab.count > 0 && (
                  <span className="ml-1.5 rounded bg-muted-foreground/20 px-1 font-mono text-[10px]">
                    {tab.count}
                  </span>
                )}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {/* Tab content */}
        <TabsContent value="overview" className="m-0 min-h-0 flex-1 flex flex-col focus-visible:outline-none h-full">
          <OverviewTab task={displayTask} onUpdateTask={onUpdateTask} onUpdateField={handleUpdateField} />
        </TabsContent>

        <TabsContent value="activity" className="m-0 flex-1 min-h-0 flex flex-col focus-visible:outline-none h-full overflow-hidden">
          <ActivityTab task={displayTask} />
        </TabsContent>

        <TabsContent value="dependencies" className="m-0 flex-1 min-h-0 flex flex-col focus-visible:outline-none h-full overflow-hidden">
          <DependenciesTab task={displayTask} />
        </TabsContent>

        <TabsContent value="history" className="m-0 flex-1 min-h-0 flex flex-col focus-visible:outline-none h-full overflow-hidden">
          <HistoryTab task={displayTask} />
        </TabsContent>
      </Tabs>

    </div>
  );
}