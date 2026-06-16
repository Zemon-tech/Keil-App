import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { DashboardTaskDTO } from "@/types/task";
import { formatDistanceToNow, isToday, isTomorrow, parseISO } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";

interface CurrentFocusCardProps {
  task: DashboardTaskDTO | null;
  isLoading: boolean;
  isWheel?: boolean;
}

export function CurrentFocusCard({
  task,
  isLoading,
  isWheel,
}: CurrentFocusCardProps) {
  const getDueText = (dateString: string | null) => {
    if (!dateString) return "No due date";
    const date = parseISO(dateString);
    if (isToday(date)) return "Due today";
    if (isTomorrow(date)) return "Due tomorrow";
    return `Due in ${formatDistanceToNow(date)}`;
  };

  if (isLoading) {
    return (
      <Card
        className={cn(
          isWheel ? "size-full rounded-l-[1.45rem] rounded-r-none border-0 bg-transparent shadow-none" : "bg-card/90 border border-border/60 rounded-2xl shadow-sm md:col-span-2",
          "p-3 gap-2",
        )}
      >
        <div className="flex justify-between items-start mb-1">
          <div>
            <Skeleton className="h-3 w-20 mb-1" />
            <Skeleton className="h-2.5 w-12" />
          </div>
          <Skeleton className="h-5 w-14 rounded-full" />
        </div>
        <div className="space-y-2 mt-2">
          <Skeleton className="h-5 w-3/4" />
        </div>
      </Card>
    );
  }

  if (!task) {
    return (
      <Card
        className={cn(
          isWheel ? "size-full rounded-l-[1.45rem] rounded-r-none border-0 bg-transparent shadow-none" : "bg-card/90 border border-border/60 rounded-2xl shadow-sm md:col-span-2",
          "p-4 flex items-center justify-center text-muted-foreground text-xs italic",
        )}
      >
        No active focus
      </Card>
    );
  }

  return (
    <Card
      className={cn(
        isWheel ? "size-full rounded-l-[1.45rem] rounded-r-none border-0 bg-transparent shadow-none" : "bg-card/90 border border-border/60 rounded-2xl shadow-sm md:col-span-2",
        "p-4 gap-2 hover:bg-card transition-all duration-300 cursor-pointer group overflow-hidden relative",
      )}
    >
      <div className="absolute top-0 right-0 p-3 opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="size-1.5 rounded-full bg-primary animate-pulse" />
      </div>

      <div className="flex justify-between items-start mb-1">
        <div>
          <h3 className="text-[9px] uppercase tracking-[0.25em] text-muted-foreground font-bold">
            Current Focus
          </h3>
        </div>
        <Badge
          variant={task.priority === "urgent" ? "destructive" : "secondary"}
          className="text-[9px] rounded-full px-2 py-0 h-4 border-none capitalize"
        >
          {task.priority}
        </Badge>
      </div>
      <div className="space-y-1 mt-2">
        <h2 className="text-sm font-semibold leading-tight line-clamp-2 group-hover:text-primary transition-colors">
          {task.title}
        </h2>
        <div className="flex items-center gap-2 mt-1">
          <p className="text-[10px] text-muted-foreground font-medium">
            {getDueText(task.due_date)}
          </p>
          <span className="text-[10px] text-muted-foreground/30">•</span>
          <p className="text-[10px] text-primary font-semibold capitalize">
            {task.status.replace("-", " ")}
          </p>
        </div>
      </div>
    </Card>
  );
}
