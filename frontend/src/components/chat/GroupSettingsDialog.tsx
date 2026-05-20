import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Settings, UserX, UserPlus } from "lucide-react";
import { useAddChannelMembers, useRemoveChannelMember, useDeleteChannel } from "@/hooks/api/useChat";
import type { Channel } from "@/hooks/api/useChat";
import { useSpaceMembers } from "@/hooks/api/useSpaces";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useMe } from "@/hooks/api/useMe";
import { useChatStore } from "@/store/useChatStore";

interface GroupSettingsDialogProps {
  channel: Channel;
  orgId: string | null;
  spaceId: string | null;
}

export function GroupSettingsDialog({ channel, orgId, spaceId }: GroupSettingsDialogProps) {
  const [open, setOpen] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);

  const { data: me } = useMe();
  const { setActiveChannel } = useChatStore();
  const { data: spaceMembers = [] } = useSpaceMembers(orgId, spaceId);

  const addMembers = useAddChannelMembers(orgId, spaceId);
  const removeMember = useRemoveChannelMember(orgId, spaceId);
  const deleteChannel = useDeleteChannel(orgId, spaceId);

  const handleAdd = (userId: string) => {
    addMembers.mutate(
      { channelId: channel.id, member_ids: [userId] },
      { onSuccess: () => setShowAdd(false) }
    );
  };

  // Space members not already in the channel
  const availableToAdd = spaceMembers.filter(
    (sm) => !(channel.members || []).some((cm) => cm.id === sm.user_id)
  );

  return (
    <Dialog 
      open={open} 
      onOpenChange={(val) => {
        setOpen(val);
        if (!val) {
          setConfirmDelete(false);
          setConfirmRemoveId(null);
          setShowAdd(false);
        }
      }}
    >
      <DialogTrigger asChild>
        <button className="p-1.5 text-muted-foreground hover:bg-muted rounded-md transition-colors">
          <Settings className="w-4 h-4" />
        </button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{channel.name || "Group"} Settings</DialogTitle>
        </DialogHeader>

        <div className="flex justify-between items-center mt-4">
          <h3 className="text-sm font-medium">Members ({(channel.members || []).length})</h3>
          <Button variant="outline" size="sm" onClick={() => setShowAdd(!showAdd)}>
            <UserPlus className="w-4 h-4 mr-1" /> Add
          </Button>
        </div>

        {showAdd && (
          <div className="mt-2 p-2 border rounded-md max-h-40 overflow-y-auto">
            <h4 className="text-xs font-semibold text-muted-foreground mb-2 px-1">
              Add to Group
            </h4>
            {availableToAdd.length === 0 ? (
              <p className="text-xs text-muted-foreground p-1">No one left to add.</p>
            ) : (
              availableToAdd.map((sm) => (
                <div
                  key={sm.user_id}
                  className="flex justify-between items-center py-1 border-b last:border-0"
                >
                  <span className="text-sm">{sm.name || sm.email}</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6"
                    onClick={() => handleAdd(sm.user_id)}
                    disabled={addMembers.isPending}
                  >
                    Add
                  </Button>
                </div>
              ))
            )}
          </div>
        )}

        <div className="mt-4 max-h-[300px] overflow-y-auto space-y-2">
          {(channel.members || []).map((member) => {
            const initials = member.name ? member.name.charAt(0).toUpperCase() : "?";
            const isSelf = member.id === me?.id;
            
            if (confirmRemoveId === member.id) {
              return (
                <div
                  key={member.id}
                  className="flex items-center justify-between p-2 rounded-md bg-destructive/5 border border-destructive/10 animate-in fade-in-50 duration-150"
                >
                  <span className="text-xs font-medium text-destructive">
                    Remove {isSelf ? "yourself" : member.name || "this member"}?
                  </span>
                  <div className="flex gap-1.5">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-xs"
                      onClick={() => setConfirmRemoveId(null)}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="h-7 px-2 text-xs"
                      onClick={() => {
                        removeMember.mutate(
                          { channelId: channel.id, userId: member.id },
                          {
                            onSuccess: () => {
                              setConfirmRemoveId(null);
                              if (isSelf) {
                                setActiveChannel(null);
                                setOpen(false);
                              }
                            }
                          }
                        );
                      }}
                      disabled={removeMember.isPending}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              );
            }

            return (
              <div
                key={member.id}
                className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50"
              >
                <div className="flex items-center gap-2">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-primary/10 text-xs">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium">{member.name || "Unknown"} {isSelf && "(You)"}</span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => setConfirmRemoveId(member.id)}
                  disabled={removeMember.isPending}
                  title="Remove Member"
                >
                  <UserX className="w-4 h-4" />
                </Button>
              </div>
            );
          })}
        </div>

        {confirmDelete ? (
          <div className="mt-6 p-4 border border-destructive/20 bg-destructive/5 rounded-lg flex flex-col gap-3 animate-in slide-in-from-bottom-2 duration-200">
            <p className="text-xs text-destructive font-medium">
              Are you sure you want to delete this group? All messages and history will be permanently deleted.
            </p>
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="outline" onClick={() => setConfirmDelete(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => {
                  deleteChannel.mutate(channel.id, {
                    onSuccess: () => {
                      setActiveChannel(null);
                      setOpen(false);
                    }
                  });
                }}
                disabled={deleteChannel.isPending}
              >
                Yes, Delete Group
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-6 pt-4 border-t flex justify-end">
            <Button
              variant="destructive"
              onClick={() => setConfirmDelete(true)}
            >
              Delete Group
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
