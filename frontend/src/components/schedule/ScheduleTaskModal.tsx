import React, { useState, useEffect } from "react";
import { format } from "date-fns";
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
import { useTask } from "@/hooks/api/useTasks";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Calendar, AlertCircle } from "lucide-react";
import { UnscheduledTaskDTO } from "@/types/task";
import { cn } from "@/lib/utils";

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
    }
  }, [open, defaultStart, defaultEnd]);

  const { data: unscheduledData, isLoading: loadingUnscheduled } = useUnscheduledTasks({ 
    search: debouncedSearch,
    limit: 20 
  });

  const { data: parentTask } = useTask(selectedTask?.parent_task_id ?? "");
  const { mutate: updateTimeblock, isPending: isUpdating } = useUpdateTaskTimeblock();

  const handleSelectTask = (task: UnscheduledTaskDTO) => {
    setSelectedTask(task);
  };

  const validateBounds = () => {
    if (!selectedTask) return { valid: true };

    const start = new Date(scheduledStart);
    const end = new Date(scheduledEnd);

    // Task bounds
    if (selectedTask.start_date && start < new Date(selectedTask.start_date)) {
        return { valid: false, message: `Starts before task start date (${format(new Date(selectedTask.start_date), 'PPp')})` };
    }
    if (selectedTask.due_date && end > new Date(selectedTask.due_date)) {
        return { valid: false, message: `Ends after task due date (${format(new Date(selectedTask.due_date), 'PPp')})` };
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
  const noDueDateError = selectedTask && !selectedTask.due_date;

  const handleSubmit = () => {
    if (!selectedTask || !validation.valid || noDueDateError) return;

    updateTimeblock({
      taskId: selectedTask.id,
      scheduled_start: new Date(scheduledStart).toISOString(),
      scheduled_end: new Date(scheduledEnd).toISOString(),
    }, {
      onSuccess: () => {
        onScheduled();
        onClose();
      }
    });
  };

  // Format datetime-local requires YYYY-MM-DDTHH:MM
  const formatForInput = (isoString: string) => {
    if (!isoString) return "";
    try {
        const d = new Date(isoString);
        return format(d, "yyyy-MM-dd'T'HH:mm");
    } catch {
        return "";
    }
  };

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
            ) : unscheduledData?.data.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">No unscheduled tasks found</p>
            ) : (
              <div className="grid gap-1">
                {unscheduledData?.data.map((task) => (
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
                      {task.due_date ? `Due: ${format(new Date(task.due_date), 'PP')}` : "No due date"}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>

          {selectedTask && (
            <div className="grid gap-4 p-3 border rounded-lg bg-muted/30">
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

              {noDueDateError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    This task has no due date. Please set a due date in the task detail before scheduling.
                  </AlertDescription>
                </Alert>
              )}

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
            disabled={!selectedTask || !validation.valid || noDueDateError || isUpdating}
          >
            {isUpdating ? "Scheduling..." : "Schedule Task"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
