import { useMemo, useState, useRef, useEffect, useLayoutEffect } from "react";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import dayGridPlugin from "@fullcalendar/daygrid";
import listPlugin from "@fullcalendar/list";
import interactionPlugin from "@fullcalendar/interaction";
import type {
  EventReceiveArg,
  EventResizeDoneArg,
} from "@fullcalendar/interaction";
import type { EventContentArg, EventInput } from "@fullcalendar/core";
import {
  format,
  parseISO,
  isPast,
  addMinutes,
  addMonths,
  setMonth,
  setYear,
} from "date-fns";
import {
  isAllDayRangeLocal,
  normalizeAllDayRangeLocal,
  normalizeTimedRange,
  clampTimedRange,
  normalizeAllDayRangeForUpdate,
  ensureAllDayDropEndDate,
  DEFAULT_TIMED_DURATION_MINUTES,
} from "@/lib/date-utils";
import {
  Bell,
  Calendar,
  CalendarCheck,
  CalendarClock,
  CheckSquare,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Flag,
  Focus,
  Square,
  Timer,
  X,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar as CalendarUI } from "@/components/ui/calendar";
import { TaskPreviewDialog } from "./TaskPreviewDialog";
import { CreateTaskDialog } from "./CreateTaskDialog";
import { STATUS_OPTIONS, EVENT_STATUS_OPTIONS } from "./task-detail-shared";
import type { CalendarBlock, CalendarBlockType } from "@/types/task";
import { getThemeForTask } from "@/lib/calendarTheme";
import type { TaskDTO } from "@/hooks/api/useTasks";

type Props = {
  tasks: TaskDTO[];
  blocks: CalendarBlock[];
  selectedTask: TaskDTO | null;
  statusFilter?: string;
  onViewChange?: (view: string) => void;
  onDateChange?: (date: Date) => void;
  onTaskSchedule?: (
    taskId: string,
    startISO: string,
    endISO: string,
    isAllDay: boolean,
  ) => void;
};

type CalendarView =
  | "timeGridDay"
  | "timeGridWeek"
  | "dayGridMonth"
  | "listWeek";

const typeMeta: Record<
  CalendarBlockType,
  { label: string; icon: any; pill: string; bg: string; border: string }
> = {
  meeting: {
    label: "Meeting",
    icon: CalendarClock,
    pill: "bg-[var(--event-meeting-bg)] text-[var(--event-meeting-text)] border-[var(--event-meeting-border)]",
    bg: "bg-[var(--event-meeting-bg)]",
    border: "border-[var(--event-meeting-border)]",
  },
  focus_block: {
    label: "Focus block",
    icon: Focus,
    pill: "bg-[var(--event-focus-bg)] text-[var(--event-focus-text)] border-[var(--event-focus-border)]",
    bg: "bg-[var(--event-focus-bg)]",
    border: "border-[var(--event-focus-border)]",
  },
  task_slot: {
    label: "Task slot",
    icon: Timer,
    pill: "bg-[var(--event-task-bg)] text-[var(--event-task-text)] border-[var(--event-task-border)]",
    bg: "bg-[var(--event-task-bg)]",
    border: "border-[var(--event-task-border)]",
  },
  deadline_marker: {
    label: "Deadline",
    icon: Flag,
    pill: "bg-[var(--event-deadline-bg)] text-[var(--event-deadline-text)] border-[var(--event-deadline-border)]",
    bg: "bg-[var(--event-deadline-bg)]",
    border: "border-[var(--event-deadline-border)]",
  },
  reminder: {
    label: "Reminder",
    icon: Bell,
    pill: "bg-[var(--event-reminder-bg)] text-[var(--event-reminder-text)] border-[var(--event-reminder-border)]",
    bg: "bg-[var(--event-reminder-bg)]",
    border: "border-[var(--event-reminder-border)]",
  },
};

function makeEventInput(block: CalendarBlock, task?: TaskDTO): EventInput {
  const base = {
    id: block.id,
    title: block.title,
    start: block.startISO,
    end: block.endISO,
    backgroundColor: "transparent",
    borderColor: "transparent",
    textColor: "inherit",
    extendedProps: {
      type: block.type,
      taskId: block.taskId,
      notes: block.notes,
      taskTitle: task?.title,
      projectTitle: task?.projectTitle,
      taskStatus: task?.status,
    },
  } satisfies EventInput;

  const isBacklog = task?.status === "backlog";

  if (block.type === "deadline_marker") {
    return {
      ...base,
      allDay: false,
      start: block.startISO,
      end: new Date(
        new Date(block.startISO).getTime() + 10 * 60000,
      ).toISOString(),
      display: "auto",
      classNames: ["task-deadline", isBacklog ? "is-backlog" : ""].filter(
        Boolean,
      ),
    };
  }

  if (block.type === "focus_block") {
    return {
      ...base,
      display: "background",
      classNames: ["task-focus-bg", isBacklog ? "is-backlog" : ""].filter(
        Boolean,
      ),
    };
  }

  return {
    ...base,
    classNames: ["task-event", isBacklog ? "is-backlog" : ""].filter(Boolean),
  };
}

function getChipStyles(type?: string, priority?: string, status?: string) {
  return getThemeForTask(type, priority, status);
}
function renderEventContent(arg: EventContentArg) {
  const type = arg.event.extendedProps.type as CalendarBlockType;
  const isScheduledTask = arg.event.extendedProps.isScheduledTask;
  const isMonthView = arg.view.type === "dayGridMonth";
  const isBacklog = arg.event.extendedProps.taskStatus === "backlog";

  const BacklogDot = () => (
    <div
      className="absolute top-0 right-0 size-2.5 bg-destructive rounded-full z-50 pointer-events-none"
      style={{ transform: "translate(50%, -50%)" }}
    />
  );

  if (isMonthView) {
    const taskType = arg.event.extendedProps.taskType;
    const isDone =
      arg.event.extendedProps.taskStatus === "done" ||
      arg.event.extendedProps.taskStatus === "completed";
    return (
      <div className="relative size-full overflow-visible">
        {isBacklog && <BacklogDot />}
        <div
          className="w-full truncate text-[12px] font-medium px-1.5 py-0.5 flex items-center gap-1.5"
          style={{ color: arg.textColor || "inherit" }}
        >
          {isScheduledTask &&
            (taskType === "event" ? (
              isDone ? (
                <CalendarCheck className="size-3 shrink-0 opacity-70" />
              ) : (
                <Calendar className="size-3 shrink-0 opacity-70" />
              )
            ) : isDone ? (
              <CheckSquare className="size-3 shrink-0 opacity-70" />
            ) : (
              <Square className="size-3 shrink-0 opacity-70" />
            ))}
          <span
            className={cn(
              "truncate",
              isDone && "line-through italic opacity-70",
            )}
          >
            {arg.event.title}
          </span>
        </div>
      </div>
    );
  }

  // Handle scheduled tasks (no type metadata)
  if (isScheduledTask) {
    const taskType = arg.event.extendedProps.taskType;
    const isDone =
      arg.event.extendedProps.taskStatus === "done" ||
      arg.event.extendedProps.taskStatus === "completed";
    return (
      <div className="relative size-full overflow-visible">
        {isBacklog && <BacklogDot />}
        <div
          className="size-full p-2 overflow-hidden flex items-center gap-1.5"
          style={{ color: arg.textColor || "inherit" }}
        >
          {taskType === "event" ? (
            isDone ? (
              <CalendarCheck className="size-3.5 shrink-0 opacity-70" />
            ) : (
              <Calendar className="size-3.5 shrink-0 opacity-70" />
            )
          ) : isDone ? (
            <CheckSquare className="size-3.5 shrink-0 opacity-70" />
          ) : (
            <Square className="size-3.5 shrink-0 opacity-70" />
          )}
          <div
            className={cn(
              "text-[11px] font-bold leading-tight truncate flex-1",
              isDone && "line-through italic opacity-70",
            )}
          >
            {arg.event.title}
          </div>
        </div>
      </div>
    );
  }

  // Handle calendar blocks with type metadata
  if (!type || !typeMeta[type]) {
    return (
      <div className="relative size-full overflow-visible">
        {isBacklog && <BacklogDot />}
        <div className="p-2 text-xs overflow-hidden">{arg.event.title}</div>
      </div>
    );
  }

  const meta = typeMeta[type];
  const Icon = meta.icon;
  const isBg = arg.event.display === "background";

  if (isBg) {
    return (
      <div className="relative size-full overflow-visible">
        {isBacklog && <BacklogDot />}
        <div className="size-full px-2 py-1.5 opacity-40 overflow-hidden">
          <div className="flex items-center gap-2">
            <Icon className="size-3" />
            <span className="text-[10px] font-bold uppercase tracking-wider truncate">
              {arg.event.title}
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative size-full overflow-visible">
      {isBacklog && <BacklogDot />}
      <div
        className={cn(
          "size-full p-2 border-l-4 overflow-hidden",
          meta.bg,
          meta.border.replace("border-", "border-l-"),
        )}
      >
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-bold leading-tight truncate">
              {arg.event.title}
            </div>
            <div className="mt-1 flex items-center gap-1.5">
              <span className="text-[9px] font-bold uppercase tracking-widest opacity-60">
                {meta.label}
              </span>
            </div>
          </div>
          <Icon className="size-3.5 opacity-40" />
        </div>
      </div>
    </div>
  );
}

function QuickNavPopover({
  currentViewDate,
  calendarApi,
  children,
}: {
  currentViewDate: Date;
  calendarApi: any;
  children: React.ReactNode;
}) {
  const [navDate, setNavDate] = useState(currentViewDate);
  const [view, setView] = useState<"days" | "months" | "years">("days");
  const [isOpen, setIsOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const isCancelledRef = useRef(false);
  const selectedDateRef = useRef<Date | undefined>(undefined);

  // Sync navDate when popover opens
  useEffect(() => {
    if (isOpen) {
      setNavDate(currentViewDate);
      setView("days");
      setSelectedDate(undefined);
      selectedDateRef.current = undefined;
      isCancelledRef.current = false;
    }
  }, [isOpen, currentViewDate]);

  const handleOpenChange = (open: boolean) => {
    if (!open && !isCancelledRef.current && calendarApi) {
      if (selectedDateRef.current) {
        calendarApi.gotoDate(selectedDateRef.current);
      } else {
        // If the user browsed to a different month/year but didn't pick a day,
        // still navigate to that period on close.
        calendarApi.gotoDate(navDate);
      }
    }
    setIsOpen(open);
  };

  const handleDaySelect = (date: Date | undefined) => {
    if (date) {
      setSelectedDate(date);
      selectedDateRef.current = date;
      setIsOpen(false);
    }
  };

  const handleCancel = () => {
    isCancelledRef.current = true;
    setIsOpen(false);
  };

  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];

  const handleMonthSelect = (monthIndex: number) => {
    setNavDate(setMonth(navDate, monthIndex));
    setView("days");
  };

  const handleYearSelect = (year: number) => {
    setNavDate(setYear(navDate, year));
    setView("months");
  };

  const years = useMemo(() => {
    const currentYear = navDate.getFullYear();
    const startYear = currentYear - 5;
    return Array.from({ length: 12 }, (_, i) => startYear + i);
  }, [navDate]);

  return (
    <Popover open={isOpen} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        className="w-auto p-3 rounded-xl shadow-xl border-border/60"
        align="center"
        sideOffset={8}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            isCancelledRef.current = true;
          }
        }}
      >
        {view === "days" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-0.5">
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 rounded-md hover:bg-accent"
                  onClick={handleCancel}
                >
                  <X className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-1.5 text-sm font-bold hover:bg-accent rounded-md"
                  onClick={() => setView("months")}
                >
                  {format(navDate, "MMMM")}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-1.5 text-sm font-bold hover:bg-accent rounded-md"
                  onClick={() => setView("years")}
                >
                  {format(navDate, "yyyy")}
                </Button>
              </div>
              <div className="flex items-center gap-0.5">
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 rounded-md"
                  onClick={() => setNavDate(addMonths(navDate, -1))}
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 rounded-md"
                  onClick={() => setNavDate(addMonths(navDate, 1))}
                >
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>
            <CalendarUI
              mode="single"
              selected={selectedDate || currentViewDate}
              onSelect={handleDaySelect}
              month={navDate}
              onMonthChange={setNavDate}
              initialFocus
              className="p-0"
              classNames={{
                nav: "hidden",
                month_caption: "hidden",
                today: "bg-primary text-primary-foreground rounded-full",
                selected: "bg-accent text-accent-foreground rounded-md",
              }}
            />
          </div>
        )}

        {view === "months" && (
          <div className="space-y-4 w-[240px]">
            <div className="flex items-center justify-center pt-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-sm font-bold hover:bg-accent rounded-md"
                onClick={() => setView("years")}
              >
                {navDate.getFullYear()}
              </Button>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {months.map((m, i) => (
                <Button
                  key={m}
                  variant={navDate.getMonth() === i ? "default" : "ghost"}
                  size="sm"
                  className={cn(
                    "h-9 text-xs font-medium rounded-md",
                    navDate.getMonth() === i
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-accent",
                  )}
                  onClick={() => handleMonthSelect(i)}
                >
                  {m}
                </Button>
              ))}
            </div>
          </div>
        )}

        {view === "years" && (
          <div className="space-y-4 w-[240px]">
            <div className="flex items-center justify-between px-1 pt-1">
              <Button
                variant="ghost"
                size="icon"
                className="size-7 rounded-md"
                onClick={() =>
                  setNavDate(setYear(navDate, navDate.getFullYear() - 12))
                }
              >
                <ChevronLeft className="size-4" />
              </Button>
              <span className="text-xs font-bold tabular-nums">
                {years[0]} - {years[years.length - 1]}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 rounded-md"
                onClick={() =>
                  setNavDate(setYear(navDate, navDate.getFullYear() + 12))
                }
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {years.map((y) => (
                <Button
                  key={y}
                  variant={navDate.getFullYear() === y ? "default" : "ghost"}
                  size="sm"
                  className={cn(
                    "h-9 text-xs font-medium rounded-md",
                    navDate.getFullYear() === y
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-accent",
                  )}
                  onClick={() => handleYearSelect(y)}
                >
                  {y}
                </Button>
              ))}
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

import "./calendar-styles.css";

export function TaskSchedulePane({
  tasks,
  blocks,
  selectedTask,
  statusFilter = "All",
  onViewChange,
  onDateChange,
  onTaskSchedule,
}: Props) {
  const [selectedTaskId, setSelectedTaskId] = useState<string>("");
  const [dialogPosition, setDialogPosition] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createInitialValues, setCreateInitialValues] = useState<
    Partial<TaskDTO> | undefined
  >(undefined);
  const [currentViewType, setCurrentViewType] =
    useState<CalendarView>("dayGridMonth");
  const [currentViewDate, setCurrentViewDate] = useState<Date>(new Date());
  const [events, setEvents] = useState<EventInput[]>([]);
  const unscheduledTaskIds = useRef<Set<string>>(new Set());
  const calendarRef = useRef<FullCalendar>(null);
  const calendarContainerRef = useRef<HTMLDivElement>(null);

  // Sync local events state with props (tasks and blocks)
  useEffect(() => {
    console.log("🔄 Syncing events state with props", {
      tasks: tasks.length,
      blocks: blocks.length,
      unscheduledIds: unscheduledTaskIds.current.size,
    });

    const blockEvents = blocks.map((block) => {
      const task = tasks.find((t) => t.id === block.taskId);
      return makeEventInput(block, task);
    });

    const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
    // Determine if we are filtering by type (Status sub-filters also count as type filtering)
    const isTaskFiltered =
      statusFilter === "Task" || STATUS_OPTIONS.includes(statusFilter as any);
    const isEventFiltered =
      statusFilter === "Event" ||
      EVENT_STATUS_OPTIONS.includes(statusFilter as any);

    const taskEvents = tasks
      .filter((t) => {
        if (
          !t.start_date ||
          !t.due_date ||
          unscheduledTaskIds.current.has(t.id)
        )
          return false;
        if (isTaskFiltered) return t.type === "task";
        if (isEventFiltered) return t.type === "event";
        return true;
      })
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
        const isAllDay =
          t.is_all_day !== undefined
            ? t.is_all_day
            : isAllDayRangeLocal(startDate, endDate);

        console.log("🔍 All-day detection:", {
          taskId: t.id,
          startDate: t.start_date,
          endDate: t.due_date,
          isAllDay,
        });

        const isDone = t.status === "done" || t.status === "completed";
        const chipStyles = getChipStyles(t.type, t.priority, t.status);

        return {
          id: t.id,
          title: t.title,
          start: t.start_date!,
          end: t.due_date!,
          allDay: isAllDay,
          display: "block",
          backgroundColor: chipStyles.background,
          borderColor: chipStyles.border,
          textColor: chipStyles.text,
          classNames: [
            t.type === "event"
              ? "task-event-block"
              : `task-priority-${t.priority}`,
            t.status === "backlog" ? "is-backlog" : "",
          ].filter(Boolean),
          extendedProps: {
            taskId: t.id,
            taskTitle: t.title,
            projectTitle: t.projectTitle,
            taskStatus: t.status,
            taskPriority: t.priority,
            taskType: t.type,
            isScheduledTask: true,
          },
          editable: !isDone,
        } satisfies EventInput;
      });

    const allEvents = [...blockEvents, ...taskEvents];
    setEvents((prevEvents) => {
      const isSame =
        prevEvents.length === allEvents.length &&
        prevEvents.every((evt, idx) => {
          const nextEvt = allEvents[idx];
          return (
            evt.id === nextEvt.id &&
            evt.start === nextEvt.start &&
            evt.end === nextEvt.end &&
            evt.title === nextEvt.title
          );
        });
      if (isSame) {
        return prevEvents;
      }
      console.log("✅ Events state updated:", allEvents.length);
      return allEvents;
    });
  }, [tasks, blocks, statusFilter]);

  // Handle unschedule - remove task from local events state
  const handleTaskUnschedule = (taskId: string) => {
    console.log("🗑️ Unschedule clicked:", taskId);
    // Optimistic update: add to unscheduled ref immediately
    unscheduledTaskIds.current.add(taskId);
    console.log(
      "📝 Added to unscheduled ref:",
      taskId,
      unscheduledTaskIds.current,
    );
    // Remove from events state
    setEvents((prev) => prev.filter((e) => e.id !== taskId));
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
    // Completed tasks stay on the calendar now.
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
      const startDate = info.event.start;
      const endDate = info.event.end;
      const viewType = info.view.type;

      console.log("🎯 Task dropped on calendar:", {
        taskId,
        start: startDate,
        end: endDate,
        viewType,
      });

      // Validation: Check if scheduled in the past
      if (startDate && isPast(startDate)) {
        console.error("❌ Cannot schedule tasks in the past");
        toast.error("Cannot schedule in the past", {
          description: "Please select a future time slot.",
        });
        info.revert();
        return;
      }

      const isAllDayDrop = !!info.event.allDay || viewType === "dayGridMonth";

      if (isAllDayDrop) {
        if (startDate && onTaskSchedule) {
          const { start: allDayStart, end: allDayEnd } =
            normalizeAllDayRangeLocal(startDate, endDate);
          const startISO = allDayStart.toISOString();
          const endISO = allDayEnd.toISOString();

          onTaskSchedule(taskId, startISO, endISO, true);

          const isMultiDay =
            allDayEnd.getTime() - allDayStart.getTime() > 24 * 60 * 60 * 1000;
          toast.success("Task scheduled", {
            description: isMultiDay
              ? `${info.event.title} scheduled from ${format(allDayStart, "MMM dd")} to ${format(new Date(allDayEnd.getTime() - 86400000), "MMM dd")}`
              : `${info.event.title} scheduled for ${format(allDayStart, "MMM dd, yyyy")}`,
          });

          if (viewType === "dayGridMonth") {
            const calendarApi = calendarRef.current?.getApi();
            if (calendarApi) {
              calendarApi.changeView("timeGridDay", startDate);
            }
          }
        }
      } else {
        // Handle day/week view drop: use the dropped time directly
        if (startDate && endDate && onTaskSchedule) {
          const { start: timedStart, end: timedEnd } = normalizeTimedRange(
            startDate,
            endDate,
          );
          onTaskSchedule(
            taskId,
            timedStart.toISOString(),
            timedEnd.toISOString(),
            false,
          );

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
        const isAllDay = !!(info.event as any).allDay;
        if (isAllDay) {
          const { start: allDayStart, end: allDayEnd } =
            normalizeAllDayRangeLocal(startDate, endDate);
          onTaskSchedule(
            taskId,
            allDayStart.toISOString(),
            allDayEnd.toISOString(),
            true,
          );
        } else {
          const { start: timedStart, end: timedEnd } = normalizeTimedRange(
            startDate,
            endDate,
          );
          onTaskSchedule(
            taskId,
            timedStart.toISOString(),
            timedEnd.toISOString(),
            false,
          );
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

      console.log("🔄 Task moved:", {
        taskId,
        newStart: startDate,
        newEnd: endDate,
        viewType,
      });

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
        const range = normalizeAllDayRangeLocal(startDate, safeEndDate.end);
        const { startISO, endISO } = normalizeAllDayRangeForUpdate(range);
        if (onTaskSchedule) {
          onTaskSchedule(taskId, startISO, endISO, true);
          toast.success("Task rescheduled");
        }
      } else {
        const clampedRange = clampTimedRange(startDate, endDate);
        const { start: timedStart, end: timedEnd } = normalizeTimedRange(
          clampedRange.start,
          clampedRange.end,
        );
        if (onTaskSchedule) {
          onTaskSchedule(
            taskId,
            timedStart.toISOString(),
            timedEnd.toISOString(),
            false,
          );
          toast.success("Task rescheduled");
        }
      }
    } catch (error) {
      console.error("❌ Error in handleEventDrop:", error);
      toast.error("Failed to reschedule task");
    }
  };

  const headerTitle = useMemo(() => {
    if (currentViewType === "dayGridMonth")
      return format(currentViewDate, "MMMM yyyy");
    if (currentViewType === "timeGridWeek")
      return format(currentViewDate, "MMMM yyyy");
    if (currentViewType === "timeGridDay")
      return format(currentViewDate, "EEEE, do MMMM yyyy");
    if (currentViewType === "listWeek")
      return format(currentViewDate, "MMMM yyyy");
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
    const titleEl = (calendarRef.current as any)?.el?.querySelector?.(
      ".fc-toolbar-title",
    ) as HTMLElement | null;
    if (!titleEl) return;
    if (currentViewType === "dayGridMonth") {
      titleEl.textContent = format(currentViewDate, "MMMM yyyy");
    } else if (currentViewType === "timeGridDay") {
      titleEl.textContent = format(currentViewDate, "do MMMM yyyy");
    } else if (currentViewType === "timeGridWeek") {
      titleEl.textContent = format(currentViewDate, "'Week of' do MMMM yyyy");
    } else if (currentViewType === "listWeek") {
      titleEl.textContent = format(currentViewDate, "'Week of' do MMMM yyyy");
    }
  }, [currentViewType, currentViewDate]);

  // Handle month/week/day change using mouse scroll wheel or 2-finger touchpad swipe left/right
  useEffect(() => {
    const container = calendarContainerRef.current;
    if (!container) return;

    const lastScrollTime = { current: 0 };
    const cooldown = 600; // ms cooldown between navigation switches
    const threshold = 15; // minimum delta to trigger navigation

    const handleWheel = (e: WheelEvent) => {
      const calendarApi = calendarRef.current?.getApi();
      if (!calendarApi) return;

      const viewType = calendarApi.view.type;
      const now = Date.now();
      const absX = Math.abs(e.deltaX);
      const absY = Math.abs(e.deltaY);

      if (absX > absY) {
        // Horizontal scroll / 2-finger touchpad swipe left/right
        // Intercept and use for navigation in all views
        if (absX > threshold) {
          if (now - lastScrollTime.current < cooldown) {
            e.preventDefault();
            return;
          }
          e.preventDefault();
          if (e.deltaX > 0) {
            calendarApi.next();
          } else {
            calendarApi.prev();
          }
          lastScrollTime.current = now;
        }
      } else {
        // Vertical scroll / mouse scroll wheel
        // Hijack vertical scroll for navigation ONLY in month view (dayGridMonth)
        // because vertical scroll in Day/Week views is needed to scroll hours.
        if (viewType === "dayGridMonth") {
          if (absY > threshold) {
            if (now - lastScrollTime.current < cooldown) {
              e.preventDefault();
              return;
            }
            e.preventDefault();
            if (e.deltaY > 0) {
              calendarApi.next();
            } else {
              calendarApi.prev();
            }
            lastScrollTime.current = now;
          }
        }
      }
    };

    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      container.removeEventListener("wheel", handleWheel);
    };
  }, []);

  const initialDate = useMemo(() => {
    if (selectedTask?.plannedStartISO)
      return parseISO(selectedTask.plannedStartISO);
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
              <div className="inline-flex">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 px-2.5 text-xs rounded-r-none border-r-0"
                  onClick={
                    currentViewType === "dayGridMonth"
                      ? goToday
                      : () => setView("dayGridMonth")
                  }
                >
                  {currentViewType === "dayGridMonth" ? "Today" : "Month"}
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    className={cn(
                      buttonVariants({ variant: "outline", size: "sm" }),
                      "h-8 px-2 rounded-l-none flex items-center justify-center cursor-pointer",
                    )}
                    aria-label="Change calendar view"
                  >
                    <ChevronDown className="size-4" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="rounded-xl">
                    <DropdownMenuItem onClick={goToday}>Today</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setView("timeGridWeek")}>
                      Week
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setView("dayGridMonth")}>
                      Month
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            <div className="min-w-0 flex-1 flex items-center justify-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 px-2"
                onClick={goPrev}
              >
                <ChevronLeft className="size-4" />
              </Button>
              <QuickNavPopover
                currentViewDate={currentViewDate}
                calendarApi={calendarRef.current?.getApi()}
              >
                <button
                  type="button"
                  className="truncate text-sm font-semibold text-center cursor-pointer transition-colors duration-200 select-none py-1 px-2.5 rounded-md hover:bg-muted/80 active:bg-muted/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  {headerTitle}
                </button>
              </QuickNavPopover>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 px-2"
                onClick={goNext}
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>

            <div className="flex items-center gap-1 shrink-0 w-[88px]" />
          </div>
        </div>

        <div className="flex-1 min-h-0">
          <div
            ref={calendarContainerRef}
            className="task-schedule-calendar h-full min-h-0"
          >
            <FullCalendar
              ref={calendarRef}
              plugins={[
                timeGridPlugin,
                dayGridPlugin,
                listPlugin,
                interactionPlugin,
              ]}
              initialView="dayGridMonth"
              initialDate={initialDate}
              height="100%"
              nowIndicator
              editable
              selectable
              droppable
              weekends
              navLinks={true}
              slotLabelFormat={{
                hour: "numeric",
                minute: "2-digit",
                omitZeroMinute: true,
                hour12: true,
              }}
              views={{
                dayGridMonth: {
                  dayHeaderFormat: { weekday: "short" },
                  eventResizableFromStart: true,
                },
                timeGridWeek: {
                  dayHeaderFormat: {
                    weekday: "short",
                    day: "numeric",
                    omitCommas: true,
                  },
                },
                timeGridDay: {
                  dayHeaderFormat: {
                    weekday: "short",
                    day: "numeric",
                    omitCommas: true,
                  },
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
                const priorityA = a.extendedProps.taskPriority
                  ? (priorityOrder[
                      a.extendedProps.taskPriority as keyof typeof priorityOrder
                    ] ?? 4)
                  : 4;
                const priorityB = b.extendedProps.taskPriority
                  ? (priorityOrder[
                      b.extendedProps.taskPriority as keyof typeof priorityOrder
                    ] ?? 4)
                  : 4;
                return priorityA - priorityB;
              }}
              eventContent={renderEventContent}
              eventClassNames={(arg: any) => {
                const type = arg.event.extendedProps.type as CalendarBlockType;
                if (arg.event.extendedProps.isScheduledTask) {
                  const status = arg.event.extendedProps.taskStatus as string;
                  const isDone = status === "done" || status === "completed";
                  return [
                    "task-event",
                    "scheduled-task",
                    status ? `task-status-${status}` : "",
                    isDone ? "is-done" : "",
                  ].filter(Boolean);
                }
                if (!type) return ["task-event"];
                return [`fc-type-${type}`, "task-event"];
              }}
              eventClick={(arg) => {
                const isScheduledTask = arg.event.extendedProps.isScheduledTask;
                if (isScheduledTask) {
                  const taskId = arg.event.extendedProps.taskId;
                  // Capture position for dialog relative to the date cell if possible, fallback to event pill
                  const cellEl = (arg.el as HTMLElement).closest(
                    ".fc-daygrid-day, .fc-timegrid-col",
                  ) as HTMLElement | null;
                  const rect = (cellEl || arg.el).getBoundingClientRect();

                  const screenWidth = window.innerWidth;
                  const screenHeight = window.innerHeight;
                  const dialogWidth = 340; // match new max-w-[340px]
                  const dialogHeight = 200; // approximate compact height

                  // Calculate x position: show on right of cell if there's space, otherwise left
                  let x = rect.right + 10;
                  if (x + dialogWidth > screenWidth) {
                    x = rect.left - dialogWidth - 10;
                  }
                  // Ensure x is within bounds
                  x = Math.max(10, Math.min(x, screenWidth - dialogWidth - 10));

                  // Calculate y position: align with top of the cell
                  let y = rect.top;
                  if (y + dialogHeight > screenHeight) {
                    y = screenHeight - dialogHeight - 10;
                  }
                  // Ensure y is within bounds
                  y = Math.max(
                    10,
                    Math.min(y, screenHeight - dialogHeight - 10),
                  );

                  setDialogPosition({ x, y });
                  setSelectedTaskId(taskId);
                }
              }}
              dateClick={(arg) => {
                const clickedDate = arg.date;
                // Compute a default due_date so the created task is visible on the calendar.
                // The calendar filter requires BOTH start_date AND due_date to render an event.
                let defaultDueDate: Date;
                if (arg.allDay) {
                  // Month view or all-day row click → schedule as a full-day event (exclusive end = next midnight)
                  const { end: allDayEnd } =
                    normalizeAllDayRangeLocal(clickedDate);
                  defaultDueDate = allDayEnd;
                } else {
                  // Timed view click → default to 1-hour slot (matches DEFAULT_TIMED_DURATION_MINUTES)
                  defaultDueDate = addMinutes(
                    clickedDate,
                    DEFAULT_TIMED_DURATION_MINUTES,
                  );
                }
                // Respect the active filter: if the user is viewing Events, default to creating an event
                const defaultType: "task" | "event" =
                  statusFilter === "Event" ||
                  EVENT_STATUS_OPTIONS.includes(statusFilter as any)
                    ? "event"
                    : "task";
                setCreateInitialValues({
                  type: defaultType,
                  start_date: clickedDate.toISOString(),
                  due_date: defaultDueDate.toISOString(),
                  is_all_day: arg.allDay,
                } as Partial<TaskDTO>);
                setCreateDialogOpen(true);
              }}
              selectMirror
              select={(arg) => {
                // User dragged to select a time range — open create dialog with exact start/end.
                // Uses the same normalisation helpers as drop/resize to stay consistent.
                let startISO: string;
                let endISO: string;
                if (arg.allDay) {
                  // All-day selection (month view or all-day row drag)
                  const { start, end } = normalizeAllDayRangeLocal(
                    arg.start,
                    arg.end,
                  );
                  startISO = start.toISOString();
                  endISO = end.toISOString();
                } else {
                  // Timed selection (day/week view drag)
                  const { start, end } = normalizeTimedRange(
                    arg.start,
                    arg.end,
                  );
                  startISO = start.toISOString();
                  endISO = end.toISOString();
                }
                // Respect the active filter: if the user is viewing Events, default to creating an event
                const defaultType: "task" | "event" =
                  statusFilter === "Event" ||
                  EVENT_STATUS_OPTIONS.includes(statusFilter as any)
                    ? "event"
                    : "task";
                setCreateInitialValues({
                  type: defaultType,
                  start_date: startISO,
                  due_date: endISO,
                  is_all_day: arg.allDay,
                } as Partial<TaskDTO>);
                setCreateDialogOpen(true);
              }}
              datesSet={(dateInfo) => {
                const view = dateInfo.view.type as CalendarView;
                setCurrentViewType(view);
                setCurrentViewDate(dateInfo.view.currentStart);
                if (onViewChange) onViewChange(view);
                if (onDateChange) onDateChange(dateInfo.view.currentStart);
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

      <CreateTaskDialog
        open={createDialogOpen}
        onOpenChange={(open) => {
          setCreateDialogOpen(open);
          if (!open) setCreateInitialValues(undefined);
        }}
        initialValues={createInitialValues}
        onTaskCreated={() => {
          setCreateDialogOpen(false);
          setCreateInitialValues(undefined);
        }}
      />
    </>
  );
}
