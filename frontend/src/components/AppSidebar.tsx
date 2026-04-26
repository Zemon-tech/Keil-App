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
  Bell
} from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { useTheme } from "next-themes";
import { SettingsDialog } from "@/components/SettingsDialog";
import { ChatDialog } from "@/components/ChatDialog";
import { NotificationDialog } from "@/components/NotificationDialog";
import { NotificationDrawer } from "@/components/NotificationDrawer";
import { CreateWorkspaceDialog } from "./workspace/CreateWorkspaceDialog";
import { WorkspaceSwitcher } from "./workspace/WorkspaceSwitcher";

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

  const isCollapsed = state === "collapsed";

  return (
    <>
      <Sidebar collapsible="icon" className="border-r-0 bg-card">
        <SidebarHeader className="px-3 py-4 group-data-[state=collapsed]:p-2 group-data-[state=collapsed]:pt-6 border-b border-border/50">
          <SidebarMenu className="gap-1">
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
            <SidebarMenuItem>
              <WorkspaceSwitcher />
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>

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

                {/* ── Chat button — opens dialog ── */}
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
