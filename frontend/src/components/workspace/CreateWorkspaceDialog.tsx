import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { workspaceKeys, type Workspace } from "@/hooks/api/useWorkspace";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { Loader2 } from "lucide-react";

export function CreateWorkspaceDialog({ open, onOpenChange }: { open: boolean, onOpenChange: (open: boolean) => void }) {
  const [name, setName] = useState("");
  const queryClient = useQueryClient();
  const { setActiveWorkspace } = useWorkspace();

  const createGroup = useMutation({
    mutationFn: async (workspaceName: string) => {
      const res = await api.post<{ data: { workspace: Workspace } }>("v1/workspaces", { name: workspaceName });
      return res.data.data.workspace;
    },
    onSuccess: (newWorkspace) => {
      queryClient.invalidateQueries({ queryKey: workspaceKeys.list() });
      setActiveWorkspace(newWorkspace.id);
      onOpenChange(false);
      setName("");
    }
  });

  const handleCreate = () => {
    if (!name.trim()) return;
    createGroup.mutate(name.trim());
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create New Workspace</DialogTitle>
          <DialogDescription>
            Build a new environment for your team's projects, tasks, and chats.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            placeholder="e.g. Engineering Team"
            className="w-full flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            autoFocus
          />
        </div>

        <DialogFooter className="sm:justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleCreate} 
            disabled={!name.trim() || createGroup.isPending}
          >
            {createGroup.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create Workspace
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
