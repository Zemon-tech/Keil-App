import { useEffect, useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { VisuallyHidden } from "radix-ui";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase";
import {
  ArrowLeft,
  User,
  Settings,
  SlidersHorizontal,
  Sparkles,
  Bot,
  Keyboard,
  ListTodo,
  Bell,
  Plug,
  Code2,
  Building2,
  LogOut,
  ChevronRight,
  ChevronUp,
  Shield,
  Palette,
  Globe,
  Monitor,
  Moon,
  Sun,
  Layers,
  Plus,
  Trash2,
  Search,
  AlertTriangle,
  MoreVertical,
  Check,
  Mail,
  UserPlus,
  Hash,
  Archive,
  Eye,
  EyeOff,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "next-themes";
import { useAppContext } from "@/contexts/AppContext";
import { useLocation, useNavigate } from "react-router-dom";
import {
  useOrgMembers,
  useCreateOrgInvite,
  useDeleteOrganisation,
  useRemoveOrgMember,
  useRenameOrganisation,
  useUpdateOrgMemberRole,
} from "@/hooks/api/useOrganisations";
import {
  useAddSpaceMember,
  useCreateSpace,
  useDeleteSpace,
  useRemoveSpaceMember,
  useRenameSpace,
  useSpaceMembers,
  useSpaces,
  useUpdateSpaceMemberRole,
  type Space,
} from "@/hooks/api/useSpaces";
import { useSpaceRole } from "@/hooks/useSpaceRole";
import { Loader2, Copy } from "lucide-react";
import {
  useGoogleCalendarStatus,
  useConnectGoogleCalendar,
  useDisconnectGoogleCalendar,
} from "@/hooks/api/useGoogleCalendar";
import { toast } from "sonner";

// ─── Helper Functions ─────────────────────────────────────────────────
const handleCopyToClipboard = async (text: string, label: string) => {
  try {
    await navigator.clipboard?.writeText(text);
    toast.success(`${label} copied to clipboard`);
  } catch (error) {
    toast.error("Failed to copy to clipboard");
    console.error("Clipboard error:", error);
  }
};

// ─── Settings Tabs ───────────────────────────────────────────────────
type AccountTab =
  | "account"
  | "preferences"
  | "personalization"
  | "assistant"
  | "shortcuts"
  | "tasks"
  | "notifications"
  | "connectors";

type WorkspaceTab = "org-general" | "org-members" | "org-spaces" | "api" | "enterprise";

type SettingsTab = AccountTab | WorkspaceTab;

interface AccountNavItem {
  id: AccountTab;
  label: string;
  icon: React.ElementType;
}

interface WorkspaceNavItem {
  id: WorkspaceTab;
  label: string;
  icon: React.ElementType;
}

const accountNavItems: AccountNavItem[] = [
  { id: "account", label: "Account", icon: User },
  { id: "preferences", label: "Preferences", icon: SlidersHorizontal },
  { id: "personalization", label: "Personalization", icon: Sparkles },
  { id: "assistant", label: "Assistant", icon: Bot },
  { id: "shortcuts", label: "Shortcuts", icon: Keyboard },
  { id: "tasks", label: "Tasks", icon: ListTodo },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "connectors", label: "Connectors", icon: Plug },
];

const workspaceNavItems: WorkspaceNavItem[] = [
  { id: "org-general", label: "General", icon: Settings },
  { id: "org-members", label: "Members", icon: User },
  { id: "org-spaces", label: "Spaces", icon: Layers },
  { id: "api", label: "API", icon: Code2 },
  { id: "enterprise", label: "Enterprise", icon: Building2 },
];

// ─── Tab Content Components ──────────────────────────────────────────

function RoleBadge({ role }: { role: string }) {
  return (
    <Badge
      variant="secondary"
      className="text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded-md"
    >
      {role}
    </Badge>
  );
}

function OrgGeneralTab() {
  const { organisations, activeOrgId } = useAppContext();
  const renameOrg = useRenameOrganisation();
  const deleteOrg = useDeleteOrganisation();
  const { setPersonalMode } = useAppContext();
  const location = useLocation();
  const navigate = useNavigate();

  const selectedOrg = organisations.find((org) => org.id === activeOrgId);
  const [name, setName] = useState(selectedOrg?.name || "");
  const isAdmin =
    selectedOrg?.role === "owner" || selectedOrg?.role === "admin";
  const isOwner = selectedOrg?.role === "owner";

  useEffect(() => {
    if (selectedOrg) setName(selectedOrg.name);
  }, [selectedOrg]);

  const handleRename = () => {
    if (!selectedOrg || !name.trim() || name === selectedOrg.name) return;
    renameOrg.mutate({ orgId: selectedOrg.id, name: name.trim() });
  };

  const handleDeleteOrg = () => {
    if (
      !selectedOrg ||
      !confirm(
        `Delete ${selectedOrg.name}? This archives the organisation for all members.`,
      )
    )
      return;
    deleteOrg.mutate(selectedOrg.id, {
      onSuccess: () => {
        setPersonalMode();
        if (/^\/(tasks|events)\/[^\/]+/.test(location.pathname)) {
          navigate("/tasks");
        }
      },
    });
  };

  if (!selectedOrg)
    return (
      <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
        Select an organisation.
      </div>
    );

  return (
    <div className="space-y-10">
      <div>
        <h2 className="text-xl font-semibold text-foreground">General</h2>
        <p className="text-sm text-muted-foreground mt-1.5">
          Manage your organisation identity and core settings.
        </p>
      </div>

      <div className="space-y-6">
        <div className="space-y-2">
          <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
            Organisation Name
          </Label>
          <div className="flex items-center gap-4">
            {isAdmin ? (
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={handleRename}
                onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                className="text-lg font-medium bg-transparent border-none focus-visible:ring-0 p-0 h-auto shadow-none placeholder:text-muted-foreground/50"
                placeholder="Organisation Name"
              />
            ) : (
              <p className="text-lg font-medium">{selectedOrg.name}</p>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            This is how your organisation will appear to members.
          </p>
        </div>

        <div className="space-y-2">
          <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
            Organisation ID
          </Label>
          <div className="flex items-center gap-2 group">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/50 border border-border/50 font-mono text-xs text-muted-foreground">
              <Hash className="h-3 w-3" />
              {selectedOrg.id}
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={() => handleCopyToClipboard(selectedOrg.id, "Organisation ID")}
            >
              <Copy className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {isOwner && (
        <div className="pt-10 border-t border-border/50">
          <div className="bg-destructive/5 rounded-2xl border border-destructive/20 p-6">
            <div className="flex items-center gap-3 text-destructive mb-4">
              <AlertTriangle className="h-5 w-5" />
              <h3 className="font-semibold">Danger Zone</h3>
            </div>
            <div className="flex items-center justify-between gap-6">
              <div>
                <p className="text-sm font-medium text-foreground">
                  Delete this organisation
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Once deleted, all data will be archived. This action can only
                  be undone by an administrator.
                </p>
              </div>
              <Button
                variant="destructive"
                className="shrink-0 font-medium"
                onClick={handleDeleteOrg}
                disabled={deleteOrg.isPending}
              >
                {deleteOrg.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Archive className="h-4 w-4 mr-2" />
                )}
                Delete Organisation
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function OrgMembersTab() {
  const { user } = useAuth();
  const { activeOrgId, organisations } = useAppContext();
  const selectedOrg = organisations.find((org) => org.id === activeOrgId);
  const { data: members = [] } = useOrgMembers(activeOrgId || "");
  const createInvite = useCreateOrgInvite();
  const updateRole = useUpdateOrgMemberRole(activeOrgId || "");
  const removeMember = useRemoveOrgMember(activeOrgId || "");
  const [inviteLink, setInviteLink] = useState("");
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const isAdmin =
    selectedOrg?.role === "owner" || selectedOrg?.role === "admin";

  const handleCreateInvite = () => {
    if (!activeOrgId) return;
    createInvite.mutate(activeOrgId, {
      onSuccess: (data) => setInviteLink(data.inviteLink),
      onError: (err: any) =>
        alert(err?.response?.data?.message || "Failed to create invite link"),
    });
  };

  if (!selectedOrg) return null;

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Members</h2>
          <p className="text-sm text-muted-foreground mt-1.5">
            Manage who has access to this organisation and their roles.
          </p>
        </div>
        {isAdmin && (
          <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
            <DialogTrigger asChild>
              <Button className="rounded-xl shadow-lg shadow-primary/20">
                <UserPlus className="h-4 w-4 mr-2" />
                Invite Member
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md rounded-2xl">
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold">
                    Invite to {selectedOrg.name}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Generate an invite link to share with your team.
                  </p>
                </div>
                {!inviteLink ? (
                  <Button
                    className="w-full h-12 rounded-xl"
                    onClick={handleCreateInvite}
                    disabled={createInvite.isPending}
                  >
                    {createInvite.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Plus className="h-4 w-4 mr-2" />
                    )}
                    Generate Invite Link
                  </Button>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Input
                        value={inviteLink}
                        readOnly
                        className="h-11 font-mono text-xs rounded-xl bg-muted/50"
                      />
                      <Button
                        variant="secondary"
                        size="icon"
                        className="h-11 w-11 shrink-0 rounded-xl"
                        onClick={() => handleCopyToClipboard(inviteLink, "Invite link")}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="text-[11px] text-muted-foreground text-center">
                      This link will expire soon. Make sure to share it
                      securely.
                    </p>
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="space-y-1">
        {members.map((member) => {
          const isSelf = member.user_id === user?.id;
          const isOwner = member.role === "owner";
          const canEdit = isAdmin && !isOwner && !isSelf;

          return (
            <div
              key={member.user_id}
              className="flex items-center justify-between p-3 rounded-2xl hover:bg-muted/40 transition-colors group"
            >
              <div className="flex items-center gap-4">
                <Avatar className="h-10 w-10 border-2 border-background shadow-sm">
                  <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                    {(member.name || member.email).charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold">
                      {member.name || "Unnamed User"}
                    </p>
                    {isSelf && (
                      <Badge
                        variant="outline"
                        className="text-[10px] h-4 px-1.5 font-normal border-primary/20 bg-primary/5 text-primary"
                      >
                        You
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                    <Mail className="h-3 w-3" />
                    {member.email}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      disabled={!canEdit}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors",
                        canEdit
                          ? "hover:bg-muted border border-border/50"
                          : "cursor-default",
                      )}
                    >
                      <RoleBadge role={member.role} />
                      {canEdit && (
                        <ChevronRight className="h-3 w-3 text-muted-foreground rotate-90" />
                      )}
                    </button>
                  </PopoverTrigger>
                  {canEdit && (
                    <PopoverContent className="w-40 p-1 rounded-xl" align="end">
                      <button
                        onClick={() =>
                          updateRole.mutate({
                            userId: member.user_id,
                            role: "member",
                          })
                        }
                        className={cn(
                          "w-full flex items-center justify-between px-3 py-2 text-xs rounded-lg hover:bg-muted transition-colors",
                          member.role === "member" &&
                            "text-primary font-medium",
                        )}
                      >
                        Member
                        {member.role === "member" && (
                          <Check className="h-3 w-3" />
                        )}
                      </button>
                      <button
                        onClick={() =>
                          updateRole.mutate({
                            userId: member.user_id,
                            role: "admin",
                          })
                        }
                        className={cn(
                          "w-full flex items-center justify-between px-3 py-2 text-xs rounded-lg hover:bg-muted transition-colors",
                          member.role === "admin" && "text-primary font-medium",
                        )}
                      >
                        Admin
                        {member.role === "admin" && (
                          <Check className="h-3 w-3" />
                        )}
                      </button>
                    </PopoverContent>
                  )}
                </Popover>

                {canEdit && (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-lg text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-48 p-1 rounded-xl" align="end">
                      <button
                        onClick={() => removeMember.mutate(member.user_id)}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Remove from Organisation
                      </button>
                    </PopoverContent>
                  </Popover>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function OrgSpacesTab() {
  const { activeOrgId, organisations } = useAppContext();
  const selectedOrg = organisations.find((org) => org.id === activeOrgId);
  const { data: spaces = [] } = useSpaces(activeOrgId || "");
  const createSpace = useCreateSpace(activeOrgId || "");
  const [newSpaceName, setNewSpaceName] = useState("");
  const [selectedSpace, setSelectedSpace] = useState<Space | null>(null);
  const isAdmin =
    selectedOrg?.role === "owner" || selectedOrg?.role === "admin";

  const handleCreateSpace = () => {
    if (!newSpaceName.trim()) return;
    createSpace.mutate(newSpaceName.trim(), {
      onSuccess: () => setNewSpaceName(""),
    });
  };

  if (!selectedOrg) return null;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Spaces</h2>
        <p className="text-sm text-muted-foreground mt-1.5">
          Organize your work into focused environments.
        </p>
      </div>

      <div className="space-y-4">
        {isAdmin && (
          <div className="relative group">
            <Input
              value={newSpaceName}
              onChange={(e) => setNewSpaceName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreateSpace()}
              placeholder="Create a new space..."
              className="h-12 pl-4 pr-12 rounded-2xl bg-muted/30 border-dashed hover:border-primary/50 transition-colors focus:bg-background focus:border-solid"
            />
            <Button
              size="icon"
              className="absolute right-1.5 top-1.5 h-9 w-9 rounded-xl opacity-0 group-focus-within:opacity-100 transition-opacity"
              onClick={handleCreateSpace}
              disabled={!newSpaceName.trim() || createSpace.isPending}
            >
              {createSpace.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
            </Button>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {spaces.map((space) => (
            <button
              key={space.id}
              onClick={() => setSelectedSpace(space)}
              className="group flex items-center justify-between p-4 rounded-2xl border border-border/50 bg-muted/20 hover:bg-muted/40 hover:border-primary/20 transition-all text-left"
            >
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                  <Layers className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold text-sm">{space.name}</p>
                  <p className="text-xs text-muted-foreground">Active space</p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
            </button>
          ))}
        </div>
      </div>

      {selectedSpace && (
        <SpaceDetailsSheet
          orgId={activeOrgId!}
          space={selectedSpace}
          onClose={() => setSelectedSpace(null)}
          isAdmin={isAdmin}
        />
      )}
    </div>
  );
}

function SpaceDetailsSheet({
  orgId,
  space,
  onClose,
  isAdmin,
}: {
  orgId: string;
  space: Space;
  onClose: () => void;
  isAdmin: boolean;
}) {
  const { user } = useAuth();
  const renameSpace = useRenameSpace(orgId);
  const deleteSpace = useDeleteSpace(orgId);
  const [name, setName] = useState(space.name);
  const { data: orgMembers = [] } = useOrgMembers(orgId);

  const handleRename = () => {
    if (!name.trim() || name === space.name) return;
    renameSpace.mutate({ spaceId: space.id, name: name.trim() });
  };

  return (
    <Sheet open={!!space} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-[400px] sm:w-[540px] p-0 gap-0 border-l border-border/50">
        <SheetHeader className="p-6 border-b border-border/50 bg-muted/10">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <Layers className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <VisuallyHidden.Root>
                <SheetTitle>{space.name}</SheetTitle>
              </VisuallyHidden.Root>
              {isAdmin ? (
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onBlur={handleRename}
                  onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                  className="text-lg font-bold bg-transparent border-none focus-visible:ring-0 p-0 h-auto shadow-none"
                />
              ) : (
                <h3 className="text-lg font-bold">{space.name}</h3>
              )}
              <p className="text-xs text-muted-foreground">
                Manage space settings and members
              </p>
            </div>
          </div>
        </SheetHeader>

        <div className="p-6 space-y-8 overflow-y-auto h-[calc(100vh-100px)]">
          <SpaceMembersPanel
            orgId={orgId}
            space={space}
            orgMembers={orgMembers}
            isAdmin={isAdmin}
            currentUserId={user?.id || ""}
          />

          {isAdmin && (
            <div className="pt-8 border-t border-border/50">
              <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">
                Danger Zone
              </h4>
              <div className="p-4 rounded-xl border border-destructive/20 bg-destructive/5 flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Archive Space
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Archive this space. It can be restored later.
                  </p>
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  className="rounded-lg h-8 text-xs px-3"
                  onClick={() =>
                    deleteSpace.mutate(space.id, { onSuccess: onClose })
                  }
                  disabled={deleteSpace.isPending}
                >
                  Archive
                </Button>
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function SpaceMembersPanel({
  orgId,
  space,
  orgMembers,
  isAdmin,
  currentUserId,
}: {
  orgId: string;
  space: Space;
  orgMembers: Array<{
    user_id: string;
    name: string | null;
    email: string;
    role: string;
  }>;
  isAdmin: boolean;
  currentUserId: string;
}) {
  const [memberSearch, setMemberSearch] = useState("");
  const { data: members = [] } = useSpaceMembers(orgId, space.id);
  const addMember = useAddSpaceMember(orgId, space.id);
  const removeMember = useRemoveSpaceMember(orgId, space.id);
  const updateMemberRole = useUpdateSpaceMemberRole(orgId, space.id);
  const { canManageSpaceMembers, orgRole } = useSpaceRole();

  const addableMembers = orgMembers.filter(
    (member) =>
      !members.some((spaceMember) => spaceMember.user_id === member.user_id) &&
      (member.name?.toLowerCase().includes(memberSearch.toLowerCase()) ||
        member.email.toLowerCase().includes(memberSearch.toLowerCase())),
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
          Space members ({members.length})
        </p>
      </div>
      {isAdmin && (
        <div className="rounded-lg border border-border p-2">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              value={memberSearch}
              onChange={(e) => setMemberSearch(e.target.value)}
              placeholder="Add organisation member to space"
              className="h-8 border-none shadow-none focus-visible:ring-0 px-0 text-sm"
            />
          </div>
          {memberSearch && (
            <div className="mt-2 max-h-36 overflow-y-auto space-y-1">
              {addableMembers.length === 0 ? (
                <p className="text-xs text-muted-foreground px-2 py-2">
                  No matching members
                </p>
              ) : (
                addableMembers.map((member) => (
                  <button
                    key={member.user_id}
                    onClick={() =>
                      addMember.mutate(member.user_id, {
                        onSuccess: () => setMemberSearch(""),
                      })
                    }
                    className="w-full flex items-center justify-between px-2 py-1.5 rounded-md hover:bg-muted text-left text-xs"
                  >
                    <span className="truncate">
                      {member.name || member.email}
                    </span>
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      )}
      <div className="space-y-1">
        {members.map((member) => {
          const isSelf = member.user_id === currentUserId;
          const isTargetAdmin = member.role === "admin";
          const canEditRole = canManageSpaceMembers && !isSelf && (!isTargetAdmin || orgRole === "owner" || orgRole === "admin");

          return (
            <div
              key={member.user_id}
              className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/30"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">
                  {member.name || member.email}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {member.email}
                </p>
              </div>
              <div className="flex items-center gap-2">
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
                          {member.role === r && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                        </button>
                      ))}
                    </PopoverContent>
                  </Popover>
                ) : (
                  <RoleBadge role={member.role} />
                )}
                {isAdmin && !isSelf && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={() => removeMember.mutate(member.user_id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AccountTab() {
  const { user, signOut } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Profile info states
  const [isEditingName, setIsEditingName] = useState(false);
  const [newName, setNewName] = useState(user?.user_metadata?.full_name || "");

  const [isEditingUsername, setIsEditingUsername] = useState(false);
  const [newUsername, setNewUsername] = useState(
    user?.user_metadata?.username || user?.email?.split("@")[0] || ""
  );

  // Password states
  const [passwordFlow, setPasswordFlow] = useState<"none" | "set" | "change">(
    "none"
  );
  const [oldPassword, setOldPassword] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);

  // Avatar states
  const fileInputRef = useRef<HTMLInputElement>(null);

  const userDisplayName =
    user?.user_metadata?.full_name || user?.email || "User";
  const userEmail = user?.email || "";
  const username =
    user?.user_metadata?.username || user?.email?.split("@")[0] || "";
  const avatarUrl = user?.user_metadata?.avatar_url;

  // Determine if user logged in with Google
  const isGoogleUser = user?.app_metadata?.provider === "google" || 
                       user?.identities?.some(id => id.provider === "google");
  
  // Check if they have a password (this is a bit tricky with Supabase, 
  // but usually email provider means they have a password).
  // If they have a password, we show "Change password", else "Set password".
  const hasPassword = user?.app_metadata?.provider === "email" || 
                      user?.identities?.some(id => id.provider === "email") ||
                      user?.user_metadata?.password_set === true;

  const userInitials =
    userDisplayName
      ?.split(" ")
      .map((n: string) => n[0])
      .join("")
      .toUpperCase()
      .substring(0, 2) || "U";

  useEffect(() => {
    if (success || error) {
      const timer = setTimeout(() => {
        setSuccess(null);
        setError(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [success, error]);

  const handleUpdateName = async () => {
    if (!newName.trim() || newName === userDisplayName) {
      setIsEditingName(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const { error } = await supabase.auth.updateUser({
        data: { full_name: newName.trim() },
      });
      if (error) throw error;
      setSuccess("Name updated successfully");
      setIsEditingName(false);
    } catch (err: any) {
      setError(err.message || "Failed to update name");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateUsername = async () => {
    if (!newUsername.trim() || newUsername === username) {
      setIsEditingUsername(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const { error } = await supabase.auth.updateUser({
        data: { username: newUsername.trim() },
      });
      if (error) throw error;
      setSuccess("Username updated successfully");
      setIsEditingUsername(false);
    } catch (err: any) {
      setError(err.message || "Failed to update username");
    } finally {
      setLoading(false);
    }
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size and type
    if (file.size > 2 * 1024 * 1024) {
      setError("File size must be less than 2MB");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${user?.id}-${Math.random()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      // Upload to 'avatars' bucket
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file);

      if (uploadError) {
        // If bucket doesn't exist, we might get an error.
        // For "dummy features working", we'll simulate success if it's a "bucket not found" error
        // but tell the user it's a dummy for now if it fails.
        if (uploadError.message.includes("not found")) {
           // Fallback: just update metadata with a blob URL for local preview or just dummy success
           const { error: metaError } = await supabase.auth.updateUser({
             data: { avatar_url: URL.createObjectURL(file) }
           });
           if (metaError) throw metaError;
           setSuccess("Avatar updated (locally)");
        } else {
          throw uploadError;
        }
      } else {
        const { data: { publicUrl } } = supabase.storage
          .from("avatars")
          .getPublicUrl(filePath);

        const { error: metaError } = await supabase.auth.updateUser({
          data: { avatar_url: publicUrl },
        });
        if (metaError) throw metaError;
        setSuccess("Avatar updated successfully");
      }
    } catch (err: any) {
      setError(err.message || "Failed to update avatar");
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordAction = async () => {
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      if (passwordFlow === "change") {
        // Verify old password by attempting a sign-in
        const { error: authError } = await supabase.auth.signInWithPassword({
          email: userEmail,
          password: oldPassword,
        });

        if (authError) {
          throw new Error("Invalid old password");
        }
      }

      const { error } = await supabase.auth.updateUser({
        password: password,
        data: { password_set: true }
      });

      if (error) throw error;
      setSuccess(passwordFlow === "set" ? "Password set successfully" : "Password changes successfully");
      setPasswordFlow("none");
      setOldPassword("");
      setPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      setError(err.message || "Failed to update password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Account</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your account information and security settings.
          </p>
        </div>
        {(success || error) && (
          <div className={cn(
            "text-xs px-3 py-1 rounded-full animate-in fade-in slide-in-from-top-1 duration-300",
            success ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20" : 
                      "bg-red-500/10 text-red-500 border border-red-500/20"
          )}>
            {success || error}
          </div>
        )}
      </div>

      <Separator />

      {/* Profile Section */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Avatar className="h-14 w-14 rounded-full ring-2 ring-background shadow-sm">
            {avatarUrl ? (
              <img src={avatarUrl} alt={userDisplayName} className="h-full w-full object-cover rounded-full" />
            ) : (
              <AvatarFallback className="rounded-full bg-emerald-600 text-white text-lg font-semibold">
                {userInitials}
              </AvatarFallback>
            )}
          </Avatar>
          <div>
            <p className="text-sm font-semibold text-foreground">
              {userDisplayName}
            </p>
            <p className="text-xs text-muted-foreground">{userEmail}</p>
          </div>
        </div>
        <div>
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            accept="image/*"
            onChange={handleFileChange}
          />
          <Button 
            variant="outline" 
            size="sm" 
            className="text-xs rounded-lg"
            onClick={handleAvatarClick}
            disabled={loading}
          >
            {loading ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : null}
            Change avatar
          </Button>
        </div>
      </div>

      <Separator />

      {/* Full Name */}
      <div className="flex items-center justify-between">
        <div className="flex-1 mr-4">
          <p className="text-sm font-medium text-foreground">Full Name</p>
          {isEditingName ? (
            <div className="mt-1.5 flex items-center gap-2">
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="h-8 text-xs rounded-lg max-w-[200px]"
                autoFocus
                onKeyDown={(e) => e.key === "Enter" && handleUpdateName()}
              />
              <Button size="sm" className="h-8 px-3 text-[10px] rounded-lg" onClick={handleUpdateName} disabled={loading}>
                Save
              </Button>
              <Button variant="ghost" size="sm" className="h-8 px-3 text-[10px] rounded-lg" onClick={() => setIsEditingName(false)}>
                Cancel
              </Button>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground mt-0.5">
              {userDisplayName}
            </p>
          )}
        </div>
        {!isEditingName && (
          <Button 
            variant="outline" 
            size="sm" 
            className="text-xs rounded-lg"
            onClick={() => setIsEditingName(true)}
          >
            Change full name
          </Button>
        )}
      </div>

      <Separator />

      {/* Username */}
      <div className="flex items-center justify-between">
        <div className="flex-1 mr-4">
          <p className="text-sm font-medium text-foreground">Username</p>
          {isEditingUsername ? (
            <div className="mt-1.5 flex items-center gap-2">
              <Input
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                className="h-8 text-xs rounded-lg max-w-[200px]"
                autoFocus
                onKeyDown={(e) => e.key === "Enter" && handleUpdateUsername()}
              />
              <Button size="sm" className="h-8 px-3 text-[10px] rounded-lg" onClick={handleUpdateUsername} disabled={loading}>
                Save
              </Button>
              <Button variant="ghost" size="sm" className="h-8 px-3 text-[10px] rounded-lg" onClick={() => setIsEditingUsername(false)}>
                Cancel
              </Button>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground mt-0.5">
              {username}
            </p>
          )}
        </div>
        {!isEditingUsername && (
          <Button 
            variant="outline" 
            size="sm" 
            className="text-xs rounded-lg"
            onClick={() => setIsEditingUsername(true)}
          >
            Change username
          </Button>
        )}
      </div>

      <Separator />

      {/* Email */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-foreground">Email</p>
          <p className="text-xs text-muted-foreground mt-0.5">{userEmail}</p>
        </div>
        {isGoogleUser && (
          <Badge variant="secondary" className="text-[10px] bg-blue-500/10 text-blue-500 border-blue-500/20">
            Google Auth
          </Badge>
        )}
      </div>

      <Separator />

      {/* Security */}
      <div>
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Shield className="h-4 w-4 text-muted-foreground" />
          Security
        </h3>
        <div className="mt-4 space-y-4">
          <div className={cn(
            "space-y-4 p-4 rounded-xl border border-border transition-all duration-300",
            passwordFlow !== "none" ? "bg-muted/30" : "bg-transparent"
          )}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Password</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {hasPassword ? "Change your existing password" : "Set a password for your account"}
                </p>
              </div>
              {passwordFlow === "none" && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="text-xs rounded-lg"
                  onClick={() => setPasswordFlow(hasPassword ? "change" : "set")}
                >
                  {hasPassword ? "Change password" : "Set password"}
                </Button>
              )}
            </div>

            {passwordFlow !== "none" && (
              <div className="space-y-4 pt-2 animate-in fade-in slide-in-from-top-2 duration-300">
                {passwordFlow === "change" && (
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                      Current Password
                    </Label>
                    <div className="relative">
                      <Input
                        type={showPasswords ? "text" : "password"}
                        value={oldPassword}
                        onChange={(e) => setOldPassword(e.target.value)}
                        className="h-9 text-xs rounded-lg pr-10"
                        placeholder="Enter current password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPasswords(!showPasswords)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {showPasswords ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                    <button 
                      type="button"
                      className="text-[10px] text-primary hover:underline"
                      onClick={() => {}} // Dummy as requested
                    >
                      Forgot password?
                    </button>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                      {passwordFlow === "set" ? "New Password" : "New Password"}
                    </Label>
                    <div className="relative">
                      <Input
                        type={showPasswords ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="h-9 text-xs rounded-lg pr-10"
                        placeholder="Minimum 6 characters"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                      Confirm Password
                    </Label>
                    <Input
                      type={showPasswords ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="h-9 text-xs rounded-lg"
                      placeholder="Re-enter password"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <Button 
                    size="sm" 
                    className="h-9 px-4 rounded-lg text-xs" 
                    onClick={handlePasswordAction}
                    disabled={loading || !password || !confirmPassword || (passwordFlow === 'change' && !oldPassword)}
                  >
                    {loading && <Loader2 className="h-3 w-3 animate-spin mr-2" />}
                    Confirm
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-9 px-4 rounded-lg text-xs" 
                    onClick={() => {
                      setPasswordFlow("none");
                      setOldPassword("");
                      setPassword("");
                      setConfirmPassword("");
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">
                Two-Factor Authentication
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Add an extra layer of security to your account
              </p>
            </div>
            <Switch />
          </div>
        </div>
      </div>

      <Separator />

      {/* Sign Out */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-foreground">Sign Out</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            You are signed in as {userEmail}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="text-xs rounded-lg text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 border-red-200 dark:border-red-800/40"
          onClick={signOut}
        >
          <LogOut className="h-3.5 w-3.5 mr-1.5" />
          Sign out
        </Button>
      </div>
    </div>
  );
}

function PreferencesTab() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Preferences</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Customize how KeilHQ works for you.
        </p>
      </div>

      <Separator />

      {/* Theme */}
      <div>
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Palette className="h-4 w-4 text-muted-foreground" />
          Appearance
        </h3>
        <div className="mt-4 grid grid-cols-3 gap-3">
          <button
            onClick={() => setTheme("light")}
            className={cn(
              "flex flex-col items-center gap-2.5 p-4 rounded-xl border-2 transition-all duration-200 cursor-pointer",
              theme === "light"
                ? "border-primary bg-primary/5 shadow-sm"
                : "border-border hover:border-muted-foreground/30 hover:bg-muted/50",
            )}
          >
            <div className="h-10 w-10 rounded-lg bg-white border border-slate-200 flex items-center justify-center shadow-sm">
              <Sun className="h-5 w-5 text-amber-500" />
            </div>
            <span className="text-xs font-medium text-foreground">Light</span>
          </button>
          <button
            onClick={() => setTheme("dark")}
            className={cn(
              "flex flex-col items-center gap-2.5 p-4 rounded-xl border-2 transition-all duration-200 cursor-pointer",
              theme === "dark"
                ? "border-primary bg-primary/5 shadow-sm"
                : "border-border hover:border-muted-foreground/30 hover:bg-muted/50",
            )}
          >
            <div className="h-10 w-10 rounded-lg bg-slate-900 border border-slate-700 flex items-center justify-center shadow-sm">
              <Moon className="h-5 w-5 text-indigo-400" />
            </div>
            <span className="text-xs font-medium text-foreground">Dark</span>
          </button>
          <button
            onClick={() => setTheme("system")}
            className={cn(
              "flex flex-col items-center gap-2.5 p-4 rounded-xl border-2 transition-all duration-200 cursor-pointer",
              theme === "system"
                ? "border-primary bg-primary/5 shadow-sm"
                : "border-border hover:border-muted-foreground/30 hover:bg-muted/50",
            )}
          >
            <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-white to-slate-900 border border-slate-300 flex items-center justify-center shadow-sm">
              <Monitor className="h-5 w-5 text-slate-500" />
            </div>
            <span className="text-xs font-medium text-foreground">System</span>
          </button>
        </div>
      </div>

      <Separator />

      {/* Language */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Globe className="h-4 w-4 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium text-foreground">Language</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Choose the language used in the interface
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" className="text-xs rounded-lg">
          English
          <ChevronRight className="h-3 w-3 ml-1" />
        </Button>
      </div>

      <Separator />

      {/* Density */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-foreground">Compact Mode</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Reduce spacing in the interface for denser layout
          </p>
        </div>
        <Switch />
      </div>

      <Separator />

      {/* Animations */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-foreground">
            Reduce Animations
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Minimize motion for a calmer experience
          </p>
        </div>
        <Switch />
      </div>
    </div>
  );
}

function PersonalizationTab() {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-foreground">
          Personalization
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Tell KeilHQ about yourself for a better experience.
        </p>
      </div>

      <Separator />

      <div>
        <Label htmlFor="role" className="text-sm font-medium">
          Your Role
        </Label>
        <Input
          id="role"
          placeholder="e.g., Product Manager, Developer"
          className="mt-2 rounded-lg"
        />
        <p className="text-xs text-muted-foreground mt-1.5">
          This helps tailor the dashboard to your needs.
        </p>
      </div>

      <div>
        <Label htmlFor="team" className="text-sm font-medium">
          Team / Department
        </Label>
        <Input
          id="team"
          placeholder="e.g., Engineering, Design"
          className="mt-2 rounded-lg"
        />
      </div>

      <Separator />

      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-foreground">
            Smart Suggestions
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Get AI-powered suggestions based on your workflow
          </p>
        </div>
        <Switch defaultChecked />
      </div>

      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-foreground">Daily Digest</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Receive a summary of your day each morning
          </p>
        </div>
        <Switch defaultChecked />
      </div>
    </div>
  );
}

function AssistantTab() {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Assistant</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Configure your AI assistant preferences.
        </p>
      </div>

      <Separator />

      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-foreground">AI Assistant</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Get intelligent help across all features
          </p>
        </div>
        <Switch defaultChecked />
      </div>

      <Separator />

      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-foreground">Auto-complete</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Suggest completions as you type
          </p>
        </div>
        <Switch defaultChecked />
      </div>

      <Separator />

      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-foreground">
            Context Awareness
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Allow the assistant to understand your current context
          </p>
        </div>
        <Switch defaultChecked />
      </div>
    </div>
  );
}

function ShortcutsTab() {
  const shortcuts = [
    { keys: ["⌘", "K"], action: "Open command palette" },
    { keys: ["⌘", "B"], action: "Toggle sidebar" },
    { keys: ["⌘", "N"], action: "New item" },
    { keys: ["⌘", "⇧", "P"], action: "Open settings" },
    { keys: ["⌘", "/"], action: "Toggle assistant" },
    { keys: ["⌘", "D"], action: "Go to dashboard" },
    { keys: ["Esc"], action: "Close dialog / cancel" },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Shortcuts</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Keyboard shortcuts to help you work faster.
        </p>
      </div>

      <Separator />

      <div className="space-y-1">
        {shortcuts.map((shortcut, i) => (
          <div
            key={i}
            className="flex items-center justify-between py-3 px-3 rounded-lg hover:bg-muted/50 transition-colors"
          >
            <span className="text-sm text-foreground">{shortcut.action}</span>
            <div className="flex items-center gap-1">
              {shortcut.keys.map((key, j) => (
                <kbd
                  key={j}
                  className="min-w-[24px] h-6 px-1.5 flex items-center justify-center rounded-md border border-border bg-muted/70 text-[11px] font-mono font-medium text-muted-foreground"
                >
                  {key}
                </kbd>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TasksTab() {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Tasks</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Configure task defaults and behavior.
        </p>
      </div>

      <Separator />

      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-foreground">
            Auto-assign to me
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Automatically assign new tasks to yourself
          </p>
        </div>
        <Switch />
      </div>

      <Separator />

      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-foreground">
            Due date reminders
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Get notified before a task is due
          </p>
        </div>
        <Switch defaultChecked />
      </div>

      <Separator />

      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-foreground">
            Show completed tasks
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Keep completed tasks visible in lists
          </p>
        </div>
        <Switch />
      </div>
    </div>
  );
}

function NotificationsTab() {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Notifications</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Choose what you want to be notified about.
        </p>
      </div>

      <Separator />

      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-foreground">
            Push Notifications
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Receive push notifications in your browser
          </p>
        </div>
        <Switch defaultChecked />
      </div>

      <Separator />

      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-foreground">
            Email Notifications
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Get notified via email for important updates
          </p>
        </div>
        <Switch defaultChecked />
      </div>

      <Separator />

      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-foreground">Sound</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Play a sound when you receive a notification
          </p>
        </div>
        <Switch />
      </div>

      <Separator />

      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-foreground">Task mentions</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Notify when someone mentions you in a task
          </p>
        </div>
        <Switch defaultChecked />
      </div>
    </div>
  );
}

function ConnectorsTab() {
  const { data: gcalStatus, isLoading: gcalLoading } =
    useGoogleCalendarStatus();
  const connectGcal = useConnectGoogleCalendar();
  const disconnectGcal = useDisconnectGoogleCalendar();

  // Static placeholder connectors (not yet implemented)
  const staticConnectors = [
    { name: "GitHub", description: "Connect your repositories" },
    { name: "Slack", description: "Send notifications to Slack" },
    { name: "Jira", description: "Sync tasks with Jira" },
    { name: "Figma", description: "View design files inline" },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Connectors</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Connect third-party services to enhance your workflow.
        </p>
      </div>

      <Separator />

      <div className="space-y-3">
        {/* Google Calendar — live integration */}
        <div className="flex items-center justify-between p-4 rounded-xl border border-border bg-card hover:bg-muted/30 transition-colors">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
              <Plug className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-foreground">
                  Google Calendar
                </p>
                {!gcalLoading && (
                  <span
                    className={cn(
                      "inline-block h-2 w-2 rounded-full",
                      gcalStatus?.connected
                        ? "bg-emerald-500"
                        : "bg-muted-foreground/40",
                    )}
                  />
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {gcalStatus?.connected
                  ? "Scheduled tasks sync automatically"
                  : "Sync scheduled tasks to your calendar"}
              </p>
            </div>
          </div>
          {gcalStatus?.connected ? (
            <Button
              variant="outline"
              size="sm"
              className="text-xs rounded-lg"
              disabled={disconnectGcal.isPending}
              onClick={() => disconnectGcal.mutate()}
            >
              {disconnectGcal.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                "Disconnect"
              )}
            </Button>
          ) : (
            <Button
              variant="default"
              size="sm"
              className="text-xs rounded-lg"
              disabled={gcalLoading}
              onClick={connectGcal}
            >
              {gcalLoading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                "Connect"
              )}
            </Button>
          )}
        </div>

        {/* Static placeholder connectors */}
        {staticConnectors.map((connector, i) => (
          <div
            key={i}
            className="flex items-center justify-between p-4 rounded-xl border border-border bg-card hover:bg-muted/30 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                <Plug className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">
                  {connector.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {connector.description}
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="text-xs rounded-lg"
              disabled
            >
              Coming soon
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

function ApiTab() {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-foreground">API</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Manage API keys and integrations.
        </p>
      </div>

      <Separator />

      <div className="p-4 rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">API Key</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Your secret API key for programmatic access
            </p>
          </div>
          <Button variant="outline" size="sm" className="text-xs rounded-lg">
            Generate new key
          </Button>
        </div>
        <div className="mt-4">
          <div className="flex items-center gap-2">
            <Input
              value="sk-••••••••••••••••••••••••"
              readOnly
              className="font-mono text-xs rounded-lg bg-muted/50"
            />
            <Button
              variant="outline"
              size="sm"
              className="text-xs rounded-lg shrink-0"
            >
              Copy
            </Button>
          </div>
        </div>
      </div>

      <Separator />

      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-foreground">Webhook URL</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Receive real-time event notifications
          </p>
        </div>
        <Button variant="outline" size="sm" className="text-xs rounded-lg">
          Configure
        </Button>
      </div>
    </div>
  );
}

function EnterpriseTab() {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Enterprise</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Enterprise features and team management.
        </p>
      </div>

      <Separator />

      <div className="p-6 rounded-xl border border-border bg-gradient-to-br from-muted/30 to-muted/10 text-center">
        <Building2 className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
        <h3 className="text-sm font-semibold text-foreground">
          Upgrade to Enterprise
        </h3>
        <p className="text-xs text-muted-foreground mt-1.5 max-w-sm mx-auto">
          Get access to SSO, advanced analytics, audit logs, and priority
          support.
        </p>
        <Button size="sm" className="mt-4 rounded-lg text-xs">
          Contact Sales
        </Button>
      </div>

      <Separator />

      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-foreground">Team Members</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Manage who has access to your organisation
          </p>
        </div>
        <Button variant="outline" size="sm" className="text-xs rounded-lg">
          Manage team
          <ChevronRight className="h-3 w-3 ml-1" />
        </Button>
      </div>
    </div>
  );
}

// ─── Tab Content Map ─────────────────────────────────────────────────
const accountTabContent: Record<AccountTab, React.FC> = {
  account: AccountTab,
  preferences: PreferencesTab,
  personalization: PersonalizationTab,
  assistant: AssistantTab,
  shortcuts: ShortcutsTab,
  tasks: TasksTab,
  notifications: NotificationsTab,
  connectors: ConnectorsTab,
};

const workspaceTabContent: Record<WorkspaceTab, React.FC> = {
  "org-general": OrgGeneralTab,
  "org-members": OrgMembersTab,
  "org-spaces": OrgSpacesTab,
  api: ApiTab,
  enterprise: EnterpriseTab,
};

// ─── Main Settings Dialog ────────────────────────────────────────────
interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialTab?: SettingsTab;
}

export function SettingsDialog({
  open,
  onOpenChange,
  initialTab = "account",
}: SettingsDialogProps) {
  const { organisations, activeOrgId, setActiveOrganisation } = useAppContext();
  const location = useLocation();
  const navigate = useNavigate();
  
  const handleManualSwitch = (orgId: string) => {
    const isDetailRoute = /^\/(tasks|events)\/[^\/]+/.test(location.pathname);
    const isChanging = orgId !== activeOrgId;
    
    setActiveOrganisation(orgId);

    if (isDetailRoute && isChanging) {
      navigate("/tasks");
    }
  };
  const [mode, setMode] = useState<"account" | "workspace">("account");
  const [activeAccountTab, setActiveAccountTab] = useState<AccountTab>(
    initialTab as AccountTab || "account"
  );
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState<WorkspaceTab>("org-general");

  const selectedOrg =
    organisations.find((org) => org.id === activeOrgId) || organisations[0];

  const ActiveContent = mode === "account"
    ? accountTabContent[activeAccountTab]
    : workspaceTabContent[activeWorkspaceTab];

  useEffect(() => {
    if (open) {
      setMode("account");
      setActiveAccountTab(initialTab as AccountTab || "account");
    }
  }, [initialTab, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="!max-w-[calc(100vw-40px)] !w-[calc(100vw-40px)] !h-[calc(100vh-40px)] !max-h-[calc(100vh-40px)] !rounded-2xl !p-0 !gap-0 border border-border shadow-2xl overflow-hidden"
      >
        <VisuallyHidden.Root>
          <DialogTitle>Settings</DialogTitle>
        </VisuallyHidden.Root>

        <div className="flex h-full w-full overflow-hidden rounded-2xl">
          {/* ── Sidebar ─────────────────────────────────── */}
          <aside className="w-[280px] shrink-0 border-r border-border bg-sidebar flex flex-col h-full rounded-l-2xl">
            {/* Back / Home */}
            <div className="p-4 pb-2">
              <button
                onClick={() => mode === "workspace" ? setMode("account") : onOpenChange(false)}
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer group"
              >
                <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
                <span className="font-medium">
                  {mode === "workspace" ? "Back to App Settings" : "Back"}
                </span>
              </button>
            </div>

            {/* Workspace Switcher - shown only in workspace mode */}
            {mode === "workspace" && (
              <div className="px-4 py-4">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="ghost"
                      className="w-full justify-between px-2 h-12 hover:bg-muted/50 rounded-xl border border-border/50"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold shrink-0">
                          {selectedOrg?.name?.charAt(0).toUpperCase() || "W"}
                        </div>
                        <div className="flex flex-col items-start min-w-0 text-left">
                          <span className="text-sm font-semibold truncate w-full">
                            {selectedOrg?.name || "Select Organisation"}
                          </span>
                          <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-tight">
                            Organisation
                          </span>
                        </div>
                      </div>
                      <ChevronUp className="h-4 w-4 text-muted-foreground rotate-180" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    className="w-[248px] p-1 rounded-xl"
                    align="start"
                    side="bottom"
                    sideOffset={8}
                  >
                    <div className="space-y-1">
                      {organisations.map((org) => (
                         <button
                           key={org.id}
                           onClick={() => handleManualSwitch(org.id)}
                          className={cn(
                            "w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-colors",
                            activeOrgId === org.id
                              ? "bg-primary text-primary-foreground shadow-sm"
                              : "hover:bg-muted text-muted-foreground hover:text-foreground",
                          )}
                        >
                          <div
                            className={cn(
                              "h-6 w-6 rounded flex items-center justify-center text-[10px] font-bold shrink-0",
                              activeOrgId === org.id
                                ? "bg-primary-foreground/20"
                                : "bg-primary/10 text-primary",
                            )}
                          >
                            {org.name.charAt(0).toUpperCase()}
                          </div>
                          <span className="flex-1 truncate text-left font-medium">
                            {org.name}
                          </span>
                          {activeOrgId === org.id && (
                            <Check className="h-3.5 w-3.5" />
                          )}
                        </button>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            )}

            {/* Nav Groups */}
            <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-6">
              {/* Workspace button - shown only in account mode */}
              {mode === "account" && (
                <div>
                  <p className="px-2 mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
                    Organisation
                  </p>
                  <button
                    onClick={() => setMode("workspace")}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] font-medium transition-all duration-150 cursor-pointer text-muted-foreground hover:text-foreground hover:bg-muted/60"
                  >
                    <Building2 className="h-4 w-4 shrink-0" />
                    Organisation
                  </button>
                </div>
              )}


              {/* Account section */}
              {mode === "account" ? (
                <div>
                  <p className="px-2 mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
                    Account
                  </p>
                  <div className="space-y-0.5">
                    {accountNavItems.map((item) => {
                      const Icon = item.icon;
                      return (
                        <button
                          key={item.id}
                          onClick={() => setActiveAccountTab(item.id)}
                          className={cn(
                            "w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] font-medium transition-all duration-150 cursor-pointer",
                            activeAccountTab === item.id
                              ? "bg-primary text-primary-foreground shadow-sm"
                              : "text-muted-foreground hover:text-foreground hover:bg-muted/60",
                          )}
                        >
                          <Icon className="h-4 w-4 shrink-0" />
                          {item.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div>
                  <p className="px-2 mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
                    Settings
                  </p>
                  <div className="space-y-0.5">
                    {workspaceNavItems.map((item) => {
                      const Icon = item.icon;
                      return (
                        <button
                          key={item.id}
                          onClick={() => setActiveWorkspaceTab(item.id)}
                          className={cn(
                            "w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] font-medium transition-all duration-150 cursor-pointer",
                            activeWorkspaceTab === item.id
                              ? "bg-primary text-primary-foreground shadow-sm"
                              : "text-muted-foreground hover:text-foreground hover:bg-muted/60",
                          )}
                        >
                          <Icon className="h-4 w-4 shrink-0" />
                          {item.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </nav>
          </aside>

          {/* ── Main Content ────────────────────────────── */}
          <main className="flex-1 overflow-y-auto bg-background">
            <div className="max-w-3xl mx-auto px-10 py-12">
              <ActiveContent />
            </div>
          </main>
        </div>
      </DialogContent>
    </Dialog>
  );
}
