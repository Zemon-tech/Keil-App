import React, { useState, useEffect } from "react";
import { format, addDays, endOfDay } from "date-fns";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useUnscheduledTasks, useUpdateTaskTimeblock } from "@/hooks/api/useSchedule";
import { useTask, useUpdateTask } from "@/hooks/api/useTasks";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Calendar, AlertCircle, CalendarPlus } from "lucide-react";
import type { UnscheduledTaskDTO } from "@/types/task";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onClose: () => void;
  defaultStart: string;
  defaultEnd: string;
  onScheduled: () => void;
}

export function ScheduleTaskModal({ open, onClose, defaultStart, defaultEnd, onScheduled }: Props) {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedTask, setSelectedTask] = useState<UnscheduledTaskDTO | null>(null);
  const [scheduledStart, setScheduledStart] = useState("");
  const [scheduledEnd, setScheduledEnd] = useState("");
  const [newDueDate, setNewDueDate] = useState("");

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Reset state when opening
  useEffect(() => {
    if (open) {
      setScheduledStart(defaultStart);
      setScheduledEnd(defaultEnd);
      setSearch("");
      setSelectedTask(null);
      setNewDueDate("");
    }
  }, [open, defaultStart, defaultEnd]);

  // When a task with no due date is selected, pre-fill a sensible default
  useEffect(() => {
    if (selectedTask && !selectedTask.due_date) {
      // Default to end of day of the scheduled end time, or 7 days from now
      try {
        const endDate = scheduledEnd ? new Date(scheduledEnd) : addDays(new Date(), 7);
        setNewDueDate(format(endOfDay(endDate), "yyyy-MM-dd"));
      } catch {
        setNewDueDate(format(addDays(new Date(), 7), "yyyy-MM-dd"));
      }
    } else {
      setNewDueDate("");
    }
  }, [selectedTask, scheduledEnd]);

  const { data: unscheduledData, isLoading: loadingUnscheduled } = useUnscheduledTasks({ 
    search: debouncedSearch,
    limit: 20 
  });

  const { data: parentTask } = useTask(selectedTask?.parent_task_id ?? "");
  const { mutateAsync: updateTimeblock, isPending: isUpdating } = useUpdateTaskTimeblock();
  const { mutateAsync: updateTask, isPending: isSettingDueDate } = useUpdateTask();

  const handleSelectTask = (task: UnscheduledTaskDTO) => {
    setSelectedTask(task);
  };

  const noDueDateNeedsSet = selectedTask && !selectedTask.due_date;
  const isPending = isUpdating || isSettingDueDate;

  const validateBounds = () => {
    if (!selectedTask) return { valid: true };

    const start = new Date(scheduledStart);
    const end = new Date(scheduledEnd);

    // When setting a new due date, validate against that
    const effectiveDueDate = selectedTask.due_date || (noDueDateNeedsSet && newDueDate ? `${newDueDate}T23:59:59` : null);

    // Task bounds
    if (selectedTask.start_date && start < new Date(selectedTask.start_date)) {
        return { valid: false, message: `Starts before task start date (${format(new Date(selectedTask.start_date), 'PPp')})` };
    }
    if (effectiveDueDate && end > new Date(effectiveDueDate)) {
        return { valid: false, message: `Ends after task due date (${format(new Date(effectiveDueDate), 'PP')})` };
    }

    // Parent bounds
    if (parentTask) {
        if (parentTask.start_date && start < new Date(parentTask.start_date)) {
            return { valid: false, message: `Starts before parent task start date (${format(new Date(parentTask.start_date), 'PPp')})` };
        }
        if (parentTask.due_date && end > new Date(parentTask.due_date)) {
            return { valid: false, message: `Ends after parent task due date (${format(new Date(parentTask.due_date), 'PPp')})` };
        }
    }

    return { valid: true };
  };

  const validation = validateBounds();
  const canSubmit = selectedTask 
    && validation.valid 
    && !isPending
    && (!noDueDateNeedsSet || newDueDate); // If needs due date, must have one entered

  const handleSubmit = async () => {
    if (!selectedTask || !canSubmit) return;

    try {
      // Step 1: If task has no due date, set it first
      if (noDueDateNeedsSet && newDueDate) {
        await updateTask({
          id: selectedTask.id,
          updates: {
            due_date: `${newDueDate}T23:59:59.000Z`,
            // Also set start_date if missing
            ...(!selectedTask.start_date ? { start_date: new Date().toISOString() } : {}),
          },
        });
      }

      // Step 2: Schedule the timeblock
      await updateTimeblock({
        taskId: selectedTask.id,
        scheduled_start: new Date(scheduledStart).toISOString(),
        scheduled_end: new Date(scheduledEnd).toISOString(),
      });

      toast.success("Task scheduled", {
        description: `${selectedTask.title} scheduled for ${format(new Date(scheduledStart), "MMM dd, h:mm a")}`,
      });
      onScheduled();
      onClose();
    } catch (err: any) {
      const message = err?.response?.data?.message || "Failed to schedule task";
      toast.error(message);
    }
  };

  // Format datetime-local
  const formatForInput = (isoString: string) => {
    if (!isoString) return "";
    try {
        const d = new Date(isoString);
        return format(d, "yyyy-MM-dd'T'HH:mm");
    } catch {
        return "";
    }
  };

  const taskList = unscheduledData?.data ?? [];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Schedule Task</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="search">Search Unscheduled Tasks</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="search"
                placeholder="Type to search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>

          <ScrollArea className="h-[200px] border rounded-md p-2">
            {loadingUnscheduled ? (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : taskList.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">No unscheduled tasks found</p>
            ) : (
              <div className="grid gap-1">
                {taskList.map((task) => (
                  <button
                    key={task.id}
                    onClick={() => handleSelectTask(task)}
                    className={cn(
                        "flex flex-col items-start p-2 text-sm rounded-md transition-colors text-left w-full",
                        selectedTask?.id === task.id ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                    )}
                  >
                    <span className="font-medium">{task.title}</span>
                    <span className={cn(
                        "text-xs opacity-70",
                        selectedTask?.id === task.id ? "text-primary-foreground/70" : "text-muted-foreground"
                    )}>
                      {task.due_date ? `Due: ${format(new Date(task.due_date), 'PP')}` : "⚠ No due date"}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>

          {selectedTask && (
            <div className="grid gap-4 p-3 border rounded-lg bg-muted/30">
              {/* ── Due date prompt for tasks without one ── */}
              {noDueDateNeedsSet && (
                <Alert className="border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-300">
                  <CalendarPlus className="h-4 w-4" />
                  <AlertDescription className="text-sm">
                    This task has no due date. Set one below to schedule it.
                  </AlertDescription>
                </Alert>
              )}

              {noDueDateNeedsSet && (
                <div className="grid gap-2">
                  <Label htmlFor="due-date" className="text-sm font-medium">
                    Due Date <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="due-date"
                    type="date"
                    value={newDueDate}
                    onChange={(e) => setNewDueDate(e.target.value)}
                    min={format(new Date(), "yyyy-MM-dd")}
                    className="max-w-[200px]"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="start">Scheduled Start</Label>
                  <Input
                    id="start"
                    type="datetime-local"
                    value={formatForInput(scheduledStart)}
                    onChange={(e) => setScheduledStart(new Date(e.target.value).toISOString())}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="end">Scheduled End</Label>
                  <Input
                    id="end"
                    type="datetime-local"
                    value={formatForInput(scheduledEnd)}
                    onChange={(e) => setScheduledEnd(new Date(e.target.value).toISOString())}
                  />
                </div>
              </div>

              {!validation.valid && (
                <Alert className="border-yellow-500/50 bg-yellow-500/10 text-yellow-600 dark:text-yellow-400">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{validation.message}</AlertDescription>
                </Alert>
              )}

              {parentTask && (
                <div className="text-xs text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    Parent task due: {parentTask.due_date ? format(new Date(parentTask.due_date), 'PPp') : 'None'}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button 
            onClick={handleSubmit} 
            disabled={!canSubmit}
          >
            {isPending ? "Scheduling..." : noDueDateNeedsSet ? "Set Date & Schedule" : "Schedule Task"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
