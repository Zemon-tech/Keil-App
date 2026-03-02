import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function CurrentFocusCard() {
  return (
    <Card className="md:col-span-2 bg-card/90 border border-border/60 rounded-2xl p-5 hover:bg-card/95 transition-colors cursor-pointer">
      <div className="flex justify-between items-start mb-1/2">
        <div>
          <h3 className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground font-bold">
            Current Focus
          </h3>
          <p className="text-xs text-muted-foreground mt-1 uppercase tracking-[0.2em]">
            Task
          </p>
        </div>
        <Badge variant="outline" className="text-[10px] rounded-full px-2 py-0.5">
          Today
        </Badge>
      </div>
      <div className="space-y-4">
        <div>
          <p className="text-lg font-medium">Fix login timeout bug</p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-[10px] text-muted-foreground uppercase font-medium mb-1">
              Goal
            </p>
            <p className="text-sm text-muted-foreground/90">
              Reduce response time &lt;500ms
            </p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase font-medium mb-1">
              Next Step
            </p>
            <p className="text-sm text-muted-foreground/90 italic">
              Check database query latency
            </p>
          </div>
        </div>
      </div>
    </Card>
  );
}
