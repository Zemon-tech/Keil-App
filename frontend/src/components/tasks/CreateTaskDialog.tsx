import { useState, useEffect, useRef, useMemo } from "react";
import { format, addDays, nextMonday, startOfToday, startOfDay, parseISO } from "date-fns";
import {
  CalendarIcon,
  Flag,
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

// ─── Markdown / Tiptap Parsing Helpers ──────────────────────────────────────────

function getPlainTextFromTiptapJson(jsonStr: string): string {
  if (!jsonStr) return "";
  try {
    const json = JSON.parse(jsonStr);
    if (!json || typeof json !== "object") return jsonStr;
    
    let text = "";
    const traverse = (node: any) => {
      if (node.type === "text" && node.text) {
        text += node.text;
      }
      if (Array.isArray(node.content)) {
        node.content.forEach(traverse);
      }
      if (["paragraph", "heading", "listItem", "blockquote", "codeBlock"].includes(node.type)) {
        text += "\n";
      }
    };
    
    if (json.type === "doc" && Array.isArray(json.content)) {
      json.content.forEach(traverse);
    } else {
      traverse(json);
    }
    return text;
  } catch (e) {
    return jsonStr;
  }
}

export function parseObjectiveAndSuccessCriteria(descJsonOrText: string) {
  const text = getPlainTextFromTiptapJson(descJsonOrText);
  const lines = text.split("\n");
  let currentSection: "description" | "objective" | "success" = "description";
  const objectiveLines: string[] = [];
  const successLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim().toLowerCase();
    
    if (trimmed.match(/^(#+\s+)?objective(s)?$/) || trimmed === "objective:") {
      currentSection = "objective";
      continue;
    }
    
    if (trimmed.match(/^(#+\s+)?success\s+criteria$/) || trimmed === "success criteria:") {
      currentSection = "success";
      continue;
    }
    
    if (trimmed.match(/^(#+\s+)?(description|agenda|notes)$/) || trimmed === "description:") {
      currentSection = "description";
      continue;
    }

    if (currentSection === "objective") {
      objectiveLines.push(line);
    } else if (currentSection === "success") {
      successLines.push(line);
    }
  }

  const cleanSectionText = (linesArr: string[]) => {
    return linesArr
      .map(l => l.trim())
      .map(l => l.replace(/^[•\-\*·]\s*/, ""))
      .filter(l => l !== "")
      .join("\n");
  };

  return {
    objective: cleanSectionText(objectiveLines),
    successCriteria: cleanSectionText(successLines),
  };
}


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

  const parentTask = useMemo(() => {
    const parentId = parentTaskId || initialValues?.parent_task_id;
    if (!parentId) return undefined;
    return orgTasks.find((t) => t.id === parentId);
  }, [parentTaskId, initialValues?.parent_task_id, orgTasks]);

  const calendarDisabledDays = useMemo(() => {
    if (!parentTask) return undefined;

    return (day: Date) => {
      if (!parentTask.start_date || !parentTask.due_date) {
        return true;
      }

      const pStart = startOfDay(new Date(parentTask.start_date));
      const pDue = startOfDay(new Date(parentTask.due_date));
      const dDay = startOfDay(day);

      return dDay < pStart || dDay > pDue;
    };
  }, [parentTask]);

  const resolvedUsers = useMemo<SimpleAssigneeOption[]>(() => {
    if (allUsers && allUsers.length > 0) return allUsers;
    return spaceMembers.map(m => ({
      id: m.user_id,
      name: m.email.split('@')[0],
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
  const [location, setLocation] = useState("");
  const [agenda, setAgenda] = useState("");

  // Collapsible states
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
  const [eventType, setEventType] = useState<string>("feature");
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

  // Sync category default when type changes
  useEffect(() => {
    setEventType(type === "task" ? "feature" : "meeting");
  }, [type]);

  // Reset description when switching to event or task if blank
  useEffect(() => {
    if (mode === "create") {
      setDescription("");
    }
  }, [type, mode]);

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
      if (lowerTitle.includes(`@${user.name.toLowerCase()}`)) {
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
      setPriority((initialValues.priority as any) ?? "medium");
      setAssigneeIds(((initialValues as any).assignees ?? []).map((a: any) => a.id));
      setLocation(initialValues.location ?? "");
      setIsAllDay(initialValues.is_all_day ?? true);
      setEventType(initialValues.event_type ?? (initialValues.type === "event" ? "meeting" : "feature"));
      setStatus((initialValues.status as AnyStatus) ?? (initialValues.type === "event" ? "confirmed" : "todo"));

      const desc = initialValues.description ?? "";
      let initialDescVal = desc;

      const agendaIndex = initialDescVal.indexOf("\n\nAgenda:\n");
      if (agendaIndex !== -1) {
        setDescription(initialDescVal.substring(0, agendaIndex));
        setAgenda(initialDescVal.substring(agendaIndex + 10));
      } else {
        setDescription(initialDescVal);
        setAgenda("");
      }

      const start = (initialValues as any).start_date;
      const end = (initialValues as any).due_date;
      if (start) setDate(parseISO(start));
      if (end) {
        setEndDate(parseISO(end));
      }

      setStoryPoints(initialValues.story_points || undefined);
      setTimeEstimate((initialValues as any).time_estimate || undefined);
      setGuests(initialValues.guests ?? []);
      setCreateMeetLink(!!initialValues.meet_link || !!(initialValues as any).create_meet_link);
      setContext(initialValues.context ?? []);
    } else if (open && mode === "create") {
      setTitle("");
      setType("task");
      setStatus("todo");
      setDate(undefined);
      setEndDate(undefined);
      setPriority("medium");
      setAssigneeIds([]);
      setDescription("");
      setLocation("");
      setAgenda("");
      setStoryPoints(undefined);
      setTimeEstimate(undefined);
      setShowCommandMenu(false);
      setIsAllDay(true);
      setEventType("feature");
      setCreateMeetLink(false);
      setGuests([]);
      setGuestInput("");
      setContext([]);
    }
  }, [open, mode, initialValues]);

  // Sync end date if not set for events
  useEffect(() => {
    if (type === 'event' && date && !endDate) {
      setEndDate(addDays(date, 0));
    }
  }, [type, date]);

  // ── Submission ─────────────────────────────────────────────────────────────
  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!title.trim()) return;

    if (parentTask && (date || endDate)) {
      if (!parentTask.start_date || !parentTask.due_date) {
        toast.error("Parent task is not scheduled", {
          description: "Parent task must have start and due dates before scheduling subtasks.",
        });
        return;
      }

      const pStart = new Date(parentTask.start_date);
      const pDue = new Date(parentTask.due_date);

      if (date) {
        const sStart = isAllDay ? startOfDay(date) : date;
        if (sStart < pStart || sStart > pDue) {
          toast.error("Subtask start date is out of bounds", {
            description: "Subtask must be scheduled between the start and due date of the parent task.",
          });
          return;
        }
      }

      if (endDate) {
        const sEnd = isAllDay ? startOfDay(addDays(endDate, 1)) : endDate;
        if (sEnd < pStart || sEnd > pDue) {
          toast.error("Subtask end date is out of bounds", {
            description: "Subtask must be scheduled between the start and due date of the parent task.",
          });
          return;
        }
      }
    }

    if (mode === "create" && date) {
      const now = new Date();
      if (isAllDay) {
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
        if (date < now) {
          toast.error("Cannot create in the past", {
            description: "Please select a future time slot.",
          });
          return;
        }
      }
    }

    const computedDueDate = (() => {
      if (isAllDay && endDate) {
        return startOfDay(endDate).toISOString();
      }
      return endDate?.toISOString() || (type === 'task' ? date?.toISOString() : undefined);
    })();

    const finalDescription = description.trim() + (type === "event" && agenda.trim() ? `\n\nAgenda:\n${agenda.trim()}` : "");

    // Parse Objectives and Success Criteria from Tiptap Markdown Blocks
    const parsedClarity = type === "task" 
      ? parseObjectiveAndSuccessCriteria(description)
      : { objective: "", successCriteria: "" };

    const input: CreateTaskInput = {
      title: title.trim(),
      type,
      priority: priority as any,
      description: finalDescription || undefined,
      objective: parsedClarity.objective || undefined,
      success_criteria: parsedClarity.successCriteria || undefined,
      location: type === "event" ? location.trim() || undefined : undefined,
      start_date: isAllDay && date ? startOfDay(date).toISOString() : date?.toISOString(),
      due_date: computedDueDate,
      is_all_day: isAllDay,
      assignee_ids: assigneeIds.length > 0 ? assigneeIds : undefined,
      status: status as any,
      parent_task_id: parentTaskId,
      story_points: type === "task" ? storyPoints : undefined,
      time_estimate: type === "task" ? timeEstimate : undefined,
      event_type: eventType,
      create_meet_link: type === "event" ? createMeetLink : false,
      guests: type === "event" && guests.length > 0 ? guests : undefined,
      context: type === "task" && context.length > 0 ? context : undefined,
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
        "bg-background border border-border p-0 overflow-hidden shadow-2xl transition-all duration-200 ease-out [&>button]:hidden text-foreground flex flex-col w-full",
        isMaximized ? "sm:max-w-[900px] h-[650px] rounded-xl" : "sm:max-w-[900px] h-[450px] rounded-xl"
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

            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center gap-0.5 text-foreground/80 hover:text-foreground transition-colors font-semibold focus:outline-none cursor-pointer">
                <span>{type === "task" ? "New task" : "New event"}</span>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="bg-popover border border-border text-popover-foreground font-medium">
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
              className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-all duration-150 focus:outline-none cursor-pointer active:scale-95"
              title={isMaximized ? "Restore window" : "Expand window"}
            >
              {isMaximized ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
            </button>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-all duration-150 focus:outline-none cursor-pointer active:scale-95"
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
            {/* Title input */}
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

            {/* Divider */}
            <div className="border-b border-border/30 my-2" />

            {/* Description Editor (contains Objective, Success Criteria headings for Tasks; acts as Agenda/Details for Events) */}
            <div className="w-full">
              <TaskDescriptionEditor
                value={description}
                onChange={setDescription}
                onEnterSubmit={handleSubmit}
                placeholder={type === "task" ? "Add description, objective..." : "Event details & agenda..."}
                members={spaceMembers}
                allTasks={orgTasks}
                pages={pages}
              />
            </div>

            {/* Event Specific Canvas Details */}
            {type === "event" && (
              <div className="space-y-3 pt-2 border-t border-border/40 animate-in fade-in duration-150">
                {/* Location Input */}
                <div className="flex items-center gap-2.5 bg-background border border-border rounded-lg px-3 py-1.5 focus-within:border-muted-foreground/50 transition-colors">
                  <MapPin className="size-3.5 text-muted-foreground shrink-0" />
                  <input
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="Add location..."
                    className="w-full text-xs bg-transparent border-0 p-0 text-muted-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-0"
                  />
                </div>

                {/* Google Meet Toggle Block */}
                <div className="flex items-center justify-between rounded-lg border border-border bg-muted/10 px-3.5 py-2">
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

                {/* Agenda Details */}
                <div className="flex flex-col gap-1.5">
                  <Label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Agenda Details</Label>
                  <textarea
                    value={agenda}
                    onChange={(e) => setAgenda(e.target.value)}
                    placeholder="Agenda notes..."
                    className="w-full text-xs bg-background border border-border focus-within:border-muted-foreground/50 rounded-lg p-3 text-muted-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-0 resize-none min-h-[80px] custom-scrollbar"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Metadata Inline Pills Row (Tucked above action footer) */}
          <div className="pt-3 pb-1 flex flex-wrap gap-2 items-center select-none overflow-x-auto no-scrollbar border-t border-border/40 mt-1">

            {/* Status Pill */}
            <Popover>
              <PopoverTrigger asChild>
                <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all duration-150 text-xs font-medium focus:outline-none focus:ring-0 bg-secondary hover:bg-secondary/80 text-secondary-foreground capitalize cursor-pointer active:scale-95">
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
                    "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all duration-150 text-xs font-medium focus:outline-none focus:ring-0 bg-secondary hover:bg-secondary/80 cursor-pointer active:scale-95",
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
                  "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all duration-150 text-xs font-medium focus:outline-none focus:ring-0 bg-secondary hover:bg-secondary/80 cursor-pointer active:scale-95",
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
                    disabled={calendarDisabledDays}
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

            {/* Assignees Pill (Task Only) */}
            {type === "task" && (
              <Popover>
                <PopoverTrigger asChild>
                  <button className={cn(
                    "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all duration-150 text-xs font-medium focus:outline-none focus:ring-0 bg-secondary hover:bg-secondary/80 cursor-pointer active:scale-95",
                    assigneeIds.length > 0 ? "text-secondary-foreground font-semibold" : "text-muted-foreground"
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
                        <span className="text-xs text-secondary-foreground font-semibold">
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
                  <Command className="bg-transparent font-sans">
                    <CommandInput placeholder="Assign to..." className="border-none focus:ring-0 text-foreground placeholder:text-muted-foreground/50 text-xs h-9" />
                    <CommandList className="max-h-56 custom-scrollbar">
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
                              <span className="text-xs font-semibold text-foreground">{user.name}</span>
                            </div>
                            {assigneeIds.includes(user.id) && <CheckCircle2 className="size-4 text-indigo-500" />}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            )}

            {/* Attendees Pill (Event Only - Merged Assignees & Guests Invite) */}
            {type === "event" && (
              <Popover>
                <PopoverTrigger asChild>
                  <button className={cn(
                    "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all duration-150 text-xs font-medium focus:outline-none focus:ring-0 bg-secondary hover:bg-secondary/80 cursor-pointer active:scale-95",
                    (assigneeIds.length > 0 || guests.length > 0) ? "text-indigo-400 font-semibold" : "text-muted-foreground"
                  )}>
                    <Users className="size-3.5" />
                    <span>
                      {assigneeIds.length + guests.length > 0
                        ? `${assigneeIds.length + guests.length} Attendees`
                        : "Attendees"}
                    </span>
                  </button>
                </PopoverTrigger>
                <PopoverContent className="p-0 w-80 bg-popover border border-border text-popover-foreground overflow-hidden rounded-lg shadow-xl" align="start">
                  <Command className="bg-transparent font-sans">
                    <CommandInput
                      placeholder="Search members or paste email..."
                      className="border-none focus:ring-0 text-foreground placeholder:text-muted-foreground/50 h-9 text-xs"
                      value={guestInput}
                      onValueChange={setGuestInput}
                    />
                    <CommandList className="max-h-64 custom-scrollbar">
                      <CommandEmpty>No members found.</CommandEmpty>
                      
                      {/* If the input looks like an email, show invite guest option */}
                      {guestInput.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestInput.trim()) && (
                        <CommandGroup heading="Invite Guest">
                          <CommandItem
                            onSelect={() => {
                              handleAddGuest();
                            }}
                            className="flex items-center gap-2 px-3 py-2 cursor-pointer text-indigo-400 hover:text-indigo-500 font-medium hover:bg-accent focus:bg-accent"
                          >
                            <Video className="size-4 shrink-0" />
                            <span className="truncate">Invite "{guestInput}" to Google Meet</span>
                          </CommandItem>
                        </CommandGroup>
                      )}
                      
                      <CommandGroup heading="Workspace Members">
                        {resolvedUsers.map((user) => {
                          const isAssigned = assigneeIds.includes(user.id);
                          return (
                            <CommandItem
                              key={user.id}
                              onSelect={() => {
                                setAssigneeIds(prev =>
                                  isAssigned ? prev.filter(id => id !== user.id) : [...prev, user.id]
                                );
                              }}
                              className="flex items-center justify-between px-3 py-2 cursor-pointer text-muted-foreground aria-selected:bg-accent aria-selected:text-accent-foreground"
                            >
                              <div className="flex items-center gap-2">
                                <Avatar className="size-5">
                                  <AvatarImage src={getOptimizedImageUrl(user.avatarUrl, { width: 40, height: 40 })} />
                                  <AvatarFallback className="bg-muted text-muted-foreground font-bold text-[9px]">{user.name[0].toUpperCase()}</AvatarFallback>
                                </Avatar>
                                <span className="text-xs font-semibold text-foreground">{user.name}</span>
                              </div>
                              {isAssigned && <CheckCircle2 className="size-3.5 text-indigo-500" />}
                            </CommandItem>
                          );
                        })}
                      </CommandGroup>
                      
                      {guests.length > 0 && (
                        <CommandGroup heading="Invited Guests">
                          {guests.map((email) => (
                            <div
                              key={email}
                              className="flex items-center justify-between px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent/40"
                            >
                              <span className="truncate max-w-[200px]">{email}</span>
                              <button
                                type="button"
                                onClick={() => handleRemoveGuest(email)}
                                className="text-muted-foreground hover:text-foreground hover:bg-secondary rounded p-0.5"
                              >
                                <X className="size-3" />
                              </button>
                            </div>
                          ))}
                        </CommandGroup>
                      )}
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            )}

            {/* Category Pill (eventType mapping) */}
            <Popover>
              <PopoverTrigger asChild>
                <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-secondary hover:bg-secondary/80 transition-all duration-150 text-xs font-medium text-secondary-foreground capitalize focus:outline-none focus:ring-0 cursor-pointer active:scale-95">
                  <Layout className="size-3.5 text-muted-foreground/60" />
                  <span>{eventType || (type === "task" ? "Feature" : "Meeting")}</span>
                </button>
              </PopoverTrigger>
              <PopoverContent className="p-1 w-36 bg-popover border border-border text-popover-foreground rounded-lg shadow-xl" align="start">
                {(type === "task"
                  ? ["feature", "bug", "chore", "docs", "design", "refactor"]
                  : ["meeting", "call", "birthday", "workshop", "other"]
                ).map((cat) => (
                  <PopoverClose asChild key={cat}>
                    <button
                      onClick={() => setEventType(cat)}
                      className="w-full flex items-center px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors capitalize text-left cursor-pointer"
                    >
                      {cat}
                    </button>
                  </PopoverClose>
                ))}
              </PopoverContent>
            </Popover>

            {/* Story Points Pill (Task Only) */}
            {type === "task" && (
              <Popover>
                <PopoverTrigger asChild>
                  <button className={cn(
                    "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all duration-150 text-xs font-medium focus:outline-none focus:ring-0 bg-secondary hover:bg-secondary/80 cursor-pointer active:scale-95",
                    storyPoints ? "text-secondary-foreground font-semibold" : "text-muted-foreground"
                  )}>
                    <Zap className={cn("size-3.5", storyPoints ? "text-yellow-500" : "text-muted-foreground/60")} />
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
            )}

            {/* Time Estimate Pill (Task Only) */}
            {type === "task" && (
              <Popover>
                <PopoverTrigger asChild>
                  <button className={cn(
                    "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all duration-150 text-xs font-medium focus:outline-none focus:ring-0 bg-secondary hover:bg-secondary/80 cursor-pointer active:scale-95",
                    timeEstimate ? "text-secondary-foreground font-semibold" : "text-muted-foreground"
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
                    className="h-8 text-xs bg-background border-border text-foreground focus-visible:ring-primary/20 placeholder:text-muted-foreground/60 font-sans"
                  />
                </PopoverContent>
              </Popover>
            )}

          </div>
        </div>

        {/* Action Row Footer */}
        <div className="px-6 py-4 bg-background flex items-center justify-between select-none border-t border-border/40">
          {/* Left: Attachment trigger with Popover for Context Assets */}
          {type === "task" ? (
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    "p-2 rounded-full transition-all duration-150 focus:outline-none cursor-pointer active:scale-[0.88]",
                    context.length > 0
                      ? "bg-indigo-500/10 text-indigo-500 hover:bg-indigo-500/20"
                      : "bg-secondary hover:bg-secondary/80 text-muted-foreground hover:text-foreground"
                  )}
                  title="Add files and links"
                >
                  <Paperclip className="size-3.5" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="p-3 w-80 bg-popover border border-border text-popover-foreground rounded-lg shadow-xl" align="start" side="top">
                <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Context Assets</div>
                <TaskContextSection
                  task={{ context, space_id: selectedSpaceId ?? activeSpaceId ?? undefined }}
                  onChangeContext={setContext}
                  spaceId={selectedSpaceId ?? activeSpaceId ?? undefined}
                  triggerUploadRef={triggerUploadRef}
                />
              </PopoverContent>
            </Popover>
          ) : (
            <div className="w-8 h-8" />
          )}

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
              className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-md px-4 h-8 font-semibold text-xs transition-all duration-150 shadow-md active:scale-95 border-none cursor-pointer"
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