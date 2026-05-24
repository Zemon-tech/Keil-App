import { Card } from "@/components/ui/card";
import { CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";

interface NextEventCardProps {
  isWheel?: boolean;
}

export function NextEventCard({ isWheel }: NextEventCardProps) {
  return (
    <Card
      className={cn(
        "bg-card/90 border border-border/60 rounded-2xl p-4 gap-2 hover:bg-card transition-all duration-300 cursor-pointer shadow-sm group relative overflow-hidden",
        isWheel ? "size-full" : "",
      )}
    >
      <div className="absolute top-0 right-0 p-3 opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="size-1.5 rounded-full bg-primary animate-pulse" />
      </div>

      <h3 className="text-[9px] uppercase tracking-[0.25em] text-muted-foreground font-bold mb-2">
        Next Event
      </h3>
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors duration-300">
          <CalendarDays className="size-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold leading-tight truncate group-hover:text-primary transition-colors">
            Design Review Meeting
          </p>
          <div className="flex items-center gap-1.5 mt-1">
            <span className="size-1 rounded-full bg-primary" />
            <p className="text-[10px] text-primary font-medium">
              In 25 minutes
            </p>
          </div>
        </div>
      </div>
    </Card>
  );
}
