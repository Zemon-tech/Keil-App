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
            "group/item relative flex min-h-8 w-full items-center rounded-md py-1.5 text-muted-foreground transition-colors",
            isActive ? "bg-accent text-accent-foreground" : "hover:bg-accent/50 hover:text-foreground"
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
                className="h-6 min-w-0 flex-1 rounded-md border border-border bg-background px-1.5 text-sm font-medium text-foreground outline-none"
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
                className="min-w-0 flex-1 truncate text-sm font-medium leading-snug"
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
                  className="h-6 w-6 text-muted-foreground hover:bg-muted-foreground/10 hover:text-foreground"
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
              className="h-6 w-6 text-muted-foreground hover:bg-muted-foreground/10 hover:text-foreground"
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
            className="h-7 px-2 text-xs font-medium italic leading-7 text-muted-foreground"
            style={{ marginLeft: `${itemPadding + 26}px` }}
          >
            No sub-pages
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
      <SidebarHeader className="px-3 py-2 border-b border-border/50">
        <div className="group/workspace flex h-8 items-center gap-2.5 rounded-lg px-1 text-foreground transition-colors hover:bg-accent/50">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-foreground">
            {initial}
          </div>
          <span className="min-w-0 flex-1 truncate text-sm font-bold tracking-tight">
            {workspaceName}
          </span>
          <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover/workspace:opacity-100">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-md text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
                  aria-label="Open workspace menu"
                >
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" sideOffset={8} className="w-72 rounded-xl p-1">
                <div className="px-2 py-1.5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-xs font-bold text-primary-foreground">
                      {initial}
                    </div>
                    <div className="grid min-w-0 text-left text-sm leading-tight">
                      <div className="truncate text-xs font-semibold text-foreground">
                        {workspaceName}
                      </div>
                      <div className="truncate text-[10px] text-muted-foreground">
                        Free Plan · 1 member
                      </div>
                    </div>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <Button
                      variant="outline"
                      className="h-8 justify-start gap-2 bg-transparent text-xs"
                      onClick={() => navigate("/motion/profile")}
                    >
                      <Settings className="h-4 w-4" />
                      Settings
                    </Button>
                    <Button
                      variant="outline"
                      className="h-8 justify-start gap-2 bg-transparent text-xs"
                    >
                      <UserPlus className="h-4 w-4" />
                      Invite members
                    </Button>
                  </div>
                </div>
                <DropdownMenuSeparator />
                <div className="px-2 py-1.5 text-xs text-muted-foreground">
                  {user?.email || "Motion workspace"}
                </div>
                <DropdownMenuItem
                  onClick={() => navigate("/motion")}
                  className="rounded-lg cursor-pointer gap-2.5 px-2.5 py-2 text-[13px]"
                >
                  <div className="flex h-6 w-6 items-center justify-center rounded bg-primary text-xs font-medium text-primary-foreground">
                    {initial}
                  </div>
                  <span className="min-w-0 flex-1 truncate">{workspaceName}</span>
                  <Check className="h-4 w-4 text-primary" />
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => navigate("/motion/profile")}
                  className="rounded-lg cursor-pointer gap-2.5 px-2.5 py-2 text-[13px]"
                >
                  <div className="flex h-6 w-6 items-center justify-center rounded bg-muted text-xs font-medium text-muted-foreground">
                    M
                  </div>
                  <span className="min-w-0 flex-1 truncate">Motion settings</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="rounded-lg cursor-pointer gap-2.5 px-2.5 py-2 text-[13px] text-primary focus:text-primary">
                  <Plus className="h-4 w-4" />
                  New workspace
                </DropdownMenuItem>
                <DropdownMenuItem className="rounded-lg cursor-pointer gap-2.5 px-2.5 py-2 text-[13px]">Add another account</DropdownMenuItem>
                <DropdownMenuItem className="rounded-lg cursor-pointer gap-2.5 px-2.5 py-2 text-[13px]">Log out</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-md text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
              onClick={onClose}
              aria-label="Collapse sidebar"
            >
              <ChevronsLeft className="h-4 w-4" />
            </Button>
          </div>
          {onClose && (
            <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 md:hidden text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar">
        {/* Main Navigation */}
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarMenu>
            {mainNav.map((item) => (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton
                  asChild
                  isActive={location.pathname === item.url}
                  className="text-sm font-medium"
                >
                  <Link to={item.url} onClick={() => { if (window.innerWidth < 1024) onClose?.(); }}>
                    <item.icon />
                    <span>{item.title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>

        {/* Recents Section */}
        <SidebarGroup>
          <div className="group/section flex h-8 items-center justify-between">
            <button
              type="button"
              onClick={() => setRecentsOpen(!recentsOpen)}
              className="flex min-w-0 flex-1 items-center gap-1.5 px-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {recentsOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
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
        <SidebarGroup>
          <div className="group/section flex h-8 items-center justify-between">
            <button
              type="button"
              onClick={() => setPrivateOpen(!privateOpen)}
              className="flex min-w-0 flex-1 items-center gap-1.5 px-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {privateOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              Private
            </button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 opacity-0 text-muted-foreground hover:bg-muted-foreground/10 hover:text-foreground group-hover/section:opacity-100"
              onClick={() => handleAddPage()}
              aria-label="Add private page"
            >
              <Plus className="h-3.5 w-3.5" />
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
        <SidebarGroup>
          <button
            onClick={() => setTrashOpen(!trashOpen)}
            className="flex h-8 w-full items-center gap-1.5 rounded-md px-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground"
          >
            {trashOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            Trash
          </button>
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

      {/* Footer Tools */}
      <div className="p-2 border-t border-border/50">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={() => handleAddPage()}
              className="text-sm font-medium"
            >
              <Plus />
              <span>Add a page</span>
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
