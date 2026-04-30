import { useState } from "react";
import { format, isSameDay } from "date-fns";
import { 
  X, 
  Pencil, 
  Trash2, 
  MoreHorizontal, 
  Clock, 
  MapPin, 
  Users, 
  Calendar, 
  Phone, 
  Brain, 
  CheckSquare,
  Loader2
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuPortal,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { 
  useTask, 
  useUpdateTask, 
  useDeleteTask,
  useChangeTaskStatus 
} from "@/hooks/api/useTasks";
import { STATUS_COLOR } from "./task-detail-shared";
import type { TaskStatus, EventStatus, AnyStatus } from "@/types/task";

// ─── Props ────────────────────────────────────────────────────────────────────

interface EventPreviewDialogProps {
  eventId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUnschedule?: (eventId: string) => void;
  onStatusChange?: (eventId: string, newStatus: string) => void;
  position?: { x: number; y: number } | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTimeCompact(startISO?: string | null, endISO?: string | null, isAllDay?: boolean) {
  if (!startISO) return null;
  const start = new Date(startISO);
  const dateStr = format(start, "MMM d");
  
  if (isAllDay) return `${dateStr} · All Day`;
  
  const timeStart = format(start, "h:mm a").replace(":00", "");
  
  if (endISO) {
    const end = new Date(endISO);
    if (isSameDay(start, end)) {
      const timeEnd = format(end, "h:mm a").replace(":00", "");
      return `${dateStr} · ${timeStart}–${timeEnd}`;
    }
  }
  return `${dateStr} · ${timeStart}`;
}

const getEventIcon = (type?: string | null, eventType?: string | null) => {
  if (type === "task") return <CheckSquare className="w-4 h-4 text-primary shrink-0" />;
  switch (eventType) {
    case "meeting": return <Users className="w-4 h-4 text-blue-500 shrink-0" />;
    case "call": return <Phone className="w-4 h-4 text-green-500 shrink-0" />;
    case "focus": return <Brain className="w-4 h-4 text-purple-500 shrink-0" />;
    default: return <Calendar className="w-4 h-4 text-orange-500 shrink-0" />;
  }
};

// ─── EventPreviewDialog ───────────────────────────────────────────────────────

export function EventPreviewDialog({
  eventId,
  open,
  onOpenChange,
  onUnschedule,
  onStatusChange,
  position,
}: EventPreviewDialogProps) {
  const navigate = useNavigate();
  const { data: event, isLoading } = useTask(eventId);
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const changeTaskStatus = useChangeTaskStatus();

  const [descExpanded, setDescExpanded] = useState(false);

  const handleNavigateToEvent = () => {
    onOpenChange(false);
    navigate(`/tasks?taskId=${eventId}`);
  };

  const handleUnschedule = () => {
    updateTask.mutate({
      id: eventId,
      updates: { start_date: null, due_date: null },
    });
    onUnschedule?.(eventId);
    onOpenChange(false);
  };

  const handleDelete = () => {
    if (confirm("Are you sure you want to delete this event?")) {
      deleteTask.mutate(eventId);
      onOpenChange(false);
    }
  };

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/5"
        onClick={() => onOpenChange(false)}
      />

      {/* Dialog content with absolute positioning */}
      <div
        className="fixed z-50 max-w-[340px] w-full bg-background rounded-xl border shadow-xl flex group cursor-pointer hover:shadow-2xl transition-all duration-200 overflow-hidden"
        style={{
          left: position?.x ?? '50%',
          top: position?.y ?? '50%',
          transform: position ? 'none' : 'translate(-50%, -50%)',
        }}
        onClick={handleNavigateToEvent}
      >
        {/* Left colored border for status indication */}
        <div 
          className={cn(
            "w-1.5 shrink-0 transition-colors", 
            event ? STATUS_COLOR[event.status as AnyStatus] : "bg-border"
          )} 
        />
        
        <div className="flex-1 flex flex-col p-4 gap-3 relative min-h-[120px]">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-6 h-full text-muted-foreground gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-xs">Loading event…</span>
            </div>
          ) : event ? (
            <>
              {/* TOP RIGHT ACTIONS */}
              <div className="absolute top-2 right-2 flex items-center gap-0.5">
                {/* Actions that fade in on hover */}
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity mr-1">
                  <TooltipProvider>
                    <Tooltip delayDuration={300}>
                      <TooltipTrigger asChild>
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleNavigateToEvent(); }} 
                          className="p-1.5 hover:bg-muted rounded text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top">Edit</TooltipContent>
                    </Tooltip>

                    <Tooltip delayDuration={300}>
                      <TooltipTrigger asChild>
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleDelete(); }} 
                          className="p-1.5 hover:bg-red-500/10 rounded text-muted-foreground hover:text-red-500 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top">Delete</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button 
                        onClick={(e) => e.stopPropagation()} 
                        className="p-1.5 hover:bg-muted rounded text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <MoreHorizontal className="w-3.5 h-3.5" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                      {(event.start_date || event.due_date) && (
                        <DropdownMenuItem onClick={handleUnschedule}>
                          Unschedule
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSub>
                        <DropdownMenuSubTrigger>Change Status</DropdownMenuSubTrigger>
                        <DropdownMenuPortal>
                          <DropdownMenuSubContent>
                            {["confirmed", "tentative", "completed", "cancelled"].map((s) => (
                              <DropdownMenuItem key={s} onClick={() => {
                                changeTaskStatus.mutate({ id: eventId, status: s as AnyStatus });
                                onStatusChange?.(eventId, s);
                              }}>
                                <span className="capitalize">{s}</span>
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuSubContent>
                        </DropdownMenuPortal>
                      </DropdownMenuSub>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* Close always visible */}
                <button 
                  onClick={(e) => { e.stopPropagation(); onOpenChange(false); }} 
                  className="p-1.5 hover:bg-muted rounded text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* 1. TITLE & EVENT TYPE */}
              <div className="flex items-start gap-2 pr-20">
                <div className="mt-0.5">
                  {getEventIcon(event.type, event.event_type)}
                </div>
                <h3 className="font-semibold text-[15px] leading-tight text-foreground line-clamp-2">
                  {event.title || "Untitled event"}
                </h3>
              </div>

              {/* 2. TIME */}
              {event.start_date && (
                <div className="flex items-center gap-2 text-[13px] text-foreground/80 font-medium">
                  <Clock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <span>{formatTimeCompact(event.start_date, event.due_date, event.is_all_day)}</span>
                </div>
              )}

              {/* 3. ASSIGNED PEOPLE */}
              {event.assignees && event.assignees.length > 0 && (
                <div className="flex items-center gap-2 mt-0.5">
                  <Users className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  
                  {event.assignees.length === 1 ? (
                    <span className="text-xs text-muted-foreground truncate">
                      {event.assignees[0].name || event.assignees[0].email}
                    </span>
                  ) : (
                    <TooltipProvider>
                      <Tooltip delayDuration={200}>
                        <TooltipTrigger asChild>
                          <div 
                            className="flex items-center -space-x-1.5 hover:space-x-0 transition-all duration-200"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {event.assignees.slice(0, 3).map(a => (
                              <Avatar key={a.id} className="w-5 h-5 border-[1.5px] border-background relative hover:z-10 transition-all">
                                <AvatarFallback className="text-[9px] bg-primary/10 text-primary">
                                  {a.name?.charAt(0) || a.email.charAt(0).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                            ))}
                            {event.assignees.length > 3 && (
                              <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-[9px] font-medium border-[1.5px] border-background relative z-10">
                                +{event.assignees.length - 3}
                              </div>
                            )}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent className="flex flex-col gap-1 p-2" side="bottom">
                          {event.assignees.map(a => (
                            <div key={a.id} className="text-xs">{a.name || a.email}</div>
                          ))}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </div>
              )}

              {/* 4. DESCRIPTION */}
              {(event.description || event.objective) && (
                <div 
                  className="mt-0.5" 
                  onClick={(e) => { 
                    const content = event.description || event.objective || "";
                    if (content.length > 80) {
                      e.stopPropagation(); 
                      setDescExpanded(!descExpanded); 
                    }
                  }}
                >
                  <p className={cn(
                    "text-xs text-muted-foreground leading-relaxed transition-all",
                    !descExpanded && "line-clamp-2"
                  )}>
                    {(event.description || event.objective)?.replace(/^•\s*/gm, "")}
                  </p>
                </div>
              )}

              {/* 5. LOCATION */}
              {event.location && (
                <div className="flex items-start gap-2 text-xs text-muted-foreground/80 mt-0.5">
                  <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span className="truncate">{event.location}</span>
                </div>
              )}
            </>
          ) : (
            <div className="flex items-center justify-center py-6 h-full">
              <p className="text-sm text-muted-foreground">Event not found.</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
