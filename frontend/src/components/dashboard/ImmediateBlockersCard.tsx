import { Card } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";

export function ImmediateBlockersCard() {
  return (
    <Card className="bg-card/90 border border-border/60 rounded-2xl px-4 hover:bg-card/95 transition-colors cursor-pointer">
      <h3 className="text-[10px] uppercase tracking-[0.22em] text-destructive font-bold mb-1/2 flex items-center gap-2">
        <AlertTriangle className="h-3.5 w-3.5" />
        Immediate Blockers
      </h3>
      <div className="space-y-2">
        <p className="text-sm text-foreground leading-tight">
          Waiting for API schema from backend
        </p>
        <div className="flex justify-between items-center text-[10px] text-muted-foreground">
          <span>Owner: Priya</span>
          <span>20m ago</span>
        </div>
      </div>
    </Card>
  );
}
