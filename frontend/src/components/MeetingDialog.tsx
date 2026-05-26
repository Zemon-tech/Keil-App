import React, { useState } from "react";
import { useMeetingStore } from "@/store/useMeetingStore";
import { MeetingRecorder } from "./MeetingRecorder";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "motion/react";
import { Mic, Pause, Play, Square, Maximize2, X, Minimize2 } from "lucide-react";

export const MeetingDialog: React.FC = () => {
  const {
    isDialogOpen,
    isMinimized,
    status,
    duration,
    volumes,
    closeDialog,
    minimizeDialog,
    restoreDialog,
    setRequestAction,
  } = useMeetingStore();

  const [isHovered, setIsHovered] = useState(false);

  // Keep mounted if dialog open, or if minimized, or if active recording/uploading/processing
  const shouldRender = isDialogOpen || isMinimized || (status !== "idle" && status !== "completed");

  if (!shouldRender) return null;

  const isVisible = isDialogOpen && !isMinimized;
  const isCompleted = status === "completed" || status === "error";

  // Time formatter helper
  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return [
      h > 0 ? h : null,
      m.toString().padStart(2, "0"),
      s.toString().padStart(2, "0"),
    ]
      .filter((x) => x !== null)
      .join(":");
  };

  return (
    <>
      {/* ─── Standard Dialog Overlay ─── */}
      <div
        className={cn(
          "fixed inset-0 z-50 flex items-center justify-center transition-all duration-500",
          isVisible ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
      >
        {/* Dark Editorial Backdrop */}
        <div
          className={cn(
            "absolute inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-md transition-opacity duration-500",
            isVisible ? "opacity-100" : "opacity-0"
          )}
          onClick={() => {
            if (status === "recording") {
              minimizeDialog();
            } else {
              closeDialog();
            }
          }}
        />

        {/* Floating Companion Container */}
        <div
          className={cn(
            "relative w-full overflow-hidden transition-all duration-500 transform ease-[cubic-bezier(0.16,1,0.3,1)]",
            isCompleted ? "max-w-[780px]" : "max-w-[440px]",
            isVisible
              ? "scale-100 translate-y-0 opacity-100"
              : "scale-95 translate-y-8 opacity-0 pointer-events-none"
          )}
        >
          {/* Glass-Morphic Aesthetic Outer Shell */}
          <div className="w-full bg-[#070708]/90 dark:bg-[#070708]/95 border border-white/5 dark:border-white/10 rounded-2xl shadow-2xl overflow-hidden glass-card">
            <MeetingRecorder />
          </div>
        </div>
      </div>

      {/* ─── Persistent Minimized Draggable Floating Dock ─── */}
      <AnimatePresence>
        {isMinimized && (
          <motion.div
            drag
            dragElastic={0.1}
            dragMomentum={false}
            initial={{ opacity: 0, scale: 0.9, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 30 }}
            onHoverStart={() => setIsHovered(true)}
            onHoverEnd={() => setIsHovered(false)}
            onDoubleClick={restoreDialog}
            className="fixed bottom-6 right-6 z-[99999] w-[260px] bg-[#0A0A0B]/95 border border-white/10 p-3.5 rounded-2xl shadow-2xl cursor-grab active:cursor-grabbing select-none hover:border-white/20 transition-colors"
          >
            {/* Standard dock content */}
            <div className="flex flex-col gap-2.5">
              {/* Top row status */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "size-2 rounded-full",
                      status === "recording" ? "bg-rose-500 animate-pulse" : "bg-amber-500"
                    )}
                  />
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-[#7A7A7A]">
                    {status === "recording"
                      ? "Recording"
                      : status === "uploading"
                      ? "Uploading"
                      : "Processing"}
                  </span>
                </div>
                <span className="text-[11px] font-mono font-medium text-neutral-300 tabular-nums">
                  {formatTime(duration)}
                </span>
              </div>

              {/* Real-time micro visualizer waveform */}
              <div className="h-6 flex items-center justify-center gap-[3px] mt-0.5">
                {volumes.map((val, idx) => (
                  <motion.div
                    key={idx}
                    animate={{
                      height: status === "recording" ? `${Math.max(val * 100, 15)}%` : "15%",
                    }}
                    transition={{
                      type: "spring",
                      stiffness: 350,
                      damping: 18,
                    }}
                    className={cn(
                      "w-[3px] rounded-full transition-colors duration-300",
                      status === "recording" ? "bg-cyan-500/80" : "bg-[#7A7A7A]/40"
                    )}
                  />
                ))}
              </div>
            </div>

            {/* Quick Actions Hover Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: isHovered ? 1 : 0 }}
              transition={{ duration: 0.15 }}
              className="absolute inset-0 bg-[#0B0B0C]/95 rounded-2xl flex items-center justify-between px-4 pointer-events-auto"
              style={{ pointerEvents: isHovered ? "auto" : "none" }}
            >
              <div className="flex items-center gap-1.5">
                <Mic className="size-3.5 text-[#B3B3B3]" />
                <span className="text-[10px] font-medium text-[#FFFFFF] truncate max-w-[90px]">
                  Capture Companion
                </span>
              </div>

              {/* Quick actions controls */}
              <div className="flex items-center gap-1">
                {status === "recording" && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setRequestAction("pause");
                    }}
                    className="size-7 rounded-lg hover:bg-white/5 border border-white/5 flex items-center justify-center text-[#B3B3B3] hover:text-white transition-colors cursor-pointer"
                    title="Pause recording"
                  >
                    <Pause className="size-3.5" />
                  </button>
                )}
                {status === "recording" && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setRequestAction("stop");
                    }}
                    className="size-7 rounded-lg hover:bg-rose-500/10 border border-white/5 flex items-center justify-center text-rose-400 hover:text-rose-300 transition-colors cursor-pointer"
                    title="Stop & Process"
                  >
                    <Square className="size-3.5" />
                  </button>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    restoreDialog();
                  }}
                  className="size-7 rounded-lg hover:bg-white/5 border border-white/5 flex items-center justify-center text-[#B3B3B3] hover:text-white transition-colors cursor-pointer"
                  title="Expand to Full view"
                >
                  <Maximize2 className="size-3.5" />
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
