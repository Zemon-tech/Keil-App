import React from "react";
import { useMeetingStore } from "@/store/useMeetingStore";
import { MeetingRecorder } from "./MeetingRecorder";
import { cn } from "@/lib/utils";

export const MeetingDialog: React.FC = () => {
  const { isDialogOpen, isMinimized, status, closeDialog, minimizeDialog } = useMeetingStore();

  // Keep it mounted if the dialog is open, or if minimized, or if actively recording/uploading/processing
  const shouldRender = isDialogOpen || isMinimized || (status !== "idle" && status !== "completed");

  if (!shouldRender) return null;

  const isVisible = isDialogOpen && !isMinimized;

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center transition-all duration-300",
        isVisible ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
      )}
    >
      {/* Backdrop with premium blur */}
      <div
        className={cn(
          "absolute inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm transition-opacity duration-300",
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

      {/* Premium Centered Dialog Container */}
      <div
        className={cn(
          "relative w-full max-w-[780px] rounded-[14px] overflow-hidden bg-background border border-black/8 dark:border-white/8 shadow-2xl transition-all duration-300 transform ease-[cubic-bezier(0.16,1,0.3,1)]",
          isVisible 
            ? "scale-100 translate-y-0 opacity-100" 
            : "scale-95 translate-y-4 opacity-0 pointer-events-none"
        )}
      >
        <MeetingRecorder />
      </div>
    </div>
  );
};
