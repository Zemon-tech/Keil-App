// src/components/tasks/TaskPreviewDialog.tsx
//
// Read-only task preview dialog — opened when a user clicks a #task-name
// mention in the Activity tab. Shows name, status, priority, objective, and
// success criteria. The task name in the header is a link that navigates to
// /tasks?taskId=<id> so the full task detail pane opens.

import { ExternalLink, Flag, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { useTask, useChangeTaskStatus } from "@/hooks/api/useTasks";
import { STATUS_COLOR, PRIORITY_CONFIG } from "./task-detail-shared";
import type { TaskStatus, TaskPriority } from "@/types/task";

// ─── Props ────────────────────────────────────────────────────────────────────

interface TaskPreviewDialogProps {
  /** The task ID to preview. Pass empty string / undefined to close. */
  taskId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
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
}: TaskPreviewDialogProps) {
  const navigate = useNavigate();
  const { data: task, isLoading } = useTask(taskId);
  const changeTaskStatus = useChangeTaskStatus();

  const handleNavigateToTask = () => {
    onOpenChange(false);
    navigate(`/tasks?taskId=${taskId}`);
  };

  const objectiveBullets = parseBullets(task?.objective);
  const successBullets = parseBullets(task?.success_criteria);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg p-0 gap-0">

        {/* ── Header ── */}
        <div className="px-5 pt-5 pb-4 border-b border-border/60">
          <DialogHeader>
            {isLoading ? (
              <DialogTitle className="text-base flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading task…
              </DialogTitle>
            ) : (
              <>
                <DialogTitle className="text-base leading-snug">
                  {/* Clickable task name → navigates to full task page */}
                  <button
                    onClick={handleNavigateToTask}
                    className="group flex items-center gap-1.5 text-left font-semibold text-foreground hover:text-primary transition-colors"
                  >
                    <span className="truncate">{task?.title ?? "Untitled task"}</span>
                    <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-primary" />
                  </button>
                </DialogTitle>
                <DialogDescription className="text-xs mt-1 text-muted-foreground">
                  Click the task name above to open the full task page.
                </DialogDescription>
              </>
            )}
          </DialogHeader>
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
        <div className="px-5 py-3 border-t border-border/60 bg-muted/20 flex justify-between items-center">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 text-xs">
                Change Status
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={() => changeTaskStatus.mutate({ id: taskId, status: "todo" })}>
                Todo
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => changeTaskStatus.mutate({ id: taskId, status: "in-progress" })}>
                In Progress
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => changeTaskStatus.mutate({ id: taskId, status: "done" })}>
                Done
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => changeTaskStatus.mutate({ id: taskId, status: "backlog" })}>
                Backlog
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <button
            onClick={handleNavigateToTask}
            className="flex items-center gap-1.5 text-xs text-primary hover:underline font-medium"
          >
            Open full task
            <ExternalLink className="h-3 w-3" />
          </button>
        </div>

      </DialogContent>
    </Dialog>
  );
}
