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
import {
  LayoutDashboard,
  Users,
  Settings,
  FileText,
  BarChart3,
  Bell,
  LogOut,
  ChevronUp,
  User,
  CreditCard,
  HelpCircle,
  MessageSquare,
  CheckSquare,
} from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { useTheme } from "next-themes";
import { SettingsDialog } from "@/components/SettingsDialog";

const navigationItems = [
  {
    title: "Dashboard",
    url: "/",
    icon: LayoutDashboard,
  },
  {
    title: "Chat",
    url: "/chat",
    icon: MessageSquare,
  },
  {
    title: "Tasks",
    url: "/tasks",
    icon: CheckSquare,
  },
  {
    title: "Users",
    url: "/users",
    icon: Users,
  },
  {
    title: "Reports",
    url: "/reports",
    icon: FileText,
  },
  {
    title: "Analytics",
    url: "/analytics",
    icon: BarChart3,
  },
  {
    title: "Notifications",
    url: "/notifications",
    icon: Bell,
  },
];

export function AppSidebar() {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const [settingsOpen, setSettingsOpen] = useState(false);
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

  const isCollapsed = state === "collapsed";

  return (
    <>
      <Sidebar collapsible="icon" className="border-r-0 bg-card">
        <SidebarHeader className="p-4 pt-6 group-data-[state=collapsed]:p-2 group-data-[state=collapsed]:pt-6">
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
                <div className="flex items-center justify-between gap-3 px-1 transition-all duration-500 animate-in fade-in slide-in-from-left-2">
                  <Link to="/" className="flex items-center gap-2.5 group">
                    <div className="flex size-8 items-center justify-center rounded-xl transition-transform group-hover:scale-105 active:scale-95">
                      <img src={logoSrc} alt="Logo" className="size-6" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-bold tracking-tight text-foreground">KeilHQ</span>
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-none mt-0.5">Assistant</span>
                    </div>
                  </Link>
                  <SidebarTrigger className="size-8 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground border-none shadow-none" />
                </div>
              )}
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

      {/* Settings Dialog */}
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </>
  );
}
