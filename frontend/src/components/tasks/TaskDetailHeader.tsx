import { useState } from "react";
import {
  Calendar,
  ChevronRight,
  Flag,
  MoreVertical,
  PanelRightClose,
  PanelLeftOpen,
  Pencil,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getOptimizedImageUrl } from "@/lib/image-optimizer";
import { useSpaceMembers } from "@/hooks/api/useSpaces";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
  PopoverClose,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
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
import { EditableText } from "@/components/ui/editable-text";

import type { TaskPriority, TaskStatus, AnyStatus } from "@/types/task";
import type { TaskDTO, UpdateTaskInput } from "@/hooks/api/useTasks";
import { useChangeOrgTaskStatus } from "@/hooks/api/useTasks";
import { useAppContext } from "@/contexts/AppContext";
import { useTaskPermissions } from "@/hooks/useTaskPermissions";
import { useAuth } from "@/contexts/AuthContext";

import {
  STATUS_OPTIONS,
  STATUS_COLOR,
  PRIORITY_OPTIONS,
  PRIORITY_CONFIG,
  formatDate,
  formatDueDate,
} from "./task-detail-shared";

// ─── StatusBadge ──────────────────────────────────────────────────────────────

/** Clickable status badge that opens a popover to change status */
function StatusBadge({
  status,
  onStatusChange,
  disabled,
}: {
  status: AnyStatus;
  onStatusChange: (s: TaskStatus) => void;
  disabled?: boolean;
}) {
  if (disabled) {
    return (
      <Badge
        variant="outline"
        className="h-5 gap-1 px-1.5 text-[11px] opacity-60 cursor-default"
      >
        <span className={cn("size-1.5 rounded-full", STATUS_COLOR[status])} />
        {status}
      </Badge>
    );
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Badge
          variant="outline"
          className="h-5 gap-1 px-1.5 text-[11px] cursor-pointer hover:bg-accent transition-colors"
        >
          <span className={cn("size-1.5 rounded-full", STATUS_COLOR[status])} />
          {status}
        </Badge>
      </PopoverTrigger>
      <PopoverContent className="w-40 p-1" align="start">
        {STATUS_OPTIONS.map((s) => (
          <PopoverClose asChild key={s}>
            <button
              onClick={() => onStatusChange(s)}
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm
                         hover:bg-accent transition-colors text-left"
            >
              <span className={cn("size-1.5 rounded-full", STATUS_COLOR[s])} />
              {s}
            </button>
          </PopoverClose>
        ))}
      </PopoverContent>
    </Popover>
  );
}

// ─── PriorityBadge ────────────────────────────────────────────────────────────

/** Clickable priority badge that opens a popover to change priority */
function PriorityBadge({
  priority,
  onPriorityChange,
}: {
  priority: TaskPriority;
  onPriorityChange?: (p: TaskPriority) => void;
}) {
  const cfg = PRIORITY_CONFIG[priority] ?? PRIORITY_CONFIG.low;

  if (!onPriorityChange) {
    return (
      <Badge
        variant="outline"
        className={cn("h-5 gap-1 px-1.5 text-[11px]", cfg.color)}
      >
        <Flag className="size-3" />
        {priority}
      </Badge>
    );
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Badge
          variant="outline"
          className={cn(
            "h-5 gap-1 px-1.5 text-[11px] cursor-pointer hover:bg-accent transition-colors",
            cfg.color,
          )}
        >
          <Flag className="size-3" />
          {priority}
        </Badge>
      </PopoverTrigger>
      <PopoverContent className="w-40 p-1" align="start">
        {PRIORITY_OPTIONS.map((p) => {
          const pcfg = PRIORITY_CONFIG[p];
          return (
            <PopoverClose asChild key={p}>
              <button
                onClick={() => onPriorityChange(p)}
                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm
                           hover:bg-accent transition-colors text-left"
              >
                <span className={cn("size-1.5 rounded-full", pcfg.dot)} />
                {p}
              </button>
            </PopoverClose>
          );
        })}
      </PopoverContent>
    </Popover>
  );
}

// ─── AssigneesChip ────────────────────────────────────────────────────────────

/** Stacked avatar chips with tooltip for each assignee */
function AssigneesChip({
  assignees,
}: {
  assignees: { id: string; name: string | null; email: string; avatar_url?: string | null; avatarUrl?: string | null }[];
}) {
  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex items-center -space-x-1.5">
        {assignees.slice(0, 3).map((a) => (
          <Tooltip key={a.id}>
            <TooltipTrigger asChild>
              <Avatar className="size-5 cursor-default ring-1 ring-background">
                <AvatarImage src={getOptimizedImageUrl(a.avatar_url || a.avatarUrl, { width: 40, height: 40 })} alt={a.email.split('@')[0]} />
                <AvatarFallback className="text-[9px] font-semibold bg-accent">
                  {a.email.split('@')[0].charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              {a.email.split('@')[0]}
            </TooltipContent>
          </Tooltip>
        ))}
        {assignees.length > 3 && (
          <Avatar className="size-5 ring-1 ring-background">
            <AvatarFallback className="text-[9px] bg-muted text-muted-foreground">
              +{assignees.length - 3}
            </AvatarFallback>
          </Avatar>
        )}
      </div>
    </TooltipProvider>
  );
}

// ─── CreatedByChip ────────────────────────────────────────────────────────────

/** Shows who created the task and when */
function CreatedByChip({
  name,
  email,
  createdAt,
  avatarUrl,
}: {
  name?: string | null;
  email?: string | null;
  createdAt: string;
  avatarUrl?: string | null;
}) {
  const displayName = name || email || "Unknown";
  const initial = displayName.charAt(0).toUpperCase();
  const dateStr = formatDate(createdAt);

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-1.5 h-5 px-1.5 rounded-md border border-border/60 bg-muted/30 cursor-default">
            <Avatar className="size-4 ring-1 ring-background">
              {avatarUrl && (
                <AvatarImage src={getOptimizedImageUrl(avatarUrl, { width: 32, height: 32 })} alt={displayName} />
              )}
              <AvatarFallback className="text-[8px] font-semibold bg-accent">
                {initial}
              </AvatarFallback>
            </Avatar>
            <span className="text-[11px] text-muted-foreground truncate max-w-[100px]">
              {displayName}
            </span>
            <span className="text-[10px] text-muted-foreground/60">
              · {dateStr}
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          Created by {displayName} on {dateStr}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ─── TaskDetailHeader ─────────────────────────────────────────────────────────

export function TaskDetailHeader({
  task,
  onUpdateField,
  onDelete,
  onClose,
  onEditTask,
  parentTask,
  onNavigateToParent,
  onOpenSidebar,
}: {
  task: TaskDTO;
  onUpdateField?: (updates: UpdateTaskInput) => void;
  onDelete?: () => void;
  onClose?: () => void;
  onEditTask?: () => void;
  parentTask?: { id: string; title: string } | null;
  onNavigateToParent?: (parentTaskId: string) => void;
  onOpenSidebar?: () => void;
}) {
  const { activeOrgId, activeSpaceId } = useAppContext();
  const taskOrgId = task.org_id ?? activeOrgId;
  const taskSpaceId = task.space_id ?? activeSpaceId;
  const changeStatus = useChangeOrgTaskStatus(taskOrgId, taskSpaceId);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const { data: members = [] } = useSpaceMembers(taskOrgId, taskSpaceId);
  const creatorMember = members.find((m) => m.email === task.creator_email || m.user_id === task.created_by);

  const { user } = useAuth();
  const currentUserId = user?.id;

  const {
    canEditTask,
    canDeleteTask,
    canChangeAnyStatus,
    canChangeAssignedStatus,
  } = useTaskPermissions(task);

  const isAssignee =
    task.assignees?.some((a) => a.id === currentUserId) ?? false;
  const canUpdateStatus =
    canChangeAnyStatus || (canChangeAssignedStatus && isAssignee);

  const handleStatusChange = (newStatus: TaskStatus) => {
    if (!canUpdateStatus) return;
    changeStatus.mutate({ id: task.id, status: newStatus });
  };

  const handleMarkDone = () => {
    if (!canUpdateStatus) return;
    changeStatus.mutate({ id: task.id, status: "done" });
  };

  const handlePriorityChange = (newPriority: TaskPriority) => {
    if (!canEditTask) return;
    onUpdateField?.({ priority: newPriority });
  };

  return (
    <div className="shrink-0 border-b border-border px-5 pt-4 pb-3">
      {/* Breadcrumb + Actions row */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 flex-1 min-w-0 pr-4">
          {/* Open task list button */}
          {onOpenSidebar && (
            <Button
              variant="ghost"
              size="sm"
              className="size-6 p-0 text-muted-foreground hover:text-foreground"
              onClick={onOpenSidebar}
              title="Open task list"
            >
              <PanelLeftOpen className="size-3.5" />
            </Button>
          )}

          {/* Close detail pane button */}
          {onClose && (
            <Button
              variant="ghost"
              size="sm"
              className="size-6 p-0 text-muted-foreground hover:text-foreground"
              onClick={onClose}
              title="Close detail pane"
            >
              <PanelRightClose className="size-3.5" />
            </Button>
          )}

          <Breadcrumb className="flex-1 min-w-0">
            <BreadcrumbList className="text-sm items-center flex-nowrap shrink-0">
              <BreadcrumbItem className="hidden sm:block">
                <span
                  className="cursor-pointer font-medium text-muted-foreground hover:text-foreground transition-colors"
                  onClick={onClose}
                >
                  Tasks
                </span>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden sm:block">
                <ChevronRight className="size-4" />
              </BreadcrumbSeparator>
              {(parentTask || task.parent_task_title) && (
                <>
                  <BreadcrumbItem>
                    <span
                      className="cursor-pointer font-medium text-muted-foreground hover:text-foreground transition-colors truncate max-w-[120px]"
                      onClick={() => {
                        if (parentTask) {
                          onNavigateToParent?.(parentTask.id);
                        } else if (task.parent_task_id) {
                          onNavigateToParent?.(task.parent_task_id);
                        }
                      }}
                      title={parentTask?.title || task.parent_task_title}
                    >
                      {parentTask?.title || task.parent_task_title}
                    </span>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator>
                    <ChevronRight className="size-4" />
                  </BreadcrumbSeparator>
                </>
              )}
              <BreadcrumbItem className="flex-1 min-w-0">
                <EditableText
                  value={task.title}
                  onSave={(title) => onUpdateField?.({ title })}
                  placeholder="Untitled task"
                  className="text-sm font-medium text-foreground truncate"
                  inputClassName="text-sm font-medium text-foreground truncate"
                  disabled={!canEditTask}
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
            disabled={
              task.status === "done" ||
              changeStatus.isPending ||
              !canUpdateStatus
            }
          >
            {task.status === "done" ? "Done ✓" : "Mark done"}
          </Button>

          {/* Actions dropdown */}
          {(canEditTask || canDeleteTask) && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="size-6 p-0">
                  <MoreVertical className="size-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                {canEditTask && (
                  <DropdownMenuItem onClick={() => onEditTask?.()}>
                    <Pencil className="mr-2 size-3.5" />
                    Edit task
                  </DropdownMenuItem>
                )}
                {canEditTask && canDeleteTask && <DropdownMenuSeparator />}
                {canDeleteTask && (
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => setDeleteDialogOpen(true)}
                  >
                    <Trash2 className="mr-2 size-3.5" />
                    Delete task
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* Chips row */}
      <div className="flex flex-wrap items-center gap-1.5">
        <StatusBadge
          status={task.status}
          onStatusChange={handleStatusChange}
          disabled={!canUpdateStatus}
        />
        <PriorityBadge
          priority={task.priority}
          onPriorityChange={canEditTask ? handlePriorityChange : undefined}
        />
        <AssigneesChip assignees={task.assignees ?? []} />

        {(task.due_date || task.dueDateISO) && (
          <Badge variant="outline" className="h-5 gap-1 px-1.5 text-[11px]">
            <Calendar className="size-3" />
            {formatDueDate(task.due_date || task.dueDateISO!, task.is_all_day)}
          </Badge>
        )}

        {task.story_points != null && (
          <Badge variant="outline" className="h-5 px-1.5 font-mono text-[11px]">
            {task.story_points}p
          </Badge>
        )}

        {(task.labels ?? []).map((label) => (
          <Badge
            key={label}
            variant="secondary"
            className="h-5 px-1.5 text-[10px]"
          >
            {label}
          </Badge>
        ))}

        <CreatedByChip
          name={task.creator_name}
          email={task.creator_email}
          createdAt={task.created_at}
          avatarUrl={task.creator_avatar_url || creatorMember?.avatar_url || creatorMember?.avatarUrl}
        />
      </div>

      {/* Delete confirmation dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete task</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>"{task.title}"</strong>?
              This action cannot be undone.
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
}
