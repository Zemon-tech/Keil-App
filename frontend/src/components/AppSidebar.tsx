import { useEffect, useRef, useState } from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
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
import { Button } from "@/components/ui/button";
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
  CreditCard,
  HelpCircle,
  MessageSquare,
  CheckSquare,
  Plus,
  Bell,
  Loader2,
  Image,
  Building2,
} from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTheme } from "next-themes";import { SettingsDialog } from "@/components/SettingsDialog";
import { ChatDialog } from "@/components/ChatDialog";
import { NotificationDialog } from "@/components/NotificationDialog";
import { NotificationDrawer } from "@/components/NotificationDrawer";
import { CreateOrganisationDialog } from "@/components/org/CreateOrganisationDialog";
import { JoinOrganisationDialog } from "@/components/org/JoinOrganisationDialog";
import type { Organisation } from "@/hooks/api/useOrganisations";

// ─── Navigation items ─────────────────────────────────────────────────────────

const navigationItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Tasks", url: "/tasks", icon: CheckSquare },
  { title: "Motion", url: "/motion", icon: Image },
];

// ─── OrgSpaceSubmenu ──────────────────────────────────────────────────────────
// Lazy-loads spaces only when the submenu is opened.
// Renders as a DropdownMenuSub trigger + content.

interface OrgSpaceSubmenuProps {
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
  // Only fetch spaces when the submenu is actually opened
  const { data: spaces = [], isLoading } = useSpaces(subOpen ? org.id : null);

  const isActiveOrg = activeOrgId === org.id;

  return (
    <DropdownMenuSub open={subOpen} onOpenChange={setSubOpen}>
      <DropdownMenuSubTrigger className="rounded-lg cursor-pointer gap-2.5 px-2.5 py-2 text-[13px]">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div className="h-6 w-6 rounded bg-primary/20 flex items-center justify-center text-xs font-medium text-primary shrink-0">
            {org.name.charAt(0).toUpperCase()}
          </div>
          <span className="text-sm font-medium truncate">{org.name}</span>
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
        ) : spaces.length === 0 ? (
          <div className="px-2 py-3 text-xs text-muted-foreground text-center">
            No spaces yet
          </div>
        ) : (
          spaces.map((space) => {
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
  const [chatDialogOpen, setChatDialogOpen] = useState(false);
  const [notificationDrawerOpen, setNotificationDrawerOpen] = useState(false);
  const [notificationDialogOpen, setNotificationDialogOpen] = useState(false);

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
    mode,
    organisations,
    activeOrgId,
    activeSpaceId,
    activeOrg,
    activeSpace,
    setPersonalMode,
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
    const isDetailRoute = /^\/(tasks|events)\/[^\/]+/.test(location.pathname);
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
    mode === "personal"
      ? `${userDisplayName.split("@")[0]}'s Personal Space`
      : (activeSpace?.name ?? activeOrg?.name ?? "Organisation");

  return (
    <>
      <Sidebar collapsible="icon" className="border-r-0 bg-card">
        {/* ── Header ── */}
        <SidebarHeader className="px-3 py-2 group-data-[state=collapsed]:px-2 group-data-[state=collapsed]:py-2 border-b border-border/50">
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
                <div className="flex h-8 items-center justify-between gap-3 px-1 rounded-lg">
                  <div className="flex items-center gap-2.5">
                    <div className="flex size-8 items-center justify-center text-primary font-bold">
                      <img src={logoSrc} alt="Keil HQ" className="size-5" />
                    </div>
                    <span className="text-sm font-bold tracking-tight text-foreground truncate max-w-[160px]">
                      KeilHQ
                    </span>
                  </div>
                  <SidebarTrigger className="h-8 w-8 rounded-md hover:bg-sidebar-accent" />
                </div>
              )}
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>

        {/* ── Navigation ── */}
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Navigation</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {navigationItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={location.pathname === item.url}
                      tooltip={item.title}
                    >
                      <Link to={item.url}>
                        <item.icon />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}

                {/* Chat — only in organisation mode with an active space */}
                {mode === "organisation" && activeOrgId && activeSpaceId && (
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      onClick={() => setChatDialogOpen(true)}
                      isActive={chatDialogOpen}
                      tooltip="Chat"
                    >
                      <MessageSquare />
                      <span>Chat</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )}

                {/* Notifications */}
                <SidebarMenuItem>
                  <SidebarMenuButton
                    onClick={() => setNotificationDrawerOpen(true)}
                    isActive={notificationDrawerOpen || notificationDialogOpen}
                    tooltip="Notifications"
                  >
                    <Bell />
                    <span>Notifications</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        {/* ── Footer: profile dropdown ── */}
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton
                    size="lg"
                    className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                  >
                    <Avatar className="h-8 w-8 rounded-lg">
                      <AvatarFallback className="rounded-lg bg-primary text-primary-foreground">
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
                    <ChevronUp className="ml-auto" />
                  </SidebarMenuButton>
                </DropdownMenuTrigger>

                <DropdownMenuContent side="top" className="w-72 rounded-xl p-1">
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

                  {/* ── Mode section ── */}
                  <DropdownMenuLabel className="text-xs text-muted-foreground px-2 py-1.5">
                    Mode
                  </DropdownMenuLabel>
                  <DropdownMenuItem
                    className="rounded-lg cursor-pointer gap-2.5 px-2.5 py-2 text-[13px]"
                    onSelect={() => handleManualSwitch(setPersonalMode, null, null)}
                  >
                    <User className="h-4 w-4 text-muted-foreground" />
                    Personal
                    {mode === "personal" && (
                      <Check className="ml-auto h-4 w-4 text-primary" />
                    )}
                  </DropdownMenuItem>

                  <DropdownMenuSeparator />

                  {/* ── Organisation section ── */}
                  <DropdownMenuLabel className="flex items-center justify-between px-2 py-1.5">
                    <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <Building2 className="h-3 w-3" />
                      Organisation
                    </span>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-1.5 text-[11px] hover:bg-muted-foreground/10"
                        onClick={(e) => {
                          e.stopPropagation();
                          setJoinOrgOpen(true);
                        }}
                      >
                        <Plus className="h-3 w-3" />
                        Join
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 hover:bg-muted-foreground/10"
                        title="Create organisation"
                        onClick={(e) => {
                          e.stopPropagation();
                          setCreateOrgOpen(true);
                        }}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
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

                  {/* ── Settings / Billing / Help ── */}
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
                  <DropdownMenuItem className="rounded-lg cursor-pointer gap-2.5 px-2.5 py-2 text-[13px]">
                    <CreditCard className="h-4 w-4 text-muted-foreground" />
                    Billing
                  </DropdownMenuItem>
                  <DropdownMenuItem className="rounded-lg cursor-pointer gap-2.5 px-2.5 py-2 text-[13px]">
                    <HelpCircle className="h-4 w-4 text-muted-foreground" />
                    Help & Support
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
      <ChatDialog open={chatDialogOpen} onOpenChange={setChatDialogOpen} />
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
    </>
  );
}
