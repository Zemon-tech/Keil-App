import { useState } from "react";
import { useAppContext } from "@/contexts/AppContext";
import { useAuth } from "@/contexts/AuthContext";
import { useOrgMembers } from "@/hooks/api/useOrganisations";
import { useSpaceRole } from "@/hooks/useSpaceRole";
import {
  useSpaces,
  useSpaceMembers,
  useDeletedSpaces,
  useCreateSpace,
  useRenameSpace,
  useDeleteSpace,
  useRestoreSpace,
  useHardDeleteSpace,
  useAddSpaceMember,
  useRemoveSpaceMember,
  useUpdateSpaceMemberRole,
  type Space,
  type DeletedSpace,
} from "@/hooks/api/useSpaces";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Layers,
  Plus,
  Trash2,
  RotateCcw,
  Search,
  Loader2,
  Users,
  AlertTriangle,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// ─── SpaceDetailPanel ─────────────────────────────────────────────────────────

interface SpaceDetailPanelProps {
  space: Space;
  orgId: string;
  isAdmin: boolean;
  isLastSpace: boolean;
  currentUserId: string;
}

function SpaceDetailPanel({
  space,
  orgId,
  isAdmin,
  isLastSpace,
  currentUserId,
}: SpaceDetailPanelProps) {
  const [nameValue, setNameValue] = useState(space.name);
  const [memberSearch, setMemberSearch] = useState("");
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const { data: members = [] } = useSpaceMembers(orgId, space.id);
  const { data: orgMembers = [] } = useOrgMembers(orgId);

  const renameSpace = useRenameSpace(orgId);
  const deleteSpace = useDeleteSpace(orgId);
  const addMember = useAddSpaceMember(orgId, space.id);
  const removeMember = useRemoveSpaceMember(orgId, space.id);
  const updateMemberRole = useUpdateSpaceMemberRole(orgId, space.id);

  const { canManageSpaceMembers, orgRole } = useSpaceRole();

  const { setActiveOrganisation, activeSpaceId } = useAppContext();

  // Org members not already in this space
  const addableMembersFiltered = orgMembers.filter(
    (om) =>
      !members.some((sm) => sm.user_id === om.user_id) &&
      (om.name?.toLowerCase().includes(memberSearch.toLowerCase()) ||
        om.email.toLowerCase().includes(memberSearch.toLowerCase()))
  );

  const handleRename = () => {
    const trimmed = nameValue.trim();
    if (!trimmed || trimmed === space.name) return;
    renameSpace.mutate(
      { spaceId: space.id, name: trimmed },
      {
        onError: () => {
          setNameValue(space.name); // revert on error
          toast.error("Failed to rename space");
        },
      }
    );
  };

  const handleDelete = () => {
    deleteSpace.mutate(space.id, {
      onSuccess: () => {
        setDeleteDialogOpen(false);
        toast.success(`"${space.name}" has been archived`);
        // If this was the active space, fall back to first remaining space
        if (activeSpaceId === space.id) {
          setActiveOrganisation(orgId);
        }
      },
      onError: (err: any) => {
        setDeleteDialogOpen(false);
        toast.error(err?.response?.data?.message ?? "Failed to delete space");
      },
    });
  };

  const handleAddMember = (userId: string) => {
    addMember.mutate(userId, {
      onSuccess: () => {
        setAddMemberOpen(false);
        setMemberSearch("");
        toast.success("Member added to space");
      },
      onError: (err: any) => {
        toast.error(err?.response?.data?.message ?? "Failed to add member");
      },
    });
  };

  const handleRemoveMember = (userId: string) => {
    removeMember.mutate(userId, {
      onSuccess: () => toast.success("Member removed from space"),
      onError: (err: any) => {
        toast.error(err?.response?.data?.message ?? "Failed to remove member");
      },
    });
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="p-6 space-y-6">
        {/* Space name */}
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
            Space Name
          </p>
          {isAdmin ? (
            <div className="flex items-center gap-2">
              <Input
                value={nameValue}
                onChange={(e) => setNameValue(e.target.value)}
                onBlur={handleRename}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.currentTarget.blur();
                  }
                }}
                className="rounded-lg text-sm"
                disabled={renameSpace.isPending}
              />
              {renameSpace.isPending && (
                <Loader2 className="size-4 animate-spin text-muted-foreground shrink-0" />
              )}
            </div>
          ) : (
            <p className="text-sm font-medium">{space.name}</p>
          )}
        </div>

        <Separator />

        {/* Members */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Members ({members.length})
            </p>
            {isAdmin && !space.is_private && (
              <Popover open={addMemberOpen} onOpenChange={setAddMemberOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-7 text-xs rounded-lg gap-1">
                    <Plus className="size-3" />
                    Add
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-2" align="end">
                  <div className="flex items-center gap-2 border-b border-border pb-2 mb-2">
                    <Search className="size-4 text-muted-foreground shrink-0" />
                    <Input
                      placeholder="Search org members..."
                      value={memberSearch}
                      onChange={(e) => setMemberSearch(e.target.value)}
                      className="h-7 border-none shadow-none focus-visible:ring-0 px-0 text-sm"
                      autoFocus
                    />
                  </div>
                  <div className="max-h-48 overflow-y-auto space-y-0.5">
                    {addableMembersFiltered.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-3">
                        {memberSearch
                          ? "No members found"
                          : "All org members are already in this space"}
                      </p>
                    ) : (
                      addableMembersFiltered.map((om) => (
                        <button
                          key={om.user_id}
                          onClick={() => handleAddMember(om.user_id)}
                          disabled={addMember.isPending}
                          className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-accent text-left text-sm transition-colors"
                        >
                          <Avatar className="size-6 shrink-0">
                            <AvatarFallback className="text-[10px] bg-primary/10">
                              {(om.name || om.email).charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="truncate font-medium text-xs">{om.name || om.email}</p>
                            <p className="truncate text-[10px] text-muted-foreground">{om.email}</p>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            )}
          </div>

          <div className="space-y-1">
            {members.map((member) => {
              const isSelf = member.user_id === currentUserId;
              const displayName = member.name || member.email;
              const isTargetAdmin = member.role === "admin";
              const canEditRole = canManageSpaceMembers && !space.is_private && !isSelf && (!isTargetAdmin || orgRole === "owner" || orgRole === "admin");

              return (
                <div
                  key={member.user_id}
                  className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/30 group"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Avatar className="size-7 shrink-0">
                      <AvatarFallback className="text-[10px] bg-primary/10">
                        {displayName.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{displayName}</p>
                      <p className="text-xs text-muted-foreground truncate">{member.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {canEditRole ? (
                      <Popover>
                        <PopoverTrigger asChild>
                          <button
                            disabled={updateMemberRole.isPending}
                            className="flex items-center gap-1.5 px-2 py-0.5 rounded border border-border bg-muted hover:bg-accent text-[10px] uppercase font-bold tracking-widest text-muted-foreground transition-colors shrink-0"
                          >
                            {member.role}
                            <span className="text-[8px] opacity-70">▼</span>
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-32 p-1 rounded-xl shadow-lg border border-border bg-popover text-popover-foreground" align="end">
                          {(["admin", "manager", "member"] as const).map((r) => (
                            <button
                              key={r}
                              onClick={() => {
                                updateMemberRole.mutate({
                                  userId: member.user_id,
                                  role: r,
                                }, {
                                  onSuccess: () => toast.success("Role updated successfully"),
                                  onError: (err: any) => toast.error(err?.response?.data?.message ?? "Failed to update role"),
                                });
                              }}
                              disabled={updateMemberRole.isPending}
                              className={cn(
                                "w-full flex items-center justify-between px-2.5 py-1.5 text-xs rounded-lg hover:bg-muted transition-colors text-left capitalize font-medium",
                                member.role === r && "text-primary font-semibold"
                              )}
                            >
                              {r}
                              {member.role === r && <Check className="size-3.5 text-primary shrink-0" />}
                            </button>
                          ))}
                        </PopoverContent>
                      </Popover>
                    ) : (
                      <span className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground px-2 py-0.5 bg-muted rounded-md shrink-0">
                        {member.role}
                      </span>
                    )}
                    {isAdmin && !space.is_private && !isSelf && (
                      <button
                        onClick={() => handleRemoveMember(member.user_id)}
                        disabled={removeMember.isPending}
                        className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-destructive transition-all rounded-md"
                        title="Remove from space"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Danger zone — admin only */}
        {isAdmin && !space.is_private && (
          <>
            <Separator />
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-destructive mb-3">
                Danger Zone
              </p>
              <div className="flex items-center justify-between p-3 rounded-lg border border-destructive/20 bg-destructive/5">
                <div>
                  <p className="text-sm font-medium text-foreground">Delete Space</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Archive this space and all its tasks.
                  </p>
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  className="text-xs rounded-lg shrink-0"
                  onClick={() => setDeleteDialogOpen(true)}
                  disabled={isLastSpace}
                  title={isLastSpace ? "Cannot delete the last space" : undefined}
                >
                  Delete
                </Button>
              </div>
              {isLastSpace && (
                <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                  <AlertTriangle className="size-3" />
                  This is the last space in the organisation and cannot be deleted.
                </p>
              )}
            </div>
          </>
        )}
      </div>

      {/* Delete confirmation dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete "{space.name}"?</DialogTitle>
            <DialogDescription>
              This will archive the space. All tasks in this space will be hidden.
              Chat channels and activity will remain but become inaccessible.
              You can restore this space from the Deleted section.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteSpace.isPending}
            >
              {deleteSpace.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
              Delete Space
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── DeletedSpaceRow ──────────────────────────────────────────────────────────

interface DeletedSpaceRowProps {
  space: DeletedSpace;
  orgId: string;
}

function DeletedSpaceRow({ space, orgId }: DeletedSpaceRowProps) {
  const [hardDeleteDialogOpen, setHardDeleteDialogOpen] = useState(false);
  const restoreSpace = useRestoreSpace(orgId);
  const hardDeleteSpace = useHardDeleteSpace(orgId);

  const handleRestore = () => {
    restoreSpace.mutate(space.id, {
      onSuccess: () => toast.success(`"${space.name}" restored`),
      onError: () => toast.error("Failed to restore space"),
    });
  };

  const handleHardDelete = () => {
    hardDeleteSpace.mutate(space.id, {
      onSuccess: () => {
        setHardDeleteDialogOpen(false);
        toast.success(`"${space.name}" permanently deleted`);
      },
      onError: () => {
        setHardDeleteDialogOpen(false);
        toast.error("Failed to permanently delete space");
      },
    });
  };

  return (
    <>
      <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/20 opacity-70">
        <div className="flex items-center gap-2 min-w-0">
          <Layers className="size-4 text-muted-foreground shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-medium truncate text-muted-foreground">{space.name}</p>
            <p className="text-xs text-muted-foreground">
              Deleted {new Date(space.deleted_at).toLocaleDateString()}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs rounded-lg gap-1"
            onClick={handleRestore}
            disabled={restoreSpace.isPending}
          >
            {restoreSpace.isPending ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <RotateCcw className="size-3" />
            )}
            Restore
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs rounded-lg text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={() => setHardDeleteDialogOpen(true)}
          >
            Delete forever
          </Button>
        </div>
      </div>

      {/* Hard delete confirmation */}
      <Dialog open={hardDeleteDialogOpen} onOpenChange={setHardDeleteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Permanently delete "{space.name}"?</DialogTitle>
            <DialogDescription>
              This cannot be undone. All tasks, channels, members, and activity in
              this space will be permanently removed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setHardDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleHardDelete}
              disabled={hardDeleteSpace.isPending}
            >
              {hardDeleteSpace.isPending && (
                <Loader2 className="mr-2 size-4 animate-spin" />
              )}
              Delete Forever
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── SpacesTab ────────────────────────────────────────────────────────────────

export function SpacesTab() {
  const { mode, activeOrg, activeOrgId } = useAppContext();
  const { user } = useAuth();
  const currentUserId = user?.id ?? "";

  const [selectedSpaceId, setSelectedSpaceId] = useState<string | null>(null);
  const [createName, setCreateName] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  const { data: spaces = [] } = useSpaces(activeOrgId);
  const { data: deletedSpaces = [] } = useDeletedSpaces(
    activeOrg?.role === "owner" || activeOrg?.role === "admin" ? activeOrgId : null
  );
  const createSpace = useCreateSpace(activeOrgId);

  const isAdmin = activeOrg?.role === "owner" || activeOrg?.role === "admin";
  const selectedSpace = spaces.find((s) => s.id === selectedSpaceId) ?? null;

  if (mode !== "organisation" || !activeOrg || !activeOrgId) {
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-foreground">Spaces</h2>
        <p className="text-sm text-muted-foreground">
          Switch to an organisation to manage spaces.
        </p>
      </div>
    );
  }

  const handleCreateSpace = () => {
    const trimmed = createName.trim();
    if (!trimmed) return;
    createSpace.mutate(trimmed, {
      onSuccess: (newSpace) => {
        setCreateOpen(false);
        setCreateName("");
        setSelectedSpaceId(newSpace.id);
        toast.success(`Space "${newSpace.name}" created`);
      },
      onError: (err: any) => {
        toast.error(err?.response?.data?.message ?? "Failed to create space");
      },
    });
  };

  return (
    <div className="flex h-full min-h-0">
      {/* ── Left: Space list ── */}
      <div className="w-56 shrink-0 border-r border-border flex flex-col h-full">
        <div className="p-4 pb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Spaces</h2>
          {isAdmin && (
            <Button
              variant="ghost"
              size="icon"
              className="size-6"
              onClick={() => setCreateOpen(true)}
              title="Create space"
            >
              <Plus className="size-4" />
            </Button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-2 pb-4 space-y-0.5">
          {spaces.map((space) => (
            <button
              key={space.id}
              onClick={() => setSelectedSpaceId(space.id)}
              className={cn(
                "w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left text-sm transition-colors",
                selectedSpaceId === space.id
                  ? "bg-primary text-primary-foreground"
                  : "text-foreground hover:bg-muted"
              )}
            >
              <Layers className="size-3.5 shrink-0" />
              <span className="truncate flex-1">{space.name}</span>
              <span
                className={cn(
                  "text-[10px] shrink-0",
                  selectedSpaceId === space.id
                    ? "text-primary-foreground/70"
                    : "text-muted-foreground"
                )}
              >
                <Users className="size-3" />
              </span>
            </button>
          ))}

          {/* Deleted spaces — admin only */}
          {isAdmin && deletedSpaces.length > 0 && (
            <>
              <div className="pt-3 pb-1 px-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
                  Deleted
                </p>
              </div>
              {deletedSpaces.map((ds) => (
                <button
                  key={ds.id}
                  onClick={() => setSelectedSpaceId(ds.id)}
                  className={cn(
                    "w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left text-sm transition-colors opacity-50",
                    selectedSpaceId === ds.id
                      ? "bg-muted text-foreground opacity-100"
                      : "text-muted-foreground hover:bg-muted hover:opacity-70"
                  )}
                >
                  <Layers className="size-3.5 shrink-0" />
                  <span className="truncate flex-1 line-through">{ds.name}</span>
                </button>
              ))}
            </>
          )}
        </div>
      </div>

      {/* ── Right: Detail panel ── */}
      <div className="flex-1 min-w-0 overflow-hidden">
        {selectedSpace ? (
          <SpaceDetailPanel
            key={selectedSpace.id}
            space={selectedSpace}
            orgId={activeOrgId}
            isAdmin={isAdmin}
            isLastSpace={spaces.length <= 1}
            currentUserId={currentUserId}
          />
        ) : (() => {
          // Check if selected is a deleted space
          const deletedSelected = deletedSpaces.find((ds) => ds.id === selectedSpaceId);
          if (deletedSelected && isAdmin) {
            return (
              <div className="p-6 space-y-4">
                <div>
                  <h3 className="text-base font-semibold text-muted-foreground line-through">
                    {deletedSelected.name}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Deleted on {new Date(deletedSelected.deleted_at).toLocaleDateString()}
                  </p>
                </div>
                <Separator />
                <DeletedSpaceRow space={deletedSelected} orgId={activeOrgId} />
              </div>
            );
          }
          return (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-8 text-center">
              <Layers className="size-10 mb-3 opacity-30" />
              <p className="text-sm">Select a space to manage it</p>
            </div>
          );
        })()}
      </div>

      {/* Create space dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Create Space</DialogTitle>
            <DialogDescription>
              Add a new space to your organisation.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Input
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreateSpace()}
              placeholder="e.g. Engineering, Design"
              autoFocus
              className="rounded-lg"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setCreateOpen(false); setCreateName(""); }}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateSpace}
              disabled={!createName.trim() || createSpace.isPending}
            >
              {createSpace.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
