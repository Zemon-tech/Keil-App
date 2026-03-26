import { Card } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";
import type { DashboardTaskDTO } from "@/types/task";
import { formatDistanceToNow, parseISO } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";

interface ImmediateBlockersCardProps {
  tasks: DashboardTaskDTO[];
  isLoading: boolean;
}

export function ImmediateBlockersCard({ tasks, isLoading }: ImmediateBlockersCardProps) {
  if (isLoading) {
    return (
      <Card className="bg-card/90 border border-border/60 rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-4">
          <Skeleton className="h-4 w-4 rounded-full" />
          <Skeleton className="h-3 w-32" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
        </div>
      </Card>
    );
  }

  if (!tasks.length) {
    return (
      <Card className="bg-card/90 border border-border/60 rounded-2xl p-4 flex flex-col items-center justify-center min-h-[120px] cursor-default">
        <h3 className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground font-bold mb-2 flex items-center gap-2">
          <AlertTriangle className="h-3.5 w-3.5" />
          Immediate Blockers
        </h3>
        <p className="text-muted-foreground text-sm">No immediate blockers</p>
      </Card>
    );
  }

  return (
    <Card className="bg-card/90 border border-border/60 rounded-2xl p-4 hover:bg-card/95 transition-colors cursor-pointer">
      <h3 className="text-[10px] uppercase tracking-[0.22em] text-destructive font-bold mb-3 flex items-center gap-2">
        <AlertTriangle className="h-3.5 w-3.5" />
        Immediate Blockers
      </h3>
      <div className="space-y-4">
        {tasks.slice(0, 3).map((task) => (
          <div key={task.id} className="space-y-1">
            <p className="text-sm text-foreground leading-tight truncate">
              {task.title}
            </p>
            <div className="flex justify-between items-center text-[10px] text-muted-foreground">
              <span className="capitalize text-destructive font-medium">{task.priority}</span>
              <span>
                {task.due_date ? formatDistanceToNow(parseISO(task.due_date), { addSuffix: true }) : 'No due date'}
              </span>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
