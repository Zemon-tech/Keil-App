import { useState } from "react";
import { Card } from "@/components/ui/card";
import type { DashboardTaskDTO } from "@/types/task";
import { Skeleton } from "@/components/ui/skeleton";
import { TaskPreviewDialog } from "@/components/tasks/TaskPreviewDialog";
import { EventPreviewDialog } from "@/components/tasks/EventPreviewDialog";

import { cn } from "@/lib/utils";

interface UpNextCardProps {
  tasks: DashboardTaskDTO[];
  isLoading: boolean;
  isWheel?: boolean;
}

export function UpNextCard({ tasks, isLoading, isWheel }: UpNextCardProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<"task" | "event" | null>(
    null,
  );

  if (isLoading) {
    return (
      <Card
        className={cn(
          "bg-card/90 border border-border/60 rounded-2xl p-4 flex flex-col justify-between shadow-sm",
          isWheel ? "h-full w-full rounded-none border-0" : "h-[132px]",
        )}
      >
        <div>
          <Skeleton className="h-2.5 w-16 mb-2" />
          <div className="space-y-2">
            <Skeleton className="h-3 w-full" />
          </div>
        </div>
      </Card>
    );
  }

  if (!tasks.length) {
    return (
      <Card
        className={cn(
          "bg-card/90 border border-border/60 rounded-2xl p-4 flex items-center justify-center text-muted-foreground text-xs italic",
          isWheel ? "h-full w-full rounded-none border-0" : "h-[132px]",
        )}
      >
        Clear schedule
      </Card>
    );
  }

  const handleItemClick = (
    e: React.MouseEvent,
    id: string,
    type?: "task" | "event" | null,
    status?: string,
  ) => {
    e.stopPropagation();
    setSelectedId(id);
    const determinedType =
      type ||
      (["confirmed", "tentative", "completed", "cancelled"].includes(
        status || "",
      )
        ? "event"
        : "task");
    setSelectedType(determinedType as "task" | "event");
  };

  return (
    <>
      <Card
        className={cn(
          "bg-card/90 border border-border/60 rounded-2xl p-4 flex flex-col justify-between hover:bg-card transition-all duration-300 cursor-pointer shadow-sm group",
          isWheel ? "h-full w-full rounded-none border-0" : "h-[132px]",
        )}
      >
        <div className="flex flex-col h-full justify-between">
          <h3 className="text-[9px] uppercase tracking-[0.25em] text-muted-foreground font-bold mb-2 shrink-0">
            Up Next
          </h3>
          <div className="flex-1 flex flex-col justify-center space-y-2">
            {tasks.slice(0, isWheel ? 1 : 2).map((task) => (
              <div
                key={task.id}
                onClick={(e) =>
                  handleItemClick(e, task.id, task.type, task.status)
                }
                className="group/item p-0 rounded-lg transition-all duration-200"
              >
                <p className="text-sm font-semibold truncate group-hover/item:text-primary transition-colors leading-tight">
                  {task.title}
                </p>
                <div className="flex gap-1.5 text-[10px] text-muted-foreground flex-wrap mt-1">
                  <span className="flex items-center gap-1 capitalize">
                    <span
                      className={`w-1 h-1 rounded-full ${
                        task.status === "done" || task.status === "completed"
                          ? "bg-green-500"
                          : task.status === "in-progress"
                            ? "bg-blue-500"
                            : "bg-muted-foreground"
                      }`}
                    />
                    {task.status.replace("-", " ")}
                  </span>
                  <span className="text-orange-400 font-bold px-1 rounded bg-orange-400/10">
                    P:{task.priority}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {selectedId && selectedType === "event" && (
        <EventPreviewDialog
          eventId={selectedId}
          open={!!selectedId}
          onOpenChange={(open) => {
            if (!open) {
              setSelectedId(null);
              setSelectedType(null);
            }
          }}
        />
      )}
      {selectedId && selectedType === "task" && (
        <TaskPreviewDialog
          taskId={selectedId}
          open={!!selectedId}
          onOpenChange={(open) => {
            if (!open) {
              setSelectedId(null);
              setSelectedType(null);
            }
          }}
        />
      )}
    </>
  );
}
