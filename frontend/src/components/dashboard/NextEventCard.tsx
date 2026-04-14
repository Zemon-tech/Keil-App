import { formatDistanceToNow } from "date-fns";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CalendarDays } from "lucide-react";
import type { ScheduleBlockDTO } from "@/types/task";

interface Props {
  block?: ScheduleBlockDTO | null;
  isLoading?: boolean;
}

export function NextEventCard({ block, isLoading }: Props) {
  if (isLoading) {
    return (
      <Card className="bg-card/90 border border-border/60 rounded-2xl p-4">
        <h3 className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground font-bold mb-3">
          Next Event
        </h3>
        <div className="flex items-start gap-3">
          <Skeleton className="h-10 w-10 rounded-lg" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      </Card>
    );
  }

  if (!block) {
    return (
      <Card className="bg-card/90 border border-border/60 rounded-2xl p-4 hover:bg-card/95 transition-colors">
        <h3 className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground font-bold mb-3">
          Next Event
        </h3>
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-muted">
            <CalendarDays className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">No events today</p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              Your calendar is clear
            </p>
          </div>
        </div>
      </Card>
    );
  }

  const startTime = new Date(block.scheduled_start);
  const timeDistance = formatDistanceToNow(startTime, { addSuffix: true });

  return (
    <Card className="bg-card/90 border border-border/60 rounded-2xl p-4 hover:bg-card/95 transition-colors cursor-pointer">
      <h3 className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground font-bold mb-3">
        Next Event
      </h3>
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-primary/10">
          <CalendarDays className="h-5 w-5 text-primary" />
        </div>
        <div>
          <p className="text-sm font-medium">{block.task_title}</p>
          <p className="text-xs text-primary mt-1 font-medium">
            {timeDistance}
          </p>
        </div>
      </div>
    </Card>
  );
}
