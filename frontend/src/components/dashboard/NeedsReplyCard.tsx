// TODO: Wire in future module
import { Card } from "@/components/ui/card";
import { MessageCircle } from "lucide-react";

export function NeedsReplyCard() {
  const replies = [
    { id: 1, from: "Rahul", message: "clarification on API endpoint" },
    { id: 2, from: "Design team", message: "feedback on login UI" },
    { id: 3, from: "Team", message: "PR review request" },
  ];

  if (!replies.length) {
    return null;
  }

  return (
    <Card className="bg-card/90 border border-border/60 rounded-2xl p-3 gap-2 hover:bg-card/95 transition-colors cursor-pointer">
      <div className="flex items-center gap-2 mb-1">
        <MessageCircle className="h-3.5 w-3.5 text-primary" />
        <h3 className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground font-bold">
          Needs Your Reply
        </h3>
        <span className="ml-auto text-[10px] font-medium text-primary">{replies.length}</span>
      </div>
      <ul className="space-y-1 text-xs text-muted-foreground">
        {replies.slice(0, 3).map((reply) => (
          <li key={reply.id} className="flex items-center gap-2">
            <span className="w-1 h-1 rounded-full bg-primary" />
            <span className="truncate">{reply.from} – {reply.message}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
