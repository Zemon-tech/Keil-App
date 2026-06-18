import { useState, useEffect, useRef, useMemo } from "react";
import { format, addDays, subDays, nextMonday, startOfToday, startOfDay, parseISO } from "date-fns";
import {
  CalendarIcon,
  Flag,
  Target,
  MapPin,
  Users,
  CheckCircle2,
  Clock,
  Timer,
  Zap,
  Layout,
  ChevronRight,
  Maximize2,
  Minimize2,
  X,
  Paperclip,
  Video
} from "lucide-react";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
  PopoverClose,
} from "@/components/ui/popover";
import { Calendar, CalendarDayButton } from "@/components/ui/calendar";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import { toast } from "sonner";
import { getOptimizedImageUrl } from "@/lib/image-optimizer";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

import type { TaskDTO, CreateTaskInput } from "@/hooks/api/useTasks";
import { useCreateOrgTask, useUpdateOrgTask, useOrgTasks } from "@/hooks/api/useTasks";
import { useAppContext } from "@/contexts/AppContext";
import { useSpaceMembers, useSpaces } from "@/hooks/api/useSpaces";
import { useMotionPages } from "@/hooks/api/useMotionPages";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import type { AnyStatus } from "@/types/task";
import { StatusIcon, STATUS_OPTIONS, EVENT_STATUS_OPTIONS } from "./task-detail-shared";
import { TaskContextSection } from "./TaskContextSection";
import { TaskDescriptionEditor } from "./TaskDescriptionEditor";

type SimpleAssigneeOption = {
  id: string;
  name: string;
  avatarUrl?: string;
};

interface CreateTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTaskCreated?: (newTaskId: string, taskType: "task" | "event") => void;
  allTasks?: TaskDTO[];
  allUsers?: SimpleAssigneeOption[];
  mode?: "create" | "edit";
  taskId?: string;
  initialValues?: Partial<TaskDTO>;
  onTaskUpdated?: (taskId: string) => void;
  parentTaskId?: string;
  parentTaskTitle?: string;
  orgId?: string;
  spaceId?: string;
}

const PRIORITY_LEVELS = [
  { label: "Low", value: "low", color: "text-zinc-400 bg-zinc-400/10", icon: Flag },
  { label: "Medium", value: "medium", color: "text-yellow-400 bg-yellow-400/10", icon: Flag },
  { label: "High", value: "high", color: "text-orange-400 bg-orange-400/10", icon: Flag },
  { label: "Urgent", value: "urgent", color: "text-red-400 bg-red-400/10", icon: Flag },
] as const;

const EMPTY_USERS: SimpleAssigneeOption[] = [];

const isValidDate = (d: any): d is Date => d instanceof Date && !isNaN(d.getTime());

const safeFormat = (dateVal: Date | undefined | null, formatStr: string, fallback: string = "") => {
  if (!dateVal || !isValidDate(dateVal)) return fallback;
  try {
    return format(dateVal, formatStr);
  } catch (e) {
    return fallback;
  }
};

export function CreateTaskDialog({
  open,
  onOpenChange,
  onTaskCreated,
  allUsers = EMPTY_USERS,
  mode = "create",
  taskId,
  initialValues,
  onTaskUpdated,
  parentTaskId,
  parentTaskTitle,
  orgId,
  spaceId,
}: CreateTaskDialogProps) {
  const { activeOrgId, activeSpaceId, organisations } = useAppContext();

  // Internal selection state for org/space
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [selectedSpaceId, setSelectedSpaceId] = useState<string | null>(null);

  // Sync state with props/context on dialog open or changes
  useEffect(() => {
    if (open) {
      setSelectedOrgId(orgId ?? initialValues?.org_id ?? activeOrgId);
      setSelectedSpaceId(spaceId ?? initialValues?.space_id ?? activeSpaceId);
    }
  }, [open, orgId, spaceId, initialValues, activeOrgId, activeSpaceId]);

  // Fetch spaces for the currently selected organisation
  const { data: spacesForSelectedOrg = [] } = useSpaces(selectedOrgId);

  // Sync space when organisation changes to ensure a valid space is selected
  useEffect(() => {
    if (selectedOrgId && spacesForSelectedOrg.length > 0) {
      const belongs = spacesForSelectedOrg.some((s) => s.id === selectedSpaceId);
      if (!belongs) {
        setSelectedSpaceId(spacesForSelectedOrg[0].id);
      }
    }
  }, [selectedOrgId, spacesForSelectedOrg, selectedSpaceId]);

  const currentOrg = organisations.find((o) => o.id === selectedOrgId) ?? null;
  const currentSpace = spacesForSelectedOrg.find((s) => s.id === selectedSpaceId) ?? null;

  const createOrgTask = useCreateOrgTask(selectedOrgId, selectedSpaceId);
  const updateOrgTask = useUpdateOrgTask(selectedOrgId, selectedSpaceId);

  const { data: spaceMembers = [] } = useSpaceMembers(
    selectedOrgId,
    selectedSpaceId
  );
  const { data: orgTasks = [] } = useOrgTasks(selectedOrgId, selectedSpaceId);
  const { data: pages = [] } = useMotionPages(selectedOrgId, selectedSpaceId);

  const resolvedUsers = useMemo<SimpleAssigneeOption[]>(() => {
    if (allUsers && allUsers.length > 0) return allUsers;
    return spaceMembers.map(m => ({
      id: m.user_id,
      name: m.name || m.email,
      avatarUrl: m.avatar_url || m.avatarUrl || undefined,
    }));
  }, [allUsers, spaceMembers]);

  // ── Form State ─────────────────────────────────────────────────────────────
  const [title, setTitle] = useState("");
  const [type, setType] = useState<"task" | "event">("task");
  const [status, setStatus] = useState<AnyStatus>("todo");

  // Sync status default when type changes
  useEffect(() => {
    setStatus(type === "task" ? "todo" : "confirmed");
  }, [type]);

  // Metadata
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [priority, setPriority] = useState<string>("medium");
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);

  // Advanced sections
  const [description, setDescription] = useState("");
  const [objective, setObjective] = useState("");
  const [successCriteria, setSuccessCriteria] = useState("");
  const [location, setLocation] = useState("");
  const [agenda, setAgenda] = useState("");

  // Collapsible states
  const [showClarity, setShowClarity] = useState(false);
  const [showAgenda, setShowAgenda] = useState(false);
  const [showCommandMenu, setShowCommandMenu] = useState(false);

  // Redesign UI state helpers
  const [isMaximized, setIsMaximized] = useState(false);
  const [createMore, setCreateMore] = useState(false);

  // Ref for programmatically closing the date popover
  const dateCloseRef = useRef<HTMLButtonElement>(null);

  // New metadata fields
  const [storyPoints, setStoryPoints] = useState<number | undefined>(undefined);
  const [timeEstimate, setTimeEstimate] = useState<number | undefined>(undefined); // in minutes
  const [isAllDay, setIsAllDay] = useState(true);
  const [eventType, setEventType] = useState<string>("meeting");
  const [createMeetLink, setCreateMeetLink] = useState(false);
  const [guests, setGuests] = useState<string[]>([]);
  const [guestInput, setGuestInput] = useState("");
  const [context, setContext] = useState<any[]>([]);
  const triggerUploadRef = useRef<(() => void) | null>(null);

  // Date range drag-to-select states
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<Date | null>(null);
  const [dragEnd, setDragEnd] = useState<Date | null>(null);

  const dragStartRef = useRef<Date | null>(null);
  const isMouseDownRef = useRef(false);
  const hasDraggedRef = useRef(false);

  const getOrderedRange = (d1: Date, d2: Date) => {
    return d1.getTime() < d2.getTime() ? { from: d1, to: d2 } : { from: d2, to: d1 };
  };

  useEffect(() => {
    const handleMouseUp = () => {
      if (isMouseDownRef.current) {
        isMouseDownRef.current = false;
        if (hasDraggedRef.current) {
          setIsDragging(false);
          if (dragStartRef.current && dragEnd) {
            const ordered = getOrderedRange(dragStartRef.current, dragEnd);

            const newStart = new Date(ordered.from);
            if (date && !isAllDay) {
              newStart.setHours(date.getHours(), date.getMinutes());
            }
            setDate(newStart);

            const newEnd = new Date(ordered.to);
            if (endDate && !isAllDay) {
              newEnd.setHours(endDate.getHours(), endDate.getMinutes());
            } else if (!isAllDay) {
              newEnd.setHours(newStart.getHours() + 1, newStart.getMinutes());
            }
            setEndDate(newEnd);

            if (isAllDay) {
              dateCloseRef.current?.click();
            }
          }
        }
      }
    };

    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [dragEnd, date, endDate, isAllDay]);

  // ── Smart Parsing ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (mode === "edit" || !open) return;

    const lowerTitle = title.toLowerCase();

    // Detect Type
    if (lowerTitle.match(/\b(meeting|call|sync|lunch|coffee|event|workshop)\b/)) {
      if (type !== "event") {
        setType("event");
      }
    }

    // Detect Priority
    let detectedPriority: "urgent" | "high" | "low" | null = null;
    if (lowerTitle.includes("!urgent") || lowerTitle.includes("urgent")) detectedPriority = "urgent";
    else if (lowerTitle.includes("!high") || lowerTitle.includes("high")) detectedPriority = "high";
    else if (lowerTitle.includes("!low") || lowerTitle.includes("low")) detectedPriority = "low";

    if (detectedPriority && priority !== detectedPriority) {
      setPriority(detectedPriority);
    }

    // Detect Date
    let detectedDate: Date | null = null;
    if (lowerTitle.includes("today")) detectedDate = startOfToday();
    else if (lowerTitle.includes("tomorrow")) detectedDate = addDays(startOfToday(), 1);
    else if (lowerTitle.includes("monday")) detectedDate = nextMonday(startOfToday());

    if (detectedDate) {
      if (!date || date.getTime() !== detectedDate.getTime()) {
        setDate(detectedDate);
      }
    }

    // Detect Assignees (simple @ match)
    resolvedUsers.forEach(user => {
      if (lowerTitle.includes(`@${user.name.toLowerCase().replace(/\s/g, "")}`)) {
        if (!assigneeIds.includes(user.id)) {
          setAssigneeIds(prev => [...prev, user.id]);
        }
      }
    });
  }, [title, resolvedUsers, mode, open]);

  const handleAddGuest = () => {
    const email = guestInput.trim().toLowerCase();
    if (!email) return;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast.error("Invalid email address");
      return;
    }
    if (guests.includes(email)) {
      toast.error("Guest already added");
      return;
    }
    setGuests(prev => [...prev, email]);
    setGuestInput("");
  };

  const handleRemoveGuest = (emailToRemove: string) => {
    setGuests(prev => prev.filter(email => email !== emailToRemove));
  };

  // ── Pre-fill Mode ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (open && initialValues) {
      setTitle(initialValues.title ?? "");
      setType((initialValues.type as "task" | "event") ?? "task");
      setObjective(initialValues.objective ?? "");
      setSuccessCriteria(initialValues.success_criteria ?? "");
      setPriority((initialValues.priority as any) ?? "medium");
      setAssigneeIds(((initialValues as any).assignees ?? []).map((a: any) => a.id));
      setLocation(initialValues.location ?? "");
      setIsAllDay(initialValues.is_all_day ?? true);
      setEventType(initialValues.event_type ?? "meeting");
      setStatus((initialValues.status as AnyStatus) ?? (initialValues.type === "event" ? "confirmed" : "todo"));

      const desc = initialValues.description ?? "";
      const agendaIndex = desc.indexOf("\n\nAgenda:\n");
      if (agendaIndex !== -1) {
        setDescription(desc.substring(0, agendaIndex));
        setAgenda(desc.substring(agendaIndex + 10));
        setShowAgenda(true);
      } else {
        setDescription(desc);
        setAgenda("");
        setShowAgenda(false);
      }

      const start = (initialValues as any).start_date;
      const end = (initialValues as any).due_date;
      const loadedIsAllDay = initialValues.is_all_day ?? true;
      if (start) setDate(parseISO(start));
      if (end) {
        const parsedEnd = parseISO(end);
        // All-day due_date is stored as exclusive end (next day midnight) for FullCalendar.
        // Subtract 1 day to show the correct inclusive end date in the picker.
        setEndDate(loadedIsAllDay ? subDays(startOfDay(parsedEnd), 1) : parsedEnd);
      }

      // Auto-expand if content exists
      if (initialValues.objective || initialValues.success_criteria) setShowClarity(true);

      setStoryPoints(initialValues.story_points || undefined);
      setTimeEstimate((initialValues as any).time_estimate || undefined);
      setGuests(initialValues.guests ?? []);
      setCreateMeetLink(!!initialValues.meet_link || !!(initialValues as any).create_meet_link);
      setContext(initialValues.context ?? []);
    } else if (open && mode === "create") {
      // Reset
      setTitle("");
      setType("task");
      setStatus("todo");
      setDate(undefined);
      setEndDate(undefined);
      setPriority("medium");
      setAssigneeIds([]);
      setDescription("");
      setObjective("");
      setSuccessCriteria("");
      setLocation("");
      setAgenda("");

      const defaultShowClarity = typeof window !== "undefined"
        ? localStorage.getItem("task_show_clarity_default") === "true"
        : false;
      setShowClarity(defaultShowClarity);

      setShowAgenda(false);
      setStoryPoints(undefined);
      setTimeEstimate(undefined);
      setShowCommandMenu(false);
      setIsAllDay(true);
      setEventType("meeting");
      setCreateMeetLink(false);
      setGuests([]);
      setGuestInput("");
      setContext([]);
    }
  }, [open, mode, initialValues]);

  // Sync end date if not set for events
  useEffect(() => {
    if (type === 'event' && date && !endDate) {
      setEndDate(addDays(date, 0)); // just to have it initialized if needed
    }
  }, [type, date]);

  // ── Submission ─────────────────────────────────────────────────────────────
  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!title.trim()) return;

    // Validation: Block creation in the past
    if (mode === "create" && date) {
      const now = new Date();
      if (isAllDay) {
        // For all-day tasks, we only block if the date is strictly before today
        const today = startOfToday();
        const selectedDateOnly = new Date(date);
        selectedDateOnly.setHours(0, 0, 0, 0);

        if (selectedDateOnly < today) {
          toast.error("Cannot create in the past", {
            description: "Please select a future time slot.",
          });
          return;
        }
      } else {
        // For timed tasks, we block if it's even one minute in the past
        if (date < now) {
          toast.error("Cannot create in the past", {
            description: "Please select a future time slot.",
          });
          return;
        }
      }
    }

    // For all-day tasks/events with a date range, store due_date as exclusive end
    // (i.e. start of the day AFTER the last selected day). FullCalendar requires
    // exclusive end dates for all-day events to render correctly across all days.
    const computedDueDate = (() => {
      if (isAllDay && endDate) {
        // endDate is the inclusive last day the user picked (e.g. Jun 10).
        // Add 1 day so FullCalendar's exclusive end covers Jun 10 fully.
        return startOfDay(addDays(endDate, 1)).toISOString();
      }
      return endDate?.toISOString() || (type === 'task' ? date?.toISOString() : undefined);
    })();

    const finalDescription = description.trim() + (type === "event" && agenda.trim() ? `\n\nAgenda:\n${agenda.trim()}` : "");

    const input: CreateTaskInput = {
      title: title.trim(),
      type,
      priority: priority as any,
      description: finalDescription || undefined,
      objective: objective.trim() || undefined,
      success_criteria: successCriteria.trim() || undefined,
      location: location.trim() || undefined,
      start_date: isAllDay && date ? startOfDay(date).toISOString() : date?.toISOString(),
      due_date: computedDueDate,
      assignee_ids: assigneeIds.length > 0 ? assigneeIds : undefined,
      status: status as any,
      parent_task_id: parentTaskId,
      story_points: storyPoints,
      time_estimate: timeEstimate,
      event_type: type === 'event' ? eventType : undefined,
      create_meet_link: createMeetLink,
      guests: guests.length > 0 ? guests : undefined,
      context: context.length > 0 ? context : undefined,
    };

    const options = {
      onSuccess: (data: any) => {
        onOpenChange(false);
        if (mode === "edit" && taskId) {
          onTaskUpdated?.(taskId);
        } else if (data?.id) {
          onTaskCreated?.(data.id, data.type ?? type);
        }
      }
    };

    if (mode === "edit" && taskId) {
      updateOrgTask.mutate({ id: taskId, updates: input }, options);
    } else {
      createOrgTask.mutate(input, options);
    }
  };

  const currentPriority = PRIORITY_LEVELS.find(p => p.value === priority) || PRIORITY_LEVELS[1];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(
        "bg-background border border-border p-0 overflow-hidden shadow-2xl transition-all duration-200 [&>button]:hidden text-foreground flex flex-col w-full",
        isMaximized ? "sm:max-w-[900px] h-[650px] rounded-xl" : "sm:max-w-[900px] h-[420px] rounded-xl"
      )}>
        <DialogTitle className="sr-only">
          {mode === "edit" ? "Edit Task" : "Create Task"}
        </DialogTitle>
        <DialogDescription className="sr-only">
          Use this form to define task details, assignees, dates, and priorities.
        </DialogDescription>

        {/* Header Breadcrumbs & Action Row */}
        <div className="flex items-center justify-between px-6 pt-5 pb-2 bg-background select-none">
          <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium">
            {/* Org Badge Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center gap-0.5 px-2 py-0.5 rounded text-secondary-foreground hover:text-foreground hover:bg-secondary/80 transition-colors cursor-pointer focus:outline-none font-semibold">
                <span className="truncate max-w-[120px]">{currentOrg?.name || "KAY"}</span>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="bg-popover border border-border text-popover-foreground max-h-60 overflow-y-auto custom-scrollbar">
                {organisations.map((org) => (
                  <DropdownMenuItem
                    key={org.id}
                    onClick={() => setSelectedOrgId(org.id)}
                    className="hover:bg-accent focus:bg-accent hover:text-accent-foreground focus:text-accent-foreground cursor-pointer flex items-center gap-2"
                  >
                    <span>{org.name}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <ChevronRight className="size-3 text-muted-foreground" />

            {/* Space Badge Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center gap-0.5 px-2 py-0.5 rounded text-secondary-foreground hover:text-foreground hover:bg-secondary/80 transition-colors cursor-pointer focus:outline-none font-medium">
                <span className="truncate max-w-[120px]">{currentSpace?.name || "General"}</span>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="bg-popover border border-border text-popover-foreground max-h-60 overflow-y-auto custom-scrollbar">
                {spacesForSelectedOrg.map((space) => (
                  <DropdownMenuItem
                    key={space.id}
                    onClick={() => setSelectedSpaceId(space.id)}
                    className="hover:bg-accent focus:bg-accent hover:text-accent-foreground focus:text-accent-foreground cursor-pointer"
                  >
                    <span>{space.name}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <ChevronRight className="size-3 text-muted-foreground" />

            {/* Task/Event Dropdown Selector */}
            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center gap-0.5 text-foreground/80 hover:text-foreground transition-colors font-semibold focus:outline-none cursor-pointer">
                <span>{type === "task" ? "New task" : "New event"}</span>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="bg-popover border border-border text-popover-foreground">
                <DropdownMenuItem onClick={() => setType("task")} className="hover:bg-accent focus:bg-accent hover:text-accent-foreground focus:text-accent-foreground cursor-pointer">
                  New task
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setType("event")} className="hover:bg-accent focus:bg-accent hover:text-accent-foreground focus:text-accent-foreground cursor-pointer">
                  New event
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Top-Right Controls */}
          <div className="flex items-center gap-2.5">
            {parentTaskId && (
              <Badge variant="outline" className="bg-muted text-muted-foreground border-none text-[9px] uppercase tracking-wider px-2 py-0">
                Subtask of {parentTaskTitle}
              </Badge>
            )}
            <button
              type="button"
              onClick={() => setIsMaximized(!isMaximized)}
              className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-all focus:outline-none cursor-pointer"
              title={isMaximized ? "Restore window" : "Expand window"}
            >
              {isMaximized ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
            </button>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-all focus:outline-none cursor-pointer"
              title="Close dialog"
            >
              <X className="size-3.5" />
            </button>
          </div>
        </div>

        {/* Dialog Content Canvas & Pills Container */}
        <div className="flex-1 overflow-hidden px-6 pb-4 flex flex-col justify-between">

          {/* Scrollable Fields Canvas */}
          <div className="flex-1 overflow-y-auto space-y-4 pr-1 custom-scrollbar min-h-0">
            {/* Title input and Slash commands */}
            <div className="relative pt-1">
              <input
                autoFocus
                value={title}
                onChange={(e) => {
                  const val = e.target.value;
                  setTitle(val);
                  setShowCommandMenu(val.startsWith("/") && val.length > 0);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !showCommandMenu) {
                    handleSubmit();
                  }
                }}
                placeholder={type === "task" ? "Task title" : "Event title"}
                className="w-full text-[19px] font-semibold bg-transparent border-0 p-0 text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-0"
              />

              {showCommandMenu && (
                <div className="absolute left-0 top-full z-50 w-64 mt-1 bg-popover border border-border rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                  <Command className="bg-transparent text-popover-foreground">
                    <CommandList>
                      <CommandGroup heading="Quick Actions">
                        <CommandItem onSelect={() => {
                          setPriority("urgent");
                          setShowCommandMenu(false);
                        }} className="gap-2 cursor-pointer text-xs hover:bg-muted">
                          <Flag className="size-3.5 text-red-500" /> Set Urgent Priority
                        </CommandItem>
                        <CommandItem onSelect={() => { setDate(startOfToday()); setShowCommandMenu(false); }} className="gap-2 cursor-pointer text-xs hover:bg-muted">
                          <CalendarIcon className="size-3.5 text-blue-500" /> Due Today
                        </CommandItem>
                        <CommandItem onSelect={() => { setType("event"); setShowCommandMenu(false); }} className="gap-2 cursor-pointer text-xs hover:bg-muted">
                          <Clock className="size-3.5 text-purple-500" /> Convert to Event
                        </CommandItem>
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </div>
              )}
            </div>

            {/* Description Editor */}
            <div className="w-full">
              <TaskDescriptionEditor
                value={description}
                onChange={setDescription}
                placeholder="Add description..."
                members={spaceMembers}
                allTasks={orgTasks}
                pages={pages}
              />
            </div>

            {/* Collapsible Clarity Section (Objective & Success Criteria) */}
            {type === "task" && (
              <Collapsible open={showClarity} onOpenChange={setShowClarity} className="w-full">
                <CollapsibleContent className="space-y-2.5 pt-1 animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="flex items-center gap-2.5 bg-background border border-border rounded-lg px-3 py-1.5 focus-within:border-muted-foreground/50 transition-colors">
                    <Target className="size-3.5 text-muted-foreground shrink-0" />
                    <input
                      value={objective}
                      onChange={(e) => setObjective(e.target.value)}
                      placeholder="What is the high-level objective?"
                      className="w-full text-xs bg-transparent border-0 p-0 text-muted-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-0"
                    />
                  </div>
                  <div className="flex items-center gap-2.5 bg-background border border-border rounded-lg px-3 py-1.5 focus-within:border-muted-foreground/50 transition-colors">
                    <CheckCircle2 className="size-3.5 text-muted-foreground shrink-0" />
                    <input
                      value={successCriteria}
                      onChange={(e) => setSuccessCriteria(e.target.value)}
                      placeholder="How do we measure success?"
                      className="w-full text-xs bg-transparent border-0 p-0 text-muted-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-0"
                    />
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}

            {/* Collapsible Event Section (Location & Agenda) */}
            {type === "event" && (
              <div className="space-y-3 pt-1 animate-in fade-in duration-150">
                {/* Location Input */}
                {location !== undefined && (
                  <div className="flex items-center gap-2.5 bg-background border border-border rounded-lg px-3 py-1.5 focus-within:border-muted-foreground/50 transition-colors">
                    <MapPin className="size-3.5 text-muted-foreground shrink-0" />
                    <input
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      placeholder="Add location or meeting link..."
                      className="w-full text-xs bg-transparent border-0 p-0 text-muted-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-0"
                    />
                  </div>
                )}

                {/* Google Meet Toggle Block */}
                <div className="flex items-center justify-between rounded-lg border border-border bg-muted/20 px-3.5 py-2">
                  <div className="space-y-0.5">
                    <Label htmlFor="create-meet-link" className="text-xs font-semibold text-muted-foreground cursor-pointer">
                      Schedule Google Meet
                    </Label>
                    <p className="text-[10px] text-muted-foreground/60">
                      Automatically generate a Google Meet video conference
                    </p>
                  </div>
                  <Switch
                    id="create-meet-link"
                    checked={createMeetLink}
                    onCheckedChange={setCreateMeetLink}
                    className="scale-90 data-[state=checked]:bg-primary"
                  />
                </div>

                {/* Agenda Collapsible */}
                <Collapsible open={showAgenda} onOpenChange={setShowAgenda}>
                  <CollapsibleContent className="animate-in fade-in slide-in-from-top-2 duration-150 mt-1">
                    <textarea
                      value={agenda}
                      onChange={(e) => setAgenda(e.target.value)}
                      placeholder="List agenda items..."
                      className="w-full text-xs bg-background border border-border focus-within:border-muted-foreground/50 rounded-lg p-3 text-muted-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-0 resize-none min-h-[80px]"
                    />
                  </CollapsibleContent>
                </Collapsible>
              </div>
            )}

            {/* Context Files/Links Section */}
            <div className="pt-3 border-t border-border/40 mt-4">
              <TaskContextSection
                task={{ context, space_id: selectedSpaceId ?? activeSpaceId ?? undefined }}
                onChangeContext={setContext}
                spaceId={selectedSpaceId ?? activeSpaceId ?? undefined}
                triggerUploadRef={triggerUploadRef}
              />
            </div>
          </div>

          {/* Metadata Inline Pills Row (Always pinned to bottom of dialog canvas) */}
          <div className="pt-3 pb-1 flex flex-wrap gap-2 items-center select-none overflow-x-auto no-scrollbar">

            {/* Status Selector Pill */}
            <Popover>
              <PopoverTrigger asChild>
                <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all text-xs font-medium focus:outline-none focus:ring-0 bg-secondary hover:bg-secondary/80 text-secondary-foreground capitalize cursor-pointer">
                  <StatusIcon status={status} type={type} className="size-3.5" />
                  <span>{status.replace("-", " ")}</span>
                </button>
              </PopoverTrigger>
              <PopoverContent className="p-1 w-36 bg-popover border border-border text-popover-foreground rounded-lg shadow-xl" align="start">
                {(type === "task" ? STATUS_OPTIONS : EVENT_STATUS_OPTIONS).map((opt) => (
                  <PopoverClose asChild key={opt}>
                    <button
                      onClick={() => setStatus(opt)}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors text-left capitalize cursor-pointer"
                    >
                      <StatusIcon status={opt} type={type} className="size-3.5" />
                      <span>{opt.replace("-", " ")}</span>
                    </button>
                  </PopoverClose>
                ))}
              </PopoverContent>
            </Popover>

            {/* Priority Pill (Task Only) */}
            {type === "task" && (
              <Popover>
                <PopoverTrigger asChild>
                  <button className={cn(
                    "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all text-xs font-medium focus:outline-none focus:ring-0 bg-secondary hover:bg-secondary/80",
                    priority === "urgent" ? "text-red-400 font-semibold" :
                      priority === "high" ? "text-orange-400 font-semibold" :
                        priority === "medium" ? "text-yellow-400 font-semibold" :
                          "text-muted-foreground"
                  )}>
                    <currentPriority.icon className="size-3.5" />
                    <span>{currentPriority.label}</span>
                  </button>
                </PopoverTrigger>
                <PopoverContent className="p-1 w-32 bg-popover border border-border text-popover-foreground rounded-lg shadow-xl" align="start">
                  {PRIORITY_LEVELS.map((p) => (
                    <PopoverClose asChild key={p.value}>
                      <button
                        onClick={() => setPriority(p.value)}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors text-left cursor-pointer"
                      >
                        <p.icon className={cn("size-3.5", p.color.split(' ')[0])} />
                        <span>{p.label}</span>
                      </button>
                    </PopoverClose>
                  ))}
                </PopoverContent>
              </Popover>
            )}

            {/* Date Picker Pill */}
            <Popover>
              <PopoverTrigger asChild>
                <button className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all text-xs font-medium focus:outline-none focus:ring-0 bg-secondary hover:bg-secondary/80",
                  date ? "text-indigo-400 font-semibold" : "text-secondary-foreground"
                )}>
                  <CalendarIcon className="size-3.5" />
                  <span>
                    {date && isValidDate(date) ? (
                      isAllDay
                        ? (endDate && isValidDate(endDate) && safeFormat(date, "yyyy-MM-dd") !== safeFormat(endDate, "yyyy-MM-dd")
                          ? `${safeFormat(date, "MMM d")} - ${safeFormat(endDate, "MMM d, yyyy")}`
                          : safeFormat(date, "MMM d, yyyy"))
                        : (endDate && isValidDate(endDate) && safeFormat(date, "yyyy-MM-dd") !== safeFormat(endDate, "yyyy-MM-dd")
                          ? `${safeFormat(date, "MMM d, h:mm a")} - ${safeFormat(endDate, "MMM d, h:mm a")}`
                          : safeFormat(date, "MMM d, h:mm a"))
                    ) : "Set date"}
                  </span>
                </button>
              </PopoverTrigger>
              <PopoverContent className="p-0 w-auto bg-popover border border-border shadow-xl rounded-lg overflow-hidden" align="start">
                <div className="flex flex-col">
                  <PopoverClose ref={dateCloseRef} className="hidden" />
                  <Calendar
                    mode="range"
                    selected={
                      isDragging && dragStart && dragEnd
                        ? getOrderedRange(dragStart, dragEnd)
                        : { from: date, to: endDate || date }
                    }
                    onSelect={(range) => {
                      if (range?.from) {
                        const newStart = new Date(range.from);
                        if (date && !isAllDay) {
                          newStart.setHours(date.getHours(), date.getMinutes());
                        }
                        setDate(newStart);

                        if (range.to) {
                          const newEnd = new Date(range.to);
                          if (endDate && !isAllDay) {
                            newEnd.setHours(endDate.getHours(), endDate.getMinutes());
                          } else if (!isAllDay) {
                            newEnd.setHours(newStart.getHours() + 1, newStart.getMinutes());
                          }
                          setEndDate(newEnd);
                        } else {
                          setEndDate(undefined);
                        }

                        if (isAllDay && range.to) {
                          dateCloseRef.current?.click();
                        }
                      } else {
                        setDate(undefined);
                        setEndDate(undefined);
                      }
                    }}
                    components={{
                      DayButton: (props) => (
                        <CalendarDayButton
                          {...props}
                          onMouseDown={(e) => {
                            if (e.button === 0) {
                              dragStartRef.current = props.day.date;
                              isMouseDownRef.current = true;
                              hasDraggedRef.current = false;
                            }
                            props.onMouseDown?.(e);
                          }}
                          onMouseEnter={(e) => {
                            if (isMouseDownRef.current && dragStartRef.current) {
                              const dayDate = props.day.date;
                              if (dayDate.getTime() !== dragStartRef.current.getTime()) {
                                if (!hasDraggedRef.current) {
                                  hasDraggedRef.current = true;
                                  setIsDragging(true);
                                  setDragStart(dragStartRef.current);
                                }
                                setDragEnd(dayDate);
                              }
                            }
                            props.onMouseEnter?.(e);
                          }}
                        />
                      )
                    }}
                    initialFocus
                    className="bg-popover text-foreground font-sans"
                  />
                  <div className="p-3 border-t border-border flex flex-col gap-3 bg-background/80">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-muted-foreground">All Day</span>
                      <Switch checked={isAllDay} onCheckedChange={setIsAllDay} className="scale-75 data-[state=checked]:bg-primary" />
                    </div>
                    {!isAllDay && (
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Start Time</span>
                          <Input
                            type="time"
                            className="h-8 w-[110px] text-xs bg-background border-border text-foreground focus-visible:ring-primary/20"
                            value={date && isValidDate(date) ? safeFormat(date, "HH:mm") : ""}
                            onChange={(e) => {
                              const val = e.target.value;
                              const newDate = date && isValidDate(date) ? new Date(date) : new Date();
                              if (!val) {
                                newDate.setHours(0, 0, 0, 0);
                              } else {
                                const [hStr, mStr] = val.split(':');
                                const h = parseInt(hStr, 10);
                                const m = parseInt(mStr, 10);
                                newDate.setHours(isNaN(h) ? 0 : h, isNaN(m) ? 0 : m, 0, 0);
                              }
                              setDate(newDate);
                            }}
                          />
                        </div>
                        <div className="flex flex-col gap-1 items-end">
                          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider text-right">End Time</span>
                          <Input
                            type="time"
                            className="h-8 w-[110px] text-xs bg-background border-border text-foreground focus-visible:ring-primary/20"
                            value={endDate && isValidDate(endDate) ? safeFormat(endDate, "HH:mm") : (date && isValidDate(date) ? safeFormat(date, "HH:mm") : "")}
                            onChange={(e) => {
                              const val = e.target.value;
                              const newEndDate = endDate && isValidDate(endDate) ? new Date(endDate) : (date && isValidDate(date) ? new Date(date) : new Date());
                              if (!val) {
                                newEndDate.setHours(0, 0, 0, 0);
                              } else {
                                const [hStr, mStr] = val.split(':');
                                const h = parseInt(hStr, 10);
                                const m = parseInt(mStr, 10);
                                newEndDate.setHours(isNaN(h) ? 0 : h, isNaN(m) ? 0 : m, 0, 0);
                              }
                              setEndDate(newEndDate);
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </PopoverContent>
            </Popover>

            {/* Assignees Pill */}
            <Popover>
              <PopoverTrigger asChild>
                <button className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all text-xs font-medium focus:outline-none focus:ring-0 bg-secondary hover:bg-secondary/80",
                  assigneeIds.length > 0 ? "text-secondary-foreground" : "text-muted-foreground"
                )}>
                  {assigneeIds.length > 0 ? (
                    <div className="flex items-center gap-1.5">
                      <div className="flex -space-x-1.5">
                        {assigneeIds.map(id => {
                          const user = resolvedUsers.find(u => u.id === id);
                          return (
                            <Avatar key={id} className="size-4.5 border border-background shrink-0">
                              <AvatarImage src={getOptimizedImageUrl(user?.avatarUrl, { width: 32, height: 32 })} />
                              <AvatarFallback className="text-[7px] bg-secondary text-secondary-foreground font-bold">{(user?.name || "?")[0].toUpperCase()}</AvatarFallback>
                            </Avatar>
                          );
                        })}
                      </div>
                      <span className="text-xs text-secondary-foreground font-medium">
                        {assigneeIds.length === 1
                          ? (resolvedUsers.find(u => u.id === assigneeIds[0])?.name || "1 Assignee")
                          : `${assigneeIds.length} Assigned`}
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <Users className="size-3.5 text-muted-foreground" />
                      <span>Assignee</span>
                    </div>
                  )}
                </button>
              </PopoverTrigger>
              <PopoverContent className="p-0 w-64 bg-popover border border-border text-popover-foreground overflow-hidden rounded-lg shadow-xl" align="start">
                <Command className="bg-transparent">
                  <CommandInput placeholder="Assign to..." className="border-none focus:ring-0 text-foreground placeholder:text-muted-foreground/50" />
                  <CommandList className="max-h-56">
                    <CommandEmpty>No members found.</CommandEmpty>
                    <CommandGroup>
                      {resolvedUsers.map((user) => (
                        <CommandItem
                          key={user.id}
                          onSelect={() => {
                            setAssigneeIds(prev => prev.includes(user.id) ? prev.filter(id => id !== user.id) : [...prev, user.id]);
                          }}
                          className="flex items-center gap-2 px-3 py-2 cursor-pointer text-muted-foreground aria-selected:bg-accent aria-selected:text-accent-foreground"
                        >
                          <Avatar className="size-6">
                            <AvatarImage src={getOptimizedImageUrl(user.avatarUrl, { width: 48, height: 48 })} />
                            <AvatarFallback className="bg-muted text-muted-foreground font-bold">{user.name[0].toUpperCase()}</AvatarFallback>
                          </Avatar>
                          <div className="flex-1 flex flex-col">
                            <span className="text-sm font-medium">{user.name}</span>
                          </div>
                          {assigneeIds.includes(user.id) && <CheckCircle2 className="size-4 text-indigo-500" />}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>

            {/* Google Meet Toggle Pill */}
            <button
              type="button"
              onClick={() => setCreateMeetLink(!createMeetLink)}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all text-xs font-medium focus:outline-none focus:ring-0 bg-secondary hover:bg-secondary/80 cursor-pointer",
                createMeetLink ? "text-indigo-400 font-semibold" : "text-secondary-foreground"
              )}
            >
              <Video className="size-3.5" />
              <span>Google Meet</span>
            </button>

            {/* Invite Guests Pill & Popover */}
            <Popover>
              <PopoverTrigger asChild>
                <button className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all text-xs font-medium focus:outline-none focus:ring-0 bg-secondary hover:bg-secondary/80 cursor-pointer",
                  guests.length > 0 ? "text-indigo-400 font-semibold" : "text-muted-foreground"
                )}>
                  <Users className={cn("size-3.5", guests.length > 0 ? "text-indigo-400" : "text-muted-foreground/60")} />
                  <span>
                    {guests.length > 0
                      ? `${guests.length} ${guests.length === 1 ? "Guest" : "Guests"}`
                      : "Invite guests"}
                  </span>
                </button>
              </PopoverTrigger>
              <PopoverContent className="p-3 w-72 bg-popover border border-border text-popover-foreground rounded-lg shadow-xl" align="start">
                <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Invite Guests</div>
                <div className="flex gap-1.5 mb-3">
                  <Input
                    type="email"
                    placeholder="guest@example.com"
                    value={guestInput}
                    onChange={(e) => setGuestInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddGuest();
                      }
                    }}
                    className="h-8 text-xs bg-background border-border text-foreground focus-visible:ring-primary/20 placeholder:text-muted-foreground/60 flex-1"
                  />
                  <Button
                    type="button"
                    onClick={handleAddGuest}
                    className="h-8 px-2 text-xs bg-primary hover:bg-primary/90 text-primary-foreground shrink-0"
                  >
                    Add
                  </Button>
                </div>
                
                {guests.length > 0 ? (
                  <div className="max-h-32 overflow-y-auto space-y-1.5 custom-scrollbar pr-1">
                    {guests.map((email) => (
                      <div key={email} className="flex items-center justify-between bg-muted/40 hover:bg-muted/60 px-2 py-1 rounded text-xs transition-colors">
                        <span className="truncate max-w-[200px] text-muted-foreground">{email}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveGuest(email)}
                          className="text-muted-foreground hover:text-foreground hover:bg-secondary rounded p-0.5"
                        >
                          <X className="size-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[10px] text-muted-foreground/60 text-center py-2">
                    Enter email addresses of workspace users or external guests.
                  </p>
                )}
              </PopoverContent>
            </Popover>

            {/* Event Specific Pills */}
            {type === "event" && (
              <>
                {/* Event Type Pill */}
                <Popover>
                  <PopoverTrigger asChild>
                    <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-secondary hover:bg-secondary/80 transition-all text-xs font-medium text-secondary-foreground capitalize focus:outline-none focus:ring-0 cursor-pointer">
                      <Layout className="size-3.5 text-muted-foreground/60" />
                      <span>{eventType}</span>
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="p-1 w-32 bg-popover border border-border text-popover-foreground rounded-lg shadow-xl" align="start">
                    {["meeting", "call", "birthday", "workshop", "other"].map((t) => (
                      <PopoverClose asChild key={t}>
                        <button
                          onClick={() => setEventType(t)}
                          className="w-full flex items-center px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-accent rounded transition-colors capitalize text-left cursor-pointer"
                        >
                          {t}
                        </button>
                      </PopoverClose>
                    ))}
                  </PopoverContent>
                </Popover>

                {/* Location Toggle Pill */}
                <button
                  type="button"
                  onClick={() => {
                    setLocation(location !== undefined ? location : "");
                  }}
                  className={cn(
                    "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all text-xs font-medium focus:outline-none focus:ring-0 bg-secondary hover:bg-secondary/80 cursor-pointer",
                    location ? "text-indigo-400 font-semibold" : "text-secondary-foreground"
                  )}
                >
                  <MapPin className="size-3.5" />
                  <span>Location</span>
                </button>

                {/* Agenda Toggle Pill */}
                <button
                  type="button"
                  onClick={() => setShowAgenda(!showAgenda)}
                  className={cn(
                    "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all text-xs font-medium focus:outline-none focus:ring-0 bg-secondary hover:bg-secondary/80 cursor-pointer",
                    showAgenda ? "text-indigo-400 font-semibold" : "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="size-3.5" />
                  <span>Agenda</span>
                </button>

                {/* Story Points Pill */}
                <Popover>
                  <PopoverTrigger asChild>
                    <button className={cn(
                      "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all text-xs font-medium focus:outline-none focus:ring-0 bg-secondary hover:bg-secondary/80 cursor-pointer",
                      storyPoints ? "text-secondary-foreground" : "text-muted-foreground"
                    )}>
                      <Zap className={cn("size-3.5", storyPoints ? "text-yellow-500 animate-pulse" : "text-muted-foreground/60")} />
                      <span>{storyPoints ? `${storyPoints} pts` : "Story points"}</span>
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="p-2 w-36 bg-popover border border-border text-popover-foreground rounded-lg shadow-xl" align="start">
                    <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">Story Points</div>
                    <div className="grid grid-cols-3 gap-1">
                      {[1, 2, 3, 5, 8].map(pts => (
                        <PopoverClose asChild key={pts}>
                          <button
                            onClick={() => setStoryPoints(pts)}
                            className={cn(
                              "h-7 rounded flex items-center justify-center text-xs transition-colors cursor-pointer",
                              storyPoints === pts ? "bg-primary text-primary-foreground font-medium" : "hover:bg-muted text-muted-foreground"
                            )}
                          >
                            {pts}
                          </button>
                        </PopoverClose>
                      ))}
                      <PopoverClose asChild>
                        <button
                          onClick={() => setStoryPoints(undefined)}
                          className="h-7 rounded flex items-center justify-center text-xs hover:bg-muted text-muted-foreground cursor-pointer"
                        >
                          Clear
                        </button>
                      </PopoverClose>
                    </div>
                  </PopoverContent>
                </Popover>

                {/* Time Estimate Pill */}
                <Popover>
                  <PopoverTrigger asChild>
                    <button className={cn(
                      "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all text-xs font-medium focus:outline-none focus:ring-0 bg-secondary hover:bg-secondary/80 cursor-pointer",
                      timeEstimate ? "text-secondary-foreground" : "text-muted-foreground"
                    )}>
                      <Timer className={cn("size-3.5", timeEstimate ? "text-blue-500" : "text-muted-foreground/60")} />
                      <span>{timeEstimate ? `${timeEstimate}m` : "Estimate"}</span>
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="p-3 w-44 bg-popover border border-border text-popover-foreground rounded-lg shadow-xl" align="start">
                    <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Estimate (mins)</div>
                    <Input
                      type="number"
                      value={timeEstimate || ""}
                      onChange={(e) => setTimeEstimate(parseInt(e.target.value) || undefined)}
                      placeholder="e.g. 60"
                      className="h-8 text-xs bg-background border-border text-foreground focus-visible:ring-primary/20 placeholder:text-muted-foreground/60"
                    />
                  </PopoverContent>
                </Popover>

                {/* Clarity Toggle Pill */}
                <button
                  type="button"
                  onClick={() => setShowClarity(!showClarity)}
                  className={cn(
                    "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all text-xs font-medium focus:outline-none focus:ring-0 bg-secondary hover:bg-secondary/80 cursor-pointer",
                    showClarity ? "text-indigo-400 font-semibold" : "text-muted-foreground"
                  )}
                >
                  <Target className="size-3.5" />
                  <span>Clarity</span>
                </button>
              </>
            )}

            {/* Triple Dot Menu Popover */}
            <Popover>
              <PopoverTrigger asChild>
                <button className="size-7 flex items-center justify-center rounded-full bg-secondary hover:bg-secondary/80 text-muted-foreground hover:text-foreground transition-all focus:outline-none focus:ring-0 cursor-pointer">
                  <span className="text-[10px] leading-none mb-1.5 font-bold">...</span>
                </button>
              </PopoverTrigger>
              <PopoverContent className="p-1 w-44 bg-popover border border-border text-popover-foreground rounded-lg shadow-xl" align="start">
                {type === "task" ? (
                  <>
                    <button
                      onClick={() => setShowClarity(!showClarity)}
                      className="w-full flex items-center justify-between px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors text-left cursor-pointer"
                    >
                      <span>Toggle Clarity Fields</span>
                      <span className="text-[9px] text-muted-foreground/50">{showClarity ? "ON" : "OFF"}</span>
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => setShowAgenda(!showAgenda)}
                      className="w-full flex items-center justify-between px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors text-left cursor-pointer"
                    >
                      <span>Toggle Agenda Field</span>
                      <span className="text-[9px] text-muted-foreground/50">{showAgenda ? "ON" : "OFF"}</span>
                    </button>
                  </>
                )}
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Action Row Footer */}
        <div className="px-6 py-4 bg-background flex items-center justify-between select-none">
          {/* Left: Attachment trigger */}
          <button
            type="button"
            className="p-2 rounded-full bg-secondary hover:bg-secondary/80 text-muted-foreground hover:text-foreground transition-all focus:outline-none cursor-pointer"
            title="Attach file"
            onClick={() => {
              if (triggerUploadRef.current) {
                triggerUploadRef.current();
              } else {
                toast.error("File upload is not ready");
              }
            }}
          >
            <Paperclip className="size-3.5" />
          </button>

          {/* Right: Switch and Create buttons */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Switch
                id="footer-create-subtask"
                checked={createMore}
                onCheckedChange={setCreateMore}
                className="scale-75 data-[state=checked]:bg-primary"
              />
              <Label htmlFor="footer-create-subtask" className="text-xs text-muted-foreground cursor-pointer select-none">
                Create subtask
              </Label>
            </div>

            <Button
              type="button"
              onClick={() => handleSubmit()}
              className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-md px-4 h-8 font-semibold text-xs transition-all shadow-md active:scale-95 border-none cursor-pointer"
              disabled={!title.trim()}
            >
              {mode === "edit" ? "Save changes" : `Create ${type === 'task' ? 'task' : 'event'}`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}