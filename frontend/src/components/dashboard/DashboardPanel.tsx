"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  AlertTriangle,
  CheckCircle2,
  CheckSquare,
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

const REPLY_COUNT = 3;

export function DashboardPanel({ data, isLoading }: DashboardPanelProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [dimensions, setDimensions] = useState({
    containerHeight: 154,
    itemHeight: 136,
    radius: 76,
    perspective: 900,
  });

  useEffect(() => {
    function handleResize() {
      const height = window.innerHeight;
      if (height >= 850) {
        setDimensions({
          containerHeight: 168,
          itemHeight: 148,
          radius: 82,
          perspective: 1000,
        });
      } else if (height >= 720) {
        setDimensions({
          containerHeight: 154,
          itemHeight: 136,
          radius: 76,
          perspective: 900,
        });
      } else {
        setDimensions({
          containerHeight: 136,
          itemHeight: 118,
          radius: 64,
          perspective: 750,
        });
      }
    }

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
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

  const focusItems = [
    {
      Icon: AlertTriangle,
      label: "Immediate Blockers",
      count: data?.immediate?.length ?? 0,
      eyebrow: "Needs attention",
      title:
        (data?.immediate?.length ?? 0) > 0
          ? `${data?.immediate?.length ?? 0} blocker${
              data?.immediate?.length === 1 ? "" : "s"
            } to clear`
          : "No blockers right now",
      description:
        data?.immediate?.[0]?.title ??
        "Your active work is not blocked. Keep moving through the next task.",
      tone: "text-red-600 bg-red-50 border-red-100 dark:text-red-400 dark:bg-red-950/30 dark:border-red-900/40",
      metricLabel: "Urgent",
    },
    {
      Icon: MessageCircle,
      label: "Needs Reply",
      count: REPLY_COUNT,
      eyebrow: "Team messages",
      title: "Threads waiting on you",
      description:
        "Review the latest conversations and reply where your input can unblock progress.",
      tone: "text-blue-600 bg-blue-50 border-blue-100 dark:text-blue-400 dark:bg-blue-950/30 dark:border-blue-900/40",
      metricLabel: "Replies",
    },
    {
      Icon: CheckSquare,
      label: "Up Next",
      count: data?.today?.length ?? 0,
      eyebrow: "Today",
      title:
        (data?.today?.length ?? 0) > 0
          ? `${data?.today?.length ?? 0} item${
              data?.today?.length === 1 ? "" : "s"
            } queued`
          : "Nothing queued yet",
      description:
        data?.today?.[0]?.title ??
        "Add a task when you are ready to line up the next piece of work.",
      tone: "text-emerald-600 bg-emerald-50 border-emerald-100 dark:text-emerald-400 dark:bg-emerald-950/30 dark:border-emerald-900/40",
      metricLabel: "Queued",
    },
  ];

  const activeFocus = focusItems[activeIndex] ?? focusItems[0];
  const ActiveIcon = activeFocus.Icon;

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
        <div className="relative h-full w-full shrink-0 border-b border-border/60 bg-muted/15 sm:w-[31%] sm:border-b-0 sm:border-r">
          <WheelPicker
            items={wheelItems}
            containerHeight={dimensions.containerHeight}
            itemHeight={dimensions.itemHeight}
            radius={dimensions.radius}
            perspective={dimensions.perspective}
            onActiveIndexChange={setActiveIndex}
          />
        </div>

        <div className="relative flex min-w-0 flex-1 items-center px-5 sm:px-6">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-muted/20 via-transparent to-transparent" />

          <AnimatePresence mode="wait">
            <motion.div
              key={activeIndex}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="relative z-10 flex w-full min-w-0 items-center justify-between gap-4"
            >
              <div className="flex min-w-0 items-center gap-3">
                <div
                  className={cn(
                    "flex size-11 shrink-0 items-center justify-center rounded-2xl border",
                    activeFocus.tone,
                  )}
                >
                  <ActiveIcon className="size-5" />
                </div>

                <div className="min-w-0">
                  <div className="mb-1 flex items-center gap-2">
                    <span className="text-[10px] font-semibold uppercase text-muted-foreground">
                      {activeFocus.label}
                    </span>
                    <span className="hidden rounded-full border border-border/70 px-2 py-0.5 text-[10px] font-medium text-muted-foreground sm:inline-flex">
                      {activeFocus.eyebrow}
                    </span>
                  </div>
                  <h2 className="truncate text-base font-semibold leading-tight text-foreground">
                    {activeFocus.title}
                  </h2>
                  <p className="mt-1 max-w-[24rem] truncate text-xs leading-snug text-muted-foreground">
                    {activeFocus.description}
                  </p>
                </div>
              </div>

              <div className="hidden shrink-0 items-center gap-2 md:flex">
                <div className="rounded-full border border-border/70 bg-card/80 px-3 py-1.5 text-[11px] font-medium text-muted-foreground">
                  {activeFocus.count} {activeFocus.metricLabel}
                </div>
                <div className="flex items-center gap-1.5 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1.5 text-[11px] font-medium text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-400">
                  <CheckCircle2 className="size-3" />
                  Live
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
