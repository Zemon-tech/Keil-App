import { useMemo, useEffect, useRef } from "react";
import { Draggable } from "@fullcalendar/interaction";
import { Search, ListFilter, Plus, CircleDot, AlertTriangle, CheckCircle2, PauseCircle, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Task, TaskStatus } from "@/components/TasksPage";

type Props = {
  query: string;
  onQueryChange: (value: string) => void;
  statusFilter: TaskStatus | "All";
  onStatusFilterChange: (value: TaskStatus | "All") => void;
  tasks: Task[];
  selectedTaskId: string;
  onSelectTask: (id: string) => void;
};

function statusBadgeVariant(status: TaskStatus): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "Done":
      return "secondary";
    case "Blocked":
      return "destructive";
    case "In Progress":
      return "default";
    case "Backlog":
    default:
      return "outline";
  }
}

function statusIcon(status: TaskStatus) {
  switch (status) {
    case "Done":
      return CheckCircle2;
    case "Blocked":
      return AlertTriangle;
    case "In Progress":
      return CircleDot;
    case "Backlog":
    default:
      return PauseCircle;
  }
}

export function TaskListPane({
  query,
  onQueryChange,
  statusFilter,
  onStatusFilterChange,
  tasks,
  selectedTaskId,
  onSelectTask,
}: Props) {
  const draggableRef = useRef<Draggable | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const grouped = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const t of tasks) {
      const k = t.projectTitle;
      const prev = map.get(k);
      if (prev) prev.push(t);
      else map.set(k, [t]);
    }
    return Array.from(map.entries()).map(([projectTitle, items]) => ({
      projectTitle,
      items,
    }));
  }, [tasks]);

  // Initialize FullCalendar Draggable for task cards
  useEffect(() => {
    if (!containerRef.current) return;

    draggableRef.current = new Draggable(containerRef.current, {
      itemSelector: ".draggable-task-card",
      eventData: (eventEl) => {
        const taskId = eventEl.getAttribute("data-task-id");
        const taskTitle = eventEl.getAttribute("data-task-title");
        const taskStatus = eventEl.getAttribute("data-task-status");
        
        console.log("🎯 Dragging task:", { taskId, taskTitle, taskStatus });
        
        return {
          id: taskId,
          title: taskTitle,
          duration: "01:00", // 1 hour default duration
          extendedProps: {
            taskId,
            taskTitle,
            taskStatus,
            isDraggedTask: true,
          },
        };
      },
    });

    return () => {
      draggableRef.current?.destroy();
    };
  }, [tasks]);

  return (
    <div className="h-full min-h-0 flex flex-col">
      <div className="p-4 border-b border-border/60">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs font-bold uppercase tracking-[0.22em] text-muted-foreground">Work Queue</div>
            <div className="text-sm font-semibold truncate">Pick a task to focus</div>
          </div>

          <Button size="sm" variant="ghost" className="h-9 w-9 p-0 rounded-xl">
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              placeholder="Search tasks, projects, objectives…"
              className="pl-9 rounded-xl"
            />
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="rounded-xl">
                <ListFilter className="h-4 w-4 mr-2" />
                {statusFilter}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 rounded-xl">
              <DropdownMenuItem onSelect={() => onStatusFilterChange("All")}>All</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => onStatusFilterChange("Backlog")}>Backlog</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onStatusFilterChange("In Progress")}>In Progress</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onStatusFilterChange("Blocked")}>Blocked</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onStatusFilterChange("Done")}>Done</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <ScrollArea className="flex-1 min-h-0">
        <div ref={containerRef} className="p-3 space-y-4">
          {grouped.map((g) => (
            <div key={g.projectTitle} className="space-y-2">
              <div className="px-2 text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">
                {g.projectTitle}
              </div>
              <div className="space-y-1">
                {g.items.map((t) => {
                  const active = t.id === selectedTaskId;
                  const Icon = statusIcon(t.status);
                  const isDraggable = t.status !== "Done";
                  
                  return (
                    <button
                      key={t.id}
                      onClick={() => onSelectTask(t.id)}
                      data-task-id={t.id}
                      data-task-title={t.title}
                      data-task-status={t.status}
                      className={cn(
                        "w-full text-left rounded-2xl border transition-colors px-3 py-3 group",
                        active
                          ? "bg-primary/10 border-primary/20"
                          : "bg-card hover:bg-muted/60 border-border/60",
                        isDraggable && "draggable-task-card cursor-grab active:cursor-grabbing"
                      )}
                    >
                      <div className="flex items-start gap-3">
                        {isDraggable && (
                          <div className="mt-0.5 opacity-0 group-hover:opacity-40 transition-opacity">
                            <GripVertical className="h-4 w-4 text-muted-foreground" />
                          </div>
                        )}
                        <div
                          className={cn(
                            "mt-0.5 size-8 rounded-xl flex items-center justify-center border",
                            active
                              ? "bg-primary/10 border-primary/20 text-primary"
                              : "bg-muted/40 border-border text-muted-foreground"
                          )}
                        >
                          <Icon className="h-4 w-4" />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="text-sm font-semibold truncate">{t.title}</div>
                              {t.description ? (
                                <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                                  {t.description}
                                </div>
                              ) : null}
                            </div>
                            <Badge
                              variant={statusBadgeVariant(t.status)}
                              className={cn(
                                "text-[10px] px-2 py-0.5 rounded-full",
                                t.status === "Blocked" && "border border-destructive/30"
                              )}
                            >
                              {t.status}
                            </Badge>
                          </div>

                          <div className="mt-2 flex items-center justify-between gap-3">
                            <div className="text-[10px] uppercase tracking-[0.22em] font-bold text-muted-foreground truncate">
                              Owner: {t.owner}
                            </div>
                            <div className="text-[10px] uppercase tracking-[0.22em] font-bold text-muted-foreground">
                              {new Date(t.dueDateISO).toLocaleDateString(undefined, {
                                month: "short",
                                day: "2-digit",
                              })}
                            </div>
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
