import { Card } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";
import type { DashboardTaskDTO } from "@/types/task";
import { formatDistanceToNow, parseISO } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface ImmediateBlockersCardProps {
  tasks: DashboardTaskDTO[];
  isLoading: boolean;
  isWheel?: boolean;
}

export function ImmediateBlockersCard({
  tasks,
  isLoading,
  isWheel,
}: ImmediateBlockersCardProps) {
  if (isLoading) {
    return (
      <Card
        className={cn(
          "bg-card/90 border border-border/60 rounded-2xl p-4 gap-2",
          isWheel ? "h-full w-full" : "",
        )}
      >
        <div className="flex items-center gap-2 mb-1">
          <Skeleton className="h-3.5 w-3.5 rounded-full" />
          <Skeleton className="h-2.5 w-24" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-3.5 w-full" />
        </div>
      </Card>
    );
  }

  if (!tasks.length) {
    return (
      <Card
        className={cn(
          "bg-card/90 border border-border/60 rounded-2xl p-4 flex items-center justify-center text-muted-foreground text-xs italic",
          isWheel ? "h-full w-full" : "",
        )}
      >
        No blockers
      </Card>
    );
  }

  return (
    <Card
      className={cn(
        "bg-card/90 border border-border/60 rounded-2xl p-4 gap-2 hover:bg-card transition-all duration-300 cursor-pointer shadow-sm group",
        isWheel ? "h-full w-full" : "",
      )}
    >
      <h3 className="text-[9px] uppercase tracking-[0.25em] text-destructive font-bold mb-2 flex items-center gap-2">
        <AlertTriangle className="h-3.5 w-3.5" />
        Blockers
      </h3>
      <div className="space-y-2">
        {tasks.slice(0, isWheel ? 1 : 3).map((task) => (
          <div key={task.id} className="space-y-0.5">
            <p className="text-sm font-semibold text-foreground leading-tight truncate group-hover:text-destructive transition-colors">
              {task.title}
            </p>
            <div className="flex justify-between items-center text-[10px] text-muted-foreground">
              <span className="capitalize text-destructive font-medium">
                {task.priority}
              </span>
              <span>
                {task.due_date
                  ? formatDistanceToNow(parseISO(task.due_date), {
                      addSuffix: true,
                    })
                  : "No due date"}
              </span>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
