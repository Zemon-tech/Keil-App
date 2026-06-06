// src/components/tasks/TaskPreviewDialog.tsx
//
// Unified preview dialog for both tasks and events.
// Opened when a user clicks a task/event in the schedule or calendar.
// Clicking the card background navigates to the full detail page.

import { useState } from "react";
import { format, isSameDay } from "date-fns";
import {
  X,
  MoreHorizontal,
  MapPin,
  Loader2,
  ChevronDown,
  Clock,
  Users,
  Phone,
  Brain,
  CheckSquare,
  Calendar,
  Pencil,
  Trash2,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuPortal,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import {
  useOrgTask,
  useUpdateOrgTask,
  useDeleteOrgTask,
  useChangeOrgTaskStatus,
} from "@/hooks/api/useTasks";
import { useAppContext } from "@/contexts/AppContext";
import { STATUS_COLOR } from "./task-detail-shared";
import type { AnyStatus, TaskStatus, EventStatus } from "@/types/task";
import { CreateTaskDialog } from "./CreateTaskDialog";

// ─── Props ────────────────────────────────────────────────────────────────────

interface TaskPreviewDialogProps {
  /** The task or event ID to preview. */
  taskId: string;
  orgId?: string;    // the task's home org
  spaceId?: string;  // the task's home space
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUnschedule?: (taskId: string) => void;
  onStatusChange?: (taskId: string, newStatus: string) => void;
  position?: { x: number; y: number } | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTimeCompact(
  startISO?: string | null,
  endISO?: string | null,
  isAllDay?: boolean
) {
  if (!startISO) return null;
  const start = new Date(startISO);
  const dateStr = format(start, "MMM d");

  if (isAllDay) return `${dateStr} · All Day`;

  const timeStart = format(start, "h:mm a").replace(":00", "");

  if (endISO) {
    const end = new Date(endISO);
    if (isSameDay(start, end)) {
      const timeEnd = format(end, "h:mm a").replace(":00", "");
      return `${dateStr} · ${timeStart}–${timeEnd}`;
    }
  }
  return `${dateStr} · ${timeStart}`;
}

const taskStatusColors: Record<string, string> = {
  todo: "bg-gradient-to-r from-violet-500/15 to-violet-600/8 text-violet-400 border-violet-500/25 hover:from-violet-500/22 hover:to-violet-600/14 dark:from-violet-500/20 dark:to-violet-600/10 dark:text-violet-300",
  "in-progress":
    "bg-gradient-to-r from-blue-500/15 to-blue-600/8 text-blue-400 border-blue-500/25 hover:from-blue-500/22 hover:to-blue-600/14 dark:from-blue-500/20 dark:to-blue-600/10 dark:text-blue-300",
  done: "bg-gradient-to-r from-emerald-500/15 to-emerald-600/8 text-emerald-500 border-emerald-500/25 hover:from-emerald-500/22 hover:to-emerald-600/14 dark:from-emerald-500/18 dark:to-emerald-600/8 dark:text-emerald-400",
  completed:
    "bg-gradient-to-r from-emerald-500/15 to-emerald-600/8 text-emerald-500 border-emerald-500/25 hover:from-emerald-500/22 hover:to-emerald-600/14 dark:from-emerald-500/18 dark:to-emerald-600/8 dark:text-emerald-400",
  backlog:
    "bg-gradient-to-r from-red-500/15 to-red-600/8 text-red-400 border-red-500/25 hover:from-red-500/22 hover:to-red-600/14 dark:from-red-500/18 dark:to-red-600/8 dark:text-red-300",
  confirmed:
    "bg-gradient-to-r from-blue-500/15 to-blue-600/8 text-blue-400 border-blue-500/25 hover:from-blue-500/22 hover:to-blue-600/14 dark:from-blue-500/20 dark:to-blue-600/10 dark:text-blue-300",
  tentative:
    "bg-gradient-to-r from-yellow-500/15 to-yellow-600/8 text-yellow-500 border-yellow-500/25 hover:from-yellow-500/22 hover:to-yellow-600/14 dark:from-yellow-500/18 dark:to-yellow-600/8 dark:text-yellow-400",
  cancelled:
    "bg-gradient-to-r from-red-500/15 to-red-600/8 text-red-400 border-red-500/25 hover:from-red-500/22 hover:to-red-600/14 dark:from-red-500/18 dark:to-red-600/8 dark:text-red-300",
};

function getEventIcon(eventType?: string | null) {
  switch (eventType) {
    case "meeting":
      return <Users className="size-4 text-[#4F46E5] dark:text-[#6366F1] shrink-0" />;
    case "call":
      return <Phone className="size-4 text-[#4F46E5] dark:text-[#6366F1] shrink-0" />;
    case "focus":
      return <Brain className="size-4 text-[#4F46E5] dark:text-[#6366F1] shrink-0" />;
    default:
      return <Calendar className="size-4 text-[#4F46E5] dark:text-[#6366F1] shrink-0" />;
  }
}

// ─── TaskPreviewDialog ────────────────────────────────────────────────────────

export function TaskPreviewDialog({
  taskId,
  orgId,
  spaceId,
  open,
  onOpenChange,
  onUnschedule,
  onStatusChange,
  position,
}: TaskPreviewDialogProps) {
  const navigate = useNavigate();
  const { activeOrgId, activeSpaceId } = useAppContext();
  const resolvedOrgId = orgId || activeOrgId;
  const resolvedSpaceId = spaceId || activeSpaceId;

  const { data: task, isLoading } = useOrgTask(resolvedOrgId, resolvedSpaceId, taskId);
  const updateTask = useUpdateOrgTask(resolvedOrgId, resolvedSpaceId);
  const deleteTask = useDeleteOrgTask(resolvedOrgId, resolvedSpaceId);
  const changeTaskStatus = useChangeOrgTaskStatus(resolvedOrgId, resolvedSpaceId);

  const [descExpanded, setDescExpanded] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  const isEvent = task?.type === "event";
  const detailPath = isEvent ? `/events/${taskId}` : `/tasks/${taskId}`;

  const handleNavigate = () => {
    onOpenChange(false);
    navigate(detailPath);
  };

  const handleUnschedule = () => {
    updateTask.mutate({ id: taskId, updates: { start_date: null, due_date: null } });
    onUnschedule?.(taskId);
    onOpenChange(false);
  };

  const handleDelete = () => {
    if (task && confirm(`Are you sure you want to delete this ${isEvent ? "event" : "task"}?`)) {
      deleteTask.mutate({ id: taskId, title: task.title, type: task.type });
      onOpenChange(false);
    }
  };

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/5 backdrop-blur-[0.5px]"
        onClick={() => onOpenChange(false)}
      />

      {/* Dialog */}
      <div
        className="fixed z-50 max-w-[400px] w-full bg-card text-card-foreground rounded-xl border border-border shadow-lg flex flex-col p-3.5 gap-3 group cursor-pointer hover:shadow-xl transition-all duration-200 overflow-hidden"
        style={{
          left: position?.x ?? "50%",
          top: position?.y ?? "50%",
          transform: position ? "none" : "translate(-50%, -50%)",
        }}
        onClick={handleNavigate}
      >
        <div className="flex-1 flex flex-col gap-2.5">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-6 h-full text-muted-foreground gap-2">
              <Loader2 className="size-5 animate-spin" />
              <span className="text-xs">Loading…</span>
            </div>
          ) : task ? (
            <>
              {/* Status accent bar */}
              <div
                className={cn(
                  "absolute top-0 left-0 right-0 h-[3px] rounded-t-xl",
                  STATUS_COLOR[task.status as AnyStatus]
                )}
              />

              {/* ── TOP ROW ── */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  {/* Icon for events, checkbox for tasks */}
                  {isEvent ? (
                    <div className="shrink-0">{getEventIcon(task.event_type)}</div>
                  ) : (
                    <CheckSquare className="size-4 text-primary shrink-0" />
                  )}

                  <h3
                    className="font-semibold text-[15px] leading-tight text-foreground truncate max-w-[160px] sm:max-w-[200px]"
                    title={task.title}
                  >
                    {task.title || (isEvent ? "Untitled event" : "Untitled task")}
                  </h3>

                  {/* Mark done pill — tasks only */}
                  {!isEvent && (
                    task.status !== "done" && task.status !== "completed" ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          changeTaskStatus.mutate({ id: taskId, status: "done" as TaskStatus });
                          onStatusChange?.(taskId, "done");
                        }}
                        className="px-2.5 py-0.5 text-[10px] font-medium border border-border/80 hover:border-foreground/40 rounded-full text-muted-foreground hover:text-foreground transition-all duration-200 shrink-0"
                      >
                        mark done
                      </button>
                    ) : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          changeTaskStatus.mutate({ id: taskId, status: "todo" as TaskStatus });
                          onStatusChange?.(taskId, "todo");
                        }}
                        className="px-2.5 py-0.5 text-[10px] font-semibold border border-emerald-500/30 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 rounded-full transition-all duration-200 shrink-0"
                      >
                        ✓ done
                      </button>
                    )
                  )}
                </div>

                <div
                  className="flex items-center gap-0.5 shrink-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Event-specific: edit + delete buttons visible on hover */}
                  {isEvent && (
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity mr-0.5">
                      <TooltipProvider>
                        <Tooltip delayDuration={300}>
                          <TooltipTrigger asChild>
                            <button
                              onClick={handleNavigate}
                              className="p-1.5 hover:bg-muted rounded text-muted-foreground hover:text-foreground transition-colors"
                            >
                              <Pencil className="size-3.5" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="top">Edit</TooltipContent>
                        </Tooltip>
                        <Tooltip delayDuration={300}>
                          <TooltipTrigger asChild>
                            <button
                              onClick={handleDelete}
                              className="p-1.5 hover:bg-red-500/10 rounded text-muted-foreground hover:text-red-500 transition-colors"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="top">Delete</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  )}

                  {/* 3-dot menu */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground transition-colors">
                        <MoreHorizontal className="size-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={handleNavigate}>
                        View details
                      </DropdownMenuItem>
                      {!isEvent && (
                        <DropdownMenuItem onClick={() => setEditDialogOpen(true)}>
                          Edit
                        </DropdownMenuItem>
                      )}
                      {(task.start_date || task.due_date) && (
                        <DropdownMenuItem onClick={handleUnschedule}>
                          Unschedule
                        </DropdownMenuItem>
                      )}
                      {isEvent && (
                        <DropdownMenuSub>
                          <DropdownMenuSubTrigger>Change Status</DropdownMenuSubTrigger>
                          <DropdownMenuPortal>
                            <DropdownMenuSubContent>
                              {(["confirmed", "tentative", "completed", "cancelled"] as EventStatus[]).map((s) => (
                                <DropdownMenuItem
                                  key={s}
                                  onClick={() => {
                                    changeTaskStatus.mutate({ id: taskId, status: s });
                                    onStatusChange?.(taskId, s);
                                  }}
                                  className="capitalize text-xs cursor-pointer"
                                >
                                  {s}
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuSubContent>
                          </DropdownMenuPortal>
                        </DropdownMenuSub>
                      )}
                      <DropdownMenuItem
                        onClick={handleDelete}
                        className="text-red-500 focus:text-red-500"
                      >
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  {/* Close */}
                  <button
                    onClick={() => onOpenChange(false)}
                    className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              </div>

              {/* ── TIME (events always show; tasks show if scheduled) ── */}
              {task.start_date && (
                <div className="flex items-center gap-2 text-[13px] text-foreground/80 font-medium">
                  <Clock className="size-3.5 text-muted-foreground shrink-0" />
                  <span>
                    {formatTimeCompact(task.start_date, task.due_date, task.is_all_day)}
                  </span>
                </div>
              )}

              {/* ── DESCRIPTION / OBJECTIVE ── */}
              {(task.description || task.objective || task.location) && (
                <div
                  className="flex-1 py-0.5"
                  onClick={(e) => {
                    const content = task.description || task.objective || "";
                    if (content.length > 120) {
                      e.stopPropagation();
                      setDescExpanded(!descExpanded);
                    }
                  }}
                >
                  {(task.description || task.objective) && (
                    <p
                      className={cn(
                        "text-xs sm:text-sm text-foreground/80 leading-relaxed font-normal transition-all",
                        !descExpanded ? "line-clamp-3" : "line-clamp-none"
                      )}
                    >
                      {(task.description || task.objective)?.replace(/^•\s*/gm, "")}
                    </p>
                  )}
                  {task.location && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
                      <MapPin className="size-3 shrink-0 text-muted-foreground/75" />
                      <span className="truncate">{task.location}</span>
                    </div>
                  )}
                </div>
              )}

              {/* ── BOTTOM ROW: Assignees · Status · Timings ── */}
              <div className="grid grid-cols-3 items-center gap-3 pt-2.5 border-t border-border/40 mt-0.5">
                {/* Assignees */}
                <div className="flex flex-col gap-0.5 min-w-0">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                    Assignees
                  </span>
                  {task.assignees && task.assignees.length > 0 ? (
                    <div
                      className="flex items-center -space-x-1.5 overflow-hidden py-0.5"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {task.assignees.slice(0, 3).map((a) => (
                        <TooltipProvider key={a.id}>
                          <Tooltip delayDuration={200}>
                            <TooltipTrigger asChild>
                              <Avatar className="size-5 border-[1.5px] border-background relative hover:z-10 hover:scale-105 transition-all">
                                <AvatarFallback className="text-[8px] bg-primary/10 text-primary font-semibold">
                                  {a.name?.charAt(0) || a.email.charAt(0).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="text-xs">
                              {a.name || a.email}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ))}
                      {task.assignees.length > 3 && (
                        <div className="size-5 rounded-full bg-muted flex items-center justify-center text-[8px] font-semibold border-[1.5px] border-background relative z-10 text-muted-foreground">
                          +{task.assignees.length - 3}
                        </div>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground/50 italic">Unassigned</span>
                  )}
                </div>

                {/* Status */}
                <div className="flex flex-col gap-0.5 min-w-0">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                    Status
                  </span>
                  {isEvent ? (
                    /* Events: status badge (no inline dropdown — use the ··· menu) */
                    <span
                      className={cn(
                        "inline-flex items-center px-2 py-0.5 h-6 text-[10px] font-medium rounded-md border capitalize",
                        taskStatusColors[task.status] ||
                          "bg-zinc-500/10 text-zinc-400 border-zinc-500/20"
                      )}
                    >
                      {task.status}
                    </span>
                  ) : (
                    /* Tasks: inline status dropdown */
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          onClick={(e) => e.stopPropagation()}
                          className={cn(
                            "flex items-center justify-between px-2 py-0.5 h-6 text-[10px] font-medium rounded-md border text-left cursor-pointer transition-all duration-200 capitalize w-full",
                            taskStatusColors[task.status] ||
                              "bg-zinc-500/10 text-zinc-400 border-zinc-500/20 hover:bg-zinc-500/20"
                          )}
                        >
                          <span className="truncate">{task.status.replace("-", " ")}</span>
                          <ChevronDown className="size-3 shrink-0 ml-0.5 opacity-70" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" onClick={(e) => e.stopPropagation()}>
                        {(["todo", "in-progress", "done", "backlog"] as TaskStatus[]).map((s) => (
                          <DropdownMenuItem
                            key={s}
                            onClick={(e) => {
                              e.stopPropagation();
                              changeTaskStatus.mutate({ id: taskId, status: s });
                              onStatusChange?.(taskId, s);
                            }}
                            className="capitalize text-xs cursor-pointer"
                          >
                            {s.replace("-", " ")}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>

                {/* Timings */}
                <div className="flex flex-col gap-0.5 min-w-0 text-right">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                    Timings
                  </span>
                  <span
                    className="text-[11px] text-foreground/80 font-medium truncate"
                    title={
                      task.start_date
                        ? formatTimeCompact(task.start_date, task.due_date, task.is_all_day) ?? undefined
                        : undefined
                    }
                  >
                    {task.start_date ? (
                      formatTimeCompact(task.start_date, task.due_date, task.is_all_day)
                    ) : (
                      <span className="text-muted-foreground/50 italic">Unscheduled</span>
                    )}
                  </span>
                </div>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center py-8 h-full">
              <p className="text-sm text-muted-foreground">Not found.</p>
            </div>
          )}
        </div>
      </div>

      {/* Edit Task Dialog (tasks only) */}
      {task && !isEvent && (
        <CreateTaskDialog
          open={editDialogOpen}
          onOpenChange={(isOpen) => {
            setEditDialogOpen(isOpen);
            if (!isOpen) onOpenChange(false);
          }}
          mode="edit"
          taskId={taskId}
          initialValues={task}
          onTaskUpdated={() => {
            setEditDialogOpen(false);
            onOpenChange(false);
          }}
        />
      )}
    </>
  );
}
