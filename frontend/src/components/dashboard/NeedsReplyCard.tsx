import { Card } from "@/components/ui/card";
import { MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface NeedsReplyCardProps {
  isWheel?: boolean;
}

export function NeedsReplyCard({ isWheel }: NeedsReplyCardProps) {
  const replies = [
    { id: 1, from: "Rahul", message: "clarification on API endpoint" },
    { id: 2, from: "Design team", message: "feedback on login UI" },
    { id: 3, from: "Team", message: "PR review request" },
  ];

  return (
    <Card
      className={cn(
        "bg-card/90 border border-border/60 rounded-2xl p-4 gap-2 hover:bg-card transition-all duration-300 cursor-pointer shadow-sm group",
        isWheel ? "h-full w-full rounded-none border-0" : "",
      )}
    >
      <div className="flex items-center gap-2 mb-2">
        <MessageCircle className="h-3.5 w-3.5 text-primary" />
        <h3 className="text-[9px] uppercase tracking-[0.25em] text-muted-foreground font-bold">
          Needs Reply
        </h3>
        <span className="ml-auto text-[10px] font-bold text-primary group-hover:scale-110 transition-transform">
          {replies.length}
        </span>
      </div>
      <ul className="space-y-1.5 text-[11px] text-muted-foreground">
        {replies.slice(0, isWheel ? 2 : 3).map((reply) => (
          <li key={reply.id} className="flex items-center gap-2 group/item">
            <span className="w-1 h-1 rounded-full bg-primary/40 group-hover/item:bg-primary transition-colors" />
            <span className="truncate group-hover/item:text-foreground transition-colors">
              <span className="font-semibold text-foreground/70">
                {reply.from}
              </span>{" "}
              – {reply.message}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
