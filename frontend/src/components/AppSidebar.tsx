import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarInput,
  useSidebar,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/contexts/AuthContext";
import { useMe } from "@/hooks/api/useMe";
import { useAppContext } from "@/contexts/AppContext";
import { useNotifications } from "@/contexts/NotificationContext";
import { getOptimizedImageUrl } from "@/lib/image-optimizer";
import { useSpaces } from "@/hooks/api/useSpaces";
import {
  LayoutDashboard,
  Settings,
  LogOut,
  ChevronUp,
  User,
  Check,
  MessageSquare,
  CheckSquare,
  Plus,
  Loader2,
  Image,
  Building2,
  Mic,
  Search,
  Bell,
} from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTheme } from "next-themes";
import { SettingsDialog } from "@/components/SettingsDialog";
import { useChatStore } from "@/store/useChatStore";
import { useMeetingStore } from "@/store/useMeetingStore";
import { useSettingsStore } from "@/store/useSettingsStore";
import { getSocket } from "@/lib/socket";
import { toast } from "sonner";
import type { Organisation } from "@/hooks/api/useOrganisations";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCreateOrganisation, useJoinOrganisation, orgKeys } from "@/hooks/api/useOrganisations";
import { useQueryClient } from "@tanstack/react-query";

// ─── Navigation items ─────────────────────────────────────────────────────────

const navigationItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Tasks", url: "/tasks", icon: CheckSquare },
  { title: "Motion", url: "/motion", icon: Image },
  { title: "Notifications", action: "notifications", icon: Bell },
];



// ─── OrgManageDialog ──────────────────────────────────────────────────────────
// Combined dialog for creating or joining an organisation.

interface OrgManageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialTab?: "create" | "join";
}

function OrgManageDialog({ open, onOpenChange, initialTab = "create" }: OrgManageDialogProps) {
  const [tab, setTab] = useState<"create" | "join">(initialTab);
  const [orgName, setOrgName] = useState("");
  const [token, setToken] = useState("");
  const createOrg = useCreateOrganisation();
  const joinOrg = useJoinOrganisation();
  const { setActiveOrganisation } = useAppContext();
  const location = useLocation();
  const navigate = useNavigate();

  // Sync tab when dialog opens with a different initialTab
  useEffect(() => {
    if (open) setTab(initialTab);
  }, [open, initialTab]);

  const handleClose = () => {
    setOrgName("");
    setToken("");
    onOpenChange(false);
  };

  const handleCreate = () => {
    const trimmed = orgName.trim();
    if (!trimmed) return;
    createOrg.mutate(trimmed, {
      onSuccess: ({ org, space }) => {
        setActiveOrganisation(org.id, space.id);
        if (/^\/(tasks|events)\/[^/]+/.test(location.pathname)) navigate("/tasks");
        handleClose();
      },
    });
  };

  const handleJoin = () => {
    const trimmed = token.trim();
    if (!trimmed) return;
    joinOrg.mutate(trimmed, {
      onSuccess: ({ org, space }) => {
        toast.success(`Joined ${org.name} successfully!`);
        setActiveOrganisation(org.id, space.id);

        const socket = getSocket();
        if (socket) {
          socket.emit("join_org_rooms", { orgId: org.id });
        }

        if (/^\/(tasks|events)\/[^/]+/.test(location.pathname)) navigate("/tasks");
        handleClose();
      },
      onError: (err: any) => {
        toast.error(err?.response?.data?.message || "Failed to join organisation");
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) handleClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Organisations</DialogTitle>
        </DialogHeader>

        {/* Tab switcher */}
        <div className="flex rounded-lg border border-border p-0.5 bg-muted/40 gap-0.5">
          <button
            onClick={() => setTab("create")}
            className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${tab === "create"
              ? "bg-background shadow-sm text-foreground"
              : "text-muted-foreground hover:text-foreground"
              }`}
          >
            Create
          </button>
          <button
            onClick={() => setTab("join")}
            className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${tab === "join"
              ? "bg-background shadow-sm text-foreground"
              : "text-muted-foreground hover:text-foreground"
              }`}
          >
            Join
          </button>
        </div>

        {tab === "create" ? (
          <div className="flex flex-col gap-4 py-2">
            <p className="text-sm text-muted-foreground">
              Give your organisation a name. A default General space will be created automatically.
            </p>
            <Input
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              placeholder="e.g. Acme Corp, Engineering Team"
              autoFocus
            />
            {createOrg.isError && (
              <p className="text-xs text-destructive">
                {(createOrg.error as any)?.response?.data?.message ?? "Something went wrong."}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={handleClose}>Cancel</Button>
              <Button onClick={handleCreate} disabled={!orgName.trim() || createOrg.isPending}>
                {createOrg.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
                Create Organisation
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4 py-2">
            <p className="text-sm text-muted-foreground">
              Paste an invitation token to join an existing organisation.
            </p>
            <Input
              value={token}
              onChange={(e) => setToken(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleJoin()}
              placeholder="Invitation token"
              autoFocus
            />
            {joinOrg.isError && (
              <p className="text-xs text-destructive">
                {(joinOrg.error as any)?.response?.data?.message ?? "Invalid or expired invite token."}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={handleClose}>Cancel</Button>
              <Button onClick={handleJoin} disabled={!token.trim() || joinOrg.isPending}>
                {joinOrg.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
                Join
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── OrgSpaceSubmenu ──────────────────────────────────────────────────────────
// Lazy-loads spaces only when the submenu is opened.
// Renders as a DropdownMenuSub trigger + content.

interface OrgSpaceSubmenuProps {
  key?: React.Key | string | number;
  org: Organisation;
  activeOrgId: string | null;
  activeSpaceId: string | null;
  onSelectSpace: (orgId: string, spaceId: string) => void;
}

function OrgSpaceSubmenu({
  org,
  activeOrgId,
  activeSpaceId,
  onSelectSpace,
}: OrgSpaceSubmenuProps) {
  const [subOpen, setSubOpen] = useState(false);
  const { data: spaces = [], isLoading } = useSpaces(subOpen ? org.id : null);
  const { user } = useAuth();

  const isActiveOrg = activeOrgId === org.id;

  const visibleSpaces = spaces.filter((space) => {
    if (space.is_private) {
      return org.owner_user_id === user?.id;
    }
    return true;
  });

  return (
    <DropdownMenuSub open={subOpen} onOpenChange={setSubOpen}>
      <DropdownMenuSubTrigger className="rounded-lg cursor-pointer gap-2.5 px-2.5 py-2 text-[13px]">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div className="size-6 rounded bg-primary/20 flex items-center justify-center text-xs font-medium text-primary shrink-0">
            {org.is_personal ? (
              <User className="size-3.5" />
            ) : (
              org.name.charAt(0).toUpperCase()
            )}
          </div>
          <span className="text-sm font-medium truncate">
            {org.name}
          </span>
        </div>
        {isActiveOrg && (
          <Check className="size-4 text-primary shrink-0 mr-1" />
        )}
      </DropdownMenuSubTrigger>

      <DropdownMenuSubContent className="w-48 rounded-xl p-1">
        {isLoading ? (
          <div className="flex items-center justify-center py-3">
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          </div>
        ) : visibleSpaces.length === 0 ? (
          <div className="px-2 py-3 text-xs text-muted-foreground text-center">
            No spaces yet
          </div>
        ) : (
          visibleSpaces.map((space) => {
            const isActiveSpace = isActiveOrg && activeSpaceId === space.id;
            return (
              <DropdownMenuItem
                key={space.id}
                className="rounded-lg cursor-pointer gap-2.5 px-2.5 py-2 text-[13px]"
                onSelect={() => onSelectSpace(org.id, space.id)}
              >
                <span className="flex-1 truncate">{space.name}</span>
                {isActiveSpace && (
                  <Check className="size-4 text-primary shrink-0" />
                )}
              </DropdownMenuItem>
            );
          })
        )}
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}

// ─── AppSidebar ───────────────────────────────────────────────────────────────

type AppSidebarProps = {
  notificationDrawerOpen?: boolean;
  notificationDialogOpen?: boolean;
  onNotificationDrawerOpenChange?: (open: boolean) => void;
};

export function AppSidebar({
  notificationDrawerOpen = false,
  notificationDialogOpen = false,
  onNotificationDrawerOpenChange,
}: AppSidebarProps) {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsInitialTab, setSettingsInitialTab] = useState<
    "account" | "org-general"
  >("account");
  const { isOpen: settingsStoreOpen, initialTab: settingsStoreTab, closeSettings } = useSettingsStore();
  const [orgManageOpen, setOrgManageOpen] = useState(false);
  const [orgManageTab, setOrgManageTab] = useState<"create" | "join">("create");
  const openChat = useChatStore((state) => state.openChat);
  const openChatDialog = useChatStore((state) => state.openChatDialog);
  const closeChat = useChatStore((state) => state.closeChat);
  const [searchQuery, setSearchQuery] = useState("");
  const { unreadCount } = useNotifications();

  const isMinimized = useMeetingStore((s) => s.isMinimized);
  const restoreDialog = useMeetingStore((s) => s.restoreDialog);
  const duration = useMeetingStore((s) => s.duration);
  const status = useMeetingStore((s) => s.status);
  const isDialogOpen = useMeetingStore((s) => s.isDialogOpen);
  const openDialog = useMeetingStore((s) => s.openDialog);

  // Global WebSocket listener for background meeting transcription updates
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleMeetingUpdate = (payload: {
      type: string;
      recordingId: string;
      status: string;
      recording?: any;
    }) => {
      console.log("[AppSidebar] WebSocket meeting update event received:", payload);

      if (payload.status === "processing") {
        toast.info("Meeting Sync Started", {
          description: "Your background capture is now being transcribed using AI.",
          duration: 5000
        });
      } else if (payload.status === "completed" && payload.recording) {
        toast.success("Meeting Captured Successfully", {
          description: "Your session transcript and diarization are ready.",
          action: {
            label: "Open Review",
            onClick: () => {
              openDialog(payload.recordingId);
            }
          },
          duration: 10000
        });
      } else if (payload.status === "failed") {
        console.error("[AppSidebar] Meeting transcription job failed for recording ID:", payload.recordingId, payload.recording);
        toast.error("Meeting Sync Failed", {
          description: "AI transcription failed for the background capture. Check developer console logs.",
          duration: 8000
        });
      }
    };

    socket.on("meeting_update", handleMeetingUpdate);
    return () => {
      socket.off("meeting_update", handleMeetingUpdate);
    };
  }, [openDialog]);

  // Global WebSocket listener for real-time organisation member join events
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleMemberJoined = (payload: {
      orgId: string;
      orgName: string;
      inviterId?: string;
      joinedUser: {
        id: string;
        name: string;
        email: string;
      };
    }) => {
      console.log("[AppSidebar] WebSocket member_joined event received:", payload);

      // 1. Invalidate members query cache to trigger immediate settings/spaces list refresh
      queryClient.invalidateQueries({
        queryKey: orgKeys.members(payload.orgId),
      });

      // 2. Trigger real-time toast depending on who generated the invite
      const isInviter = payload.inviterId === user?.id;
      if (isInviter) {
        toast.success(`${payload.joinedUser.name} joined ${payload.orgName} via your invite link!`);
      } else {
        toast.info(`${payload.joinedUser.name} has joined ${payload.orgName}.`);
      }
    };

    socket.on("member_joined", handleMemberJoined);
    return () => {
      socket.off("member_joined", handleMemberJoined);
    };
  }, [queryClient, user?.id]);

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return [
      h > 0 ? h : null,
      m.toString().padStart(2, "0"),
      s.toString().padStart(2, "0")
    ].filter(x => x !== null).join(":");
  };

  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const logoSrc = isDark ? "/keilhq-white.svg" : "/keilhq.svg";

  const { data: me } = useMe();

  const userDisplayName =
    me?.name || user?.user_metadata?.full_name || user?.email || "User";
  const userInitials =
    (me?.name || user?.user_metadata?.full_name)
      ?.split(" ")
      .map((n: string) => n?.[0])
      .filter(Boolean)
      .join("")
      .toUpperCase() ||
    user?.email?.[0]?.toUpperCase() ||
    "U";
  const avatarUrl = me?.avatar_url || user?.user_metadata?.avatar_url || user?.user_metadata?.picture || undefined;

  const { state } = useSidebar();
  const { setOpen } = useSidebar();
  const isCollapsed = state === "collapsed";

  // ── Auto-collapse on /motion/* and /meetings/* routes ────────────────────
  // When the user navigates into Motion or Meetings, the AppSidebar collapses
  // so the feature sidebar can take the full left panel without two sidebars competing.
  // When leaving, the previous open state is restored.
  const wasOpenBeforeMotion = useRef<boolean | null>(null);
  const isMotionRoute = location.pathname.startsWith("/motion");
  const isMeetingsRoute = location.pathname.startsWith("/meetings");
  const isFeatureSidebarRoute = isMotionRoute || isMeetingsRoute;

  useEffect(() => {
    if (isFeatureSidebarRoute) {
      // Save current open state before collapsing
      if (wasOpenBeforeMotion.current === null) {
        wasOpenBeforeMotion.current = state === "expanded";
      }
      setOpen(false);
    } else {
      // Restore previous state when leaving
      if (wasOpenBeforeMotion.current !== null) {
        setOpen(wasOpenBeforeMotion.current);
        wasOpenBeforeMotion.current = null;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFeatureSidebarRoute]);

  // ── App context ────────────────────────────────────────────────────────
  const {
    organisations,
    activeOrgId,
    activeSpaceId,
    activeOrg,
    activeSpace,
    setActiveOrganisation,
  } = useAppContext();

  const navigate = useNavigate();

  // ── Helper for manual workspace switching with navigation reset ──────────
  // If the user is on a detail page (/tasks/:id or /events/:id), we reset
  // them to /tasks after switching to avoid getting trapped by auto-switch logic.
  // We only reset if the target workspace is actually different.
  const handleManualSwitch = (
    switchFn: () => void,
    targetOrgId?: string | null,
    targetSpaceId?: string | null
  ) => {
    const isDetailRoute = /^\/(tasks|events)\/[^/]+/.test(location.pathname);
    const isChanging =
      targetOrgId !== activeOrgId ||
      (targetSpaceId !== undefined && targetSpaceId !== activeSpaceId);

    switchFn();

    if (isDetailRoute && isChanging) {
      navigate("/tasks");
    }
  };

  // Subtitle shown under the user name in the sidebar button
  // Personal org → just show space name (e.g. "Private")
  // Org workspace → show "OrgName:SpaceName" (e.g. "Zemon:General")
  const currentSpaceLabel = activeOrg && activeSpace
    ? activeOrg.is_personal
      ? activeSpace.name
      : `${activeOrg.name}:${activeSpace.name}`
    : activeSpace?.name ?? activeOrg?.name ?? "Organisation";

  const visibleNavigationItems = navigationItems.filter((item) =>
    item.title.toLowerCase().includes(searchQuery.trim().toLowerCase())
  );


  const isRouteActive = (url: string) => {
    if (url === "/") {
      return location.pathname === "/";
    }
    return location.pathname === url || location.pathname.startsWith(`${url}/`);
  };

  return (
    <>
      <Sidebar
        collapsible="icon"
        className="border-r border-border/70 bg-sidebar/95"
      >
        {/* Header */}
        <SidebarHeader className="gap-3 px-3 py-4 group-data-[state=collapsed]:px-2 group-data-[state=collapsed]:py-3">
          <SidebarMenu>
            <SidebarMenuItem>
              {isCollapsed ? (
                <div className="relative group/trigger flex items-center justify-center size-8 mx-auto transition-all duration-300">
                  <Link to="/">
                    <img
                      src={logoSrc}
                      alt="Keil HQ"
                      className="size-6 transition-all duration-300 group-hover/trigger:opacity-0 group-hover/trigger:scale-90 cursor-pointer"
                    />
                  </Link>
                  <SidebarTrigger className="absolute inset-0 opacity-0 group-hover/trigger:opacity-100 transition-all duration-300 scale-75 group-hover/trigger:scale-100 bg-card hover:bg-muted border-none shadow-none" />
                </div>
              ) : (
                <div className="flex h-9 items-center justify-between gap-3">
                  <Link to="/" className="flex items-center gap-2.5">
                    <div className="flex size-8 items-center justify-center rounded-lg bg-background shadow-sm ring-1 ring-border/60">
                      <img src={logoSrc} alt="Keil HQ" className="size-5" />
                    </div>
                    <span className="truncate text-[15px] font-bold tracking-tight text-foreground">
                      KeilHQ
                    </span>
                  </Link>
                  <SidebarTrigger className="size-7 rounded-md border border-border/60 bg-background/80 shadow-sm hover:bg-sidebar-accent" />
                </div>
              )}
            </SidebarMenuItem>
          </SidebarMenu>

          {!isCollapsed && (
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <SidebarInput
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search..."
                className="h-9 rounded-xl border-border/60 bg-background/75 pl-9 pr-12 text-[13px] shadow-sm"
              />
              <kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded-md border border-border/70 bg-muted/70 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                Ctrl + K
              </kbd>
            </div>
          )}
        </SidebarHeader>

        {/* Navigation */}
        <SidebarContent className="gap-0 px-2 pb-2">
          <SidebarGroup className="p-0">
            <SidebarGroupContent>
              <SidebarMenu className="gap-1">
                {visibleNavigationItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    {"url" in item && item.url ? (
                      <SidebarMenuButton
                        asChild
                        isActive={isRouteActive(item.url)}
                        tooltip={item.title}
                        className="h-9 rounded-xl px-3 text-[13px] font-medium data-[active=true]:bg-background data-[active=true]:shadow-sm data-[active=true]:ring-1 data-[active=true]:ring-border/60"
                      >
                        <Link to={item.url}>
                          <item.icon className="text-muted-foreground" />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    ) : (
                      <SidebarMenuButton
                        onClick={() => {
                          if ("action" in item) {
                            if (item.action === "notifications") {
                              closeChat();
                              onNotificationDrawerOpenChange?.(true);
                            }
                          }
                        }}
                        isActive={
                          "action" in item
                            ? item.action === "notifications"
                              ? (notificationDrawerOpen || notificationDialogOpen)
                              : false
                            : false
                        }
                        tooltip={item.title}
                        className="h-9 rounded-xl px-3 text-[13px] font-medium data-[active=true]:bg-background data-[active=true]:shadow-sm data-[active=true]:ring-1 data-[active=true]:ring-border/60"
                      >
                        <item.icon className="text-muted-foreground" />
                        <span>{item.title}</span>
                      </SidebarMenuButton>
                    )}
                    {item.title === "Notifications" && unreadCount > 0 && (
                      <SidebarMenuBadge className="right-2 top-2 rounded-full bg-primary px-1.5 text-[10px] text-primary-foreground">
                        {unreadCount}
                      </SidebarMenuBadge>
                    )}
                  </SidebarMenuItem>
                ))}

                {activeOrgId && activeSpaceId && (
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      onClick={() => {
                        const defaultView = localStorage.getItem("default_chat_view") || "sidebar";
                        if (defaultView === "dialog") {
                          openChatDialog();
                        } else {
                          openChat();
                        }
                        onNotificationDrawerOpenChange?.(false);
                      }}
                      tooltip="Chat"
                      className="h-9 rounded-xl px-3 text-[13px] font-medium"
                    >
                      <MessageSquare className="text-muted-foreground" />
                      <span>Chat</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )}

              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>


        </SidebarContent>

        {/* ── Footer: profile dropdown ── */}
        <SidebarFooter className="shrink-0 border-t border-border/50 p-1.5 px-2 gap-2">
          {/* ── Meeting Mic Button ── always visible above user section */}
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={() => {
                  if (isMinimized) {
                    restoreDialog();
                  } else {
                    openDialog();
                  }
                }}
                isActive={isDialogOpen && !isMinimized}
                tooltip={isMinimized ? `${status === "recording" ? "Recording" : status === "uploading" ? "Uploading" : "Processing"} — click to open` : "Meetings"}
                className={cn(
                  "h-9 rounded-xl px-3 text-[13px] font-medium transition-all duration-300",
                  "data-[active=true]:bg-background data-[active=true]:shadow-sm data-[active=true]:ring-1 data-[active=true]:ring-border/60",
                  isMinimized
                    ? "bg-violet-500/10 border border-violet-500/30 shadow-[0_0_10px_2px_rgba(139,92,246,0.2)] hover:bg-violet-500/15"
                    : ""
                )}
              >
                <Mic
                  className={cn(
                    "shrink-0 transition-all duration-300",
                    isMinimized
                      ? "text-violet-500 dark:text-violet-400 animate-pulse drop-shadow-[0_0_4px_rgba(139,92,246,0.8)]"
                      : "text-muted-foreground"
                  )}
                />
                {/* When minimized (expanded sidebar): show status + timer instead of plain label */}
                {isMinimized ? (
                  <div className="flex flex-1 items-center justify-between min-w-0">
                    <span className="text-[11px] font-semibold text-violet-600 dark:text-violet-400 truncate">
                      {status === "recording" ? "Recording" : status === "uploading" ? "Uploading" : "Processing"}
                    </span>
                    <span className="text-[11px] font-mono font-bold text-foreground tabular-nums shrink-0 ml-2">
                      {formatTime(duration)}
                    </span>
                  </div>
                ) : (
                  <span>Meetings</span>
                )}
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>

          <SidebarMenu>
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton
                    size="lg"
                    className="mt-2 h-11 rounded-xl px-2 data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                  >
                    <Avatar className="size-8 rounded-full ring-1 ring-border/60">
                      <AvatarImage src={getOptimizedImageUrl(avatarUrl, { width: 96, height: 96 })} alt={userDisplayName} className="rounded-full" />
                      <AvatarFallback className="rounded-full bg-primary text-xs text-primary-foreground">
                        {userInitials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="grid flex-1 text-left text-sm leading-tight">
                      <span className="truncate font-semibold">
                        {userDisplayName}
                      </span>
                      <span className="truncate text-xs text-muted-foreground">
                        {currentSpaceLabel}
                      </span>
                    </div>
                    <ChevronUp className="ml-auto size-4 text-muted-foreground" />
                  </SidebarMenuButton>
                </DropdownMenuTrigger>

                <DropdownMenuContent
                  side="right"
                  align="end"
                  sideOffset={12}
                  collisionPadding={16}
                  className="w-72 rounded-xl p-1"
                >
                  {/* ── User info header ── */}
                  <DropdownMenuLabel className="font-normal px-2 py-1.5">
                    <div className="flex items-center gap-2">
                      <Avatar className="size-7 rounded-md">
                        <AvatarImage src={getOptimizedImageUrl(avatarUrl, { width: 84, height: 84 })} alt={userDisplayName} className="rounded-md" />
                        <AvatarFallback className="rounded-md bg-primary text-primary-foreground text-xs">
                          {userInitials}
                        </AvatarFallback>
                      </Avatar>
                      <div className="grid text-left text-sm leading-tight">
                        <span className="truncate font-semibold text-xs">
                          {userDisplayName}
                        </span>
                        <span className="truncate text-[10px] text-muted-foreground">
                          {currentSpaceLabel}
                        </span>
                      </div>
                    </div>
                  </DropdownMenuLabel>

                  <DropdownMenuSeparator />

                  {/* ── Organisation section ── */}
                  <DropdownMenuLabel className="flex items-center justify-between px-2 py-1.5">
                    <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <Building2 className="size-3" />
                      Organisations
                    </span>
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        setOrgManageTab("create");
                        setOrgManageOpen(true);
                      }}
                      className="size-5 flex items-center justify-center rounded border border-dashed border-muted-foreground/40 hover:border-foreground/50 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                      title="Create or join an organisation"
                    >
                      <Plus className="size-3" />
                    </button>
                  </DropdownMenuLabel>

                  {/* Org list — each row has a space sub-menu */}
                  {organisations.length === 0 ? (
                    <div className="px-2.5 py-2 text-xs text-muted-foreground">
                      No organisations yet
                    </div>
                  ) : (
                    organisations.map((org) => (
                      <OrgSpaceSubmenu
                        key={org.id}
                        org={org}
                        activeOrgId={activeOrgId}
                        activeSpaceId={activeSpaceId}
                        onSelectSpace={(orgId, spaceId) =>
                          handleManualSwitch(
                            () => setActiveOrganisation(orgId, spaceId),
                            orgId,
                            spaceId
                          )
                        }
                      />
                    ))
                  )}

                  <DropdownMenuSeparator />

                  {/* ── Settings ── */}
                  <DropdownMenuItem
                    className="rounded-lg cursor-pointer gap-2.5 px-2.5 py-2 text-[13px]"
                    onSelect={() => {
                      setSettingsInitialTab("account");
                      setSettingsOpen(true);
                    }}
                  >
                    <Settings className="size-4 text-muted-foreground" />
                    Settings
                  </DropdownMenuItem>

                  <DropdownMenuSeparator />

                  {/* ── Sign out ── */}
                  <DropdownMenuItem
                    className="rounded-lg cursor-pointer gap-2.5 px-2.5 py-2 text-[13px] text-red-500 focus:text-red-500 focus:bg-red-50 dark:focus:bg-red-950/30"
                    onClick={signOut}
                  >
                    <LogOut className="size-4" />
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>

        <SidebarRail />
      </Sidebar>

      {/* ── Dialogs ── */}
      <OrgManageDialog
        open={orgManageOpen}
        onOpenChange={setOrgManageOpen}
        initialTab={orgManageTab}
      />
      <SettingsDialog
        open={settingsOpen || settingsStoreOpen}
        onOpenChange={(open) => {
          if (!open) {
            setSettingsOpen(false);
            closeSettings();
          } else {
            setSettingsOpen(true);
          }
        }}
        initialTab={settingsStoreOpen ? settingsStoreTab : settingsInitialTab}
      />
    </>
  );
}
