import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
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
  Loader2,
  SquarePen,
} from "lucide-react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useEffect, useRef, useState } from "react";
import { useAppContext } from "@/contexts/AppContext";
import { useAuth } from "@/contexts/AuthContext";
import { useSpaceRole } from "@/hooks/useSpaceRole";
import { useMotionStore, type MotionPageRecord } from "@/store/useMotionStore";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  useMotionPages,
  useMotionTrash,
  useSharedToSpace,
  useCreateMotionPage,
  useSoftDeleteMotionPage,
  useRestoreMotionPage,
  useHardDeleteMotionPage,
  useUpdateMotionPage,
  useMotionSocketListeners,
} from "@/hooks/api/useMotionPages";

const mainTabs = [
  { id: "home", title: "Home", icon: Home, url: "/motion" },
  { id: "inbox", title: "Inbox", icon: Inbox, url: "#" },
  { id: "search", title: "Search", icon: Search, url: "#" },
];

// ─── SidebarPageItem ──────────────────────────────────────────────────────────

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
  onDelete: (id: string, title: string) => void;
  onAddSubpage: (parentId: string) => void;
  onRename: (id: string, title: string) => void;
  level?: number;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [draftTitle, setDraftTitle] = useState(item.title);
  const inputRef = useRef<HTMLInputElement>(null);

  const { spaceRole, canCreatePage } = useSpaceRole();
  const { user } = useAuth();

  const isPageReadOnly =
    spaceRole === "admin"
      ? false
      : spaceRole === "manager"
        ? item.created_by !== user?.id
        : true;

  const getSubpages = useMotionStore((s) => s.getSubpages);
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
            isActive
              ? "bg-accent text-accent-foreground"
              : "hover:bg-accent/50 hover:text-foreground",
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
                    isOpen && "opacity-0",
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
                    isOpen && "bg-muted-foreground/10 opacity-100",
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
                onClick={() => {
                  if (window.innerWidth < 1024) onClose?.();
                }}
                className="min-w-0 flex-1 truncate text-[13.5px] font-medium leading-snug transition-colors group-hover/item:text-foreground flex items-center gap-2"
              >
                <span className="truncate">{item.title}</span>
              </Link>
            </div>
          )}

          <div className="absolute right-1 flex items-center gap-0.5 opacity-0 transition-opacity group-hover/item:opacity-100">
            {(canCreatePage || !isPageReadOnly) && (
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
                <DropdownMenuContent
                  align="end"
                  className="w-44 rounded-xl p-1"
                >
                  {!isPageReadOnly && (
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
                  )}
                  {canCreatePage && (
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
                  )}
                  {!isPageReadOnly && <DropdownMenuSeparator />}
                  {!isPageReadOnly && (
                    <DropdownMenuItem
                      className="rounded-lg cursor-pointer gap-2.5 px-2.5 py-2 text-[13px] text-destructive focus:text-destructive"
                      onClick={(e) => {
                        e.preventDefault();
                        onDelete(item.id, item.title);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {canCreatePage && (
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
            )}
          </div>
        </div>
      </SidebarMenuItem>

      {isOpen &&
        (hasSubpages ? (
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
        ))}
    </div>
  );
}

// ─── OrgSpaceSwitcher ─────────────────────────────────────────────────────────

// ─── MotionSidebar ────────────────────────────────────────────────────────────

type MotionSidebarProps = {
  onClose?: () => void;
};

export function MotionSidebar({ onClose }: MotionSidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { pageId } = useParams();

  const { activeOrgId, activeSpaceId } = useAppContext();

  // ── API data ────────────────────────────────────────────────────────────────
  const { data: apiPages = [], isLoading: isPagesLoading } = useMotionPages(
    activeOrgId,
    activeSpaceId,
  );
  const { data: trashPages = [] } = useMotionTrash(activeOrgId, activeSpaceId);
  const { data: sharedPages = [] } = useSharedToSpace(
    activeOrgId,
    activeSpaceId,
  );

  const createPage = useCreateMotionPage(activeOrgId, activeSpaceId);
  const softDelete = useSoftDeleteMotionPage(activeOrgId, activeSpaceId);
  const restorePage = useRestoreMotionPage(activeOrgId, activeSpaceId);
  const hardDelete = useHardDeleteMotionPage(activeOrgId, activeSpaceId);
  const updatePage = useUpdateMotionPage(activeOrgId, activeSpaceId);

  const { user } = useAuth();
  const { canCreatePage, spaceRole } = useSpaceRole();

  // ── Real-time ─────────────────────────────────────────────────────────────
  useMotionSocketListeners(
    activeOrgId,
    activeSpaceId,
    pageId ?? null,
    user?.id ?? null,
  );

  // ── Zustand store sync ──────────────────────────────────────────────────────
  const hydratePages = useMotionStore((s) => s.hydratePages);
  const hydratePagesRef = useRef(hydratePages);
  hydratePagesRef.current = hydratePages;

  useEffect(() => {
    hydratePagesRef.current(apiPages);
  }, [apiPages]);

  // ── Derived data ────────────────────────────────────────────────────────────
  const getRootPages = useMotionStore((s) => s.getRootPages);
  const rootPages = getRootPages();
  const recentPages = [...apiPages]
    .filter((p) => !p.deleted_at)
    .sort(
      (a, b) =>
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
    )
    .slice(0, 8);

  // ── UI state ────────────────────────────────────────────────────────────────
  const [recentsOpen, setRecentsOpen] = useState(true);
  const [privateOpen, setPrivateOpen] = useState(true);
  const [trashOpen, setTrashOpen] = useState(false);
  const [sharedOpen, setSharedOpen] = useState(false);

  // ── Handlers ────────────────────────────────────────────────────────────────
  const handleAddPage = async (parentId?: string) => {
    if (!activeOrgId || !activeSpaceId) return;
    const page = await createPage.mutateAsync({ parent_id: parentId ?? null });
    navigate(`/motion/${page.id}`);
    if (window.innerWidth < 1024) onClose?.();
  };

  const handleDeletePage = (id: string, title: string) => {
    softDelete.mutate({ id, title });
    if (pageId === id) navigate("/motion");
  };

  const handleRenamePage = (id: string, title: string) => {
    useMotionStore.getState().updatePageLocally(id, { title });
    updatePage.mutate({ id, updates: { title } });
  };

  const handleRestorePage = (id: string) => {
    restorePage.mutate(id);
  };

  const handlePermanentDelete = (id: string) => {
    if (confirm("Permanently delete this page? This cannot be undone.")) {
      hardDelete.mutate(id);
    }
  };

  const noContext = !activeOrgId || !activeSpaceId;

  return (
    <Sidebar
      collapsible="none"
      className="w-full h-full border-r border-border/50 bg-card flex flex-col select-none"
    >
      {/* ── Header: workspace switcher ── */}
      {/* ── Header: Notion-style Tabs ── */}
      <SidebarHeader className="h-12 justify-center px-3 border-b border-border/40">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {mainTabs.map((tab) => {
            const isActive =
              location.pathname === tab.url ||
              (tab.id === "home" && location.pathname === "/motion");
            return (
              <Button
                key={tab.id}
                variant="ghost"
                size="sm"
                asChild
                className={cn(
                  "h-8 px-2.5 rounded-lg transition-all flex items-center gap-2 border border-transparent hover:bg-accent/50",
                  isActive
                    ? "bg-accent/80 text-foreground border-border/50 shadow-sm"
                    : "text-muted-foreground",
                )}
              >
                <Link
                  to={tab.url}
                  onClick={() => {
                    if (window.innerWidth < 1024) onClose?.();
                  }}
                >
                  <tab.icon
                    className={cn(
                      "h-[18px] w-[18px]",
                      isActive ? "text-foreground" : "text-muted-foreground/80",
                    )}
                  />
                  {isActive && (
                    <span className="text-[13px] font-semibold tracking-tight">
                      {tab.title}
                    </span>
                  )}
                </Link>
              </Button>
            );
          })}
          <div className="flex-1" />

          {canCreatePage && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleAddPage()}
              disabled={createPage.isPending}
              className="h-8 w-8 shrink-0 rounded-full text-muted-foreground hover:bg-accent/50 hover:text-foreground"
              aria-label="New page"
            >
              {createPage.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <SquarePen className="h-[18px] w-[18px]" />
              )}
            </Button>
          )}

          {onClose && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-8 w-8 shrink-0 md:hidden text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar">
        {noContext ? (
          <div className="px-4 py-8 text-center text-xs text-muted-foreground">
            Select an organisation and space to use Motion.
          </div>
        ) : (
          <>
            {/* ── Recents ── */}
            <SidebarGroup>
              <div className="group/section flex h-8 items-center justify-between">
                <button
                  type="button"
                  onClick={() => setRecentsOpen((v) => !v)}
                  className="flex min-w-0 flex-1 items-center gap-1.5 px-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  <div
                    className={cn(
                      "transition-transform duration-200",
                      !recentsOpen && "-rotate-90",
                    )}
                  >
                    <ChevronDown className="h-3 w-3" />
                  </div>
                  Recents
                </button>
              </div>
              {recentsOpen && (
                <SidebarMenu>
                  {isPagesLoading ? (
                    <div className="flex items-center gap-2 px-2.5 py-2 text-xs text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Loading…
                    </div>
                  ) : recentPages.length > 0 ? (
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

            {/* ── Pages (tree) ── */}
            <SidebarGroup>
              <div className="group/section flex h-8 items-center justify-between">
                <button
                  type="button"
                  onClick={() => setPrivateOpen((v) => !v)}
                  className="flex min-w-0 flex-1 items-center gap-1.5 px-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  <div
                    className={cn(
                      "transition-transform duration-200",
                      !privateOpen && "-rotate-90",
                    )}
                  >
                    <ChevronDown className="h-3 w-3" />
                  </div>
                  Pages
                </button>
                {canCreatePage && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 opacity-0 text-muted-foreground hover:bg-muted-foreground/10 hover:text-foreground group-hover/section:opacity-100"
                    onClick={() => handleAddPage()}
                    aria-label="Add page"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
              {privateOpen && (
                <SidebarMenu>
                  {isPagesLoading ? (
                    <div className="flex items-center gap-2 px-2.5 py-2 text-xs text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Loading…
                    </div>
                  ) : rootPages.length > 0 ? (
                    rootPages.map((item) => (
                      <SidebarPageItem
                        key={item.id}
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
                      No pages yet
                    </div>
                  )}
                </SidebarMenu>
              )}
            </SidebarGroup>

            {/* ── Trash ── */}
            <SidebarGroup>
              <button
                onClick={() => setTrashOpen((v) => !v)}
                className="flex h-8 w-full items-center gap-1.5 rounded-md px-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground"
              >
                <div
                  className={cn(
                    "transition-transform duration-200",
                    !trashOpen && "-rotate-90",
                  )}
                >
                  <ChevronDown className="h-3 w-3" />
                </div>
                Trash
              </button>
              {trashOpen && (
                <SidebarMenu className="mt-1">
                  {trashPages.length > 0 ? (
                    trashPages.map((item) => {
                      const isPageReadOnly =
                        spaceRole === "admin"
                          ? false
                          : spaceRole === "manager"
                            ? item.created_by !== user?.id
                            : true;
                      return (
                        <SidebarMenuItem key={item.id}>
                          <div className="group/trash flex min-h-8 w-full items-center rounded-md px-2 py-1.5 text-muted-foreground hover:bg-accent/50 hover:text-foreground">
                            <FileText className="mr-2 h-4 w-4 shrink-0" />
                            <span className="flex-1 truncate text-sm font-medium italic line-through">
                              {item.title}
                            </span>
                            {!isPageReadOnly && (
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
                            )}
                          </div>
                        </SidebarMenuItem>
                      );
                    })
                  ) : (
                    <div className="px-2.5 py-2 text-xs text-muted-foreground">
                      Trash is empty
                    </div>
                  )}
                </SidebarMenu>
              )}
            </SidebarGroup>

            {/* ── Shared with this space ── */}
            {sharedPages.length > 0 && (
              <SidebarGroup>
                <button
                  onClick={() => setSharedOpen((v) => !v)}
                  className="flex h-8 w-full items-center gap-1.5 rounded-md px-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground"
                >
                  <div
                    className={cn(
                      "transition-transform duration-200",
                      !sharedOpen && "-rotate-90",
                    )}
                  >
                    <ChevronDown className="h-3 w-3" />
                  </div>
                  Shared with this space
                </button>
                {sharedOpen && (
                  <SidebarMenu className="mt-1">
                    {sharedPages.map((item) => (
                      <SidebarMenuItem key={item.id}>
                        <SidebarMenuButton
                          asChild
                          isActive={pageId === item.id}
                          className="text-sm font-medium"
                        >
                          <Link
                            to={`/motion/${item.id}`}
                            onClick={() => {
                              if (window.innerWidth < 1024) onClose?.();
                            }}
                          >
                            <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                            <span className="truncate">{item.title}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                )}
              </SidebarGroup>
            )}
          </>
        )}
      </SidebarContent>

      <style
        dangerouslySetInnerHTML={{
          __html: `
          .custom-scrollbar::-webkit-scrollbar { width: 4px; }
          .custom-scrollbar::-webkit-scrollbar-thumb { background: transparent; border-radius: 10px; }
          .custom-scrollbar:hover::-webkit-scrollbar-thumb { background: var(--muted); }
          .no-scrollbar::-webkit-scrollbar { display: none; }
          .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        `,
        }}
      />
    </Sidebar>
  );
}
