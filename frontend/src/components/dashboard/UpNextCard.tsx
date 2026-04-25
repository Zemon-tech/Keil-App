import { Card } from "@/components/ui/card";
import type { DashboardTaskDTO } from "@/types/task";
import { Skeleton } from "@/components/ui/skeleton";

interface UpNextCardProps {
  tasks: DashboardTaskDTO[];
  isLoading: boolean;
}

export function UpNextCard({ tasks, isLoading }: UpNextCardProps) {
  if (isLoading) {
    return (
      <Card className="bg-card/90 border border-border/60 rounded-2xl p-3">
        <Skeleton className="h-2.5 w-16 mb-2" />
        <Skeleton className="h-3.5 w-full mb-1.5" />
        <div className="flex gap-2">
          <Skeleton className="h-3.5 w-10" />
        </div>
      </Card>
    );
  }

  if (!tasks.length) {
    return null;
  }

  return (
    <Card className="bg-card/90 border border-border/60 rounded-2xl p-3 hover:bg-card/95 transition-colors cursor-pointer">
      <h3 className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground font-bold mb-2">
        Up Next
      </h3>
      <div className="space-y-2">
        {tasks.slice(0, 4).map((task) => (
          <div key={task.id} className="group">
            <p className="text-sm font-medium truncate group-hover:underline leading-tight">
              {task.title}
            </p>
            <div className="flex gap-2 mt-1 text-[10px] text-muted-foreground flex-wrap">
              <span className="px-1.5 py-0.5 rounded border border-border/60 bg-card/70 flex items-center gap-1.5 capitalize">
                <span className={`w-1 h-1 rounded-full ${task.status === "done" ? "bg-green-500" : task.status === "in-progress" ? "bg-blue-500" : "bg-muted-foreground"}`} />
                {task.status.replace("-", " ")}
              </span>
              <span className="px-1.5 py-0.5 rounded border border-border/60 bg-card/70 capitalize text-orange-400 font-medium">
                P: {task.priority}
              </span>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
