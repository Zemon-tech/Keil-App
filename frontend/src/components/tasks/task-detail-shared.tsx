import { FileText, Box, Github, Link2, Circle, CircleDashed, CheckCircle2, XCircle, type LucideProps } from "lucide-react";
import { format, formatDistanceToNow, subDays, startOfDay } from "date-fns";
import type { TaskPriority, TaskStatus, EventStatus, AnyStatus } from "@/types/task";
import { cn } from "@/lib/utils";

// Custom half-filled circle for in-progress tasks to resemble Linear/Jira
export const HalfCircleIcon = (props: LucideProps) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <circle cx="12" cy="12" r="10" />
    <path d="M 12 2 A 10 10 0 0 1 12 22 Z" fill="currentColor" opacity="0.35" />
  </svg>
);

export function getStatusTextColor(status: AnyStatus): string {
  switch (status) {
    case "done":
    case "completed":
      return "text-green-500 dark:text-[#86EFAC]";
    case "in-progress":
    case "confirmed":
      return "text-blue-500";
    case "in-review":
    case "todo":
      return "text-violet-500 dark:text-violet-400";
    case "backlog":
    case "cancelled":
      return "text-red-500";
    case "tentative":
      return "text-yellow-500";
    default:
      return "text-zinc-500";
  }
}

export function StatusIcon({
  status,
  type = "task",
  className
}: {
  status: AnyStatus;
  type?: "task" | "event";
  className?: string;
}) {
  if (type === "event") {
    switch (status) {
      case "confirmed":
        return <Circle className={cn("text-blue-500 fill-blue-500/10", className)} />;
      case "tentative":
        return <CircleDashed className={cn("text-yellow-500", className)} />;
      case "cancelled":
        return <XCircle className={cn("text-red-500", className)} />;
      case "completed":
        return <CheckCircle2 className={cn("text-green-500 dark:text-[#86EFAC] fill-green-500/10", className)} />;
      default:
        return <Circle className={cn("text-zinc-500", className)} />;
    }
  }

  // Task Statuses: backlog, todo, in-progress, done
  switch (status) {
    case "backlog":
      return <CircleDashed className={cn("text-red-500 dark:text-red-400", className)} />;
    case "todo":
      return <Circle className={cn("text-violet-500 dark:text-violet-400", className)} />;
    case "in-progress":
      return <HalfCircleIcon className={cn("text-blue-500", className)} />;
    case "done":
    case "completed":
      return <CheckCircle2 className={cn("text-green-500 dark:text-[#86EFAC] fill-green-500/10", className)} />;
    default:
      return <Circle className={cn("text-zinc-500", className)} />;
  }
}


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
