import { useState } from "react";
import { Plus, Search, X, Video } from "lucide-react";
import { format, subDays, startOfDay } from "date-fns";
import { toast } from "sonner";


import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { EditableTextarea } from "@/components/ui/editable-text";

import type { TaskDTO, UpdateTaskInput } from "@/hooks/api/useTasks";
import { useAssignOrgUser, useRemoveOrgAssignee } from "@/hooks/api/useTasks";
import { useSpaceMembers } from "@/hooks/api/useSpaces";
import { useAppContext } from "@/contexts/AppContext";

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
    const currentGuests = event.guests ?? [];
    if (currentGuests.includes(email)) {
      toast.error("Guest already added");
      return;
    }
    onUpdateField?.({ guests: [...currentGuests, email] });
    setGuestEmailInput("");
    setIsGuestPickerOpen(false);
  };

  const { activeOrgId, activeSpaceId } = useAppContext();
  const { data: members = [] } = useSpaceMembers(
    activeOrgId,
    activeSpaceId
  );
  const assignUser = useAssignOrgUser(activeOrgId, activeSpaceId);
  const removeAssignee = useRemoveOrgAssignee(activeOrgId, activeSpaceId);

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

          {/* Google Meet Link */}
          {event.meet_link && (
            <div>
              <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Conference Link
              </span>
              <a
                href={event.meet_link}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-600 transition-colors shadow-md shadow-emerald-500/10 mt-1 cursor-pointer"
              >
                <Video className="size-4 shrink-0" />
                <span>Join Google Meet</span>
              </a>
            </div>
          )}

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
                      <Avatar className="size-6">
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
                      <X className="size-3.5" />
                    </button>
                  </div>
                );
              })}

              {/* Attendee picker */}
              {true && (
                <Popover open={isAssigneePickerOpen} onOpenChange={setIsAssigneePickerOpen}>
                  <PopoverTrigger asChild>
                    <button className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground">
                      <Plus className="size-3" />
                      Add attendee
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
                      {members
                        .filter(m => !(event.assignees ?? []).some(a => a.id === m.user_id))
                        .filter(m => (m.name || m.email).toLowerCase().includes(assigneeSearch.toLowerCase()))
                        .map((m) => {
                          const mName = m.name || m.email;
                          return (
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
                        })
                      }
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
                {(event.guests ?? []).map((email) => {
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
                      <button
                        onClick={() => {
                          const newGuests = (event.guests ?? []).filter(g => g !== email);
                          onUpdateField?.({ guests: newGuests });
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-red-500 transition-all rounded-md"
                      >
                        <X className="size-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Add Guest inline popover */}
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
                    ? format(
                      event.is_all_day
                        ? subDays(startOfDay(new Date(event.due_date || event.dueDateISO!)), 1)
                        : new Date(event.due_date || event.dueDateISO!),
                      event.is_all_day ? "d MMM" : "d MMM, h:mm a"
                    )
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
