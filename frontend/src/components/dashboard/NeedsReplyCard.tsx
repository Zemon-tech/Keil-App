// TODO: Wire in future module
import { Card } from "@/components/ui/card";
import { MessageCircle } from "lucide-react";

export function NeedsReplyCard() {
  return (
    <Card className="bg-card/90 border border-border/60 rounded-2xl p-4 hover:bg-card/95 transition-colors cursor-pointer">
      <div className="flex items-center gap-2 mb-1">
        <MessageCircle className="h-3.5 w-3.5 text-primary" />
        <h3 className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground font-bold">
          Needs Your Reply
        </h3>
      </div>
      <ul className="space-y-3 text-xs text-muted-foreground">
        <li className="flex items-center gap-2">
          <span className="w-1 h-1 rounded-full bg-primary" />
          Rahul – clarification on API endpoint
        </li>
        <li className="flex items-center gap-2">
          <span className="w-1 h-1 rounded-full bg-primary" />
          Design team – feedback on login UI
        </li>
        <li className="flex items-center gap-2">
          <span className="w-1 h-1 rounded-full bg-primary" />
          PR review request
        </li>
      </ul>
    </Card>
  );
}
