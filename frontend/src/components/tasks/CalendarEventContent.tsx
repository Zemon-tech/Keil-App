import type { EventContentArg } from "@fullcalendar/core";
import {
  Bell,
  Calendar,
  CalendarCheck,
  CalendarClock,
  CheckSquare,
  Flag,
  Focus,
  Square,
  Timer,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getThemeForTask } from "@/lib/calendarTheme";
import type { CalendarBlockType } from "@/types/task";

export const typeMeta: Record<
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

export function getChipStyles(type?: string, priority?: string, status?: string) {
  return getThemeForTask(type, priority, status);
}

export function renderEventContent(arg: EventContentArg) {
  const type = arg.event.extendedProps.type as CalendarBlockType;
  const isScheduledTask = arg.event.extendedProps.isScheduledTask;
  const isMonthView = arg.view.type === "dayGridMonth";
  const isBacklog = arg.event.extendedProps.taskStatus === "backlog";

  const BacklogDot = () => (
    <div
      className="absolute top-0 right-0 w-2.5 h-2.5 bg-destructive rounded-full z-50 pointer-events-none"
      style={{ transform: "translate(50%, -50%)" }}
    />
  );

  if (isMonthView) {
    const taskType = arg.event.extendedProps.taskType;
    const isDone =
      arg.event.extendedProps.taskStatus === "done" ||
      arg.event.extendedProps.taskStatus === "completed";
    return (
      <div className="relative w-full h-full overflow-visible">
        {isBacklog && <BacklogDot />}
        <div
          className="w-full truncate text-[12px] font-medium px-1.5 py-0.5 flex items-center gap-1.5"
          style={{ color: arg.textColor || "inherit" }}
        >
          {isScheduledTask &&
            (taskType === "event" ? (
              isDone ? (
                <CalendarCheck className="h-3 w-3 shrink-0 opacity-70" />
              ) : (
                <Calendar className="h-3 w-3 shrink-0 opacity-70" />
              )
            ) : isDone ? (
              <CheckSquare className="h-3 w-3 shrink-0 opacity-70" />
            ) : (
              <Square className="h-3 w-3 shrink-0 opacity-70" />
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
      <div className="relative h-full w-full overflow-visible">
        {isBacklog && <BacklogDot />}
        <div
          className="h-full w-full p-2 overflow-hidden flex items-center gap-1.5"
          style={{ color: arg.textColor || "inherit" }}
        >
          {taskType === "event" ? (
            isDone ? (
              <CalendarCheck className="h-3.5 w-3.5 shrink-0 opacity-70" />
            ) : (
              <Calendar className="h-3.5 w-3.5 shrink-0 opacity-70" />
            )
          ) : isDone ? (
            <CheckSquare className="h-3.5 w-3.5 shrink-0 opacity-70" />
          ) : (
            <Square className="h-3.5 w-3.5 shrink-0 opacity-70" />
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
      <div className="relative h-full w-full overflow-visible">
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
      <div className="relative h-full w-full overflow-visible">
        {isBacklog && <BacklogDot />}
        <div className="h-full w-full px-2 py-1.5 opacity-40 overflow-hidden">
          <div className="flex items-center gap-2">
            <Icon className="h-3 w-3" />
            <span className="text-[10px] font-bold uppercase tracking-wider truncate">
              {arg.event.title}
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full overflow-visible">
      {isBacklog && <BacklogDot />}
      <div
        className={cn(
          "h-full w-full p-2 border-l-4 overflow-hidden",
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
          <Icon className="h-3.5 w-3.5 opacity-40" />
        </div>
      </div>
    </div>
  );
}
