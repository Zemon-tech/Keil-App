import { FileText, Box, Github, Link2 } from "lucide-react";
import { format, formatDistanceToNow, subDays, startOfDay } from "date-fns";
import type { TaskPriority, TaskStatus, EventStatus, AnyStatus } from "@/types/task";

// ─── Constants ────────────────────────────────────────────────────────────────

export const STATUS_OPTIONS: TaskStatus[] = ["backlog", "todo", "in-progress", "done"];
export const EVENT_STATUS_OPTIONS: EventStatus[] = ["confirmed", "tentative", "cancelled", "completed"];

export const STATUS_COLOR: Record<AnyStatus, string> = {
  done: "bg-[#86EFAC]",
  "in-progress": "bg-blue-500",
  "in-review": "bg-violet-500",
  backlog: "bg-red-500",
  todo: "bg-violet-500",
  confirmed: "bg-blue-500",
  tentative: "bg-yellow-500",
  cancelled: "bg-red-500",
  completed: "bg-[#86EFAC]"
};

export const PRIORITY_OPTIONS: TaskPriority[] = ["low", "medium", "high", "urgent"];

export const PRIORITY_CONFIG: Record<TaskPriority, { color: string; dot: string }> = {
  urgent: { color: "text-red-400 border-red-500/20", dot: "bg-red-400" },
  high: { color: "text-orange-400 border-orange-500/20", dot: "bg-orange-400" },
  medium: { color: "text-yellow-400 border-yellow-500/20", dot: "bg-yellow-400" },
  low: { color: "text-zinc-500 border-zinc-600/30", dot: "bg-zinc-500" },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

export const formatDate = (dateStr: string) => format(new Date(dateStr), "d MMM");

/**
 * Formats a due_date for display, accounting for all-day exclusive end storage.
 * All-day due_date is stored as the exclusive end (day after last included day)
 * for FullCalendar compatibility. Subtract 1 day to show the correct last day.
 */
export const formatDueDate = (dateStr: string, isAllDay?: boolean) => {
  const d = new Date(dateStr);
  const displayDate = isAllDay ? subDays(startOfDay(d), 1) : d;
  return format(displayDate, "d MMM");
};

export const formatRelTime = (dateStr: string) =>
  formatDistanceToNow(new Date(dateStr), { addSuffix: true });

// ─── ContextIcon ──────────────────────────────────────────────────────────────

export const ContextIcon = ({ type, className }: { type: string; className?: string }) => {
  const icons: Record<string, React.ReactNode> = {
    doc: <FileText className={className} />,
    figma: <Box className={className} />,
    github: <Github className={className} />,
    notion: <FileText className={className} />,
    link: <Link2 className={className} />,
  };
  return <>{icons[type] ?? <Link2 className={className} />}</>;
};
