import { Card } from "@/components/ui/card";

export function UpNextCard() {
  return (
    <Card className="bg-card/90 border border-border/60 rounded-2xl p-4 hover:bg-card/95 transition-colors cursor-pointer">
      <h3 className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground font-bold mb-1/2">
        Up Next
      </h3>
      <p className="text-sm font-medium">Optimize search query performance</p>
      <div className="flex gap-3 mt-1/2 text-[10px] text-muted-foreground flex-wrap">
        <span className="px-2 py-0.5 rounded border border-border/60 bg-card/70">
          Priority: P1
        </span>
        <span className="px-2 py-0.5 rounded border border-border/60 bg-card/70">
          Est: 1 hour
        </span>
      </div>
    </Card>
  );
}
