import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Zap } from "lucide-react";
import { cn } from "@/lib/utils";

interface QuickCaptureCardProps {
  isWheel?: boolean;
}

export function QuickCaptureCard({ isWheel }: QuickCaptureCardProps) {
  return (
    <Card
      className={cn(
        "bg-card/90 border border-border/60 rounded-2xl px-4 py-3 gap-2 shadow-sm hover:bg-card transition-all duration-300 group relative overflow-hidden",
        isWheel ? "h-full w-full md:col-span-1" : "md:col-span-3",
      )}
    >
      <div className="flex flex-col h-full justify-between">
        <div className="flex items-center gap-2 mb-2">
          <Zap className="h-3.5 w-3.5 text-primary" />
          <h3 className="text-[9px] uppercase tracking-[0.25em] text-muted-foreground font-bold">
            Quick Capture
          </h3>
        </div>
        <div className="flex items-center gap-3 w-full">
          <Input
            placeholder="Note something..."
            className="w-full bg-transparent border-none shadow-none px-0 text-sm text-foreground placeholder:text-muted-foreground/40 focus-visible:ring-0 focus-visible:ring-offset-0 h-8"
          />
          <div className="flex items-center gap-1 text-muted-foreground/30 select-none whitespace-nowrap text-[10px]">
            <span>⏎</span>
          </div>
        </div>
      </div>
    </Card>
  );
}
