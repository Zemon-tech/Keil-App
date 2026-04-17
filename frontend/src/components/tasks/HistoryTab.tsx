import { useState } from "react";
import {
  ChevronRight,
  Download,
  FileText,
  Loader2,
  Search,
} from "lucide-react";
import { format, isToday, isYesterday, differenceInDays } from "date-fns";
import { cn } from "@/lib/utils";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";

import type { ActivityLogEntry } from "@/types/task";
import type { TaskDTO } from "@/hooks/api/useTasks";
import { useTaskActivity } from "@/hooks/api/useActivity";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Maps a raw action_type string to a human-readable action past-tense description. */
function getActionDescOnly(entry: ActivityLogEntry): string {
  switch (entry.action_type) {
    case "task_created": return "created task";
    case "status_changed": return "changed status";
    case "priority_changed": return "changed priority";
    case "assignment_added": return "assigned task";
    case "assignment_removed": return "removed assignee";
    case "due_date_changed": return "updated due date";
    case "dependency_added": return "added dependency";
    case "dependency_removed": return "removed dependency";
    case "comment_created": return "added comment";
    case "comment_deleted": return "deleted comment";
    case "objective_updated": return "updated objective";
    case "success_criteria_updated": return "updated success criteria";
    case "title_updated": return "updated title";
    case "description_updated": return "updated description";
    default: return `performed ${entry.action_type}`;
  }
}

/** Legacy overall label for fallback */
function formatActionLabel(entry: ActivityLogEntry): string {
  switch (entry.action_type) {
    case "task_created": return "Task created";
    case "status_changed": return `Status changed from "${entry.old_value?.status}" to "${entry.new_value?.status}"`;
    case "priority_changed": return `Priority changed from "${entry.old_value?.priority}" to "${entry.new_value?.priority}"`;
    case "assignment_added": return "Assigned to a user";
    case "assignment_removed": return "Unassigned a user";
    case "due_date_changed": return "Due date updated";
    case "dependency_added": return "Dependency added";
    case "dependency_removed": return "Dependency removed";
    case "comment_created": return "Comment added";
    case "comment_deleted": return "Comment deleted";
    case "objective_updated": return "Objective updated";
    case "success_criteria_updated": return "Success criteria updated";
    case "title_updated": return "Title updated";
    case "description_updated": return "Description updated";
    default: return entry.action_type;
  }
}

// ─── HistoryTab ───────────────────────────────────────────────────────────────

export function HistoryTab({ task }: { task: TaskDTO }) {
  const { data: entries, isPending } = useTaskActivity(task.id);
  const [filter, setFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredEntries = (entries ?? []).filter((entry) => {
    if (filter === "status" && entry.action_type !== "status_changed") return false;
    if (filter === "fields" && !["title_updated", "description_updated", "due_date_changed", "objective_updated", "success_criteria_updated", "priority_changed"].includes(entry.action_type)) return false;
    if (filter === "people" && !["assignment_added", "assignment_removed"].includes(entry.action_type)) return false;

    if (searchQuery) {
      const searchStr = `${entry.user?.name} ${entry.user?.email} ${formatActionLabel(entry)}`.toLowerCase();
      if (!searchStr.includes(searchQuery.toLowerCase())) return false;
    }

    return true;
  });

  // Group by relative day
  const groupedEntries = filteredEntries.reduce((acc, entry) => {
    const d = new Date(entry.created_at);
    let groupPrefix = "Date";
    if (isToday(d)) groupPrefix = "Today";
    else if (isYesterday(d)) groupPrefix = "Yesterday";
    else groupPrefix = format(d, "MMM d, yyyy");

    const groupKey = (isToday(d) || isYesterday(d)) ? `${groupPrefix} · ${format(d, "MMM d, yyyy")}` : groupPrefix;
    if (!acc[groupKey]) acc[groupKey] = [];
    acc[groupKey].push(entry);
    return acc;
  }, {} as Record<string, typeof filteredEntries>);

  // Summary Metrics
  const totalChanges = (entries ?? []).length;
  const fieldEdits = (entries ?? []).filter(e => ["title_updated", "description_updated", "due_date_changed", "objective_updated", "success_criteria_updated", "priority_changed"].includes(e.action_type)).length;
  const statusChangesCount = (entries ?? []).filter(e => e.action_type === "status_changed").length;
  const taskAge = differenceInDays(new Date(), new Date(task.created_at));

  // Most active users
  const userCounts = (entries ?? []).reduce((acc, entry) => {
    const u = entry.user;
    if (!u) return acc;
    const name = u.name || u.email;
    if (!acc[name]) acc[name] = { count: 0, initials: name.charAt(0).toUpperCase() };
    acc[name].count++;
    return acc;
  }, {} as Record<string, { count: number; initials: string }>);
  const mostActive = Object.entries(userCounts).sort((a, b) => b[1].count - a[1].count).slice(0, 5);

  // Field change log summary
  const fieldLog = {
    dueDate: (entries ?? []).filter(e => e.action_type === "due_date_changed").length,
    priority: (entries ?? []).filter(e => e.action_type === "priority_changed").length,
    assignees: (entries ?? []).filter(e => ["assignment_added", "assignment_removed"].includes(e.action_type)).length,
  };

  return (
    <div className="flex h-full flex-1 min-h-0 flex-col md:flex-row md:divide-x md:divide-border/40 w-full min-w-0 bg-background text-foreground overflow-hidden">
      {/* LEFT: Main History List */}
      <div className="flex flex-1 flex-col min-h-0 min-w-0">
        {/* Top Filter Bar */}
        <div className="px-6 py-4 border-b border-border/40 shrink-0 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
            {["All changes", "Status", "Fields", "People"].map((f) => {
              const fKey = f.split(" ")[0].toLowerCase();
              const isActive = filter === fKey || (f === "All changes" && filter === "all");
              return (
                <button
                  key={f}
                  onClick={() => setFilter(fKey)}
                  className={cn(
                    "px-4 py-1.5 text-[13px] font-semibold rounded-md border transition-colors whitespace-nowrap",
                    isActive
                      ? "bg-muted border-border text-foreground"
                      : "bg-transparent border-border/50 hover:bg-muted/50 text-muted-foreground hover:text-foreground"
                  )}
                >
                  {f}
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search history"
                className="h-9 pl-9 text-sm w-[200px] bg-muted/40 border-border/60 hover:bg-muted/60 transition-colors"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            {/* Download/Export Button Placeholder */}
            <div className="h-9 w-9 flex items-center justify-center rounded-md border border-border/60 bg-transparent hover:bg-muted/50 cursor-pointer text-muted-foreground hover:text-foreground transition-colors">
              <Download className="h-4 w-4" />
            </div>
          </div>
        </div>

        {/* History List */}
        <ScrollArea className="flex-1 min-w-0 min-h-0 bg-accent/20">
          <div className="p-8 max-w-4xl mx-auto w-full">
            {isPending ? (
              <div className="flex justify-center py-10">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : Object.keys(groupedEntries).length > 0 ? (
              <div className="space-y-8">
                {Object.entries(groupedEntries).map(([dateLabel, groupEntries]) => (
                  <div key={dateLabel}>
                    {/* Date separator */}
                    <div className="flex items-center gap-4 mb-5">
                      <div className="flex-1 h-px bg-border/60" />
                      <span className="text-xs font-medium text-muted-foreground px-2">
                        {dateLabel}
                      </span>
                      <div className="flex-1 h-px bg-border/60" />
                    </div>

                    {/* Group entries */}
                    <div className="relative space-y-0 text-foreground">
                      {groupEntries.map((entry, idx) => {
                        const actor = entry.user?.name ?? entry.user?.email ?? "System";
                        const isLast = idx === groupEntries.length - 1;

                        // Action Detail Component Parsing
                        let detailUi = null;
                        if (entry.action_type === "status_changed") {
                          detailUi = (
                            <div className="flex items-center gap-2 mt-2 px-3 py-1.5 bg-background border border-border/50 rounded-full w-fit text-xs font-mono shadow-sm">
                              <span className="opacity-50 line-through">{entry.old_value?.status || "None"}</span>
                              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                              <span className="text-foreground">{entry.new_value?.status}</span>
                            </div>
                          );
                        } else if (entry.action_type === "priority_changed") {
                          detailUi = (
                            <div className="flex items-center gap-2 mt-2 px-3 py-1.5 bg-background border border-border/50 rounded-full w-fit text-xs font-mono shadow-sm">
                              <span className="opacity-50 line-through">{entry.old_value?.priority || "None"}</span>
                              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                              <span className="text-foreground">{entry.new_value?.priority}</span>
                            </div>
                          );
                        } else if (entry.action_type === "description_updated") {
                          detailUi = (
                            <div className="mt-2 text-[14px] text-muted-foreground max-w-xl line-clamp-2 leading-relaxed">
                              {entry.new_value?.description || "Description removed"}
                            </div>
                          );
                        } else if (entry.action_type === "assignment_added") {
                          detailUi = (
                            <div className="flex items-center gap-2 mt-2 px-3 py-1.5 bg-background border border-border/50 rounded-full w-fit text-xs font-medium shadow-sm">
                              <span className="text-indigo-400">Assigned</span>
                              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                              <span className="text-foreground shrink-0">{entry.new_value?.assignment || "New User"}</span>
                            </div>
                          );
                        }

                        const initials = actor.charAt(0).toUpperCase();
                        // Generate consistent static hue based on string to match ui diversity
                        const colorCode = ["bg-indigo-500", "bg-emerald-500", "bg-blue-500", "bg-rose-500", "bg-amber-500"][actor.length % 5];

                        return (
                          <div key={entry.id} className="relative flex items-start gap-4 pb-8 group">
                            {/* Vertical line connecting nodes */}
                            {!isLast && (
                              <div className="absolute left-[17px] top-[36px] bottom-0 w-[2px] bg-border/40" />
                            )}

                            {/* Node Avatar Icon */}
                            <Avatar className="h-9 w-9 shrink-0 border border-border/20 relative z-10 shadow-sm mt-0.5">
                              <AvatarFallback className={cn("text-xs font-semibold text-white", colorCode)}>
                                {initials}
                              </AvatarFallback>
                            </Avatar>

                            {/* Node Content */}
                            <div className="flex-1 min-w-0 pt-1.5 px-2">
                              <div className="flex items-baseline justify-between gap-2">
                                <div className="text-[15px] leading-snug">
                                  <span className="font-semibold text-foreground mr-2">{actor}</span>
                                  <span className="text-muted-foreground/80 font-medium">{getActionDescOnly(entry)}</span>
                                </div>
                                <span className="text-[12px] text-muted-foreground shrink-0 whitespace-nowrap hidden sm:block">
                                  {format(new Date(entry.created_at), "hh:mm a")}
                                </span>
                              </div>

                              {detailUi}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <FileText className="h-10 w-10 text-muted-foreground/30 mb-3" />
                <p className="text-sm font-medium text-foreground">No matching history found.</p>
                <p className="text-xs text-muted-foreground mt-1">Try adjusting your filters or search.</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* RIGHT: Sidebar Summary */}
      <ScrollArea className="w-full h-full shrink-0 md:w-[280px] lg:w-[320px] bg-background border-l border-border/40">
        <div className="space-y-10 p-8">

          {/* Summary Section */}
          <section>
            <h4 className="text-[11px] font-bold tracking-widest text-muted-foreground mb-4 opacity-80 uppercase">Summary</h4>
            <div className="space-y-3">
              <div className="flex justify-between items-center text-[14px]">
                <span className="text-muted-foreground font-medium">Total changes</span>
                <span className="font-mono text-foreground">{totalChanges}</span>
              </div>
              <div className="flex justify-between items-center text-[14px]">
                <span className="text-muted-foreground font-medium">Field edits</span>
                <span className="font-mono text-foreground">{fieldEdits}</span>
              </div>
              <div className="flex justify-between items-center text-[14px]">
                <span className="text-muted-foreground font-medium">Status changes</span>
                <span className="font-mono text-foreground">{statusChangesCount}</span>
              </div>
              <div className="flex justify-between items-center text-[14px]">
                <span className="text-muted-foreground font-medium">Age</span>
                <span className="text-foreground">{taskAge > 0 ? `${taskAge} days` : 'Today'}</span>
              </div>
            </div>
          </section>

          {/* Most Active Section */}
          <section>
            <h4 className="text-[11px] font-bold tracking-widest text-muted-foreground mb-4 opacity-80 uppercase">Most Active</h4>
            <div className="space-y-5">
              {mostActive.length > 0 ? mostActive.map(([name, data]) => {
                const colorCode = ["bg-indigo-500", "bg-emerald-500", "bg-blue-500", "bg-rose-500", "bg-amber-500"][name.length % 5];
                return (
                  <div key={name} className="flex items-center gap-3.5">
                    <Avatar className="h-8 w-8 shrink-0">
                      <AvatarFallback className={cn("text-[10px] font-semibold text-white shadow-sm", colorCode)}>
                        {data.initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-semibold text-foreground leading-none mb-1 truncate">{name}</p>
                      <p className="text-[12px] font-medium text-muted-foreground leading-none">{data.count} changes</p>
                    </div>
                  </div>
                );
              }) : (
                <p className="text-[13px] italic text-muted-foreground">No activity yet</p>
              )}
            </div>
          </section>

          {/* Field Change Log */}
          <section>
            <h4 className="text-[11px] font-bold tracking-widest text-muted-foreground mb-4 opacity-80 uppercase">Field Change Log</h4>
            <div className="space-y-4">
              <div className="flex justify-between items-center text-[14px]">
                <span className="text-muted-foreground font-medium">Due date</span>
                <span className="text-foreground">{fieldLog.dueDate}x changed</span>
              </div>
              <div className="flex justify-between items-center text-[14px]">
                <span className="text-muted-foreground font-medium">Priority</span>
                <span className="text-foreground">{fieldLog.priority}x changed</span>
              </div>
              <div className="flex justify-between items-center text-[14px]">
                <span className="text-muted-foreground font-medium">Assignees</span>
                <span className="text-foreground">{fieldLog.assignees}x changed</span>
              </div>
            </div>
          </section>

        </div>
      </ScrollArea>
    </div>
  );
}
