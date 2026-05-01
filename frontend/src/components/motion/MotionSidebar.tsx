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
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useEffect, useMemo, useState } from "react";
import {
  createMotionPage,
  getAllMotionPages,
  type MotionPageRecord,
} from "./motionStorage";

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

interface MotionSidebarProps {
  onClose?: () => void;
}

export function MotionSidebar({ onClose }: MotionSidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { pageId } = useParams();

  const [pages, setPages] = useState<MotionPageRecord[]>([]);

  useEffect(() => {
    const refresh = () => setPages(getAllMotionPages());
    refresh();

    const onStorage = (e: StorageEvent) => {
      if (e.key === "motion.pages.v1") refresh();
    };

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const privateItems = useMemo(
    () =>
      pages.map((p) => ({
        id: p.id,
        title: p.title,
        icon: FileText,
        url: `/motion/${p.id}`,
      })),
    [pages]
  );

  const handleAddPage = () => {
    const page = createMotionPage();
    setPages(getAllMotionPages());
    navigate(`/motion/${page.id}`);
    onClose?.();
  };

  return (
    <Sidebar collapsible="none" className="w-full h-full border-r border-border bg-muted/30 flex flex-col select-none">
      {/* Header - User / Workspace switcher */}
      <SidebarHeader className="px-3 py-4">
        <div className="flex items-center justify-between group">
          <Button variant="ghost" className="h-10 w-full justify-start gap-3 px-3 hover:bg-white/5 text-foreground/90">
            <div className="size-6 rounded bg-muted flex items-center justify-center text-[11px] font-bold">S</div>
            <span className="text-sm font-medium truncate flex-1 text-left">SHIVANG KANDOI's ...</span>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <ChevronDown className="size-4 text-muted-foreground" />
              <Plus className="size-4 text-muted-foreground" />
            </div>
          </Button>
          {onClose && (
            <Button variant="ghost" size="icon" onClick={onClose} className="size-8 md:hidden text-muted-foreground hover:text-foreground">
              <X className="size-4" />
            </Button>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="flex-1 overflow-y-auto overflow-x-hidden px-3 custom-scrollbar">
        {/* Main Navigation */}
        <SidebarGroup className="p-0 mb-4">
          <SidebarMenu className="gap-0.5">
            {mainNav.map((item) => (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton
                  asChild
                  isActive={location.pathname === item.url}
                  className="h-9 rounded-md px-3 hover:bg-white/5 data-[active=true]:bg-white/10 text-foreground/70 hover:text-foreground transition-none"
                >
                  <Link to={item.url} onClick={onClose} className="flex items-center gap-3">
                    <item.icon className="size-4 shrink-0" />
                    <span className="text-sm font-medium">{item.title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>

        {/* Recents Section */}
        <SidebarGroup className="p-0 mb-4">
          <SidebarGroupLabel className="px-3 h-8 text-xs font-bold text-foreground/30 uppercase tracking-tight">
            Recents
          </SidebarGroupLabel>
          <SidebarMenu className="gap-1">
            {recents.map((item) => (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton className="h-9 rounded-md px-3 hover:bg-white/5 text-foreground/70 hover:text-foreground group transition-none">
                  <div className="flex items-center gap-3 w-full">
                    <span className="size-4 flex items-center justify-center text-xs shrink-0">{item.icon}</span>
                    <span className="text-sm font-medium truncate flex-1">{item.title}</span>
                    {item.time && <span className="text-xs text-foreground/20 hidden group-hover:block whitespace-nowrap">{item.time}</span>}
                  </div>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>

        {/* Agents Section */}
        <SidebarGroup className="p-0 mb-4">
          <div className="flex items-center justify-between px-3 h-8 mb-1">
            <span className="text-xs font-bold text-foreground/30 uppercase tracking-tight">Agents</span>
            <span className="text-xs px-1.5 bg-white/5 rounded text-foreground/40 font-bold uppercase tracking-widest scale-90 origin-right">Beta</span>
          </div>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton className="h-9 rounded-md px-3 hover:bg-white/5 text-foreground/30 hover:text-foreground/60 transition-none">
                <div className="flex items-center gap-3">
                  <Plus className="size-4 shrink-0" />
                  <span className="text-sm font-medium">New agent</span>
                </div>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>

        {/* Private Section */}
        <SidebarGroup className="p-0 mb-4">
          <SidebarGroupLabel className="px-3 h-8 text-xs font-bold text-foreground/30 uppercase tracking-tight">
            Private
          </SidebarGroupLabel>
          <SidebarMenu className="gap-1">
            {privateItems.map((item) => (
              <SidebarMenuItem key={item.id}>
                <SidebarMenuButton
                  asChild
                  isActive={pageId === item.id}
                  className="h-9 rounded-md px-3 hover:bg-white/5 data-[active=true]:bg-white/10 text-foreground/70 hover:text-foreground transition-none group"
                >
                  <Link to={item.url} onClick={onClose} className="flex items-center gap-3 w-full">
                    <item.icon className="size-4 text-foreground/30 shrink-0 group-hover:text-foreground/50" />
                    <span className="text-sm font-medium truncate flex-1">{item.title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      {/* Footer Tools */}
      <div className="p-3 border-t border-border">
        <SidebarMenu className="gap-1">
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={handleAddPage}
              className="h-9 rounded-md px-3 hover:bg-white/5 text-foreground/50 hover:text-foreground transition-none"
            >
              <Plus className="size-4" />
              <span className="text-sm font-medium">Add a page</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton className="h-9 rounded-md px-3 hover:bg-white/5 text-foreground/50 hover:text-foreground transition-none">
              <div className="size-4 flex items-center justify-center text-xs">?</div>
              <span className="text-sm font-medium">Help</span>
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
