import { useState, useEffect } from "react";
import {
  Clock,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Plus,
  TrendingUp,
  Target,
  Flame,
  Star,
  MoreVertical,
  Pause,
  Square
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import { Progress } from "@/components/ui/progress";
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
    case "important": return <Target className="size-4 text-emerald-600" />;
    case "scheduled": return <Clock className="size-4 text-blue-600" />;
    default: return <Star className="size-4 text-amber-500" />;
  }
};


const BlockerCard = ({ blocker }: { blocker: typeof BLOCKERS[0] }) => (
  <Card className="border-none bg-white shadow-sm overflow-hidden transition-all duration-200 hover:shadow-md mb-3">
    <CardContent className="p-4 flex items-center justify-between">
      <div className="flex items-center gap-4">
        {blocker.urgent && (
          <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
        )}
        <div className="grid grid-cols-4 gap-8">
          <div className="flex flex-col">
            <span className="text-[10px] uppercase text-[#64748B] font-bold">Task</span>
            <span className="text-sm font-semibold text-[#0F172A]">{blocker.task}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] uppercase text-[#64748B] font-bold">Blocked By</span>
            <span className="text-sm text-[#0F172A]">{blocker.blockedBy}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] uppercase text-[#64748B] font-bold">Duration</span>
            <span className="text-sm text-[#0F172A]">{blocker.duration}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] uppercase text-[#64748B] font-bold">Action</span>
            <span className="text-xs font-medium text-[#2563EB] bg-blue-50 px-2 py-0.5 rounded-full inline-block w-fit">
              {blocker.suggestedAction}
            </span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" className="h-8 text-xs font-semibold text-slate-500 hover:text-slate-900">Nudge</Button>
        <Button variant="ghost" size="sm" className="h-8 text-xs font-semibold text-slate-500 hover:text-slate-900">Resolve</Button>
      </div>
    </CardContent>
  </Card>
);

// --- Main Dashboard ---

export function Dashboard() {
  const { user } = useAuth();
  const { state } = useSidebar();
  const [isFocusActive, setIsFocusActive] = useState(false);
  const [activeTask, setActiveTask] = useState<typeof PRIORITIES[0] | null>(null);
  const [isFocusExpanded, setIsFocusExpanded] = useState(false);
  const [isEfficiencyExpanded, setIsEfficiencyExpanded] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  const isCollapsed = state === "collapsed";
  const containerClassName = cn(
    "mx-auto transition-all duration-500 ease-in-out",
    isCollapsed ? "max-w-[1520px] px-12" : "max-w-7xl px-8"
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
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] font-sans">
      {/* Top Bar - Compact Greeting */}
      <header className={cn(containerClassName, "pt-8 pb-10 flex items-center justify-between")}>
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-[#0F172A]">
            Good {currentTime.getHours() < 12 ? "morning" : currentTime.getHours() < 17 ? "afternoon" : "evening"}, {userName}.
          </h1>
          <div className="flex items-center gap-5 text-xs font-semibold text-[#64748B]/60 uppercase tracking-wider">
            <span className="flex items-center gap-2">
              <span className="text-[#0F172A] font-bold">3</span> priorities
            </span>
            <span className="h-1 w-1 rounded-full bg-slate-200" />
            <span className="flex items-center gap-2">
              <span className="text-amber-600 font-bold">1</span> decision
            </span>
            <span className="h-1 w-1 rounded-full bg-slate-200" />
            <span className="flex items-center gap-2">
              <span className="text-red-500 font-bold">2</span> blockers
            </span>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-xl shadow-sm border border-slate-50/50 relative overflow-hidden group">
            <div className="h-2 w-2 rounded-full bg-[#2563EB] animate-pulse relative">
              <div className="absolute inset-0 rounded-full bg-[#2563EB] animate-ping opacity-20" />
            </div>
            <span className="text-[11px] font-bold text-[#0F172A]">AI Active</span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Next Free Block</span>
            <span className="text-xs font-bold text-[#0F172A]">9:30 – 11:00 <span className="text-slate-400 font-medium ml-1">(90 min)</span></span>
          </div>
        </div>
      </header>

      <main className={cn(containerClassName, "pb-12")}>
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-10">

          {/* NOW (Main Column - 60%) */}
          <section className="lg:col-span-3">
            <Card className="border-none shadow-sm bg-white overflow-hidden p-3 pt-3">
              <div className="flex items-center justify-between mb-2 px-1">
                <h2 className="text-lg font-bold tracking-tight text-slate-900">Project</h2>
                <Button size="sm" variant="outline" className="h-8 px-3 rounded-full border-slate-200 text-slate-600 font-bold text-[11px] gap-2 hover:bg-slate-50">
                  <Plus className="size-3.5" />
                  New
                </Button>
              </div>

              <div className="px-1">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent border-slate-50">
                      <TableHead className="w-[100px] text-[10px] font-bold uppercase tracking-widest text-slate-400 h-8">Status</TableHead>
                      <TableHead className="text-[10px] font-bold uppercase tracking-widest text-slate-400 h-8">Task & Information</TableHead>
                      <TableHead className="text-right text-[10px] font-bold uppercase tracking-widest text-slate-400 h-8">Duration</TableHead>
                      <TableHead className="w-[50px] h-8"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {PRIORITIES.filter(p => p.id !== activeTask?.id).map((priority) => (
                      <TableRow
                        key={priority.id}
                        className="group border-slate-50 cursor-pointer hover:bg-slate-50/50"
                        onClick={() => handleStartFocus(priority)}
                      >
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="size-8 flex items-center justify-center rounded-lg bg-slate-50/50 border border-slate-100 shadow-sm">
                              <StatusIcon type={priority.type} />
                            </div>
                            <span className={cn(
                              "text-[10px] font-bold uppercase tracking-tighter",
                              priority.type === "urgent" ? "text-orange-600" :
                                priority.type === "important" ? "text-emerald-600" : "text-blue-600"
                            )}>
                              {priority.type}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="text-[13px] font-semibold text-slate-900 tracking-tight">{priority.title}</span>
                            <span className="text-[10px] font-medium text-slate-400 mt-0.5">Due date: Nov {26 + priority.id}, 2024</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="text-[11px] font-bold text-slate-500">{priority.duration}</span>
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" className="size-7 opacity-0 group-hover:opacity-100 rounded-full text-slate-300 hover:text-slate-600 transition-opacity">
                            <MoreVertical className="size-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="mt-2 pt-2 border-t border-slate-50 px-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest hover:text-blue-600 transition-colors cursor-pointer inline-block">
                  View all projects
                </p>
              </div>
            </Card>
          </section>

          {/* Focus + Decisions (40%) */}
          <aside className="lg:col-span-2 space-y-10">

            {/* Active Focus Block */}
            <section className="space-y-2">
              <Card
                className={cn(
                  "border-none bg-[#022C22] relative overflow-hidden shadow-xl flex flex-col transition-all duration-300",
                  (isFocusActive && isFocusExpanded) ? "" : "h-16",
                  isFocusActive ? "cursor-pointer" : "cursor-default opacity-90"
                )}
                onClick={() => {
                  if (isFocusActive) setIsFocusExpanded(!isFocusExpanded);
                }}
              >
                {/* Abstract Background Pattern */}
                <div className="absolute inset-0 opacity-10 pointer-events-none">
                  <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                    <path d="M0,50 Q25,30 50,50 T100,50 T150,50" fill="none" stroke="#10b981" strokeWidth="0.5" className="animate-pulse" />
                    <path d="M0,60 Q25,40 50,60 T100,60 T150,60" fill="none" stroke="#10b981" strokeWidth="0.3" className="animate-pulse" />
                  </svg>
                </div>

                {isFocusActive && activeTask && isFocusExpanded ? (
                  <>
                    {/* Card Header */}
                    <div className="relative z-10 px-3 pt-1 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <h2 className="text-sm font-bold tracking-tight text-white uppercase tracking-widest">Focus</h2>
                      </div>
                      <Badge className="bg-emerald-500/20 text-emerald-400 border-none px-2 py-0 text-[10px] font-bold">ACTIVE</Badge>
                    </div>

                    {/* Time Tracker Section */}
                    <div className="relative z-10 px-3 py-3 flex flex-col items-center">
                      <div className="text-white text-5xl font-bold tracking-tight mb-6 font-mono">
                        01:24:08
                      </div>

                      <div className="flex items-center gap-4">
                        <button className="size-10 rounded-full bg-white flex items-center justify-center text-[#022C22] hover:bg-emerald-50 transition-colors shadow-lg" onClick={(e) => e.stopPropagation()}>
                          <Pause className="size-5 fill-current" />
                        </button>
                        <button
                          className="size-10 rounded-full bg-red-500 flex items-center justify-center text-white hover:bg-red-600 transition-colors shadow-lg"
                          onClick={(e) => {
                            e.stopPropagation();
                            setIsFocusActive(false);
                            setIsFocusExpanded(false);
                          }}
                        >
                          <Square className="size-4 fill-current" />
                        </button>
                      </div>
                    </div>

                    {/* Task Details Section */}
                    <div className="relative z-10 bg-black/20 backdrop-blur-md border-t border-white/5 p-3">
                      <div className="space-y-4">
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <span className="text-[9px] font-bold text-emerald-400/80 uppercase tracking-widest leading-none">Working On</span>
                            <h3 className="text-[13px] font-bold text-white leading-tight mt-1">{activeTask.title}</h3>
                          </div>
                          <span className="text-[9px] font-bold text-emerald-400/50 uppercase tracking-widest">45m left</span>
                        </div>

                        <div className="space-y-2.5">
                          {[
                            { text: "Review current wireframe flow", done: true },
                            { text: "Map edge cases for onboarding", done: false },
                            { text: "Export assets", done: false }
                          ].map((step, i) => (
                            <div key={i} className={cn("flex items-center gap-3", step.done ? "opacity-100" : "opacity-30")}>
                              <div className={cn(
                                "size-3.5 rounded-full border-2 flex items-center justify-center",
                                step.done ? "border-emerald-500 bg-emerald-500 text-white" : "border-white/20"
                              )}>
                                {step.done && <CheckCircle2 className="size-2" />}
                              </div>
                              <span className="text-[11px] font-medium text-white/90">{step.text}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="relative z-10 h-full flex items-center justify-between px-5">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold text-emerald-400/80 uppercase tracking-widest leading-none mb-1">
                        {isFocusActive ? "Focusing On" : "Focus Mode"}
                      </span>
                      <h3 className={cn(
                        "text-[13px] font-bold truncate max-w-[200px]",
                        isFocusActive ? "text-white" : "text-white/40 italic"
                      )}>
                        {activeTask?.title || "No task in focus"}
                      </h3>
                    </div>
                    <div className={cn(
                      "font-mono font-bold text-lg transition-colors",
                      isFocusActive ? "text-white" : "text-white/20"
                    )}>
                      {isFocusActive ? "01:24:08" : "00:00:00"}
                    </div>
                  </div>
                )}
              </Card>
            </section>

            {/* Decisions Section */}
            <section className="space-y-4">
              <div className="flex items-center justify-between px-1">
                <div className="space-y-1">
                  <h2 className="text-xl font-bold tracking-tight text-[#0F172A]">Decisions</h2>
                  <p className="text-[10px] font-medium text-slate-400 uppercase tracking-widest">Action Required</p>
                </div>
                <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
              </div>

              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden transition-all duration-300 hover:shadow-md">
                <Table>
                  <TableBody>
                    {DECISIONS.map((decision) => (
                      <TableRow key={decision.id} className="group hover:bg-slate-50/10 border-slate-100 transition-colors">
                        <TableCell className="px-4 py-4">
                          <div className="flex flex-col space-y-3">
                            {/* Header: Title and Priority */}
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex flex-col gap-1">
                                <span className="text-[13px] font-bold text-slate-900 leading-tight group-hover:text-[#4F46E5] transition-colors">
                                  {decision.title}
                                </span>
                                <span className="text-[10px] text-slate-500 font-medium italic line-clamp-2">
                                  {decision.context}
                                </span>
                              </div>
                              <Badge
                                variant="outline"
                                className={cn(
                                  "text-[8px] h-4 px-1.5 font-black uppercase tracking-tighter border-none shrink-0",
                                  decision.priority === "High" ? "bg-red-100 text-red-600" : "bg-amber-100 text-amber-600"
                                )}
                              >
                                {decision.priority}
                              </Badge>
                            </div>

                            {/* Meta: Type, Deadline, Status */}
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-1">
                              <Badge variant="secondary" className="bg-indigo-50 text-indigo-600 text-[8px] uppercase tracking-wider font-extrabold border-none px-1.5 py-0">
                                {decision.type}
                              </Badge>
                              <div className="flex items-center gap-1.5 text-[9px] font-bold text-slate-400">
                                <Clock className="size-2.5" />
                                {decision.deadline}
                              </div>
                              <div className="flex items-center gap-1.5">
                                <div className={cn(
                                  "h-1 w-1 rounded-full",
                                  decision.status === "Pending" ? "bg-amber-400" : "bg-blue-400"
                                )} />
                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">{decision.status}</span>
                              </div>
                            </div>

                            {/* Risk Highlight */}
                            <span className="text-[9px] font-bold text-red-500/80 flex items-center gap-1.5 bg-red-50/50 w-fit px-2 py-0.5 rounded-md border border-red-100/50">
                              <span className="h-1 w-1 rounded-full bg-red-500" />
                              {decision.risk}
                            </span>

                            {/* Actions: Full width compact buttons */}
                            <div className="grid grid-cols-2 gap-2 pt-1">
                              <Button size="sm" className="h-8 text-[10px] font-bold bg-[#4F46E5] hover:bg-[#4338CA] shadow-sm hover:shadow-indigo-500/20 transition-all rounded-lg text-white">
                                Approve
                              </Button>
                              <Button size="sm" variant="outline" className="h-8 text-[10px] font-bold text-slate-600 border-slate-200 hover:bg-slate-50 transition-all rounded-lg">
                                Review
                              </Button>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </section>
          </aside>
        </div>

        {/* Blockers Section (Full Width) */}
        <section className="mt-16 pt-16 border-t border-slate-100 space-y-8">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-xl font-bold tracking-tight text-[#0F172A]">Blockers Requiring Attention</h2>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-[#64748B]/60 uppercase tracking-widest">AI Suggestion Engine Active</span>
            </div>
          </div>
          <div className="space-y-3">
            {BLOCKERS.map(blocker => (
              <BlockerCard key={blocker.id} blocker={blocker} />
            ))}
          </div>
        </section>

        {/* Personal Efficiency Snapshot (Collapsible) */}
        <section className="mt-16">
          <Collapsible open={isEfficiencyExpanded} onOpenChange={setIsEfficiencyExpanded}>
            <div className="flex items-center justify-between group cursor-pointer" onClick={() => setIsEfficiencyExpanded(!isEfficiencyExpanded)}>
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-bold tracking-tight text-[#0F172A]">Personal Efficiency Snapshot</h2>
                <Badge variant="outline" className="rounded-full text-[10px] font-bold text-slate-400 border-slate-200">PRIVATE</Badge>
              </div>
              <Button variant="ghost" size="sm" className="rounded-full text-[#64748B]">
                {isEfficiencyExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </div>

            <CollapsibleContent className="mt-8">
              <Card className="border-none bg-white/50 backdrop-blur-sm shadow-sm overflow-hidden p-8">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-12">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[#64748B] uppercase tracking-wider">Deep Work</span>
                      <span className="text-xs font-bold text-[#0F172A]">2h 40m</span>
                    </div>
                    <Progress value={65} className="h-1.5 bg-slate-200" />
                    <p className="text-[10px] text-emerald-600 font-bold flex items-center gap-1">
                      <TrendingUp size={12} /> 15% vs yesterday
                    </p>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[#64748B] uppercase tracking-wider">Meetings</span>
                      <span className="text-xs font-bold text-[#0F172A]">3h 10m</span>
                    </div>
                    <Progress value={80} className="h-1.5 bg-slate-200" />
                    <p className="text-[10px] text-amber-600 font-bold flex items-center gap-1">
                      High meeting density
                    </p>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[#64748B] uppercase tracking-wider">Ctx Switches</span>
                      <span className="text-xs font-bold text-[#0F172A]">11</span>
                    </div>
                    <Progress value={40} className="h-1.5 bg-slate-200" />
                    <p className="text-[10px] text-emerald-600 font-bold flex items-center gap-1">
                      Low (Stable focus)
                    </p>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[#64748B] uppercase tracking-wider">Rhythm</span>
                      <span className="text-xs font-bold text-[#0F172A]">Steady</span>
                    </div>
                    <div className="flex gap-1 h-1.5">
                      {[40, 60, 30, 80, 50, 90, 70].map((v, i) => (
                        <div key={i} className="flex-1 bg-[#2563EB]/20 rounded-full relative overflow-hidden">
                          <div className="absolute bottom-0 left-0 right-0 bg-[#2563EB]" style={{ height: `${v}%` }} />
                        </div>
                      ))}
                    </div>
                    <p className="text-[10px] text-[#64748B] font-bold italic">
                      Peak performance: 10AM
                    </p>
                  </div>
                </div>
              </Card>
            </CollapsibleContent>
          </Collapsible>
        </section>
      </main >

      {/* Customize View Trigger */}
      < div className="fixed bottom-8 right-8" >
        <Button className="rounded-full shadow-2xl h-12 px-6 bg-[#0F172A] hover:bg-[#1E293B] text-white font-bold gap-2 transition-transform duration-200 hover:scale-105 active:scale-95">
          <Plus className="h-4 w-4" />
          Customize View
        </Button>
      </div >
    </div >
  );
}
