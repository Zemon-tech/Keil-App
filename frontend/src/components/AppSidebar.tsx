import { useEffect, useRef, useState } from "react";
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/contexts/AuthContext";
import { useAppContext } from "@/contexts/AppContext";
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
} from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTheme } from "next-themes";
import { SettingsDialog } from "@/components/SettingsDialog";
import { NotificationDialog } from "@/components/NotificationDialog";
import { NotificationDrawer } from "@/components/NotificationDrawer";
import { useChatStore } from "@/store/useChatStore";
import { CreateOrganisationDialog } from "@/components/org/CreateOrganisationDialog";
import { JoinOrganisationDialog } from "@/components/org/JoinOrganisationDialog";
import type { Organisation } from "@/hooks/api/useOrganisations";
import { MeetingDialog } from "@/components/MeetingDialog";

// ─── Navigation items ─────────────────────────────────────────────────────────

const navigationItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Tasks", url: "/tasks", icon: CheckSquare },
  { title: "Meetings", action: "meetings", icon: Mic },
  { title: "Motion", url: "/motion", icon: Image },
];



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
          <div className="h-6 w-6 rounded bg-primary/20 flex items-center justify-center text-xs font-medium text-primary shrink-0">
            {org.is_personal ? (
              <User className="h-3.5 w-3.5" />
            ) : (
              org.name.charAt(0).toUpperCase()
            )}
          </div>
          <span className="text-sm font-medium truncate">
            {org.is_personal ? "Personal Workspace" : org.name}
          </span>
        </div>
        {isActiveOrg && (
          <Check className="h-4 w-4 text-primary shrink-0 mr-1" />
        )}
      </DropdownMenuSubTrigger>

      <DropdownMenuSubContent className="w-48 rounded-xl p-1">
        {isLoading ? (
          <div className="flex items-center justify-center py-3">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
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
                  <Check className="h-4 w-4 text-primary shrink-0" />
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

export function AppSidebar() {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsInitialTab, setSettingsInitialTab] = useState<
    "account" | "org-general"
  >("account");
  const [createOrgOpen, setCreateOrgOpen] = useState(false);
  const [joinOrgOpen, setJoinOrgOpen] = useState(false);
  const openChat = useChatStore((state) => state.openChat);
  const [notificationDrawerOpen, setNotificationDrawerOpen] = useState(false);
  const [notificationDialogOpen, setNotificationDialogOpen] = useState(false);
  const [meetingDialogOpen, setMeetingDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const logoSrc = isDark ? "/keilhq-white.svg" : "/keilhq.svg";

  const userDisplayName =
    user?.user_metadata?.full_name || user?.email || "User";
  const userInitials =
    user?.user_metadata?.full_name
      ?.split(" ")
      .map((n: string) => n?.[0])
      .filter(Boolean)
      .join("")
      .toUpperCase() ||
    user?.email?.[0]?.toUpperCase() ||
    "U";

  const { state } = useSidebar();
  const { setOpen } = useSidebar();
  const isCollapsed = state === "collapsed";

  // ── Auto-collapse on /motion/* routes (Option A1) ──────────────────────
  // When the user navigates into Motion, the AppSidebar collapses so the
  // MotionSidebar can take the full left panel without two sidebars competing.
  // When leaving /motion, the previous open state is restored.
  const wasOpenBeforeMotion = useRef<boolean | null>(null);
  const isMotionRoute = location.pathname.startsWith("/motion");

  useEffect(() => {
    if (isMotionRoute) {
      // Save current open state before collapsing
      if (wasOpenBeforeMotion.current === null) {
        wasOpenBeforeMotion.current = state === "expanded";
      }
      setOpen(false);
    } else {
      // Restore previous state when leaving /motion
      if (wasOpenBeforeMotion.current !== null) {
        setOpen(wasOpenBeforeMotion.current);
        wasOpenBeforeMotion.current = null;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMotionRoute]);

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
  const currentSpaceLabel =
    activeOrg?.is_personal
      ? (activeSpace?.name ?? "Personal Workspace")
      : (activeSpace?.name ?? activeOrg?.name ?? "Organisation");

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
                <div className="relative group/trigger flex items-center justify-center h-8 w-8 mx-auto transition-all duration-300">
                  <img
                    src={logoSrc}
                    alt="Keil HQ"
                    className="size-6 transition-all duration-300 group-hover/trigger:opacity-0 group-hover/trigger:scale-90"
                  />
                  <SidebarTrigger className="absolute inset-0 opacity-0 group-hover/trigger:opacity-100 transition-all duration-300 scale-75 group-hover/trigger:scale-100 bg-card hover:bg-muted border-none shadow-none" />
                </div>
              ) : (
                <div className="flex h-9 items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="flex size-8 items-center justify-center rounded-lg bg-background shadow-sm ring-1 ring-border/60">
                      <img src={logoSrc} alt="Keil HQ" className="size-5" />
                    </div>
                    <span className="truncate text-[15px] font-bold tracking-tight text-foreground">
                      KeilHQ
                    </span>
                  </div>
                  <SidebarTrigger className="h-7 w-7 rounded-md border border-border/60 bg-background/80 shadow-sm hover:bg-sidebar-accent" />
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
                Ctrl F
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
                          if ("action" in item && item.action === "meetings") {
                            setMeetingDialogOpen(true);
                          }
                        }}
                        isActive={meetingDialogOpen}
                        tooltip={item.title}
                        className="h-9 rounded-xl px-3 text-[13px] font-medium data-[active=true]:bg-background data-[active=true]:shadow-sm data-[active=true]:ring-1 data-[active=true]:ring-border/60"
                      >
                        <item.icon className="text-muted-foreground" />
                        <span>{item.title}</span>
                      </SidebarMenuButton>
                    )}
                    {item.title === "Tasks" && (
                      <SidebarMenuBadge className="right-2 top-2 text-[11px] text-muted-foreground">
                        3/5
                      </SidebarMenuBadge>
                    )}
                  </SidebarMenuItem>
                ))}

                {activeOrgId && activeSpaceId && (
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      onClick={() => {
                        openChat();
                        setNotificationDrawerOpen(false);
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
        <SidebarFooter className="shrink-0 border-t border-border/50 p-1.5 px-2">
          <SidebarMenu>
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton
                    size="lg"
                    className="mt-2 h-11 rounded-xl px-2 data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                  >
                    <Avatar className="h-8 w-8 rounded-full ring-1 ring-border/60">
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
                      <Avatar className="h-7 w-7 rounded-md">
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
                      <Building2 className="h-3 w-3" />
                      Organisations
                    </span>
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

                  <DropdownMenuItem
                    className="gap-2 px-2 py-1.5 cursor-pointer text-muted-foreground hover:text-foreground"
                    onClick={(e) => {
                      e.preventDefault();
                      setJoinOrgOpen(true);
                    }}
                  >
                    <div className="flex h-6 w-6 items-center justify-center rounded-md border border-dashed border-muted-foreground/40 bg-transparent">
                      <Plus className="h-3 w-3" />
                    </div>
                    <span className="text-xs font-medium">Join an organisation</span>
                  </DropdownMenuItem>

                  <DropdownMenuItem
                    className="gap-2 px-2 py-1.5 cursor-pointer text-muted-foreground hover:text-foreground"
                    onClick={(e) => {
                      e.preventDefault();
                      setCreateOrgOpen(true);
                    }}
                  >
                    <div className="flex h-6 w-6 items-center justify-center rounded-md border border-dashed border-muted-foreground/40 bg-transparent">
                      <Plus className="h-3 w-3" />
                    </div>
                    <span className="text-xs font-medium">Create organisation</span>
                  </DropdownMenuItem>

                  <DropdownMenuSeparator />

                  {/* ── Settings ── */}
                  <DropdownMenuItem
                    className="rounded-lg cursor-pointer gap-2.5 px-2.5 py-2 text-[13px]"
                    onSelect={() => {
                      setSettingsInitialTab("account");
                      setSettingsOpen(true);
                    }}
                  >
                    <Settings className="h-4 w-4 text-muted-foreground" />
                    Settings
                  </DropdownMenuItem>

                  <DropdownMenuSeparator />

                  {/* ── Sign out ── */}
                  <DropdownMenuItem
                    className="rounded-lg cursor-pointer gap-2.5 px-2.5 py-2 text-[13px] text-red-500 focus:text-red-500 focus:bg-red-50 dark:focus:bg-red-950/30"
                    onClick={signOut}
                  >
                    <LogOut className="h-4 w-4" />
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
      <CreateOrganisationDialog
        open={createOrgOpen}
        onOpenChange={setCreateOrgOpen}
      />
      <JoinOrganisationDialog
        open={joinOrgOpen}
        onOpenChange={setJoinOrgOpen}
      />
      <SettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        initialTab={settingsInitialTab}
      />
      <NotificationDrawer
        open={notificationDrawerOpen}
        onOpenChange={setNotificationDrawerOpen}
        onOpenFullView={() => {
          setNotificationDrawerOpen(false);
          setNotificationDialogOpen(true);
        }}
      />
      <NotificationDialog
        open={notificationDialogOpen}
        onOpenChange={setNotificationDialogOpen}
      />
      <MeetingDialog
        open={meetingDialogOpen}
        onOpenChange={setMeetingDialogOpen}
      />
    </>
  );
}
