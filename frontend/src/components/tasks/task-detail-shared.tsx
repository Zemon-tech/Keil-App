import { FileText, Box, Github, Link2 } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import type { TaskPriority, TaskStatus } from "@/types/task";

// ─── Constants ────────────────────────────────────────────────────────────────

export const STATUS_OPTIONS: TaskStatus[] = ["backlog", "todo", "in-progress", "done"];

export const STATUS_COLOR: Record<TaskStatus, string> = {
  done: "bg-emerald-500",
  "in-progress": "bg-blue-500",
  backlog: "bg-zinc-500",
  todo: "bg-violet-500",
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
