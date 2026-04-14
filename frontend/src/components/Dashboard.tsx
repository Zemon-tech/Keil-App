import { useEffect, useState, useMemo } from "react";
import { startOfToday, endOfToday } from "date-fns";
import { cn } from "@/lib/utils";
import { useSidebar } from "@/components/ui/sidebar";
import { HeroSection } from "./dashboard/HeroSection";
import { CurrentFocusCard } from "./dashboard/CurrentFocusCard";
import { NextEventCard } from "./dashboard/NextEventCard";
import { ImmediateBlockersCard } from "./dashboard/ImmediateBlockersCard";
import { NeedsReplyCard } from "./dashboard/NeedsReplyCard";
import { UpNextCard } from "./dashboard/UpNextCard";
import { useDashboard } from "@/hooks/api/useDashboard";
import { useCalendarTasks } from "@/hooks/api/useSchedule";
import { AlertCircle } from "lucide-react";

export function Dashboard() {
  const { state } = useSidebar();
  const [mounted, setMounted] = useState(false);
  const { data, isLoading, isError } = useDashboard();

  // Fetch today's calendar events for NextEventCard
  const todayStart = useMemo(() => startOfToday().toISOString(), []);
  const todayEnd = useMemo(() => endOfToday().toISOString(), []);
  const { data: calendarData, isLoading: calendarLoading } = useCalendarTasks({
    start_range: todayStart,
    end_range: todayEnd,
  });
  const nextEvent = calendarData?.[0] ?? null;

  useEffect(() => {
    setMounted(true);
  }, []);

  const isCollapsed = state === "collapsed";
  const containerClassName = cn(
    "mx-auto transition-all duration-500 ease-in-out px-4 sm:px-6 lg:px-10",
    isCollapsed ? "max-w-[1400px]" : "max-w-6xl"
  );

  if (!mounted) return null;

  return (
    <div
      className="h-[100dvh] bg-background text-foreground overflow-hidden overscroll-none"
    >
      <main
        className={cn(
          containerClassName,
          "h-full pt-10 lg:pt-12 flex flex-col items-center relative overflow-hidden overscroll-none"
        )}
      >
        {/* Hero: greeting + input area */}
        <HeroSection />

        {isError && (
          <div className="w-full max-w-4xl mt-4 flex items-center justify-center p-4 bg-destructive/10 text-destructive rounded-lg gap-2 text-sm border border-destructive/20">
            <AlertCircle className="w-4 h-4" />
            <span>Failed to load dashboard data. Please try again.</span>
          </div>
        )}

        {/* Widgets grid */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full max-w-4xl mt-10 opacity-90 hover:opacity-100 transition-opacity">
          <CurrentFocusCard task={data?.immediate?.[0] ?? null} isLoading={isLoading} />
          <NextEventCard block={nextEvent} isLoading={calendarLoading} />
          <ImmediateBlockersCard tasks={data?.immediate ?? []} isLoading={isLoading} />
          <NeedsReplyCard />
          <UpNextCard tasks={data?.today ?? []} isLoading={isLoading} />
        </section>
      </main>
    </div>
  );
}
