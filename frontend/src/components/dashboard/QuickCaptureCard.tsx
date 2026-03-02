import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Zap } from "lucide-react";

export function QuickCaptureCard() {
  return (
    <Card className="md:col-span-3 bg-[#1a1a1a] border border-white/5 rounded-full px-6 h-12 flex items-center shadow-lg transition-all hover:bg-[#1f1f1f]">
      <div className="flex items-center gap-4 w-full">
        <Zap className="h-4 w-4 text-muted-foreground/50" />
        <Input
          placeholder="Personal Capture or Brain Dump..."
          className="w-full bg-transparent border-none shadow-none px-0 text-[13px] text-foreground placeholder:text-muted-foreground/30 focus-visible:ring-0 focus-visible:ring-offset-0"
        />
        <div className="flex items-center gap-1 text-muted-foreground/30 select-none whitespace-nowrap">
          <span className="text-[11px] font-mono">⏎</span>
          <span className="text-[10px]">to save</span>
        </div>
      </div>
    </Card>
  );
}
