import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import {
  Search,
  Home,
  Calendar,
  Sparkles,
  Inbox,
  Library,
  ChevronDown,
  Plus,
  FileText,
  X,
} from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";

const mainNav = [
  { title: "Search", icon: Search, url: "#" },
  { title: "Home", icon: Home, url: "/motion" },
  { title: "Meetings", icon: Calendar, url: "#" },
  { title: "Notion AI", icon: Sparkles, url: "#" },
  { title: "Inbox", icon: Inbox, url: "#" },
  { title: "Library", icon: Library, url: "#" },
];

const recents = [
  { title: "KEIL HQ", icon: "🏢", time: "7m ago" },
  { title: "Manasvi Agarwal", icon: "💀", time: "15h ago" },
  { title: "Rohan Vashist", icon: "👳", time: "15h ago" },
  { title: "ZEMON TEAM", icon: "🌳", time: "15h ago" },
  { title: "Quild - May Training Plan", icon: "📄", time: "4h ago" },
  { title: "Krishna Kumar", icon: "📄", time: "17h ago" },
  { title: "Ansh Chauhan", icon: "👤", time: "" },
  { title: "Tabish", icon: "💀", time: "" },
  { title: "Arnesh Gupta", icon: "👤", time: "" },
  { title: "PodSoft", icon: "📄", time: "" },
];

const privateItems = [
  { title: "Script", icon: FileText },
  { title: "Software Development Lab", icon: FileText },
];

interface MotionSidebarProps {
  onClose?: () => void;
}

export function MotionSidebar({ onClose }: MotionSidebarProps) {
  const location = useLocation();

  return (
    <Sidebar collapsible="none" className="w-full h-full border-r border-white/5 bg-[#191919] flex flex-col select-none">
      {/* Header - User / Workspace switcher */}
      <SidebarHeader className="px-2 py-3">
        <div className="flex items-center justify-between group">
          <Button variant="ghost" className="h-8 w-full justify-start gap-2 px-2 hover:bg-white/5 text-white/90">
            <div className="size-5 rounded bg-slate-700 flex items-center justify-center text-[10px] font-bold">S</div>
            <span className="text-[13px] font-medium truncate flex-1 text-left">SHIVANG KANDOI's ...</span>
            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <ChevronDown className="size-3.5 text-muted-foreground" />
              <Plus className="size-3.5 text-muted-foreground" />
            </div>
          </Button>
          {onClose && (
            <Button variant="ghost" size="icon" onClick={onClose} className="size-8 md:hidden text-muted-foreground hover:text-white">
              <X className="size-4" />
            </Button>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="flex-1 overflow-y-auto overflow-x-hidden px-2 custom-scrollbar">
        {/* Main Navigation */}
        <SidebarGroup className="p-0 mb-4">
          <SidebarMenu className="gap-0.5">
            {mainNav.map((item) => (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton
                  asChild
                  isActive={location.pathname === item.url}
                  className="h-7 rounded-md px-2 hover:bg-white/5 data-[active=true]:bg-white/10 text-white/70 hover:text-white transition-none"
                >
                  <Link to={item.url} onClick={onClose} className="flex items-center gap-2.5">
                    <item.icon className="size-[15px] shrink-0" />
                    <span className="text-[13px] font-medium">{item.title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>

        {/* Recents Section */}
        <SidebarGroup className="p-0 mb-4">
          <SidebarGroupLabel className="px-2 h-6 text-[11px] font-bold text-white/30 uppercase tracking-tight">
            Recents
          </SidebarGroupLabel>
          <SidebarMenu className="gap-0.5">
            {recents.map((item) => (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton className="h-7 rounded-md px-2 hover:bg-white/5 text-white/70 hover:text-white group transition-none">
                  <div className="flex items-center gap-2.5 w-full">
                    <span className="size-[15px] flex items-center justify-center text-[11px] shrink-0">{item.icon}</span>
                    <span className="text-[13px] font-medium truncate flex-1">{item.title}</span>
                    {item.time && <span className="text-[10px] text-white/20 hidden group-hover:block whitespace-nowrap">{item.time}</span>}
                  </div>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>

        {/* Agents Section */}
        <SidebarGroup className="p-0 mb-4">
          <div className="flex items-center justify-between px-2 h-6 mb-0.5">
            <span className="text-[11px] font-bold text-white/30 uppercase tracking-tight">Agents</span>
            <span className="text-[10px] px-1 bg-white/5 rounded text-white/40 font-bold uppercase tracking-widest scale-75 origin-right">Beta</span>
          </div>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton className="h-7 rounded-md px-2 hover:bg-white/5 text-white/30 hover:text-white/60 transition-none">
                <div className="flex items-center gap-2.5">
                  <Plus className="size-[15px] shrink-0" />
                  <span className="text-[13px] font-medium">New agent</span>
                </div>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>

        {/* Private Section */}
        <SidebarGroup className="p-0 mb-4">
          <SidebarGroupLabel className="px-2 h-6 text-[11px] font-bold text-white/30 uppercase tracking-tight">
            Private
          </SidebarGroupLabel>
          <SidebarMenu className="gap-0.5">
            {privateItems.map((item) => (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton className="h-7 rounded-md px-2 hover:bg-white/5 text-white/70 hover:text-white transition-none group">
                  <div className="flex items-center gap-2.5 w-full">
                    <item.icon className="size-[15px] text-white/30 shrink-0 group-hover:text-white/50" />
                    <span className="text-[13px] font-medium truncate flex-1">{item.title}</span>
                  </div>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      {/* Footer Tools */}
      <div className="p-2 border-t border-white/5">
        <SidebarMenu className="gap-0.5">
          <SidebarMenuItem>
            <SidebarMenuButton className="h-7 rounded-md px-2 hover:bg-white/5 text-white/50 hover:text-white transition-none">
              <Plus className="size-[15px]" />
              <span className="text-[13px] font-medium">Add a page</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton className="h-7 rounded-md px-2 hover:bg-white/5 text-white/50 hover:text-white transition-none">
              <div className="size-[15px] flex items-center justify-center text-[11px]">?</div>
              <span className="text-[13px] font-medium">Help</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </div>

      <style dangerouslySetInnerHTML={{
        __html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: transparent;
          border-radius: 10px;
        }
        .custom-scrollbar:hover::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
        }
      `}} />
    </Sidebar>
  );
}
