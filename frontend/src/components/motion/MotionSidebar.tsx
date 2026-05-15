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
  Check,
  Loader2,
} from "lucide-react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useEffect, useRef, useState } from "react";
import { useAppContext } from "@/contexts/AppContext";
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
} from "@/hooks/api/useMotionPages";
import { useSpaces } from "@/hooks/api/useSpaces";

const mainNav = [
  { title: "Home", icon: Home, url: "/motion" },
  { title: "Search", icon: Search, url: "#" },
  { title: "Inbox", icon: Inbox, url: "#" },
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
              : "hover:bg-accent/50 hover:text-foreground"
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
                {item.icon ? <span className="mr-1">{item.icon}</span> : null}
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
                  onClick={(e) => { e.preventDefault(); setIsRenaming(true); }}
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Rename
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="rounded-lg cursor-pointer gap-2.5 px-2.5 py-2 text-[13px]"
                  onClick={(e) => { e.preventDefault(); onAddSubpage(item.id); setIsOpen(true); }}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add subpage
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="rounded-lg cursor-pointer gap-2.5 px-2.5 py-2 text-[13px] text-destructive focus:text-destructive"
                  onClick={(e) => { e.preventDefault(); onDelete(item.id, item.title); }}
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
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onAddSubpage(item.id); setIsOpen(true); }}
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

// ─── OrgSpaceSwitcher ─────────────────────────────────────────────────────────

function OrgSpaceSwitcher() {
  const { organisations, activeOrgId, activeSpaceId, setActiveOrganisation } = useAppContext();
  const [open, setOpen] = useState(false);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-md text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
          aria-label="Switch organisation or space"
        >
          <ChevronDown className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" sideOffset={8} className="w-72 rounded-xl p-1">
        {organisations.length === 0 ? (
          <div className="px-2.5 py-3 text-xs text-muted-foreground text-center">
            No organisations yet
          </div>
        ) : (
          organisations.map((org) => (
            <OrgSpaceGroup
              key={org.id}
              org={org}
              activeOrgId={activeOrgId}
              activeSpaceId={activeSpaceId}
              onSelectSpace={(orgId, spaceId) => {
                setActiveOrganisation(orgId, spaceId);
                setOpen(false);
              }}
            />
          ))
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="rounded-lg cursor-pointer gap-2.5 px-2.5 py-2 text-[13px]"
          onClick={() => setOpen(false)}
        >
          <Settings className="h-3.5 w-3.5" />
          Motion settings
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function OrgSpaceGroup({
  org,
  activeOrgId,
  activeSpaceId,
  onSelectSpace,
}: {
  org: { id: string; name: string };
  activeOrgId: string | null;
  activeSpaceId: string | null;
  onSelectSpace: (orgId: string, spaceId: string) => void;
}) {
  const [expanded, setExpanded] = useState(org.id === activeOrgId);
  const { data: spaces = [], isLoading } = useSpaces(expanded ? org.id : null);
  const isActiveOrg = activeOrgId === org.id;

  return (
    <div>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-[13px] hover:bg-accent/50 transition-colors"
      >
        <div className="h-5 w-5 rounded bg-primary/20 flex items-center justify-center text-[10px] font-bold text-primary shrink-0">
          {org.name.charAt(0).toUpperCase()}
        </div>
        <span className="flex-1 truncate text-left font-medium">{org.name}</span>
        {isActiveOrg && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
        <div className={cn("transition-transform duration-200", !expanded && "-rotate-90")}>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        </div>
      </button>

      {expanded && (
        <div className="ml-4 mt-0.5 mb-1 border-l border-border/50 pl-2">
          {isLoading ? (
            <div className="flex items-center gap-2 py-2 px-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              Loading spaces…
            </div>
          ) : spaces.length === 0 ? (
            <div className="py-2 px-2 text-xs text-muted-foreground">No spaces</div>
          ) : (
            spaces.map((space) => {
              const isActive = isActiveOrg && activeSpaceId === space.id;
              return (
                <button
                  key={space.id}
                  type="button"
                  onClick={() => onSelectSpace(org.id, space.id)}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[13px] hover:bg-accent/50 transition-colors"
                >
                  <span className="flex-1 truncate text-left">{space.name}</span>
                  {isActive && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

// ─── MotionSidebar ────────────────────────────────────────────────────────────

type MotionSidebarProps = {
  onClose?: () => void;
};

export function MotionSidebar({ onClose }: MotionSidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { pageId } = useParams();

  const { activeOrgId, activeSpaceId, activeOrg, activeSpace, mode } = useAppContext();

  // ── API data ────────────────────────────────────────────────────────────────
  const { data: apiPages = [], isLoading: isPagesLoading } = useMotionPages(activeOrgId, activeSpaceId);
  const { data: trashPages = [] } = useMotionTrash(activeOrgId, activeSpaceId);
  const { data: sharedPages = [] } = useSharedToSpace(activeOrgId, activeSpaceId);

  const createPage = useCreateMotionPage(activeOrgId, activeSpaceId);
  const softDelete = useSoftDeleteMotionPage(activeOrgId, activeSpaceId);
  const restorePage = useRestoreMotionPage(activeOrgId, activeSpaceId);
  const hardDelete = useHardDeleteMotionPage(activeOrgId, activeSpaceId);
  const updatePage = useUpdateMotionPage(activeOrgId, activeSpaceId);

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
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    .slice(0, 8);

  // ── UI state ────────────────────────────────────────────────────────────────
  const [recentsOpen, setRecentsOpen] = useState(true);
  const [privateOpen, setPrivateOpen] = useState(true);
  const [trashOpen, setTrashOpen] = useState(false);
  const [sharedOpen, setSharedOpen] = useState(false);

  // ── Workspace label ─────────────────────────────────────────────────────────
  const workspaceLabel =
    activeSpace?.name && activeOrg?.name
      ? `${activeOrg.name} · ${activeSpace.name}`
      : activeOrg?.name ?? "Select a workspace";
  const workspaceInitial = (activeOrg?.name ?? "?").charAt(0).toUpperCase();

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

  const noContext = mode !== "organisation" || !activeOrgId || !activeSpaceId;

  return (
    <Sidebar collapsible="none" className="w-full h-full border-r border-border/50 bg-card flex flex-col select-none">
      {/* ── Header: workspace switcher ── */}
      <SidebarHeader className="px-3 py-2 border-b border-border/50">
        <div className="group/workspace flex h-8 items-center gap-2.5 rounded-lg px-1 text-foreground transition-colors hover:bg-accent/50">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-foreground">
            {workspaceInitial}
          </div>
          <span className="min-w-0 flex-1 truncate text-sm font-bold tracking-tight">
            {workspaceLabel}
          </span>
          <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover/workspace:opacity-100">
            <OrgSpaceSwitcher />
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
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-8 w-8 md:hidden text-muted-foreground hover:text-foreground"
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
            {/* ── Main Navigation ── */}
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

            {/* ── Recents ── */}
            <SidebarGroup>
              <div className="group/section flex h-8 items-center justify-between">
                <button
                  type="button"
                  onClick={() => setRecentsOpen((v) => !v)}
                  className="flex min-w-0 flex-1 items-center gap-1.5 px-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  <div className={cn("transition-transform duration-200", !recentsOpen && "-rotate-90")}>
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
                    <div className="px-2.5 py-2 text-xs text-muted-foreground">No recent pages</div>
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
                  <div className={cn("transition-transform duration-200", !privateOpen && "-rotate-90")}>
                    <ChevronDown className="h-3 w-3" />
                  </div>
                  Pages
                </button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 opacity-0 text-muted-foreground hover:bg-muted-foreground/10 hover:text-foreground group-hover/section:opacity-100"
                  onClick={() => handleAddPage()}
                  aria-label="Add page"
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
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
                    <div className="px-2.5 py-2 text-xs text-muted-foreground">No pages yet</div>
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
                <div className={cn("transition-transform duration-200", !trashOpen && "-rotate-90")}>
                  <ChevronDown className="h-3 w-3" />
                </div>
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
                    <div className="px-2.5 py-2 text-xs text-muted-foreground">Trash is empty</div>
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
                  <div className={cn("transition-transform duration-200", !sharedOpen && "-rotate-90")}>
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
                            onClick={() => { if (window.innerWidth < 1024) onClose?.(); }}
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

      {/* ── Footer: add page ── */}
      {!noContext && (
        <div className="p-2 border-t border-border/50">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={() => handleAddPage()}
                className="text-sm font-medium"
                disabled={createPage.isPending}
              >
                {createPage.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus />
                )}
                <span>Add a page</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </div>
      )}

      <style
        dangerouslySetInnerHTML={{
          __html: `
          .custom-scrollbar::-webkit-scrollbar { width: 4px; }
          .custom-scrollbar::-webkit-scrollbar-thumb { background: transparent; border-radius: 10px; }
          .custom-scrollbar:hover::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); }
        `,
        }}
      />
    </Sidebar>
  );
}
