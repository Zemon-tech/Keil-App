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
  Inbox,
  ChevronDown,
  ChevronRight,
  Plus,
  FileText,
  X,
  Trash2,
  RotateCcw,
  MoreHorizontal,
  Pencil,
  ChevronsLeft,
  Settings,
  UserPlus,
  Check,
  MessageSquare,
  Sparkles,
  SquarePen,
} from "lucide-react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useMotionStore, type MotionPageRecord } from "@/store/useMotionStore";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const navTabs = [
  { id: "home", title: "Home", icon: Home, url: "/motion" },
  { id: "search", title: "Search", icon: Search, url: "#search" },
  { id: "inbox", title: "Inbox", icon: Inbox, url: "#inbox" },
];

function SidebarPageItem({
  item,
  pageId,
  onClose,
  onDelete,
  onAddSubpage,
  onRename,
  level = 0,
}: {
  item: MotionPageRecord;
  pageId?: string;
  onClose?: () => void;
  onDelete: (id: string) => void;
  onAddSubpage: (parentId: string) => void;
  onRename: (id: string, title: string) => void;
  level?: number;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [draftTitle, setDraftTitle] = useState(item.title);
  const inputRef = useRef<HTMLInputElement>(null);
  const getSubpages = useMotionStore((state) => state.getSubpages);
  const subpages = getSubpages(item.id);
  const hasSubpages = subpages.length > 0;
  const isActive = pageId === item.id;
  const itemPadding = level * 12 + 8;

  useEffect(() => {
    if (isRenaming) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isRenaming]);

  useEffect(() => {
    if (!isRenaming) setDraftTitle(item.title);
  }, [isRenaming, item.title]);

  const finishRename = () => {
    const nextTitle = draftTitle.trim() || "Untitled";
    onRename(item.id, nextTitle);
    setDraftTitle(nextTitle);
    setIsRenaming(false);
  };

  return (
    <div className="flex flex-col w-full">
      <SidebarMenuItem>
        <div
          className={cn(
            "group/item relative flex min-h-9 w-full items-center rounded-lg py-1 text-muted-foreground transition-all duration-200 ease-in-out",
            isActive ? "bg-accent/60 text-accent-foreground font-medium shadow-sm" : "hover:bg-accent/30 hover:text-foreground"
          )}
          style={{ paddingLeft: `${itemPadding}px` }}
        >
          {isRenaming ? (
            <div className="flex min-w-0 flex-1 items-center gap-2 pr-14">
              <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
              <input
                ref={inputRef}
                value={draftTitle}
                onChange={(e) => setDraftTitle(e.target.value)}
                onBlur={finishRename}
                onKeyDown={(e) => {
                  if (e.key === "Enter") finishRename();
                  if (e.key === "Escape") {
                    setDraftTitle(item.title);
                    setIsRenaming(false);
                  }
                }}
                className="h-7 min-w-0 flex-1 rounded-md border border-border bg-background/50 px-2 text-[13px] font-medium text-foreground outline-none ring-1 ring-ring/20 focus:ring-ring/40 transition-all"
              />
            </div>
          ) : (
            <div className="flex min-w-0 flex-1 items-center gap-2 pr-14">
              <span className="relative flex h-5 w-5 shrink-0 items-center justify-center">
                <FileText
                  className={cn(
                    "h-4 w-4 text-muted-foreground transition-opacity group-hover/item:opacity-0",
                    isOpen && "opacity-0"
                  )}
                />
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsOpen(!isOpen);
                  }}
                  className={cn(
                    "absolute inset-0 flex items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:bg-muted-foreground/10 hover:text-foreground group-hover/item:opacity-100",
                    isOpen && "bg-muted-foreground/10 opacity-100"
                  )}
                  aria-label={isOpen ? "Collapse subpages" : "Expand subpages"}
                >
                  {isOpen ? (
                    <ChevronDown className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5" />
                  )}
                </button>
              </span>
              <Link
                to={`/motion/${item.id}`}
                onClick={() => { if (window.innerWidth < 1024) onClose?.(); }}
                className="min-w-0 flex-1 truncate text-[13.5px] font-medium leading-snug transition-colors group-hover/item:text-foreground"
              >
                {item.title}
              </Link>
            </div>
          )}

          <div className="absolute right-1 flex items-center gap-0.5 opacity-0 transition-opacity group-hover/item:opacity-100">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 rounded-md text-muted-foreground/60 hover:bg-accent hover:text-foreground transition-colors"
                  onClick={(e) => e.stopPropagation()}
                  aria-label={`Open ${item.title} menu`}
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44 rounded-xl p-1">
                <DropdownMenuItem
                  className="rounded-lg cursor-pointer gap-2.5 px-2.5 py-2 text-[13px]"
                  onClick={(e) => {
                    e.preventDefault();
                    setIsRenaming(true);
                  }}
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Rename
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="rounded-lg cursor-pointer gap-2.5 px-2.5 py-2 text-[13px]"
                  onClick={(e) => {
                    e.preventDefault();
                    onAddSubpage(item.id);
                    setIsOpen(true);
                  }}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add subpage
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="rounded-lg cursor-pointer gap-2.5 px-2.5 py-2 text-[13px] text-destructive focus:text-destructive"
                  onClick={(e) => {
                    e.preventDefault();
                    onDelete(item.id);
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-md text-muted-foreground/60 hover:bg-accent hover:text-foreground transition-colors"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onAddSubpage(item.id);
                setIsOpen(true);
              }}
              aria-label={`Add subpage to ${item.title}`}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </SidebarMenuItem>

      {isOpen && (
        hasSubpages ? (
          <div className="mt-px flex flex-col gap-px">
            {subpages.map((sub) => (
              <SidebarPageItem
                key={sub.id}
                item={sub}
                pageId={pageId}
                onClose={onClose}
                onDelete={onDelete}
                onAddSubpage={onAddSubpage}
                onRename={onRename}
                level={level + 1}
              />
            ))}
          </div>
        ) : (
          <div
            className="h-7 px-4 text-[11px] font-medium tracking-wide text-muted-foreground/40"
            style={{ marginLeft: `${itemPadding + 20}px` }}
          >
            Empty
          </div>
        )
      )}
    </div>
  );
}

type MotionSidebarProps = {
  onClose?: () => void;
};

export function MotionSidebar({ onClose }: MotionSidebarProps) {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { pageId } = useParams();

  const { 
    pages,
    getRootPages, 
    getTrashPages, 
    addPage, 
    deletePage, 
    updatePage,
    restorePage, 
    permanentlyDeletePage 
  } = useMotionStore();

  const displayName = user?.user_metadata?.full_name || user?.email || "User";
  const initial = displayName.charAt(0).toUpperCase();
  const workspaceName = `${displayName}'s workspace`;

  const rootPages = getRootPages();
  const recentPages = [...pages]
    .filter((page) => !page.isDeleted)
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, 8);
  const trashPages = getTrashPages();
  const [recentsOpen, setRecentsOpen] = useState(true);
  const [privateOpen, setPrivateOpen] = useState(true);
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

  const handleRenamePage = (id: string, title: string) => {
    updatePage(id, { title });
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
    <Sidebar collapsible="none" className="w-full h-full border-r border-border/50 bg-card flex flex-col select-none">
      {/* Header - User / Workspace switcher */}
      <SidebarHeader className="p-3">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {navTabs.map((tab) => {
            const isActive = location.pathname === tab.url || 
                           location.hash === tab.url || 
                           (tab.id === 'home' && location.pathname === '/motion');
            return (
              <Button
                key={tab.id}
                variant="ghost"
                size="sm"
                className={cn(
                  "h-9 px-3 shrink-0 rounded-full transition-all duration-200",
                  isActive 
                    ? "bg-accent/80 text-foreground font-semibold shadow-sm hover:bg-accent" 
                    : "text-muted-foreground hover:bg-accent/40 hover:text-foreground"
                )}
                asChild
              >
                <Link to={tab.url} onClick={() => { if (window.innerWidth < 1024) onClose?.(); }}>
                  <tab.icon className={cn("size-4", tab.id === 'home' && "mr-2")} />
                  {tab.id === 'home' && <span>Home</span>}
                </Link>
              </Button>
            );
          })}
        </div>
      </SidebarHeader>

      <SidebarContent className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar px-2 space-y-4">

        {/* Recents Section */}
        <SidebarGroup className="p-0">
          <div className="flex items-center px-3 mb-1">
            <button
              type="button"
              onClick={() => setRecentsOpen(!recentsOpen)}
              className="flex flex-1 items-center gap-2 text-[11px] font-semibold tracking-wider uppercase text-muted-foreground/60 transition-colors hover:text-foreground/80"
            >
              <div className={cn("transition-transform duration-200", !recentsOpen && "-rotate-90")}>
                <ChevronDown className="h-3 w-3" />
              </div>
              Recents
            </button>
          </div>
          {recentsOpen && (
            <SidebarMenu>
              {recentPages.length > 0 ? (
                recentPages.map((item) => (
                  <SidebarPageItem
                    key={`recent-${item.id}`}
                    item={item}
                    pageId={pageId}
                    onClose={onClose}
                    onDelete={handleDeletePage}
                    onAddSubpage={handleAddPage}
                    onRename={handleRenamePage}
                  />
                ))
              ) : (
                <div className="px-2.5 py-2 text-xs text-muted-foreground">
                  No recent pages
                </div>
              )}
            </SidebarMenu>
          )}
        </SidebarGroup>

        {/* Private Section */}
        <SidebarGroup className="p-0">
          <div className="flex items-center px-3 mb-1 group/section">
            <button
              type="button"
              onClick={() => setPrivateOpen(!privateOpen)}
              className="flex flex-1 items-center gap-2 text-[11px] font-semibold tracking-wider uppercase text-muted-foreground/60 transition-colors hover:text-foreground/80"
            >
              <div className={cn("transition-transform duration-200", !privateOpen && "-rotate-90")}>
                <ChevronDown className="h-3 w-3" />
              </div>
              Private
            </button>
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5 opacity-0 text-muted-foreground/50 hover:bg-accent/50 hover:text-foreground group-hover/section:opacity-100 transition-all rounded"
              onClick={() => handleAddPage()}
              aria-label="Add private page"
            >
              <Plus className="h-3 w-3" />
            </Button>
          </div>
          {privateOpen && (
            <SidebarMenu>
              {rootPages.map((item) => (
                <SidebarPageItem
                  key={item.id}
                  item={item}
                  pageId={pageId}
                  onClose={onClose}
                  onDelete={handleDeletePage}
                  onAddSubpage={handleAddPage}
                  onRename={handleRenamePage}
                />
              ))}
            </SidebarMenu>
          )}
        </SidebarGroup>

        {/* Trash Section */}
        <SidebarGroup className="p-0">
          <div className="px-1">
            <button
              onClick={() => setTrashOpen(!trashOpen)}
              className="flex h-9 w-full items-center gap-2 rounded-lg px-2 text-[13px] font-medium text-muted-foreground transition-all hover:bg-accent/30 hover:text-foreground"
            >
              <div className={cn("transition-transform duration-200", !trashOpen && "-rotate-90")}>
                <ChevronDown className="h-3.5 w-3.5" />
              </div>
              <Trash2 className="h-4 w-4 opacity-70" />
              Trash
            </button>
          </div>
          {trashOpen && (
            <SidebarMenu className="mt-1">
              {trashPages.length > 0 ? (
                trashPages.map((item) => (
                  <SidebarMenuItem key={item.id}>
                    <div className="group/trash flex min-h-8 w-full items-center rounded-md px-2 py-1.5 text-muted-foreground hover:bg-accent/50 hover:text-foreground">
                      <FileText className="mr-2 h-4 w-4 shrink-0" />
                      <span className="flex-1 truncate text-sm font-medium italic line-through">
                        {item.title}
                      </span>
                      <div className="flex items-center gap-1 opacity-0 group-hover/trash:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-muted-foreground hover:bg-muted-foreground/10 hover:text-primary transition-all"
                          onClick={() => handleRestorePage(item.id)}
                          title="Restore"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-muted-foreground hover:bg-muted-foreground/10 hover:text-destructive transition-all"
                          onClick={() => handlePermanentDelete(item.id)}
                          title="Delete permanently"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </SidebarMenuItem>
                ))
              ) : (
                <div className="px-2.5 py-2 text-xs text-muted-foreground">
                  Trash is empty
                </div>
              )}
            </SidebarMenu>
          )}
        </SidebarGroup>
      </SidebarContent>

      <div className="p-4 mt-auto flex items-center gap-2">
        <Button
          onClick={() => handleAddPage()}
          variant="secondary"
          className="flex-1 h-12 justify-between px-4 py-2 bg-accent/30 border border-border/50 hover:bg-accent/50 hover:border-border transition-all rounded-full group"
        >
          <div className="flex items-center gap-3">
            <Sparkles className="size-4.5 text-primary group-hover:scale-110 transition-transform" />
            <span className="text-[15px] font-semibold text-foreground/90">New chat</span>
          </div>
          <div className="hidden sm:flex items-center gap-1 text-[11px] font-bold text-muted-foreground/50 bg-background/50 px-1.5 py-0.5 rounded border border-border/50">
            <span className="text-[9px]">⌘</span>
            <span>O</span>
          </div>
        </Button>
        <Button
          onClick={() => handleAddPage()}
          variant="ghost"
          size="icon"
          className="size-12 shrink-0 bg-accent/30 border border-border/50 hover:bg-accent/50 hover:border-border transition-all rounded-full"
        >
          <SquarePen className="size-5 text-foreground/80" />
        </Button>
      </div>

      <style dangerouslySetInnerHTML={{
        __html: `
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
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
