import { useMemo, useState, useRef, useEffect } from "react";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import dayGridPlugin from "@fullcalendar/daygrid";
import listPlugin from "@fullcalendar/list";
import interactionPlugin from "@fullcalendar/interaction";
import type { EventReceiveArg, EventResizeDoneArg } from "@fullcalendar/interaction";
import type { EventContentArg, EventInput } from "@fullcalendar/core";
import { addMinutes, format, parseISO, isPast } from "date-fns";
import {
  Bell,
  CalendarClock,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Flag,
  Focus,
  Link2,
  Timer,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import type { CalendarBlock, CalendarBlockType, Task } from "@/types/task";

type Props = {
  tasks: Task[];
  blocks: CalendarBlock[];
  selectedTask: Task | null;
  onViewChange?: (view: string) => void;
  onTaskSchedule?: (taskId: string, startISO: string, endISO: string) => void;
};

type CalendarView = "timeGridDay" | "timeGridWeek" | "dayGridMonth" | "listWeek";

const typeMeta: Record<CalendarBlockType, { label: string; icon: any; pill: string; bg: string; border: string }> = {
  meeting: {
    label: "Meeting",
    icon: CalendarClock,
    pill: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/25",
    bg: "bg-sky-500/15",
    border: "border-sky-500/30",
  },
  focus_block: {
    label: "Focus block",
    icon: Focus,
    pill: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/25",
    bg: "bg-emerald-500/15",
    border: "border-emerald-500/30",
  },
  task_slot: {
    label: "Task slot",
    icon: Timer,
    pill: "bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/25",
    bg: "bg-violet-500/15",
    border: "border-violet-500/30",
  },
  deadline_marker: {
    label: "Deadline",
    icon: Flag,
    pill: "bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/25",
    bg: "bg-orange-500/15",
    border: "border-orange-500/30",
  },
  reminder: {
    label: "Reminder",
    icon: Bell,
    pill: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/25",
    bg: "bg-rose-500/15",
    border: "border-rose-500/30",
  },
};

function makeEventInput(block: CalendarBlock, task?: Task): EventInput {
  const base = {
    id: block.id,
    title: block.title,
    start: block.startISO,
    end: block.endISO,
    backgroundColor: "#5ba66d",
    borderColor: "transparent",
    textColor: "#111827",
    extendedProps: {
      type: block.type,
      taskId: block.taskId,
      notes: block.notes,
      taskTitle: task?.title,
      projectTitle: task?.projectTitle,
    },
  } satisfies EventInput;

  if (block.type === "deadline_marker") {
    return {
      ...base,
      allDay: false,
      start: block.startISO,
      end: addMinutes(parseISO(block.startISO), 10).toISOString(),
      display: "auto",
      classNames: ["task-deadline"],
    };
  }

  if (block.type === "focus_block") {
    return {
      ...base,
      display: "background",
      classNames: ["task-focus-bg"],
    };
  }

  return {
    ...base,
    classNames: ["task-event"],
  };
}

function renderEventContent(arg: EventContentArg) {
  const type = arg.event.extendedProps.type as CalendarBlockType;
  const isScheduledTask = arg.event.extendedProps.isScheduledTask;
  const isMonthView = arg.view.type === "dayGridMonth";
  
  if (isMonthView) {
    return (
      <div className="w-full truncate text-[12px] font-medium px-1.5 py-0.5" style={{ color: arg.textColor || "inherit" }}>
        {arg.event.title}
      </div>
    );
  }

  // Handle scheduled tasks (no type metadata)
  if (isScheduledTask) {
    return (
      <div className="h-full w-full p-2 overflow-hidden">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-bold leading-tight truncate">{arg.event.title}</div>
            <div className="mt-1 flex items-center gap-1.5">
              <span className="text-[9px] font-bold uppercase tracking-widest opacity-60">
                Scheduled Task
              </span>
            </div>
          </div>
          <Timer className="h-3.5 w-3.5 opacity-40" />
        </div>
      </div>
    );
  }
  
  // Handle calendar blocks with type metadata
  if (!type || !typeMeta[type]) {
    return <div className="p-2 text-xs">{arg.event.title}</div>;
  }
  
  const meta = typeMeta[type];
  const Icon = meta.icon;
  const isBg = arg.event.display === "background";

  if (isBg) {
    return (
      <div className="h-full w-full px-2 py-1.5 opacity-40">
        <div className="flex items-center gap-2">
          <Icon className="h-3 w-3" />
          <span className="text-[10px] font-bold uppercase tracking-wider truncate">{arg.event.title}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={cn(
      "h-full w-full p-2 border-l-4 overflow-hidden",
      meta.bg,
      meta.border.replace("border-", "border-l-")
    )}>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-bold leading-tight truncate">{arg.event.title}</div>
          <div className="mt-1 flex items-center gap-1.5">
            <span className="text-[9px] font-bold uppercase tracking-widest opacity-60">
              {meta.label}
            </span>
          </div>
        </div>
        <Icon className="h-3.5 w-3.5 opacity-40" />
      </div>
    </div>
  );
}

import "./calendar-styles.css";

export function TaskSchedulePane({ tasks, blocks, selectedTask, onViewChange, onTaskSchedule }: Props) {
  const [selectedBlockId, setSelectedBlockId] = useState<string>("");
  const [currentViewType, setCurrentViewType] = useState<CalendarView>("dayGridMonth");
  const [currentViewDate, setCurrentViewDate] = useState<Date>(new Date());
  const calendarRef = useRef<FullCalendar>(null);

  // Set initial scroll time to current time (Google Calendar style)
  const scrollTime = useMemo(() => format(new Date(), "HH:mm:ss"), []);

  const headerTitle = useMemo(() => {
    if (currentViewType === "dayGridMonth") return format(currentViewDate, "MMMM yyyy");
    if (currentViewType === "timeGridWeek") return format(currentViewDate, "MMMM yyyy");
    if (currentViewType === "timeGridDay") return format(currentViewDate, "EEEE, do MMMM yyyy");
    if (currentViewType === "listWeek") return format(currentViewDate, "MMMM yyyy");
    return format(currentViewDate, "MMMM yyyy");
  }, [currentViewDate, currentViewType]);

  // Fix: Force calendar update on container resize to handle aspect ratio changes
  useEffect(() => {
    const calendarApi = calendarRef.current?.getApi();
    if (!calendarApi) return;

    // Use ResizeObserver on the calendar's parent to detect any layout changes
    const container = (calendarRef.current as any)?.el?.parentElement as HTMLElement | undefined;
    if (!container) return;

    const resizeObserver = new ResizeObserver(() => {
      calendarApi.updateSize();
    });

    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, []);

  // Imperatively update the FullCalendar toolbar title with a custom formatted date
  useEffect(() => {
    const titleEl = (calendarRef.current as any)?.el?.querySelector?.('.fc-toolbar-title') as HTMLElement | null;
    if (!titleEl) return;
    if (currentViewType === 'dayGridMonth') {
      titleEl.textContent = format(currentViewDate, 'MMMM yyyy');
    } else if (currentViewType === 'timeGridDay') {
      titleEl.textContent = format(currentViewDate, 'do MMMM yyyy');
    } else if (currentViewType === 'timeGridWeek') {
      titleEl.textContent = format(currentViewDate, "'Week of' do MMMM yyyy");
    } else if (currentViewType === 'listWeek') {
      titleEl.textContent = format(currentViewDate, "'Week of' do MMMM yyyy");
    }
  }, [currentViewType, currentViewDate]);

  // Check for scheduling conflicts
  const checkConflicts = (taskId: string, startDate: Date, endDate: Date): { hasConflict: boolean; conflictingTasks: Task[] } => {
    const conflictingTasks = tasks.filter((task) => {
      if (task.id === taskId) return false;
      if (!task.plannedStartISO || !task.plannedEndISO) return false;
      
      const taskStart = parseISO(task.plannedStartISO);
      const taskEnd = parseISO(task.plannedEndISO);
      
      // Check for overlap
      return (startDate < taskEnd && endDate > taskStart);
    });
    
    return {
      hasConflict: conflictingTasks.length > 0,
      conflictingTasks,
    };
  };

  // Handle external task drop
  const handleEventReceive = (info: EventReceiveArg) => {
    try {
      const taskId = info.event.extendedProps.taskId;
      const taskStatus = info.event.extendedProps.taskStatus;
      const startDate = info.event.start;
      const endDate = info.event.end;
      
      console.log("🎯 Task dropped on calendar:", {
        taskId,
        taskStatus,
        start: startDate,
        end: endDate,
      });

      // Validation 1: Check if task is done
      if (taskStatus === "done") {
        console.error("❌ Cannot schedule completed tasks");
        toast.error("Cannot schedule completed tasks", {
          description: "This task is already marked as done.",
        });
        info.revert();
        return;
      }

      // Validation 2: Check if scheduled in the past
      if (startDate && isPast(startDate)) {
        console.error("❌ Cannot schedule tasks in the past");
        toast.error("Cannot schedule in the past", {
          description: "Please select a future time slot.",
        });
        info.revert();
        return;
      }

      // Validation 3: Check for conflicts
      if (startDate && endDate) {
        const { hasConflict, conflictingTasks } = checkConflicts(taskId, startDate, endDate);
        
        if (hasConflict) {
          console.warn("⚠️ Scheduling conflict detected:", conflictingTasks.map(t => t.title));
          toast.warning("Scheduling conflict detected", {
            description: `This time overlaps with: ${conflictingTasks.map(t => t.title).join(", ")}`,
            duration: 5000,
          });
          // Allow scheduling but warn the user
        }
      }

      // Update task with new schedule
      if (startDate && endDate && onTaskSchedule) {
        const startISO = startDate.toISOString();
        const endISO = endDate.toISOString();
        
        console.log("✅ Scheduling task:", {
          taskId,
          startISO,
          endISO,
          duration: `${Math.round((endDate.getTime() - startDate.getTime()) / 60000)} minutes`,
        });
        
        onTaskSchedule(taskId, startISO, endISO);
        
        toast.success("Task scheduled", {
          description: `${info.event.title} scheduled for ${format(startDate, "MMM dd, h:mm a")}`,
        });
      }
    } catch (error) {
      console.error("❌ Error in handleEventReceive:", error);
      toast.error("Failed to schedule task");
      info.revert();
    }
  };

  // Handle event resize (duration change)
  const handleEventResize = (info: EventResizeDoneArg) => {
    try {
      const taskId = info.event.extendedProps.taskId;
      const startDate = info.event.start;
      const endDate = info.event.end;
      
      if (!taskId || !startDate || !endDate) {
        console.warn("⚠️ Missing required data for resize");
        return;
      }

      console.log("📏 Task duration resized:", {
        taskId,
        newDuration: `${Math.round((endDate.getTime() - startDate.getTime()) / 60000)} minutes`,
      });

      // Check for conflicts after resize
      const { hasConflict, conflictingTasks } = checkConflicts(taskId, startDate, endDate);
      
      if (hasConflict) {
        console.warn("⚠️ Resize caused conflict:", conflictingTasks.map(t => t.title));
        toast.warning("Scheduling conflict detected", {
          description: `New duration overlaps with: ${conflictingTasks.map(t => t.title).join(", ")}`,
          duration: 5000,
        });
      }

      if (onTaskSchedule) {
        onTaskSchedule(taskId, startDate.toISOString(), endDate.toISOString());
        toast.success("Task duration updated");
      }
    } catch (error) {
      console.error("❌ Error in handleEventResize:", error);
      toast.error("Failed to resize task");
    }
  };

  const eventInputs = useMemo(() => {
    const byTaskId = new Map(tasks.map((t) => [t.id, t] as const));
    
    // Add calendar blocks
    const blockEvents = blocks.map((b) => makeEventInput(b, b.taskId ? byTaskId.get(b.taskId) : undefined));
    
    // Add scheduled tasks as events
    const taskEvents = tasks
      .filter((t) => t.plannedStartISO && t.plannedEndISO)
      .map((t) => ({
        id: `task-${t.id}`,
        title: t.title,
        start: t.plannedStartISO,
        end: t.plannedEndISO,
        backgroundColor: "#5ba66d",
        borderColor: "transparent",
        textColor: "#111827",
        extendedProps: {
          taskId: t.id,
          taskTitle: t.title,
          projectTitle: t.projectTitle,
          taskStatus: t.status,
          isScheduledTask: true,
        },
        editable: t.status !== "done", // Only allow editing non-done tasks
      } satisfies EventInput));
    
    return [...blockEvents, ...taskEvents];
  }, [blocks, tasks]);

  const selectedBlock = useMemo(() => blocks.find((b) => b.id === selectedBlockId) ?? null, [blocks, selectedBlockId]);
  const selectedBlockTask = useMemo(() => {
    if (!selectedBlock?.taskId) return null;
    return tasks.find((t) => t.id === selectedBlock.taskId) ?? null;
  }, [selectedBlock?.taskId, tasks]);

  const initialDate = useMemo(() => {
    if (selectedTask?.plannedStartISO) return parseISO(selectedTask.plannedStartISO);
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
    <div className="h-full min-h-0 flex flex-col">
      <div className="shrink-0 border-b border-border/60 bg-linear-to-b from-card/50 to-background px-3 py-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 px-2"
              onClick={goPrev}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 px-2"
              onClick={goNext}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>

            <div className="inline-flex">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 px-2.5 text-xs rounded-r-none border-r-0"
                onClick={goToday}
              >
                Today
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 px-2 rounded-l-none"
                    aria-label="Change calendar view"
                  >
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="rounded-xl">
                  <DropdownMenuItem onClick={goToday}>Today</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setView("timeGridWeek")}>Week</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setView("dayGridMonth")}>Month</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <div className="min-w-0 flex-1 text-center">
            <div className="truncate text-sm font-semibold">{headerTitle}</div>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0">
        <div className="h-full">
          <FullCalendar
            ref={calendarRef}
            plugins={[timeGridPlugin, dayGridPlugin, listPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            initialDate={initialDate}
            height="100%"
            nowIndicator
            editable
            selectable
            droppable
            weekends
            navLinks={true}
            slotLabelFormat={{ hour: "numeric", minute: "2-digit", omitZeroMinute: true, hour12: true }}
            views={{
              dayGridMonth: {
                dayHeaderFormat: { weekday: "short" },
              },
              timeGridWeek: {
                dayHeaderFormat: { weekday: "short", day: "numeric", omitCommas: true },
              },
              timeGridDay: {
                dayHeaderFormat: { weekday: "short", day: "numeric", omitCommas: true },
              },
            }}
            scrollTime={scrollTime}
            scrollTimeReset={false}
            headerToolbar={false}
            dayMaxEvents={2}
            moreLinkContent={(args) => `${args.num} more`}

            events={eventInputs as EventInput[]}
            eventContent={renderEventContent}
            eventClassNames={(arg) => {
              const type = arg.event.extendedProps.type as CalendarBlockType;
              if (arg.event.extendedProps.isScheduledTask) {
                return ["task-event", "scheduled-task"];
              }
              if (!type) return ["task-event"];
              return [`fc-type-${type}`, "task-event"];
            }}
            eventClick={(arg) => {
              setSelectedBlockId(String(arg.event.id));
            }}
            dateClick={(arg) => {
              const calendarApi = calendarRef.current?.getApi();
              if (calendarApi) {
                calendarApi.changeView("timeGridDay", arg.date);
              }
            }}
            select={() => {
              setSelectedBlockId("");
            }}
            datesSet={(dateInfo) => {
              const view = dateInfo.view.type as CalendarView;
              onViewChange?.(view);
              setCurrentViewType(view);
              setCurrentViewDate(dateInfo.view.currentStart);
            }}
            eventReceive={handleEventReceive}
            eventResize={handleEventResize}
            eventResizeStart={() => {
              console.log("📏 Started resizing event");
            }}
            eventDrop={(info) => {
              // Handle moving existing scheduled tasks
              const taskId = info.event.extendedProps.taskId;
              const startDate = info.event.start;
              const endDate = info.event.end;
              
              if (!taskId || !startDate || !endDate) return;
              
              console.log("🔄 Task moved:", { taskId, newStart: startDate, newEnd: endDate });
              
              // Check if moved to past
              if (isPast(startDate)) {
                console.error("❌ Cannot move task to the past");
                toast.error("Cannot schedule in the past");
                info.revert();
                return;
              }
              
              // Check for conflicts
              const { hasConflict, conflictingTasks } = checkConflicts(taskId, startDate, endDate);
              if (hasConflict) {
                toast.warning("Scheduling conflict", {
                  description: `Overlaps with: ${conflictingTasks.map(t => t.title).join(", ")}`,
                });
              }
              
              if (onTaskSchedule) {
                onTaskSchedule(taskId, startDate.toISOString(), endDate.toISOString());
                toast.success("Task rescheduled");
              }
            }}
          />
        </div>
      </div>

      <Drawer open={Boolean(selectedBlock)} onOpenChange={(open) => !open && setSelectedBlockId("")}
      >
        <DrawerContent className="h-[75vh] rounded-t-2xl">
          <DrawerHeader className="border-b border-border/60">
            <DrawerTitle className="text-base">{selectedBlock?.title ?? "Block"}</DrawerTitle>
            <DrawerDescription>
              {selectedBlock ? typeMeta[selectedBlock.type].label : ""}
            </DrawerDescription>
          </DrawerHeader>

          <div className="p-4 space-y-3 overflow-auto">
            {selectedBlock ? (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className={cn("rounded-full px-2.5 py-1 text-[11px] border", typeMeta[selectedBlock.type].pill)}>
                    {typeMeta[selectedBlock.type].label}
                  </Badge>
                  <Badge variant="outline" className="rounded-full px-2.5 py-1 text-[11px]">
                    {format(parseISO(selectedBlock.startISO), "EEE, MMM dd • p")}
                    {selectedBlock.endISO ? ` – ${format(parseISO(selectedBlock.endISO), "p")}` : ""}
                  </Badge>
                </div>

                {selectedBlockTask ? (
                  <div className="rounded-xl border border-border/60 bg-card/40 p-3">
                    <div className="text-xs font-bold uppercase tracking-[0.22em] text-muted-foreground">Linked task</div>
                    <div className="mt-2 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold truncate">{selectedBlockTask.title}</div>
                        <div className="text-xs text-muted-foreground mt-1 truncate">{selectedBlockTask.projectTitle}</div>
                      </div>
                      <Button size="sm" variant="outline" className="rounded-xl">
                        <Link2 className="h-4 w-4 mr-2" />
                        Open
                      </Button>
                    </div>
                  </div>
                ) : null}

                {selectedBlock.notes ? (
                  <>
                    <Separator className="bg-border/60" />
                    <div className="text-sm text-foreground/90 leading-relaxed">{selectedBlock.notes}</div>
                  </>
                ) : null}

                <div className="pt-2 flex items-center justify-end gap-2">
                  <Button variant="outline" className="rounded-xl">Edit</Button>
                  <Button className="rounded-xl">Convert to task slot</Button>
                </div>
              </>
            ) : null}
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
