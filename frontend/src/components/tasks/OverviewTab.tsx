import { useState } from "react";
import {
  ChevronRight,
  Flag,
  Plus,
  Search,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { EditableTextarea } from "@/components/ui/editable-text";
import { CreateTaskDialog } from "@/components/tasks/CreateTaskDialog";

import type { TaskDTO, UpdateTaskInput } from "@/hooks/api/useTasks";
import {
  useSubtasks,
  useAssignUser,
  useRemoveAssignee,
} from "@/hooks/api/useTasks";
import { useWorkspaceMembers } from "@/hooks/api/useWorkspace";

import { formatDate } from "./task-detail-shared";
import { BulletListEditor } from "./BulletListEditor";
import { TaskContextSection } from "./TaskContextSection";

// ─── OverviewTab ──────────────────────────────────────────────────────────────

export const OverviewTab = ({
  task,
  onUpdateTask,
  onUpdateField,
  onNavigateToSubtask,
}: {
  task: TaskDTO;
  onUpdateTask?: (id: string, updates: any) => void;
  onUpdateField?: (updates: UpdateTaskInput) => void;
  onNavigateToSubtask?: (subtaskId: string) => void;
}) => {
  const [isAssigneePickerOpen, setIsAssigneePickerOpen] = useState(false);
  const [assigneeSearch, setAssigneeSearch] = useState("");
  const [createSubtaskOpen, setCreateSubtaskOpen] = useState(false);

  const { data: members } = useWorkspaceMembers(task.workspace_id);
  const assignUser = useAssignUser();
  const removeAssignee = useRemoveAssignee();

  // Fetch real subtasks from API
  const isTopLevelTask = !task.parent_task_id;
  const { data: subtasks = [], isLoading: subtasksLoading } = useSubtasks(
    isTopLevelTask ? task.id : ""
  );

  const handleAssignUser = (userId: string) => {
    assignUser.mutate({ id: task.id, userId });
  };

  const handleRemoveAssignee = (userId: string) => {
    removeAssignee.mutate({ id: task.id, userId });
  };

  // Subtask progress: count how many subtasks are 'done'
  const completedCount = subtasks.filter((s) => s.status === "done").length;
  const progressPercent =
    subtasks.length > 0
      ? Math.round((completedCount / subtasks.length) * 100)
      : 0;

  const statusColorMap: Record<string, string> = {
    "in-progress": "bg-blue-500",
    done: "bg-emerald-500",
    backlog: "bg-zinc-500",
    todo: "bg-violet-500",
  };

  return (
    <div className="flex h-full flex-col md:flex-row md:divide-x md:divide-border w-full min-w-0">

      {/* LEFT: Main content */}
      <ScrollArea className="flex-1 min-w-0">
        <div className="space-y-6 p-5 pr-6 w-full">

          {/* Description */}
          <div>
            <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Description
            </span>
            <EditableTextarea
              value={task.description ?? ""}
              onSave={(description) => onUpdateField?.({ description })}
              placeholder="Add a description..."
              minRows={2}
            />
          </div>

          {/* Objective + Success Criteria */}
          <div className="grid grid-cols-1 gap-px bg-border sm:grid-cols-2 rounded-md overflow-hidden border border-border/40">
            <div className="bg-background p-4 min-h-[120px]">
              <BulletListEditor
                title={task.type === "event" ? "Agenda / Notes" : "Objective"}
                value={task.objective ?? ""}
                onSave={(objective) => onUpdateField?.({ objective })}
                placeholder="No objective points set"
              />
            </div>
            <div className="bg-background p-4 min-h-[120px]">
              <BulletListEditor
                title="Success Criteria"
                value={task.success_criteria ?? ""}
                onSave={(success_criteria) => onUpdateField?.({ success_criteria })}
                placeholder="No criteria points set"
              />
            </div>
          </div>

          {/* Subtasks — only shown for top-level tasks and tasks only (no subtasks for events) */}
          {isTopLevelTask && task.type === "task" && (
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Subtasks
                </span>
                <span className="font-mono text-[11px] text-muted-foreground">
                  {completedCount}/{subtasks.length} complete
                </span>
              </div>

              {/* Progress bar */}
              <Progress value={progressPercent} className="mb-3 h-1" />

              <div className="space-y-px">
                {subtasksLoading && (
                  <div className="space-y-1.5 px-2 py-1">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="flex items-center gap-2 animate-pulse">
                        <div className="w-2 h-2 rounded-full bg-muted-foreground/20" />
                        <div className="h-3 rounded bg-muted-foreground/15 flex-1" />
                      </div>
                    ))}
                  </div>
                )}

                {!subtasksLoading && subtasks.map((sub) => {
                  const isDone = sub.status === "done";
                  const displayDate = sub.due_date || (sub as any).dueDateISO;
                  return (
                    <div
                      key={sub.id}
                      onClick={() => onNavigateToSubtask?.(sub.id)}
                      className="group flex items-center gap-2.5 rounded-md px-2.5 py-2 cursor-pointer hover:bg-accent/50 transition-colors"
                    >
                      {/* Status dot */}
                      <span
                        className={cn(
                          "h-2 w-2 rounded-full shrink-0",
                          statusColorMap[sub.status] || "bg-zinc-500"
                        )}
                      />

                      {/* Title */}
                      <span
                        className={cn(
                          "flex-1 text-sm font-medium truncate",
                          isDone && "line-through text-muted-foreground"
                        )}
                      >
                        {sub.title}
                      </span>

                      {/* Priority flag */}
                      {(sub.priority === "high" || sub.priority === "urgent") && (
                        <Flag className="w-3 h-3 text-orange-400 shrink-0" />
                      )}

                      {/* Due date */}
                      <span className="text-[11px] tabular-nums text-muted-foreground shrink-0">
                        {displayDate
                          ? new Date(displayDate).toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                            })
                          : ""}
                      </span>

                      {/* Chevron */}
                      <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                    </div>
                  );
                })}

                {!subtasksLoading && subtasks.length === 0 && (
                  <p className="px-2 py-1.5 text-xs italic text-muted-foreground">
                    No subtasks yet
                  </p>
                )}

                <button
                  onClick={() => setCreateSubtaskOpen(true)}
                  className="flex w-full items-center gap-1.5 px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add subtask
                </button>
              </div>

              {/* Create subtask dialog */}
              <CreateTaskDialog
                open={createSubtaskOpen}
                onOpenChange={setCreateSubtaskOpen}
                onTaskCreated={() => setCreateSubtaskOpen(false)}
                parentTaskId={task.id}
                parentTaskTitle={task.title}
              />
            </div>
          )}

          {/* Context */}
          <TaskContextSection task={task} onUpdateTask={onUpdateTask} />

        </div>
      </ScrollArea>

      {/* RIGHT: Sidebar */}
      <ScrollArea className="w-full shrink-0 md:w-[280px] lg:w-[300px]">
        <div className="space-y-5 p-5 pl-6">

          {/* Assignees */}
          <div>
            <span className="mb-2 block text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Assignees
            </span>
            <div className="space-y-1.5">
              {(task.assignees ?? []).map((a) => {
                const name = a.name || a.email;
                return (
                  <div key={a.id} className="group flex items-center justify-between rounded hover:bg-accent/40 px-1 -mx-1">
                    <div className="flex items-center gap-2">
                      <Avatar className="h-6 w-6">
                        <AvatarFallback className="text-[10px] font-semibold bg-accent">
                          {name.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm">{name}</span>
                    </div>
                    <button
                      onClick={() => handleRemoveAssignee(a.id)}
                      className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-red-500 transition-all rounded-md"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })}

              <Popover open={isAssigneePickerOpen} onOpenChange={setIsAssigneePickerOpen}>
                <PopoverTrigger asChild>
                  <button className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground">
                    <Plus className="h-3 w-3" />
                    Add assignee
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-56 p-2" align="start">
                  <div className="flex items-center gap-2 border-b border-border pb-2 mb-2 px-1">
                    <Search className="h-4 w-4 text-muted-foreground shrink-0" />
                    <Input
                      placeholder="Search members..."
                      value={assigneeSearch}
                      onChange={(e) => setAssigneeSearch(e.target.value)}
                      className="h-7 border-none shadow-none focus-visible:ring-0 px-0 outline-none"
                    />
                  </div>
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {members
                      ?.filter(m => !(task.assignees ?? []).some(a => a.id === m.user_id))
                      .filter(m => (m.user.name || m.user.email).toLowerCase().includes(assigneeSearch.toLowerCase()))
                      .map((m) => {
                        const mName = m.user.name || m.user.email;
                        return (
                          <button
                            key={m.id}
                            onClick={() => {
                              handleAssignUser(m.user_id);
                              setIsAssigneePickerOpen(false);
                            }}
                            className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-accent transition-colors text-left"
                          >
                            <Avatar className="h-5 w-5 shrink-0">
                              <AvatarFallback className="text-[9px] bg-accent">
                                {mName.charAt(0).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <span className="truncate">{mName}</span>
                          </button>
                        );
                      })
                    }
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <Separator />

          {/* Dates */}
          <div>
            <span className="mb-2 block text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Dates
            </span>
            {(task.due_date || task.dueDateISO || task.plannedStartISO || task.plannedEndISO) ? (
              <div className="space-y-1.5 text-xs">
                {(task.due_date || task.dueDateISO) && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Due</span>
                    <span className="font-medium">{formatDate(task.due_date || task.dueDateISO!)}</span>
                  </div>
                )}
                {task.plannedStartISO && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Start</span>
                    <span className="font-medium">{formatDate(task.plannedStartISO)}</span>
                  </div>
                )}
                {task.plannedEndISO && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">End</span>
                    <span className="font-medium">{formatDate(task.plannedEndISO)}</span>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs italic text-muted-foreground">No dates set</p>
            )}
          </div>

          <Separator />

          {/* Estimation */}
          {task.type === "task" && (
            <div>
              <span className="mb-2 block text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Estimation
              </span>
              <div className="space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Story points</span>
                  <span className="font-mono font-medium">{task.story_points ?? "—"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Time estimate</span>
                  <span className="font-mono font-medium">
                    {task.time_estimate
                      ? `${Math.floor(task.time_estimate / 60)}h ${task.time_estimate % 60}m`
                      : "—"}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Labels */}
          {(task.labels ?? []).length > 0 && (
            <>
              <Separator />
              <div>
                <span className="mb-2 block text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Labels
                </span>
                <div className="flex flex-wrap gap-1">
                  {(task.labels ?? []).map((label) => (
                    <Badge key={label} variant="secondary" className="h-5 px-1.5 text-[10px]">
                      {label}
                    </Badge>
                  ))}
                </div>
              </div>
            </>
          )}

        </div>
      </ScrollArea>
    </div>
  );
};
