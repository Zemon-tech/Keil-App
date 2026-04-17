import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Settings, UserX, UserPlus } from "lucide-react";
import { useAddChannelMembers, useRemoveChannelMember } from "@/hooks/api/useChat";
import type { Channel } from "@/hooks/api/useChat";
import { useWorkspaceMembers } from "@/hooks/api/useWorkspace";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface GroupSettingsDialogProps {
  channel: Channel;
}

export function GroupSettingsDialog({ channel }: GroupSettingsDialogProps) {
  const [open, setOpen] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  
  const { workspaceId } = useWorkspace();
  const { data: workspaceMembers } = useWorkspaceMembers(workspaceId ?? undefined);
  
  const addMembers = useAddChannelMembers();
  const removeMember = useRemoveChannelMember();

  const handleRemove = (userId: string) => {
    if (confirm("Are you sure you want to remove this member?")) {
      removeMember.mutate({ channelId: channel.id, userId });
    }
  };

  const handleAdd = (userId: string) => {
    addMembers.mutate({ channelId: channel.id, member_ids: [userId] }, {
      onSuccess: () => setShowAdd(false)
    });
  };

  // Find workspace members who are NOT already in the channel
  const availableToAdd = workspaceMembers?.filter(
    wm => !channel.members.some(cm => cm.id === wm.user.id)
  ) || [];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="p-1.5 text-muted-foreground hover:bg-muted rounded-md transition-colors">
          <Settings className="w-4 h-4" />
        </button>
      </DialogTrigger>
      
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{channel.name || "Group"} Settings</DialogTitle>
        </DialogHeader>

        <div className="flex justify-between items-center mt-4">
          <h3 className="text-sm font-medium">Members ({channel.members.length})</h3>
          <Button variant="outline" size="sm" onClick={() => setShowAdd(!showAdd)}>
            <UserPlus className="w-4 h-4 mr-1" /> Add
          </Button>
        </div>

        {showAdd && (
          <div className="mt-2 p-2 border rounded-md max-h-40 overflow-y-auto">
            <h4 className="text-xs font-semibold text-muted-foreground mb-2 px-1">Add to Group</h4>
            {availableToAdd.length === 0 ? (
              <p className="text-xs text-muted-foreground p-1">No one left to add.</p>
            ) : (
              availableToAdd.map(wm => (
                <div key={wm.id} className="flex justify-between items-center py-1 border-b last:border-0">
                  <span className="text-sm">{wm.user.name || wm.user.email}</span>
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    className="h-6"
                    onClick={() => handleAdd(wm.user.id)}
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
          {channel.members.map(member => {
            const initials = member.name ? member.name.charAt(0).toUpperCase() : '?';
            return (
              <div key={member.id} className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50">
                <div className="flex items-center gap-2">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-primary/10 text-xs">{initials}</AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium">{member.name || 'Unknown'}</span>
                </div>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => handleRemove(member.id)}
                  disabled={removeMember.isPending}
                  title="Remove Member"
                >
                  <UserX className="w-4 h-4" />
                </Button>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
