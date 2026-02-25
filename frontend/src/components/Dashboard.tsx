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
    case "urgent": return <Flame className="size-4 text-orange-600" />;
    case "important": return <TargetIcon className="size-4 text-emerald-600" />;
    case "scheduled": return <Clock className="size-4 text-blue-600" />;
    default: return <Star className="size-4 text-amber-500" />;
  }
};

const MetricSquare = ({ title, value, icon: Icon, trend, color }: { title: string, value: string, icon: any, trend?: string, color: string }) => (
  <Card className="border-none bg-white shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden flex flex-col justify-between p-4 min-h-[140px]">
    <div className="flex justify-between items-start">
      <div className={cn("p-2 rounded-xl", color)}>
        <Icon className="size-4 text-white" />
      </div>
      {trend && (
        <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-md">
          {trend}
        </span>
      )}
    </div>
    <div className="space-y-1">
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{title}</p>
      <h4 className="text-xl font-bold text-slate-900">{value}</h4>
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
    "mx-auto transition-all duration-500 ease-in-out px-6 lg:px-8",
    isCollapsed ? "max-w-[1600px]" : "max-w-7xl"
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
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] font-sans pb-20">
      <main className={cn(containerClassName, "pt-8 space-y-8")}>

        {/* Header Section */}
        <header className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-4xl font-black tracking-tight text-[#0F172A]">
              Good {currentTime.getHours() < 12 ? "morning" : currentTime.getHours() < 17 ? "afternoon" : "evening"}, {userName}.
            </h1>
            <p className="text-sm font-medium text-slate-400">You have 3 priorities and 2 blockers today.</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-2xl shadow-sm border border-slate-100">
              <div className="size-2 rounded-full bg-blue-500 animate-pulse" />
              <span className="text-xs font-bold">AI Co-pilot: Active</span>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

          {/* Main Area (9 columns) */}
          <div className="lg:col-span-9 space-y-8">

            {/* Row 1: Project Table */}
            <Card className="border-none shadow-sm bg-white overflow-hidden">
              <div className="p-6 border-b border-slate-50 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Active Workstream</h2>
                  <p className="text-xs text-slate-400 font-medium">Your currently prioritized tasks and projects</p>
                </div>
                <Button size="sm" variant="outline" className="h-9 px-4 rounded-xl border-slate-200 text-slate-600 font-bold text-[11px] gap-2 hover:bg-slate-50">
                  <Plus className="size-3.5" />
                  Add Project
                </Button>
              </div>
              <div className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent border-slate-50">
                      <TableHead className="w-[120px] text-[10px] font-bold uppercase tracking-widest text-slate-400 pl-6 h-10">Type</TableHead>
                      <TableHead className="text-[10px] font-bold uppercase tracking-widest text-slate-400 h-10">Task & Timeline</TableHead>
                      <TableHead className="text-right text-[10px] font-bold uppercase tracking-widest text-slate-400 h-10 pr-6">Budget</TableHead>
                      <TableHead className="w-[50px] h-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {PRIORITIES.filter(p => p.id !== activeTask?.id).map((priority) => (
                      <TableRow
                        key={priority.id}
                        className="group border-slate-50 cursor-pointer hover:bg-slate-50/50"
                        onClick={() => handleStartFocus(priority)}
                      >
                        <TableCell className="pl-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="size-8 flex items-center justify-center rounded-xl bg-slate-50 border border-slate-100 shadow-sm">
                              <StatusIcon type={priority.type} />
                            </div>
                            <span className={cn(
                              "text-[10px] font-black uppercase tracking-tighter px-2 py-0.5 rounded-md",
                              priority.type === "urgent" ? "bg-orange-50 text-orange-600" :
                                priority.type === "important" ? "bg-emerald-50 text-emerald-600" : "bg-blue-50 text-blue-600"
                            )}>
                              {priority.type}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="text-[13px] font-bold text-slate-900 tracking-tight">{priority.title}</span>
                            <span className="text-[11px] font-medium text-slate-400 mt-0.5">{priority.subtext}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right pr-6">
                          <span className="text-[11px] font-bold text-slate-600">{priority.duration}</span>
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" className="size-8 opacity-0 group-hover:opacity-100 rounded-full text-slate-300 hover:text-slate-600 transition-opacity">
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
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
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
            <div className="grid grid-cols-5 gap-6">

              {/* Blockers - Width of 2 squares */}
              <Card className="col-span-5 md:col-span-2 border-none shadow-sm bg-white flex flex-col">
                <div className="p-4 border-b border-slate-50 flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900 italic">Blockers</h3>
                  <Badge variant="outline" className="text-[9px] font-bold text-red-500 border-red-100 bg-red-50">Action Needed</Badge>
                </div>
                <div className="p-4 space-y-4 flex-1">
                  {BLOCKERS.map(blocker => (
                    <div key={blocker.id} className="flex items-start gap-3 p-3 rounded-xl bg-slate-50/50 border border-slate-100 group hover:border-slate-200 transition-colors">
                      <div className={cn("size-2 rounded-full mt-1.5 shrink-0", blocker.urgent ? "bg-red-500 animate-pulse" : "bg-slate-300")} />
                      <div className="space-y-1 flex-1 min-w-0">
                        <p className="text-[12px] font-bold text-slate-900 truncate">{blocker.task}</p>
                        <p className="text-[10px] font-medium text-slate-400">Blocked by: <span className="text-slate-600">{blocker.blockedBy}</span></p>
                      </div>
                      <Button variant="ghost" size="icon" className="size-6 text-slate-300 hover:text-blue-500 opacity-0 group-hover:opacity-100">
                        <Plus className="size-3" />
                      </Button>
                    </div>
                  ))}
                </div>
                <div className="p-3 bg-slate-50/30 border-t border-slate-50">
                  <Button variant="ghost" className="w-full h-8 text-[10px] font-bold text-slate-400 hover:text-slate-600 uppercase tracking-widest">
                    View All Blockers
                  </Button>
                </div>
              </Card>

              {/* Efficiency Snapshot - Width of 3 squares */}
              <Card className="col-span-5 md:col-span-3 border-none shadow-sm bg-white flex flex-col">
                <div className="p-4 border-b border-slate-50 flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900 italic">Efficiency Snapshot</h3>
                  <Badge variant="outline" className="text-[9px] font-bold text-slate-400 border-slate-100">Private</Badge>
                </div>
                <div className="p-6 flex items-center justify-between flex-1">
                  <div className="w-[180px] h-[180px] relative">
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
                      <span className="text-2xl font-black text-slate-900 leading-none">88</span>
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Score</span>
                    </div>
                  </div>
                  <div className="flex-1 pl-8 space-y-4">
                    {EFFICIENCY_CHART_DATA.map((item) => (
                      <div key={item.metric} className="space-y-1">
                        <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-tight">
                          <span className="text-slate-400">{(EFFICIENCY_CHART_CONFIG as any)[item.metric].label}</span>
                          <span className="text-slate-900">{item.value}%</span>
                        </div>
                        <div className="h-1 w-full bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${item.value}%`, backgroundColor: (EFFICIENCY_CHART_CONFIG as any)[item.metric].color }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="p-3 bg-slate-50/30 border-t border-slate-50">
                  <p className="text-[10px] font-bold text-emerald-600 text-center flex items-center justify-center gap-1.5">
                    <TrendingUp className="size-3" />
                    Overall efficiency up by 5.2% this week
                  </p>
                </div>
              </Card>

            </div>
          </div>

          {/* Right Sidebar Area (3 columns) */}
          <div className="lg:col-span-3 space-y-8">

            {/* Active Focus Block - Persistent & Sexy */}
            <Card className={cn(
              "border-none bg-[#022C22] relative overflow-hidden shadow-xl flex flex-col transition-all duration-500 min-h-[180px]",
              isFocusActive ? "ring-2 ring-emerald-500/20" : "opacity-90"
            )}>
              <div className="absolute inset-0 opacity-10 pointer-events-none">
                <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                  <path d="M0,50 Q25,30 50,50 T100,50" fill="none" stroke="#10b981" strokeWidth="0.5" className="animate-pulse" />
                </svg>
              </div>

              <div className="relative z-10 p-5 flex flex-col h-full justify-between">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-widest">Focus Mode</h3>
                  {isFocusActive && <Badge className="bg-emerald-500/20 text-emerald-400 border-none px-2 py-0 text-[9px] font-black">ACTIVE</Badge>}
                </div>

                <div className="py-6 space-y-1">
                  <h2 className={cn("text-lg font-bold leading-tight", isFocusActive ? "text-white" : "text-emerald-900/40 italic")}>
                    {activeTask?.title || "No task in focus"}
                  </h2>
                  <p className="text-[10px] font-medium text-emerald-400/60 uppercase">
                    {isFocusActive ? "Time Remaining: 45m" : "Start a session to focus"}
                  </p>
                </div>

                {isFocusActive ? (
                  <div className="flex items-center gap-3">
                    <Button variant="secondary" size="sm" className="bg-white/10 text-white hover:bg-white/20 border-none rounded-xl h-9 flex-1 font-bold text-xs" onClick={() => setIsFocusActive(false)}>
                      Pause
                    </Button>
                    <Button variant="destructive" size="sm" className="bg-red-500 hover:bg-red-600 border-none rounded-xl size-9 shrink-0 flex items-center justify-center" onClick={() => { setIsFocusActive(false); setActiveTask(null); }}>
                      <Square className="size-4 fill-current" />
                    </Button>
                  </div>
                ) : (
                  <Button className="bg-emerald-500 hover:bg-emerald-600 text-[#022C22] font-black text-xs rounded-xl h-10 w-full shadow-lg shadow-emerald-900/20">
                    Quick Start
                  </Button>
                )}
              </div>
            </Card>

            {/* Decisions Card */}
            <Card className="border-none shadow-sm bg-white overflow-hidden flex flex-col">
              <div className="p-4 border-b border-slate-50">
                <h3 className="text-sm font-bold text-slate-900 italic">Decisions</h3>
              </div>
              <div className="p-4 space-y-5">
                {DECISIONS.map(decision => (
                  <div key={decision.id} className="space-y-3 group">
                    <div className="flex justify-between items-start gap-2">
                      <h4 className="text-[12px] font-bold text-slate-900 leading-tight group-hover:text-blue-600 transition-colors">{decision.title}</h4>
                      <Badge className={cn("text-[8px] font-black uppercase border-none shrink-0 px-1", decision.priority === "High" ? "bg-red-50 text-red-500" : "bg-amber-50 text-amber-500")}>
                        {decision.priority}
                      </Badge>
                    </div>
                    <p className="text-[10px] text-slate-400 font-medium line-clamp-2 italic leading-relaxed">{decision.context}</p>
                    <div className="flex items-center gap-2 pt-1">
                      <Button size="sm" className="h-7 text-[9px] font-black bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex-1">Approve</Button>
                      <Button size="sm" variant="outline" className="h-7 text-[9px] font-black border-slate-100 rounded-lg flex-1">Review</Button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="p-3 bg-slate-50/30 border-t border-slate-50">
                <Button variant="ghost" className="w-full h-8 text-[10px] font-bold text-slate-400 hover:text-slate-600 uppercase tracking-widest">
                  History
                </Button>
              </div>
            </Card>

          </div>
        </div>
      </main>

      {/* Customize View Trigger */}
      <div className="fixed bottom-8 right-8">
        <Button className="rounded-full shadow-2xl h-12 px-6 bg-[#0F172A] hover:bg-[#1E293B] text-white font-black gap-2 transition-transform duration-200 hover:scale-105 active:scale-95">
          <Plus className="h-4 w-4" />
          Customize
        </Button>
      </div>
    </div>
  );
}
