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
      <Card className="bg-card/90 border border-border/60 rounded-2xl p-4">
        <Skeleton className="h-3 w-20 mb-4" />
        <Skeleton className="h-4 w-full mb-2" />
        <div className="flex gap-2">
          <Skeleton className="h-4 w-12" />
        </div>
      </Card>
    );
  }

  if (!tasks.length) {
    return (
      <Card className="bg-card/90 border border-border/60 rounded-2xl p-4 flex flex-col items-center justify-center min-h-[120px] cursor-default">
        <h3 className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground font-bold mb-2">
          Up Next
        </h3>
        <p className="text-muted-foreground text-sm">Nothing due today</p>
      </Card>
    );
  }

  return (
    <Card className="bg-card/90 border border-border/60 rounded-2xl p-4 hover:bg-card/95 transition-colors cursor-pointer">
      <h3 className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground font-bold mb-3">
        Up Next
      </h3>
      <div className="space-y-3">
        {tasks.slice(0, 4).map((task) => (
          <div key={task.id} className="group">
            <p className="text-sm font-medium truncate group-hover:underline">
              {task.title}
            </p>
            <div className="flex gap-3 mt-1.5 text-[10px] text-muted-foreground flex-wrap">
              <span className="px-2 py-0.5 rounded border border-border/60 bg-card/70 flex items-center gap-1.5 capitalize">
                <span className={`w-1.5 h-1.5 rounded-full ${task.status === "done" ? "bg-green-500" : task.status === "in-progress" ? "bg-blue-500" : "bg-muted-foreground"}`} />
                {task.status.replace("-", " ")}
              </span>
              <span className="px-2 py-0.5 rounded border border-border/60 bg-card/70 capitalize text-orange-400 font-medium">
                P: {task.priority}
              </span>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
