import { useMemo, useState, useRef, useEffect, useLayoutEffect } from "react";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import dayGridPlugin from "@fullcalendar/daygrid";
import listPlugin from "@fullcalendar/list";
import interactionPlugin from "@fullcalendar/interaction";
import type { EventReceiveArg, EventResizeDoneArg } from "@fullcalendar/interaction";
import type { EventContentArg, EventInput } from "@fullcalendar/core";
import { format, parseISO, isPast } from "date-fns";
import {
  isAllDayRangeLocal,
  normalizeAllDayRangeLocal,
  normalizeTimedRange,
  clampTimedRange,
  normalizeAllDayRangeForUpdate,
  ensureAllDayDropEndDate,
} from "@/lib/date-utils";
import {
  Bell,
  CalendarClock,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Flag,
  Focus,
  Timer,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { TaskPreviewDialog } from "./TaskPreviewDialog";
import type { CalendarBlock, CalendarBlockType } from "@/types/task";
import type { TaskDTO } from "@/hooks/api/useTasks";

type Props = {
  tasks: TaskDTO[];
  blocks: CalendarBlock[];
  selectedTask: TaskDTO | null;
  onViewChange?: (view: string) => void;
  onTaskSchedule?: (taskId: string, startISO: string, endISO: string) => void;
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

function makeEventInput(block: CalendarBlock, task?: TaskDTO): EventInput {
  const base = {
    id: block.id,
    title: block.title,
    start: block.startISO,
    end: block.endISO,
    backgroundColor: "#5ba66d",
    borderColor: "transparent",
    textColor: "#111827",
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
      end: new Date(new Date(block.startISO).getTime() + 10 * 60000).toISOString(),
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

function getPriorityColor(priority: TaskDTO["priority"]): string {
  const colorMap = {
    urgent: "#ef4444",
    high: "#f97316",
    medium: "#eab308",
    low: "#22c55e",
  };
  return colorMap[priority] || "#5ba66d";
}

function renderEventContent(arg: EventContentArg) {
  const type = arg.event.extendedProps.type as CalendarBlockType;
  const isScheduledTask = arg.event.extendedProps.isScheduledTask;
  const isMonthView = arg.view.type === "dayGridMonth";

  if (isMonthView) {
    return (
      <div className="w-full truncate text-[12px] font-medium px-1.5 py-0.5" style={{ color: arg.textColor || "inherit" }}>
        {arg.event.title}
      </div>
    );
  }

  // Handle scheduled tasks (no type metadata)
  if (isScheduledTask) {
    return (
      <div className="h-full w-full p-2 overflow-hidden flex items-center gap-2">
        <div className="text-[11px] font-bold leading-tight truncate flex-1">{arg.event.title}</div>
      </div>
    );
  }
  
  // Handle calendar blocks with type metadata
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
      "h-full w-full p-2 border-l-4 overflow-hidden",
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

export function TaskSchedulePane({ tasks, blocks, selectedTask, onViewChange, onTaskSchedule }: Props) {
  const [selectedTaskId, setSelectedTaskId] = useState<string>("");
  const [dialogPosition, setDialogPosition] = useState<{ x: number; y: number } | null>(null);
  const [currentViewType, setCurrentViewType] = useState<CalendarView>("dayGridMonth");
  const [currentViewDate, setCurrentViewDate] = useState<Date>(new Date());
  const [events, setEvents] = useState<EventInput[]>([]);
  const unscheduledTaskIds = useRef<Set<string>>(new Set());
  const calendarRef = useRef<FullCalendar>(null);
  const calendarContainerRef = useRef<HTMLDivElement>(null);

  // Sync local events state with props (tasks and blocks)
  useEffect(() => {
    console.log("🔄 Syncing events state with props", { tasks: tasks.length, blocks: blocks.length, unscheduledIds: unscheduledTaskIds.current.size });

    const blockEvents = blocks.map((block) => makeEventInput(block));

    const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
    const taskEvents = tasks
      .filter((t) => t.start_date && t.due_date && t.status !== "done" && !unscheduledTaskIds.current.has(t.id))
      .sort((a, b) => {
        const priorityA = priorityOrder[a.priority] ?? 4;
        const priorityB = priorityOrder[b.priority] ?? 4;
        return priorityA - priorityB;
      })
      .map((t) => {
        const startDate = new Date(t.start_date!);
        const endDate = new Date(t.due_date!);
        // All-day detection should match FullCalendar semantics:
        // - allDay events use an *exclusive* end at the start of a day boundary.
        // - timed events can cross midnight and should remain timed.
        const isAllDay = isAllDayRangeLocal(startDate, endDate);

        console.log("🔍 All-day detection:", {
          taskId: t.id,
          startDate: t.start_date,
          endDate: t.due_date,
          isAllDay,
        });

        return {
          id: t.id,
          title: t.title,
          start: t.start_date!,
          end: t.due_date!,
          allDay: isAllDay,
          backgroundColor: getPriorityColor(t.priority),
          borderColor: "transparent",
          classNames: [`task-priority-${t.priority}`],
          extendedProps: {
            taskId: t.id,
            taskTitle: t.title,
            projectTitle: t.projectTitle,
            taskStatus: t.status,
            taskPriority: t.priority,
            isScheduledTask: true,
          },
          editable: t.status !== "done",
        } satisfies EventInput;
      });

    const allEvents = [...blockEvents, ...taskEvents];
    console.log("✅ Events state updated:", allEvents.length);
    setEvents(allEvents);
  }, [tasks, blocks]);

  // Handle unschedule - remove task from local events state
  const handleTaskUnschedule = (taskId: string) => {
    console.log("🗑️ Unschedule clicked:", taskId);
    // Optimistic update: add to unscheduled ref immediately
    unscheduledTaskIds.current.add(taskId);
    console.log("📝 Added to unscheduled ref:", taskId, unscheduledTaskIds.current);
    // Remove from events state
    setEvents(prev => prev.filter(e => e.id !== taskId));
    console.log("✅ Event removed from state:", taskId);
    // Clear from ref after 5 seconds to allow backend to sync
    setTimeout(() => {
      unscheduledTaskIds.current.delete(taskId);
      console.log("🗑️ Cleared from unscheduled ref:", taskId);
    }, 5000);
  };

  // Handle status change - remove task from events if status becomes "done"
  const handleStatusChange = (taskId: string, newStatus: string) => {
    console.log("📊 Status change:", taskId, newStatus);
    if (newStatus === "done") {
      console.log("🗑️ Removing done task from calendar:", taskId);
      setEvents(prev => prev.filter(e => e.id !== taskId));
      console.log("✅ Done task removed from state:", taskId);
    }
  };

  // Scroll to 1 hour before current time so the now-indicator sits lower in the viewport
  const scrollTime = useMemo(() => {
    const now = new Date();
    now.setHours(now.getHours() - 1, 0, 0, 0);
    return format(now, "HH:mm:ss");
  }, []);

  // Handle external task drop from TaskListPane
  const handleEventReceive = (info: EventReceiveArg) => {
    try {
      const taskId = info.event.extendedProps.taskId;
      const taskStatus = info.event.extendedProps.taskStatus;
      const startDate = info.event.start;
      const endDate = info.event.end;
      const viewType = info.view.type;

      console.log("🎯 Task dropped on calendar:", {
        taskId,
        taskStatus,
        start: startDate,
        end: endDate,
        viewType,
      });

      // Validation: Check if task is done
      if (taskStatus === "done") {
        console.error("❌ Cannot schedule completed tasks");
        toast.error("Cannot schedule completed tasks", {
          description: "This task is already marked as done.",
        });
        info.revert();
        return;
      }

      // Validation: Check if scheduled in the past
      if (startDate && isPast(startDate)) {
        console.error("❌ Cannot schedule tasks in the past");
        toast.error("Cannot schedule in the past", {
          description: "Please select a future time slot.",
        });
        info.revert();
        return;
      }

      // Handle month view drop: allow multi-day scheduling
      if (viewType === "dayGridMonth") {
        if (startDate && onTaskSchedule) {
          const range = normalizeAllDayRangeLocal(startDate, endDate);
          const { startISO, endISO } = normalizeAllDayRangeForUpdate(range);

          console.log("✅ Scheduling task as all-day event:", {
            taskId,
            startISO,
            endISO,
            multiDay: startDate.getDate() !== range.end.getDate(),
          });

          onTaskSchedule(taskId, startISO, endISO);

          const isMultiDay = range.end.getTime() - range.start.getTime() > 24 * 60 * 60 * 1000;
          toast.success("Task scheduled", {
            description: isMultiDay
              ? `${info.event.title} scheduled from ${format(range.start, "MMM dd")} to ${format(new Date(range.end.getTime() - 86400000), "MMM dd")}`
              : `${info.event.title} scheduled for ${format(range.start, "MMM dd, yyyy")}`,
          });

          // Auto-switch to day view for that date
          const calendarApi = calendarRef.current?.getApi();
          if (calendarApi) {
            calendarApi.changeView("timeGridDay", startDate);
          }
        }
      } else {
        // Handle day/week view drop: use the dropped time directly
        if (startDate && endDate && onTaskSchedule) {
          const clampedRange = clampTimedRange(startDate, endDate);
          const { start: timedStart, end: timedEnd } = normalizeTimedRange(clampedRange.start, clampedRange.end);
          const startISO = timedStart.toISOString();
          const endISO = timedEnd.toISOString();

          console.log("✅ Scheduling task:", {
            taskId,
            startISO,
            endISO,
            duration: `${Math.round((endDate.getTime() - startDate.getTime()) / 60000)} minutes`,
          });

          onTaskSchedule(taskId, startISO, endISO);

          toast.success("Task scheduled", {
            description: `${info.event.title} scheduled for ${format(startDate, "MMM dd, h:mm a")}`,
          });
        }
      }
    } catch (error) {
      console.error("❌ Error in handleEventReceive:", error);
      toast.error("Failed to schedule task");
      info.revert();
    }
  };

  // Handle event resize (duration change) - allow in all views for multi-day scheduling
  const handleEventResize = (info: EventResizeDoneArg) => {
    try {
      const taskId = info.event.extendedProps.taskId;
      const startDate = info.event.start;
      const endDate = info.event.end;
      const viewType = info.view.type;

      if (!taskId || !startDate || !endDate) {
        console.warn("⚠️ Missing required data for resize");
        return;
      }

      console.log("📏 Task duration resized:", {
        taskId,
        viewType,
        newDuration: `${Math.round((endDate.getTime() - startDate.getTime()) / 60000)} minutes`,
      });

      if (onTaskSchedule) {
        if ((info.event as any).allDay) {
          const range = normalizeAllDayRangeLocal(startDate, endDate);
          const { startISO, endISO } = normalizeAllDayRangeForUpdate(range);
          onTaskSchedule(taskId, startISO, endISO);
        } else {
          const { start: timedStart, end: timedEnd } = normalizeTimedRange(startDate, endDate);
          onTaskSchedule(taskId, timedStart.toISOString(), timedEnd.toISOString());
        }
        toast.success("Task duration updated");
      }
    } catch (error) {
      console.error("❌ Error in handleEventResize:", error);
      toast.error("Failed to resize task");
    }
  };

  // Handle moving existing scheduled tasks
  const handleEventDrop = (info: any) => {
    try {
      const taskId = info.event.extendedProps.taskId;
      const startDate = info.event.start;
      const endDate = info.event.end;
      const viewType = info.view.type;

      if (!taskId || !startDate) return;

      console.log("🔄 Task moved:", { taskId, newStart: startDate, newEnd: endDate, viewType });

      // Check if moved to past
      if (isPast(startDate)) {
        console.error("❌ Cannot move task to the past");
        toast.error("Cannot schedule in the past");
        info.revert();
        return;
      }

      // Handle month view move: treat as all-day event
      const isAllDayDrop = viewType === "dayGridMonth" || !!info.event.allDay;

      if (isAllDayDrop) {
        const safeEndDate = ensureAllDayDropEndDate(startDate, endDate);
        const range = normalizeAllDayRangeLocal(startDate, safeEndDate);
        const { startISO, endISO } = normalizeAllDayRangeForUpdate(range);
        if (onTaskSchedule) {
          onTaskSchedule(taskId, startISO, endISO);
          toast.success("Task rescheduled");
        }
      } else {
        const clampedRange = clampTimedRange(startDate, endDate);
        const { start: timedStart, end: timedEnd } = normalizeTimedRange(clampedRange.start, clampedRange.end);
        if (onTaskSchedule) {
          onTaskSchedule(taskId, timedStart.toISOString(), timedEnd.toISOString());
          toast.success("Task rescheduled");
        }
      }
    } catch (error) {
      console.error("❌ Error in handleEventDrop:", error);
      toast.error("Failed to reschedule task");
    }
  };

  const headerTitle = useMemo(() => {
    if (currentViewType === "dayGridMonth") return format(currentViewDate, "MMMM yyyy");
    if (currentViewType === "timeGridWeek") return format(currentViewDate, "MMMM yyyy");
    if (currentViewType === "timeGridDay") return format(currentViewDate, "EEEE, do MMMM yyyy");
    if (currentViewType === "listWeek") return format(currentViewDate, "MMMM yyyy");
    return format(currentViewDate, "MMMM yyyy");
  }, [currentViewDate, currentViewType]);

  // FullCalendar's month scrollgrid can measure too early inside this flex layout,
  // which leaves a transient bottom-right gutter until a later reflow corrects it.
  // Measure against a stable container and force an early size sync.
  useLayoutEffect(() => {
    const calendarApi = calendarRef.current?.getApi();
    if (!calendarApi) return;
    const container = calendarContainerRef.current;
    if (!container) return;

    let frameA = 0;
    let frameB = 0;
    let timeoutId: number | null = null;

    const syncSize = () => {
      calendarApi.updateSize();
    };

    const syncSizeSoon = () => {
      cancelAnimationFrame(frameA);
      cancelAnimationFrame(frameB);
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }

      frameA = requestAnimationFrame(() => {
        syncSize();
        frameB = requestAnimationFrame(syncSize);
      });

      timeoutId = window.setTimeout(syncSize, 150);
    };

    const resizeObserver = new ResizeObserver(syncSizeSoon);

    resizeObserver.observe(container);
    syncSizeSoon();
    window.addEventListener("resize", syncSizeSoon);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", syncSizeSoon);
      cancelAnimationFrame(frameA);
      cancelAnimationFrame(frameB);
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [currentViewType]);

  // Imperatively update the FullCalendar toolbar title with a custom formatted date
  useEffect(() => {
    const titleEl = (calendarRef.current as any)?.el?.querySelector?.('.fc-toolbar-title') as HTMLElement | null;
    if (!titleEl) return;
    if (currentViewType === 'dayGridMonth') {
      titleEl.textContent = format(currentViewDate, 'MMMM yyyy');
    } else if (currentViewType === 'timeGridDay') {
      titleEl.textContent = format(currentViewDate, 'do MMMM yyyy');
    } else if (currentViewType === 'timeGridWeek') {
      titleEl.textContent = format(currentViewDate, "'Week of' do MMMM yyyy");
    } else if (currentViewType === 'listWeek') {
      titleEl.textContent = format(currentViewDate, "'Week of' do MMMM yyyy");
    }
  }, [currentViewType, currentViewDate]);


  const initialDate = useMemo(() => {
    if (selectedTask?.plannedStartISO) return parseISO(selectedTask.plannedStartISO);
    return new Date();
  }, [selectedTask?.plannedStartISO]);

  const goPrev = () => {
    const calendarApi = calendarRef.current?.getApi();
    calendarApi?.prev();
  };

  const goNext = () => {
    const calendarApi = calendarRef.current?.getApi();
    calendarApi?.next();
  };

  const goToday = () => {
    const calendarApi = calendarRef.current?.getApi();
    calendarApi?.today();
    calendarApi?.changeView("timeGridDay", new Date());
  };

  const setView = (view: CalendarView) => {
    const calendarApi = calendarRef.current?.getApi();
    if (!calendarApi) return;
    calendarApi.changeView(view, new Date());
  };

  return (
    <>
      <div className="h-full min-h-0 flex flex-col">
        <div className="shrink-0 border-b border-border/60 bg-linear-to-b from-card/50 to-background px-3 py-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 px-2"
                onClick={goPrev}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 px-2"
                onClick={goNext}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>

              <div className="inline-flex">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 px-2.5 text-xs rounded-r-none border-r-0"
                  onClick={goToday}
                >
                  Today
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 px-2 rounded-l-none"
                      aria-label="Change calendar view"
                    >
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="rounded-xl">
                    <DropdownMenuItem onClick={goToday}>Today</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setView("timeGridWeek")}>Week</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setView("dayGridMonth")}>Month</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            <div className="min-w-0 flex-1 text-center">
              <div className="truncate text-sm font-semibold">{headerTitle}</div>
            </div>
          </div>
        </div>

        <div className="flex-1 min-h-0">
          <div ref={calendarContainerRef} className="task-schedule-calendar h-full min-h-0">
            <FullCalendar
              ref={calendarRef}
              plugins={[timeGridPlugin, dayGridPlugin, listPlugin, interactionPlugin]}
              initialView="dayGridMonth"
              initialDate={initialDate}
              height="100%"
              nowIndicator
              editable
              selectable
              droppable
              weekends
              navLinks={true}
              slotLabelFormat={{ hour: "numeric", minute: "2-digit", omitZeroMinute: true, hour12: true }}
              views={{
                dayGridMonth: {
                  dayHeaderFormat: { weekday: "short" },
                  eventResizableFromStart: true,
                  durationEditable: true,
                },
                timeGridWeek: {
                  dayHeaderFormat: { weekday: "short", day: "numeric", omitCommas: true },
                },
                timeGridDay: {
                  dayHeaderFormat: { weekday: "short", day: "numeric", omitCommas: true },
                },
              }}
              scrollTime={scrollTime}
              scrollTimeReset={false}
              headerToolbar={false}
              dayMaxEvents={2}
              moreLinkContent={(args) => `${args.num} more`}

              events={events}
              eventOrder={(a: any, b: any) => {
                const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
                const priorityA = a.extendedProps.taskPriority ? priorityOrder[a.extendedProps.taskPriority as keyof typeof priorityOrder] ?? 4 : 4;
                const priorityB = b.extendedProps.taskPriority ? priorityOrder[b.extendedProps.taskPriority as keyof typeof priorityOrder] ?? 4 : 4;
                return priorityA - priorityB;
              }}
              eventContent={renderEventContent}
              eventClassNames={(arg) => {
                const type = arg.event.extendedProps.type as CalendarBlockType;
                if (arg.event.extendedProps.isScheduledTask) {
                  return ["task-event", "scheduled-task"];
                }
                if (!type) return ["task-event"];
                return [`fc-type-${type}`, "task-event"];
              }}
              eventClick={(arg) => {
                const isScheduledTask = arg.event.extendedProps.isScheduledTask;
                if (isScheduledTask) {
                  const taskId = arg.event.extendedProps.taskId;
                  // Capture mouse position for dialog positioning
                  const rect = (arg.el as HTMLElement).getBoundingClientRect();
                  const screenWidth = window.innerWidth;
                  const screenHeight = window.innerHeight;
                  const dialogWidth = 400; // approximate width
                  const dialogHeight = 400; // approximate height

                  // Calculate x position: show on right if there's space, otherwise left
                  let x = rect.right + 10;
                  if (x + dialogWidth > screenWidth) {
                    x = rect.left - dialogWidth - 10;
                  }
                  // Ensure x is within bounds
                  x = Math.max(10, Math.min(x, screenWidth - dialogWidth - 10));

                  // Calculate y position: keep it within vertical bounds
                  let y = rect.top;
                  if (y + dialogHeight > screenHeight) {
                    y = screenHeight - dialogHeight - 10;
                  }
                  // Ensure y is within bounds
                  y = Math.max(10, Math.min(y, screenHeight - dialogHeight - 10));

                  setDialogPosition({ x, y });
                  setSelectedTaskId(taskId);
                }
              }}
              dateClick={(arg) => {
                const calendarApi = calendarRef.current?.getApi();
                if (calendarApi) {
                  calendarApi.changeView("timeGridDay", arg.date);
                }
              }}
              datesSet={(dateInfo) => {
                const view = dateInfo.view.type as CalendarView;
                setCurrentViewType(view);
                setCurrentViewDate(dateInfo.view.currentStart);
                if (onViewChange) onViewChange(view);
              }}
              eventReceive={handleEventReceive}
              eventResize={handleEventResize}
              eventDrop={handleEventDrop}
            />
          </div>
        </div>
      </div>

      <TaskPreviewDialog
        taskId={selectedTaskId}
        open={!!selectedTaskId}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedTaskId("");
            setDialogPosition(null);
          }
        }}
        onUnschedule={handleTaskUnschedule}
        onStatusChange={handleStatusChange}
        position={dialogPosition}
      />
    </>
  );
}
