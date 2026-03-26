// TODO: Wire in future module
import { Card } from "@/components/ui/card";
import { CalendarDays } from "lucide-react";

export function NextEventCard() {
  return (
    <Card className="bg-card/90 border border-border/60 rounded-2xl p-4 hover:bg-card/95 transition-colors cursor-pointer">
      <h3 className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground font-bold mb-1/2">
        Next Event
      </h3>
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-primary/10">
          <CalendarDays className="h-5 w-5 text-primary" />
        </div>
        <div>
          <p className="text-sm font-medium">Design Review Meeting</p>
          <p className="text-xs text-primary mt-1 font-medium">
            Starts in: 25 minutes
          </p>
        </div>
      </div>
    </Card>
  );
}
