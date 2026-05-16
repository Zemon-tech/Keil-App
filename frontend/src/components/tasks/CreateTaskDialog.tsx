import { useState, useEffect } from "react";
import { format, addDays, nextMonday, startOfToday, parseISO } from "date-fns";
import {
  CalendarIcon,
  Flag,
  Plus,
  Target,
  MapPin,
  Users,
  CheckCircle2,
  Clock,
  Timer,
  Zap,
  Layout
} from "lucide-react";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "sonner";

import type { TaskDTO, CreateTaskInput } from "@/hooks/api/useTasks";
import { useCreateOrgTask, useUpdateOrgTask } from "@/hooks/api/useTasks";
import { useCreatePersonalTask, useUpdatePersonalTask } from "@/hooks/api/usePersonalTasks";
import { useAppContext } from "@/contexts/AppContext";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

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
  isPersonalMode?: boolean;
}

const PRIORITY_LEVELS = [
  { label: "Low", value: "low", color: "text-zinc-400 bg-zinc-400/10", icon: Flag },
  { label: "Medium", value: "medium", color: "text-yellow-400 bg-yellow-400/10", icon: Flag },
  { label: "High", value: "high", color: "text-orange-400 bg-orange-400/10", icon: Flag },
  { label: "Urgent", value: "urgent", color: "text-red-400 bg-red-400/10", icon: Flag },
] as const;

export function CreateTaskDialog({
  open,
  onOpenChange,
  onTaskCreated,
  allUsers = [],
  mode = "create",
  taskId,
  initialValues,
  onTaskUpdated,
  parentTaskId,
  parentTaskTitle,
  isPersonalMode = false,
}: CreateTaskDialogProps) {
  const { activeOrgId, activeSpaceId } = useAppContext();
  const createOrgTask = useCreateOrgTask(activeOrgId, activeSpaceId);
  const updateOrgTask = useUpdateOrgTask(activeOrgId, activeSpaceId);
  const createPersonalTask = useCreatePersonalTask();
  const updatePersonalTask = useUpdatePersonalTask();

  // ── Form State ─────────────────────────────────────────────────────────────
  const [title, setTitle] = useState("");
  const [type, setType] = useState<"task" | "event">("task");

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

  // Collapsible states
  const [showDetails, setShowDetails] = useState(false);
  const [showClarity, setShowClarity] = useState(false);
  const [showAgenda, setShowAgenda] = useState(false);
  const [showCommandMenu, setShowCommandMenu] = useState(false);

  // New metadata fields
  const [storyPoints, setStoryPoints] = useState<number | undefined>(undefined);
  const [timeEstimate, setTimeEstimate] = useState<number | undefined>(undefined); // in minutes
  const [isAllDay, setIsAllDay] = useState(true);
  const [eventType, setEventType] = useState<string>("meeting");

  // ── Smart Parsing ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (mode === "edit" || !open) return;

    const lowerTitle = title.toLowerCase();

    // Detect Type
    if (lowerTitle.match(/\b(meeting|call|sync|lunch|coffee|event|workshop)\b/)) {
      setType("event");
    }

    // Detect Priority
    if (lowerTitle.includes("!urgent") || lowerTitle.includes("urgent")) setPriority("urgent");
    else if (lowerTitle.includes("!high") || lowerTitle.includes("high")) setPriority("high");
    else if (lowerTitle.includes("!low") || lowerTitle.includes("low")) setPriority("low");

    // Detect Date
    if (lowerTitle.includes("today")) setDate(startOfToday());
    else if (lowerTitle.includes("tomorrow")) setDate(addDays(startOfToday(), 1));
    else if (lowerTitle.includes("monday")) setDate(nextMonday(startOfToday()));

    // Detect Assignees (simple @ match)
    allUsers.forEach(user => {
      if (lowerTitle.includes(`@${user.name.toLowerCase().replace(/\s/g, "")}`)) {
        if (!assigneeIds.includes(user.id)) {
          setAssigneeIds(prev => [...prev, user.id]);
        }
      }
    });
  }, [title, allUsers, mode, open]);

  // ── Pre-fill Mode ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (open && initialValues) {
      setTitle(initialValues.title ?? "");
      setType((initialValues.type as "task" | "event") ?? "task");
      setDescription(initialValues.description ?? "");
      setObjective(initialValues.objective ?? "");
      setSuccessCriteria(initialValues.success_criteria ?? "");
      setPriority((initialValues.priority as any) ?? "medium");
      setAssigneeIds(((initialValues as any).assignees ?? []).map((a: any) => a.id));
      setLocation(initialValues.location ?? "");
      setIsAllDay(initialValues.is_all_day ?? true);
      setEventType(initialValues.event_type ?? "meeting");

      const start = (initialValues as any).start_date;
      const end = (initialValues as any).due_date;
      if (start) setDate(parseISO(start));
      if (end) setEndDate(parseISO(end));

      // Auto-expand if content exists
      if (initialValues.description) setShowDetails(true);
      if (initialValues.objective || initialValues.success_criteria) setShowClarity(true);

      setStoryPoints(initialValues.story_points || undefined);
      setTimeEstimate((initialValues as any).time_estimate || undefined);
    } else if (open && mode === "create") {
      // Reset
      setTitle("");
      setType("task");
      setDate(undefined);
      setEndDate(undefined);
      setPriority("medium");
      setAssigneeIds([]);
      setDescription("");
      setObjective("");
      setSuccessCriteria("");
      setLocation("");
      setShowDetails(false);
      setShowClarity(false);
      setShowAgenda(false);
      setStoryPoints(undefined);
      setTimeEstimate(undefined);
      setShowCommandMenu(false);
      setIsAllDay(true);
      setEventType("meeting");
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

    const input: CreateTaskInput = {
      title: title.trim(),
      type,
      priority: priority as any,
      description: description.trim() || undefined,
      objective: objective.trim() || undefined,
      success_criteria: successCriteria.trim() || undefined,
      location: location.trim() || undefined,
      start_date: date?.toISOString(),
      due_date: endDate?.toISOString() || (type === 'task' ? date?.toISOString() : undefined),
      assignee_ids: assigneeIds.length > 0 ? assigneeIds : undefined,
      status: (type === 'task' ? 'todo' : 'confirmed') as any,
      parent_task_id: parentTaskId,
      story_points: storyPoints,
      time_estimate: timeEstimate,
      is_all_day: isAllDay,
      event_type: type === 'event' ? eventType : undefined,
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
      if (isPersonalMode) {
          const personalUpdate = {
          title: input.title,
          description: input.description,
          priority: input.priority as any,
          status: 'todo' as any,
          due_date: input.due_date,
          story_points: input.story_points,
        };
        updatePersonalTask.mutate({ id: taskId, updates: personalUpdate }, options);
      } else {
        updateOrgTask.mutate({ id: taskId, updates: input }, options);
      }
    } else {
      if (isPersonalMode) {
          const personalCreate = {
          title: input.title,
          description: input.description,
          priority: input.priority as any,
          status: 'todo' as any,
          due_date: input.due_date,
          story_points: input.story_points,
        };
        createPersonalTask.mutate(personalCreate, options);
      } else {
        createOrgTask.mutate(input, options);
      }
    }
  };

  const currentPriority = PRIORITY_LEVELS.find(p => p.value === priority) || PRIORITY_LEVELS[1];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[600px] bg-background border-border p-0 overflow-hidden shadow-2xl [&>button]:hidden">
        <DialogHeader className="p-6 pb-2 relative">
          <div className="flex items-center justify-between mb-4">
            <div className="flex bg-muted/50 rounded-lg p-1">
              <button
                onClick={() => setType("task")}
                className={cn(
                  "px-3 py-1 text-xs font-medium rounded-md transition-all",
                  type === "task" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                Task
              </button>
              <button
                onClick={() => setType("event")}
                className={cn(
                  "px-3 py-1 text-xs font-medium rounded-md transition-all",
                  type === "event" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                Event
              </button>
            </div>
            
            <div className="flex items-center gap-3">
              {/* Top Right Actions: All Day & Date */}
              <div className="flex items-center gap-3 pr-2">
                <div className="flex items-center gap-2 px-2 py-1 rounded-full bg-muted/30 border border-border/50">
                  <Switch id="header-all-day" checked={isAllDay} onCheckedChange={setIsAllDay} className="scale-75" />
                  <Label htmlFor="header-all-day" className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider cursor-pointer pr-1">All Day</Label>
                </div>

                <Popover>
                  <PopoverTrigger asChild>
                    <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 hover:bg-primary/20 transition-colors text-[11px] font-bold text-primary">
                      <CalendarIcon className="size-3.5" />
                      {date ? (
                        isAllDay 
                          ? format(date, "MMM d, yyyy") 
                          : format(date, "MMM d, h:mm a")
                      ) : "Set date"}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="p-0 w-auto bg-background border-border shadow-xl" align="end">
                    <div className="flex flex-col">
                      <Calendar
                        mode="single"
                        selected={date}
                        onSelect={(newDate) => {
                          if (newDate && date && !isAllDay) {
                            newDate.setHours(date.getHours(), date.getMinutes());
                          }
                          setDate(newDate);
                        }}
                        initialFocus
                        className="bg-background"
                      />
                      {!isAllDay && (
                        <div className="p-3 border-t border-border flex items-center justify-between gap-3 bg-muted/20">
                          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                            <Clock className="size-3.5" />
                            <span>Time</span>
                          </div>
                          <Input
                            type="time"
                            className="h-8 w-[100px] text-xs bg-background border-border focus-visible:ring-primary/20"
                            value={date ? format(date, "HH:mm") : ""}
                            onChange={(e) => {
                              const [h, m] = e.target.value.split(':');
                              const newDate = date ? new Date(date) : new Date();
                              newDate.setHours(parseInt(h), parseInt(m));
                              setDate(newDate);
                            }}
                          />
                        </div>
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>

              {parentTaskId && (
                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-[10px] uppercase tracking-wider px-2 py-0">
                  Subtask of {parentTaskTitle}
                </Badge>
              )}
            </div>
          </div>
          <div className="relative mt-2 px-1">
            <Input
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
              placeholder={type === "task" ? "What needs to be done?" : "What is this event?"}
              className="text-2xl font-semibold border-none bg-transparent px-3 py-3 h-auto focus-visible:ring-0 placeholder:text-muted-foreground/50"
            />

            {showCommandMenu && (
              <div className="absolute left-3 top-full z-50 w-64 mt-1 bg-background border border-border rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                <Command className="bg-transparent">
                  <CommandList>
                    <CommandGroup heading="Quick Actions">
                      <CommandItem onSelect={() => {
                        // Assuming you have access to the current user's ID
                        // For now, I'll assume allUsers has the current user or we can find them
                        // But since I don't have the current user ID directly in this component's props, 
                        // I'll leave it for now or just add the UI.
                        setPriority("urgent");
                        setShowCommandMenu(false);
                      }} className="gap-2">
                        <Flag className="size-3.5 text-red-500" /> Set Urgent Priority
                      </CommandItem>
                      <CommandItem onSelect={() => { setDate(startOfToday()); setShowCommandMenu(false); }} className="gap-2">
                        <CalendarIcon className="size-3.5 text-blue-500" /> Due Today
                      </CommandItem>
                      <CommandItem onSelect={() => { setType("event"); setShowCommandMenu(false); }} className="gap-2">
                        <Clock className="size-3.5 text-purple-500" /> Convert to Event
                      </CommandItem>
                    </CommandGroup>
                  </CommandList>
                </Command>
              </div>
            )}
          </div>
        </DialogHeader>

        <div className="px-6 pb-6 space-y-6">
          {/* Metadata Chips */}
          <div className="flex flex-wrap gap-2 items-center">
            {/* Event Type (Event Only) */}
            {type === "event" && (
              <Popover>
                <PopoverTrigger asChild>
                  <button className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-muted/50 border border-border hover:border-accent transition-colors text-xs text-muted-foreground capitalize">
                    <Layout className="size-3.5" />
                    {eventType}
                  </button>
                </PopoverTrigger>
                <PopoverContent className="p-1 w-32 bg-background border-border">
                  {["meeting", "call", "birthday", "workshop", "other"].map((t) => (
                    <button
                      key={t}
                      onClick={() => setEventType(t)}
                      className="w-full flex items-center px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors capitalize"
                    >
                      {t}
                    </button>
                  ))}
                </PopoverContent>
              </Popover>
            )}
            {type === "event" && (
              <Popover>
                <PopoverTrigger asChild>
                  <button className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-muted/50 border border-border hover:border-accent transition-colors text-xs text-muted-foreground">
                    <Clock className="size-3.5" />
                    {endDate ? format(endDate, "HH:mm") : "End time"}
                  </button>
                </PopoverTrigger>
                <PopoverContent className="p-4 w-48 bg-background border-border">
                  <div className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">End Time</div>
                  <Input
                    type="time"
                    className="bg-muted/50 border-border"
                    onChange={(e) => {
                      const [h, m] = e.target.value.split(':');
                      const d = date ? new Date(date) : new Date();
                      d.setHours(parseInt(h), parseInt(m));
                      setEndDate(d);
                    }}
                  />
                </PopoverContent>
              </Popover>
            )}

            {/* Priority (Task Only) */}
            {type === "task" && (
              <>
                <Popover>
                  <PopoverTrigger asChild>
                    <button className={cn(
                      "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border transition-colors text-xs",
                      currentPriority.color,
                      "border-transparent hover:border-current"
                    )}>
                      <currentPriority.icon className="size-3.5" />
                      {currentPriority.label}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="p-1 w-32 bg-background border-border">
                    {PRIORITY_LEVELS.map((p) => (
                      <button
                        key={p.value}
                        onClick={() => setPriority(p.value)}
                        className="w-full flex items-center gap-2 px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors"
                      >
                        <p.icon className={cn("size-3", p.color.split(' ')[0])} />
                        {p.label}
                      </button>
                    ))}
                  </PopoverContent>
                </Popover>

                {/* Story Points */}
                <Popover>
                  <PopoverTrigger asChild>
                    <button className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-muted/50 border border-border hover:border-accent transition-colors text-xs text-muted-foreground">
                      <Zap className="size-3.5 text-yellow-500" />
                      {storyPoints ? `${storyPoints} pts` : "Points"}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="p-2 w-32 bg-background border-border">
                    <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">Story Points</div>
                    <div className="grid grid-cols-3 gap-1">
                      {[1, 2, 3, 5, 8].map(pts => (
                        <button
                          key={pts}
                          onClick={() => setStoryPoints(pts)}
                          className={cn(
                            "h-7 rounded flex items-center justify-center text-xs transition-colors",
                            storyPoints === pts ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                          )}
                        >
                          {pts}
                        </button>
                      ))}
                      <button
                        onClick={() => setStoryPoints(undefined)}
                        className="h-7 rounded flex items-center justify-center text-xs hover:bg-muted text-muted-foreground"
                      >
                        -
                      </button>
                    </div>
                  </PopoverContent>
                </Popover>

                {/* Time Estimate */}
                <Popover>
                  <PopoverTrigger asChild>
                    <button className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-muted/50 border border-border hover:border-accent transition-colors text-xs text-muted-foreground">
                      <Timer className="size-3.5 text-blue-500" />
                      {timeEstimate ? `${timeEstimate}m` : "Estimate"}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="p-3 w-40 bg-background border-border">
                    <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Estimate (mins)</div>
                    <Input
                      type="number"
                      value={timeEstimate || ""}
                      onChange={(e) => setTimeEstimate(parseInt(e.target.value) || undefined)}
                      placeholder="e.g. 60"
                      className="h-8 text-xs bg-muted/30"
                    />
                  </PopoverContent>
                </Popover>
              </>
            )}

            {/* Assignee */}
            <Popover>
              <PopoverTrigger asChild>
                <button className="inline-flex items-center gap-1.5 px-1 py-1 rounded-full bg-muted/50 border border-border hover:border-accent transition-colors text-xs text-muted-foreground min-w-[32px]">
                  {assigneeIds.length > 0 ? (
                    <div className="flex -space-x-1 ml-1">
                      {assigneeIds.map(id => {
                        const user = allUsers.find(u => u.id === id);
                        return (
                          <Avatar key={id} className="size-5 border border-background">
                            <AvatarImage src={user?.avatarUrl} />
                            <AvatarFallback className="text-[8px] bg-muted">{user?.name[0]}</AvatarFallback>
                          </Avatar>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 px-1.5">
                      <Users className="size-3.5" />
                      Assign
                    </div>
                  )}
                </button>
              </PopoverTrigger>
              <PopoverContent className="p-0 w-64 bg-background border-border overflow-hidden">
                <Command className="bg-transparent">
                  <CommandInput placeholder="Assign to..." className="border-none focus:ring-0" />
                  <CommandList>
                    <CommandEmpty>No members found.</CommandEmpty>
                    <CommandGroup>
                      {allUsers.map((user) => (
                        <CommandItem
                          key={user.id}
                          onSelect={() => {
                            setAssigneeIds(prev => prev.includes(user.id) ? prev.filter(id => id !== user.id) : [...prev, user.id]);
                          }}
                          className="flex items-center gap-2 px-3 py-2 cursor-pointer aria-selected:bg-muted"
                        >
                          <Avatar className="size-6">
                            <AvatarImage src={user.avatarUrl} />
                            <AvatarFallback>{user.name[0]}</AvatarFallback>
                          </Avatar>
                          <div className="flex-1 flex flex-col">
                            <span className="text-sm font-medium">{user.name}</span>
                          </div>
                          {assigneeIds.includes(user.id) && <CheckCircle2 className="size-4 text-primary" />}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Progressive Disclosure Sections */}
          <div className="space-y-3 pt-2">
            {/* Details / Description */}
            <Collapsible open={showDetails} onOpenChange={setShowDetails}>
              <CollapsibleTrigger asChild>
                <button className="flex items-center gap-2 text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors py-1">
                  <Plus className={cn("size-3 transition-transform", showDetails && "rotate-45")} />
                  {description ? "Description added" : "Add details"}
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2">
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Add context, links, or instructions..."
                  className="bg-muted/30 border-border text-sm min-h-[100px] focus-visible:ring-primary/20"
                />
              </CollapsibleContent>
            </Collapsible>

            {/* Clarity / Strategy (Task only) */}
            {type === "task" && (
              <Collapsible open={showClarity} onOpenChange={setShowClarity}>
                <CollapsibleTrigger asChild>
                  <button className="flex items-center gap-2 text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors py-1">
                    <Plus className={cn("size-3 transition-transform", showClarity && "rotate-45")} />
                    {objective || successCriteria ? "Clarity defined" : "Add clarity (Objective & Success Criteria)"}
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2 space-y-3">
                  <div className="relative">
                    <Target className="absolute left-3 top-2.5 size-3.5 text-muted-foreground/60" />
                    <Input
                      value={objective}
                      onChange={(e) => setObjective(e.target.value)}
                      placeholder="What is the high-level objective?"
                      className="bg-muted/30 border-border pl-9 text-sm h-9 focus-visible:ring-primary/20"
                    />
                  </div>
                  <div className="relative">
                    <CheckCircle2 className="absolute left-3 top-2.5 size-3.5 text-muted-foreground/60" />
                    <Input
                      value={successCriteria}
                      onChange={(e) => setSuccessCriteria(e.target.value)}
                      placeholder="How do we measure success?"
                      className="bg-muted/30 border-border pl-9 text-sm h-9 focus-visible:ring-primary/20"
                    />
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}

            {/* Location & Agenda (Event only) */}
            {type === "event" && (
              <div className="space-y-3">
                <div className="relative">
                  <MapPin className="absolute left-3 top-2.5 size-3.5 text-muted-foreground/60" />
                  <Input
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="Add location or meeting link"
                    className="bg-muted/30 border-border pl-9 text-sm h-9 focus-visible:ring-primary/20"
                  />
                </div>
                <Collapsible open={showAgenda} onOpenChange={setShowAgenda}>
                  <CollapsibleTrigger asChild>
                    <button className="flex items-center gap-2 text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors py-1">
                      <Plus className={cn("size-3 transition-transform", showAgenda && "rotate-45")} />
                      Add agenda
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-2">
                    <Textarea
                      placeholder="List agenda items..."
                      className="bg-muted/30 border-border text-sm min-h-[80px] focus-visible:ring-primary/20"
                    />
                  </CollapsibleContent>
                </Collapsible>
              </div>
            )}
          </div>
        </div>

        {/* Action Row */}
        <div className="px-6 py-4 bg-muted/20 border-t border-border flex items-center justify-between">
          <div className="flex items-center gap-4 text-[10px] text-muted-foreground uppercase tracking-widest font-medium">
            <span className="flex items-center gap-1"><kbd className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border">ENTER</kbd> TO CREATE</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} className="text-muted-foreground hover:text-foreground">
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => handleSubmit()}
              className="bg-primary hover:bg-primary/90 text-primary-foreground px-4 h-8 font-medium"
              disabled={!title.trim()}
            >
              {mode === "edit" ? "Save Changes" : `Create ${type === 'task' ? 'Task' : 'Event'}`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}