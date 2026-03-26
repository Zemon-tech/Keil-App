import { useState } from "react";
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
import type { Task, TaskStatus } from "@/types/task";
import { useCreateTask, type TaskDTO, type CreateTaskInput } from "@/hooks/api/useTasks";

// Simple type for assignees (replace with your real UserDTO if you have one)
type SimpleAssigneeOption = {
  id: string;
  name: string;
};

const STATUS_OPTIONS: TaskStatus[] = ["backlog", "todo", "in-progress", "done"];
const PRIORITY_OPTIONS = ["low", "medium", "high", "urgent"] as const;

interface CreateTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTaskCreated: (newTaskId: string) => void;
  allTasks?: TaskDTO[];
  allUsers?: SimpleAssigneeOption[]; // ← NEW: pass your workspace users here
}

export function CreateTaskDialog({
  open,
  onOpenChange,
  onTaskCreated,
  allTasks = [],
  allUsers = [],
}: CreateTaskDialogProps) {
  const createTask = useCreateTask();

  // ── Form State ─────────────────────────────────────────────────────────────
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");

  // Bullet-list editors (matches your final UI screenshot)
  const [newObjectiveBullets, setNewObjectiveBullets] = useState<string[]>([""]);
  const [newSuccessCriteriaBullets, setNewSuccessCriteriaBullets] = useState<string[]>([""]);

  const [newStartDateISO, setNewStartDateISO] = useState("");
  const [newDueDateISO, setNewDueDateISO] = useState("");
  const [newStatus, setNewStatus] = useState<TaskStatus>("todo");
  const [newPriority, setNewPriority] = useState<Task["priority"]>("medium");

  // New fields from our roadmap
  const [newAssigneeIds, setNewAssigneeIds] = useState<string[]>([]);
  const [newStoryPoints, setNewStoryPoints] = useState("");
  const [newTimeEstimate, setNewTimeEstimate] = useState(""); // minutes
  const [newParentTaskId, setNewParentTaskId] = useState<string>("");

  // ── Helpers ────────────────────────────────────────────────────────────────
  const resetCreateForm = () => {
    setNewTitle("");
    setNewDescription("");
    setNewObjectiveBullets([""]);
    setNewSuccessCriteriaBullets([""]);
    setNewStartDateISO("");
    setNewDueDateISO("");
    setNewStatus("todo");
    setNewPriority("medium");
    setNewAssigneeIds([]);
    setNewStoryPoints("");
    setNewTimeEstimate("");
    setNewParentTaskId("");
  };

  const toDateInputValue = (iso: string) => {
    if (!iso) return "";
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
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
  const isFormValid = newTitle.trim() && hasValidObjective && hasValidSuccessCriteria;

  // ── Submit ─────────────────────────────────────────────────────────────────
  async function handleCreateSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isFormValid) return;

    // Format bullet lists exactly like your final UI (with • bullets)
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
      status: newStatus,
      priority: newPriority,
      description: newDescription.trim() || undefined,
      objective: objectiveFormatted || undefined,
      success_criteria: successCriteriaFormatted || undefined,
      start_date: newStartDateISO || undefined,
      due_date: newDueDateISO || undefined,
      story_points: newStoryPoints ? parseInt(newStoryPoints, 10) : undefined,
      time_estimate: newTimeEstimate ? parseInt(newTimeEstimate, 10) : undefined,
      assignee_ids: newAssigneeIds.length > 0 ? newAssigneeIds : undefined, // ← new
      parent_task_id: newParentTaskId === "none" || !newParentTaskId ? undefined : newParentTaskId,
    };

    createTask.mutate(input, {
      onSuccess: (data) => {
        onOpenChange(false);
        resetCreateForm();
        if (data?.id) onTaskCreated(data.id);
      },
    });
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
            <DialogHeader>
              <DialogTitle className="text-base">Create new task</DialogTitle>
              <DialogDescription className="text-xs mt-0.5">
                Every task must have a clear <strong>Objective</strong> and <strong>Success Criteria</strong>.
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

                <div className="grid grid-cols-2 gap-3">
                  {/* Status */}
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Status</Label>
                    <Select value={newStatus} onValueChange={(v) => setNewStatus(v as TaskStatus)}>
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map((s) => (
                          <SelectItem key={s} value={s} className="text-sm">
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

                {/* Parent task (unchanged) */}
                {allTasks.length > 0 && (
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Parent task <span className="opacity-50">(optional)</span></Label>
                    <Select value={newParentTaskId} onValueChange={setNewParentTaskId}>
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue placeholder="None (top-level task)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none" className="text-sm">None (top-level)</SelectItem>
                        {allTasks.map((t) => (
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
                  <Label className="text-xs text-muted-foreground">Objective <span className="text-red-500">*</span></Label>
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
                  <Label className="text-xs text-muted-foreground">Success Criteria <span className="text-red-500">*</span></Label>
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
                <div className="grid grid-cols-2 gap-3">
                  {/* Start Date */}
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Start date</Label>
                    <Input
                      type="date"
                      value={toDateInputValue(newStartDateISO)}
                      onChange={(e) =>
                        setNewStartDateISO(e.target.value ? new Date(e.target.value).toISOString() : "")
                      }
                      className="h-9 text-sm"
                    />
                  </div>

                  {/* Due Date */}
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Due date</Label>
                    <Input
                      type="date"
                      value={toDateInputValue(newDueDateISO)}
                      onChange={(e) =>
                        setNewDueDateISO(e.target.value ? new Date(e.target.value).toISOString() : "")
                      }
                      className="h-9 text-sm"
                    />
                  </div>
                </div>

                {/* Estimation fields – now persistent */}
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
              </TabsContent>
            </div>
          </Tabs>

          {/* Footer */}
          <div className="px-5 py-3 border-t border-border/60 flex justify-end gap-2 bg-muted/20">
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={createTask.isPending || !isFormValid}
            >
              {createTask.isPending ? "Creating…" : "Create task"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}