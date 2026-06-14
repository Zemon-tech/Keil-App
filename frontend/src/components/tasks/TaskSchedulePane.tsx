import { useMemo, useState, useRef, useEffect, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
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
} from "date-fns";
import { CalendarSidebar } from "./CalendarSidebar";
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
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Flag,
  Focus,
  Timer,
  X,
  PanelRightOpen,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { TaskPreviewDialog } from "./TaskPreviewDialog";
import { CreateTaskDialog } from "./CreateTaskDialog";
import { QuickNavPopover } from "./QuickNavPopover";
import { STATUS_OPTIONS, EVENT_STATUS_OPTIONS, StatusIcon } from "./task-detail-shared";
import type { CalendarBlock, CalendarBlockType, AnyStatus } from "@/types/task";
import { getThemeForTask, blockTypeThemeMap } from "@/lib/calendarTheme";
import type { TaskDTO } from "@/hooks/api/useTasks";
import { useAppContext } from "@/contexts/AppContext";

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
  /** Callback to open/expand the task list sidebar */
  onOpenSidebar?: () => void;
};

type CalendarView =
  | "timeGridDay"
  | "timeGridWeek"
  | "dayGridMonth"
  | "listWeek";

// ─── Calendar State Persistence Keys ──────────────────────────────────────────
const STORAGE_CALENDAR_VIEW = "keil_calendar_view";
const STORAGE_CALENDAR_DATE = "keil_calendar_date";

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
  const isAllDay = arg.event.allDay;
  const isBacklog = arg.event.extendedProps.taskStatus === "backlog";

  const BacklogDot = () => (
    <div
      className="absolute top-0 right-0 size-2.5 bg-destructive rounded-full z-50 pointer-events-none"
      style={{ transform: "translate(50%, -50%)" }}
    />
  );

  const start = arg.event.start;
  let formattedTime = "";
  if (start) {
    formattedTime = format(start, "h:mm a").toLowerCase();
  }

  if (isMonthView || isAllDay) {
    const isDone =
      arg.event.extendedProps.taskStatus === "done" ||
      arg.event.extendedProps.taskStatus === "completed";
    const taskType = arg.event.extendedProps.taskType;

    let IconComponent: any = null;
    if (isScheduledTask) {
      if (taskType === "event") {
        IconComponent = <CalendarClock className="size-3 shrink-0 opacity-70" />;
      } else {
        IconComponent = (
          <StatusIcon
            status={arg.event.extendedProps.taskStatus}
            type="task"
            className="size-3 shrink-0 opacity-70"
          />
        );
      }
    } else if (type && typeMeta[type]) {
      const BlockIcon = typeMeta[type].icon;
      IconComponent = <BlockIcon className="size-3 shrink-0 opacity-70" />;
    }

    return (
      <div className="relative size-full overflow-hidden flex items-center justify-between px-2.5 py-0.5">
        {isBacklog && <BacklogDot />}
        <div className="flex items-center min-w-0 flex-1 pr-2 gap-1.5">
          {IconComponent}
          <span
            className={cn(
              "truncate font-medium text-[11px]",
              isDone && "line-through italic opacity-70",
            )}
          >
            {arg.event.title}
          </span>
        </div>
        {formattedTime && (
          <span className="shrink-0 text-[10px] opacity-60 font-normal ml-1">
            {formattedTime}
          </span>
        )}
      </div>
    );
  }

  // timed views (Week/Day)
  const isDone =
    arg.event.extendedProps.taskStatus === "done" ||
    arg.event.extendedProps.taskStatus === "completed";
  
  let blockTitle = arg.event.title;
  let labelText = "";
  let themeBg = "bg-muted/30";
  let themeBorder = "border-border";
  
  if (isScheduledTask) {
    themeBg = ""; // set via inline styles below
    themeBorder = "";
  } else if (type && typeMeta[type]) {
    const meta = typeMeta[type];
    themeBg = meta.bg;
    themeBorder = meta.border;
    if (type !== "meeting") {
      labelText = meta.label;
    }
  }

  const isBg = arg.event.display === "background";

  if (isBg) {
    const Icon = type && typeMeta[type] ? typeMeta[type].icon : Focus;
    return (
      <div className="relative size-full overflow-visible">
        {isBacklog && <BacklogDot />}
        <div className="size-full px-3 py-2 opacity-30 overflow-hidden">
          <div className="flex items-center gap-2">
            <Icon className="size-3.5" />
            <span className="text-[10px] font-bold uppercase tracking-wider truncate">
              {blockTitle}
            </span>
          </div>
        </div>
      </div>
    );
  }

  const inlineStyles: React.CSSProperties = {};
  if (isScheduledTask) {
    const chipStyles = getThemeForTask(
      arg.event.extendedProps.taskType,
      arg.event.extendedProps.taskPriority,
      arg.event.extendedProps.taskStatus
    );
    inlineStyles.backgroundColor = chipStyles.background;
    inlineStyles.borderColor = chipStyles.border;
    inlineStyles.color = chipStyles.text;
  } else if (type && blockTypeThemeMap[type]) {
    const chipStyles = blockTypeThemeMap[type];
    inlineStyles.backgroundColor = chipStyles.background;
    inlineStyles.borderColor = chipStyles.border;
    inlineStyles.color = chipStyles.text;
    themeBg = "";
    themeBorder = "";
  }

  return (
    <div className="relative size-full overflow-visible" style={inlineStyles}>
      {isBacklog && <BacklogDot />}
      <div
        className={cn(
          "size-full p-3 border rounded-xl overflow-hidden flex flex-col justify-start relative",
          themeBg,
          themeBorder
        )}
        style={{
          color: inlineStyles.color || "inherit",
          borderColor: inlineStyles.borderColor || undefined,
          backgroundColor: inlineStyles.backgroundColor || undefined,
        }}
      >
        <div className="min-w-0 flex flex-col justify-start gap-0.5">
          <div
            className={cn(
              "text-xs font-semibold leading-snug break-words pr-4",
              isDone && "line-through italic opacity-70"
            )}
          >
            {blockTitle}
          </div>
          
          {formattedTime && (
            <div className="text-[10px] font-medium opacity-75">
              {formattedTime}
            </div>
          )}
          
          {labelText && (
            <div className="mt-1">
              <span className="text-[8px] font-bold uppercase tracking-widest opacity-60">
                {labelText}
              </span>
            </div>
          )}
        </div>

        {/* Small top-right status dot — only for meetings and events */}
        {((isScheduledTask && arg.event.extendedProps.taskType === "event") || type === "meeting") && (
          <span
            className="absolute top-2.5 right-2.5 size-1.5 rounded-full shrink-0"
            style={{
              backgroundColor: inlineStyles.color || "currentColor",
              opacity: 0.9,
            }}
          />
        )}
      </div>
    </div>
  );
}

// Removed duplicate local QuickNavPopover component definition - imported from "./QuickNavPopover" instead

import "./calendar-styles.css";

export function TaskSchedulePane({
  tasks,
  blocks,
  selectedTask,
  statusFilter = "All",
  onViewChange,
  onDateChange,
  onTaskSchedule,
  onOpenSidebar,
}: Props) {
  const { activeOrgId, activeSpaceId } = useAppContext();
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const [calendarDetailsView, setCalendarDetailsView] = useState<"sidebar" | "dialog">(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("default_calendar_details_view") as "sidebar" | "dialog") || "sidebar";
    }
    return "sidebar";
  });

  const [hideCalendarDayHeaders, setHideCalendarDayHeaders] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("hide_calendar_day_headers") === "true";
    }
    return false;
  });

  useEffect(() => {
    const handleViewPreferenceChange = () => {
      const stored = localStorage.getItem("default_calendar_details_view") as "sidebar" | "dialog" | null;
      if (stored) {
        setCalendarDetailsView(stored);
      }
    };
    const handleHeadersPreferenceChange = () => {
      const stored = localStorage.getItem("hide_calendar_day_headers") === "true";
      setHideCalendarDayHeaders(stored);
    };
    window.addEventListener("calendar_details_view_changed", handleViewPreferenceChange);
    window.addEventListener("calendar_day_headers_preference_changed", handleHeadersPreferenceChange);
    return () => {
      window.removeEventListener("calendar_details_view_changed", handleViewPreferenceChange);
      window.removeEventListener("calendar_day_headers_preference_changed", handleHeadersPreferenceChange);
    };
  }, []);

  const [selectedTaskId, setSelectedTaskId] = useState<string>("");
  const [selectedTaskOrgId, setSelectedTaskOrgId] = useState<string>("");
  const [selectedTaskSpaceId, setSelectedTaskSpaceId] = useState<string>("");
  const [dialogPosition, setDialogPosition] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createInitialValues, setCreateInitialValues] = useState<
    Partial<TaskDTO> | undefined
  >(undefined);
  const [currentViewType, setCurrentViewType] =
    useState<CalendarView>(() => {
      const stored = localStorage.getItem(STORAGE_CALENDAR_VIEW);
      if (stored === "timeGridDay" || stored === "timeGridWeek" || stored === "dayGridMonth" || stored === "listWeek") {
        return stored;
      }
      return "dayGridMonth";
    });
  const [currentViewDate, setCurrentViewDate] = useState<Date>(() => {
    const stored = localStorage.getItem(STORAGE_CALENDAR_DATE);
    if (stored) {
      const parsed = new Date(stored);
      if (!isNaN(parsed.getTime())) return parsed;
    }
    return new Date();
  });
  const [events, setEvents] = useState<EventInput[]>([]);
  const [morePopover, setMorePopover] = useState<{
    date: Date;
    events: { id: string; title: string; status: string; priority: string; type: string; taskId: string; orgId: string; spaceId: string }[];
    position: { x: number; y: number };
  } | null>(null);
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
            orgId: t.org_id ?? activeOrgId,
            spaceId: t.space_id ?? activeSpaceId,
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
    // Use the persisted date from state (restored from localStorage)
    return currentViewDate;
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    calendarApi.changeView(view);
  };

  return (
    <>
      <div className="h-full min-h-0 flex flex-col">
        <div className="px-3 pt-3 pb-2 border-b border-border/60 shrink-0">
          <div className="flex items-center justify-between gap-2 min-h-[32px]">

            {/* Left: open-sidebar button + Day/Week/Month pill toggle */}
            <div className="flex items-center gap-0.5">
              {onOpenSidebar && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="size-7 p-0 rounded-md shrink-0 mr-0.5"
                  onClick={onOpenSidebar}
                  title="Open task list"
                >
                  <PanelRightOpen className="size-3.5 text-muted-foreground" />
                </Button>
              )}

              <div className="flex bg-muted/40 rounded-lg p-0.5 gap-0.5">
                <button
                  type="button"
                  onClick={() => setView("timeGridDay")}
                  className={cn(
                    "px-3 py-1 text-xs font-medium rounded-md transition-all",
                    currentViewType === "timeGridDay"
                      ? "bg-background shadow-sm text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Day
                </button>
                <button
                  type="button"
                  onClick={() => setView("timeGridWeek")}
                  className={cn(
                    "px-3 py-1 text-xs font-medium rounded-md transition-all",
                    currentViewType === "timeGridWeek"
                      ? "bg-background shadow-sm text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Week
                </button>
                <button
                  type="button"
                  onClick={() => setView("dayGridMonth")}
                  className={cn(
                    "px-3 py-1 text-xs font-medium rounded-md transition-all",
                    currentViewType === "dayGridMonth"
                      ? "bg-background shadow-sm text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Month
                </button>
              </div>
            </div>

            {/* Right: prev / date title / next + Today */}
            <div className="flex items-center gap-0.5 shrink-0">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="size-7 p-0 rounded-md"
                onClick={goPrev}
              >
                <ChevronLeft className="size-3.5 text-muted-foreground" />
              </Button>

              <QuickNavPopover
                currentViewDate={currentViewDate}
                calendarRef={calendarRef}
              >
                <button
                  type="button"
                  className="px-2 py-1 text-xs font-semibold cursor-pointer transition-colors duration-200 select-none rounded-md hover:bg-muted/80 active:bg-muted/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring whitespace-nowrap"
                >
                  {headerTitle}
                </button>
              </QuickNavPopover>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="size-7 p-0 rounded-md"
                onClick={goNext}
              >
                <ChevronRight className="size-3.5 text-muted-foreground" />
              </Button>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2.5 text-xs rounded-md ml-1"
                onClick={goToday}
              >
                Today
              </Button>
            </div>

          </div>
        </div>

        <div className="flex-1 min-h-0 flex flex-row relative overflow-hidden">
          {/* Left: Main calendar */}
          <div className="flex-1 min-w-0 h-full flex flex-col">
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
                initialView={currentViewType}
                initialDate={initialDate}
                height="100%"
                nowIndicator
                editable
                selectable
                droppable
                weekends
                navLinks={true}
                dayHeaders={!hideCalendarDayHeaders}
                slotLabelFormat={{
                  hour: "numeric",
                  minute: "2-digit",
                  omitZeroMinute: true,
                  hour12: true,
                }}
                dayHeaderContent={(arg) => {
                  const dayName = format(arg.date, "E");
                  const dayNumber = format(arg.date, "d");
                  const isToday = arg.isToday;

                  if (currentViewType === "dayGridMonth") {
                    return (
                      <span className="text-[11px] font-semibold text-muted-foreground tracking-wider uppercase">
                        {dayName}
                      </span>
                    );
                  }

                  return (
                    <div className="flex items-center justify-center gap-1.5 py-0.5 select-none font-medium">
                      <span className="text-xs text-muted-foreground font-semibold">
                        {dayName}
                      </span>
                      {isToday ? (
                        <span className="size-6 rounded-full bg-[#6366F1] text-white flex items-center justify-center text-[10px] font-bold shadow-sm shrink-0">
                          {dayNumber}
                        </span>
                      ) : (
                        <span className="text-xs font-bold text-foreground">
                          {dayNumber}
                        </span>
                      )}
                    </div>
                  );
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
                    dayMaxEvents: 2,
                  },
                  timeGridDay: {
                    dayHeaderFormat: {
                      weekday: "short",
                      day: "numeric",
                      omitCommas: true,
                    },
                    dayMaxEvents: 2,
                  },
                }}
                scrollTime={scrollTime}
                scrollTimeReset={false}
                headerToolbar={false}
                dayMaxEvents={2}
                moreLinkContent={(args) => `${args.num} more`}
                moreLinkClick={(info) => {
                  // Prevent FullCalendar's built-in popover — use our own portalled one
                  const rect = (info.jsEvent.target as HTMLElement).getBoundingClientRect();
                  const dayEvents = info.allSegs.map((seg) => ({
                    id: seg.event.id,
                    title: seg.event.title,
                    status: seg.event.extendedProps.taskStatus as string || "",
                    priority: seg.event.extendedProps.taskPriority as string || "",
                    type: seg.event.extendedProps.taskType as string || "",
                    taskId: seg.event.extendedProps.taskId as string || seg.event.id,
                    orgId: (seg.event.extendedProps.orgId as string) || activeOrgId || "",
                    spaceId: (seg.event.extendedProps.spaceId as string) || activeSpaceId || "",
                  }));

                  // Position: align to the "more" link, ensure it stays within viewport
                  const popoverWidth = 280;
                  const popoverMaxHeight = 300;
                  let x = rect.left;
                  let y = rect.bottom + 6;

                  // Keep within horizontal bounds
                  if (x + popoverWidth > window.innerWidth - 16) {
                    x = window.innerWidth - popoverWidth - 16;
                  }
                  // If it would clip at the bottom, open upward
                  if (y + popoverMaxHeight > window.innerHeight - 16) {
                    y = rect.top - popoverMaxHeight - 6;
                    if (y < 16) y = 16;
                  }

                  setMorePopover({
                    date: info.date,
                    events: dayEvents,
                    position: { x, y },
                  });
                  return "none"; // suppress FullCalendar's built-in popover
                }}
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
                    setSelectedTaskOrgId(arg.event.extendedProps.orgId || activeOrgId);
                    setSelectedTaskSpaceId(arg.event.extendedProps.spaceId || activeSpaceId);
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
                  localStorage.setItem(STORAGE_CALENDAR_VIEW, view);
                  localStorage.setItem(STORAGE_CALENDAR_DATE, dateInfo.view.currentStart.toISOString());
                  if (onViewChange) onViewChange(view);
                  if (onDateChange) onDateChange(dateInfo.view.currentStart);
                }}
                eventReceive={handleEventReceive}
                eventResize={handleEventResize}
                eventDrop={handleEventDrop}
              />
            </div>
          </div>

          {/* Right column: Sidebar panel */}
          {!isMobile && calendarDetailsView === "sidebar" && !!selectedTaskId && (
            <CalendarSidebar
              taskId={selectedTaskId}
              orgId={selectedTaskOrgId}
              spaceId={selectedTaskSpaceId}
              onClose={() => {
                setSelectedTaskId("");
                setSelectedTaskOrgId("");
                setSelectedTaskSpaceId("");
                setDialogPosition(null);
              }}
              tasks={tasks}
              blocks={blocks}
              onUnschedule={handleTaskUnschedule}
              onStatusChange={handleStatusChange}
            />
          )}
        </div>
      </div>

      {(isMobile || calendarDetailsView === "dialog") && (
        <TaskPreviewDialog
          taskId={selectedTaskId}
          orgId={selectedTaskOrgId}
          spaceId={selectedTaskSpaceId}
          open={!!selectedTaskId}
          onOpenChange={(open) => {
            if (!open) {
              setSelectedTaskId("");
              setSelectedTaskOrgId("");
              setSelectedTaskSpaceId("");
              setDialogPosition(null);
            }
          }}
          onUnschedule={handleTaskUnschedule}
          onStatusChange={handleStatusChange}
          position={dialogPosition}
        />
      )}

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

      {/* Custom "more tasks" popover — portalled to body to avoid overflow clipping */}
      {morePopover &&
        createPortal(
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 z-9999"
              onClick={() => setMorePopover(null)}
            />
            {/* Popover */}
            <div
              className="fixed z-10000 w-[280px] bg-popover border border-border rounded-2xl shadow-lg backdrop-blur-xl flex flex-col"
              style={{
                left: morePopover.position.x,
                top: morePopover.position.y,
                maxHeight: "min(300px, calc(100vh - 32px))",
              }}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-border shrink-0">
                <span className="text-sm font-semibold text-foreground">
                  {format(morePopover.date, "MMMM d, yyyy")}
                </span>
                <button
                  onClick={() => setMorePopover(null)}
                  className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="size-3.5" />
                </button>
              </div>
              {/* Body */}
              <div
                className="flex-1 overflow-y-auto overscroll-contain p-2.5 flex flex-col gap-1.5"
                style={{ maxHeight: "240px" }}
              >
                {morePopover.events.map((evt) => {
                  const isDone = evt.status === "done" || evt.status === "completed";
                  const theme = getThemeForTask(evt.type, evt.priority, evt.status);
                  return (
                    <button
                      key={evt.id}
                      onClick={() => {
                        setMorePopover(null);
                        setSelectedTaskId(evt.taskId);
                        setSelectedTaskOrgId(evt.orgId || activeOrgId || "");
                        setSelectedTaskSpaceId(evt.spaceId || activeSpaceId || "");
                        setDialogPosition(morePopover.position);
                      }}
                      className={cn(
                        "w-full text-left rounded-[10px] transition-colors border",
                        isDone && "line-through opacity-[0.68]"
                      )}
                      style={{
                        minHeight: 28,
                        padding: "4px 8px",
                        fontSize: "0.75rem",
                        fontWeight: 500,
                        background: theme.background,
                        borderColor: theme.border,
                        color: theme.text,
                      }}
                    >
                      <div className="flex items-center gap-1.5">
                        {evt.type === "event" ? (
                          <CalendarClock className="size-3 shrink-0 opacity-70" />
                        ) : (
                          <StatusIcon
                            status={evt.status as AnyStatus}
                            type="task"
                            className="size-3 shrink-0 opacity-70"
                          />
                        )}
                        <span className="truncate">{evt.title || "Untitled"}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </>,
          document.body
        )}
    </>
  );
}
