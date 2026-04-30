// TODO: Wire in future module
import { Card } from "@/components/ui/card";
import { CalendarDays } from "lucide-react";

export function NextEventCard() {
  return (
    <Card className="bg-card/90 border border-border/60 rounded-2xl p-3 gap-2 hover:bg-card/95 transition-colors cursor-pointer">
      <h3 className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground font-bold mb-1">
        Next Event
      </h3>
      <div className="flex items-start gap-2.5">
        <div className="p-1.5 rounded-lg bg-primary/10">
          <CalendarDays className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium leading-tight">Design Review Meeting</p>
          <p className="text-[11px] text-primary mt-1 font-medium">
            Starts in: 25 minutes
          </p>
        </div>
      </div>
    </Card>
  );
}
