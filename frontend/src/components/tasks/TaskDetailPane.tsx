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
}: {
  task: TaskDTO;
  onUpdateField?: (updates: UpdateTaskInput) => void;
  onDelete?: () => void;
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
        <Breadcrumb className="flex-1 min-w-0 pr-4">
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
                className="text-lg font-semibold text-foreground truncate"
                inputClassName="text-lg font-semibold text-foreground truncate"
              />
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

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

        {task.storyPoints != null && (
          <Badge variant="outline" className="h-5 px-1.5 font-mono text-[11px]">
            {task.storyPoints}p
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
            <div className="bg-background p-3">
              <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Objective
              </span>
              <EditableTextarea
                value={task.objective ?? ""}
                onSave={(objective) => onUpdateField?.({ objective })}
                placeholder="No objective set"
                minRows={2}
              />
            </div>
            <div className="bg-background p-3">
              <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Success Criteria
              </span>
              <EditableTextarea
                value={task.success_criteria ?? ""}
                onSave={(success_criteria) => onUpdateField?.({ success_criteria })}
                placeholder="No criteria set"
                minRows={2}
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
    <div className="py-3">
      {/* Author and Time */}
      <div className="mb-1.5 flex items-center gap-2">
        <Avatar className="h-6 w-6 shrink-0 border border-border/50">
          <AvatarFallback className="text-[10px] font-semibold bg-accent">
            {authorName.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <span className="text-xs font-semibold">{authorName}</span>
        <span className="text-[11px] text-muted-foreground">{formatRelTime(comment.created_at)}</span>
      </div>

      {/* Content */}
      <div className="pl-8">
        <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">
          {comment.content}
        </p>

        {/* Action Row */}
        <div className="mt-1.5 flex items-center gap-3">
          <button
            onClick={() => setIsReplying(!isReplying)}
            className="text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Reply
          </button>
          {user?.id === comment.user_id && (
            <button
              onClick={handleDelete}
              disabled={deleteComment.isPending}
              className="group flex items-center text-[11px] font-medium text-muted-foreground transition-colors hover:text-destructive disabled:opacity-50"
              title="Delete comment"
            >
              {deleteComment.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Trash2 className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
              )}
            </button>
          )}
        </div>

        {/* Reply Box Toggle */}
        {isReplying && (
          <div className="mt-2 flex items-center gap-2">
            <Input
              autoFocus
              placeholder="Write a reply..."
              value={replyInput}
              onChange={(e) => setReplyInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleReplySubmit()}
              className="h-8 flex-1 text-xs"
            />
            <Button
              size="sm"
              className="h-8 shrink-0 px-3 text-xs"
              onClick={handleReplySubmit}
              disabled={createComment.isPending || !replyInput.trim()}
            >
              {createComment.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Post"}
            </Button>
          </div>
        )}

        {/* Nested Replies tree */}
        {(comment.replies?.length ?? 0) > 0 && (
          <div className="mt-3 space-y-1 border-l-2 border-border/40 pl-3 md:pl-4">
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
    <div className="flex h-full flex-col">
      <ScrollArea className="flex-1">
        <div className="mx-auto w-full max-w-2xl px-5 py-4">
          {isPending ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (comments ?? []).length > 0 ? (
            <div className="space-y-0">
              {(comments ?? []).map((comment, i) => (
                <div key={comment.id}>
                  {i > 0 && <Separator className="my-1" />}
                  <CommentNode comment={comment} taskId={task.id} />
                </div>
              ))}
            </div>
          ) : (
            <p className="py-4 text-xs italic text-muted-foreground">
              No comments yet. Start the conversation!
            </p>
          )}
        </div>
      </ScrollArea>

      {/* Sticky comment input */}
      <div className="shrink-0 border-t border-border px-5 py-3">
        <div className="mx-auto flex w-full max-w-2xl items-center gap-2">
          <Input
            placeholder="Add a new comment..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
            className="h-9 text-sm focus-visible:ring-1"
          />
          <Button
            size="sm"
            className="h-9 shrink-0 px-4 text-sm"
            onClick={handleSend}
            disabled={createComment.isPending || !input.trim()}
          >
            {createComment.isPending ? <Loader2 className="mx-1 h-4 w-4 animate-spin" /> : "Send"}
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

/** Maps a raw action_type string to a human-readable description. */
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
    default: return entry.action_type; // raw fallback for unknown types
  }
}

const HistoryTab = ({ task }: { task: TaskDTO }) => {
  const { data: entries, isPending } = useTaskActivity(task.id);

  return (
    <ScrollArea className="h-full">
      <div className="mx-auto w-full max-w-2xl p-5">

        {isPending ? (
          /* Loading state */
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>

        ) : (entries ?? []).length > 0 ? (
          /* Populated state */
          <div>
            {(entries ?? []).map((entry, i) => {
              const actor = entry.user?.name ?? entry.user?.email ?? "Unknown user";
              return (
                <div key={entry.id}>
                  {i > 0 && <Separator />}
                  <div className="flex items-start gap-3 py-3">

                    {/* Timeline dot */}
                    <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-muted-foreground/40" />

                    {/* Action + actor */}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm leading-snug text-foreground">
                        {formatActionLabel(entry)}
                      </p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        by {actor}
                      </p>
                    </div>

                    {/* Relative timestamp */}
                    <div className="shrink-0 text-right">
                      <p className="text-[10px] text-muted-foreground">
                        {formatRelTime(entry.created_at)}
                      </p>
                    </div>

                  </div>
                </div>
              );
            })}
          </div>

        ) : (
          /* Empty state */
          <p className="py-10 text-center text-xs italic text-muted-foreground">
            No history yet
          </p>
        )}

      </div>
    </ScrollArea>
  );
};

// ─── Root Component ───────────────────────────────────────────────────────────

export function TaskDetailPane({ task, onUpdateTask, onTaskDeleted }: Props) {
  const [activeTab, setActiveTab] = useState("overview");

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
    <div className="flex h-full flex-col bg-background">

      {/* Zone 1: Compact header — never scrolls */}
      <TaskDetailHeader
        task={displayTask}
        onUpdateField={handleUpdateField}
        onDelete={handleDelete}
      />

      {/* Zone 2 + 3: Tab bar + content */}
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="flex min-h-0 flex-1 flex-col p-4 w-full"
      >
        <TabsList className="grid w-full lg:w-[450px] grid-cols-4 mb-4">
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

        {/* Tab content */}
        <TabsContent value="overview" className="m-0 min-h-0 flex-1 flex flex-col focus-visible:outline-none h-full">
          <div className="flex-1 flex flex-col min-h-0">
            <div className="py-5 px-6 border-b border-border/40 shrink-0">
              <h3 className="font-semibold text-lg leading-none tracking-tight">Overview</h3>
              <p className="text-sm text-muted-foreground mt-1.5">
                View your task details, nested subtasks, and relevant context links.
              </p>
            </div>
            <div className="p-0 flex flex-1 min-h-0">
              <OverviewTab task={displayTask} onUpdateTask={onUpdateTask} onUpdateField={handleUpdateField} />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="activity" className="m-0 min-h-0 flex-1 flex flex-col focus-visible:outline-none h-full">
          <div className="flex-1 flex flex-col min-h-0">
            <div className="py-5 px-6 border-b border-border/40 shrink-0">
              <h3 className="font-semibold text-lg leading-none tracking-tight">Activity</h3>
              <p className="text-sm text-muted-foreground mt-1.5">
                Connect with your team and track the conversation around this task.
              </p>
            </div>
            <div className="p-0 flex flex-1 min-h-0">
              <div className="flex-1 min-h-0 w-full">
                <ActivityTab task={displayTask} />
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="dependencies" className="m-0 min-h-0 flex-1 flex flex-col focus-visible:outline-none h-full">
          <div className="flex-1 flex flex-col min-h-0">
            <div className="py-5 px-6 border-b border-border/40 shrink-0">
              <h3 className="font-semibold text-lg leading-none tracking-tight">Dependencies</h3>
              <p className="text-sm text-muted-foreground mt-1.5">
                Manage task blockers and upstream items required to complete this task.
              </p>
            </div>
            <div className="p-0 flex flex-1 min-h-0">
              <div className="flex-1 min-h-0 w-full">
                <DependenciesTab task={displayTask} />
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="history" className="m-0 min-h-0 flex-1 flex flex-col focus-visible:outline-none h-full">
          <div className="flex-1 flex flex-col min-h-0">
            <div className="py-5 px-6 border-b border-border/40 shrink-0">
              <h3 className="font-semibold text-lg leading-none tracking-tight">History</h3>
              <p className="text-sm text-muted-foreground mt-1.5">
                A complete audit log of changes made to this task.
              </p>
            </div>
            <div className="p-0 flex flex-1 min-h-0">
              <div className="flex-1 min-h-0 w-full">
                <HistoryTab task={displayTask} />
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>

    </div>
  );
}