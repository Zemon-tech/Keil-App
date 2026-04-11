// src/components/chat/NewChatDialog.tsx

import React, { useState } from "react";
import { useWorkspaceMembers } from "@/hooks/api/useWorkspace";
import { useOpenDM, useCreateGroup } from "@/hooks/api/useChat";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useChatStore } from "@/store/useChatStore";
import { useMe } from "@/hooks/api/useMe";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Plus, Search, Loader2, Users } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";

export function NewChatDialog() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const { workspaceId } = useWorkspace();
  const { data: members, isLoading } = useWorkspaceMembers(workspaceId ?? undefined);
  const { data: me } = useMe();
  const openDM = useOpenDM();
  const createGroup = useCreateGroup();
  const { setActiveChannel } = useChatStore();

  const [groupName, setGroupName] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Filter out the current user and apply search
  const filteredMembers = members?.filter(member => {
    if (member.user.id === (me as any)?.user?.id || member.user.id === (me as any)?.id) return false;
    const searchLower = search.toLowerCase();
    const nameMatch = member.user.name?.toLowerCase().includes(searchLower);
    const emailMatch = member.user.email.toLowerCase().includes(searchLower);
    return nameMatch || emailMatch;
  });

  const handleStartChat = (userId: string) => {
    openDM.mutate(userId, {
      onSuccess: (channel: any) => {
        setActiveChannel(channel.id);
        setOpen(false);
      }
    });
  };

  const handleCreateGroup = () => {
    if (!groupName.trim() || selectedIds.size === 0) return;
    createGroup.mutate({ name: groupName.trim(), member_ids: Array.from(selectedIds) }, {
      onSuccess: (channel: any) => {
        setActiveChannel(channel.id);
        setOpen(false);
        setGroupName("");
        setSelectedIds(new Set());
      }
    });
  };

  const toggleMember = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground">
          <Plus className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Chat</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="direct" className="w-full">
          <TabsList className="w-full grid grid-cols-2">
            <TabsTrigger value="direct">Direct Message</TabsTrigger>
            <TabsTrigger value="group">Group / Channel</TabsTrigger>
          </TabsList>

          {/* DIRECT MESSAGE TAB */}
          <TabsContent value="direct" className="mt-4">
            <div className="flex items-center px-3 border rounded-md focus-within:ring-1 focus-within:ring-ring">
              <Search className="h-4 w-4 text-muted-foreground mr-2" />
              <input
                type="text"
                className="flex h-10 w-full bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
                placeholder="Search workspace members..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="min-h-[200px] max-h-[300px] overflow-y-auto mt-2">
              {isLoading ? (
                <div className="flex h-full items-center justify-center">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : filteredMembers?.length === 0 ? (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  No members found.
                </div>
              ) : (
                <ul className="space-y-1">
                  {filteredMembers?.map((member) => {
                    const displayName = member.user.name || member.user.email;
                    const initials = displayName.charAt(0).toUpperCase();

                    return (
                      <li key={member.id}>
                        <button
                          onClick={() => handleStartChat(member.user.id)}
                          disabled={openDM.isPending}
                          className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-muted/50 transition-colors text-left"
                        >
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="bg-primary/20 text-xs text-foreground font-semibold">
                              {initials}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{displayName}</p>
                            <p className="text-xs text-muted-foreground truncate">{member.user.email}</p>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </TabsContent>

          {/* GROUP CHAT TAB */}
          <TabsContent value="group" className="mt-4 flex flex-col gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Channel Name</label>
              <input
                type="text"
                className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                placeholder="e.g. #announcements, Project Alpha..."
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-foreground">Select Members</label>
                <div className="flex items-center px-2 py-1 text-xs border rounded-md">
                  <Search className="h-3 w-3 text-muted-foreground mr-1" />
                  <input
                    type="text"
                    className="w-24 bg-transparent outline-none"
                    placeholder="Search..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              </div>
              
              <div className="min-h-[140px] max-h-[180px] overflow-y-auto border rounded-md p-1 space-y-1">
                {isLoading ? (
                  <div className="flex h-full items-center justify-center py-4">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredMembers?.map((member) => {
                  const displayName = member.user.name || member.user.email;
                  const isChecked = selectedIds.has(member.user.id);
                  
                  return (
                    <div 
                      key={member.id} 
                      className="flex flex-row items-center space-x-3 p-2 hover:bg-muted/50 rounded-md cursor-pointer"
                      onClick={() => toggleMember(member.user.id)}
                    >
                      <Checkbox checked={isChecked} onCheckedChange={() => toggleMember(member.user.id)} />
                      <div className="flex-1 text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                        {displayName}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <Button 
              className="w-full" 
              disabled={!groupName.trim() || selectedIds.size === 0 || createGroup.isPending}
              onClick={handleCreateGroup}
            >
              {createGroup.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Users className="mr-2 h-4 w-4" />}
              Create Group Channel ({selectedIds.size} members)
            </Button>
          </TabsContent>
        </Tabs>

      </DialogContent>
    </Dialog>
  );
}
