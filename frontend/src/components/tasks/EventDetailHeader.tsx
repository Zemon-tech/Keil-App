import { useState } from "react";
import {
  Calendar,
  ChevronRight,
  MoreVertical,
  PanelRightClose,
  Pencil,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { EditableText } from "@/components/ui/editable-text";

import type { AnyStatus, EventStatus } from "@/types/task";
import type { TaskDTO, UpdateTaskInput } from "@/hooks/api/useTasks";
import { useChangeTaskStatus } from "@/hooks/api/useTasks";

import {
  EVENT_STATUS_OPTIONS,
  STATUS_COLOR,
  formatDate,
} from "./task-detail-shared";

// ─── StatusBadge ──────────────────────────────────────────────────────────────

function StatusBadge({
  status,
  onStatusChange,
}: {
  status: AnyStatus;
  onStatusChange: (s: EventStatus) => void;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Badge
          variant="outline"
          className="h-5 gap-1 px-1.5 text-[11px] cursor-pointer hover:bg-accent transition-colors"
        >
          <span className={cn("h-1.5 w-1.5 rounded-full", STATUS_COLOR[status])} />
          {status}
        </Badge>
      </PopoverTrigger>
      <PopoverContent className="w-40 p-1" align="start">
        {EVENT_STATUS_OPTIONS.map((s) => (
          <button
            key={s}
            onClick={() => onStatusChange(s)}
            className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm
                       hover:bg-accent transition-colors text-left"
          >
            <span className={cn("h-1.5 w-1.5 rounded-full", STATUS_COLOR[s])} />
            {s}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

// ─── AttendeesChip ────────────────────────────────────────────────────────────

function AttendeesChip({ assignees }: { assignees: { id: string, name: string | null, email: string }[] }) {
  if (assignees.length === 0) return null;
  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex items-center -space-x-1.5">
        {assignees.slice(0, 3).map((a) => (
          <Tooltip key={a.id}>
            <TooltipTrigger asChild>
              <Avatar className="h-5 w-5 cursor-default ring-1 ring-background">
                <AvatarFallback className="text-[9px] font-semibold bg-accent">
                  {(a.name || a.email).charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              {a.name || a.email}
            </TooltipContent>
          </Tooltip>
        ))}
        {assignees.length > 3 && (
          <Avatar className="h-5 w-5 ring-1 ring-background">
            <AvatarFallback className="text-[9px] bg-muted text-muted-foreground">
              +{assignees.length - 3}
            </AvatarFallback>
          </Avatar>
        )}
      </div>
    </TooltipProvider>
  );
}

// ─── EventDetailHeader ─────────────────────────────────────────────────────────

export function EventDetailHeader({
  event,
  onUpdateField,
  onDelete,
  onClose,
  onEditTask,
}: {
  event: TaskDTO;
  onUpdateField?: (updates: UpdateTaskInput) => void;
  onDelete?: () => void;
  onClose?: () => void;
  onEditTask?: () => void;
}) {
  const changeStatus = useChangeTaskStatus();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const handleStatusChange = (newStatus: EventStatus) => {
    changeStatus.mutate({ id: event.id, status: newStatus });
  };

  const handleMarkCompleted = () => {
    changeStatus.mutate({ id: event.id, status: "completed" });
  };

  return (
    <div className="shrink-0 border-b border-border px-5 pt-4 pb-3">
      {/* Breadcrumb + Actions row */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 flex-1 min-w-0 pr-4">
          {/* Close detail pane button */}
          {onClose && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
              onClick={onClose}
              title="Close detail pane"
            >
              <PanelRightClose className="h-3.5 w-3.5" />
            </Button>
          )}

          <Breadcrumb className="flex-1 min-w-0">
            <BreadcrumbList className="text-sm items-center flex-nowrap shrink-0">
              <BreadcrumbItem className="hidden sm:block">
                <span
                  className="cursor-pointer font-medium text-muted-foreground hover:text-foreground transition-colors"
                  onClick={onClose}
                >
                  Tasks
                </span>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden sm:block">
                <ChevronRight className="h-4 w-4" />
              </BreadcrumbSeparator>
              <BreadcrumbItem>
                <span className="font-medium text-muted-foreground">
                  Events
                </span>
              </BreadcrumbItem>
              <BreadcrumbSeparator>
                <ChevronRight className="h-4 w-4" />
              </BreadcrumbSeparator>
              <BreadcrumbItem className="flex-1 min-w-0">
                <EditableText
                  value={event.title}
                  onSave={(title) => onUpdateField?.({ title })}
                  placeholder="Untitled event"
                  className="text-sm font-medium text-foreground truncate"
                  inputClassName="text-sm font-medium text-foreground truncate"
                />
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            variant={event.status === "completed" ? "secondary" : "default"}
            className="h-6 px-3 text-xs"
            onClick={handleMarkCompleted}
            disabled={event.status === "completed" || changeStatus.isPending}
          >
            {event.status === "completed" ? "Completed ✓" : "Mark completed"}
          </Button>

          {/* Actions dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                <MoreVertical className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onClick={() => onEditTask?.()}>
                <Pencil className="mr-2 h-3.5 w-3.5" />
                Edit event
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => setDeleteDialogOpen(true)}
              >
                <Trash2 className="mr-2 h-3.5 w-3.5" />
                Delete event
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Chips row */}
      <div className="flex flex-wrap items-center gap-1.5">
        <StatusBadge status={event.status} onStatusChange={handleStatusChange} />
        {event.event_type && (
          <Badge variant="secondary" className="h-5 px-1.5 text-[11px] capitalize">
            {event.event_type}
          </Badge>
        )}
        <AttendeesChip assignees={event.assignees ?? []} />

        {(event.start_date || event.due_date || event.dueDateISO) && (
          <Badge variant="outline" className="h-5 gap-1 px-1.5 text-[11px]">
            <Calendar className="h-3 w-3" />
            {formatDate(event.start_date || event.due_date || event.dueDateISO!)}
          </Badge>
        )}
      </div>

      {/* Delete confirmation dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete event</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>"{event.title}"</strong>? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => onDelete?.()}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
