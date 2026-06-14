import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { format, subDays, startOfDay } from "date-fns";
import {
  AlertCircle,
  Calendar,
  Clock,
  ExternalLink,
  FileText,
  Flag,
  Loader2,
  MapPin,
  Target,
  Users,
} from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getOptimizedImageUrl } from "@/lib/image-optimizer";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";

import type { PublicTaskDTO } from "@/hooks/api/usePublicTask";
import type { AnyStatus } from "@/types/task";
import { StatusIcon } from "./task-detail-shared";

// ─── Shared styling maps (mirrors task-detail-shared.tsx values) ──────────────

const STATUS_COLOR: Record<string, string> = {
  done: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  "in-progress": "bg-blue-500/20 text-blue-400 border-blue-500/30",
  "in-review": "bg-violet-500/20 text-violet-400 border-violet-500/30",
  backlog: "bg-red-500/20 text-red-400 border-red-500/30",
  todo: "bg-violet-500/20 text-violet-400 border-violet-500/30",
  confirmed: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  tentative: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  cancelled: "bg-red-500/20 text-red-400 border-red-500/30",
  completed: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
};

const STATUS_DOT: Record<string, string> = {
  done: "bg-emerald-500",
  "in-progress": "bg-blue-500",
  "in-review": "bg-violet-500",
  backlog: "bg-red-500",
  todo: "bg-violet-500",
  confirmed: "bg-blue-500",
  tentative: "bg-yellow-500",
  cancelled: "bg-red-500",
  completed: "bg-emerald-500",
};

const PRIORITY_CONFIG: Record<string, { color: string; dot: string; label: string }> = {
  urgent: { color: "text-red-400 border-red-500/20 bg-red-500/10", dot: "bg-red-400", label: "Urgent" },
  high: { color: "text-orange-400 border-orange-500/20 bg-orange-500/10", dot: "bg-orange-400", label: "High" },
  medium: { color: "text-yellow-400 border-yellow-500/20 bg-yellow-500/10", dot: "bg-yellow-400", label: "Medium" },
  low: { color: "text-zinc-400 border-zinc-600/30 bg-zinc-500/10", dot: "bg-zinc-500", label: "Low" },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateStr: string, isAllDay?: boolean): string {
  try {
    const d = new Date(dateStr);
    // All-day due_date is stored as exclusive end (next day midnight).
    // Subtract 1 day so the displayed date reflects the actual last day.
    const displayDate = isAllDay ? subDays(startOfDay(d), 1) : d;
    return format(displayDate, isAllDay ? "d MMM yyyy" : "d MMM yyyy, h:mm a");
  } catch {
    return dateStr;
  }
}

function parseMarkdownBullets(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return raw
    .split("\n")
    .map((line) => line.replace(/^[-*•]\s*/, "").trim())
    .filter(Boolean);
}

function isLikelyUrl(str: string): boolean {
  return /^https?:\/\//i.test(str) || /^www\./i.test(str);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <span className="block text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
      {children}
    </span>
  );
}

function BulletList({ items, title }: { items: string[]; title: string }) {
  if (items.length === 0) return null;
  return (
    <div>
      <SectionLabel>{title}</SectionLabel>
      <ul className="space-y-1.5">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-foreground/80">
            <span className="mt-1.5 size-1.5 rounded-full bg-muted-foreground/50 shrink-0" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── Loading screen ───────────────────────────────────────────────────────────

function PublicLoadingScreen() {
  return (
    <div className="flex h-dvh w-full items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    </div>
  );
}

// ─── Not found screen ─────────────────────────────────────────────────────────

export function PublicNotFoundScreen() {
  return (
    <div className="flex h-dvh w-full flex-col items-center justify-center gap-5 bg-background text-foreground px-6 text-center">
      <div className="flex size-16 items-center justify-center rounded-2xl bg-muted">
        <AlertCircle className="size-8 text-muted-foreground/60" />
      </div>
      <div className="space-y-1.5">
        <h1 className="text-xl font-bold tracking-tight">This task doesn't exist</h1>
        <p className="text-sm text-muted-foreground max-w-xs">
          It may have been deleted or the link is incorrect.
        </p>
      </div>
      <Link
        to="/login"
        className="mt-1 inline-flex items-center gap-1.5 text-sm text-primary hover:underline underline-offset-4"
      >
        Open KeilHQ
        <ExternalLink className="size-3.5" />
      </Link>
      {/* Branding */}
      <p className="absolute bottom-6 text-[11px] text-muted-foreground/40">
        Powered by{" "}
        <Link to="/login" className="hover:text-muted-foreground transition-colors">
          KeilHQ
        </Link>
      </p>
    </div>
  );
}

// ─── Main Public Task View ────────────────────────────────────────────────────

interface PublicTaskViewProps {
  /** Set while data is being fetched */
  isLoading?: boolean;
  /** True when the task ID is not found or an error occurred */
  isNotFound?: boolean;
  /** The fetched task (null/undefined while loading) */
  task?: PublicTaskDTO | null;
}

export function PublicTaskView({ isLoading, isNotFound, task }: PublicTaskViewProps) {
  if (isLoading) return <PublicLoadingScreen />;
  if (isNotFound || !task) return <PublicNotFoundScreen />;

  // Infer event type from explicit field or event_type presence (mirrors normalizeTaskDTO)
  const isEvent = task.type === "event" || (task.type !== "task" && !!task.event_type);
  const statusCss = STATUS_COLOR[task.status] ?? "bg-zinc-500/10 text-zinc-400 border-zinc-500/20";
  const statusDot = STATUS_DOT[task.status] ?? "bg-zinc-500";
  const priorityCfg = PRIORITY_CONFIG[task.priority] ?? PRIORITY_CONFIG.medium;

  const objectivePoints = parseMarkdownBullets(task.objective);
  const criteriaPoints = parseMarkdownBullets(task.success_criteria);

  const completedSubtasks = (task.subtasks ?? []).filter((s) => s.status === "done").length;
  const totalSubtasks = (task.subtasks ?? []).length;
  const progressPercent = totalSubtasks > 0 ? Math.round((completedSubtasks / totalSubtasks) * 100) : 0;

  return (
    <div className="min-h-dvh w-full bg-background text-foreground">
      {/* ── Top gradient accent ─────────────────────────────────────────────── */}
      <div className="h-1 w-full bg-gradient-to-r from-primary/60 via-primary to-primary/60" />

      {/* ── Main content area ───────────────────────────────────────────────── */}
      <div className="max-w-[820px] mx-auto w-full px-5 sm:px-8 pt-10 pb-24">

        {/* Branding strip */}
        <div className="flex items-center gap-1.5 mb-8 text-xs text-muted-foreground/50">
          <FileText className="size-3.5" />
          <span>Shared via</span>
          <Link
            to="/login"
            className="font-semibold text-muted-foreground/70 hover:text-foreground transition-colors"
          >
            KeilHQ
          </Link>
        </div>

        {/* ── Badges row ────────────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          {/* Type badge */}
          <Badge variant="outline" className="text-[11px] px-2.5 py-0.5 capitalize font-medium text-muted-foreground">
            {isEvent ? "Event" : "Task"}
          </Badge>

          {/* Status badge */}
          <Badge
            variant="outline"
            className={`text-[11px] px-2.5 py-0.5 capitalize font-medium border ${statusCss}`}
          >
            <span className={`inline-block size-1.5 rounded-full mr-1.5 ${statusDot}`} />
            {task.status.replace("-", " ")}
          </Badge>

          {/* Priority badge */}
          <Badge
            variant="outline"
            className={`text-[11px] px-2.5 py-0.5 capitalize font-medium border ${priorityCfg.color}`}
          >
            <span className={`inline-block size-1.5 rounded-full mr-1.5 ${priorityCfg.dot}`} />
            {priorityCfg.label} Priority
          </Badge>

          {/* Event type badge */}
          {isEvent && task.event_type && (
            <Badge variant="secondary" className="text-[11px] px-2.5 py-0.5 capitalize">
              {task.event_type}
            </Badge>
          )}
        </div>

        {/* ── Title ─────────────────────────────────────────────────────────── */}
        <h1 className="text-[32px] sm:text-[38px] leading-[1.1] font-bold tracking-tight text-foreground mb-6">
          {task.title}
        </h1>

        {/* ── Dates row ─────────────────────────────────────────────────────── */}
        {(task.start_date || task.due_date) && (
          <div className="flex flex-wrap items-center gap-4 mb-8 text-sm text-muted-foreground">
            {task.start_date && (
              <div className="flex items-center gap-1.5">
                <Clock className="size-3.5 shrink-0" />
                <span>
                  {isEvent ? "Starts" : "Start"}:{" "}
                  <span className="text-foreground font-medium">
                    {formatDate(task.start_date, task.is_all_day)}
                  </span>
                </span>
              </div>
            )}
            {task.due_date && (
              <div className="flex items-center gap-1.5">
                <Calendar className="size-3.5 shrink-0" />
                <span>
                  {isEvent ? "Ends" : "Due"}:{" "}
                  <span className="text-foreground font-medium">
                    {formatDate(task.due_date, task.is_all_day)}
                  </span>
                </span>
              </div>
            )}
          </div>
        )}

        {/* ── Main body ─────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-8">

          {/* LEFT column */}
          <div className="space-y-8 min-w-0">

            {/* Description */}
            {task.description && (
              <div>
                <SectionLabel>Description</SectionLabel>
                <p className="text-sm text-foreground/80 whitespace-pre-wrap leading-relaxed">
                  {task.description}
                </p>
              </div>
            )}

            {/* Objective / Agenda */}
            {objectivePoints.length > 0 && (
              <div className="rounded-lg border border-border/40 bg-card p-4">
                <BulletList
                  items={objectivePoints}
                  title={isEvent ? "Agenda / Notes" : "Objective"}
                />
              </div>
            )}

            {/* Success Criteria — tasks only */}
            {!isEvent && criteriaPoints.length > 0 && (
              <div className="rounded-lg border border-border/40 bg-card p-4">
                <BulletList items={criteriaPoints} title="Success Criteria" />
              </div>
            )}

            {/* Location / Meeting link — events only */}
            {isEvent && task.location && (
              <div>
                <SectionLabel>
                  <span className="flex items-center gap-1.5">
                    <MapPin className="size-3" />
                    Location / Link
                  </span>
                </SectionLabel>
                {isLikelyUrl(task.location) ? (
                  <a
                    href={task.location.startsWith("http") ? task.location : `https://${task.location}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline underline-offset-4 break-all"
                  >
                    {task.location}
                    <ExternalLink className="size-3.5 shrink-0" />
                  </a>
                ) : (
                  <p className="text-sm text-foreground/80">{task.location}</p>
                )}
              </div>
            )}

            {/* Subtasks — top-level tasks only */}
            {!isEvent && totalSubtasks > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <SectionLabel>Subtasks</SectionLabel>
                  <span className="text-[11px] font-mono text-muted-foreground">
                    {completedSubtasks}/{totalSubtasks} complete
                  </span>
                </div>
                <Progress value={progressPercent} className="h-1 mb-3" />
                <div className="space-y-px">
                  {(task.subtasks ?? []).map((sub) => {
                    const isDone = sub.status === "done";
                    return (
                      <div
                        key={sub.id}
                        className="flex items-center gap-2.5 rounded-md px-2.5 py-2"
                      >
                        <StatusIcon
                          status={sub.status as AnyStatus}
                          type="task"
                          className="size-4 shrink-0"
                        />
                        <span
                          className={`flex-1 text-sm font-medium truncate ${
                            isDone ? "line-through text-muted-foreground" : ""
                          }`}
                        >
                          {sub.title}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

          </div>

          {/* RIGHT sidebar */}
          <div className="space-y-5">

            {/* Assignees / Attendees */}
            {(task.assignees ?? []).length > 0 && (
              <div>
                <SectionLabel>
                  <span className="flex items-center gap-1.5">
                    <Users className="size-3" />
                    {isEvent ? "Attendees" : "Assignees"}
                  </span>
                </SectionLabel>
                <div className="space-y-2">
                  {(task.assignees ?? []).map((a) => {
                    const displayName = a.name ?? "Unknown";
                    return (
                      <div key={a.id} className="flex items-center gap-2.5">
                        <Avatar className="size-7 shrink-0">
                          <AvatarImage src={getOptimizedImageUrl(a.avatar_url || a.avatarUrl, { width: 56, height: 56 })} alt={displayName} />
                          <AvatarFallback className="text-[11px] font-semibold bg-accent">
                            {displayName.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm text-foreground/80">{displayName}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {(task.assignees ?? []).length > 0 && <Separator />}

            {/* Dates detail card */}
            <div className="rounded-lg border border-border/40 bg-card p-4 space-y-2.5">
              <SectionLabel>
                {isEvent ? "Event Details" : "Task Details"}
              </SectionLabel>

              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">Status</span>
                  <span className={`font-medium capitalize px-2 py-0.5 rounded-full border text-[11px] ${statusCss}`}>
                    {task.status.replace("-", " ")}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">Priority</span>
                  <span className={`font-medium capitalize px-2 py-0.5 rounded-full border text-[11px] ${priorityCfg.color}`}>
                    <Flag className="size-2.5 inline mr-1" />
                    {priorityCfg.label}
                  </span>
                </div>

                {task.start_date && (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground">{isEvent ? "Start" : "Start"}</span>
                    <span className="font-medium text-right">
                      {formatDate(task.start_date, task.is_all_day)}
                    </span>
                  </div>
                )}

                {task.due_date && (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground">{isEvent ? "End" : "Due"}</span>
                    <span className="font-medium text-right">
                      {formatDate(task.due_date, task.is_all_day)}
                    </span>
                  </div>
                )}

                {isEvent && task.event_type && (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground">Type</span>
                    <span className="font-medium capitalize">{task.event_type}</span>
                  </div>
                )}

                {!isEvent && totalSubtasks > 0 && (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground">Subtasks</span>
                    <span className="font-medium font-mono">
                      {completedSubtasks}/{totalSubtasks}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* CTA — invite to open in app */}
            <div className="rounded-lg border border-border/50 bg-card/60 p-4 text-center space-y-2">
              <Target className="size-5 mx-auto text-muted-foreground/60" />
              <p className="text-xs text-muted-foreground leading-relaxed">
                Want to manage tasks like this?
              </p>
              <Link
                to="/login"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline underline-offset-4"
              >
                Open KeilHQ
                <ExternalLink className="size-3" />
              </Link>
            </div>

          </div>
        </div>
      </div>

      {/* ── Footer branding ─────────────────────────────────────────────────── */}
      <footer className="fixed bottom-0 inset-x-0 flex items-center justify-center pb-4 pointer-events-none">
        <p className="text-[11px] text-muted-foreground/30 pointer-events-auto">
          Powered by{" "}
          <Link to="/login" className="hover:text-muted-foreground/60 transition-colors underline-offset-2 hover:underline">
            KeilHQ
          </Link>
        </p>
      </footer>
    </div>
  );
}
