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
  ChevronRight,
  Plus,
  FileText,
  X,
  Trash2,
  RotateCcw,
} from "lucide-react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useMotionStore, type MotionPageRecord } from "@/store/useMotionStore";

const mainNav = [
  { title: "Search", icon: Search, url: "#" },
  { title: "Home", icon: Home, url: "/motion" },
  { title: "Inbox", icon: Inbox, url: "#" },
];

function SidebarPageItem({
  item,
  pageId,
  onClose,
  onDelete,
  onAddSubpage,
  level = 0,
}: {
  item: MotionPageRecord;
  pageId?: string;
  onClose?: () => void;
  onDelete: (id: string) => void;
  onAddSubpage: (parentId: string) => void;
  level?: number;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const getSubpages = useMotionStore((state) => state.getSubpages);
  const subpages = getSubpages(item.id);
  const hasSubpages = subpages.length > 0;

  return (
    <div className="flex flex-col w-full">
      <div className="flex items-center group/item w-full px-0 relative">
        <div
          className="absolute left-0 top-0 bottom-0 w-0.5 bg-primary/20 opacity-0 group-hover/item:opacity-100 transition-opacity"
          style={{ marginLeft: `${level * 12}px` }}
        />
        <SidebarMenuButton
          asChild
          isActive={pageId === item.id}
          className="h-8 rounded-md hover:bg-white/5 data-[active=true]:bg-white/10 text-foreground/70 hover:text-foreground transition-none group flex-1"
          style={{ paddingLeft: `${level * 12 + 12}px` }}
        >
          <div className="flex items-center gap-1.5 w-full pr-12">
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsOpen(!isOpen);
              }}
              className="size-4 flex items-center justify-center hover:bg-white/10 rounded transition-colors"
            >
              {hasSubpages ? (
                isOpen ? (
                  <ChevronDown className="size-3" />
                ) : (
                  <ChevronRight className="size-3" />
                )
              ) : (
                <div className="size-3" />
              )}
            </button>
            <Link
              to={`/motion/${item.id}`}
              onClick={() => { if (window.innerWidth < 1024) onClose?.(); }}
              className="flex items-center gap-2 flex-1 truncate"
            >
              <FileText className="size-3.5 text-foreground/30 shrink-0 group-hover:text-foreground/50" />
              <span className="text-xs font-medium truncate">{item.title}</span>
            </Link>
          </div>
        </SidebarMenuButton>
        <div className="absolute right-1 flex items-center opacity-0 group-hover/item:opacity-100 transition-opacity">
          <Button
            variant="ghost"
            size="icon"
            className="size-6 hover:bg-white/10 text-muted-foreground hover:text-foreground transition-all"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onAddSubpage(item.id);
            }}
          >
            <Plus className="size-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-6 hover:bg-white/10 text-muted-foreground hover:text-destructive transition-all"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onDelete(item.id);
            }}
          >
            <Trash2 className="size-3" />
          </Button>
        </div>
      </div>
      {isOpen && hasSubpages && (
        <div className="flex flex-col">
          {subpages.map((sub) => (
            <SidebarPageItem
              key={sub.id}
              item={sub}
              pageId={pageId}
              onClose={onClose}
              onDelete={onDelete}
              onAddSubpage={onAddSubpage}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function MotionSidebar({ onClose }: MotionSidebarProps) {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { pageId } = useParams();

  const { 
    getRootPages, 
    getTrashPages, 
    addPage, 
    deletePage, 
    restorePage, 
    permanentlyDeletePage 
  } = useMotionStore();

  const displayName = user?.user_metadata?.full_name || user?.email || "User";
  const initial = displayName.charAt(0).toUpperCase();

  const rootPages = getRootPages();
  const trashPages = getTrashPages();
  const [trashOpen, setTrashOpen] = useState(false);

  const handleAddPage = (parentId?: string) => {
    const page = addPage({ parentId });
    navigate(`/motion/${page.id}`);
    if (window.innerWidth < 1024) onClose?.();
  };

  const handleDeletePage = (id: string) => {
    deletePage(id);
    if (pageId === id) {
      navigate("/motion");
    }
  };

  const handleRestorePage = (id: string) => {
    restorePage(id);
  };

  const handlePermanentDelete = (id: string) => {
    if (confirm("Permanently delete this page? This cannot be undone.")) {
      permanentlyDeletePage(id);
    }
  };

  return (
    <Sidebar collapsible="none" className="w-full h-full border-r border-border bg-muted/30 flex flex-col select-none">
      {/* Header - User / Workspace switcher */}
      <SidebarHeader className="px-3 py-4">
        <div className="flex items-center justify-between group">
          <Button 
            variant="ghost" 
            className="h-10 w-full justify-start gap-3 px-3 hover:bg-white/5 text-foreground/90"
            onClick={() => {
              navigate("/motion/profile");
              if (window.innerWidth < 1024) onClose?.();
            }}
          >
            <div className="size-6 rounded bg-muted flex items-center justify-center text-[11px] font-bold">{initial}</div>
            <span className="text-sm font-medium truncate flex-1 text-left">{displayName}'s ...</span>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <Plus 
                className="size-4 text-muted-foreground hover:text-foreground transition-colors" 
                onClick={(e) => {
                  e.stopPropagation();
                  handleAddPage();
                }} 
              />
              <ChevronDown className="size-4 text-muted-foreground" />
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
                  <Link to={item.url} onClick={() => { if (window.innerWidth < 1024) onClose?.(); }} className="flex items-center gap-3">
                    <item.icon className="size-4 shrink-0" />
                    <span className="text-sm font-medium">{item.title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>

        {/* Private Section */}
        <SidebarGroup className="p-0 mb-4">
          <SidebarGroupLabel className="px-3 h-8 text-xs font-bold text-foreground/30 uppercase tracking-tight">
            Private
          </SidebarGroupLabel>
          <SidebarMenu className="gap-0.5">
            {rootPages.map((item) => (
              <SidebarPageItem
                key={item.id}
                item={item}
                pageId={pageId}
                onClose={onClose}
                onDelete={handleDeletePage}
                onAddSubpage={handleAddPage}
              />
            ))}
          </SidebarMenu>
        </SidebarGroup>

        {/* Trash Section */}
        <SidebarGroup className="p-0 mb-4">
          <button
            onClick={() => setTrashOpen(!trashOpen)}
            className="flex items-center gap-2 px-3 h-8 w-full text-xs font-bold text-foreground/30 hover:text-foreground/50 uppercase tracking-tight transition-colors"
          >
            {trashOpen ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
            Trash
          </button>
          {trashOpen && (
            <SidebarMenu className="gap-0.5 mt-1">
              {trashPages.length > 0 ? (
                trashPages.map((item) => (
                  <SidebarMenuItem key={item.id}>
                    <div className="flex items-center group/trash w-full px-3 h-8 hover:bg-white/5 rounded-md">
                      <FileText className="size-3.5 text-foreground/20 shrink-0 mr-3" />
                      <span className="text-xs font-medium text-foreground/40 truncate flex-1 italic line-through">
                        {item.title}
                      </span>
                      <div className="flex items-center gap-1 opacity-0 group-hover/trash:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-6 hover:bg-white/10 text-muted-foreground hover:text-primary transition-all"
                          onClick={() => handleRestorePage(item.id)}
                          title="Restore"
                        >
                          <RotateCcw className="size-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-6 hover:bg-white/10 text-muted-foreground hover:text-destructive transition-all"
                          onClick={() => handlePermanentDelete(item.id)}
                          title="Delete permanently"
                        >
                          <Trash2 className="size-3" />
                        </Button>
                      </div>
                    </div>
                  </SidebarMenuItem>
                ))
              ) : (
                <div className="px-8 py-2 text-[10px] text-muted-foreground/30 italic">
                  Trash is empty
                </div>
              )}
            </SidebarMenu>
          )}
        </SidebarGroup>
      </SidebarContent>

      {/* Footer Tools */}
      <div className="p-3 border-t border-border">
        <SidebarMenu className="gap-1">
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={() => handleAddPage()}
              className="h-9 rounded-md px-3 hover:bg-white/5 text-foreground/50 hover:text-foreground transition-none"
            >
              <Plus className="size-4" />
              <span className="text-sm font-medium">Add a page</span>
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
