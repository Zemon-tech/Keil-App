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
  Plus,
  Loader2,
  X,
  Mic,
} from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useEffect, useRef, useState } from "react";
import { useAppContext } from "@/contexts/AppContext";
import { cn } from "@/lib/utils";
import { useMeetingHistory, useMeetingSearch } from "@/hooks/api/useMeetings";
import { formatDistanceToNow } from "date-fns";
import { MeetingDialog } from "@/components/MeetingDialog";
import { MeetingReviewDialog } from "@/components/meetings/MeetingReviewDialog";

const mainTabs = [
  { id: "home", title: "Home", icon: Home, url: "/meetings" },
  { id: "search", title: "Search", icon: Search, url: "#" },
];

export function MeetingsSidebar({ onClose }: { onClose?: () => void }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { activeOrgId, activeSpaceId } = useAppContext();

  const [searchMode, setSearchMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [meetingDialogOpen, setMeetingDialogOpen] = useState(false);
  const [reviewRecordingId, setReviewRecordingId] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce search input by 300ms
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchQuery]);

  // Data fetching
  const { data: historyData, isLoading } = useMeetingHistory(1, 30);
  const { data: searchResults } = useMeetingSearch(debouncedQuery);

  const recordings = historyData?.recordings ?? [];
  const displayRecordings = searchMode && debouncedQuery.trim()
    ? (searchResults ?? [])
    : recordings;

  const noContext = !activeOrgId || !activeSpaceId;

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return "0:00";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <>
      <Sidebar collapsible="none" className="w-full h-full border-r border-border bg-card flex flex-col select-none">
        <SidebarHeader className="h-12 justify-center px-3 border-b border-border/40">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {mainTabs.map((tab) => {
              const isActive =
                tab.id === "home"
                  ? location.pathname === "/meetings"
                  : false;

              if (tab.id === "search") {
                return (
                  <Button
                    key={tab.id}
                    variant="ghost"
                    size="sm"
                    onClick={() => setSearchMode(!searchMode)}
                    className={cn(
                      "h-8 px-2.5 rounded-lg transition-all flex items-center gap-2 border border-transparent hover:bg-accent/50",
                      searchMode ? "bg-accent/80 text-foreground border-border/50 shadow-sm" : "text-muted-foreground",
                    )}
                  >
                    <Search className={cn("h-[18px] w-[18px]", searchMode ? "text-foreground" : "text-muted-foreground/80")} />
                    {searchMode && <span className="text-[13px] font-semibold tracking-tight">Search</span>}
                  </Button>
                );
              }

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
                      setSearchMode(false);
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
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMeetingDialogOpen(true)}
              className="h-8 w-8 shrink-0 rounded-full text-muted-foreground hover:bg-accent/50 hover:text-foreground"
              aria-label="New meeting"
            >
              <Plus className="h-[18px] w-[18px]" />
            </Button>
            {onClose && (
              <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 shrink-0 md:hidden text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </SidebarHeader>

        {/* Search input */}
        {searchMode && (
          <div className="px-3 py-2 border-b border-border/40">
            <input
              autoFocus
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search recordings…"
              className="w-full h-8 rounded-lg border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
        )}

        <SidebarContent className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar">
          {noContext ? (
            <div className="px-4 py-8 text-center text-xs text-muted-foreground">
              Select an organisation and space to use Meetings.
            </div>
          ) : isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : displayRecordings.length === 0 ? (
            <div className="px-4 py-8 text-center text-xs text-muted-foreground">
              {searchMode && debouncedQuery.trim()
                ? "No recordings match your search."
                : "No recordings yet. Start a meeting to get going."}
            </div>
          ) : (
            <SidebarGroup>
              <SidebarMenu>
                {displayRecordings.map((recording) => (
                  <SidebarMenuItem key={recording.id}>
                    <SidebarMenuButton
                      className="h-auto py-2 px-3 rounded-lg"
                      tooltip={`Recording · ${formatDuration(recording.audio_duration_seconds)}`}
                      onClick={() => setReviewRecordingId(recording.id)}
                    >
                      <div className="flex items-center gap-3 w-full min-w-0">
                        <div className="h-7 w-7 rounded-md bg-violet-500/10 flex items-center justify-center shrink-0">
                          <Mic className="h-3.5 w-3.5 text-violet-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-medium text-foreground truncate">
                            {formatDuration(recording.audio_duration_seconds)} recording
                          </p>
                          <p className="text-[11px] text-muted-foreground truncate">
                            {formatDistanceToNow(new Date(recording.created_at), { addSuffix: true })}
                          </p>
                        </div>
                        <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                          recording.transcription_status === "completed"
                            ? "bg-emerald-500"
                            : recording.transcription_status === "failed"
                            ? "bg-rose-500"
                            : "bg-amber-500"
                        }`} />
                      </div>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroup>
          )}
        </SidebarContent>
      </Sidebar>

      <MeetingDialog
        open={meetingDialogOpen}
        onOpenChange={setMeetingDialogOpen}
      />

      <MeetingReviewDialog
        open={!!reviewRecordingId}
        onOpenChange={(open) => {
          if (!open) setReviewRecordingId(null);
        }}
        recordingId={reviewRecordingId}
      />
    </>
  );
}
