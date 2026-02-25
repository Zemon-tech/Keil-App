import { useState, useEffect } from "react";
import {
  Square,
  Activity,
  Zap,
  Target as TargetIcon,
  TrendingUp,
  Clock,
  Flame,
  Star,
  MoreVertical,
  Plus
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ChartContainer,
  type ChartConfig,
} from "@/components/ui/chart";
import { RadialBar, RadialBarChart } from "recharts";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { useSidebar } from "@/components/ui/sidebar";

// --- Mock Data ---
const EFFICIENCY_CHART_DATA = [
  { metric: "deepWork", value: 65, fill: "var(--color-deepWork)" },
  { metric: "meetings", value: 80, fill: "var(--color-meetings)" },
  { metric: "ctxSwitches", value: 40, fill: "var(--color-ctxSwitches)" },
  { metric: "rhythm", value: 70, fill: "var(--color-rhythm)" },
];

const EFFICIENCY_CHART_CONFIG = {
  value: {
    label: "Efficiency",
  },
  deepWork: {
    label: "Deep Work",
    color: "var(--chart-1)",
  },
  meetings: {
    label: "Meetings",
    color: "var(--chart-2)",
  },
  ctxSwitches: {
    label: "Ctx Switches",
    color: "var(--chart-3)",
  },
  rhythm: {
    label: "Rhythm",
    color: "var(--chart-4)",
  },
} satisfies ChartConfig;

const PRIORITIES = [
  {
    id: 1,
    title: "Finalize Homepage UX Wireframes",
    subtext: "Blocks client review milestone (Due Friday)",
    type: "urgent",
    duration: "90 min",
    dependencies: 2,
    waitingOn: "copy draft",
  },
  {
    id: 2,
    title: "Review Backend API Documentation",
    subtext: "Necessary for integration phase",
    type: "important",
    duration: "45 min",
    dependencies: 1,
    waitingOn: "lead dev",
  },
  {
    id: 3,
    title: "Weekly Sync with Design Team",
    subtext: "Discussing the new branding guidelines",
    type: "scheduled",
    duration: "30 min",
    dependencies: 0,
    waitingOn: "N/A",
  },
  {
    id: 4,
    title: "Update Project Budget Tracker",
    subtext: "Month-end reporting requirement",
    type: "low",
    duration: "20 min",
    dependencies: 0,
    waitingOn: "N/A",
  }
];

const DECISIONS = [
  {
    id: 1,
    type: "Approval Required",
    title: "Approve updated homepage scope",
    context: "Scope increased by 15% due to new requirements and user feedback.",
    risk: "High Impact - Delays client milestone by 2 days",
    priority: "High",
    deadline: "Nov 28",
    status: "Pending"
  },
  {
    id: 2,
    type: "Resource Request",
    title: "Add extra designer for Sprint 4",
    context: "Current capacity is at 110% for the next two weeks.",
    risk: "Quality Risk - Potential burnout and quality drop",
    priority: "Medium",
    deadline: "Nov 30",
    status: "Review Required"
  }
];

const BLOCKERS = [
  {
    id: 1,
    task: "API Integration",
    blockedBy: "Security API Keys",
    duration: "3 days",
    suggestedAction: "Nudge Security Team",
    urgent: true,
  },
  {
    id: 2,
    task: "Mobile App Store Assets",
    blockedBy: "Final Marketing Copy",
    duration: "1 day",
    suggestedAction: "Follow up with Marketing",
    urgent: false,
  }
];

// --- Sub-components ---

const StatusIcon = ({ type }: { type: string }) => {
  switch (type) {
    case "urgent": return <Flame className="size-4 text-destructive" />;
    case "important": return <TargetIcon className="size-4 text-primary" />;
    case "scheduled": return <Clock className="size-4 text-blue-500" />;
    default: return <Star className="size-4 text-amber-500" />;
  }
};

const MetricSquare = ({ title, value, icon: Icon, trend, color }: { title: string, value: string, icon: any, trend?: string, color: string }) => (
  <Card className="border border-border bg-card shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden flex flex-col justify-between gap-0 px-3.5 py-3 min-h-[120px]">
    <div className="flex justify-between items-start">
      <div className={cn("p-2 rounded-xl", color)}>
        <Icon className="size-4 text-white" />
      </div>
      {trend && (
        <span className="text-[10px] font-bold text-success bg-success/10 px-1.5 py-0.5 rounded-md">
          {trend}
        </span>
      )}
    </div>
    <div className="space-y-1">
      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{title}</p>
      <h4 className="text-xl font-bold text-foreground">{value}</h4>
    </div>
  </Card>
);

export function Dashboard() {
  const { user } = useAuth();
  const { state } = useSidebar();
  const [isFocusActive, setIsFocusActive] = useState(false);
  const [activeTask, setActiveTask] = useState<typeof PRIORITIES[0] | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  const isCollapsed = state === "collapsed";
  const containerClassName = cn(
    "mx-auto transition-all duration-500 ease-in-out px-6 lg:px-10",
    isCollapsed ? "max-w-[1600px]" : "max-w-6xl"
  );

  const userName = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Arjun";

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const handleStartFocus = (task: typeof PRIORITIES[0]) => {
    setActiveTask(task);
    setIsFocusActive(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-muted/30 to-background text-foreground pb-16">
      <main className={cn(containerClassName, "pt-8 lg:pt-10 space-y-8 lg:space-y-10")}>

        {/* Header Section */}
        <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="space-y-1.5">
            <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-foreground">
              Good {currentTime.getHours() < 12 ? "morning" : currentTime.getHours() < 17 ? "afternoon" : "evening"}, {userName}.
            </h1>
            <p className="text-sm font-medium text-muted-foreground">You have 3 priorities and 2 blockers today.</p>
          </div>
          <div className="flex items-center gap-3 md:gap-4 self-start md:self-auto">
            <div className="hidden sm:flex flex-col text-right text-[11px] text-muted-foreground">
              <span className="font-semibold text-foreground">Today</span>
              <span>{currentTime.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}</span>
            </div>
            <div className="flex items-center gap-2 bg-card/90 backdrop-blur px-4 py-2 rounded-full shadow-sm border border-border/70">
              <div className="size-2 rounded-full bg-primary animate-pulse" />
              <span className="text-xs font-semibold text-foreground tracking-tight">AI Co-pilot: Active</span>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">

          {/* Main Area (9 columns) */}
          <div className="lg:col-span-8 xl:col-span-9 space-y-6 lg:space-y-8">

            {/* Row 1: Project Table */}
            <Card className="border border-border/70 shadow-sm bg-card/95 backdrop-blur-sm overflow-hidden rounded-3xl py-0 gap-0">
              <div className="px-5 py-3.5 md:px-6 md:py-4 border-b border-border/70 flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-base md:text-lg font-semibold text-foreground">Active workstream</h2>
                  <p className="text-xs text-muted-foreground font-medium">Your currently prioritized tasks and projects</p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="hidden sm:inline-flex h-9 px-4 rounded-full border-border/70 text-foreground font-medium text-[11px] gap-2 hover:bg-accent hover:text-accent-foreground"
                >
                  <Plus className="size-3.5" />
                  Add Project
                </Button>
              </div>
              <div className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent border-border/40">
                      <TableHead className="w-[120px] text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground pl-5 md:pl-6 h-8">Type</TableHead>
                      <TableHead className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground h-8">Task & timeline</TableHead>
                      <TableHead className="text-right text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground h-8 pr-5 md:pr-6">Budget</TableHead>
                      <TableHead className="w-[50px] h-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {PRIORITIES.filter(p => p.id !== activeTask?.id).map((priority) => (
                      <TableRow
                        key={priority.id}
                        className="group cursor-pointer hover:bg-muted/60 border-b last:border-0 border-border/40"
                        onClick={() => handleStartFocus(priority)}
                      >
                        <TableCell className="pl-5 md:pl-6 py-3">
                          <div className="flex items-center gap-3">
                            <div className="size-8 flex items-center justify-center rounded-xl bg-muted border border-border/60 shadow-sm">
                              <StatusIcon type={priority.type} />
                            </div>
                            <span className={cn(
                              "text-[10px] font-semibold uppercase tracking-[0.2em] px-2 py-0.5 rounded-full",
                              priority.type === "urgent" ? "bg-destructive/10 text-destructive" :
                                priority.type === "important" ? "bg-primary/10 text-primary" : "bg-blue-500/10 text-blue-500"
                            )}>
                              {priority.type}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="text-[13px] font-semibold text-foreground tracking-tight">{priority.title}</span>
                            <span className="text-[11px] font-medium text-muted-foreground mt-0.5">{priority.subtext}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right pr-5 md:pr-6">
                          <span className="text-[11px] font-semibold text-foreground">{priority.duration}</span>
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" className="size-8 opacity-0 group-hover:opacity-100 rounded-full text-muted-foreground hover:text-foreground transition-opacity">
                            <MoreVertical className="size-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>

            {/* Row 2: 5 Squares (Metrics) */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5 md:gap-4">
              <MetricSquare
                title="Deep Work"
                value="2h 45m"
                icon={Zap}
                trend="+12%"
                color="bg-indigo-500"
              />
              <MetricSquare
                title="Meetings"
                value="1h 20m"
                icon={Clock}
                trend="-5%"
                color="bg-amber-500"
              />
              <MetricSquare
                title="Switches"
                value="4"
                icon={Activity}
                trend="Stable"
                color="bg-emerald-500"
              />
              <MetricSquare
                title="Rhythm"
                value="High"
                icon={Activity}
                color="bg-rose-500"
              />
              <MetricSquare
                title="Eff. Score"
                value="88%"
                icon={TargetIcon}
                trend="+4%"
                color="bg-blue-500"
              />
            </div>

            {/* Row 3: Blockers and Efficiency Snapshot */}
            <div className="grid grid-cols-5 gap-4.5 lg:gap-6">

              {/* Blockers - Width of 2 squares */}
              <Card className="col-span-5 md:col-span-2 border border-border/70 shadow-sm bg-card/95 backdrop-blur-sm flex flex-col rounded-3xl py-0 gap-0">
                <div className="px-4 py-3 border-b border-border/70 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-foreground">Blockers</h3>
                  <Badge variant="outline" className="text-[9px] font-bold text-destructive border-destructive/20 bg-destructive/10">Action Needed</Badge>
                </div>
                <div className="px-4 py-3 space-y-3 flex-1">
                  {BLOCKERS.map(blocker => (
                    <div key={blocker.id} className="flex items-start gap-3 px-3 py-2.5 rounded-2xl bg-muted/70 border border-border/70 group hover:border-border/90 transition-colors">
                      <div className={cn("size-2 rounded-full mt-1.5 shrink-0", blocker.urgent ? "bg-destructive animate-pulse" : "bg-muted-foreground/40")} />
                      <div className="space-y-1 flex-1 min-w-0">
                        <p className="text-[12px] font-semibold text-foreground truncate">{blocker.task}</p>
                        <p className="text-[10px] font-medium text-muted-foreground">Blocked by: <span className="text-foreground">{blocker.blockedBy}</span></p>
                      </div>
                      <Button variant="ghost" size="icon" className="size-6 text-muted-foreground hover:text-primary opacity-0 group-hover:opacity-100">
                        <Plus className="size-3" />
                      </Button>
                    </div>
                  ))}
                </div>
                <div className="px-3 py-2.5 bg-muted/40 border-t border-border/60 rounded-b-3xl">
                  <Button variant="ghost" className="w-full h-7 text-[10px] font-semibold text-muted-foreground hover:text-foreground uppercase tracking-[0.22em]">
                    View All Blockers
                  </Button>
                </div>
              </Card>

              {/* Efficiency Snapshot - Width of 3 squares */}
              <Card className="col-span-5 md:col-span-3 border border-border/70 shadow-sm bg-card/95 backdrop-blur-sm flex flex-col rounded-3xl py-0 gap-0">
                <div className="px-4 py-3 border-b border-border/70 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-foreground">Efficiency snapshot</h3>
                  <Badge variant="outline" className="text-[9px] font-semibold text-muted-foreground border-border/60">Private</Badge>
                </div>
                <div className="px-5 py-4 md:px-6 md:py-5 flex items-center justify-between flex-1 gap-6">
                  <div className="w-[160px] h-[160px] md:w-[180px] md:h-[180px] relative">
                    <ChartContainer config={EFFICIENCY_CHART_CONFIG} className="w-full h-full">
                      <RadialBarChart
                        data={EFFICIENCY_CHART_DATA}
                        innerRadius={30}
                        outerRadius={80}
                        barSize={10}
                        startAngle={90}
                        endAngle={450}
                      >
                        <RadialBar dataKey="value" background />
                      </RadialBarChart>
                    </ChartContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <span className="text-2xl font-semibold text-foreground leading-none">88</span>
                      <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-[0.22em]">Score</span>
                    </div>
                  </div>
                  <div className="flex-1 pl-2 md:pl-6 space-y-3">
                    {EFFICIENCY_CHART_DATA.map((item) => (
                      <div key={item.metric} className="space-y-1">
                        <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-tight">
                          <span className="text-muted-foreground">{(EFFICIENCY_CHART_CONFIG as any)[item.metric].label}</span>
                          <span className="text-foreground">{item.value}%</span>
                        </div>
                        <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${item.value}%`, backgroundColor: (EFFICIENCY_CHART_CONFIG as any)[item.metric].color }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="px-3 py-2.5 bg-muted/40 border-t border-border/60 rounded-b-3xl">
                  <p className="text-[10px] font-semibold text-emerald-600 text-center flex items-center justify-center gap-1.5">
                    <TrendingUp className="size-3" />
                    Overall efficiency up by 5.2% this week
                  </p>
                </div>
              </Card>

            </div>
          </div>

          {/* Right Sidebar Area (3 columns) */}
          <div className="lg:col-span-4 xl:col-span-3 space-y-6 lg:space-y-8">

            {/* Active Focus Block - Persistent & Sexy */}
            <Card className={cn(
              "border-none bg-gradient-to-br from-emerald-900 via-emerald-950 to-slate-950 relative overflow-hidden shadow-xl flex flex-col transition-all duration-500 min-h-[170px] rounded-3xl py-0 gap-0",
              isFocusActive ? "ring-2 ring-emerald-500/25" : "opacity-95"
            )}>
              <div className="absolute inset-0 opacity-10 pointer-events-none">
                <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                  <path d="M0,50 Q25,30 50,50 T100,50" fill="none" stroke="#10b981" strokeWidth="0.5" className="animate-pulse" />
                </svg>
              </div>

              <div className="relative z-10 px-4.5 py-4 flex flex-col h-full justify-between gap-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-[11px] font-semibold text-emerald-300 uppercase tracking-[0.24em]">Focus mode</h3>
                  {isFocusActive && <Badge className="bg-emerald-500/20 text-emerald-50 border-none px-2 py-0 text-[9px] font-semibold">Active</Badge>}
                </div>

                <div className="space-y-1">
                  <h2 className={cn("text-lg font-semibold leading-snug", isFocusActive ? "text-white" : "text-emerald-200/70 italic")}
                  >
                    {activeTask?.title || "No task in focus"}
                  </h2>
                  <p className="text-[10px] font-medium text-emerald-300/70 uppercase tracking-[0.2em]">
                    {isFocusActive ? "Time Remaining: 45m" : "Start a session to focus"}
                  </p>
                </div>

                {isFocusActive ? (
                  <div className="flex items-center gap-2.5">
                    <Button variant="secondary" size="sm" className="bg-white/10 text-white hover:bg-white/15 border-none rounded-xl h-8 flex-1 font-semibold text-xs" onClick={() => setIsFocusActive(false)}>
                      Pause
                    </Button>
                    <Button variant="destructive" size="sm" className="bg-red-500 hover:bg-red-600 border-none rounded-xl size-8 shrink-0 flex items-center justify-center" onClick={() => { setIsFocusActive(false); setActiveTask(null); }}>
                      <Square className="size-4 fill-current" />
                    </Button>
                  </div>
                ) : (
                  <Button className="bg-emerald-500 hover:bg-emerald-600 text-emerald-950 font-semibold text-xs rounded-xl h-9 w-full shadow-lg shadow-emerald-900/30">
                    Quick Start
                  </Button>
                )}
              </div>
            </Card>

            {/* Decisions Card */}
            <Card className="border border-border/70 shadow-sm bg-card/95 backdrop-blur-sm overflow-hidden flex flex-col rounded-3xl py-0 gap-0">
              <div className="px-4 py-3 border-b border-border/70">
                <h3 className="text-sm font-semibold text-foreground">Decisions</h3>
              </div>
              <div className="px-4 py-3 space-y-3.5">
                {DECISIONS.map(decision => (
                  <div key={decision.id} className="space-y-3 group">
                    <div className="flex justify-between items-start gap-2">
                      <h4 className="text-[12px] font-semibold text-foreground leading-tight group-hover:text-primary transition-colors">{decision.title}</h4>
                      <Badge className={cn("text-[8px] font-semibold uppercase border-none shrink-0 px-1.5", decision.priority === "High" ? "bg-destructive/10 text-destructive" : "bg-amber-50 text-amber-500")}>
                        {decision.priority}
                      </Badge>
                    </div>
                    <p className="text-[10px] text-muted-foreground font-medium line-clamp-3 leading-relaxed">{decision.context}</p>
                    <div className="flex items-center gap-2 pt-0.5">
                      <Button size="sm" className="h-7 text-[9px] font-semibold bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg flex-1">Approve</Button>
                      <Button size="sm" variant="outline" className="h-7 text-[9px] font-semibold border-border rounded-lg flex-1">Review</Button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="px-3 py-2.5 bg-muted/40 border-t border-border/60 rounded-b-3xl">
                <Button variant="ghost" className="w-full h-7 text-[10px] font-semibold text-muted-foreground hover:text-foreground uppercase tracking-[0.22em]">
                  History
                </Button>
              </div>
            </Card>

          </div>
        </div>
      </main>
    </div>
  );
}
