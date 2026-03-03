import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  Calendar,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  FileText,
  Flag,
  Link2,
  Paperclip,
  ShieldAlert,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardAction } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import type { Task, TaskPriority, TaskStatus } from "@/components/TasksPage";

type Props = {
  task: Task | null;
};

function statusTone(status: TaskStatus): { badge: "default" | "secondary" | "destructive" | "outline"; icon: any } {
  switch (status) {
    case "Done":
      return { badge: "secondary", icon: CheckCircle2 };
    case "Blocked":
      return { badge: "destructive", icon: ShieldAlert };
    case "In Progress":
      return { badge: "default", icon: CircleDot };
    case "Backlog":
    default:
      return { badge: "outline", icon: ChevronRight };
  }
}

function priorityTone(priority: TaskPriority): { className: string } {
  switch (priority) {
    case "Critical":
      return { className: "bg-destructive/15 text-destructive border-destructive/25" };
    case "High":
      return { className: "bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/25" };
    case "Medium":
      return { className: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/25" };
    case "Low":
    default:
      return { className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/25" };
  }
}

export function TaskDetailPane({ task }: Props) {
  const [localSubtasks, setLocalSubtasks] = useState(() => task?.subtasks ?? []);

  useEffect(() => {
    setLocalSubtasks(task?.subtasks ?? []);
  }, [task?.id]);

  if (!task) {
    return (
      <div className="h-full bg-background">
        <div className="h-full p-6">
          <Empty className="h-full">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <FileText />
              </EmptyMedia>
              <EmptyTitle>Select a task</EmptyTitle>
              <EmptyDescription>
                Choose a task on the left to see objective, criteria, subtasks, dependencies, and context.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button variant="outline" className="rounded-xl">Create your first task</Button>
            </EmptyContent>
          </Empty>
        </div>
      </div>
    );
  }

  const { badge, icon: StatusIcon } = statusTone(task.status);
  const priority = priorityTone(task.priority);

  const completedCount = localSubtasks.filter((s) => s.done).length;

  return (
    <div className="h-full min-h-0 flex flex-col bg-background">
      <div className="p-4 border-b border-border/60 bg-gradient-to-b from-card/60 to-background">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="font-bold uppercase tracking-[0.22em]">{task.projectTitle}</span>
              <ChevronRight className="h-4 w-4 opacity-60" />
              <span className="truncate">{task.title}</span>
            </div>

            <div className="mt-2 flex items-start gap-3">
              <div className="mt-0.5 size-10 rounded-2xl border bg-muted/40 flex items-center justify-center">
                <StatusIcon className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="min-w-0">
                <h2 className="text-xl font-semibold tracking-tight leading-tight truncate">{task.title}</h2>
                {task.description ? (
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{task.description}</p>
                ) : null}
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Badge variant={badge} className="rounded-full px-2.5 py-1 text-[11px]">
                {task.status}
              </Badge>
              <Badge variant="outline" className={cn("rounded-full px-2.5 py-1 text-[11px] border", priority.className)}>
                <Flag className="h-3 w-3" />
                {task.priority}
              </Badge>
              <Badge variant="outline" className="rounded-full px-2.5 py-1 text-[11px]">
                <User className="h-3 w-3" />
                {task.owner}
              </Badge>
              <Badge variant="outline" className="rounded-full px-2.5 py-1 text-[11px]">
                <Calendar className="h-3 w-3" />
                {new Date(task.dueDateISO).toLocaleDateString(undefined, {
                  weekday: "short",
                  month: "short",
                  day: "2-digit",
                })}
              </Badge>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="rounded-lg h-8 px-3">
              <ArrowUpRight className="h-3.5 w-3.5 mr-1.5" />
              Open
            </Button>
            <Button size="sm" className="rounded-lg h-8 px-3">Mark done</Button>
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1 min-h-0">
        <div className="p-2 space-y-3">
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-3">
            <Card className="xl:col-span-7 rounded-xl border-border/60">
              <CardHeader className="pb-0">
                <CardTitle className="text-sm font-semibold">Objective</CardTitle>
                <CardDescription>Why does this task exist?</CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="text-sm leading-relaxed text-foreground/90">{task.objective}</div>
              </CardContent>
            </Card>

            <Card className="xl:col-span-5 rounded-xl border-border/60">
              <CardHeader className="pb-0">
                <CardTitle className="text-sm font-semibold">Success criteria</CardTitle>
                <CardDescription>What does “done” look like?</CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="text-sm leading-relaxed text-foreground/90">{task.successCriteria}</div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-12 gap-3">
            <Card className="xl:col-span-7 rounded-xl border-border/60">
              <CardHeader className="pb-0">
                <CardTitle className="text-sm font-semibold">Subtasks</CardTitle>
                <CardDescription>Small enough to finish in one sitting.</CardDescription>
                <CardAction>
                  <Badge variant="outline" className="rounded-full text-[10px] px-2 py-1">
                    {completedCount}/{localSubtasks.length} complete
                  </Badge>
                </CardAction>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-1.5">
                  {localSubtasks.map((s) => (
                    <label
                      key={s.id}
                      className="flex items-start gap-3 rounded-lg border border-border/60 bg-card/40 hover:bg-muted/40 transition-colors px-2.5 py-2"
                    >
                      <Checkbox
                        checked={s.done}
                        onCheckedChange={(v) => {
                          const checked = Boolean(v);
                          setLocalSubtasks((prev) =>
                            prev.map((x) => (x.id === s.id ? { ...x, done: checked } : x))
                          );
                        }}
                        className="mt-0.5"
                      />
                      <div className="min-w-0 flex-1">
                        <div
                          className={cn(
                            "text-sm font-medium leading-tight",
                            s.done && "line-through text-muted-foreground"
                          )}
                        >
                          {s.title}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>

                <div className="mt-2 flex items-center gap-2">
                  <Button variant="outline" size="sm" className="rounded-lg h-8 px-3">Add subtask</Button>
                  <Button variant="ghost" size="sm" className="rounded-lg h-8 px-2 text-muted-foreground">Reorder</Button>
                </div>
              </CardContent>
            </Card>

            <Card className="xl:col-span-5 rounded-xl border-border/60">
              <CardHeader className="pb-0">
                <CardTitle className="text-sm font-semibold">Dependencies</CardTitle>
                <CardDescription>What must be done first?</CardDescription>
              </CardHeader>
              <CardContent className="pt-3">
                <div className="space-y-1.5">
                  {task.dependencies.map((d) => {
                    const tone = statusTone(d.status);
                    const Icon = tone.icon;
                    return (
                      <div
                        key={d.id}
                        className="flex items-start justify-between gap-3 rounded-lg border border-border/60 bg-card/40 px-2.5 py-2"
                      >
                        <div className="flex items-start gap-2 min-w-0">
                          <div className="mt-0.5 size-7 rounded-lg border bg-muted/40 flex items-center justify-center">
                            <Icon className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-medium truncate">{d.title}</div>
                            <div className="text-[10px] uppercase tracking-[0.22em] font-bold text-muted-foreground mt-0.5">
                              {d.id}
                            </div>
                          </div>
                        </div>
                        <Badge variant={tone.badge} className="rounded-full text-[10px] px-2 py-1">
                          {d.status}
                        </Badge>
                      </div>
                    );
                  })}

                  {task.dependencies.length === 0 ? (
                    <div className="text-sm text-muted-foreground">No dependencies.</div>
                  ) : null}
                </div>

                <Separator className="my-3" />

                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs font-bold uppercase tracking-[0.22em] text-muted-foreground">Calendar</div>
                  <Button variant="outline" size="sm" className="rounded-lg h-8 px-3">
                    <Calendar className="h-3.5 w-3.5 mr-1.5" />
                    Schedule
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="rounded-xl border-border/60">
            <CardHeader className="pb-0">
              <CardTitle className="text-sm font-semibold">Context panel</CardTitle>
              <CardDescription>Everything needed to do the work.</CardDescription>
            </CardHeader>
            <CardContent className="pt-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-1.5">
                {task.context.map((c, idx) => {
                  const meta =
                    c.kind === "link"
                      ? { icon: Link2, label: "Link" }
                      : c.kind === "file"
                        ? { icon: Paperclip, label: "File" }
                        : { icon: FileText, label: "Doc" };
                  const Icon = meta.icon;
                  return (
                    <a
                      key={`${c.title}-${idx}`}
                      href={c.href ?? "#"}
                      className="group rounded-xl border border-border/60 bg-card/40 hover:bg-muted/40 transition-colors p-2.5"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-2 min-w-0">
                          <div className="size-9 rounded-xl border bg-muted/40 flex items-center justify-center">
                            <Icon className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-semibold truncate">{c.title}</div>
                            <div className="text-[10px] uppercase tracking-[0.22em] font-bold text-muted-foreground mt-0.5">
                              {meta.label}
                            </div>
                          </div>
                        </div>
                        <ArrowUpRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </a>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-xl border-border/60">
            <CardHeader className="pb-0">
              <CardTitle className="text-sm font-semibold">Comments & history</CardTitle>
              <CardDescription>Discussion, decisions, and trail.</CardDescription>
            </CardHeader>
            <CardContent className="pt-3">
              <Tabs defaultValue="comments" className="w-full">
                <TabsList className="rounded-xl">
                  <TabsTrigger value="comments">Comments</TabsTrigger>
                  <TabsTrigger value="history">History</TabsTrigger>
                </TabsList>

                <TabsContent value="comments" className="pt-3 space-y-2">
                  <div className="space-y-2">
                    {task.comments.length === 0 ? (
                      <div className="text-sm text-muted-foreground">No comments yet.</div>
                    ) : (
                      task.comments.map((c) => (
                        <div
                          key={c.id}
                          className="rounded-xl border border-border/60 bg-card/40 p-2.5"
                        >
                          <div className="flex items-baseline justify-between gap-3">
                            <div className="text-sm font-semibold truncate">{c.author}</div>
                            <div className="text-xs text-muted-foreground">{c.timestamp}</div>
                          </div>
                          <div className="text-sm text-foreground/90 mt-2 leading-relaxed">{c.body}</div>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <Button variant="outline" size="sm" className="rounded-lg h-8 px-3">Add comment</Button>
                    <Button variant="ghost" size="sm" className="rounded-lg h-8 px-2 text-muted-foreground">Mention</Button>
                  </div>
                </TabsContent>

                <TabsContent value="history" className="pt-3 space-y-1.5">
                  <div className="space-y-1.5">
                    {task.activity.map((a) => (
                      <div
                        key={a.id}
                        className="flex items-start justify-between gap-4 rounded-xl border border-border/60 bg-card/40 px-3 py-2"
                      >
                        <div className="text-sm text-foreground/90">{a.label}</div>
                        <div className="text-xs text-muted-foreground whitespace-nowrap">{a.timestamp}</div>
                      </div>
                    ))}
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </ScrollArea>
    </div>
  );
}
