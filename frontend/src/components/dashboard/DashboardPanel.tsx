"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { WheelPicker } from "./WheelPicker";
import { ImmediateBlockersCard } from "./ImmediateBlockersCard";
import { NeedsReplyCard } from "./NeedsReplyCard";
import { UpNextCard } from "./UpNextCard";
import type { DashboardResponse } from "@/hooks/api/useDashboard";

interface DashboardPanelProps {
  data: DashboardResponse | undefined;
  isLoading: boolean;
}

export function DashboardPanel({ data, isLoading }: DashboardPanelProps) {
  // Track viewport height to adapt layouts smoothly
  const [dimensions, setDimensions] = useState({
    containerHeight: 350,
    itemHeight: 120,
    radius: 170,
    perspective: 1100,
  });

  useEffect(() => {
    function handleResize() {
      const height = window.innerHeight;
      if (height >= 850) {
        setDimensions({
          containerHeight: 250,
          itemHeight: 135,
          radius: 130,
          perspective: 1000,
        });
      } else if (height >= 720) {
        setDimensions({
          containerHeight: 220,
          itemHeight: 120,
          radius: 110,
          perspective: 900,
        });
      } else {
        setDimensions({
          containerHeight: 170,
          itemHeight: 96,
          radius: 80,
          perspective: 750,
        });
      }
    }

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Right Wheel Items — Blockers, Needs Reply, Up Next
  const wheelItems = [
    <ImmediateBlockersCard
      key="blockers"
      tasks={data?.immediate ?? []}
      isLoading={isLoading}
      isWheel
    />,
    <NeedsReplyCard key="reply" isWheel />,
    <UpNextCard
      key="upnext"
      tasks={data?.today ?? []}
      isLoading={isLoading}
      isWheel
    />,
  ];

  const isCompact = dimensions.itemHeight <= 100;
  const isTall = dimensions.itemHeight >= 135;

  // The center card height must exactly match itemHeight — the visible height
  // of the active (front-facing) card in the wheel.
  const centerCardHeight = dimensions.itemHeight;

  return (
    // Match max-w-[54rem] and horizontal padding to align perfectly with the chat input box
    <div className="w-full max-w-[54rem] px-4 mt-1 sm:mt-2 flex flex-col sm:flex-row gap-4 items-center">

      {/* Left — Wheel Picker (30%) */}
      <div
        className="flex flex-col justify-center transition-all duration-300 ease-in-out w-full sm:w-[30%] shrink-0"
        style={{ height: dimensions.containerHeight }}
      >
        <WheelPicker
          items={wheelItems}
          containerHeight={dimensions.containerHeight}
          itemHeight={dimensions.itemHeight}
          radius={dimensions.radius}
          perspective={dimensions.perspective}
        />
      </div>

      {/* Right — Today's Focus (70%) — height matches active wheel card */}
      <div
        className={cn(
          "flex flex-col items-center justify-center px-6 w-full sm:w-[70%]",
          "bg-card/30 rounded-[2.5rem] border border-border/40 backdrop-blur-md",
          "relative overflow-hidden group shadow-2xl shadow-primary/5",
          "transition-all duration-300 ease-in-out",
        )}
        style={{ height: centerCardHeight }}
      >
        {/* Background decorations */}
        <div className="absolute inset-0 bg-gradient-to-b from-primary/10 via-transparent to-primary/5 opacity-50" />
        <div className="absolute -top-16 -right-16 w-32 h-32 bg-primary/10 rounded-full blur-3xl animate-pulse" />
        <div
          className="absolute -bottom-16 -left-16 w-32 h-32 bg-primary/10 rounded-full blur-3xl animate-pulse"
          style={{ animationDelay: "1s" }}
        />

        <div
          className={cn(
            "relative z-10 text-center flex flex-col items-center justify-center h-full w-full",
            isCompact ? "gap-1" : isTall ? "gap-3" : "gap-2",
          )}
        >
          <div
            className={cn(
              "inline-flex items-center justify-center rounded-xl bg-primary/10",
              isCompact ? "p-1.5" : "p-2.5",
            )}
          >
            <div className="h-2.5 w-2.5 rounded-full bg-primary animate-ping" />
          </div>
          <h2
            className={cn(
              "font-bold tracking-tight bg-gradient-to-b from-foreground to-foreground/70 bg-clip-text text-transparent",
              isCompact ? "text-base" : isTall ? "text-2xl" : "text-xl",
            )}
          >
            Today's Focus
          </h2>
          <p
            className={cn(
              "text-muted-foreground/80 max-w-[340px] leading-snug",
              isCompact ? "text-[11px]" : "text-xs",
            )}
          >
            You have{" "}
            <span className="text-primary font-semibold">
              {data?.immediate?.length ?? 0} urgent tasks
            </span>{" "}
            and 1 meeting coming up.
          </p>
        </div>
      </div>
    </div>
  );
}
