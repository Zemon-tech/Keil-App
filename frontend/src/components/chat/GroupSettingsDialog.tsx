import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Settings, UserX, UserPlus, Pencil, Check, X } from "lucide-react";
import {
  useAddChannelMembers,
  useRemoveChannelMember,
  useDeleteChannel,
  useRenameChannel,
  useTransferAdmin,
} from "@/hooks/api/useChat";
import type { Channel } from "@/hooks/api/useChat";
import { useSpaceMembers } from "@/hooks/api/useSpaces";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useMe } from "@/hooks/api/useMe";
import { useChatStore } from "@/store/useChatStore";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";

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
  const renameChannel = useRenameChannel(orgId, spaceId);
  const transferAdmin = useTransferAdmin(orgId, spaceId);

  const [isRenaming, setIsRenaming] = useState(false);
  const [newName, setNewName] = useState(channel.name || "");
  const [transferTargetId, setTransferTargetId] = useState<string>("");

  const myMember = (channel.members || []).find((m) => m.id === me?.id);
  const isAdmin = myMember?.role === "admin";
  const otherChannelMembers = (channel.members || []).filter((m) => m.id !== me?.id);

  useEffect(() => {
    setNewName(channel.name || "");
  }, [channel.name]);

  useEffect(() => {
    if (confirmRemoveId === me?.id && otherChannelMembers.length > 0) {
      setTransferTargetId(otherChannelMembers[0].id);
    }
  }, [confirmRemoveId, me?.id]);

  const handleRename = () => {
    if (!newName.trim() || newName.length > 50) return;
    renameChannel.mutate(
      { channelId: channel.id, name: newName.trim() },
      {
        onSuccess: () => {
          setIsRenaming(false);
        }
      }
    );
  };

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
        <button className="flex items-center justify-center size-8 rounded-lg text-muted-foreground hover:bg-muted active:scale-90 transition-all duration-100 ease-out">
          <Settings className="size-4" />
        </button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 select-none h-9">
            {isAdmin ? (
              isRenaming ? (
                <div className="flex items-center gap-1.5 w-full pr-6">
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleRename();
                    }}
                    className="flex-1 min-w-0 px-2 py-0.5 text-sm bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-ring"
                    autoFocus
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-7 text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-950/20"
                    onClick={handleRename}
                    disabled={renameChannel.isPending}
                  >
                    <Check className="size-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-7 text-muted-foreground"
                    onClick={() => {
                      setIsRenaming(false);
                      setNewName(channel.name || "");
                    }}
                  >
                    <X className="size-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 group/title cursor-pointer w-full" onClick={() => setIsRenaming(true)}>
                  <span className="truncate pr-2">{channel.name || "Group"} Settings</span>
                  <Pencil className="size-3.5 text-muted-foreground opacity-0 group-hover/title:opacity-100 transition-opacity" />
                </div>
              )
            ) : (
              <span>{channel.name || "Group"} Settings</span>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="flex justify-between items-center mt-4">
          <h3 className="text-sm font-medium">Members ({(channel.members || []).length})</h3>
          {isAdmin && (
            <Button variant="outline" size="sm" onClick={() => setShowAdd(!showAdd)}>
              <UserPlus className="size-4 mr-1" /> Add
            </Button>
          )}
        </div>

        {isAdmin && showAdd && (
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
              const isAdminLeavingWithOthers = isSelf && isAdmin && otherChannelMembers.length > 0;
              return (
                <div
                  key={member.id}
                  className="flex flex-col gap-2 p-2.5 rounded-md bg-destructive/5 border border-destructive/10 animate-in fade-in-50 duration-150 w-full"
                >
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-semibold text-destructive">
                      {isSelf ? "Leave Group" : `Remove ${member.name || "this member"}?`}
                    </span>
                    {isAdminLeavingWithOthers ? (
                      <p className="text-[11px] text-muted-foreground leading-normal">
                        As admin, you must transfer ownership to another member before leaving.
                      </p>
                    ) : (
                      <p className="text-[11px] text-muted-foreground leading-normal">
                        Are you sure you want to {isSelf ? "leave this group" : `remove ${member.name || "this member"}`}?
                      </p>
                    )}
                  </div>

                  {isAdminLeavingWithOthers && (
                    <div className="flex flex-col gap-1 mt-1">
                      <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Select New Admin</label>
                      <NativeSelect
                        size="sm"
                        value={transferTargetId}
                        onChange={(e) => setTransferTargetId(e.target.value)}
                        className="w-full"
                      >
                        {otherChannelMembers.map((ocm) => (
                          <NativeSelectOption key={ocm.id} value={ocm.id}>
                            {ocm.name}
                          </NativeSelectOption>
                        ))}
                      </NativeSelect>
                    </div>
                  )}

                  <div className="flex justify-end gap-1.5 mt-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2.5 text-xs"
                      onClick={() => setConfirmRemoveId(null)}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="h-7 px-2.5 text-xs font-medium"
                      onClick={async () => {
                        try {
                          if (isAdminLeavingWithOthers) {
                            if (!transferTargetId) return;
                            await transferAdmin.mutateAsync({
                              channelId: channel.id,
                              newAdminId: transferTargetId,
                            });
                          }
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
                        } catch (err) {
                          // Error is handled in the mutation
                        }
                      }}
                      disabled={removeMember.isPending || transferAdmin.isPending}
                    >
                      {isAdminLeavingWithOthers ? "Transfer & Leave" : "Confirm"}
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
                  <Avatar className="size-8">
                    <AvatarFallback className="bg-primary/10 text-xs">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium flex items-center gap-1.5">
                    {member.name || "Unknown"} {isSelf && "(You)"}
                    {member.role === "admin" && (
                      <span className="text-[9px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-semibold uppercase tracking-wider">
                        Admin
                      </span>
                    )}
                  </span>
                </div>
                {(isAdmin || isSelf) && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => setConfirmRemoveId(member.id)}
                    disabled={removeMember.isPending}
                    title={isSelf ? "Leave Group" : "Remove Member"}
                  >
                    <UserX className="size-4" />
                  </Button>
                )}
              </div>
            );
          })}
        </div>

        {isAdmin && (
          confirmDelete ? (
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
          )
        )}
      </DialogContent>
    </Dialog>
  );
}
