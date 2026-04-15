import { useMemo, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import dayGridPlugin from "@fullcalendar/daygrid";
import listPlugin from "@fullcalendar/list";
import interactionPlugin from "@fullcalendar/interaction";
import type { EventReceiveArg, EventResizeDoneArg } from "@fullcalendar/interaction";
import type { EventContentArg, EventInput } from "@fullcalendar/core";
import { addMinutes, format, parseISO, isPast } from "date-fns";
import {
  Bell,
  CalendarClock,
  Flag,
  Focus,
  Link2,
  Timer,
  Trash2,
  X,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import type { CalendarBlock, CalendarBlockType, Task } from "@/types/task";

type Props = {
  tasks: Task[];
  blocks: CalendarBlock[];
  selectedTask: Task | null;
  onViewChange?: (view: string) => void;
  onRangeChange?: (start: string, end: string) => void;
  onTaskSchedule?: (taskId: string, startISO: string, endISO: string) => Promise<void> | void;
  onSlotSelect?: (start: string, end: string) => void;
  onDeleteBlock?: (taskId: string) => Promise<void> | void;
};

type CalendarView = "timeGridDay" | "timeGridWeek" | "dayGridMonth" | "listWeek";

const typeMeta: Record<CalendarBlockType, { label: string; icon: any; pill: string; bg: string; border: string }> = {
  meeting: {
    label: "Meeting",
    icon: CalendarClock,
    pill: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/25",
    bg: "bg-sky-500/15",
    border: "border-sky-500/30",
  },
  focus_block: {
    label: "Focus block",
    icon: Focus,
    pill: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/25",
    bg: "bg-emerald-500/15",
    border: "border-emerald-500/30",
  },
  task_slot: {
    label: "Task slot",
    icon: Timer,
    pill: "bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/25",
    bg: "bg-violet-500/15",
    border: "border-violet-500/30",
  },
  deadline_marker: {
    label: "Deadline",
    icon: Flag,
    pill: "bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/25",
    bg: "bg-orange-500/15",
    border: "border-orange-500/30",
  },
  reminder: {
    label: "Reminder",
    icon: Bell,
    pill: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/25",
    bg: "bg-rose-500/15",
    border: "border-rose-500/30",
  },
};

function makeEventInput(block: CalendarBlock, task?: Task): EventInput {
  const base = {
    id: block.id,
    title: block.title,
    start: block.startISO,
    end: block.endISO,
    extendedProps: {
      type: block.type,
      taskId: block.taskId,
      notes: block.notes,
      taskTitle: task?.title,
      projectTitle: task?.projectTitle,
    },
  } satisfies EventInput;

  if (block.type === "deadline_marker") {
    return {
      ...base,
      allDay: false,
      start: block.startISO,
      end: addMinutes(parseISO(block.startISO), 10).toISOString(),
      display: "auto",
      classNames: ["task-deadline"],
    };
  }

  if (block.type === "focus_block") {
    return {
      ...base,
      display: "background",
      classNames: ["task-focus-bg"],
    };
  }

  return {
    ...base,
    classNames: ["task-event"],
  };
}

function renderEventContent(arg: EventContentArg) {
  const type = arg.event.extendedProps.type as CalendarBlockType;

  // All scheduled blocks (task_slot type) use the violet styling
  if (!type || !typeMeta[type]) {
    return <div className="p-2 text-xs">{arg.event.title}</div>;
  }

  const meta = typeMeta[type];
  const Icon = meta.icon;
  const isBg = arg.event.display === "background";

  if (isBg) {
    return (
      <div className="h-full w-full px-2 py-1.5 opacity-40">
        <div className="flex items-center gap-2">
          <Icon className="h-3 w-3" />
          <span className="text-[10px] font-bold uppercase tracking-wider truncate">{arg.event.title}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={cn(
      "h-full w-full p-2 border-l-4 overflow-hidden rounded-md",
      meta.bg,
      meta.border.replace("border-", "border-l-")
    )}>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-bold leading-tight truncate">{arg.event.title}</div>
          <div className="mt-1 flex items-center gap-1.5">
            <span className="text-[9px] font-bold uppercase tracking-widest opacity-60">
              {meta.label}
            </span>
          </div>
        </div>
        <Icon className="h-3.5 w-3.5 opacity-40" />
      </div>
    </div>
  );
}

import "./calendar-styles.css";

/** State for the event detail popover */
type SelectedEventInfo = {
  taskId: string;
  blockId: string;
  title: string;
  startISO: string;
  endISO: string;
  type: CalendarBlockType | null;
};

export function TaskSchedulePane({ tasks, blocks, selectedTask, onViewChange, onRangeChange, onTaskSchedule, onSlotSelect, onDeleteBlock }: Props) {
  const [selectedEvent, setSelectedEvent] = useState<SelectedEventInfo | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Check for scheduling conflicts
  const checkConflicts = (taskId: string, startDate: Date, endDate: Date): { hasConflict: boolean; conflictingTasks: Task[] } => {
    const conflictingTasks = tasks.filter((task) => {
      if (task.id === taskId) return false;
      if (!task.plannedStartISO || !task.plannedEndISO) return false;
      
      const taskStart = parseISO(task.plannedStartISO);
      const taskEnd = parseISO(task.plannedEndISO);
      
      // Check for overlap
      return (startDate < taskEnd && endDate > taskStart);
    });
    
    return {
      hasConflict: conflictingTasks.length > 0,
      conflictingTasks,
    };
  };

  // Handle external task drop
  const handleEventReceive = async (info: EventReceiveArg) => {
    try {
      const taskId = info.event.extendedProps.taskId;
      const taskStatus = info.event.extendedProps.taskStatus;
      const startDate = info.event.start;
      const endDate = info.event.end;

      // Validation 1: Check if task is "Done"
      if (taskStatus === "Done") {
        toast.error("Cannot schedule completed tasks", {
          description: "This task is already marked as done.",
        });
        info.revert();
        return;
      }

      // Validation 2: Check if scheduled in the past
      if (startDate && isPast(startDate)) {
        toast.error("Cannot schedule in the past", {
          description: "Please select a future time slot.",
        });
        info.revert();
        return;
      }

      // Validation 3: Check for conflicts
      if (startDate && endDate) {
        const { hasConflict, conflictingTasks } = checkConflicts(taskId, startDate, endDate);
        
        if (hasConflict) {
          toast.warning("Scheduling conflict detected", {
            description: `This time overlaps with: ${conflictingTasks.map(t => t.title).join(", ")}`,
            duration: 5000,
          });
        }
      }

      // Update task with new schedule
      if (startDate && endDate && onTaskSchedule) {
        const startISO = startDate.toISOString();
        const endISO = endDate.toISOString();
        
        try {
          await onTaskSchedule(taskId, startISO, endISO);
          toast.success("Task scheduled", {
            description: `${info.event.title} scheduled for ${format(startDate, "MMM dd, h:mm a")}`,
          });
        } catch (err: any) {
          const message = err?.response?.data?.message || "Failed to schedule task";
          toast.error(message);
          info.revert();
        }
      }
    } catch (error) {
      console.error("Error in handleEventReceive:", error);
      toast.error("Failed to schedule task");
      info.revert();
    }
  };

  // Handle event resize (duration change)
  const handleEventResize = async (info: EventResizeDoneArg) => {
    try {
      const taskId = info.event.extendedProps.taskId;
      const startDate = info.event.start;
      const endDate = info.event.end;
      
      if (!taskId || !startDate || !endDate) return;

      // Check for conflicts after resize
      const { hasConflict, conflictingTasks } = checkConflicts(taskId, startDate, endDate);
      
      if (hasConflict) {
        toast.warning("Scheduling conflict detected", {
          description: `New duration overlaps with: ${conflictingTasks.map(t => t.title).join(", ")}`,
          duration: 5000,
        });
      }

      if (onTaskSchedule) {
        try {
          await onTaskSchedule(taskId, startDate.toISOString(), endDate.toISOString());
          toast.success("Task duration updated");
        } catch (err: any) {
          const message = err?.response?.data?.message || "Failed to resize task";
          toast.error(message);
          info.revert();
        }
      }
    } catch (error) {
      console.error("Error in handleEventResize:", error);
      toast.error("Failed to resize task");
    }
  };

  // ── Build events from calendar blocks ONLY (no duplicate task events) ──
  const eventInputs = useMemo(() => {
    const byTaskId = new Map(tasks.map((t) => [t.id, t] as const));
    return blocks.map((b) => makeEventInput(b, b.taskId ? byTaskId.get(b.taskId) : undefined));
  }, [blocks, tasks]);

  const initialDate = useMemo(() => {
    if (selectedTask?.plannedStartISO) return parseISO(selectedTask.plannedStartISO);
    return new Date();
  }, [selectedTask?.plannedStartISO]);

  const headerRight = "timeGridDay,timeGridWeek,dayGridMonth,listWeek";

  // ── Handle delete ──
  const handleDeleteSchedule = async () => {
    if (!selectedEvent || !onDeleteBlock) return;
    setIsDeleting(true);
    try {
      await onDeleteBlock(selectedEvent.taskId);
      toast.success("Schedule removed", {
        description: `"${selectedEvent.title}" has been unscheduled.`,
      });
      setSelectedEvent(null);
      setDeleteConfirmOpen(false);
    } catch (err: any) {
      const message = err?.response?.data?.message || "Failed to remove schedule";
      toast.error(message);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="h-full min-h-0 flex flex-col">
      <div className="flex-1 min-h-0">
        <div className="h-full">
          <FullCalendar
            plugins={[timeGridPlugin, dayGridPlugin, listPlugin, interactionPlugin]}
            initialView="timeGridWeek"
            initialDate={initialDate}
            height="100%"
            nowIndicator
            editable
            selectable
            droppable
            weekends
            dayHeaderFormat={{ weekday: "short", day: "numeric", omitCommas: true }}
            slotLabelFormat={{ hour: "numeric", minute: "2-digit", omitZeroMinute: true, hour12: true }}
            headerToolbar={{
              left: "prev,next today",
              center: "title",
              right: headerRight
            }}
            events={eventInputs as EventInput[]}
            eventContent={renderEventContent}
            eventClassNames={(arg) => {
              const type = arg.event.extendedProps.type as CalendarBlockType;
              if (!type) return ["task-event"];
              return [`fc-type-${type}`, "task-event"];
            }}
            eventClick={(arg) => {
              const taskId = arg.event.extendedProps.taskId;
              const type = arg.event.extendedProps.type as CalendarBlockType | null;
              if (taskId) {
                setSelectedEvent({
                  taskId,
                  blockId: String(arg.event.id),
                  title: arg.event.title,
                  startISO: arg.event.start?.toISOString() ?? "",
                  endISO: arg.event.end?.toISOString() ?? "",
                  type,
                });
              }
            }}
            select={(info) => {
              setSelectedEvent(null);
              onSlotSelect?.(info.startStr, info.endStr);
            }}
            datesSet={(dateInfo) => {
              const view = dateInfo.view.type as CalendarView;
              onViewChange?.(view);
              onRangeChange?.(dateInfo.start.toISOString(), dateInfo.end.toISOString());
            }}
            eventReceive={handleEventReceive}
            eventResize={handleEventResize}
            eventDrop={async (info) => {
              const taskId = info.event.extendedProps.taskId;
              const startDate = info.event.start;
              const endDate = info.event.end;
              
              if (!taskId || !startDate || !endDate) return;
              
              if (isPast(startDate)) {
                toast.error("Cannot schedule in the past");
                info.revert();
                return;
              }
              
              const { hasConflict, conflictingTasks } = checkConflicts(taskId, startDate, endDate);
              if (hasConflict) {
                toast.warning("Scheduling conflict", {
                  description: `Overlaps with: ${conflictingTasks.map(t => t.title).join(", ")}`,
                });
              }
              
              if (onTaskSchedule) {
                try {
                  await onTaskSchedule(taskId, startDate.toISOString(), endDate.toISOString());
                  toast.success("Task rescheduled");
                } catch (err: any) {
                  const message = err?.response?.data?.message || "Failed to reschedule task";
                  toast.error(message);
                  info.revert();
                }
              }
            }}
          />
        </div>
      </div>

      {/* ── Event Detail Popover ── */}
      {selectedEvent && (
        <div className="shrink-0 border-t border-border/60 bg-card/80 backdrop-blur-sm px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1">
                {selectedEvent.type && typeMeta[selectedEvent.type] && (
                  <Badge variant="outline" className={cn("rounded-full px-2 py-0.5 text-[10px] border", typeMeta[selectedEvent.type]?.pill)}>
                    {typeMeta[selectedEvent.type]?.label}
                  </Badge>
                )}
                <span className="text-sm font-semibold truncate">{selectedEvent.title}</span>
              </div>
              <div className="text-xs text-muted-foreground">
                {selectedEvent.startISO && format(new Date(selectedEvent.startISO), "EEE, MMM dd • h:mm a")}
                {selectedEvent.endISO && ` – ${format(new Date(selectedEvent.endISO), "h:mm a")}`}
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                variant="destructive"
                size="sm"
                className="rounded-xl h-8 px-3 text-xs"
                onClick={() => setDeleteConfirmOpen(true)}
              >
                <Trash2 className="h-3.5 w-3.5 mr-1" />
                Remove
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full"
                onClick={() => setSelectedEvent(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirmation Dialog ── */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Remove schedule?</AlertDialogTitle>
            <AlertDialogDescription>
              This will unschedule <strong>"{selectedEvent?.title}"</strong> from the calendar.
              The task itself will not be deleted — it will move back to the unscheduled queue.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl" disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDeleteSchedule}
              disabled={isDeleting}
            >
              {isDeleting ? "Removing…" : "Remove schedule"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
