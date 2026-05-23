// src/components/tasks/TaskPreviewDialog.tsx
//
// Task preview dialog — opened when a user clicks a task event in the schedule or calendar.
// Shows a premium card preview of the task matching the wireframe.
// Clicking on the card background navigates to the full task.

import { useState } from "react";
import { format, isSameDay } from "date-fns";
import { 
  X, 
  MoreHorizontal, 
  MapPin, 
  Loader2,
  ChevronDown
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
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
  useChangeOrgTaskStatus 
} from "@/hooks/api/useTasks";
import { useAppContext } from "@/contexts/AppContext";
import type { TaskStatus } from "@/types/task";
import { CreateTaskDialog } from "./CreateTaskDialog";

// ─── Props ────────────────────────────────────────────────────────────────────

interface TaskPreviewDialogProps {
  /** The task ID to preview. Pass empty string / undefined to close. */
  taskId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUnschedule?: (taskId: string) => void;
  onStatusChange?: (taskId: string, newStatus: string) => void;
  position?: { x: number; y: number } | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTimeCompact(startISO?: string | null, endISO?: string | null, isAllDay?: boolean) {
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

const statusColors: Record<string, string> = {
  todo: "bg-purple-500/10 text-purple-400 border-purple-500/20 hover:bg-purple-500/20 dark:bg-purple-500/15 dark:text-purple-300",
  "in-progress": "bg-blue-500/10 text-blue-400 border-blue-500/20 hover:bg-blue-500/20 dark:bg-blue-500/15 dark:text-blue-300",
  done: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20 dark:bg-emerald-500/15 dark:text-emerald-300",
  backlog: "bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20 dark:bg-red-500/15 dark:text-red-300",
};

// ─── TaskPreviewDialog ────────────────────────────────────────────────────────

export function TaskPreviewDialog({
  taskId,
  open,
  onOpenChange,
  onUnschedule,
  onStatusChange,
  position,
}: TaskPreviewDialogProps) {
  const navigate = useNavigate();
  const { activeOrgId, activeSpaceId } = useAppContext();
  const { data: task, isLoading } = useOrgTask(activeOrgId, activeSpaceId, taskId);
  const updateTask = useUpdateOrgTask(activeOrgId, activeSpaceId);
  const deleteTask = useDeleteOrgTask(activeOrgId, activeSpaceId);
  const changeTaskStatus = useChangeOrgTaskStatus(activeOrgId, activeSpaceId);

  const [descExpanded, setDescExpanded] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  const handleNavigateToTask = () => {
    onOpenChange(false);
    navigate(`/tasks/${taskId}`);
  };

  const handleUnschedule = () => {
    updateTask.mutate({
      id: taskId,
      updates: { start_date: null, due_date: null },
    });
    onUnschedule?.(taskId);
    onOpenChange(false);
  };

  const handleDelete = () => {
    if (task && confirm("Are you sure you want to delete this task?")) {
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

      {/* Dialog content with absolute positioning */}
      <div
        className="fixed z-50 max-w-[400px] w-full bg-card text-card-foreground rounded-xl border border-border shadow-lg flex flex-col p-3.5 gap-3 group cursor-pointer hover:shadow-xl transition-all duration-200 overflow-hidden"
        style={{
          left: position?.x ?? '50%',
          top: position?.y ?? '50%',
          transform: position ? 'none' : 'translate(-50%, -50%)',
        }}
        onClick={handleNavigateToTask}
      >
        <div className="flex-1 flex flex-col gap-2.5">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-6 h-full text-muted-foreground gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-xs">Loading task…</span>
            </div>
          ) : task ? (
            <>
              {/* TOP ROW: Title, Mark Done, Actions */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <h3 className="font-semibold text-[15px] leading-tight text-foreground truncate max-w-[150px] sm:max-w-[180px]" title={task.title}>
                    {task.title || "Untitled task"}
                  </h3>
                  {/* Mark Done Pill Button */}
                  {task.status !== "done" && task.status !== "completed" ? (
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
                      className="px-2.5 py-0.5 text-[10px] font-semibold border border-emerald-500/30 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 rounded-full transition-all duration-200 shrink-0 flex items-center gap-0.5"
                    >
                      <span>✓ done</span>
                    </button>
                  )}
                </div>
                
                <div className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                  {/* 3-dot Menu */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button 
                        className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <MoreHorizontal className="w-4 h-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={handleNavigateToTask}>
                        View details
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setEditDialogOpen(true)}>
                        Edit
                      </DropdownMenuItem>
                      {(task.start_date || task.due_date) && (
                        <DropdownMenuItem onClick={handleUnschedule}>
                          Unschedule
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem 
                        onClick={handleDelete}
                        className="text-red-500 focus:text-red-500"
                      >
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  {/* Close always visible */}
                  <button 
                    onClick={() => onOpenChange(false)} 
                    className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* MIDDLE ROW: Description */}
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
                    <p className={cn(
                      "text-xs sm:text-sm text-foreground/80 leading-relaxed font-normal transition-all",
                      !descExpanded ? "line-clamp-3" : "line-clamp-none"
                    )}>
                      {task.description || task.objective}
                    </p>
                  )}
                  {task.location && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
                      <MapPin className="w-3 h-3 shrink-0 text-muted-foreground/75" />
                      <span className="truncate">{task.location}</span>
                    </div>
                  )}
                </div>
              )}

              {/* BOTTOM ROW: Assignees, Status, Timings */}
              <div className="grid grid-cols-3 items-center gap-3 pt-2.5 border-t border-border/40 mt-0.5">
                {/* Assignees */}
                <div className="flex flex-col gap-0.5 min-w-0">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Assignees</span>
                  {task.assignees && task.assignees.length > 0 ? (
                    <div className="flex items-center -space-x-1.5 overflow-hidden py-0.5" onClick={(e) => e.stopPropagation()}>
                      {task.assignees.slice(0, 3).map(a => (
                        <TooltipProvider key={a.id}>
                          <Tooltip delayDuration={200}>
                            <TooltipTrigger asChild>
                              <Avatar className="w-5 h-5 border-[1.5px] border-background relative hover:z-10 hover:scale-105 transition-all">
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
                        <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-[8px] font-semibold border-[1.5px] border-background relative z-10 text-muted-foreground">
                          +{task.assignees.length - 3}
                        </div>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground/50 italic">Unassigned</span>
                  )}
                </div>

                {/* Status Dropdown */}
                <div className="flex flex-col gap-0.5 min-w-0">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Status</span>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        onClick={(e) => e.stopPropagation()}
                        className={cn(
                          "flex items-center justify-between px-2 py-0.5 h-6 text-[10px] font-medium rounded-md border text-left cursor-pointer transition-all duration-200 capitalize w-full",
                          statusColors[task.status] || "bg-zinc-500/10 text-zinc-400 border-zinc-500/20 hover:bg-zinc-500/20"
                        )}
                      >
                        <span className="truncate">{task.status.replace("-", " ")}</span>
                        <ChevronDown className="w-3 h-3 shrink-0 ml-0.5 opacity-70" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" onClick={(e) => e.stopPropagation()}>
                      {["todo", "in-progress", "done", "backlog"].map((s) => (
                        <DropdownMenuItem 
                          key={s} 
                          onClick={(e) => {
                            e.stopPropagation();
                            changeTaskStatus.mutate({ id: taskId, status: s as TaskStatus });
                            onStatusChange?.(taskId, s);
                          }}
                          className="capitalize text-xs cursor-pointer"
                        >
                          {s.replace("-", " ")}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* Timings */}
                <div className="flex flex-col gap-0.5 min-w-0 text-right">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Timings</span>
                  <span 
                    className="text-[11px] text-foreground/80 font-medium truncate" 
                    title={task.start_date ? formatTimeCompact(task.start_date, task.due_date, task.is_all_day) || undefined : undefined}
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
              <p className="text-sm text-muted-foreground">Task not found.</p>
            </div>
          )}
        </div>
      </div>

      {/* Edit Task Dialog */}
      {task && (
        <CreateTaskDialog
          open={editDialogOpen}
          onOpenChange={(isOpen) => {
            setEditDialogOpen(isOpen);
            if (!isOpen) {
              onOpenChange(false);
            }
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


