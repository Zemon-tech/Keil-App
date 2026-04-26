import { ExternalLink, Loader2, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
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
import { STATUS_COLOR } from "./task-detail-shared";
import type { TaskStatus } from "@/types/task";

interface EventPreviewDialogProps {
  eventId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUnschedule?: (eventId: string) => void;
  onStatusChange?: (eventId: string, newStatus: string) => void;
  position?: { x: number; y: number } | null;
}

export function EventPreviewDialog({
  eventId,
  open,
  onOpenChange,
  onUnschedule,
  onStatusChange,
  position,
}: EventPreviewDialogProps) {
  const navigate = useNavigate();
  const { data: event, isLoading } = useTask(eventId);
  const changeTaskStatus = useChangeTaskStatus();
  const updateTask = useUpdateTask();

  const handleNavigateToEvent = () => {
    onOpenChange(false);
    navigate(`/tasks?taskId=${eventId}`);
  };

  const handleUnschedule = () => {
    updateTask.mutate({
      id: eventId,
      updates: {
        start_date: null,
        due_date: null,
      },
    });
    onUnschedule?.(eventId);
    onOpenChange(false);
  };

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 bg-black/20 z-50"
          onClick={() => onOpenChange(false)}
        />
      )}

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
            {/* Header */}
            <div className="px-5 pt-5 pb-4 border-b border-border/60 flex items-start justify-between">
              <div className="flex-1">
                {isLoading ? (
                  <div className="text-base flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading event…
                  </div>
                ) : (
                  <>
                    <div className="text-base leading-snug">
                      <button
                        onClick={handleNavigateToEvent}
                        className="group flex items-center gap-1.5 text-left font-semibold text-foreground hover:text-primary transition-colors"
                      >
                        <span className="truncate">{event?.title ?? "Untitled event"}</span>
                        <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-primary" />
                      </button>
                    </div>
                    <div className="text-xs mt-1 text-muted-foreground">
                      Click the event name above to open the full event page.
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

            {/* Body */}
            <div className="px-5 py-4 space-y-4 min-h-[200px]">
              {isLoading ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : event ? (
                <>
                  <div className="flex items-center gap-2 flex-wrap">
                    {(event.start_date || event.due_date) && (
                      <span className="text-xs font-medium text-muted-foreground bg-muted/50 px-2 py-0.5 rounded">
                        {event.start_date ? format(new Date(event.start_date), event.is_all_day ? "d MMM" : "d MMM, h:mm a") : "—"} → {event.due_date ? format(new Date(event.due_date), event.is_all_day ? "d MMM" : "d MMM, h:mm a") : "—"}
                      </span>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Description
                    </p>
                    <p className="text-sm text-foreground/90 whitespace-pre-wrap">
                      {event.description || <span className="italic text-muted-foreground">No description provided.</span>}
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Location / Link
                    </p>
                    <p className="text-sm text-foreground/90">
                      {event.location || <span className="italic text-muted-foreground">No location provided.</span>}
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Event Type
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {event.event_type ? (
                        <Badge variant="secondary" className="h-5 px-2 text-[11px] capitalize">
                          {event.event_type}
                        </Badge>
                      ) : (
                        <p className="text-sm italic text-muted-foreground">No event type specified.</p>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground py-6 text-center">
                  Event not found.
                </p>
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-border/60 bg-muted/20 flex justify-between items-center gap-2">
              <div className="flex items-center gap-2">
                {event?.start_date && event?.due_date && (
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
                      changeTaskStatus.mutate({ id: eventId, status: "todo" });
                      onStatusChange?.(eventId, "todo");
                    }}>
                      Todo
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => {
                      changeTaskStatus.mutate({ id: eventId, status: "in-progress" });
                      onStatusChange?.(eventId, "in-progress");
                    }}>
                      In Progress
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => {
                      changeTaskStatus.mutate({ id: eventId, status: "done" });
                      onStatusChange?.(eventId, "done");
                    }}>
                      Done
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => {
                      changeTaskStatus.mutate({ id: eventId, status: "backlog" });
                      onStatusChange?.(eventId, "backlog");
                    }}>
                      Backlog
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <button
                onClick={handleNavigateToEvent}
                className="flex items-center gap-1.5 text-xs text-primary hover:underline font-medium"
              >
                Open full event
                <ExternalLink className="h-3 w-3" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
