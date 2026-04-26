import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge"; // ← ShadCN component (already in your codebase)
import { Switch } from "@/components/ui/switch";
import type { Task, TaskStatus, EventType, EventStatus, AnyStatus } from "@/types/task";
import { useCreateTask, useUpdateTask, type TaskDTO, type CreateTaskInput } from "@/hooks/api/useTasks";

// Simple type for assignees (replace with your real UserDTO if you have one)
type SimpleAssigneeOption = {
  id: string;
  name: string;
};

const TASK_STATUS_OPTIONS: TaskStatus[] = ["backlog", "todo", "in-progress", "done"];
const EVENT_STATUS_OPTIONS: EventStatus[] = ["confirmed", "tentative", "cancelled", "completed"];
const PRIORITY_OPTIONS = ["low", "medium", "high", "urgent"] as const;

interface CreateTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTaskCreated: (newTaskId: string) => void;
  allTasks?: TaskDTO[];
  allUsers?: SimpleAssigneeOption[]; // ← pass your workspace users here
  // Edit mode props
  mode?: "create" | "edit";
  taskId?: string;
  initialValues?: Partial<TaskDTO>;
  onTaskUpdated?: (taskId: string) => void;
  /** When set, forces "Create subtask" mode — parent_task_id is pre-filled and locked */
  parentTaskId?: string;
  parentTaskTitle?: string;
}

export function CreateTaskDialog({
  open,
  onOpenChange,
  onTaskCreated,
  allTasks = [],
  allUsers = [],
  mode = "create",
  taskId,
  initialValues,
  onTaskUpdated,
  parentTaskId,
  parentTaskTitle,
}: CreateTaskDialogProps) {
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();

  // ── Form State ─────────────────────────────────────────────────────────────
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");

  // Bullet-list editors (matches your final UI screenshot)
  const [newObjectiveBullets, setNewObjectiveBullets] = useState<string[]>([""]);
  const [newSuccessCriteriaBullets, setNewSuccessCriteriaBullets] = useState<string[]>([""]);

  const [newStartDateISO, setNewStartDateISO] = useState("");
  const [newDueDateISO, setNewDueDateISO] = useState("");
  const [newStatus, setNewStatus] = useState<AnyStatus>("todo");
  const [newPriority, setNewPriority] = useState<Task["priority"]>("medium");

  // New fields from our roadmap
  const [newAssigneeIds, setNewAssigneeIds] = useState<string[]>([]);
  const [newStoryPoints, setNewStoryPoints] = useState("");
  const [newTimeEstimate, setNewTimeEstimate] = useState(""); // minutes
  const [newParentTaskId, setNewParentTaskId] = useState<string>("");

  // Event specific fields
  const [newType, setNewType] = useState<"task" | "event">("task");
  const [newEventType, setNewEventType] = useState<EventType | "">("");
  const [newCustomEventType, setNewCustomEventType] = useState("");
  const [newLocation, setNewLocation] = useState("");
  const [newIsAllDay, setNewIsAllDay] = useState(false);

  // ── Helpers ────────────────────────────────────────────────────────────────
  const resetCreateForm = () => {
    setNewTitle("");
    setNewDescription("");
    setNewObjectiveBullets([""]);
    setNewSuccessCriteriaBullets([""]);
    setNewStartDateISO("");
    setNewDueDateISO("");
    setNewStatus(newType === "event" ? "confirmed" : "todo");
    setNewPriority("medium");
    setNewAssigneeIds([]);
    setNewStoryPoints("");
    setNewTimeEstimate("");
    setNewParentTaskId(parentTaskId ?? "");
    setNewType("task");
    setNewEventType("");
    setNewCustomEventType("");
    setNewLocation("");
    setNewIsAllDay(false);
  };

  // Pre-fill form when opening in edit mode
  useEffect(() => {
    if (open && mode === "edit" && initialValues) {
      setNewTitle(initialValues.title ?? "");
      setNewDescription(initialValues.description ?? "");

      // Parse objective bullets — strip leading "• " if present
      const objBullets = (initialValues.objective ?? "")
        .split("\n")
        .filter(Boolean)
        .map((b) => b.replace(/^•\s*/, "").trim());
      setNewObjectiveBullets(objBullets.length > 0 ? objBullets : [""]);

      // Parse success criteria bullets
      const scBullets = (initialValues.success_criteria ?? "")
        .split("\n")
        .filter(Boolean)
        .map((b) => b.replace(/^•\s*/, "").trim());
      setNewSuccessCriteriaBullets(scBullets.length > 0 ? scBullets : [""]);

      setNewStartDateISO(
        (initialValues as any).start_date ?? (initialValues as any).plannedStartISO ?? ""
      );
      setNewDueDateISO(
        (initialValues as any).due_date ?? (initialValues as any).dueDateISO ?? ""
      );
      setNewStatus((initialValues.status as AnyStatus) ?? (initialValues.type === "event" ? "confirmed" : "todo"));
      setNewPriority((initialValues.priority as any) ?? "medium");
      setNewStoryPoints(
        initialValues.story_points != null ? String(initialValues.story_points) : ""
      );
      setNewTimeEstimate(
        (initialValues as any).time_estimate != null
          ? String((initialValues as any).time_estimate)
          : ""
      );
      setNewAssigneeIds(
        ((initialValues as any).assignees ?? []).map((a: any) => a.id)
      );
      setNewParentTaskId((initialValues as any).parent_task_id ?? "");
      setNewType((initialValues.type as "task" | "event") ?? "task");
      
      const et = initialValues.event_type ?? "";
      if (et && !["meeting", "call", "birthday"].includes(et)) {
        setNewEventType("other");
        setNewCustomEventType(et);
      } else {
        setNewEventType(et as EventType);
        setNewCustomEventType("");
      }

      setNewLocation(initialValues.location ?? "");
      setNewIsAllDay(initialValues.is_all_day ?? false);
    } else if (open && parentTaskId) {
      // Subtask mode: pre-fill parent
      setNewParentTaskId(parentTaskId);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const toDateInputValue = (iso: string, includeTime: boolean = false) => {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    
    if (includeTime) {
      // Return YYYY-MM-DDThh:mm in local time
      const offset = d.getTimezoneOffset() * 60000;
      const localISOTime = new Date(d.getTime() - offset).toISOString().slice(0, 16);
      return localISOTime;
    }
    
    // Return YYYY-MM-DD
    return d.toISOString().slice(0, 10);
  };

  // Bullet list helpers
  const addBullet = (setter: React.Dispatch<React.SetStateAction<string[]>>) => {
    setter((prev) => [...prev, ""]);
  };

  const removeBullet = (index: number, setter: React.Dispatch<React.SetStateAction<string[]>>) => {
    setter((prev) => prev.filter((_, i) => i !== index));
  };

  const updateBullet = (
    index: number,
    value: string,
    setter: React.Dispatch<React.SetStateAction<string[]>>
  ) => {
    setter((prev) => {
      const copy = [...prev];
      copy[index] = value;
      return copy;
    });
  };

  // Assignee helpers
  const addAssignee = (userId: string) => {
    if (!newAssigneeIds.includes(userId)) {
      setNewAssigneeIds((prev) => [...prev, userId]);
    }
  };

  const removeAssignee = (userId: string) => {
    setNewAssigneeIds((prev) => prev.filter((id) => id !== userId));
  };

  // Form validation (enforces our Clarity rules)
  const hasValidObjective = newObjectiveBullets.some((b) => b.trim().length > 0);
  const hasValidSuccessCriteria = newSuccessCriteriaBullets.some((b) => b.trim().length > 0);
  
  // Date validation
  let isDateValid = true;
  let dateError = "";
  if (newStartDateISO && newDueDateISO) {
    if (newType === "event" && newDueDateISO <= newStartDateISO) {
      isDateValid = false;
      dateError = "End time must be after start time.";
    } else if (newDueDateISO < newStartDateISO) {
      isDateValid = false;
      dateError = "Due date must be on or after start date.";
    }
  }

  const isFormValid = newTitle.trim() && 
    (newType === "event" 
      ? (newEventType !== "" && (newEventType !== "other" || newCustomEventType.trim() !== "")) 
      : (hasValidObjective && hasValidSuccessCriteria)) &&
    isDateValid;

  // ── Submit ─────────────────────────────────────────────────────────────────
  async function handleCreateSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isFormValid) return;

    // Format bullet lists with • prefix
    const objectiveFormatted = newObjectiveBullets
      .filter((b) => b.trim())
      .map((b) => `• ${b.trim()}`)
      .join("\n");

    const successCriteriaFormatted = newSuccessCriteriaBullets
      .filter((b) => b.trim())
      .map((b) => `• ${b.trim()}`)
      .join("\n");

    const input: CreateTaskInput = {
      title: newTitle.trim(),
      type: newType,
      event_type: newType === "event" 
        ? (newEventType === "other" ? newCustomEventType.trim() : (newEventType as EventType)) 
        : undefined,
      location: newType === "event" ? newLocation.trim() || undefined : undefined,
      is_all_day: newType === "event" ? newIsAllDay : undefined,
      status: newStatus,
      priority: newPriority,
      description: newDescription.trim() || undefined,
      objective: objectiveFormatted || undefined,
      success_criteria: successCriteriaFormatted || undefined,
      start_date: newStartDateISO || undefined,
      due_date: newDueDateISO || undefined,
      story_points: newType === "task" && newStoryPoints ? parseInt(newStoryPoints, 10) : undefined,
      time_estimate: newType === "task" && newTimeEstimate ? parseInt(newTimeEstimate, 10) : undefined,
      assignee_ids: newAssigneeIds.length > 0 ? newAssigneeIds : undefined,
      parent_task_id: newType === "task" && newParentTaskId !== "none" && newParentTaskId ? newParentTaskId : undefined,
    };

    if (mode === "edit" && taskId) {
      // ── Edit mode: update existing task ──
      updateTask.mutate(
        { id: taskId, updates: input },
        {
          onSuccess: () => {
            onOpenChange(false);
            resetCreateForm();
            onTaskUpdated?.(taskId);
          },
        }
      );
    } else {
      // ── Create mode ──
      createTask.mutate(input, {
        onSuccess: (data) => {
          onOpenChange(false);
          resetCreateForm();
          if (data?.id) onTaskCreated(data.id);
        },
      });
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        onOpenChange(isOpen);
        if (!isOpen) resetCreateForm();
      }}
    >
      <DialogContent className="max-w-2xl p-0 gap-0">
        <form onSubmit={handleCreateSubmit}>
          {/* Header */}
          <div className="px-5 pt-5 pb-4 border-b border-border/60">
            {mode !== "edit" && !parentTaskId && (
              <div className="mb-4 flex justify-center">
                <div className="inline-flex items-center rounded-md border border-border p-1 bg-muted/20">
                  <button
                    type="button"
                    onClick={() => { setNewType("task"); if (newStatus === "confirmed" || newStatus === "tentative" || newStatus === "cancelled" || newStatus === "completed") setNewStatus("todo"); }}
                    className={`px-3 py-1.5 text-xs font-medium rounded-sm transition-colors ${
                      newType === "task"
                        ? "bg-background shadow-sm text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Task
                  </button>
                  <button
                    type="button"
                    onClick={() => { setNewType("event"); if (newStatus === "todo" || newStatus === "backlog" || newStatus === "in-progress" || newStatus === "done") setNewStatus("confirmed"); }}
                    className={`px-3 py-1.5 text-xs font-medium rounded-sm transition-colors ${
                      newType === "event"
                        ? "bg-background shadow-sm text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Event
                  </button>
                </div>
              </div>
            )}
            <DialogHeader>
              <DialogTitle className="text-base">
                {mode === "edit" ? `Edit ${newType}` : parentTaskId ? "Create subtask" : `Create new ${newType}`}
              </DialogTitle>
              <DialogDescription className="text-xs mt-0.5">
                {parentTaskId ? (
                  <>Creating a subtask inside <strong>{parentTaskTitle || "parent task"}</strong>.</>
                ) : newType === "event" ? (
                  <>Events are meetings, calls, or anything non-work related.</>
                ) : (
                  <>Every task must have a clear <strong>Objective</strong> and <strong>Success Criteria</strong>.</>
                )}
              </DialogDescription>
            </DialogHeader>
          </div>

          <Tabs defaultValue="basics" className="w-full">
            <div className="px-5 pt-3">
              <TabsList className="h-8 text-xs w-full grid grid-cols-3">
                <TabsTrigger value="basics" className="text-xs">Basics</TabsTrigger>
                <TabsTrigger value="strategy" className="text-xs">Strategy</TabsTrigger>
                <TabsTrigger value="schedule" className="text-xs">Schedule</TabsTrigger>
              </TabsList>
            </div>

            <div className="px-5 pt-3 pb-6 min-h-[340px]">
              {/* ====================== BASICS TAB ====================== */}
              <TabsContent value="basics" className="mt-0 space-y-4">
                {/* Title */}
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Title <span className="text-red-500">*</span></Label>
                  <Input
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="e.g. Implement dependency graph UI"
                    className="h-9 text-sm"
                    required
                  />
                </div>

                {/* Description */}
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Description <span className="opacity-50">(optional)</span></Label>
                  <Textarea
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    placeholder="Detailed context, instructions, or notes..."
                    className="text-sm min-h-[80px] resize-none"
                  />
                </div>

                {newType === "event" && (
                  <div className="grid grid-cols-2 gap-3">
                    {/* Event Type */}
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Event Type <span className="text-red-500">*</span></Label>
                      <Select value={newEventType} onValueChange={(v) => setNewEventType(v as EventType)}>
                        <SelectTrigger className="h-9 text-sm">
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="meeting">Meeting</SelectItem>
                          <SelectItem value="call">Call</SelectItem>
                          <SelectItem value="birthday">Birthday</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Custom Event Type Input (shows only when "Other" is selected) */}
                    {newEventType === "other" && (
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Specify Type <span className="text-red-500">*</span></Label>
                        <Input
                          value={newCustomEventType}
                          onChange={(e) => setNewCustomEventType(e.target.value)}
                          placeholder="e.g. Workshop"
                          className="h-9 text-sm"
                          required
                        />
                      </div>
                    )}

                    {/* Location */}
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Location / Link <span className="opacity-50">(optional)</span></Label>
                      <Input
                        value={newLocation}
                        onChange={(e) => setNewLocation(e.target.value)}
                        placeholder="e.g. Zoom link or address"
                        className="h-9 text-sm"
                      />
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  {/* Status */}
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Status</Label>
                    <Select value={newStatus} onValueChange={(v) => setNewStatus(v as AnyStatus)}>
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {newType === "event" 
                          ? EVENT_STATUS_OPTIONS.map((s) => (
                            <SelectItem key={s} value={s} className="text-sm capitalize">
                              {s}
                            </SelectItem>
                          ))
                          : TASK_STATUS_OPTIONS.map((s) => (
                            <SelectItem key={s} value={s} className="text-sm capitalize">
                              {s}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Priority */}
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Priority</Label>
                    <Select value={newPriority} onValueChange={(v) => setNewPriority(v as Task["priority"])}>
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PRIORITY_OPTIONS.map((p) => (
                          <SelectItem key={p} value={p} className="text-sm">
                            {p}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Assignees (multi-select) – NEW */}
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Assignees <span className="opacity-50">(optional)</span></Label>

                  {/* Selected badges */}
                  <div className="flex flex-wrap gap-1 mb-2">
                    {newAssigneeIds.map((id) => {
                      const user = allUsers.find((u) => u.id === id);
                      return (
                        <Badge key={id} variant="secondary" className="flex items-center gap-1 text-xs">
                          {user?.name || id}
                          <button
                            type="button"
                            onClick={() => removeAssignee(id)}
                            className="text-muted-foreground hover:text-foreground ml-1"
                          >
                            ✕
                          </button>
                        </Badge>
                      );
                    })}
                  </div>

                  {/* Add assignee dropdown */}
                  <Select onValueChange={addAssignee}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="Add assignee..." />
                    </SelectTrigger>
                    <SelectContent>
                      {allUsers.map((user) => (
                        <SelectItem key={user.id} value={user.id} className="text-sm">
                          {user.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Parent task (hidden when in subtask mode or event type) */}
                {!parentTaskId && newType === "task" && allTasks.length > 0 && (
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Parent task <span className="opacity-50">(optional)</span></Label>
                    <Select value={newParentTaskId} onValueChange={setNewParentTaskId}>
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue placeholder="None (top-level task)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none" className="text-sm">None (top-level)</SelectItem>
                        {allTasks.filter(t => !t.parent_task_id).map((t) => (
                          <SelectItem key={t.id} value={t.id} className="text-sm">
                            {t.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </TabsContent>

              {/* ====================== STRATEGY TAB ====================== */}
              <TabsContent value="strategy" className="mt-0 space-y-6">
                {/* Objective – Bullet list editor */}
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">
                    {newType === "event" ? "Agenda / Notes" : "Objective"} 
                    {newType === "task" && <span className="text-red-500 ml-1">*</span>}
                    {newType === "event" && <span className="opacity-50 ml-1">(optional)</span>}
                  </Label>
                  <div className="border border-border rounded-md p-3 space-y-2 bg-muted/30">
                    {newObjectiveBullets.map((bullet, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <span className="text-muted-foreground text-lg leading-none">•</span>
                        <Input
                          value={bullet}
                          onChange={(e) => updateBullet(index, e.target.value, setNewObjectiveBullets)}
                          placeholder="What are we trying to achieve?"
                          className="flex-1 h-8 text-sm"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeBullet(index, setNewObjectiveBullets)}
                          className="h-8 w-8 p-0 text-muted-foreground"
                        >
                          ✕
                        </Button>
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => addBullet(setNewObjectiveBullets)}
                      className="w-full text-xs"
                    >
                      + Add bullet
                    </Button>
                  </div>
                </div>

                {/* Success Criteria – Bullet list editor */}
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">
                    Success Criteria 
                    {newType === "task" && <span className="text-red-500 ml-1">*</span>}
                    {newType === "event" && <span className="opacity-50 ml-1">(optional)</span>}
                  </Label>
                  <div className="border border-border rounded-md p-3 space-y-2 bg-muted/30">
                    {newSuccessCriteriaBullets.map((bullet, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <span className="text-muted-foreground text-lg leading-none">•</span>
                        <Input
                          value={bullet}
                          onChange={(e) => updateBullet(index, e.target.value, setNewSuccessCriteriaBullets)}
                          placeholder="How do we know this is done?"
                          className="flex-1 h-8 text-sm"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeBullet(index, setNewSuccessCriteriaBullets)}
                          className="h-8 w-8 p-0 text-muted-foreground"
                        >
                          ✕
                        </Button>
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => addBullet(setNewSuccessCriteriaBullets)}
                      className="w-full text-xs"
                    >
                      + Add bullet
                    </Button>
                  </div>
                </div>
              </TabsContent>

              {/* ====================== SCHEDULE TAB ====================== */}
              <TabsContent value="schedule" className="mt-0 space-y-4">
                {newType === "event" && (
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="all-day"
                      checked={newIsAllDay}
                      onCheckedChange={setNewIsAllDay}
                    />
                    <Label htmlFor="all-day" className="text-sm cursor-pointer">All day event</Label>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  {/* Start Date */}
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">
                      {newType === "event" ? "Start time" : "Start date"}
                    </Label>
                    <Input
                      type={newType === "event" && !newIsAllDay ? "datetime-local" : "date"}
                      value={toDateInputValue(newStartDateISO, newType === "event" && !newIsAllDay)}
                      onChange={(e) =>
                        setNewStartDateISO(e.target.value ? new Date(e.target.value).toISOString() : "")
                      }
                      className="h-9 text-sm"
                    />
                  </div>

                  {/* Due Date */}
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">
                      {newType === "event" ? "End time" : "Due date"}
                    </Label>
                    <Input
                      type={newType === "event" && !newIsAllDay ? "datetime-local" : "date"}
                      value={toDateInputValue(newDueDateISO, newType === "event" && !newIsAllDay)}
                      onChange={(e) =>
                        setNewDueDateISO(e.target.value ? new Date(e.target.value).toISOString() : "")
                      }
                      className="h-9 text-sm"
                    />
                  </div>
                </div>

                {/* Estimation fields – now persistent */}
                {newType === "task" && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Story points</Label>
                      <Input
                        type="number"
                        value={newStoryPoints}
                        onChange={(e) => setNewStoryPoints(e.target.value)}
                        placeholder="0"
                        className="h-9 text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Time estimate (minutes)</Label>
                      <Input
                        type="number"
                        value={newTimeEstimate}
                        onChange={(e) => setNewTimeEstimate(e.target.value)}
                        placeholder="120"
                        className="h-9 text-sm"
                      />
                    </div>
                  </div>
                )}
              </TabsContent>
            </div>
          </Tabs>

          {/* Footer */}
          <div className="px-5 py-3 border-t border-border/60 flex justify-between gap-2 bg-muted/20 items-center">
            <span className="text-xs text-red-500 font-medium">{dateError}</span>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={(mode === "edit" ? updateTask.isPending : createTask.isPending) || !isFormValid}
              >
                {mode === "edit"
                  ? updateTask.isPending ? "Saving…" : "Save changes"
                  : createTask.isPending ? "Creating…" : parentTaskId ? "Create subtask" : `Create ${newType}`}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}