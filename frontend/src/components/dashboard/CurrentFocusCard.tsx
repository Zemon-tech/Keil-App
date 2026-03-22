import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { DashboardTaskDTO } from "@/types/task";
import { formatDistanceToNow, isToday, isTomorrow, parseISO } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";

interface CurrentFocusCardProps {
  task: DashboardTaskDTO | null;
  isLoading: boolean;
}

export function CurrentFocusCard({ task, isLoading }: CurrentFocusCardProps) {
  const getDueText = (dateString: string | null) => {
    if (!dateString) return "No due date";
    const date = parseISO(dateString);
    if (isToday(date)) return "Due today";
    if (isTomorrow(date)) return "Due tomorrow";
    return `Due in ${formatDistanceToNow(date)}`;
  };

  if (isLoading) {
    return (
      <Card className="md:col-span-2 bg-card/90 border border-border/60 rounded-2xl p-5">
        <div className="flex justify-between items-start mb-1/2">
          <div>
            <Skeleton className="h-3 w-24 mb-2" />
            <Skeleton className="h-3 w-12" />
          </div>
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
        <div className="space-y-4 mt-4">
          <Skeleton className="h-6 w-3/4" />
          <div className="grid grid-cols-2 gap-4 mt-4">
            <div>
              <Skeleton className="h-3 w-16 mb-2" />
              <Skeleton className="h-4 w-full" />
            </div>
            <div>
              <Skeleton className="h-3 w-16 mb-2" />
              <Skeleton className="h-4 w-full" />
            </div>
          </div>
        </div>
      </Card>
    );
  }

  if (!task) {
    return (
      <Card className="md:col-span-2 bg-card/90 border border-border/60 rounded-2xl p-5 flex flex-col items-center justify-center text-center min-h-[160px]">
        <p className="text-muted-foreground">No urgent tasks right now</p>
      </Card>
    );
  }

  return (
    <Card className="md:col-span-2 bg-card/90 border border-border/60 rounded-2xl p-5 hover:bg-card/95 transition-colors cursor-pointer">
      <div className="flex justify-between items-start mb-1/2">
        <div>
          <h3 className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground font-bold">
            Current Focus
          </h3>
          <p className="text-xs text-muted-foreground mt-1 uppercase tracking-[0.2em]">
            Task
          </p>
        </div>
        <Badge variant={task.priority === "urgent" ? "destructive" : "outline"} className="text-[10px] rounded-full px-2 py-0.5 capitalize">
          {task.priority}
        </Badge>
      </div>
      <div className="space-y-4">
        <div>
          <p className="text-lg font-medium">{task.title}</p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-[10px] text-muted-foreground uppercase font-medium mb-1">
              Goal
            </p>
            <p className="text-sm text-muted-foreground/90">
              {task.objective || "No objective set"}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase font-medium mb-1">
              Due Status
            </p>
            <p className="text-sm text-muted-foreground/90 italic">
              {getDueText(task.due_date)}
            </p>
          </div>
        </div>
      </div>
    </Card>
  );
}
