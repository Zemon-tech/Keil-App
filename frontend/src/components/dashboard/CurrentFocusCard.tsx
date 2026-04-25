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
      <Card className="md:col-span-2 bg-card/90 border border-border/60 rounded-2xl p-3">
        <div className="flex justify-between items-start mb-2">
          <div>
            <Skeleton className="h-3 w-20 mb-1" />
            <Skeleton className="h-2.5 w-12" />
          </div>
          <Skeleton className="h-5 w-14 rounded-full" />
        </div>
        <div className="space-y-3 mt-3">
          <Skeleton className="h-5 w-3/4" />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Skeleton className="h-2.5 w-14 mb-1" />
              <Skeleton className="h-3.5 w-full" />
            </div>
            <div>
              <Skeleton className="h-2.5 w-14 mb-1" />
              <Skeleton className="h-3.5 w-full" />
            </div>
          </div>
        </div>
      </Card>
    );
  }

  if (!task) {
    return null;
  }

  return (
    <Card className="md:col-span-2 bg-card/90 border border-border/60 rounded-2xl p-3 hover:bg-card/95 transition-colors cursor-pointer">
      <div className="flex justify-between items-start mb-2">
        <div>
          <h3 className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground font-bold">
            Current Focus
          </h3>
          <p className="text-[11px] text-muted-foreground mt-0.5 uppercase tracking-[0.2em]">
            Task
          </p>
        </div>
        <Badge variant={task.priority === "urgent" ? "destructive" : "outline"} className="text-[10px] rounded-full px-2 py-0.5 capitalize">
          {task.priority}
        </Badge>
      </div>
      <div className="space-y-3 mt-3">
        <h2 className="text-base font-semibold leading-tight">{task.title}</h2>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-0.5">Due Date</p>
            <p className="text-sm font-medium">{getDueText(task.due_date)}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-0.5">Status</p>
            <p className="text-sm font-medium capitalize">{task.status.replace("-", " ")}</p>
          </div>
        </div>
      </div>
    </Card>
  );
}
