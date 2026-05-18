import { useState } from "react";
import { Card } from "@/components/ui/card";
import type { DashboardTaskDTO } from "@/types/task";
import { Skeleton } from "@/components/ui/skeleton";
import { TaskPreviewDialog } from "@/components/tasks/TaskPreviewDialog";
import { EventPreviewDialog } from "@/components/tasks/EventPreviewDialog";

interface UpNextCardProps {
  tasks: DashboardTaskDTO[];
  isLoading: boolean;
}

export function UpNextCard({ tasks, isLoading }: UpNextCardProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<"task" | "event" | null>(null);

  if (isLoading) {
    return (
      <Card className="h-[132px] bg-card/90 border border-border/60 rounded-2xl p-3 flex flex-col justify-between">
        <div>
          <Skeleton className="h-2.5 w-16 mb-2" />
          <div className="space-y-2">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-3/4" />
          </div>
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-3 w-12" />
          <Skeleton className="h-3 w-10" />
        </div>
      </Card>
    );
  }

  if (!tasks.length) {
    return null;
  }

  const handleItemClick = (
    e: React.MouseEvent,
    id: string,
    type?: "task" | "event" | null,
    status?: string
  ) => {
    e.stopPropagation();
    setSelectedId(id);
    const determinedType =
      type ||
      (["confirmed", "tentative", "completed", "cancelled"].includes(status || "")
        ? "event"
        : "task");
    setSelectedType(determinedType as "task" | "event");
  };

  return (
    <>
      <Card className="h-[132px] bg-card/90 border border-border/60 rounded-2xl p-3 flex flex-col justify-between">
        <div className="flex flex-col h-full justify-between">
          <h3 className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground font-bold mb-1 shrink-0">
            Up Next
          </h3>
          <div className="flex-1 flex flex-col justify-center space-y-1.5">
            {tasks.slice(0, 2).map((task) => (
              <div
                key={task.id}
                onClick={(e) => handleItemClick(e, task.id, task.type, task.status)}
                className="group p-1.5 rounded-lg hover:bg-accent/55 transition-all duration-200 cursor-pointer -mx-1.5 flex flex-col gap-0.5"
              >
                <p className="text-xs font-semibold truncate group-hover:text-primary transition-colors leading-tight">
                  {task.title}
                </p>
                <div className="flex gap-1.5 text-[9px] text-muted-foreground flex-wrap">
                  <span className="px-1 py-0.5 rounded border border-border/50 bg-card/40 flex items-center gap-1 capitalize">
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
                  <span className="px-1 py-0.5 rounded border border-border/50 bg-card/40 capitalize text-orange-400 font-semibold">
                    P: {task.priority}
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
