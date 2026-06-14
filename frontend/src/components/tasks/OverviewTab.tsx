import { useState } from "react";
import { toast } from "sonner";
import {
  ChevronRight,
  Flag,
  Plus,
  Search,
  X,
  User,
  Clock,
  MapPin,
  Building2,
  Video,
  Users,
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
  useOrgSubtasks,
  useAssignOrgUser,
  useRemoveOrgAssignee,
} from "@/hooks/api/useTasks";
import { useSpaceMembers } from "@/hooks/api/useSpaces";
import { useAppContext } from "@/contexts/AppContext";
import { useSpaceRole } from "@/hooks/useSpaceRole";

import { formatDate, formatDueDate } from "./task-detail-shared";
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
  const [isGuestPickerOpen, setIsGuestPickerOpen] = useState(false);
  const [guestEmailInput, setGuestEmailInput] = useState("");

  const handleAddGuestInline = () => {
    const email = guestEmailInput.trim().toLowerCase();
    if (!email) return;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast.error("Invalid email address");
      return;
    }
    const currentGuests = task.guests ?? [];
    if (currentGuests.includes(email)) {
      toast.error("Guest already added");
      return;
    }
    onUpdateField?.({ guests: [...currentGuests, email] });
    setGuestEmailInput("");
    setIsGuestPickerOpen(false);
  };

  const { activeOrgId, activeSpaceId } = useAppContext();
  const { canEditTask, canAssignTask, canCreateTask } = useSpaceRole();
  const { data: members = [] } = useSpaceMembers(
    activeOrgId,
    activeSpaceId
  );
  const assignUser = useAssignOrgUser(activeOrgId, activeSpaceId);
  const removeAssignee = useRemoveOrgAssignee(activeOrgId, activeSpaceId);




  const creatorMember = members.find((m) => m.user_id === task.created_by);
  const creatorName = creatorMember
    ? (creatorMember.name || creatorMember.email)
    : (task.created_by?.includes("-") ? "Space Member" : task.created_by);

  // Fetch real subtasks from API
  const isTopLevelTask = !task.parent_task_id;
  const { data: subtasks = [], isLoading: subtasksLoading } = useOrgSubtasks(
    activeOrgId,
    activeSpaceId,
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
    backlog: "bg-red-500",
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
              disabled={!canEditTask}
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
                disabled={!canEditTask}
              />
            </div>
            <div className="bg-background p-4 min-h-[120px]">
              <BulletListEditor
                title="Success Criteria"
                value={task.success_criteria ?? ""}
                onSave={(success_criteria) => onUpdateField?.({ success_criteria })}
                placeholder="No criteria points set"
                disabled={!canEditTask}
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
                {subtasks.length > 0 && (
                  <span className="font-mono text-[11px] text-muted-foreground">
                    {completedCount}/{subtasks.length} complete
                  </span>
                )}
              </div>

              {/* Progress bar */}
              {subtasks.length > 0 && (
                <Progress value={progressPercent} className="mb-3 h-1" />
              )}

              <div className="space-y-px">
                {subtasksLoading && (
                  <div className="space-y-1.5 px-2 py-1">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="flex items-center gap-2 animate-pulse">
                        <div className="size-2 rounded-full bg-muted-foreground/20" />
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
                          "size-2 rounded-full shrink-0",
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
                        <Flag className="size-3 text-orange-400 shrink-0" />
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
                      <ChevronRight className="size-3.5 text-muted-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                    </div>
                  );
                })}

                {canCreateTask && (
                  <button
                    onClick={() => setCreateSubtaskOpen(true)}
                    className="flex w-full items-center gap-1.5 px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <Plus className="size-3.5" />
                    Add subtask
                  </button>
                )}
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

          {/* Properties section */}
          <div>
            <span className="mb-2 block text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Properties
            </span>
            <div className="space-y-3.5 text-xs">
              {/* Type */}
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Type</span>
                <Badge variant="outline" className="h-5 px-1.5 text-[11px] capitalize">
                  {task.type}
                  {task.event_type && ` (${task.event_type})`}
                </Badge>
              </div>

              {/* Workspace / Context */}
              {task.org_name && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Workspace</span>
                  <span className="font-medium text-right text-muted-foreground/80 flex items-center gap-1">
                    <Building2 className="size-3 text-muted-foreground/60 shrink-0" />
                    <span className="truncate max-w-[130px]">{task.org_name} › {task.space_name ?? "General"}</span>
                  </span>
                </div>
              )}

              {/* Creator */}
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Creator</span>
                <span className="font-medium text-right flex items-center gap-1">
                  <User className="size-3 text-muted-foreground/60 shrink-0" />
                  <span className="truncate max-w-[130px]" title={creatorName}>{creatorName}</span>
                </span>
              </div>

              {/* Created At */}
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Created</span>
                <span className="font-medium text-right flex items-center gap-1">
                  <Clock className="size-3 text-muted-foreground/60 shrink-0" />
                  <span>{formatDate(task.created_at)}</span>
                </span>
              </div>

              {/* Updated At */}
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Updated</span>
                <span className="font-medium text-right flex items-center gap-1">
                  <Clock className="size-3 text-muted-foreground/60 shrink-0" />
                  <span>{formatDate(task.updated_at)}</span>
                </span>
              </div>

              {/* Location (if Event) */}
              {task.type === "event" && task.location && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Location</span>
                  <span className="font-medium text-right flex items-center gap-1">
                    <MapPin className="size-3 text-muted-foreground/60 shrink-0" />
                    <span className="truncate max-w-[130px]" title={task.location}>{task.location}</span>
                  </span>
                </div>
              )}

              {/* Google Meet Link */}
              {task.meet_link && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Google Meet</span>
                  <a
                    href={task.meet_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-right flex items-center gap-1 text-emerald-500 hover:text-emerald-600 transition-colors"
                  >
                    <Video className="size-3 text-emerald-500 shrink-0" />
                    <span>Join Meet</span>
                  </a>
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* Assignees */}
          <div>
            <span className="mb-2 block text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Assignees
            </span>
            <div className="space-y-1.5">
              <div className="max-h-[130px] overflow-y-auto pr-1 space-y-1.5 scrollbar-thin">
                {(task.assignees ?? []).map((a) => {
                  const name = a.name || a.email;
                  return (
                    <div key={a.id} className="group flex items-center justify-between rounded hover:bg-accent/40 px-1 py-0.5">
                      <div className="flex items-center gap-2">
                        <Avatar className="size-6">
                          <AvatarFallback className="text-[10px] font-semibold bg-accent">
                            {name.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm truncate max-w-[170px]">{name}</span>
                      </div>
                      {canAssignTask && (
                        <button
                          onClick={() => handleRemoveAssignee(a.id)}
                          className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-red-500 transition-all rounded-md"
                        >
                          <X className="size-3.5" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Assignees picker */}
              {canAssignTask && (
                <Popover open={isAssigneePickerOpen} onOpenChange={setIsAssigneePickerOpen}>
                  <PopoverTrigger asChild>
                    <button className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground">
                      <Plus className="size-3" />
                      Add assignee
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-56 p-2" align="start">
                    <div className="flex items-center gap-2 border-b border-border pb-2 mb-2 px-1">
                      <Search className="size-4 text-muted-foreground shrink-0" />
                      <Input
                        placeholder="Search members..."
                        value={assigneeSearch}
                        onChange={(e) => setAssigneeSearch(e.target.value)}
                        className="h-7 border-none shadow-none focus-visible:ring-0 px-0 outline-none"
                      />
                    </div>
                    <div className="max-h-40 overflow-y-auto space-y-1">
                      {(() => {
                        const elements = [];
                        const assignees = task.assignees ?? [];
                        const searchLower = assigneeSearch.toLowerCase();
                        for (const m of members) {
                          const isAlreadyAssigned = assignees.some(a => a.id === m.user_id);
                          if (isAlreadyAssigned) continue;

                          const mName = m.name || m.email;
                          if (!mName.toLowerCase().includes(searchLower)) continue;

                          elements.push(
                            <button
                              key={m.user_id}
                              onClick={() => {
                                handleAssignUser(m.user_id);
                                setIsAssigneePickerOpen(false);
                              }}
                              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-accent transition-colors text-left"
                            >
                              <Avatar className="size-5 shrink-0">
                                <AvatarFallback className="text-[9px] bg-accent">
                                  {mName.charAt(0).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <span className="truncate">{mName}</span>
                            </button>
                          );
                        }
                        return elements;
                      })()}
                    </div>
                  </PopoverContent>
                </Popover>
              )}
            </div>
          </div>

          <Separator />

          {/* Guests */}
          <div>
            <span className="mb-2 block text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Meet Guests
            </span>
            <div className="space-y-1.5">
              <div className="max-h-[130px] overflow-y-auto pr-1 space-y-1.5 scrollbar-thin">
                {(task.guests ?? []).map((email) => {
                  return (
                    <div key={email} className="group flex items-center justify-between rounded hover:bg-accent/40 px-1 py-0.5">
                      <div className="flex items-center gap-2">
                        <Avatar className="size-6">
                          <AvatarFallback className="text-[10px] font-semibold bg-accent">
                            {email.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-xs truncate max-w-[170px] text-muted-foreground" title={email}>{email}</span>
                      </div>
                      {canEditTask && (
                        <button
                          onClick={() => {
                            const newGuests = (task.guests ?? []).filter(g => g !== email);
                            onUpdateField?.({ guests: newGuests });
                          }}
                          className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-red-500 transition-all rounded-md"
                        >
                          <X className="size-3.5" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Add Guest inline popover */}
              {canEditTask && (
                <Popover open={isGuestPickerOpen} onOpenChange={setIsGuestPickerOpen}>
                  <PopoverTrigger asChild>
                    <button className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground">
                      <Plus className="size-3" />
                      Add guest
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64 p-3" align="start">
                    <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Invite Guest</div>
                    <div className="flex gap-1.5">
                      <Input
                        type="email"
                        placeholder="guest@example.com"
                        value={guestEmailInput}
                        onChange={(e) => setGuestEmailInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleAddGuestInline();
                          }
                        }}
                        className="h-8 text-xs bg-background border-border text-foreground focus-visible:ring-primary/20 placeholder:text-muted-foreground/60 flex-1"
                      />
                      <button
                        type="button"
                        onClick={handleAddGuestInline}
                        className="h-8 px-2.5 rounded text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
                      >
                        Add
                      </button>
                    </div>
                  </PopoverContent>
                </Popover>
              )}
            </div>
          </div>

          <Separator />

          {/* Dates */}
          <div>
            <span className="mb-2 block text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Dates
            </span>
            {(task.start_date || task.plannedStartISO || task.plannedEndISO || task.due_date || task.dueDateISO) ? (
              <div className="space-y-1.5 text-xs">
                {(task.start_date || task.plannedStartISO) && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Start Date</span>
                    <span className="font-medium">{formatDate((task.start_date || task.plannedStartISO)!)}</span>
                  </div>
                )}
                {task.plannedEndISO && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">End Date</span>
                    <span className="font-medium">{formatDate(task.plannedEndISO)}</span>
                  </div>
                )}
                {(task.due_date || task.dueDateISO) && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Deadline</span>
                    <span className="font-medium">{formatDueDate((task.due_date || task.dueDateISO)!, task.is_all_day)}</span>
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
