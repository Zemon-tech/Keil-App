import { useState } from "react";
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useAppContext } from "@/contexts/AppContext";
import {
  LayoutDashboard,
  Settings,
  LogOut,
  ChevronUp,
  User,
  CreditCard,
  HelpCircle,
  MessageSquare,
  CheckSquare,
  Check,
  Plus,
  Bell,
  Building2,
  Layers,
  ChevronDown,
} from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { useTheme } from "next-themes";
import { SettingsDialog } from "@/components/SettingsDialog";
import { ChatDialog } from "@/components/ChatDialog";
import { NotificationDialog } from "@/components/NotificationDialog";
import { NotificationDrawer } from "@/components/NotificationDrawer";
import { CreateWorkspaceDialog } from "./workspace/CreateWorkspaceDialog";

const navigationItems = [
  {
    title: "Dashboard",
    url: "/",
    icon: LayoutDashboard,
  },
  {
    title: "Tasks",
    url: "/tasks",
    icon: CheckSquare,
  },
];

export function AppSidebar() {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [createWorkspaceOpen, setCreateWorkspaceOpen] = useState(false);
  const [chatDialogOpen, setChatDialogOpen] = useState(false);
  const [notificationDrawerOpen, setNotificationDrawerOpen] = useState(false);
  const [notificationDialogOpen, setNotificationDialogOpen] = useState(false);
  const userInitials = user?.user_metadata?.full_name
    ?.split(" ")
    .map((n: string) => n[0])
    .join("")
    .toUpperCase() || user?.email?.[0].toUpperCase() || "U";

  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const logoSrc = isDark ? "/keilhq-white.svg" : "/keilhq.svg";

  const userDisplayName = user?.user_metadata?.full_name || user?.email || "User";
  const userEmail = user?.email || "";

  const { state } = useSidebar();
  const { workspaces, workspaceId, setActiveWorkspace } = useWorkspace();

  // ── New app context (mode / org / space) ───────────────────────────────
  const {
    mode,
    organisations,
    spaces,
    activeOrg,
    activeSpace,
    setPersonalMode,
    setActiveOrganisation,
    setActiveSpace,
  } = useAppContext();

  const isCollapsed = state === "collapsed";

  return (
    <>
      <Sidebar collapsible="icon" className="border-r-0 bg-card">
        <SidebarHeader className="p-4 pt-6 group-data-[state=collapsed]:p-2 group-data-[state=collapsed]:pt-6 border-b border-border/50">
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
                <div className="flex items-center justify-between gap-3 px-1 transition-all duration-500 animate-in fade-in slide-in-from-left-2 rounded-lg">
                  <div className="flex items-center gap-2.5 py-1.5">
                    <div className="flex size-8 items-center justify-center rounded-xl bg-primary/10 text-primary font-bold">
                      <img src={logoSrc} alt="Keil HQ" className="size-5" />
                    </div>
                    <div className="flex flex-col text-left">
                      <span className="text-sm font-bold tracking-tight text-foreground truncate max-w-[160px]">KeilHQ</span>
                    </div>
                  </div>
                  <SidebarTrigger className="h-8 w-8 rounded-md hover:bg-sidebar-accent" />
                </div>
              )}
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>

        <SidebarContent>

          {/* ── Mode Toggle: Personal / Organisation ─────────────── */}
          <SidebarGroup>
            <SidebarGroupLabel>Mode</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {/* Personal mode button */}
                <SidebarMenuItem>
                  <SidebarMenuButton
                    onClick={setPersonalMode}
                    isActive={mode === "personal"}
                    tooltip="Personal"
                  >
                    <User />
                    <span>Personal</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>

                {/* Organisation mode button — only shown when user has orgs */}
                {organisations.length > 0 && (
                  <SidebarMenuItem>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <SidebarMenuButton
                          isActive={mode === "organisation"}
                          tooltip={activeOrg?.name ?? "Organisation"}
                          className="w-full"
                        >
                          <Building2 />
                          <span className="flex-1 truncate text-left">
                            {mode === "organisation" && activeOrg
                              ? activeOrg.name
                              : "Organisation"}
                          </span>
                          {!isCollapsed && <ChevronDown className="h-3.5 w-3.5 opacity-50 shrink-0" />}
                        </SidebarMenuButton>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent side="right" align="start" className="w-52">
                        <DropdownMenuLabel className="text-xs text-muted-foreground">Switch organisation</DropdownMenuLabel>
                        {organisations.map((org) => (
                          <DropdownMenuItem
                            key={org.id}
                            onClick={() => setActiveOrganisation(org.id)}
                            className="flex items-center justify-between gap-2 text-sm cursor-pointer"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="h-5 w-5 rounded bg-primary/20 flex items-center justify-center text-xs font-medium text-primary shrink-0">
                                {org.name.charAt(0).toUpperCase()}
                              </div>
                              <span className="truncate">{org.name}</span>
                            </div>
                            {activeOrg?.id === org.id && mode === "organisation" && (
                              <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                            )}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </SidebarMenuItem>
                )}

                {/* Space switcher — only visible in organisation mode */}
                {mode === "organisation" && spaces.length > 0 && (
                  <SidebarMenuItem>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <SidebarMenuButton
                          isActive={false}
                          tooltip={activeSpace?.name ?? "Space"}
                          className="w-full pl-6"
                        >
                          <Layers className="opacity-60" />
                          <span className="flex-1 truncate text-left text-muted-foreground">
                            {activeSpace?.name ?? "Select space"}
                          </span>
                          {!isCollapsed && <ChevronDown className="h-3.5 w-3.5 opacity-40 shrink-0" />}
                        </SidebarMenuButton>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent side="right" align="start" className="w-48">
                        <DropdownMenuLabel className="text-xs text-muted-foreground">Switch space</DropdownMenuLabel>
                        {spaces.map((space) => (
                          <DropdownMenuItem
                            key={space.id}
                            onClick={() => setActiveSpace(space.id)}
                            className="flex items-center justify-between gap-2 text-sm cursor-pointer"
                          >
                            <span className="truncate">{space.name}</span>
                            {activeSpace?.id === space.id && (
                              <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                            )}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </SidebarMenuItem>
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          {/* ── Navigation ───────────────────────────────────────── */}
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

                {/* ── Chat button — only in organisation mode (chat lives inside spaces) ── */}
                {mode === "organisation" && (
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

                {/* ── Notification button — opens drawer ── */}
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
                      <span className="truncate font-semibold">{userDisplayName}</span>
                      <span className="truncate text-xs text-muted-foreground">{userEmail}</span>
                    </div>
                    <ChevronUp className="ml-auto" />
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  side="top"
                  className="w-[--radix-popper-anchor-width] rounded-xl p-1"
                >
                  <DropdownMenuLabel className="font-normal px-2 py-1.5">
                    <div className="flex items-center gap-2">
                      <Avatar className="h-7 w-7 rounded-md">
                        <AvatarFallback className="rounded-md bg-primary text-primary-foreground text-xs">
                          {userInitials}
                        </AvatarFallback>
                      </Avatar>
                      <div className="grid text-left text-sm leading-tight">
                        <span className="truncate font-semibold text-xs">{userDisplayName}</span>
                        <span className="truncate text-[10px] text-muted-foreground">{userEmail}</span>
                      </div>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className="text-xs text-muted-foreground px-2 py-1.5">Workspaces</DropdownMenuLabel>
                  {workspaces.map((ws) => (
                    <DropdownMenuItem
                      key={ws.id}
                      onClick={() => setActiveWorkspace(ws.id)}
                      className="flex items-center justify-between cursor-pointer rounded-lg gap-2.5 px-2.5 py-2 text-[13px]"
                    >
                      <div className="flex items-center gap-2">
                        <div className="h-6 w-6 rounded bg-primary/20 flex items-center justify-center text-xs font-medium text-primary">
                          {ws.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-sm font-medium">{ws.name}</span>
                      </div>
                      {workspaceId === ws.id && <Check className="h-4 w-4 text-primary" />}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuItem
                    className="rounded-lg cursor-pointer gap-2.5 px-2.5 py-2 text-[13px]"
                    onSelect={() => setCreateWorkspaceOpen(true)}
                  >
                    <Plus className="h-4 w-4 text-muted-foreground" />
                    Create workspace
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="rounded-lg cursor-pointer gap-2.5 px-2.5 py-2 text-[13px]">
                    <User className="h-4 w-4 text-muted-foreground" />
                    Profile
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="rounded-lg cursor-pointer gap-2.5 px-2.5 py-2 text-[13px]"
                    onSelect={() => setSettingsOpen(true)}
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

      <CreateWorkspaceDialog open={createWorkspaceOpen} onOpenChange={setCreateWorkspaceOpen} />
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
      <ChatDialog open={chatDialogOpen} onOpenChange={setChatDialogOpen} />
      <NotificationDrawer 
        open={notificationDrawerOpen} 
        onOpenChange={setNotificationDrawerOpen}
        onOpenFullView={() => {
          setNotificationDrawerOpen(false);
          setNotificationDialogOpen(true);
        }}
      />
      <NotificationDialog open={notificationDialogOpen} onOpenChange={setNotificationDialogOpen} />
    </>
  );
}
