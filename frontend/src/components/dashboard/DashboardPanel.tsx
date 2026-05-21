"use client";

import React from "react";
import { WheelPicker } from "./WheelPicker";
import { CurrentFocusCard } from "./CurrentFocusCard";
import { NextEventCard } from "./NextEventCard";
import { ImmediateBlockersCard } from "./ImmediateBlockersCard";
import { NeedsReplyCard } from "./NeedsReplyCard";
import { UpNextCard } from "./UpNextCard";
import { QuickCaptureCard } from "./QuickCaptureCard";
import type { DashboardResponse } from "@/hooks/api/useDashboard";

interface DashboardPanelProps {
  data: DashboardResponse | undefined;
  isLoading: boolean;
}

export function DashboardPanel({ data, isLoading }: DashboardPanelProps) {
  // Left Wheel Items
  const leftItems = [
    <CurrentFocusCard
      key="focus"
      task={data?.immediate?.[0] ?? null}
      isLoading={isLoading}
      isWheel
    />,
    <NextEventCard key="event" isWheel />,
    <QuickCaptureCard key="capture" isWheel />,
  ];

  // Right Wheel Items
  const rightItems = [
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

  return (
    <div className="w-full max-w-6xl mt-10 grid grid-cols-1 md:grid-cols-3 gap-6 items-center h-[400px]">
      {/* Left Partition */}
      <div className="h-full flex flex-col justify-center">
        <WheelPicker items={leftItems} containerHeight={360} itemHeight={130} />
      </div>

      {/* Center Partition (Static) */}
      <div className="h-[360px] flex flex-col items-center justify-center p-8 bg-card/30 rounded-[2.5rem] border border-border/40 backdrop-blur-md relative overflow-hidden group shadow-2xl shadow-primary/5">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/10 via-transparent to-primary/5 opacity-50" />
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-primary/10 rounded-full blur-3xl animate-pulse" />
        <div
          className="absolute -bottom-24 -right-24 w-48 h-48 bg-primary/10 rounded-full blur-3xl animate-pulse"
          style={{ animationDelay: "1s" }}
        />

        <div className="relative z-10 text-center space-y-6">
          <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-primary/10 mb-2">
            <div className="h-3 w-3 rounded-full bg-primary animate-ping" />
          </div>
          <h2 className="text-3xl font-bold tracking-tight bg-gradient-to-b from-foreground to-foreground/70 bg-clip-text text-transparent">
            Today's Focus
          </h2>
          <p className="text-muted-foreground/80 text-sm max-w-[240px] leading-relaxed">
            Your day is looking productive. You have{" "}
            <span className="text-primary font-semibold">
              {data?.immediate?.length ?? 0} urgent tasks
            </span>{" "}
            and 1 meeting coming up.
          </p>
          <div className="pt-4 flex justify-center gap-3">
            <div className="h-1.5 w-12 rounded-full bg-primary shadow-[0_0_10px_rgba(var(--primary),0.5)]" />
            <div className="h-1.5 w-8 rounded-full bg-primary/30" />
            <div className="h-1.5 w-4 rounded-full bg-primary/10" />
          </div>
        </div>
      </div>

      {/* Right Partition */}
      <div className="h-full flex flex-col justify-center">
        <WheelPicker
          items={rightItems}
          containerHeight={360}
          itemHeight={130}
        />
      </div>
    </div>
  );
}
