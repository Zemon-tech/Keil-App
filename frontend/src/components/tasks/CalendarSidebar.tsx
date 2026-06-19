// src/components/tasks/CalendarSidebar.tsx
import { useState } from "react";
import {
  Calendar as CalendarIcon,
  Clock as ClockIcon,
  Copy as CopyIcon,
  Trash2 as TrashIcon,
  Pencil as PencilIcon,
  CalendarClock as CalendarClockIcon,
  X as XIcon,
  Loader2,
  MapPin,
  ChevronDown,
  ExternalLink,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getOptimizedImageUrl } from "@/lib/image-optimizer";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CreateTaskDialog } from "./CreateTaskDialog";
import {
  useOrgTask,
  useUpdateOrgTask,
  useDeleteOrgTask,
  useChangeOrgTaskStatus,
  useOrgTasks,
  type TaskDTO,
} from "@/hooks/api/useTasks";
import { useSpaceMembers } from "@/hooks/api/useSpaces";
import { useMotionPages } from "@/hooks/api/useMotionPages";
import { renderMessageContent, tiptapJsonToPlainText } from "./renderMessageContent";
import type { CalendarBlock, TaskStatus } from "@/types/task";
import { useAppContext } from "@/contexts/AppContext";
import { toast } from "sonner";

interface CalendarSidebarProps {
  taskId: string;
  orgId?: string;
  spaceId?: string;
  onClose: () => void;
  tasks?: TaskDTO[];
  blocks?: CalendarBlock[];
  onUnschedule?: (taskId: string) => void;
  onStatusChange?: (taskId: string, newStatus: string) => void;
}

const taskStatusColors: Record<string, string> = {
  todo: "bg-violet-500/10 text-violet-400 border-violet-500/20",
  "in-progress": "bg-blue-500/10 text-blue-400 border-blue-500/20",
  done: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  completed: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  backlog: "bg-red-500/10 text-red-400 border-red-500/20",
  confirmed: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  tentative: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  cancelled: "bg-red-500/10 text-red-400 border-red-500/20",
};

export function CalendarSidebar({
  taskId,
  orgId,
  spaceId,
  onClose,
  onUnschedule,
  onStatusChange,
}: CalendarSidebarProps) {
  const { activeOrgId, activeSpaceId } = useAppContext();
  const resolvedOrgId = orgId || activeOrgId;
  const resolvedSpaceId = spaceId || activeSpaceId;
  const navigate = useNavigate();

  const handleViewFullDetails = () => {
    if (task) {
      const routeBase = task.type === "event" ? "events" : "tasks";
      navigate(`/${routeBase}/${task.id}`);
    }
  };

  // Selected task data queries
  const { data: task, isLoading } = useOrgTask(resolvedOrgId, resolvedSpaceId, taskId);
  const updateTask = useUpdateOrgTask(resolvedOrgId, resolvedSpaceId);
  const deleteTask = useDeleteOrgTask(resolvedOrgId, resolvedSpaceId);
  const changeTaskStatus = useChangeOrgTaskStatus(resolvedOrgId, resolvedSpaceId);

  const { data: members = [] } = useSpaceMembers(resolvedOrgId, resolvedSpaceId);
  const { data: allTasks = [] } = useOrgTasks(resolvedOrgId, resolvedSpaceId);
  const { data: pages = [] } = useMotionPages(resolvedOrgId, resolvedSpaceId);

  const [editDialogOpen, setEditDialogOpen] = useState(false);

  const handleCopyDetails = () => {
    if (!task) return;
    const textToCopy = `${task.title}\n${task.description || ""}`;
    navigator.clipboard.writeText(textToCopy);
    toast.success("Copied to clipboard");
  };

  const handleDelete = () => {
    if (task && confirm(`Are you sure you want to delete this ${task.type === "event" ? "event" : "task"}?`)) {
      deleteTask.mutate({ id: taskId, title: task.title, type: task.type });
      onClose();
    }
  };

  const handleUnschedule = () => {
    updateTask.mutate({ id: taskId, updates: { start_date: null, due_date: null } });
    onUnschedule?.(taskId);
    onClose();
  };

  return (
    <div className="w-[320px] border-l border-border/60 bg-card/40 backdrop-blur-md h-full flex flex-col shrink-0 overflow-y-auto select-none">
      {/* ── BOTTOM SECTION: DETAILS VIEW ── */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col">
        {!taskId ? (
          /* Empty State */
          <div className="flex-1 flex flex-col items-center justify-center py-12 text-center text-muted-foreground gap-2">
            <CalendarClockIcon className="size-8 opacity-25 text-muted-foreground" />
            <h4 className="text-xs font-semibold">No event selected</h4>
            <p className="text-[11px] opacity-75 max-w-[200px] leading-relaxed">
              Click any scheduled event on the calendar to view its details here.
            </p>
          </div>
        ) : isLoading ? (
          /* Loading State */
          <div className="flex-1 flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
            <Loader2 className="size-5 animate-spin" />
            <span className="text-xs">Loading details…</span>
          </div>
        ) : task ? (
          /* Rendered Details */
          <div className="flex flex-col gap-4">
            {/* Header Action Row */}
            <div className="flex items-center justify-between gap-2 border-b border-border/30 pb-2">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                {task.type} details
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={handleViewFullDetails}
                  title="View full details"
                  className="p-1.5 hover:bg-muted rounded-md text-muted-foreground hover:text-foreground active:scale-90 duration-100"
                >
                  <ExternalLink className="size-3.5" />
                </button>
                <button
                  onClick={handleCopyDetails}
                  title="Copy details"
                  className="p-1.5 hover:bg-muted rounded-md text-muted-foreground hover:text-foreground active:scale-90 duration-100"
                >
                  <CopyIcon className="size-3.5" />
                </button>
                <button
                  onClick={() => setEditDialogOpen(true)}
                  title="Edit details"
                  className="p-1.5 hover:bg-muted rounded-md text-muted-foreground hover:text-foreground active:scale-90 duration-100"
                >
                  <PencilIcon className="size-3.5" />
                </button>
                <button
                  onClick={handleDelete}
                  title="Delete"
                  className="p-1.5 hover:bg-red-500/10 rounded-md text-muted-foreground hover:text-red-500 active:scale-90 duration-100"
                >
                  <TrashIcon className="size-3.5" />
                </button>
                <button
                  onClick={onClose}
                  title="Close panel"
                  className="p-1.5 hover:bg-muted rounded-md text-muted-foreground hover:text-foreground active:scale-90 duration-100 ml-0.5"
                >
                  <XIcon className="size-3.5" />
                </button>
              </div>
            </div>

            {/* Event Title */}
            <div>
              <h3 className="font-bold text-lg leading-snug text-foreground break-words select-text">
                {task.title || (task.type === "event" ? "Untitled event" : "Untitled task")}
              </h3>
            </div>

            {/* Meta Rows (Date, Time, Notification) */}
            <div className="flex flex-col gap-2.5 text-xs text-foreground/80 font-medium">
              {task.start_date && (
                <div className="flex items-center gap-2.5">
                  <CalendarIcon className="size-4 text-muted-foreground shrink-0" />
                  <span>{format(new Date(task.start_date), "EEEE, MMMM d, yyyy")}</span>
                </div>
              )}
              {task.start_date && (
                <div className="flex items-center gap-2.5">
                  <ClockIcon className="size-4 text-muted-foreground shrink-0" />
                  <span>
                    {task.is_all_day
                      ? "All Day"
                      : `${format(new Date(task.start_date), "h:mm a")} - ${task.due_date ? format(new Date(task.due_date), "h:mm a") : ""}`}
                  </span>
                </div>
              )}
              {task.location && (
                <div className="flex items-center gap-2.5">
                  <MapPin className="size-4 text-muted-foreground shrink-0" />
                  <span className="truncate break-all select-text">{task.location}</span>
                </div>
              )}
            </div>

            {/* Assignees & Status */}
            <div className="border-t border-b border-border/30 py-3 flex flex-col gap-3">
              {/* Assignees */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                  Assignees
                </span>
                {task.assignees && task.assignees.length > 0 ? (
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <div className="flex items-center -space-x-1.5 overflow-hidden py-0.5">
                        {task.assignees.slice(0, 5).map((a) => (
                          <TooltipProvider key={a.id}>
                            <Tooltip delayDuration={200}>
                              <TooltipTrigger asChild>
                                <Avatar className="size-6 border-2 border-background relative shrink-0">
                                  <AvatarImage
                                    src={getOptimizedImageUrl(a.avatar_url || a.avatarUrl, { width: 48, height: 48 })}
                                    alt={a.name || a.email}
                                  />
                                  <AvatarFallback className="text-[9px] bg-primary/10 text-primary font-semibold">
                                    {a.name?.charAt(0) || a.email.charAt(0).toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>
                              </TooltipTrigger>
                              <TooltipContent side="bottom" className="text-xs">
                                {a.name || a.email}
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        ))}
                        {task.assignees.length > 5 && (
                          <div className="size-6 rounded-full bg-muted flex items-center justify-center text-[9px] font-semibold border-2 border-background relative z-10 text-muted-foreground shrink-0">
                            +{task.assignees.length - 5}
                          </div>
                        )}
                      </div>
                    </div>
                    <span className="text-[10px] text-muted-foreground font-medium">
                      {task.assignees.length} {task.assignees.length === 1 ? "assignee" : "assignees"}
                    </span>
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground/60 italic">Unassigned</span>
                )}
              </div>

              {/* Status */}
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                  Status
                </span>
                <div className="flex items-center mt-0.5">
                  {task.type === "event" ? (
                    <span
                      className={cn(
                        "inline-flex items-center px-2.5 py-0.5 h-6 text-[10px] font-semibold rounded-md border capitalize",
                        taskStatusColors[task.status] || "bg-zinc-500/10 text-zinc-400 border-zinc-500/20"
                      )}
                    >
                      {task.status}
                    </span>
                  ) : (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          className={cn(
                            "flex items-center justify-between px-2.5 py-0.5 h-6 text-[10px] font-semibold rounded-md border text-left cursor-pointer transition-all duration-200 capitalize w-28",
                            taskStatusColors[task.status] || "bg-zinc-500/10 text-zinc-400 border-zinc-500/20 hover:bg-zinc-500/20"
                          )}
                        >
                          <span className="truncate">{task.status.replace("-", " ")}</span>
                          <ChevronDown className="size-3 shrink-0 ml-0.5 opacity-70" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start">
                        {(["todo", "in-progress", "done", "backlog"] as TaskStatus[]).map((s) => (
                          <DropdownMenuItem
                            key={s}
                            onClick={() => {
                              changeTaskStatus.mutate({ id: taskId, status: s });
                              onStatusChange?.(taskId, s);
                            }}
                            className="capitalize text-xs cursor-pointer"
                          >
                            {s.replace("-", " ")}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </div>
            </div>

            {/* Description / About this event */}
            {(task.description || task.objective) && (
              <div className="flex flex-col gap-1.5 flex-1">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                  About this event
                </span>
                <div className="text-xs sm:text-sm text-foreground/80 leading-relaxed font-normal select-text break-words pr-2 whitespace-pre-wrap">
                  {renderMessageContent(
                    tiptapJsonToPlainText(task.description || task.objective || ""),
                    allTasks,
                    (targetTaskId) => navigate(`/${allTasks.find(t => t.id === targetTaskId)?.type === "event" ? "events" : "tasks"}/${targetTaskId}`),
                    members,
                    (pageId) => navigate(`/motion/${pageId}`),
                    pages
                  )}
                </div>
              </div>
            )}

            {/* Actions: Unschedule */}
            {(task.start_date || task.due_date) && (
              <button
                onClick={handleUnschedule}
                className="mt-2 text-xs font-semibold text-muted-foreground hover:text-foreground text-left py-1 hover:underline transition-colors w-max"
              >
                Unschedule this task
              </button>
            )}

            {/* View Full Details Button */}
            <button
              onClick={handleViewFullDetails}
              className="mt-2 w-full flex items-center justify-center gap-2 py-2 px-4 bg-primary text-primary-foreground font-semibold rounded-xl text-xs hover:bg-primary/95 active:scale-[0.98] transition-all shadow-md shadow-primary/10 cursor-pointer"
            >
              <ExternalLink className="size-3.5" />
              <span>View Full Details</span>
            </button>

            {/* Edit Dialog Toggle */}
            {task && (
              <CreateTaskDialog
                open={editDialogOpen}
                onOpenChange={(isOpen) => {
                  setEditDialogOpen(isOpen);
                }}
                mode="edit"
                taskId={taskId}
                initialValues={task}
                onTaskUpdated={() => {
                  setEditDialogOpen(false);
                }}
                orgId={resolvedOrgId ?? undefined}
                spaceId={resolvedSpaceId ?? undefined}
              />
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center py-8">
            <p className="text-sm text-muted-foreground">Details not found.</p>
          </div>
        )}
      </div>
    </div>
  );
}
