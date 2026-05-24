import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { useMotionStore } from "@/store/useMotionStore";
import { Button } from "@/components/ui/button";
import {
  ChevronDown,
  ChevronsRight,
  Loader2,
} from "lucide-react";
import {
  useViewsSummary,
  useViewPermission,
  useSetViewPermission,
  usePageViewers,
  usePageUpdates,
  usePageEditors,
} from "@/hooks/api/useMotionAnalytics";
import { useAppContext } from "@/contexts/AppContext";
import { useMe } from "@/hooks/api/useMe";
import { formatDistanceToNow, parseISO, format } from "date-fns";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface UpdatesAnalyticsDrawerProps {
  pageId: string | null;
  pageTitle: string;
}

export function UpdatesAnalyticsDrawer({ pageId, pageTitle }: UpdatesAnalyticsDrawerProps) {
  const { drawerOpen, drawerTab, setDrawerOpen, setDrawerTab } = useMotionStore();
  const { activeOrgId, activeSpaceId } = useAppContext();
  const { data: me } = useMe();

  const [timeRange, setTimeRange] = useState<7 | 28 | 90 | 365>(28);

  // ─── Query Hooks ────────────────────────────────────────────────────────────

  // Updates Feed (Infinite Scroll)
  const {
    data: updatesData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: isUpdatesLoading,
  } = usePageUpdates(activeOrgId, activeSpaceId, pageId);

  // Views Chart
  const { data: viewsSummary, isLoading: isSummaryLoading } = useViewsSummary(
    activeOrgId,
    activeSpaceId,
    pageId,
    timeRange
  );

  // Permissions Opt-In
  const { data: allowViewHistory = false } = useViewPermission(
    activeOrgId,
    activeSpaceId,
    pageId
  );
  const setViewPermissionMutation = useSetViewPermission(
    activeOrgId,
    activeSpaceId,
    pageId
  );

  // Viewers Directory
  const { data: viewers = [], isLoading: isViewersLoading } = usePageViewers(
    activeOrgId,
    activeSpaceId,
    pageId
  );

  // Editors Directory
  const { data: editors, isLoading: isEditorsLoading } = usePageEditors(
    activeOrgId,
    activeSpaceId,
    pageId
  );

  // ─── Helpers ────────────────────────────────────────────────────────────────

  const getRelativeTime = (dateInput: any) => {
    if (!dateInput) return "";
    try {
      const date = typeof dateInput === "string" ? parseISO(dateInput) : new Date(dateInput);
      return formatDistanceToNow(date, { addSuffix: true });
    } catch {
      return String(dateInput);
    }
  };

  const getAvatarInitials = (name: string | null) => {
    if (!name) return "?";
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return parts[0].substring(0, 2).toUpperCase();
  };

  const getAvatarColor = (userId: string | null) => {
    if (!userId) return "bg-slate-500 text-white";
    const colors = [
      "bg-blue-500 text-white",
      "bg-orange-500 text-white",
      "bg-emerald-500 text-white",
      "bg-indigo-500 text-white",
      "bg-purple-500 text-white",
      "bg-pink-500 text-white",
      "bg-cyan-500 text-white",
      "bg-rose-500 text-white",
      "bg-slate-700 text-white"
    ];
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      hash = userId.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % colors.length;
    return colors[index];
  };

  // Flatten infinite updates pages
  const updates = useMemo(() => {
    return updatesData?.pages.flatMap((page) => page) ?? [];
  }, [updatesData]);

  // Dynamic SVG Area/Line Chart Generation
  const chartProps = useMemo(() => {
    const data = viewsSummary?.chartData ?? [];
    if (data.length === 0) {
      return {
        viewsPath: "",
        viewsAreaPath: "",
        uniquePath: "",
        uniqueAreaPath: "",
        maxVal: 0,
        gridVals: [0, 0, 0, 0, 0],
        dateLabels: [],
      };
    }

    const maxVal = Math.max(...data.map((d) => Math.max(d.views, d.unique_views)), 1);

    const getX = (index: number) => {
      if (data.length <= 1) return 30;
      return 30 + (index / (data.length - 1)) * 280;
    };

    const getY = (val: number) => {
      return 132 - (val / maxVal) * 112;
    };

    const viewsCoords = data.map((d, i) => `${getX(i)},${getY(d.views)}`);
    const viewsPath = data.map((d, i) => `${i === 0 ? "M" : "L"} ${getX(i)} ${getY(d.views)}`).join(" ");
    const viewsAreaPath = viewsCoords.length > 0
      ? `${viewsPath} L ${getX(data.length - 1)} 132 L ${getX(0)} 132 Z`
      : "";

    const uniqueCoords = data.map((d, i) => `${getX(i)},${getY(d.unique_views)}`);
    const uniquePath = data.map((d, i) => `${i === 0 ? "M" : "L"} ${getX(i)} ${getY(d.unique_views)}`).join(" ");
    const uniqueAreaPath = uniqueCoords.length > 0
      ? `${uniquePath} L ${getX(data.length - 1)} 132 L ${getX(0)} 132 Z`
      : "";

    const gridVals = [
      Math.round(maxVal),
      Math.round(maxVal * 0.75),
      Math.round(maxVal * 0.5),
      Math.round(maxVal * 0.25),
      0,
    ];

    const formatDateLabel = (dateStr: string) => {
      try {
        return format(parseISO(dateStr), "MMM d");
      } catch {
        return dateStr;
      }
    };

    // Pick 3 representative dates along the x-axis
    const dateLabels = [
      { text: formatDateLabel(data[0].date), x: 35 },
      { text: formatDateLabel(data[Math.floor(data.length / 2)].date), x: 170 },
      { text: formatDateLabel(data[data.length - 1].date), x: 295 },
    ];

    return {
      viewsPath,
      viewsAreaPath,
      uniquePath,
      uniqueAreaPath,
      maxVal,
      gridVals,
      dateLabels,
    };
  }, [viewsSummary]);

  const rangeLabels = {
    7: "Last 7 Days",
    28: "Last 28 Days",
    90: "Last 90 Days",
    365: "All time",
  };

  if (!pageId) return null;

  return (
    <div
      className={cn(
        "h-full bg-card border-l border-border flex flex-col shrink-0 overflow-hidden drawer-transition select-none",
        drawerOpen ? "w-[400px] opacity-100" : "w-0 opacity-0 border-none"
      )}
    >
      {/* ── Top Header Row ── */}
      <div className="h-12 px-3 border-b border-border/50 flex items-center justify-between shrink-0">
        {/* Left Side: Collapse Arrow */}
        <button
          onClick={() => setDrawerOpen(false)}
          className="p-1 text-muted-foreground/50 hover:text-foreground hover:bg-muted/50 rounded transition-colors cursor-pointer"
          title="Collapse drawer"
        >
          <ChevronsRight className="size-4" />
        </button>

      </div>

      {/* ── Tab Switcher Row ── */}
      <div className="h-10 border-b border-border/50 px-4 flex items-center shrink-0">
        <div className="flex gap-4 h-full relative -bottom-[1px]">
          <button
            onClick={() => setDrawerTab("updates")}
            className={cn(
              "h-full text-[13px] font-semibold transition-colors border-b-2 px-1 relative pb-0.5 cursor-pointer",
              drawerTab === "updates"
                ? "text-foreground border-foreground"
                : "text-muted-foreground border-transparent hover:text-foreground"
            )}
          >
            Updates
          </button>
          <button
            onClick={() => setDrawerTab("analytics")}
            className={cn(
              "h-full text-[13px] font-semibold transition-colors border-b-2 px-1 relative pb-0.5 cursor-pointer",
              drawerTab === "analytics"
                ? "text-foreground border-foreground"
                : "text-muted-foreground border-transparent hover:text-foreground"
            )}
          >
            Analytics
          </button>
        </div>
      </div>

      {/* ── Scrollable Tab Content Container ── */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 flex flex-col min-h-0">
        
        {/* ── UPDATES TAB CONTENT ── */}
        {drawerTab === "updates" && (
          <div className="space-y-6">
            {isUpdatesLoading ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
                <Loader2 className="size-5 animate-spin" />
                <span className="text-xs">Loading updates...</span>
              </div>
            ) : updates.length === 0 ? (
              <div className="text-center py-12 text-xs text-muted-foreground/70">
                No updates yet for this page.
              </div>
            ) : (
              <>
                <div className="space-y-6">
                  {updates.map((update) => {
                    const isMe = me && update.user_id === me.id;
                    const userName = isMe ? "You" : (update.user_name ?? update.user_email ?? "Someone");
                    const hasDiffs = (update.deleted_content && update.deleted_content.length > 0) || 
                                     (update.added_content && update.added_content.length > 0);

                    return (
                      <div key={update.id} className="flex gap-3 text-left">
                        {/* User avatar on the left */}
                        <div className={cn("size-7 rounded-full shrink-0 flex items-center justify-center text-[10px] font-bold shadow-xs", getAvatarColor(update.user_id))}>
                          {getAvatarInitials(update.user_name ?? update.user_email)}
                        </div>

                        {/* Edit metadata & feed block */}
                        <div className="flex-1 min-w-0 space-y-2">
                          <div className="flex flex-col gap-0.5">
                            <div className="text-[12px] text-foreground leading-normal">
                              <span className="font-semibold text-foreground hover:underline cursor-pointer">
                                {userName}
                              </span>
                              <span className="text-muted-foreground font-normal">
                                {" "}{update.description || "updated this page"}{" "}
                              </span>
                              {update.action_type !== "create" && (
                                <span className="font-medium text-foreground hover:underline cursor-pointer">
                                  {pageTitle}
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-muted-foreground/60">{getRelativeTime(update.created_at)}</span>
                          </div>

                          {/* High Fidelity Diffs block */}
                          {update.action_type === "edit" && hasDiffs && (
                            <div className="rounded-lg border border-border/40 bg-muted/20 p-2.5 space-y-1.5 overflow-hidden">
                              {update.deleted_content?.map((text, index) => (
                                <div
                                  key={`del-${index}`}
                                  className="text-[11px] leading-relaxed px-2 py-1 rounded select-text bg-red-500/10 text-red-600 line-through decoration-red-600/40"
                                >
                                  - {text}
                                </div>
                              ))}
                              {update.added_content?.map((text, index) => (
                                <div
                                  key={`add-${index}`}
                                  className="text-[11px] leading-relaxed px-2 py-1 rounded select-text bg-emerald-500/10 text-emerald-600 font-medium"
                                >
                                  + {text}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Load More Button */}
                {hasNextPage && (
                  <Button
                    onClick={() => fetchNextPage()}
                    disabled={isFetchingNextPage}
                    variant="ghost"
                    size="sm"
                    className="w-full text-xs font-semibold text-muted-foreground/60 hover:text-foreground/80 py-2 mt-2 cursor-pointer"
                  >
                    {isFetchingNextPage ? (
                      <Loader2 className="size-3.5 animate-spin mr-1.5 inline" />
                    ) : null}
                    Load older updates
                  </Button>
                )}
                {!hasNextPage && updates.length > 0 && (
                  <div className="text-center py-4 text-[10px] text-muted-foreground/50">
                    No more updates
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── ANALYTICS TAB CONTENT ── */}
        {drawerTab === "analytics" && (
          <div className="space-y-6 text-left pb-4">
            
            {/* 1. Views Area Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-bold text-foreground">
                  Views{" "}
                  <span className="text-muted-foreground font-normal">
                    ({isSummaryLoading ? "..." : `${viewsSummary?.total ?? 0} total`})
                  </span>
                </span>
                
                {/* Date range picker selector */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <div className="flex items-center gap-1.5 cursor-pointer text-muted-foreground hover:text-foreground text-[11px] font-medium border border-border/50 bg-muted/20 hover:bg-muted/40 rounded-md px-2 py-0.5 transition-colors">
                      <span className="size-1.5 rounded-full bg-blue-500"></span>
                      {rangeLabels[timeRange]}
                      <ChevronDown className="size-3 text-muted-foreground/50" />
                    </div>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="p-1 rounded-lg border border-border bg-popover text-[11px] w-32 shadow-md">
                    {([7, 28, 90, 365] as const).map((key) => (
                      <DropdownMenuItem
                        key={key}
                        onClick={() => setTimeRange(key)}
                        className="cursor-pointer px-2 py-1.5 hover:bg-muted rounded text-[11px]"
                      >
                        {rangeLabels[key]}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Area SVG Chart component */}
              <div className="rounded-xl border border-border/40 bg-muted/10 p-2.5">
                {isSummaryLoading ? (
                  <div className="h-[160px] flex items-center justify-center text-muted-foreground/50">
                    <Loader2 className="size-4 animate-spin mr-2" />
                    <span className="text-xs">Loading chart data...</span>
                  </div>
                ) : (
                  <svg viewBox="0 0 320 160" className="w-full h-auto text-muted-foreground select-none">
                    {/* Grid Lines */}
                    <line x1="30" y1="20" x2="310" y2="20" stroke="rgba(0,0,0,0.04)" strokeWidth="0.5" strokeDasharray="3 3" className="dark:stroke-white/5" />
                    <line x1="30" y1="48" x2="310" y2="48" stroke="rgba(0,0,0,0.04)" strokeWidth="0.5" strokeDasharray="3 3" className="dark:stroke-white/5" />
                    <line x1="30" y1="76" x2="310" y2="76" stroke="rgba(0,0,0,0.04)" strokeWidth="0.5" strokeDasharray="3 3" className="dark:stroke-white/5" />
                    <line x1="30" y1="104" x2="310" y2="104" stroke="rgba(0,0,0,0.04)" strokeWidth="0.5" strokeDasharray="3 3" className="dark:stroke-white/5" />
                    <line x1="30" y1="132" x2="310" y2="132" stroke="rgba(0,0,0,0.08)" strokeWidth="0.5" className="dark:stroke-white/10" />
                    
                    {/* Blue Area & Path (Views) */}
                    {chartProps.viewsAreaPath && (
                      <path d={chartProps.viewsAreaPath} fill="rgba(59, 130, 246, 0.08)" />
                    )}
                    {chartProps.viewsPath && (
                      <path
                        d={chartProps.viewsPath}
                        fill="none"
                        stroke="#3b82f6"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    )}
                    
                    {/* Orange Area & Path (Unique Views) */}
                    {chartProps.uniqueAreaPath && (
                      <path d={chartProps.uniqueAreaPath} fill="rgba(245, 158, 11, 0.05)" />
                    )}
                    {chartProps.uniquePath && (
                      <path
                        d={chartProps.uniquePath}
                        fill="none"
                        stroke="#f59e0b"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    )}
                    
                    {/* Y-Axis Labels */}
                    <text x="12" y="23" fontSize="8" fontWeight="500" fill="currentColor" opacity="0.4" textAnchor="end">{chartProps.gridVals[0]}</text>
                    <text x="12" y="51" fontSize="8" fontWeight="500" fill="currentColor" opacity="0.4" textAnchor="end">{chartProps.gridVals[1]}</text>
                    <text x="12" y="79" fontSize="8" fontWeight="500" fill="currentColor" opacity="0.4" textAnchor="end">{chartProps.gridVals[2]}</text>
                    <text x="12" y="107" fontSize="8" fontWeight="500" fill="currentColor" opacity="0.4" textAnchor="end">{chartProps.gridVals[3]}</text>
                    <text x="12" y="135" fontSize="8" fontWeight="500" fill="currentColor" opacity="0.4" textAnchor="end">{chartProps.gridVals[4]}</text>
                    
                    {/* X-Axis Labels */}
                    {chartProps.dateLabels.map((lbl, idx) => (
                      <text
                        key={idx}
                        x={lbl.x}
                        y={148}
                        fontSize="8"
                        fontWeight="500"
                        fill="currentColor"
                        opacity="0.5"
                        textAnchor="middle"
                      >
                        {lbl.text}
                      </text>
                    ))}
                  </svg>
                )}
              </div>
            </div>

            {/* 2. Viewers Section */}
            <div className="space-y-3">
              <span className="text-[12px] font-bold text-foreground block border-b border-border/30 pb-1">
                Viewers
              </span>

              {/* Show view history permissions block */}
              <div className="rounded-xl border border-border/40 bg-muted/20 p-3 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-0.5">
                    <span className="text-[12px] font-semibold text-foreground block">Show your view history</span>
                    <p className="text-[10px] text-muted-foreground leading-normal">
                      Page editors can see your view history for this page.{" "}
                      <a href="#" className="underline hover:text-foreground">Learn more.</a>
                    </p>
                  </div>
                  
                  {/* Allow toggle button dropdown */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={setViewPermissionMutation.isPending}
                        className="h-6 text-[10px] font-bold text-muted-foreground/70 hover:text-foreground hover:bg-muted border border-border/40 px-2 rounded-md transition-colors cursor-pointer"
                      >
                        {allowViewHistory ? "Allowed" : "Don't allow"}
                        <ChevronDown className="size-3 ml-1 text-muted-foreground/50" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="p-1 rounded-lg border border-border bg-popover text-[11px] w-28 shadow-md">
                      <DropdownMenuItem
                        onClick={() => setViewPermissionMutation.mutate(true)}
                        className="cursor-pointer px-2 py-1.5 hover:bg-muted rounded text-[11px] font-medium"
                      >
                        Allow
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => setViewPermissionMutation.mutate(false)}
                        className="cursor-pointer px-2 py-1.5 hover:bg-muted rounded text-[11px] font-medium"
                      >
                        Don't allow
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              {/* Viewers dynamic list */}
              <div className="space-y-3 pt-1">
                {isViewersLoading ? (
                  <div className="flex items-center justify-center py-4 text-muted-foreground gap-1.5 text-xs">
                    <Loader2 className="size-3.5 animate-spin" />
                    <span>Loading viewers...</span>
                  </div>
                ) : viewers.length === 0 ? (
                  <div className="text-[11px] text-muted-foreground/60 py-2 italic">
                    No viewers allowed view history on this page.
                  </div>
                ) : (
                  viewers.map((viewer) => (
                    <div key={viewer.id} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <div className={cn("size-6 rounded-full flex items-center justify-center text-[9px] font-bold shadow-xs", getAvatarColor(viewer.id))}>
                          {getAvatarInitials(viewer.name ?? viewer.email)}
                        </div>
                        <span className="font-semibold text-foreground/80 hover:underline cursor-pointer">
                          {me && viewer.id === me.id ? "You" : (viewer.name ?? viewer.email ?? "Someone")}
                        </span>
                      </div>
                      <span className="text-[10px] text-muted-foreground/60">{getRelativeTime(viewer.last_viewed_at)}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* 3. Editors Section */}
            <div className="space-y-3">
              <span className="text-[12px] font-bold text-foreground block border-b border-border/30 pb-1">
                Editors
              </span>

              {isEditorsLoading ? (
                <div className="flex items-center justify-center py-8 text-muted-foreground gap-1.5 text-xs">
                  <Loader2 className="size-3.5 animate-spin" />
                  <span>Loading editors...</span>
                </div>
              ) : (
                <>
                  {/* Created By details */}
                  {editors?.creator && (
                    <div className="space-y-2">
                      <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider block">Created by</span>
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <div className={cn("size-6 rounded-full flex items-center justify-center text-[9px] font-bold shadow-xs", getAvatarColor(editors.creator.id))}>
                            {getAvatarInitials(editors.creator.name ?? editors.creator.email)}
                          </div>
                          <span className="font-semibold text-foreground/80 hover:underline cursor-pointer">
                            {editors.creator.name ?? editors.creator.email}
                          </span>
                        </div>
                        <span className="text-[10px] text-muted-foreground/60">{getRelativeTime(editors.creator.created_at)}</span>
                      </div>
                    </div>
                  )}

                  {/* Recently Edited By list */}
                  <div className="space-y-2 pt-1">
                    <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider block">Recently edited by</span>
                    {editors?.recent && editors.recent.length > 0 ? (
                      editors.recent.map((editor) => (
                        <div key={editor.id} className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <div className={cn("size-6 rounded-full flex items-center justify-center text-[9px] font-bold shadow-xs", getAvatarColor(editor.id))}>
                              {getAvatarInitials(editor.name ?? editor.email)}
                            </div>
                            <span className="font-semibold text-foreground/80 hover:underline cursor-pointer">
                              {editor.name ?? editor.email}
                            </span>
                          </div>
                          <span className="text-[10px] text-muted-foreground/60">{getRelativeTime(editor.last_edited_at)}</span>
                        </div>
                      ))
                    ) : (
                      <div className="text-[11px] text-muted-foreground/60 italic">
                        No recent edits.
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

          </div>
        )}
      </div>


    </div>
  );
}
