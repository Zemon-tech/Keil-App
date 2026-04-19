// src/components/tasks/TaskPreviewDialog.tsx
//
// Read-only task preview dialog — opened when a user clicks a #task-name
// mention in the Activity tab. Shows name, status, priority, objective, and
// success criteria. The task name in the header is a link that navigates to
// /tasks?taskId=<id> so the full task detail pane opens.

import { ExternalLink, Flag, Loader2, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { useTask, useChangeTaskStatus, useUpdateTask } from "@/hooks/api/useTasks";
import { STATUS_COLOR, PRIORITY_CONFIG } from "./task-detail-shared";
import type { TaskStatus, TaskPriority } from "@/types/task";

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

/** Strip leading "• " bullet prefix from stored bullet lines */
function parseBullets(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split("\n")
    .map((l) => l.replace(/^•\s*/, "").trim())
    .filter(Boolean);
}

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
  const { data: task, isLoading } = useTask(taskId);
  const changeTaskStatus = useChangeTaskStatus();
  const updateTask = useUpdateTask();

  const handleNavigateToTask = () => {
    onOpenChange(false);
    navigate(`/tasks?taskId=${taskId}`);
  };

  const handleUnschedule = () => {
    console.log("🗑️ Unschedule clicked in dialog:", taskId);
    updateTask.mutate({
      id: taskId,
      updates: {
        start_date: null,
        due_date: null,
      },
    }, {
      onSuccess: (data) => {
        console.log("✅ Backend update successful:", data);
        console.log("📅 Task dates after update:", { start_date: data.start_date, due_date: data.due_date });
      },
      onError: (error) => {
        console.error("❌ Backend update failed:", error);
      },
    });
    onUnschedule?.(taskId);
    onOpenChange(false);
  };

  const objectiveBullets = parseBullets(task?.objective);
  const successBullets = parseBullets(task?.success_criteria);

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 bg-black/20 z-50"
          onClick={() => onOpenChange(false)}
        />
      )}

      {/* Dialog content with absolute positioning */}
      {open && (
        <div
          className="fixed z-50 max-w-lg w-full bg-background rounded-lg border shadow-lg"
          style={{
            left: position?.x ?? '50%',
            top: position?.y ?? '50%',
            transform: position ? 'none' : 'translate(-50%, -50%)',
          }}
        >
          <div className="p-0 gap-0">

            {/* ── Header ── */}
            <div className="px-5 pt-5 pb-4 border-b border-border/60 flex items-start justify-between">
              <div className="flex-1">
                {isLoading ? (
                  <div className="text-base flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading task…
                  </div>
                ) : (
                  <>
                    <div className="text-base leading-snug">
                      {/* Clickable task name → navigates to full task page */}
                      <button
                        onClick={handleNavigateToTask}
                        className="group flex items-center gap-1.5 text-left font-semibold text-foreground hover:text-primary transition-colors"
                      >
                        <span className="truncate">{task?.title ?? "Untitled task"}</span>
                        <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-primary" />
                      </button>
                    </div>
                    <div className="text-xs mt-1 text-muted-foreground">
                      Click the task name above to open the full task page.
                    </div>
                  </>
                )}
              </div>
              <button
                onClick={() => onOpenChange(false)}
                className="ml-2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* ── Body ── */}
            <div className="px-5 py-4 space-y-4 min-h-[200px]">
              {isLoading ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : task ? (
                <>
                  {/* Status + Priority row */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Status badge */}
                    <Badge
                      variant="outline"
                      className="h-5 gap-1.5 px-2 text-[11px] pointer-events-none"
                    >
                      <span
                        className={cn(
                          "h-1.5 w-1.5 rounded-full",
                          STATUS_COLOR[task.status as TaskStatus]
                        )}
                      />
                      {task.status}
                    </Badge>

                    {/* Priority badge */}
                    {task.priority && (
                      <Badge
                        variant="outline"
                        className={cn(
                          "h-5 gap-1.5 px-2 text-[11px] pointer-events-none",
                          PRIORITY_CONFIG[task.priority as TaskPriority]?.color
                        )}
                      >
                        <Flag className="h-3 w-3" />
                        {task.priority}
                      </Badge>
                    )}
                  </div>

                  {/* Objective */}
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Objective
                    </p>
                    {objectiveBullets.length > 0 ? (
                      <ul className="space-y-1">
                        {objectiveBullets.map((b, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-foreground/90">
                            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/60" />
                            {b}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-muted-foreground italic">No objective set.</p>
                    )}
                  </div>

                  {/* Success Criteria */}
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Success Criteria
                    </p>
                    {successBullets.length > 0 ? (
                      <ul className="space-y-1">
                        {successBullets.map((b, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-foreground/90">
                            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500/70" />
                            {b}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-muted-foreground italic">No success criteria set.</p>
                    )}
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground py-6 text-center">
                  Task not found.
                </p>
              )}
            </div>

            {/* ── Footer ── */}
            <div className="px-5 py-3 border-t border-border/60 bg-muted/20 flex justify-between items-center gap-2">
              <div className="flex items-center gap-2">
                {task?.start_date && task?.due_date && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={handleUnschedule}
                  >
                    Unschedule
                  </Button>
                )}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8 text-xs">
                      Change Status
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    <DropdownMenuItem onClick={() => {
                      console.log("📊 Status change to todo:", taskId);
                      changeTaskStatus.mutate({ id: taskId, status: "todo" });
                      onStatusChange?.(taskId, "todo");
                    }}>
                      Todo
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => {
                      console.log("📊 Status change to in-progress:", taskId);
                      changeTaskStatus.mutate({ id: taskId, status: "in-progress" });
                      onStatusChange?.(taskId, "in-progress");
                    }}>
                      In Progress
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => {
                      console.log("📊 Status change to done:", taskId);
                      changeTaskStatus.mutate({ id: taskId, status: "done" });
                      onStatusChange?.(taskId, "done");
                    }}>
                      Done
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => {
                      console.log("📊 Status change to backlog:", taskId);
                      changeTaskStatus.mutate({ id: taskId, status: "backlog" });
                      onStatusChange?.(taskId, "backlog");
                    }}>
                      Backlog
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <button
                onClick={handleNavigateToTask}
                className="flex items-center gap-1.5 text-xs text-primary hover:underline font-medium"
              >
                Open full task
                <ExternalLink className="h-3 w-3" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
