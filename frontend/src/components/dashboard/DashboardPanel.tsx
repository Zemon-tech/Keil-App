"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  CheckSquare,
  Clock3,
  MessageCircle,
} from "lucide-react";

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

const REPLY_COUNT = 0;

export function DashboardPanel({ data, isLoading }: DashboardPanelProps) {
  const [now, setNow] = useState(() => new Date());
  const [dimensions, setDimensions] = useState({
    containerHeight: 154,
    itemHeight: 154,
    radius: 76,
    perspective: 900,
  });

  useEffect(() => {
    function handleResize() {
      const height = window.innerHeight;
      if (height >= 850) {
        setDimensions({
          containerHeight: 168,
          itemHeight: 168,
          radius: 82,
          perspective: 1000,
        });
      } else if (height >= 720) {
        setDimensions({
          containerHeight: 154,
          itemHeight: 154,
          radius: 76,
          perspective: 900,
        });
      } else {
        setDimensions({
          containerHeight: 136,
          itemHeight: 136,
          radius: 64,
          perspective: 750,
        });
      }
    }

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

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

  const urgentCount = data?.immediate?.length ?? 0;
  const queuedCount = data?.today?.length ?? 0;
  const dayLabel = new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(now);
  const timeLabel = new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(now);

  const stats = [
    {
      Icon: AlertTriangle,
      label: "Urgent",
      value: urgentCount,
      tone: "text-red-500 bg-red-500/10 border-red-500/15",
    },
    {
      Icon: MessageCircle,
      label: "Replies",
      value: REPLY_COUNT,
      tone: "text-blue-500 bg-blue-500/10 border-blue-500/15",
    },
    {
      Icon: CheckSquare,
      label: "Queued",
      value: queuedCount,
      tone: "text-emerald-500 bg-emerald-500/10 border-emerald-500/15",
    },
  ];

  return (
    <div className="w-full max-w-[54rem] px-4 mt-4 sm:mt-5">
      <div
        className={cn(
          "flex w-full flex-col overflow-hidden rounded-[1.45rem] border border-border/70 bg-background/92 backdrop-blur-xl",
          "shadow-[0_22px_70px_-54px_rgba(15,23,42,0.48)] transition-all duration-300 ease-in-out",
          "sm:flex-row",
        )}
        style={{ height: dimensions.containerHeight }}
      >
        <div className="relative size-full shrink-0 border-b border-border/60 bg-muted/15 sm:w-[31%] sm:border-b-0 sm:border-r">
          <WheelPicker
            items={wheelItems}
            containerHeight={dimensions.containerHeight}
            itemHeight={dimensions.itemHeight}
            radius={dimensions.radius}
            perspective={dimensions.perspective}
          />
        </div>

        <div className="relative flex min-w-0 flex-1 items-stretch">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-muted/20 via-transparent to-transparent" />
          <div className="relative z-10 grid min-h-0 w-full grid-cols-[1.15fr_1fr] gap-3 p-3 sm:p-4">
            <div className="flex min-w-0 flex-col justify-between rounded-2xl border border-border/60 bg-card/55 p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <CalendarDays className="size-4 shrink-0 text-muted-foreground" />
                  <span className="truncate text-xs font-medium text-muted-foreground">
                    {dayLabel}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 rounded-full border border-emerald-500/15 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-medium text-emerald-500">
                  <CheckCircle2 className="size-3" />
                  Live
                </div>
              </div>
              <div>
                <div className="flex items-end gap-2">
                  <Clock3 className="mb-1 size-4 text-muted-foreground" />
                  <p className="truncate text-2xl font-semibold leading-none text-foreground">
                    {timeLabel}
                  </p>
                </div>
                <p className="mt-2 truncate text-xs text-muted-foreground">
                  Workspace snapshot
                </p>
              </div>
            </div>

            <div className="grid min-h-0 min-w-0 grid-rows-3 gap-2">
              {stats.map(({ Icon, label, value, tone }) => (
                <div
                  key={label}
                  className="flex min-h-0 min-w-0 items-center justify-between gap-3 rounded-xl border border-border/55 bg-card/45 px-3 py-1"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      className={cn(
                        "flex size-6 shrink-0 items-center justify-center rounded-lg border",
                        tone,
                      )}
                    >
                      <Icon className="size-3" />
                    </span>
                    <span className="truncate text-[11px] font-medium text-muted-foreground">
                      {label}
                    </span>
                  </div>
                  <span className="shrink-0 text-sm font-semibold text-foreground">
                    {isLoading ? "-" : value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
