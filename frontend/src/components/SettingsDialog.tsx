import { useEffect, useState, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { useMe } from "@/hooks/api/useMe";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { getOptimizedImageUrl } from "@/lib/image-optimizer";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
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
  LogOut,
  ChevronRight,
  ChevronUp,
  ChevronDown,
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
  MessageSquare,
  PanelRight,
  Clock,
  Globe2,
  RefreshCw,
} from "lucide-react";
import { Flame, Target, Rocket, CalendarOff, CalendarDays, CheckCircle2 } from "lucide-react";
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
import { Loader2, Copy, Mic, Github } from "lucide-react";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import {
  useGoogleCalendarStatus,
  useConnectGoogleCalendar,
  useDisconnectGoogleCalendar,
} from "@/hooks/api/useGoogleCalendar";
import {
  useGitHubStatus,
  useConnectGitHub,
  useDisconnectGitHub,
} from "@/hooks/api/useGitHub";
import {
  useNotionStatus,
  useConnectNotion,
  useConnectNotionManual,
  useDisconnectNotion,
} from "@/hooks/api/useNotion";
import { toast } from "sonner";
import { orgTaskKeys } from "@/hooks/api/useTasks";
import { usePreferences, useUpdateSttProvider, useUpdateDeleteSlotsOnComplete, type SttProvider } from "@/hooks/api/usePreferences";
import { useOpenDM } from "@/hooks/api/useChat";
import { useChatStore } from "@/store/useChatStore";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { type SessionRecord } from "@/contexts/AuthContext";
import { useSettingsStore } from "@/store/useSettingsStore";
import { useOrgPlan, useCreateCheckout, useCreateOrgCheckout, usePortalUrl } from "@/hooks/api/useBilling";
import { PLAN_DISPLAY, STATUS_DISPLAY } from "@/types/billing";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { CreditCard, Zap, ExternalLink } from "lucide-react";

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
  | "personalization"
  | "shortcuts"
  | "tasks"
  | "notifications"
  | "connectors"
  | "sessions"
  | "billing";

type WorkspaceTab = "org-general" | "org-members" | "org-spaces";

export type SettingsTab = AccountTab | WorkspaceTab;

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
  { id: "personalization", label: "Personalization", icon: Sparkles },
  { id: "shortcuts", label: "Shortcuts", icon: Keyboard },
  { id: "tasks", label: "Tasks", icon: ListTodo },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "connectors", label: "Connectors", icon: Plug },
  { id: "sessions", label: "Sessions", icon: Monitor },
  { id: "billing", label: "Billing & Usage", icon: CreditCard },
];

const workspaceNavItems: WorkspaceNavItem[] = [
  { id: "org-general", label: "General", icon: Settings },
  { id: "org-members", label: "Members", icon: User },
  { id: "org-spaces", label: "Spaces", icon: Layers },
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
  const { organisations, activeOrgId, setActiveOrganisation } = useAppContext();
  const renameOrg = useRenameOrganisation();
  const deleteOrg = useDeleteOrganisation();
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
        const personalOrg = organisations.find((o) => o.is_personal);
        if (personalOrg) {
          setActiveOrganisation(personalOrg.id);
        }
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
              <Hash className="size-3" />
              {selectedOrg.id}
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="size-8 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={() => handleCopyToClipboard(selectedOrg.id, "Organisation ID")}
            >
              <Copy className="size-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {isOwner && !selectedOrg?.is_personal && (
        <div className="pt-10 border-t border-border/50">
          <div className="bg-destructive/5 rounded-2xl border border-destructive/20 p-6">
            <div className="flex items-center gap-3 text-destructive mb-4">
              <AlertTriangle className="size-5" />
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
                  <Loader2 className="size-4 animate-spin mr-2" />
                ) : (
                  <Archive className="size-4 mr-2" />
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
  const { activeOrgId, activeSpaceId, organisations } = useAppContext();
  const selectedOrg = organisations.find((org) => org.id === activeOrgId);
  const { data: members = [] } = useOrgMembers(activeOrgId || "");
  const createInvite = useCreateOrgInvite();
  const updateRole = useUpdateOrgMemberRole(activeOrgId || "");
  const removeMember = useRemoveOrgMember(activeOrgId || "");
  const [inviteLink, setInviteLink] = useState("");
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const isAdmin =
    selectedOrg?.role === "owner" || selectedOrg?.role === "admin";

  const openDM = useOpenDM(activeOrgId, activeSpaceId);
  const { setActiveChannel, openChatDialog } = useChatStore();

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
                <UserPlus className="size-4 mr-2" />
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
                      <Loader2 className="size-4 animate-spin mr-2" />
                    ) : (
                      <Plus className="size-4 mr-2" />
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
                        className="size-11 shrink-0 rounded-xl"
                        onClick={() => handleCopyToClipboard(inviteLink, "Invite link")}
                      >
                        <Copy className="size-4" />
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
          const username = isSelf
            ? (user?.user_metadata?.username || user?.email?.split("@")[0] || member.email.split("@")[0])
            : member.email.split("@")[0];

          return (
            <div
              key={member.user_id}
              className="flex items-center justify-between p-3 rounded-2xl hover:bg-muted/40 transition-colors group"
            >
              {/* Left Section: Avatar + Details */}
              <div className="flex items-center gap-4 flex-1 min-w-0 pr-4">
                <Avatar className="size-10 border-2 border-background shadow-sm shrink-0">
                  <AvatarImage src={getOptimizedImageUrl(member.avatar_url, { width: 120, height: 120 })} alt={member.name || member.email} />
                  <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                    {(member.name || member.email).charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold truncate">
                      {member.name || "Unnamed User"}
                    </p>
                    {isSelf && (
                      <Badge
                        variant="outline"
                        className="text-[10px] h-4 px-1.5 font-normal border-primary/20 bg-primary/5 text-primary shrink-0"
                      >
                        You
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs font-medium text-muted-foreground/80 mt-0.5 truncate">
                    @{username}
                  </p>
                  <div className="flex items-center gap-1 text-[11px] text-muted-foreground/60 mt-0.5 truncate">
                    <Mail className="size-3 shrink-0" />
                    <span className="truncate">{member.email}</span>
                  </div>
                </div>
              </div>

              {/* Middle Section: Workspace Column */}
              <div className="w-[120px] shrink-0 flex justify-start">
                {isAdmin && (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="h-5 px-1.5 text-[9px] text-muted-foreground border-border/40 hover:bg-muted/80 hover:text-foreground transition-colors font-normal flex items-center gap-1 rounded animate-in fade-in duration-200"
                      >
                        <Layers className="size-2.5" />
                        <span>Workspaces</span>
                        <span className="font-semibold text-foreground/80">{member.workspaces?.length || 0}</span>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      className="w-56 p-1 rounded-xl shadow-lg border border-border/80 bg-popover"
                      align="start"
                      onWheel={(e) => e.stopPropagation()}
                    >
                      <div className="px-2 py-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest border-b border-border/40 mb-1">
                        Workspaces ({member.workspaces?.length || 0})
                      </div>
                      <div
                        className="space-y-0.5 max-h-48 overflow-y-auto"
                        onWheel={(e) => e.stopPropagation()}
                      >
                        {member.workspaces && member.workspaces.length > 0 ? (
                          member.workspaces.map((ws) => (
                            <div key={ws.id} className="flex items-center justify-between p-1.5 rounded-lg hover:bg-muted/50 transition-colors">
                              <div className="flex items-center gap-2 min-w-0">
                                <div className="size-6 rounded-md bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold shrink-0">
                                  {ws.name.charAt(0).toUpperCase()}
                                </div>
                                <span className="text-xs font-medium truncate text-foreground">{ws.name}</span>
                              </div>
                              {ws.role && (
                                <Badge variant="secondary" className="text-[8px] uppercase tracking-wider px-1.5 py-0.5 rounded-md">
                                  {ws.role}
                                </Badge>
                              )}
                            </div>
                          ))
                        ) : (
                          <div className="p-2 text-center text-xs text-muted-foreground">
                            No workspaces
                          </div>
                        )}
                      </div>
                    </PopoverContent>
                  </Popover>
                )}
              </div>

              {/* Right Section: Chat + Role + Actions */}
              <div className="flex items-center gap-2 shrink-0 justify-end">
                {/* Group: Chat + Role */}
                <div className="flex items-center gap-2 shrink-0 justify-end w-[150px]">
                  {!isSelf ? (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 rounded-lg text-muted-foreground hover:bg-muted/80 hover:text-foreground transition-colors border-none"
                            onClick={() => {
                              openDM.mutate(member.user_id, {
                                onSuccess: (channel: any) => {
                                  setActiveChannel(channel.id);
                                  openChatDialog();
                                },
                                onError: (err: any) => {
                                  toast.error(err?.response?.data?.message || "Failed to start chat");
                                }
                              });
                            }}
                            disabled={openDM.isPending}
                          >
                            {openDM.isPending && openDM.variables === member.user_id ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : (
                              <MessageSquare className="size-4" />
                            )}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="top">
                          Start Chat
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  ) : (
                    <div className="size-8 shrink-0" />
                  )}

                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        disabled={!canEdit}
                        className={cn(
                          "flex items-center px-3 py-1.5 rounded-lg transition-colors justify-between w-[110px]",
                          canEdit
                            ? "hover:bg-muted border border-border/50"
                            : "cursor-default border border-transparent",
                        )}
                      >
                        <RoleBadge role={member.role} />
                        {canEdit ? (
                          <ChevronRight className="size-3 text-muted-foreground rotate-90 shrink-0" />
                        ) : (
                          <div className="size-3 shrink-0" />
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
                            <Check className="size-3" />
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
                            <Check className="size-3" />
                          )}
                        </button>
                      </PopoverContent>
                    )}
                  </Popover>
                </div>

                {/* More Action Menu */}
                {canEdit ? (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 rounded-lg text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <MoreVertical className="size-4" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-48 p-1 rounded-xl" align="end">
                      <button
                        onClick={() => removeMember.mutate(member.user_id)}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                      >
                        <Trash2 className="size-3.5" />
                        Remove from Organisation
                      </button>
                    </PopoverContent>
                  </Popover>
                ) : (
                  isAdmin && <div className="size-8 shrink-0" />
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
              className="absolute right-1.5 top-1.5 size-9 rounded-xl opacity-0 group-focus-within:opacity-100 transition-opacity"
              onClick={handleCreateSpace}
              disabled={!newSpaceName.trim() || createSpace.isPending}
            >
              {createSpace.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Plus className="size-4" />
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
                <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                  <Layers className="size-5" />
                </div>
                <div>
                  <p className="font-semibold text-sm">{space.name}</p>
                  <p className="text-xs text-muted-foreground">Active space</p>
                </div>
              </div>
              <ChevronRight className="size-4 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
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
            <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <Layers className="size-5" />
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

          {isAdmin && !space.is_private && (
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
      {isAdmin && !space.is_private && (
        <div className="rounded-lg border border-border p-2">
          <div className="flex items-center gap-2">
            <Search className="size-4 text-muted-foreground" />
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
                    <Plus className="size-3.5" />
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
          const canEditRole = canManageSpaceMembers && !space.is_private && !isSelf && (!isTargetAdmin || orgRole === "owner" || orgRole === "admin");

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
                          {member.role === r && <Check className="size-3.5 text-primary shrink-0" />}
                        </button>
                      ))}
                    </PopoverContent>
                  </Popover>
                ) : (
                  <RoleBadge role={member.role} />
                )}
                {isAdmin && !space.is_private && !isSelf && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 text-muted-foreground hover:text-destructive"
                    onClick={() => removeMember.mutate(member.user_id)}
                  >
                    <Trash2 className="size-3.5" />
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
  const { user, signOut, signOutGlobal } = useAuth();
  const queryClient = useQueryClient();
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
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  const { data: me } = useMe();

  const userDisplayName =
    me?.name || user?.user_metadata?.full_name || user?.email || "User";
  const userEmail = user?.email || "";
  const username =
    user?.user_metadata?.username || user?.email?.split("@")[0] || "";
  const avatarUrl = me?.avatar_url || user?.user_metadata?.avatar_url || user?.user_metadata?.picture;

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
      // 1. Update Supabase metadata for local auth context
      const { error } = await supabase.auth.updateUser({
        data: { full_name: newName.trim() },
      });
      if (error) throw error;

      // 2. Call backend to update database and broadcast changes to other users
      await api.patch("users/profile", { name: newName.trim() });

      // 3. Immediately invalidate local queries so current user sees updates instantly
      await queryClient.invalidateQueries({ queryKey: ["me"] });
      await queryClient.invalidateQueries({ queryKey: ["orgs"] });
      await queryClient.invalidateQueries({ queryKey: ["spaces"] });
      await queryClient.invalidateQueries({ queryKey: ["chat"] });
      await queryClient.invalidateQueries({ queryKey: ["tasks"] });
      await queryClient.invalidateQueries({ queryKey: ["org-tasks"] });

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
      // 1. Call backend to update database and enforce uniqueness
      await api.patch("users/profile", { username: newUsername.trim() });

      // 2. Update Supabase metadata for local auth context
      const { error } = await supabase.auth.updateUser({
        data: { username: newUsername.trim() },
      });
      if (error) throw error;
      
      setSuccess("Username updated successfully");
      setIsEditingUsername(false);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || "Failed to update username");
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
      // Get S3 presigned upload URL
      const res = await api.post("v1/s3-upload/profile/avatar", {
        fileName: file.name,
        contentType: file.type || "application/octet-stream"
      });

      const { uploadUrl, publicUrl } = res.data.data;

      // Perform direct S3 upload via XMLHttpRequest
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", uploadUrl, true);
      xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");

      const uploadPromise = new Promise<void>((resolve, reject) => {
        xhr.onload = () => {
          if (xhr.status === 200) {
            resolve();
          } else {
            reject(new Error(`S3 upload failed with status ${xhr.status}`));
          }
        };
        xhr.onerror = () => reject(new Error("S3 upload network error"));
        xhr.send(file);
      });

      await uploadPromise;

      // Update Supabase auth metadata with new avatar public URL
      const { error: metaError } = await supabase.auth.updateUser({
        data: { avatar_url: publicUrl },
      });
      if (metaError) throw metaError;

      // Call backend to update database and broadcast changes to other users
      await api.patch("users/profile", { avatar_url: publicUrl });

      // Invalidate queries to reload updated profile info
      await queryClient.invalidateQueries({ queryKey: ["me"] });
      await queryClient.invalidateQueries({ queryKey: ["orgs"] });
      await queryClient.invalidateQueries({ queryKey: ["spaces"] });
      await queryClient.invalidateQueries({ queryKey: ["chat"] });
      await queryClient.invalidateQueries({ queryKey: ["tasks"] });
      await queryClient.invalidateQueries({ queryKey: ["org-tasks"] });

      setSuccess("Avatar updated successfully");
    } catch (err: any) {
      console.error("Failed to update avatar:", err);
      setError(err.message || "Failed to update avatar");
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
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
          <Avatar
            className={cn(
              "size-14 rounded-full ring-2 ring-background shadow-sm",
              avatarUrl && "cursor-pointer hover:opacity-90 transition-opacity"
            )}
            onClick={() => avatarUrl && setIsPreviewOpen(true)}
          >
            {avatarUrl ? (
              <img src={getOptimizedImageUrl(avatarUrl, { width: 192, height: 192 })} alt={userDisplayName} className="size-full object-cover rounded-full" />
            ) : (
              <AvatarFallback className="rounded-full bg-emerald-600 text-white text-lg font-semibold">
                {userInitials}
              </AvatarFallback>
            )}
          </Avatar>

          {avatarUrl && (
            <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
              <DialogContent className="max-w-md p-1 bg-transparent border-none shadow-none flex items-center justify-center">
                <VisuallyHidden.Root>
                  <DialogTitle>Avatar Preview</DialogTitle>
                </VisuallyHidden.Root>
                <img
                  src={avatarUrl}
                  alt={userDisplayName}
                  className="max-w-full max-h-[80vh] object-contain rounded-2xl shadow-2xl border-4 border-background bg-card"
                />
              </DialogContent>
            </Dialog>
          )}
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
            {loading ? <Loader2 className="size-3 animate-spin mr-2" /> : null}
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
          <Shield className="size-4 text-muted-foreground" />
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
                        {showPasswords ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                      </button>
                    </div>
                    <button
                      type="button"
                      className="text-[10px] text-primary hover:underline"
                      onClick={() => { }} // Dummy as requested
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
                    {loading && <Loader2 className="size-3 animate-spin mr-2" />}
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

      {/* Sessions section */}
      <div>
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Monitor className="size-4 text-muted-foreground" />
          Active Sessions
        </h3>
        <p className="text-xs text-muted-foreground mt-1 mb-4">
          Manage where you're signed in. Sign out of all devices or just this one.
        </p>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            className="text-xs rounded-lg text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 border-red-200 dark:border-red-800/40"
            onClick={signOutGlobal}
          >
            <Globe2 className="size-3.5 mr-1.5" />
            Sign out all devices
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs rounded-lg text-muted-foreground"
            onClick={() => useSettingsStore.getState().openSettings("sessions")}
          >
            View all sessions
          </Button>
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
          <LogOut className="size-3.5 mr-1.5" />
          Sign out
        </Button>
      </div>
    </div>
  );
}


function CalendarPreferenceSection() {
  const { data: prefs, isLoading } = usePreferences();
  const updateDeleteSlots = useUpdateDeleteSlotsOnComplete();

  const deleteSlotsOnComplete = prefs?.delete_slots_on_complete || false;

  const handleToggle = (checked: boolean) => {
    updateDeleteSlots.mutate(checked, {
      onSuccess: () => {
        toast.success(
          checked
            ? "Calendar slots will be deleted when task is completed"
            : "Calendar slots will be kept when task is completed"
        );
      },
      onError: () => {
        toast.error("Failed to update calendar preference");
      },
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-2">
        <Loader2 className="size-4 animate-spin text-muted-foreground" />
        <span className="text-xs text-muted-foreground">Loading calendar preference...</span>
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
        <CalendarDays className="size-4 text-muted-foreground" />
        Calendar Slots
      </h3>
      <p className="text-xs text-muted-foreground mt-1 mb-4">
        Choose how calendar slots behave when tasks are completed.
      </p>
      <div className="flex items-center justify-between p-4 rounded-xl border border-border/50 bg-muted/20">
        <div>
          <p className="text-xs font-semibold text-foreground">
            Delete Slots on Completion
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">
            Automatically delete calendar slots associated with a task when it is marked completed.
          </p>
        </div>
        <Switch
          checked={deleteSlotsOnComplete}
          onCheckedChange={handleToggle}
          disabled={updateDeleteSlots.isPending}
        />
      </div>
    </div>
  );
}

const STT_PROVIDERS: Array<{
  id: SttProvider;
  name: string;
  badge?: string;
  description: string;
  features: string[];
}> = [
    {
      id: "sarvam",
      name: "Sarvam AI",
      badge: "Recommended",
      description: "Saaras v3 — purpose-built for Indian languages and English.",
      features: ["23 Indian languages", "Speaker diarization", "Auto language detection", "Up to 2h audio"],
    },
    {
      id: "elevenlabs",
      name: "ElevenLabs",
      description: "Scribe v2 — broad language support with word-level detail.",
      features: ["90+ languages", "Word-level timestamps", "Fast processing", "Speaker diarization"],
    },
  ];

function SttProviderSelector() {
  const { data: prefs, isLoading } = usePreferences();
  const updateProvider = useUpdateSttProvider();

  const currentProvider: SttProvider = prefs?.stt_provider || "sarvam";

  const handleProviderChange = (provider: SttProvider) => {
    if (provider === currentProvider || updateProvider.isPending) return;
    const label = STT_PROVIDERS.find((p) => p.id === provider)?.name ?? provider;
    updateProvider.mutate(provider, {
      onSuccess: () => toast.success(`Speech-to-text provider changed to ${label}`),
      onError: () => toast.error("Failed to update STT provider"),
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-2">
        <Loader2 className="size-4 animate-spin text-muted-foreground" />
        <span className="text-xs text-muted-foreground">Loading preferences...</span>
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
        <Mic className="size-4 text-muted-foreground" />
        Speech-to-Text Provider
      </h3>
      <p className="text-xs text-muted-foreground mt-1 mb-4">
        Choose which AI service transcribes your meeting recordings.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {STT_PROVIDERS.map((provider) => {
          const isActive = currentProvider === provider.id;
          return (
            <button
              key={provider.id}
              onClick={() => handleProviderChange(provider.id)}
              disabled={updateProvider.isPending}
              className={cn(
                "flex flex-col items-start gap-3 p-4 rounded-xl border-2 transition-all duration-200 cursor-pointer text-left",
                isActive
                  ? "border-primary bg-primary/5 shadow-sm"
                  : "border-border hover:border-muted-foreground/30 hover:bg-muted/50",
                updateProvider.isPending && "opacity-60 cursor-not-allowed",
              )}
            >
              {/* Header row */}
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-foreground">{provider.name}</span>
                  {provider.badge && (
                    <span className="text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-md bg-primary/10 text-primary">
                      {provider.badge}
                    </span>
                  )}
                </div>
                {isActive && (
                  updateProvider.isPending
                    ? <Loader2 className="size-4 animate-spin text-primary" />
                    : <Check className="size-4 text-primary shrink-0" />
                )}
              </div>

              {/* Description */}
              <span className="text-[11px] text-muted-foreground leading-tight">
                {provider.description}
              </span>

              {/* Feature pills */}
              <div className="flex flex-wrap gap-1.5">
                {provider.features.map((f) => (
                  <span
                    key={f}
                    className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border/50"
                  >
                    {f}
                  </span>
                ))}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

const BACKGROUNDS = [
  { id: "none", name: "None", url: "" },
  { id: "lib-gate", name: "Library Gate", url: "/backgrounds/lib-gate.png" },
  { id: "mountain-garden", name: "Mountain Garden", url: "/backgrounds/mountain-garden.jpg" },
  { id: "open-garden", name: "Open Garden", url: "/backgrounds/open-garden.png" }
];

function PersonalizationTab() {
  const { theme, setTheme } = useTheme();
  const showLocalAISettings = import.meta.env.VITE_ENABLE_LOCAL_AI_SETTINGS === 'true';
  const [chatView, setChatView] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("default_chat_view") || "sidebar";
    }
    return "sidebar";
  });

  const handleChatViewChange = (view: "sidebar" | "dialog") => {
    setChatView(view);
    localStorage.setItem("default_chat_view", view);
    toast.success(`Default chat view set to ${view === "sidebar" ? "Sidebar" : "Dialog"}`);
  };

  const [timeFormat, setTimeFormat] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("time_format") || "12h";
    }
    return "12h";
  });

  const handleTimeFormatChange = (format: "12h" | "24h") => {
    setTimeFormat(format);
    localStorage.setItem("time_format", format);
    toast.success(`Time format set to ${format === "12h" ? "12-hour" : "24-hour"}`);
    window.dispatchEvent(new Event("time_format_changed"));
  };

  const [calendarDetailsView, setCalendarDetailsView] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("default_calendar_details_view") || "sidebar";
    }
    return "sidebar";
  });

  const handleCalendarDetailsViewChange = (view: "sidebar" | "dialog") => {
    setCalendarDetailsView(view);
    localStorage.setItem("default_calendar_details_view", view);
    toast.success(`Default calendar detail view set to ${view === "sidebar" ? "Sidebar" : "Dialog"}`);
    window.dispatchEvent(new Event("calendar_details_view_changed"));
  };

  const [hideCalendarDayHeaders, setHideCalendarDayHeaders] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("hide_calendar_day_headers") === "true";
    }
    return false;
  });

  const handleHideCalendarDayHeadersChange = (hide: boolean) => {
    setHideCalendarDayHeaders(hide);
    localStorage.setItem("hide_calendar_day_headers", hide ? "true" : "false");
    toast.success(hide ? "Calendar day headers hidden" : "Calendar day headers shown");
    window.dispatchEvent(new Event("calendar_day_headers_preference_changed"));
  };

  const [dashboardBackground, setDashboardBackground] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("dashboard_background") || "open-garden";
    }
    return "open-garden";
  });

  const handleBackgroundChange = (val: string) => {
    setDashboardBackground(val);
    localStorage.setItem("dashboard_background", val);
    window.dispatchEvent(new Event("dashboard_background_changed"));
  };

  const [localUrl, setLocalUrl] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("local_ai_base_url") || "http://localhost:8080/v1";
    }
    return "http://localhost:8080/v1";
  });

  const [localModel, setLocalModel] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("local_ai_model") || "gemma-4";
    }
    return "gemma-4";
  });

  const handleUrlChange = (val: string) => {
    setLocalUrl(val);
    localStorage.setItem("local_ai_base_url", val);
  };

  const handleModelChange = (val: string) => {
    setLocalModel(val);
    localStorage.setItem("local_ai_model", val);
  };

  const [openRouterModel, setOpenRouterModel] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("openrouter_model") || "openai/gpt-4o-mini";
    }
    return "openai/gpt-4o-mini";
  });

  const handleOpenRouterModelChange = (val: string) => {
    setOpenRouterModel(val);
    localStorage.setItem("openrouter_model", val);
  };

  const [modelSelection, setModelSelection] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("ai_model_selection") || "gemini";
    }
    return "gemini";
  });

  const handleGlobalModelChange = (val: string) => {
    setModelSelection(val);
    localStorage.setItem("ai_model_selection", val);
    window.dispatchEvent(new Event("ai_model_selection_changed"));
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-foreground">
          Personalization
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Customize your KeilHQ experience.
        </p>
      </div>

      <Separator />

      {/* Theme */}
      <div>
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Palette className="size-4 text-muted-foreground" />
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
            <div className="size-10 rounded-lg bg-white border border-slate-200 flex items-center justify-center shadow-sm">
              <Sun className="size-5 text-amber-500" />
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
            <div className="size-10 rounded-lg bg-slate-900 border border-slate-700 flex items-center justify-center shadow-sm">
              <Moon className="size-5 text-indigo-400" />
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
            <div className="size-10 rounded-lg bg-gradient-to-br from-white to-slate-900 border border-slate-300 flex items-center justify-center shadow-sm">
              <Monitor className="size-5 text-slate-500" />
            </div>
            <span className="text-xs font-medium text-foreground">System</span>
          </button>
        </div>
      </div>

      <Separator />

      {/* Default Chat View */}
      <div>
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <MessageSquare className="size-4 text-muted-foreground" />
          Default Chat View
        </h3>
        <p className="text-xs text-muted-foreground mt-1 mb-4">
          Choose where the team chat opens by default when you click the chat icon.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => handleChatViewChange("sidebar")}
            className={cn(
              "flex flex-col items-start gap-2.5 p-4 rounded-xl border-2 transition-all duration-200 cursor-pointer text-left w-full",
              chatView === "sidebar"
                ? "border-primary bg-primary/5 shadow-sm"
                : "border-border hover:border-muted-foreground/30 hover:bg-muted/50",
            )}
          >
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                <PanelRight className="size-4 text-muted-foreground" />
                <span className="text-xs font-semibold text-foreground">Sidebar (Drawer)</span>
              </div>
              {chatView === "sidebar" && (
                <Check className="size-4 text-primary" />
              )}
            </div>
            <span className="text-[11px] text-muted-foreground leading-tight mt-1">
              Opens the chat in a collapsible side drawer on the right side of the screen.
            </span>
          </button>
          <button
            onClick={() => handleChatViewChange("dialog")}
            className={cn(
              "flex flex-col items-start gap-2.5 p-4 rounded-xl border-2 transition-all duration-200 cursor-pointer text-left w-full",
              chatView === "dialog"
                ? "border-primary bg-primary/5 shadow-sm"
                : "border-border hover:border-muted-foreground/30 hover:bg-muted/50",
            )}
          >
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                <Monitor className="size-4 text-muted-foreground" />
                <span className="text-xs font-semibold text-foreground">Full Dialog (Modal)</span>
              </div>
              {chatView === "dialog" && (
                <Check className="size-4 text-primary" />
              )}
            </div>
            <span className="text-[11px] text-muted-foreground leading-tight mt-1">
              Opens the chat in a larger, centered dialog modal for a more focused conversation.
            </span>
          </button>
        </div>
      </div>

      <Separator />

      {/* Time Format */}
      <div>
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Clock className="size-4 text-muted-foreground" />
          Time Format
        </h3>
        <p className="text-xs text-muted-foreground mt-1 mb-4">
          Choose between 12-hour or 24-hour time format for the dashboard.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => handleTimeFormatChange("12h")}
            className={cn(
              "flex flex-col items-start gap-2.5 p-4 rounded-xl border-2 transition-all duration-200 cursor-pointer text-left w-full",
              timeFormat === "12h"
                ? "border-primary bg-primary/5 shadow-sm"
                : "border-border hover:border-muted-foreground/30 hover:bg-muted/50",
            )}
          >
            <div className="flex items-center justify-between w-full">
              <span className="text-sm font-semibold text-foreground">12-hour (AM/PM)</span>
              {timeFormat === "12h" && (
                <Check className="size-4 text-primary" />
              )}
            </div>
            <span className="text-[11px] text-muted-foreground leading-tight mt-1">
              Example: 2:30 PM
            </span>
          </button>
          <button
            onClick={() => handleTimeFormatChange("24h")}
            className={cn(
              "flex flex-col items-start gap-2.5 p-4 rounded-xl border-2 transition-all duration-200 cursor-pointer text-left w-full",
              timeFormat === "24h"
                ? "border-primary bg-primary/5 shadow-sm"
                : "border-border hover:border-muted-foreground/30 hover:bg-muted/50",
            )}
          >
            <div className="flex items-center justify-between w-full">
              <span className="text-sm font-semibold text-foreground">24-hour</span>
              {timeFormat === "24h" && (
                <Check className="size-4 text-primary" />
              )}
            </div>
            <span className="text-[11px] text-muted-foreground leading-tight mt-1">
              Example: 14:30
            </span>
          </button>
        </div>
      </div>

      <Separator />

      {/* Calendar Details View */}
      <div>
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <PanelRight className="size-4 text-muted-foreground" />
          Default Calendar Details View
        </h3>
        <p className="text-xs text-muted-foreground mt-1 mb-4">
          Choose where task or event details are shown when clicked in the calendar.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => handleCalendarDetailsViewChange("sidebar")}
            className={cn(
              "flex flex-col items-start gap-2.5 p-4 rounded-xl border-2 transition-all duration-200 cursor-pointer text-left w-full",
              calendarDetailsView === "sidebar"
                ? "border-primary bg-primary/5 shadow-sm"
                : "border-border hover:border-muted-foreground/30 hover:bg-muted/50",
            )}
          >
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                <PanelRight className="size-4 text-muted-foreground" />
                <span className="text-xs font-semibold text-foreground">Right Sidebar</span>
              </div>
              {calendarDetailsView === "sidebar" && (
                <Check className="size-4 text-primary" />
              )}
            </div>
            <span className="text-[11px] text-muted-foreground leading-tight mt-1">
              Shows task or event details in the right-hand panel of the calendar.
            </span>
          </button>
          <button
            onClick={() => handleCalendarDetailsViewChange("dialog")}
            className={cn(
              "flex flex-col items-start gap-2.5 p-4 rounded-xl border-2 transition-all duration-200 cursor-pointer text-left w-full",
              calendarDetailsView === "dialog"
                ? "border-primary bg-primary/5 shadow-sm"
                : "border-border hover:border-muted-foreground/30 hover:bg-muted/50",
            )}
          >
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                <Monitor className="size-4 text-muted-foreground" />
                <span className="text-xs font-semibold text-foreground">Centered Dialog</span>
              </div>
              {calendarDetailsView === "dialog" && (
                <Check className="size-4 text-primary" />
              )}
            </div>
            <span className="text-[11px] text-muted-foreground leading-tight mt-1">
              Shows details in a focused popup modal overlay.
            </span>
          </button>
        </div>
      </div>

      <Separator />

      {/* Hide Calendar Day Headers */}
      <div>
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <CalendarDays className="size-4 text-muted-foreground" />
          Calendar Headers
        </h3>
        <p className="text-xs text-muted-foreground mt-1 mb-4">
          Choose whether to display day names (Mon, Tue, etc.) at the top of the calendar grid.
        </p>
        <div className="flex items-center justify-between p-4 rounded-xl border border-border/50 bg-muted/20">
          <div>
            <p className="text-xs font-semibold text-foreground">Show Calendar Day Headers</p>
            <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">
              Toggle day name headers visible/hidden on all calendar views.
            </p>
          </div>
          <Switch
            checked={!hideCalendarDayHeaders}
            onCheckedChange={(checked) => handleHideCalendarDayHeadersChange(!checked)}
          />
        </div>
      </div>

      <Separator />

      {/* Language */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Globe className="size-4 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium text-foreground">Language</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Choose the language used in the interface
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" className="text-xs rounded-lg">
          English
          <ChevronRight className="size-3 ml-1" />
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

      <Separator />

      {/* Calendar Slots Preference */}
      <CalendarPreferenceSection />

      <Separator />

      {/* Speech-to-Text Provider */}
      <SttProviderSelector />

      <Separator />

      {/* Dashboard Background */}
      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Palette className="size-4 text-muted-foreground" />
            Dashboard Background
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            Choose a visual style or background image for your dashboard home screen.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 pt-1">
          {BACKGROUNDS.map((bg) => {
            const isSelected = dashboardBackground === bg.id;
            return (
              <button
                key={bg.id}
                type="button"
                onClick={() => handleBackgroundChange(bg.id)}
                className={cn(
                  "group relative flex flex-col overflow-hidden rounded-xl border bg-card text-left transition-all duration-300 hover:shadow-md",
                  isSelected
                    ? "border-primary ring-1 ring-primary"
                    : "border-border/60 hover:border-border-muted"
                )}
              >
                {/* Image Preview Container */}
                <div className="relative aspect-[16/9] w-full overflow-hidden bg-muted flex items-center justify-center">
                  {bg.id === "none" ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground/60 p-2">
                      <Palette className="size-6 mb-1" />
                      <span className="text-[10px] font-medium font-sans">Solid Theme Color</span>
                    </div>
                  ) : (
                    <>
                      <img
                        src={bg.url}
                        alt={bg.name}
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-black/10 transition-opacity duration-300 group-hover:opacity-0" />
                    </>
                  )}
                  {isSelected && (
                    <div className="absolute top-2 right-2 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm animate-in zoom-in duration-200">
                      <Check className="size-3" />
                    </div>
                  )}
                </div>
                {/* Title */}
                <div className="p-2.5 flex items-center justify-between">
                  <span className="text-xs font-medium text-foreground truncate">
                    {bg.name}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <Separator />

      {showLocalAISettings && (
        <>
          {/* Model Selection section */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Bot className="size-4 text-muted-foreground" />
              Default AI Model
            </h3>

            <div className="space-y-3 pt-1">
              <div>
                <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  Model Selection
                </Label>
                <Select value={modelSelection} onValueChange={handleGlobalModelChange}>
                  <SelectTrigger className="w-full mt-2 rounded-lg">
                    <SelectValue placeholder="Select a model" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gemini">Gemini 3.5 Flash (Default)</SelectItem>
                    <SelectItem value="github-models">GitHub Models</SelectItem>
                    <SelectItem value="openrouter">OpenRouter AI</SelectItem>
                    <SelectItem value="local">Local LLM</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1.5">
                  Choose the default model to use for AI responses.
                </p>
              </div>
            </div>
          </div>

          <Separator />

          {/* OpenRouter AI Configuration Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Globe className="size-4 text-muted-foreground" />
              OpenRouter Model Configuration
            </h3>

            <div className="space-y-3 pt-1">
              <div>
                <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  OpenRouter Model
                </Label>
                <Select value={openRouterModel} onValueChange={handleOpenRouterModelChange}>
                  <SelectTrigger className="w-full mt-2 rounded-lg">
                    <SelectValue placeholder="Select a model" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="openai/gpt-4o-mini">OpenAI GPT-4o Mini (openai/gpt-4o-mini)</SelectItem>
                    <SelectItem value="google/gemini-2.5-flash-lite">Google Gemini 2.5 Flash Lite (google/gemini-2.5-flash-lite)</SelectItem>
                    <SelectItem value="google/gemma-4-31b-it">Google Gemma 4 31B IT (google/gemma-4-31b-it)</SelectItem>
                    <SelectItem value="z-ai/glm-4.7-flash">Z-AI GLM-4.7 Flash (z-ai/glm-4.7-flash)</SelectItem>
                    <SelectItem value="qwen/qwen3.5-flash-02-23">Qwen 3.5 Flash 02-23 (qwen/qwen3.5-flash-02-23)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1.5">
                  Select which OpenRouter model to query when OpenRouter AI is selected.
                </p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Local AI Configuration Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <SlidersHorizontal className="size-4 text-muted-foreground" />
              Local AI Model Integration
            </h3>

            <div className="space-y-3 pt-1">
              <div>
                <Label htmlFor="local_ai_url" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  Local AI Connection URL
                </Label>
                <Input
                  id="local_ai_url"
                  value={localUrl}
                  onChange={(e) => handleUrlChange(e.target.value)}
                  placeholder="e.g., http://localhost:8080/v1"
                  className="mt-2 rounded-lg font-mono text-xs"
                />
                <p className="text-xs text-muted-foreground mt-1.5">
                  The OpenAI-compatible endpoint URL of your locally running LLM (e.g. llama.cpp or Ollama).
                </p>
              </div>

              <div>
                <Label htmlFor="local_ai_model" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  Local Model Identifier
                </Label>
                <Input
                  id="local_ai_model"
                  value={localModel}
                  onChange={(e) => handleModelChange(e.target.value)}
                  placeholder="e.g., gemma-4, llama3"
                  className="mt-2 rounded-lg font-mono text-xs"
                />
                <p className="text-xs text-muted-foreground mt-1.5">
                  The exact name or identifier of the local model currently loaded in your server.
                </p>
              </div>
            </div>
          </div>

          <Separator />
        </>
      )}

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


function ShortcutsTab() {
  const isMac = typeof navigator !== "undefined" && /mac/i.test(navigator.platform);
  const mod = isMac ? "⌘" : "Ctrl";
  const groups: Array<{
    label: string;
    items: Array<{ keys: string[]; description: string; implemented: boolean }>;
  }> = [
      {
        label: "Navigation",
        items: [
          { keys: [mod, "G"], description: "Go to Dashboard", implemented: true },
          { keys: [mod, "Q"], description: "Go to Tasks", implemented: true },
          { keys: [mod, "P"], description: "Go to Motion (Pages)", implemented: true },
          { keys: [mod, "K"], description: "Open command palette", implemented: true },
        ],
      },
      {
        label: "Meetings",
        items: [
          { keys: [mod, "M"], description: "Open / restore Meeting Studio", implemented: true },
          { keys: ["Esc"], description: "Minimize Meeting Studio", implemented: false },
        ],
      },
      {
        label: "Chat",
        items: [
          { keys: [mod, "J"], description: "Toggle Chat", implemented: true },
          { keys: [mod, "⇧", "C"], description: "Open Chat full dialog", implemented: true },
        ],
      },
      {
        label: "Notifications",
        items: [
          { keys: [mod, "L"], description: "Toggle Notifications", implemented: true },
        ],
      },
      {
        label: "Tasks",
        items: [
          { keys: [mod, "⇧", "X"], description: "Create task / event", implemented: true },
        ],
      },
      {
        label: "Settings",
        items: [
          { keys: [mod, ","], description: "Open Settings", implemented: true },
          { keys: [mod, "/"], description: "Open Shortcuts", implemented: true },
        ],
      },
      {
        label: "General",
        items: [
          { keys: [mod, "D"], description: "Toggle Light/Dark Theme", implemented: true },
          { keys: [mod, "⌥", "N"], description: "Create new Note page", implemented: true },
          { keys: ["Esc"], description: "Close dialog / cancel", implemented: true },
          { keys: [mod, "B"], description: "Toggle sidebar", implemented: false },
        ],
      },
    ];

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Shortcuts</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Keyboard shortcuts to help you move faster across KeilHQ.
          <span className="ml-1 text-muted-foreground/60">
            {isMac ? "Mac shortcuts shown." : "Windows/Linux shortcuts shown."}
          </span>
        </p>
      </div>

      <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-emerald-500 shrink-0" />
          Implemented
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-muted-foreground/30 shrink-0" />
          Coming soon
        </span>
      </div>

      <div className="space-y-8">
        {groups.map((group) => (
          <div key={group.label}>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-2 px-3">
              {group.label}
            </p>
            <div className="rounded-xl border border-border/50 divide-y divide-border/40 overflow-hidden">
              {group.items.map((item, i) => (
                <div
                  key={i}
                  className={cn(
                    "flex items-center justify-between py-2.5 px-3 transition-colors",
                    item.implemented
                      ? "hover:bg-muted/40"
                      : "opacity-50 cursor-not-allowed"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "size-1.5 rounded-full shrink-0",
                        item.implemented ? "bg-emerald-500" : "bg-muted-foreground/30"
                      )}
                    />
                    <span className="text-sm text-foreground">{item.description}</span>
                    {!item.implemented && (
                      <span className="text-[10px] text-muted-foreground/50 font-medium">Soon</span>
                    )}
                  </div>
                  <KbdGroup>
                    {item.keys.map((key, j) => (
                      <Kbd key={j}>{key}</Kbd>
                    ))}
                  </KbdGroup>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TasksTab() {
  const [autoAssign, setAutoAssign] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("task_auto_assign") === "true";
    }
    return false;
  });

  const [dueReminders, setDueReminders] = useState(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("task_reminders");
      return stored === null ? true : stored === "true";
    }
    return true;
  });

  const [showCompleted, setShowCompleted] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("task_show_completed") === "true";
    }
    return false;
  });

  const [showClarityDefault, setShowClarityDefault] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("task_show_clarity_default") === "true";
    }
    return false;
  });

  const [visibleSections, setVisibleSections] = useState<string[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem("task_visible_sections");
        return stored ? JSON.parse(stored) : ["needsAttention", "currentSprint", "sprintDone", "unscheduled"];
      } catch {
        return ["needsAttention", "currentSprint", "sprintDone", "unscheduled"];
      }
    }
    return ["needsAttention", "currentSprint", "sprintDone", "unscheduled"];
  });

  const [defaultFilters, setDefaultFilters] = useState<{
    statuses: string[];
    priorities: string[];
    assignments: string[];
    sprints: string[];
  }>(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem("task_default_filters");
        return stored ? JSON.parse(stored) : { statuses: [], priorities: [], assignments: [], sprints: [] };
      } catch {
        return { statuses: [], priorities: [], assignments: [], sprints: [] };
      }
    }
    return { statuses: [], priorities: [], assignments: [], sprints: [] };
  });

  const handleAutoAssignChange = (checked: boolean) => {
    setAutoAssign(checked);
    localStorage.setItem("task_auto_assign", String(checked));
    window.dispatchEvent(new Event("task_settings_changed"));
  };

  const handleDueRemindersChange = (checked: boolean) => {
    setDueReminders(checked);
    localStorage.setItem("task_reminders", String(checked));
    window.dispatchEvent(new Event("task_settings_changed"));
  };

  const handleShowCompletedChange = (checked: boolean) => {
    setShowCompleted(checked);
    localStorage.setItem("task_show_completed", String(checked));
    window.dispatchEvent(new Event("task_settings_changed"));
  };

  const handleShowClarityDefaultChange = (checked: boolean) => {
    setShowClarityDefault(checked);
    localStorage.setItem("task_show_clarity_default", String(checked));
    window.dispatchEvent(new Event("task_settings_changed"));
  };

  const handleSectionToggle = (section: string) => {
    let next: string[];
    if (visibleSections.includes(section)) {
      next = visibleSections.filter(s => s !== section);
    } else {
      next = [...visibleSections, section];
    }
    setVisibleSections(next);
    localStorage.setItem("task_visible_sections", JSON.stringify(next));
    window.dispatchEvent(new Event("task_settings_changed"));
  };

  const handleFilterToggle = (category: "statuses" | "priorities" | "assignments" | "sprints", value: string) => {
    const nextList = defaultFilters[category].includes(value)
      ? defaultFilters[category].filter(v => v !== value)
      : [...defaultFilters[category], value];

    const nextFilters = {
      ...defaultFilters,
      [category]: nextList
    };
    setDefaultFilters(nextFilters);
    localStorage.setItem("task_default_filters", JSON.stringify(nextFilters));
    window.dispatchEvent(new Event("task_settings_changed"));
  };

  const sectionsList = [
    { id: "needsAttention", label: "Needs Attention", icon: Flame, iconColor: "text-rose-500" },
    { id: "myFocus", label: "My Focus", icon: Target, iconColor: "text-indigo-500" },
    { id: "currentSprint", label: "Current Sprint", icon: Rocket, iconColor: "text-amber-500" },
    { id: "sprintDone", label: "Sprint Done", icon: CheckCircle2, iconColor: "text-sky-500" },
    { id: "unscheduled", label: "Unscheduled", icon: CalendarOff, iconColor: "text-muted-foreground" },
    { id: "upcomingWork", label: "Upcoming Work", icon: CalendarDays, iconColor: "text-emerald-500" },
    { id: "recentlyCompleted", label: "Recently Completed", icon: CheckCircle2, iconColor: "text-sky-500" },
  ];

  const [sectionsOrder, setSectionsOrder] = useState<string[]>(() => {
    const masterKeys = [
      "needsAttention",
      "myFocus",
      "currentSprint",
      "sprintDone",
      "unscheduled",
      "upcomingWork",
      "recentlyCompleted"
    ];
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem("task_sections_order");
        if (stored) {
          const parsed = JSON.parse(stored) as string[];
          const filtered = parsed.filter(k => masterKeys.includes(k));
          const missing = masterKeys.filter(k => !filtered.includes(k));
          return [...filtered, ...missing];
        }
      } catch {
        // fallback
      }
    }
    return masterKeys;
  });

  const handleMoveSection = (index: number, direction: "up" | "down") => {
    const nextOrder = [...sectionsOrder];
    const targetIndex = direction === "up" ? index - 1 : index + 1;

    if (targetIndex >= 0 && targetIndex < nextOrder.length) {
      const temp = nextOrder[index];
      nextOrder[index] = nextOrder[targetIndex];
      nextOrder[targetIndex] = temp;

      setSectionsOrder(nextOrder);
      localStorage.setItem("task_sections_order", JSON.stringify(nextOrder));
      window.dispatchEvent(new Event("task_settings_changed"));
    }
  };

  const orderedSections = sectionsOrder
    .map(id => sectionsList.find(s => s.id === id))
    .filter((s): s is typeof sectionsList[number] => !!s);

  const statusesList = ["todo", "in-progress", "in-review", "done", "blocked", "backlog"];
  const prioritiesList = ["urgent", "high", "medium", "low"];
  const sprintsList = [
    { id: "current", label: "Current Sprint" },
    { id: "next", label: "Next Sprint" },
    { id: "backlog", label: "Backlog" }
  ];
  const assignmentsList = [
    { id: "assigned-to-me", label: "Assigned to Me" },
    { id: "created-by-me", label: "Created by Me" },
    { id: "watching", label: "Watching" },
    { id: "unassigned", label: "Unassigned" }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Tasks Preferences</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Configure default task visibility, filters, and behavior.
        </p>
      </div>

      <Separator />

      {/* General Settings */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-foreground">General</h3>
        <div className="space-y-4 pt-1">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Auto-assign to me</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Automatically assign new tasks to yourself
              </p>
            </div>
            <Switch checked={autoAssign} onCheckedChange={handleAutoAssignChange} />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Due date reminders</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Get notified before a task is due
              </p>
            </div>
            <Switch checked={dueReminders} onCheckedChange={handleDueRemindersChange} />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Show completed tasks</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Keep completed tasks visible in lists
              </p>
            </div>
            <Switch checked={showCompleted} onCheckedChange={handleShowCompletedChange} />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Show Clarity sections by default</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Display Objective and Success Criteria sections by default when creating tasks
              </p>
            </div>
            <Switch checked={showClarityDefault} onCheckedChange={handleShowClarityDefaultChange} />
          </div>
        </div>
      </div>

      <Separator />

      {/* Visible Sections Settings */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-foreground">Default Visible Sections</h3>
        <p className="text-xs text-muted-foreground">Toggle sections to show by default, and use the arrow buttons on hover to adjust their display order in the sidebar.</p>
        <div className="flex flex-col gap-2 pt-1 max-w-md">
          {orderedSections.map((sec, index) => {
            const isChecked = visibleSections.includes(sec.id);
            const Icon = sec.icon;
            return (
              <div key={sec.id} className="flex items-center justify-between bg-muted/20 hover:bg-muted/30 p-2 px-3 rounded-xl border border-border/40 transition-colors group/sec-item">
                <div className="flex items-center space-x-3 flex-1">
                  <Checkbox
                    id={`sec-${sec.id}`}
                    checked={isChecked}
                    onCheckedChange={() => handleSectionToggle(sec.id)}
                  />
                  <Label htmlFor={`sec-${sec.id}`} className="text-xs font-medium cursor-pointer flex-1 select-none flex items-center gap-2">
                    <Icon className={cn("size-4 shrink-0", sec.iconColor)} />
                    <span>{sec.label}</span>
                  </Label>
                </div>

                {/* Ordering Buttons */}
                <div className="flex items-center gap-1 opacity-0 group-hover/sec-item:opacity-100 transition-opacity">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 text-muted-foreground hover:text-foreground disabled:opacity-20"
                    disabled={index === 0}
                    onClick={() => handleMoveSection(index, "up")}
                    title="Move up"
                  >
                    <ChevronUp className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 text-muted-foreground hover:text-foreground disabled:opacity-20"
                    disabled={index === orderedSections.length - 1}
                    onClick={() => handleMoveSection(index, "down")}
                    title="Move down"
                  >
                    <ChevronDown className="size-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <Separator />

      {/* Default Filters Settings */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-foreground">Default Task Filters</h3>
        <p className="text-xs text-muted-foreground">Apply these filters automatically when loading the tasks page.</p>

        <div className="space-y-4 pt-1">
          {/* Status Filters */}
          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Status</Label>
            <div className="flex flex-wrap gap-2">
              {statusesList.map(s => {
                const isActive = defaultFilters.statuses.includes(s);
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => handleFilterToggle("statuses", s)}
                    className={cn(
                      "px-2.5 py-1 text-xs rounded-full border transition-all capitalize font-medium",
                      isActive
                        ? "bg-primary border-primary text-primary-foreground font-semibold shadow-sm"
                        : "bg-background border-border text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Priority Filters */}
          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Priority</Label>
            <div className="flex flex-wrap gap-2">
              {prioritiesList.map(p => {
                const isActive = defaultFilters.priorities.includes(p);
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => handleFilterToggle("priorities", p)}
                    className={cn(
                      "px-2.5 py-1 text-xs rounded-full border transition-all capitalize font-medium",
                      isActive
                        ? "bg-primary border-primary text-primary-foreground font-semibold shadow-sm"
                        : "bg-background border-border text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {p}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Assignment Filters */}
          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Assignment</Label>
            <div className="flex flex-wrap gap-2">
              {assignmentsList.map(a => {
                const isActive = defaultFilters.assignments.includes(a.id);
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => handleFilterToggle("assignments", a.id)}
                    className={cn(
                      "px-2.5 py-1 text-xs rounded-full border transition-all font-medium",
                      isActive
                        ? "bg-primary border-primary text-primary-foreground font-semibold shadow-sm"
                        : "bg-background border-border text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {a.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Sprint Filters */}
          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Sprint</Label>
            <div className="flex flex-wrap gap-2">
              {sprintsList.map(s => {
                const isActive = defaultFilters.sprints.includes(s.id);
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => handleFilterToggle("sprints", s.id)}
                    className={cn(
                      "px-2.5 py-1 text-xs rounded-full border transition-all font-medium",
                      isActive
                        ? "bg-primary border-primary text-primary-foreground font-semibold shadow-sm"
                        : "bg-background border-border text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {s.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function NotificationsTab() {
  const [prefs, setPrefs] = useState<{
    notify_task_assigned: boolean;
    notify_message: boolean;
    notify_motion_shared: boolean;
    notify_status_changed: boolean;
    notify_membership_updated: boolean;
    notify_comment_mention: boolean;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function loadPrefs() {
      try {
        const res = await api.get("/v1/notifications/preferences");
        if (active) {
          setPrefs(res.data.data);
        }
      } catch (err) {
        console.error("Failed to load notification preferences:", err);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }
    loadPrefs();
    return () => {
      active = false;
    };
  }, []);

  const handleToggle = async (key: string, currentValue: boolean) => {
    if (!prefs) return;
    const newValue = !currentValue;

    // Optimistic UI update
    setPrefs((prev: any) => ({ ...prev, [key]: newValue }));

    try {
      await api.patch("/v1/notifications/preferences", {
        [key]: newValue,
      });
    } catch (err) {
      console.error(`Failed to update preference ${key}:`, err);
      // Rollback on error
      setPrefs((prev: any) => ({ ...prev, [key]: currentValue }));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <p className="text-sm text-muted-foreground">Loading preferences...</p>
      </div>
    );
  }

  if (!prefs) {
    return (
      <div className="flex items-center justify-center h-48">
        <p className="text-sm text-destructive">Failed to load notification settings.</p>
      </div>
    );
  }

  const preferenceItems = [
    {
      key: "notify_task_assigned",
      title: "Task Assignments",
      description: "Get notified when someone assigns a task to you"
    },
    {
      key: "notify_comment_mention",
      title: "Comment Mentions",
      description: "Get alerted when someone @mentions you inside comments"
    },
    {
      key: "notify_message",
      title: "Chat Messages",
      description: "Get notified when a new chat message is received"
    },
    {
      key: "notify_status_changed",
      title: "Task Status Changes",
      description: "Get alerted when a task's workflow status transitions"
    },
    {
      key: "notify_motion_shared",
      title: "Motion Sharing",
      description: "Get notified when a document or canvas is shared with your spaces"
    },
    {
      key: "notify_membership_updated",
      title: "Membership Updates",
      description: "Get alerts when workspace or space member role states change"
    }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Notifications</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Choose what you want to be notified about.
        </p>
      </div>

      <Separator />

      <div className="space-y-4">
        {preferenceItems.map((item, idx) => {
          const checked = (prefs as any)[item.key];
          return (
            <div key={item.key}>
              <div className="flex items-center justify-between py-1">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {item.title}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {item.description}
                  </p>
                </div>
                <Switch
                  checked={checked}
                  onCheckedChange={() => handleToggle(item.key, checked)}
                />
              </div>
              {idx < preferenceItems.length - 1 && <Separator className="my-4" />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ConnectorsTab() {
  const { data: gcalStatus, isLoading: gcalLoading } =
    useGoogleCalendarStatus();
  const connectGcal = useConnectGoogleCalendar();
  const disconnectGcal = useDisconnectGoogleCalendar();

  const { activeOrgId, activeSpaceId } = useAppContext();
  const queryClient = useQueryClient();
  const [isSyncing, setIsSyncing] = useState(false);

  const handleManualSync = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      await api.post("v1/integrations/google/sync");
      toast.success("Sync triggered — refreshing calendar");
      // Wait briefly for the background sync to process, then refetch slots
      setTimeout(() => {
        if (activeOrgId && activeSpaceId) {
          queryClient.invalidateQueries({ queryKey: orgTaskKeys.slots(activeOrgId, activeSpaceId) });
          queryClient.invalidateQueries({ queryKey: orgTaskKeys.lists(activeOrgId, activeSpaceId) });
        }
        setIsSyncing(false);
      }, 3000);
    } catch (err: any) {
      const message = err?.response?.data?.message || "Sync failed";
      toast.error(message);
      setIsSyncing(false);
    }
  };

  const { data: githubStatus, isLoading: githubLoading } =
    useGitHubStatus();
  const connectGithub = useConnectGitHub();
  const disconnectGithub = useDisconnectGitHub();

  const { data: notionStatus, isLoading: notionLoading } =
    useNotionStatus();
  const connectNotion = useConnectNotion();
  const disconnectNotion = useDisconnectNotion();
  const connectNotionManual = useConnectNotionManual();

  const [showManualNotion, setShowManualNotion] = useState(false);
  const [manualNotionToken, setManualNotionToken] = useState("");
  const [manualNotionWorkspace, setManualNotionWorkspace] = useState("");

  interface Connector {
    id: string;
    name: string;
    description: string;
    activeDescription: string;
    logo?: string;
    icon?: React.ComponentType<{ className?: string }>;
    connected: boolean;
    isLoading: boolean;
    comingSoon?: boolean;
    customActions?: React.ReactNode;
    extraContent?: React.ReactNode;
  }

  const connectorList: Connector[] = [
    {
      id: "google-calendar",
      name: "Google Calendar",
      description: "Connect to enable Calendar sync and all Google services",
      activeDescription: "Scheduled tasks sync automatically · Authorises all Google services below",
      logo: "/integrations/gcalendar.png",
      connected: !!gcalStatus?.connected,
      isLoading: gcalLoading,
      customActions: gcalStatus?.connected ? (
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="text-xs rounded-lg gap-1.5"
            disabled={isSyncing}
            onClick={handleManualSync}
          >
            <RefreshCw className={cn("size-3.5 text-muted-foreground", isSyncing && "animate-spin")} />
            Sync Now
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-xs rounded-lg"
            disabled={disconnectGcal.isPending}
            onClick={() => disconnectGcal.mutate()}
          >
            {disconnectGcal.isPending ? <Loader2 className="size-3.5 animate-spin" /> : "Disconnect"}
          </Button>
        </div>
      ) : (
        <Button
          variant="default"
          size="sm"
          className="text-xs rounded-lg"
          disabled={gcalLoading}
          onClick={connectGcal}
        >
          {gcalLoading ? <Loader2 className="size-3.5 animate-spin" /> : "Connect"}
        </Button>
      )
    },
    {
      id: "gmail",
      name: "Google Mail",
      description: "Sync contacts and import task items from emails",
      activeDescription: "Email contacts and task imports are available",
      logo: "/integrations/gmail.png",
      connected: !!gcalStatus?.connected,
      isLoading: gcalLoading,
    },
    {
      id: "gmeet",
      name: "Google Meet",
      description: "Schedule and join video calls directly from events",
      activeDescription: "Video call links auto-generated on events",
      logo: "/integrations/gmeet.png",
      connected: !!gcalStatus?.connected,
      isLoading: gcalLoading,
    },
    {
      id: "gdrive",
      name: "Google Drive",
      description: "Browse and reference workspace files from your chats",
      activeDescription: "Drive files accessible across your workspace",
      logo: "/integrations/gdrive.png",
      connected: false,
      isLoading: false,
      comingSoon: true,
    },
    {
      id: "gdocs",
      name: "Google Docs",
      description: "Create, view, and sync document content inline",
      activeDescription: "Docs can be linked and previewed in tasks",
      logo: "/integrations/gdocs.png",
      connected: false,
      isLoading: false,
      comingSoon: true,
    },
    {
      id: "gsheets",
      name: "Google Sheets",
      description: "Link spreadsheet metrics and tables directly",
      activeDescription: "Sheets data available for task context",
      logo: "/integrations/gsheets.png",
      connected: false,
      isLoading: false,
      comingSoon: true,
    },
    {
      id: "gslides",
      name: "Google Slides",
      description: "Embed presentations and presentation details",
      activeDescription: "Presentations can be linked to events",
      logo: "/integrations/gslides.png",
      connected: false,
      isLoading: false,
      comingSoon: true,
    },
    {
      id: "notion",
      name: "Notion",
      description: "Import Notion pages, export pages, and sync content bidirectionally",
      activeDescription: `Connected to workspace: ${notionStatus?.workspace_name || "Notion Workspace"}`,
      logo: "/integrations/Notion-logo.svg",
      connected: !!notionStatus?.connected,
      isLoading: notionLoading,
      customActions: notionStatus?.connected ? (
        <Button
          variant="outline"
          size="sm"
          className="text-xs rounded-lg"
          disabled={disconnectNotion.isPending}
          onClick={() => disconnectNotion.mutate()}
        >
          {disconnectNotion.isPending ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            "Disconnect"
          )}
        </Button>
      ) : (
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="text-xs rounded-lg"
            onClick={() => setShowManualNotion(!showManualNotion)}
          >
            {showManualNotion ? "Cancel" : "Use Token"}
          </Button>
          <Button
            variant="default"
            size="sm"
            className="text-xs rounded-lg"
            disabled={notionLoading}
            onClick={connectNotion}
          >
            {notionLoading ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              "Connect"
            )}
          </Button>
        </div>
      ),
      extraContent: !notionStatus?.connected && showManualNotion && (
        <div className="px-4 pb-4 pt-2 border-t border-border/50 bg-muted/20 space-y-4 animate-in slide-in-from-top-2 duration-200">
          <div className="space-y-2">
            <p className="text-xs font-semibold text-foreground">Connect via Notion Internal Integration Token</p>
            <p className="text-[11px] text-muted-foreground leading-normal">
              Create an Internal Integration in your Notion Workspace, copy the token (starts with <code className="text-xs font-mono bg-muted/80 px-1 rounded">secret_</code>), and share the target Notion pages with your Integration.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="notion-token" className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Integration Token (secret_...)
              </Label>
              <Input
                id="notion-token"
                type="password"
                placeholder="secret_xxxxxxxxxxxxxxxxxxxxxxxxxx"
                value={manualNotionToken}
                onChange={(e) => setManualNotionToken(e.target.value)}
                className="h-9 text-xs rounded-lg bg-background"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="notion-workspace" className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Workspace Name (Optional)
              </Label>
              <Input
                id="notion-workspace"
                type="text"
                placeholder="My Notion Workspace"
                value={manualNotionWorkspace}
                onChange={(e) => setManualNotionWorkspace(e.target.value)}
                className="h-9 text-xs rounded-lg bg-background"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="default"
              size="sm"
              className="text-xs rounded-lg px-4 h-9 shadow-md shadow-primary/10"
              disabled={!manualNotionToken.trim() || connectNotionManual.isPending}
              onClick={() => {
                connectNotionManual.mutate(
                  { token: manualNotionToken.trim(), workspaceName: manualNotionWorkspace.trim() || undefined },
                  {
                    onSuccess: () => {
                      setManualNotionToken("");
                      setManualNotionWorkspace("");
                      setShowManualNotion(false);
                    }
                  }
                );
              }}
            >
              {connectNotionManual.isPending ? (
                <Loader2 className="size-3.5 animate-spin mr-1.5" />
              ) : null}
              Link Account
            </Button>
          </div>
        </div>
      )
    },
    {
      id: "github",
      name: "GitHub",
      description: "Link your GitHub account to read issues & PRs",
      activeDescription: "Repository issues and PRs connected",
      icon: Github,
      connected: !!githubStatus?.connected,
      isLoading: githubLoading,
      customActions: githubStatus?.connected ? (
        <Button
          variant="outline"
          size="sm"
          className="text-xs rounded-lg"
          disabled={disconnectGithub.isPending}
          onClick={() => disconnectGithub.mutate()}
        >
          {disconnectGithub.isPending ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            "Disconnect"
          )}
        </Button>
      ) : (
        <Button
          variant="default"
          size="sm"
          className="text-xs rounded-lg"
          disabled={githubLoading}
          onClick={connectGithub}
        >
          {githubLoading ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            "Connect"
          )}
        </Button>
      )
    }
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

      <div className="space-y-6">
        <div className="space-y-4">
          {connectorList.map((connector) => (
            <div
              key={connector.id}
              className={cn(
                "rounded-xl border bg-card transition-colors overflow-hidden",
                connector.connected
                  ? "border-emerald-500/30 bg-emerald-500/5"
                  : "border-border hover:bg-muted/10"
              )}
            >
              <div className="flex items-center justify-between p-4 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-lg bg-muted flex items-center justify-center shrink-0 border border-border/20 overflow-hidden">
                    {connector.icon ? (
                      <connector.icon className="size-5 text-foreground" />
                    ) : connector.logo ? (
                      <img src={connector.logo} alt={connector.name} className="size-6 object-contain" />
                    ) : null}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-foreground">
                        {connector.name}
                      </p>
                      {connector.isLoading ? (
                        <Loader2 className="size-3 animate-spin text-muted-foreground" />
                      ) : connector.connected ? (
                        connector.id === "google-calendar" ? (
                          <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-500">
                            <span className="size-1.5 rounded-full bg-emerald-500 inline-block" />
                            Active
                          </span>
                        ) : (
                          <span className="inline-block size-2 rounded-full bg-emerald-500" />
                        )
                      ) : (
                        <span className="inline-block size-2 rounded-full bg-muted-foreground/40" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {connector.connected ? connector.activeDescription : connector.description}
                    </p>
                  </div>
                </div>

                {connector.customActions ? (
                  connector.customActions
                ) : connector.comingSoon ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs rounded-lg"
                    disabled
                  >
                    Coming Soon
                  </Button>
                ) : connector.connected ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs rounded-lg"
                    disabled
                  >
                    Connected
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs rounded-lg"
                    disabled
                  >
                    Disconnected
                  </Button>
                )}
              </div>

              {connector.extraContent && connector.extraContent}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Sessions Tab ─────────────────────────────────────────────────────

function parseBrowserFromUA(ua: string): { browser: string; os: string } {
  let browser = "Unknown Browser";
  let os = "Unknown OS";

  // OS detection
  if (/Windows/.test(ua)) os = "Windows";
  else if (/Macintosh|Mac OS X/.test(ua)) os = "macOS";
  else if (/Linux/.test(ua)) os = "Linux";
  else if (/Android/.test(ua)) os = "Android";
  else if (/iPhone|iPad|iPod/.test(ua)) os = "iOS";

  // Browser detection (order matters — Edge before Chrome, etc.)
  if (/Edg\//.test(ua)) browser = "Microsoft Edge";
  else if (/OPR\/|Opera/.test(ua)) browser = "Opera";
  else if (/Chrome\//.test(ua) && !/Chromium/.test(ua)) browser = "Google Chrome";
  else if (/Chromium/.test(ua)) browser = "Chromium";
  else if (/Firefox\//.test(ua)) browser = "Firefox";
  else if (/Safari\//.test(ua) && !/Chrome/.test(ua)) browser = "Safari";

  return { browser, os };
}

function formatRelativeTime(isoStr: string): string {
  const diff = Date.now() - new Date(isoStr).getTime();
  const minutes = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days = Math.floor(diff / 86_400_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

function getBrowserIcon(browser: string): React.ReactNode {
  // Simple icon selection based on browser name
  if (browser.includes("Chrome") || browser.includes("Chromium")) return <Globe2 className="size-5 text-blue-500" />;
  if (browser.includes("Firefox")) return <Globe2 className="size-5 text-orange-500" />;
  if (browser.includes("Safari")) return <Globe2 className="size-5 text-sky-500" />;
  if (browser.includes("Edge")) return <Globe2 className="size-5 text-indigo-500" />;
  return <Monitor className="size-5 text-muted-foreground" />;
}

function SessionsTab() {
  const { signOut, signOutGlobal } = useAuth();
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [isSigningOutAll, setIsSigningOutAll] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Load sessions from database on mount and on focus
  const loadSessions = async () => {
    setIsLoading(true);
    try {
      const res = await api.get("/users/sessions");
      const records: SessionRecord[] = res.data.data || [];
      // Sort: current first, then newest login first
      records.sort((a, b) => {
        if (a.isCurrent) return -1;
        if (b.isCurrent) return 1;
        return new Date(b.loginAt).getTime() - new Date(a.loginAt).getTime();
      });
      setSessions(records);
    } catch (err) {
      console.error("Failed to load sessions:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSessions();
    // Refresh when the tab gains focus (other tabs may have updated sessions)
    window.addEventListener("focus", loadSessions);
    return () => window.removeEventListener("focus", loadSessions);
  }, []);

  const handleSignOutAll = async () => {
    setIsSigningOutAll(true);
    try {
      await signOutGlobal();
    } finally {
      setIsSigningOutAll(false);
    }
  };

  const handleRemoveSession = async (id: string) => {
    try {
      await api.delete(`/users/sessions/${id}`);
      toast.success("Device signed out successfully");
      loadSessions();
    } catch (err) {
      toast.error("Failed to revoke session");
      console.error(err);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Sessions</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Manage where you're signed in to KeilHQ.
        </p>
      </div>

      <Separator />

      {/* Current session summary */}
      <div className="rounded-2xl border border-border bg-gradient-to-br from-primary/5 to-muted/20 p-5">
        <div className="flex items-center gap-3 mb-3">
          <div className="size-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
            <Shield className="size-4" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Session Overview</p>
            <p className="text-xs text-muted-foreground">
              {sessions.length} active {sessions.length === 1 ? "session" : "sessions"} on your account
            </p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          These are the browsers and devices that have recently logged in to your account. You can sign out of any active session or revoke them globally.
        </p>
      </div>

      {/* Session list */}
      {isLoading && sessions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Loader2 className="size-8 text-primary animate-spin mb-3" />
          <p className="text-sm font-medium text-muted-foreground">Loading active sessions...</p>
        </div>
      ) : sessions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Monitor className="size-10 text-muted-foreground/40 mb-3" />
          <p className="text-sm font-medium text-muted-foreground">No session records yet</p>
          <p className="text-xs text-muted-foreground/70 mt-1">
            Sessions will appear here after your next login.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
            Active Sessions
          </p>
          {sessions.map((session) => {
            const { browser, os } = parseBrowserFromUA(session.userAgent);
            return (
              <div
                key={session.id}
                className={cn(
                  "group flex items-start gap-4 p-4 rounded-2xl border transition-all duration-200",
                  session.isCurrent
                    ? "border-primary/30 bg-primary/5"
                    : "border-border bg-muted/20 hover:bg-muted/40"
                )}
              >
                {/* Icon */}
                <div className={cn(
                  "size-10 rounded-xl flex items-center justify-center shrink-0",
                  session.isCurrent ? "bg-primary/10" : "bg-muted"
                )}>
                  {getBrowserIcon(browser)}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-foreground truncate">{browser}</p>
                    {session.isCurrent && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                        <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        This device
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{os}</p>
                  <div className="flex items-center gap-4 mt-2 flex-wrap">
                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <Clock className="size-3 shrink-0" />
                      <span>Logged in {formatRelativeTime(session.loginAt)}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <RefreshCw className="size-3 shrink-0" />
                      <span>Last seen {formatRelativeTime(session.lastSeen)}</span>
                    </div>
                  </div>
                </div>

                {/* Action */}
                <div className="shrink-0">
                  {session.isCurrent ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-[11px] h-7 px-3 rounded-lg text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 border-red-200 dark:border-red-800/40"
                      onClick={signOut}
                    >
                      <LogOut className="size-3 mr-1" />
                      Sign out
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-[11px] h-7 px-3 rounded-lg text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => handleRemoveSession(session.id)}
                    >
                      <Trash2 className="size-3 mr-1" />
                      Remove
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Separator />

      {/* Sign out all devices */}
      <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-destructive mb-1">
              <AlertTriangle className="size-4" />
              <p className="text-sm font-semibold">Sign Out All Devices</p>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              This will revoke all refresh tokens and immediately sign you out everywhere — including this device.
              You'll need to sign in again.
            </p>
          </div>
          <Button
            variant="destructive"
            size="sm"
            className="shrink-0 text-xs rounded-lg"
            onClick={handleSignOutAll}
            disabled={isSigningOutAll}
          >
            {isSigningOutAll ? (
              <Loader2 className="size-3.5 animate-spin mr-1.5" />
            ) : (
              <Globe2 className="size-3.5 mr-1.5" />
            )}
            Sign out all
          </Button>
        </div>
      </div>
    </div>
  );
}

function UsageBar({
  label,
  icon,
  used,
  limit,
}: {
  label: string;
  icon: React.ReactNode;
  used: number;
  limit: number | null;
}) {
  const isUnlimited = limit === null;
  const percentage = isUnlimited ? 0 : Math.min((used / limit) * 100, 100);
  const isWarning = !isUnlimited && percentage >= 80;
  const isExhausted = !isUnlimited && percentage >= 100;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2 text-muted-foreground">
          {icon}
          <span>{label}</span>
        </div>
        <span className="font-medium text-foreground">
          {used} / {isUnlimited ? "Unlimited" : limit}
        </span>
      </div>
      {!isUnlimited && (
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              isExhausted
                ? "bg-red-500"
                : isWarning
                  ? "bg-amber-500"
                  : "bg-primary"
            }`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      )}
    </div>
  );
}

function FeatureItem({ label, enabled }: { label: string; enabled: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <div
        className={`size-4 rounded-full flex items-center justify-center text-xs shrink-0 ${
          enabled
            ? "bg-green-500/10 text-green-600 dark:text-green-400"
            : "bg-muted text-muted-foreground"
        }`}
      >
        {enabled ? "✓" : "—"}
      </div>
      <span className={enabled ? "text-foreground" : "text-muted-foreground"}>{label}</span>
    </div>
  );
}

function BillingTab() {
  const { activeOrgId, organisations } = useAppContext();
  const { planData, plan, status, limits, usage, trialDaysRemaining, isPaid, isLoading: isLoadingUserPlan } = useSubscription();

  const { data: orgPlan, isLoading: isLoadingOrgPlan } = useOrgPlan(activeOrgId);
  const checkout = useCreateCheckout();
  const orgCheckout = useCreateOrgCheckout();
  const portal = usePortalUrl();

  const handlePortalRedirect = async () => {
    try {
      const portalUrl = planData?.portal_url || orgPlan?.portal_url;
      if (portalUrl) {
        window.open(portalUrl, "_blank");
      } else {
        const url = await portal.mutateAsync();
        if (url) {
          window.open(url, "_blank");
        }
      }
    } catch (err) {
      toast.error("Failed to open customer portal");
      console.error(err);
    }
  };

  const handleOrgUpgrade = () => {
    const targetOrgId = activeOrgId || organisations.find(o => o.is_personal)?.id;
    if (!targetOrgId) {
      toast.error("No active or personal organisation found to upgrade");
      return;
    }
    orgCheckout.mutate({ orgId: targetOrgId, seats: 2 });
  };

  if (isLoadingUserPlan || (activeOrgId && isLoadingOrgPlan)) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Loader2 className="size-8 text-primary animate-spin mb-3" />
        <p className="text-sm font-medium text-muted-foreground">Loading billing information...</p>
      </div>
    );
  }

  const planInfo = plan ? PLAN_DISPLAY[plan] : null;
  const statusInfo = status ? STATUS_DISPLAY[status] : null;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Billing & Usage</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your plan, resource limits, and subscription.
        </p>
      </div>

      <Separator />

      {/* Plan Card */}
      <div className="rounded-2xl border border-border bg-gradient-to-br from-primary/5 to-muted/20 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <CreditCard className="size-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">
                {planInfo?.name || "Free Trial"} Plan
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {planInfo?.price || "Free"}
              </p>
            </div>
          </div>
          {statusInfo && (
            <Badge variant="secondary" className={cn("text-[10px] font-bold uppercase tracking-wider", statusInfo.color)}>
              {statusInfo.label}
            </Badge>
          )}
        </div>

        {/* Trial Days Remaining */}
        {status === "trialing" && trialDaysRemaining !== null && (
          <div className="flex items-center gap-2 text-xs bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-xl px-3 py-2 border border-blue-500/10">
            <Clock className="size-3.5" />
            <span>
              {trialDaysRemaining} day{trialDaysRemaining !== 1 ? "s" : ""} remaining in your trial
            </span>
          </div>
        )}

        {/* Past due warning */}
        {status === "past_due" && (
          <div className="flex items-center gap-2 text-xs bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-xl px-3 py-2 border border-amber-500/10">
            <Shield className="size-3.5" />
            <span>Payment failed. Please update your payment method to avoid losing access.</span>
          </div>
        )}

        <div className="flex items-center gap-3 pt-1">
          {isPaid || planData?.portal_url || orgPlan?.portal_url ? (
            <Button
              variant="outline"
              size="sm"
              className="text-xs rounded-xl flex items-center gap-1.5"
              onClick={handlePortalRedirect}
              disabled={portal.isPending}
            >
              {portal.isPending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <ExternalLink className="size-3.5" />
              )}
              Manage Subscription & Billing
            </Button>
          ) : (
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant="default"
                size="sm"
                className="text-xs rounded-xl flex items-center gap-1.5 bg-primary text-primary-foreground hover:bg-primary/95"
                onClick={() => checkout.mutate()}
                disabled={checkout.isPending}
              >
                {checkout.isPending ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Zap className="size-3.5" />
                )}
                Upgrade to Pro ($25/mo)
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-xs rounded-xl flex items-center gap-1.5"
                onClick={handleOrgUpgrade}
                disabled={orgCheckout.isPending}
              >
                {orgCheckout.isPending ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Layers className="size-3.5" />
                )}
                Upgrade to Teams ($50/user/mo)
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Usage Section */}
      <div className="rounded-2xl border border-border p-5 space-y-4">
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Resource Usage This Period
        </p>

        <div className="space-y-4 pt-1">
          {/* AI Chats Daily */}
          <UsageBar
            label="AI Chats Today"
            icon={<Zap className="size-4 text-primary" />}
            used={usage?.ai_chats_today || 0}
            limit={limits?.ai_chats_daily ?? null}
          />

          {/* AI Chats Hourly */}
          {limits?.ai_chats_hourly && (
            <UsageBar
              label="AI Chats This Hour"
              icon={<Zap className="size-4 text-amber-500" />}
              used={usage?.ai_chats_this_hour || 0}
              limit={limits.ai_chats_hourly}
            />
          )}

          {/* Recordings */}
          <UsageBar
            label="Meeting Recordings This Month"
            icon={<Mic className="size-4 text-emerald-500" />}
            used={usage?.recordings_this_month || 0}
            limit={limits?.recordings_monthly ?? null}
          />
        </div>
      </div>

      {/* Plan Features */}
      <div className="rounded-2xl border border-border p-5 space-y-4">
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Enabled Capabilities
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm pt-1">
          <FeatureItem
            label="Transcription Diarization"
            enabled={limits?.transcription_diarization || false}
          />
          <FeatureItem
            label="Data Privacy (no training)"
            enabled={!limits?.data_used_for_training}
          />
          <FeatureItem label="SSO / SAML Security" enabled={limits?.sso || false} />
          <FeatureItem label="Enterprise Audit Logs" enabled={limits?.audit_logs || false} />
          <FeatureItem
            label="Centralized Billing & Invoices"
            enabled={limits?.centralized_billing || false}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Tab Content Map ─────────────────────────────────────────────────
const accountTabContent: Record<AccountTab, React.FC> = {
  account: AccountTab,
  personalization: PersonalizationTab,
  shortcuts: ShortcutsTab,
  tasks: TasksTab,
  notifications: NotificationsTab,
  connectors: ConnectorsTab,
  sessions: SessionsTab,
  billing: BillingTab,
};

const workspaceTabContent: Record<WorkspaceTab, React.FC> = {
  "org-general": OrgGeneralTab,
  "org-members": OrgMembersTab,
  "org-spaces": OrgSpacesTab,
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
      const workspaceTabs: string[] = ["org-general", "org-members", "org-spaces", "api", "enterprise"];
      if (workspaceTabs.includes(initialTab)) {
        setMode("workspace");
        setActiveWorkspaceTab(initialTab as WorkspaceTab);
      } else {
        setMode("account");
        setActiveAccountTab(initialTab as AccountTab || "account");
      }
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

        <div className="flex size-full overflow-hidden rounded-2xl">
          {/* ── Sidebar ─────────────────────────────────── */}
          <aside className="w-[280px] shrink-0 border-r border-border bg-sidebar flex flex-col h-full rounded-l-2xl">
            {/* Back / Home */}
            <div className="p-4 pb-2">
              <button
                onClick={() => mode === "workspace" ? setMode("account") : onOpenChange(false)}
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer group"
              >
                <ArrowLeft className="size-4 transition-transform group-hover:-translate-x-0.5" />
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
                        <div className="size-7 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold shrink-0">
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
                      <ChevronUp className="size-4 text-muted-foreground rotate-180" />
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
                              "size-6 rounded flex items-center justify-center text-[10px] font-bold shrink-0",
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
                            <Check className="size-3.5" />
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
                    <Layers className="size-4 shrink-0" />
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
                          <Icon className="size-4 shrink-0" />
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
                          <Icon className="size-4 shrink-0" />
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
