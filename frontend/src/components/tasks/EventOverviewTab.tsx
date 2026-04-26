import { useState } from "react";
import { Plus, Search, X } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { EditableTextarea } from "@/components/ui/editable-text";

import type { TaskDTO, UpdateTaskInput } from "@/hooks/api/useTasks";
import { useAssignUser, useRemoveAssignee } from "@/hooks/api/useTasks";
import { useWorkspaceMembers } from "@/hooks/api/useWorkspace";

import { BulletListEditor } from "./BulletListEditor";
import { TaskContextSection } from "./TaskContextSection";

export const EventOverviewTab = ({
  event,
  onUpdateEvent,
  onUpdateField,
}: {
  event: TaskDTO;
  onUpdateEvent?: (id: string, updates: any) => void;
  onUpdateField?: (updates: UpdateTaskInput) => void;
}) => {
  const [isAssigneePickerOpen, setIsAssigneePickerOpen] = useState(false);
  const [assigneeSearch, setAssigneeSearch] = useState("");

  const { data: members } = useWorkspaceMembers(event.workspace_id);
  const assignUser = useAssignUser();
  const removeAssignee = useRemoveAssignee();

  const handleAssignUser = (userId: string) => {
    assignUser.mutate({ id: event.id, userId });
  };

  const handleRemoveAssignee = (userId: string) => {
    removeAssignee.mutate({ id: event.id, userId });
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
              value={event.description ?? ""}
              onSave={(description) => onUpdateField?.({ description })}
              placeholder="Add a description..."
              minRows={2}
            />
          </div>

          {/* Agenda / Notes */}
          <div className="bg-background p-4 min-h-[120px] rounded-md border border-border/40">
            <BulletListEditor
              title="Agenda / Notes"
              value={event.objective ?? ""}
              onSave={(objective) => onUpdateField?.({ objective })}
              placeholder="No agenda points set"
            />
          </div>

          {/* Location / Link */}
          <div>
            <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Location / Link
            </span>
            <EditableTextarea
              value={event.location ?? ""}
              onSave={(location) => onUpdateField?.({ location })}
              placeholder="Add location or meeting link..."
              minRows={1}
            />
          </div>

          {/* Event Type */}
          <div>
            <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Event Type
            </span>
            <div className="flex">
              <Badge variant="secondary" className="h-6 px-2.5 text-[12px] capitalize">
                {event.event_type || "Event"}
              </Badge>
            </div>
          </div>

          {/* Context */}
          <TaskContextSection task={event} onUpdateTask={onUpdateEvent} />
        </div>
      </ScrollArea>

      {/* RIGHT: Sidebar */}
      <ScrollArea className="w-full shrink-0 md:w-[280px] lg:w-[300px]">
        <div className="space-y-5 p-5 pl-6">
          {/* Attendees */}
          <div>
            <span className="mb-2 block text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Attendees
            </span>
            <div className="space-y-1.5">
              {(event.assignees ?? []).map((a) => {
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
                    Add attendee
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
                      ?.filter(m => !(event.assignees ?? []).some(a => a.id === m.user_id))
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
            <div className="space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Start</span>
                <span className="font-medium">
                  {event.start_date || event.plannedStartISO 
                    ? format(new Date(event.start_date || event.plannedStartISO!), event.is_all_day ? "d MMM" : "d MMM, h:mm a") 
                    : "—"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">End</span>
                <span className="font-medium">
                  {event.due_date || event.dueDateISO 
                    ? format(new Date(event.due_date || event.dueDateISO!), event.is_all_day ? "d MMM" : "d MMM, h:mm a") 
                    : "—"}
                </span>
              </div>
            </div>
          </div>

        </div>
      </ScrollArea>
    </div>
  );
};
