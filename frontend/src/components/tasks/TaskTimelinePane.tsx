import { useEffect, useMemo, useRef, useState } from "react";
import Gantt from "frappe-gantt";
import { addDays, format, parseISO } from "date-fns";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Task } from "@/types/task";

type Props = {
  tasks: Task[];
  selectedTask: Task | null;
};

type GanttViewMode = "Day" | "Week" | "Month" | "Year";

import { isValid } from "date-fns";

function toGanttTask(t: Task, selectedTaskId: string | null) {
  const now = new Date();

  // Safe date parsing with fallbacks
  let start = t.plannedStartISO ? parseISO(t.plannedStartISO) : null;
  if (!start || !isValid(start)) {
    // If no start, use today or 1 day before due date
    start = addDays(now, -1);
  }

  let end = t.plannedEndISO ? parseISO(t.plannedEndISO) : (t.dueDateISO ? parseISO(t.dueDateISO) : null);
  if (!end || !isValid(end)) {
    // Ensure end is at least after start
    end = addDays(start, 1);
  } else if (end < start) {
    end = addDays(start, 1);
  }

  const statusClasses = [];
  if (t.status === "backlog") statusClasses.push("is-blocked");
  if (t.status === "done") statusClasses.push("is-done");
  if (t.id === selectedTaskId) statusClasses.push("selected-task");

  return {
    id: t.id,
    name: t.title,
    start: format(start, "yyyy-MM-dd"),
    end: format(end, "yyyy-MM-dd"),
    progress: t.status === "done" ? 100 : t.status === "in-progress" ? 55 : t.status === "backlog" ? 15 : 0,
    dependencies: t.dependencies.map((d) => d.id).join(","),
    custom_class: statusClasses.join(" "),
  };
}

import "./calendar-styles.css";

export function TaskTimelinePane({ tasks, selectedTask }: Props) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const ganttRef = useRef<any>(null);

  const [viewMode, setViewMode] = useState<GanttViewMode>("Week");

  const ganttTasks = useMemo(() =>
    tasks.map(t => toGanttTask(t, selectedTask?.id || null)),
    [tasks, selectedTask?.id]
  );

  useEffect(() => {
    if (!containerRef.current || !wrapperRef.current) return;

    const timer = setTimeout(() => {
      if (!containerRef.current || !wrapperRef.current) return;

      const availableHeight = wrapperRef.current.clientHeight;
      // If height is 0, we'll try again on resize or next tick
      if (availableHeight <= 0) return;

      containerRef.current.innerHTML = "";

      try {
        ganttRef.current = new (Gantt as any)(containerRef.current, ganttTasks, {
          view_mode: viewMode,
          date_format: "YYYY-MM-DD",
          container_height: availableHeight,
          bar_height: 32,
          bar_corner_radius: 8,
          arrow_curve: 5,
          padding: 18,
          column_width: viewMode === "Day" ? 60 : viewMode === "Week" ? 140 : 120,
          view_mode_select: false,
          today_button: false,
          custom_popup_html: (task: any) => {
            const source = tasks.find((t) => t.id === task.id);
            const subtitle = source ? `${source.projectTitle} • ${source.owner}` : "";
            return `
              <div class="gantt-custom-popup">
                <div class="gantt-popup-subtitle">${subtitle}</div>
                <div class="gantt-popup-title">${task.name}</div>
                <div class="gantt-popup-dates">${task.start} → ${task.end}</div>
              </div>
            `;
          },
        });
      } catch (e) {
        console.error("Gantt init failed:", e);
      }
    }, 16); // Slightly longer for layout stability

    return () => {
      clearTimeout(timer);
      if (containerRef.current) containerRef.current.innerHTML = "";
      ganttRef.current = null;
    };
  }, [ganttTasks, tasks, viewMode]);

  // Re-init on container resize so height stays correct
  useEffect(() => {
    if (!wrapperRef.current) return;
    const observer = new ResizeObserver(() => {
      if (!containerRef.current || !wrapperRef.current || !ganttRef.current) return;
      // frappe doesn't expose a resize API, so we just re-render
      // by triggering the main effect — change_view_mode is the lightest hook
      try { ganttRef.current.change_view_mode(viewMode); } catch { /* ignore */ }
    });
    observer.observe(wrapperRef.current);
    return () => observer.disconnect();
  }, [viewMode]);


  const handleToday = () => {
    if (ganttRef.current) {
      ganttRef.current.scroll_current?.();
    }
  };

  return (
    <div className="h-full min-h-0 flex flex-col bg-background">
      {/* ── Toolbar ── */}
      <div className="flex-none flex items-center justify-between px-6 py-4 border-b border-border/40 bg-card/10">
        <div className="flex items-center gap-4">
          <h2 className="text-[10px] font-bold uppercase tracking-[0.25em] text-muted-foreground">Timeline</h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleToday}
            className="h-8 rounded-full border border-border/40 px-4 text-[10px] font-bold uppercase tracking-widest hover:bg-muted/50 transition-all"
          >
            Today
          </Button>
        </div>

        <div className="flex items-center gap-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="rounded-full h-9 px-5 border-border/60 text-[11px] font-bold uppercase tracking-widest bg-card/20 hover:bg-card/40 shadow-sm transition-all">
                {viewMode}
                <ChevronDown className="h-3.5 w-3.5 ml-2 opacity-40" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="rounded-2xl border-border/40 bg-card/95 backdrop-blur-xl shadow-2xl min-w-[240px]">
              {(["Day", "Week", "Month", "Year"] as GanttViewMode[]).map((mode) => (
                <DropdownMenuItem
                  key={mode}
                  className={cn(
                    "text-[11px] font-bold uppercase tracking-widest py-3 px-5 focus:bg-primary/10 focus:text-primary transition-colors cursor-pointer",
                    viewMode === mode && "text-primary bg-primary/5 font-extrabold"
                  )}
                  onSelect={() => setViewMode(mode as GanttViewMode)}
                >
                  {mode}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* ── Gantt body ──
          wrapperRef measures the available height.
          task-gantt-root has overflow:auto so the gantt-container
          (sized by frappe via --gv-grid-height) scrolls inside it. */}
      <div ref={wrapperRef} className="flex-1 w-full min-h-0 task-gantt-root">
        <div ref={containerRef} className="w-full" />
      </div>
    </div>
  );
}