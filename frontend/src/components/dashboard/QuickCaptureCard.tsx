import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Zap } from "lucide-react";

export function QuickCaptureCard() {
  return (
    <Card className="md:col-span-3 bg-card/90 border border-border/60 rounded-2xl px-4 py-3 shadow-sm hover:bg-card/95 transition-colors">
      <div className="flex items-center gap-3 w-full">
        <Zap className="h-4 w-4 text-primary" />
        <Input
          placeholder="Quick capture..."
          className="w-full bg-transparent border-none shadow-none px-0 text-sm text-foreground placeholder:text-muted-foreground/50 focus-visible:ring-0 focus-visible:ring-offset-0"
        />
        <div className="flex items-center gap-1 text-muted-foreground/40 select-none whitespace-nowrap text-[11px]">
          <span>⏎</span>
          <span>save</span>
        </div>
      </div>
    </Card>
  );
}
