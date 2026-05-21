import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  ClipboardCheck,
  Clock,
  AlertCircle,
  ExternalLink,
  Search,
  Filter,
  X,
  Briefcase,
  Layers,
  Calendar,
  CheckCircle2,
  ListTodo,
  TrendingUp,
} from "lucide-react";
import { useMyTasks, type MyTaskDTO, type MyTasksFilters } from "@/hooks/api/useMyTasks";
import { useOrganisations } from "@/hooks/api/useOrganisations";
import { useAppContext } from "@/contexts/AppContext";
import { cn } from "@/lib/utils";

// Curated harmonious styling helpers for Status & Priority pills
const STATUS_STYLES: Record<string, { label: string; bg: string; text: string; border: string }> = {
  backlog: { label: "Backlog", bg: "bg-slate-500/10", text: "text-slate-400", border: "border-slate-500/20" },
  todo: { label: "To Do", bg: "bg-indigo-500/10", text: "text-indigo-400", border: "border-indigo-500/20" },
  "in-progress": { label: "In Progress", bg: "bg-amber-500/10", text: "text-amber-400", border: "border-amber-500/20" },
  "in-review": { label: "In Review", bg: "bg-purple-500/10", text: "text-purple-400", border: "border-purple-500/20" },
  done: { label: "Done", bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/20" },
  cancelled: { label: "Cancelled", bg: "bg-rose-500/10", text: "text-rose-400", border: "border-rose-500/20" },
};

const PRIORITY_STYLES: Record<string, { label: string; bg: string; text: string; border: string }> = {
  low: { label: "Low", bg: "bg-zinc-500/10", text: "text-zinc-400", border: "border-zinc-500/20" },
  medium: { label: "Medium", bg: "bg-blue-500/10", text: "text-blue-400", border: "border-blue-500/20" },
  high: { label: "High", bg: "bg-orange-500/10", text: "text-orange-400", border: "border-orange-500/20" },
  urgent: { label: "Urgent", bg: "bg-rose-500/10", text: "text-rose-400", border: "border-rose-500/20" },
};

export function MyTasksPage() {
  const navigate = useNavigate();
  const { setActiveOrganisation } = useAppContext();
  const { data: organisations = [] } = useOrganisations();

  // State filters
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedPriority, setSelectedPriority] = useState<string>("all");
  const [selectedOrgId, setSelectedOrgId] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");

  // Memoize actual filters to pass to useMyTasks hook
  const activeFilters = useMemo((): MyTasksFilters => {
    const apiFilters: MyTasksFilters = {};
    if (selectedStatus !== "all") {
      apiFilters.status = selectedStatus as any;
    }
    if (selectedPriority !== "all") {
      apiFilters.priority = selectedPriority as any;
    }
    if (selectedOrgId !== "all") {
      apiFilters.org_id = selectedOrgId;
    }
    return apiFilters;
  }, [selectedStatus, selectedPriority, selectedOrgId]);

  // Fetch aggregate cross-org assigned active tasks
  const { data: tasks = [], isLoading } = useMyTasks(activeFilters);

  // Client-side text search filter
  const filteredTasks = useMemo(() => {
    if (!searchTerm.trim()) return tasks;
    const term = searchTerm.toLowerCase();
    return tasks.filter((t) => t.title.toLowerCase().includes(term));
  }, [tasks, searchTerm]);

  // Task navigation redirect handler
  const handleOpenTask = (task: MyTaskDTO) => {
    // Switch the active organisation and active space contexts
    setActiveOrganisation(task.org_id, task.space_id);
    
    // Navigate directly to the corresponding interactive page
    navigate(`/tasks/${task.id}`);
  };

  // Stats derivation
  const stats = useMemo(() => {
    let total = tasks.length;
    let overdue = 0;
    let highOrUrgent = 0;
    let inProgress = 0;

    const now = new Date();
    now.setHours(0, 0, 0, 0);

    tasks.forEach((t) => {
      // Overdue check
      if (t.status !== "done" && t.status !== "cancelled" && t.due_date) {
        const dueDate = new Date(t.due_date);
        dueDate.setHours(0, 0, 0, 0);
        if (dueDate < now) overdue++;
      }
      // Critical check
      if (t.priority === "high" || t.priority === "urgent") {
        highOrUrgent++;
      }
      // Progress check
      if (t.status === "in-progress" || t.status === "in-review") {
        inProgress++;
      }
    });

    return { total, overdue, highOrUrgent, inProgress };
  }, [tasks]);

  // Helper to format due dates beautifully with overdue warnings
  const formatDueDate = (dateStr: string | null, status: string) => {
    if (!dateStr) return { text: "No due date", isOverdue: false, isDueToday: false };
    
    const dueDate = new Date(dateStr);
    const now = new Date();
    
    // Reset hours for fair day-by-day comparison
    const dueTime = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate()).getTime();
    const todayTime = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    
    const diffTime = dueTime - todayTime;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    const isCompleted = status === "done" || status === "cancelled";
    
    const options: React.ComponentProps<typeof Calendar> extends any ? Intl.DateTimeFormatOptions : any = { 
      month: "short", 
      day: "numeric", 
      year: "numeric" 
    };
    const formatted = dueDate.toLocaleDateString(undefined, options);

    if (isCompleted) {
      return { text: `Due: ${formatted}`, isOverdue: false, isDueToday: false };
    }

    if (diffDays < 0) {
      const days = Math.abs(diffDays);
      return { 
        text: `Overdue by ${days} day${days > 1 ? "s" : ""}`, 
        isOverdue: true, 
        isDueToday: false 
      };
    } else if (diffDays === 0) {
      return { text: "Due today", isOverdue: false, isDueToday: true };
    } else if (diffDays === 1) {
      return { text: "Due tomorrow", isOverdue: false, isDueToday: false };
    } else if (diffDays <= 7) {
      return { text: `Due in ${diffDays} days (${formatted})`, isOverdue: false, isDueToday: false };
    }

    return { text: `Due: ${formatted}`, isOverdue: false, isDueToday: false };
  };

  const handleResetFilters = () => {
    setSelectedStatus("all");
    setSelectedPriority("all");
    setSelectedOrgId("all");
    setSearchTerm("");
  };

  return (
    <div className="relative h-dvh w-full bg-background text-foreground overflow-hidden">
      {/* Sleek background design accents */}
      <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-primary/5 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-10 left-10 w-[300px] h-[300px] bg-indigo-500/5 rounded-full blur-[80px] pointer-events-none" />

      {/* Scrollable Container */}
      <div className="h-full w-full overflow-y-auto custom-scrollbar-page pb-20">
        <div className="max-w-6xl mx-auto px-6 pt-8 relative z-10 space-y-8">
        
        {/* ─── Header ───────────────────────────────────────────────────────────── */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/40 pb-6">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <Layers className="h-3.5 w-3.5 text-primary" />
              <span>Workspace Aggregates</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 border border-primary/20 shadow-inner">
                <ClipboardCheck className="h-5 w-5 text-primary" />
              </div>
              <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-foreground via-foreground to-foreground/75 bg-clip-text text-transparent">
                My Tasks
              </h1>
            </div>
            <p className="text-sm text-muted-foreground/90 max-w-xl">
              A unified aggregate workspace showing active tasks assigned to you across all organisations you belong to.
            </p>
          </div>
          
          {searchTerm || selectedStatus !== "all" || selectedPriority !== "all" || selectedOrgId !== "all" ? (
            <button
              onClick={handleResetFilters}
              className="self-start md:self-center flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-lg bg-secondary/80 hover:bg-secondary border border-border/50 text-foreground transition-all duration-200 active:scale-95 shadow-sm"
            >
              <X className="h-3.5 w-3.5" />
              Clear Filters
            </button>
          ) : null}
        </div>

        {/* ─── Stats Banner ──────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* Card 1: Total */}
          <div className="group relative overflow-hidden rounded-xl border border-border/40 bg-card/40 backdrop-blur-md p-4 transition-all duration-300 hover:shadow-md hover:border-border/80">
            <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-primary to-indigo-500 opacity-60 group-hover:opacity-100 transition-opacity" />
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Total Assigned</span>
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <ListTodo className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2.5">
              <span className="text-2xl font-bold">{stats.total}</span>
              <p className="text-[10px] text-muted-foreground mt-0.5">Active across all workspaces</p>
            </div>
          </div>

          {/* Card 2: Overdue */}
          <div className="group relative overflow-hidden rounded-xl border border-border/40 bg-card/40 backdrop-blur-md p-4 transition-all duration-300 hover:shadow-md hover:border-border/80">
            <div className="absolute inset-x-0 bottom-0 h-1 bg-rose-500 opacity-60 group-hover:opacity-100 transition-opacity" />
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Overdue</span>
              <div className={cn(
                "flex h-7 w-7 items-center justify-center rounded-lg text-rose-500 bg-rose-500/10",
                stats.overdue > 0 && "animate-pulse"
              )}>
                <AlertCircle className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2.5">
              <span className={cn("text-2xl font-bold", stats.overdue > 0 && "text-rose-500")}>
                {stats.overdue}
              </span>
              <p className="text-[10px] text-muted-foreground mt-0.5">Requires immediate attention</p>
            </div>
          </div>

          {/* Card 3: In Progress */}
          <div className="group relative overflow-hidden rounded-xl border border-border/40 bg-card/40 backdrop-blur-md p-4 transition-all duration-300 hover:shadow-md hover:border-border/80">
            <div className="absolute inset-x-0 bottom-0 h-1 bg-amber-500 opacity-60 group-hover:opacity-100 transition-opacity" />
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">In Progress</span>
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500">
                <Clock className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2.5">
              <span className="text-2xl font-bold">{stats.inProgress}</span>
              <p className="text-[10px] text-muted-foreground mt-0.5">Active development tasks</p>
            </div>
          </div>

          {/* Card 4: Critical */}
          <div className="group relative overflow-hidden rounded-xl border border-border/40 bg-card/40 backdrop-blur-md p-4 transition-all duration-300 hover:shadow-md hover:border-border/80">
            <div className="absolute inset-x-0 bottom-0 h-1 bg-indigo-500 opacity-60 group-hover:opacity-100 transition-opacity" />
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">High & Urgent</span>
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400">
                <TrendingUp className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2.5">
              <span className="text-2xl font-bold">{stats.highOrUrgent}</span>
              <p className="text-[10px] text-muted-foreground mt-0.5">High priority tasks</p>
            </div>
          </div>

        </div>

        {/* ─── Filter Bar ────────────────────────────────────────────────────────── */}
        <div className="flex flex-col gap-4 p-4 rounded-xl border border-border/30 bg-card/20 backdrop-blur-sm">
          
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground px-1">
            <Filter className="h-3.5 w-3.5" />
            <span>Search & Filter Parameters</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            
            {/* Search Input */}
            <div className="relative col-span-1 md:col-span-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
              <input
                type="text"
                placeholder="Search task title..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-border/50 bg-background/50 focus:bg-background outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all text-foreground placeholder:text-muted-foreground/60"
              />
            </div>

            {/* Organisation Filter */}
            <div className="relative">
              <select
                value={selectedOrgId}
                onChange={(e) => setSelectedOrgId(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-border/50 bg-background/50 outline-none focus:ring-1 focus:ring-primary focus:border-primary appearance-none cursor-pointer text-foreground pr-8"
              >
                <option value="all">All Workspaces</option>
                {organisations.map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.name} {org.is_personal ? "(Personal)" : ""}
                  </option>
                ))}
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground text-[10px]">▼</div>
            </div>

            {/* Status Filter */}
            <div className="relative">
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-border/50 bg-background/50 outline-none focus:ring-1 focus:ring-primary focus:border-primary appearance-none cursor-pointer text-foreground pr-8"
              >
                <option value="all">All Statuses</option>
                <option value="backlog">Backlog</option>
                <option value="todo">To Do</option>
                <option value="in-progress">In Progress</option>
                <option value="in-review">In Review</option>
                <option value="done">Done</option>
                <option value="cancelled">Cancelled</option>
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground text-[10px]">▼</div>
            </div>

            {/* Priority Filter */}
            <div className="relative">
              <select
                value={selectedPriority}
                onChange={(e) => setSelectedPriority(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-border/50 bg-background/50 outline-none focus:ring-1 focus:ring-primary focus:border-primary appearance-none cursor-pointer text-foreground pr-8"
              >
                <option value="all">All Priorities</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground text-[10px]">▼</div>
            </div>

          </div>
        </div>

        {/* ─── Task List View ────────────────────────────────────────────────────── */}
        <div className="space-y-3">
          {isLoading ? (
            <div className="space-y-3 py-4">
              {[1, 2, 3].map((n) => (
                <div key={n} className="flex flex-col gap-3 p-5 rounded-xl border border-border/20 bg-card/25 animate-pulse">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-28 bg-muted rounded" />
                    <div className="h-3 w-20 bg-muted rounded" />
                  </div>
                  <div className="h-5 w-2/3 bg-muted rounded my-1" />
                  <div className="flex items-center justify-between mt-1">
                    <div className="flex gap-2">
                      <div className="h-5 w-16 bg-muted rounded-full" />
                      <div className="h-5 w-14 bg-muted rounded-full" />
                    </div>
                    <div className="h-4 w-24 bg-muted rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredTasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4 rounded-2xl border border-dashed border-border/60 bg-card/10 backdrop-blur-sm text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary/50 border border-border/40 text-muted-foreground mb-4">
                <CheckCircle2 className="h-6 w-6 text-muted-foreground/70" />
              </div>
              <h3 className="text-base font-semibold text-foreground mb-1">No assigned tasks found</h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                {searchTerm || selectedStatus !== "all" || selectedPriority !== "all" || selectedOrgId !== "all"
                  ? "No tasks match your current search and filter parameters. Try clearing them to see all tasks."
                  : "You're all caught up! There are no active tasks assigned to you across any of your workspaces."}
              </p>
              {(searchTerm || selectedStatus !== "all" || selectedPriority !== "all" || selectedOrgId !== "all") && (
                <button
                  onClick={handleResetFilters}
                  className="mt-4 px-4 py-2 text-xs font-semibold rounded-lg bg-primary/10 hover:bg-primary/15 text-primary border border-primary/20 transition-all duration-200"
                >
                  Clear Filters
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3.5">
              {filteredTasks.map((task) => {
                const statusInfo = STATUS_STYLES[task.status] || {
                  label: task.status,
                  bg: "bg-muted",
                  text: "text-muted-foreground",
                  border: "border-border",
                };
                const priorityInfo = PRIORITY_STYLES[task.priority] || {
                  label: task.priority,
                  bg: "bg-muted",
                  text: "text-muted-foreground",
                  border: "border-border",
                };
                const dueInfo = formatDueDate(task.due_date, task.status);

                return (
                  <div
                    key={task.id}
                    onClick={() => handleOpenTask(task)}
                    className="group relative flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-xl border border-border/40 bg-card/45 backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md hover:border-primary/25 cursor-pointer"
                  >
                    {/* Left section: breadcrumbs path & title & labels */}
                    <div className="flex-1 space-y-2 min-w-0">
                      
                      {/* Breadcrumbs path */}
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground/75 font-medium">
                        <Briefcase className="h-3 w-3 text-muted-foreground/60" />
                        <span>{task.org_name}</span>
                        <span className="text-[10px] text-muted-foreground/40">›</span>
                        <span className="text-muted-foreground/90">{task.space_name}</span>
                      </div>

                      {/* Task Title */}
                      <h3 className="text-base font-bold text-foreground tracking-tight group-hover:text-primary transition-colors pr-4 truncate">
                        {task.title}
                      </h3>

                      {/* Badges and Dates Row */}
                      <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                        
                        {/* Status badge */}
                        <span className={cn(
                          "px-2.5 py-0.5 rounded-full text-[10px] font-semibold border transition-all",
                          statusInfo.bg, statusInfo.text, statusInfo.border
                        )}>
                          {statusInfo.label}
                        </span>

                        {/* Priority badge */}
                        <span className={cn(
                          "px-2.5 py-0.5 rounded-full text-[10px] font-semibold border transition-all",
                          priorityInfo.bg, priorityInfo.text, priorityInfo.border
                        )}>
                          {priorityInfo.label}
                        </span>

                        {/* Due date status indicator */}
                        <div className="flex items-center gap-1 ml-1 text-muted-foreground/90 font-medium">
                          <Calendar className={cn(
                            "h-3.5 w-3.5 mr-0.5",
                            dueInfo.isOverdue && "text-rose-500",
                            dueInfo.isDueToday && "text-amber-500"
                          )} />
                          <span className={cn(
                            dueInfo.isOverdue && "text-rose-500 font-semibold animate-pulse",
                            dueInfo.isDueToday && "text-amber-500 font-semibold"
                          )}>
                            {dueInfo.text}
                          </span>
                        </div>

                      </div>

                    </div>

                    {/* Right section: Navigate trigger link */}
                    <div className="flex items-center self-end md:self-center shrink-0 pr-1 pl-4">
                      <div className="flex items-center gap-1 text-xs font-semibold text-muted-foreground/70 group-hover:text-primary transition-all duration-300">
                        <span className="opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300">
                          Open in Space
                        </span>
                        <ExternalLink className="h-4 w-4 group-hover:scale-110 transition-transform duration-300" />
                      </div>
                    </div>

                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>

    <style
      dangerouslySetInnerHTML={{
        __html: `
        .custom-scrollbar-page::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar-page::-webkit-scrollbar-thumb { background: transparent; border-radius: 10px; }
        .custom-scrollbar-page:hover::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.05); }
      `,
      }}
    />
    </div>
  );
}

