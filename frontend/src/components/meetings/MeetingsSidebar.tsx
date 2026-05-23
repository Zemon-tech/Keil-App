import { Sidebar, SidebarContent, SidebarGroup, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";
import { Search, Home, Plus, Loader2, X, ChevronDown, ChevronRight, FileText, Trash2, RotateCcw, MoreHorizontal, Pencil } from "lucide-react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useEffect, useRef, useState } from "react";
import { useAppContext } from "@/contexts/AppContext";
import { useAuth } from "@/contexts/AuthContext";
import { useSpaceRole } from "@/hooks/useSpaceRole";
import { cn } from "@/lib/utils";
// Placeholder hooks for meetings API
// import { useMeetings, useCreateMeeting, ... } from "@/hooks/api/useMeetings";

const mainTabs = [
  { id: "home", title: "Home", icon: Home, url: "/meetings" },
  { id: "inbox", title: "Inbox", icon: Search, url: "#" },
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
  item: any;
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
            isActive ? "bg-accent text-accent-foreground" : "hover:bg-accent/50 hover:text-foreground",
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
                to={`/meetings/${item.id}`}
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
                <DropdownMenuContent align="end" className="w-44 rounded-xl p-1">
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

      {isOpen && (
        (item.subpages?.length > 0 ? (
          <div className="mt-px flex flex-col gap-px">
            {item.subpages.map((sub: any) => (
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
        ))
      )}
    </div>
  );
}

export function MeetingsSidebar({ onClose }: { onClose?: () => void }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { meetingId } = useParams(); // placeholder param

  const { activeOrgId, activeSpaceId } = useAppContext();

  // Placeholder data fetching – replace with real hooks
  const meetings = [];
  const trashMeetings = [];
  const sharedMeetings = [];
  const canCreateMeeting = true; // placeholder

  const handleAddMeeting = async () => {
    // placeholder create
    console.log("Add meeting placeholder");
  };

  const handleDeleteMeeting = (id: string, title: string) => {
    console.log("Delete meeting", id);
  };

  const handleRenameMeeting = (id: string, title: string) => {
    console.log("Rename meeting", id, title);
  };

  const noContext = !activeOrgId || !activeSpaceId;

  return (
    <Sidebar collapsible="none" className="w-full h-full border-r border-border bg-card flex flex-col select-none">
      <SidebarHeader className="h-12 justify-center px-3 border-b border-border/40">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {mainTabs.map((tab) => {
            const isActive = location.pathname === tab.url || (tab.id === "home" && location.pathname === "/meetings");
            return (
              <Button
                key={tab.id}
                variant="ghost"
                size="sm"
                asChild
                className={cn(
                  "h-8 px-2.5 rounded-lg transition-all flex items-center gap-2 border border-transparent hover:bg-accent/50",
                  isActive ? "bg-accent/80 text-foreground border-border/50 shadow-sm" : "text-muted-foreground",
                )}
              >
                <Link
                  to={tab.url}
                  onClick={() => {
                    if (window.innerWidth < 1024) onClose?.();
                  }}
                >
                  <tab.icon className={cn("h-[18px] w-[18px]", isActive ? "text-foreground" : "text-muted-foreground/80")} />
                  {isActive && <span className="text-[13px] font-semibold tracking-tight">{tab.title}</span>}
                </Link>
              </Button>
            );
          })}
          <div className="flex-1" />
          {canCreateMeeting && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleAddMeeting}
              className="h-8 w-8 shrink-0 rounded-full text-muted-foreground hover:bg-accent/50 hover:text-foreground"
              aria-label="New meeting"
            >
              <Plus className="h-[18px] w-[18px]" />
            </Button>
          )}
          {onClose && (
            <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 shrink-0 md:hidden text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar">
        {noContext ? (
          <div className="px-4 py-8 text-center text-xs text-muted-foreground">Select an organisation and space to use Meetings.</div>
        ) : (
          <>
            {/* Recents placeholder */}
            <SidebarGroup>
              <SidebarMenu>
                {/* Placeholder for recent meetings */}
                <SidebarMenuItem>Recent meetings placeholder</SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroup>
            {/* Main meetings list placeholder */}
            <SidebarGroup>
              <SidebarMenu>
                <SidebarMenuItem>No meetings yet</SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroup>
          </>
        )}
      </SidebarContent>
    </Sidebar>
  );
}
