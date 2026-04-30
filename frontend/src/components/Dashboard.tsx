import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { useSidebar } from "@/components/ui/sidebar";
import { HeroSection } from "./dashboard/HeroSection";
import { CurrentFocusCard } from "./dashboard/CurrentFocusCard";
import { NextEventCard } from "./dashboard/NextEventCard";
import { ImmediateBlockersCard } from "./dashboard/ImmediateBlockersCard";
import { NeedsReplyCard } from "./dashboard/NeedsReplyCard";
import { UpNextCard } from "./dashboard/UpNextCard";
import { useDashboard, useOrgDashboard } from "@/hooks/api/useDashboard";
import { useAppContext } from "@/contexts/AppContext";
import { AlertCircle } from "lucide-react";

export function Dashboard() {
  const { state } = useSidebar();
  const [mounted, setMounted] = useState(false);

  // ── Mode awareness ─────────────────────────────────────────
  const { mode, activeOrgId, activeSpaceId } = useAppContext();
  const isOrgMode = mode === "organisation";

  // ── Legacy workspace dashboard (personal mode or fallback) ──
  const { data: legacyData, isLoading: legacyLoading, isError: legacyError } = useDashboard();

  // ── Org/space-scoped dashboard (organisation mode) ──────────
  const { data: orgData, isLoading: orgLoading, isError: orgError } = useOrgDashboard(
    isOrgMode ? activeOrgId : null,
    isOrgMode ? activeSpaceId : null
  );

  // Use the correct source based on mode
  const data = isOrgMode ? orgData : legacyData;
  const isLoading = isOrgMode ? orgLoading : legacyLoading;
  const isError = isOrgMode ? orgError : legacyError;

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
          "h-full flex flex-col items-center relative overflow-hidden overscroll-none"
        )}
      >
        <div className="w-full flex flex-col items-center pt-25 lg:pt-30">
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
            <NextEventCard />
            <ImmediateBlockersCard tasks={data?.immediate ?? []} isLoading={isLoading} />
            <NeedsReplyCard />
            <UpNextCard tasks={data?.today ?? []} isLoading={isLoading} />
          </section>
        </div>
      </main>
    </div>
  );
}
