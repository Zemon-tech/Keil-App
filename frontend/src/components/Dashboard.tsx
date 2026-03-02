import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { useSidebar } from "@/components/ui/sidebar";
import { HeroSection } from "./dashboard/HeroSection";
import { CurrentFocusCard } from "./dashboard/CurrentFocusCard";
import { NextEventCard } from "./dashboard/NextEventCard";
import { ImmediateBlockersCard } from "./dashboard/ImmediateBlockersCard";
import { NeedsReplyCard } from "./dashboard/NeedsReplyCard";
import { UpNextCard } from "./dashboard/UpNextCard";
import { QuickCaptureCard } from "./dashboard/QuickCaptureCard";

export function Dashboard() {
  const { state } = useSidebar();
  const [mounted, setMounted] = useState(false);

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
    <div className="min-h-screen bg-background text-foreground pb-16">
      <main
        className={cn(
          containerClassName,
          "pt-10 lg:pt-12 flex flex-col items-center relative"
        )}
      >
        {/* Hero: greeting + input area */}
        <HeroSection />

        {/* Widgets grid */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full max-w-4xl mt-10 opacity-90 hover:opacity-100 transition-opacity">
          <CurrentFocusCard />
          <NextEventCard />
          <ImmediateBlockersCard />
          <NeedsReplyCard />
          <UpNextCard />
        </section>
      </main>
    </div>
  );
}
