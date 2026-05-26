import React from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { VisuallyHidden } from "radix-ui";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Mic,
  Copy,
  Download,
  ChevronRight,
  X,
  Loader2,
  CheckCircle,
  AlertCircle,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { useMeetingRecording, useDeleteRecording, useCancelTranscription } from "@/hooks/api/useMeetings";

interface MeetingReviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recordingId: string | null;
}

export const MeetingReviewDialog: React.FC<MeetingReviewDialogProps> = ({
  open,
  onOpenChange,
  recordingId,
}) => {
  const { data: recording, isLoading, isError } = useMeetingRecording(
    open ? recordingId : null
  );

  const deleteMutation = useDeleteRecording();
  const cancelMutation = useCancelTranscription();

  const handleDelete = async () => {
    if (!recordingId) return;
    if (confirm("Permanently delete this meeting recording and its audio file? This action is irreversible.")) {
      try {
        await deleteMutation.mutateAsync(recordingId);
        toast.success("Recording deleted successfully");
        onOpenChange(false);
      } catch (err: any) {
        console.error("Failed to delete recording:", err);
        toast.error("Failed to delete recording", {
          description: err.message || "An unexpected error occurred."
        });
      }
    }
  };

  const handleCancelTranscription = async () => {
    if (!recordingId) return;
    try {
      await cancelMutation.mutateAsync(recordingId);
      toast.success("Transcription sync cancelled");
    } catch (err: any) {
      console.error("Failed to cancel transcription:", err);
      toast.error("Failed to cancel transcription", {
        description: err.message || "An unexpected error occurred."
      });
    }
  };

  const transcript = recording?.transcript_text ?? null;
  const diarizedTranscript = recording?.transcript_diarized ?? null;
  const languageDetected = recording?.language_detected ?? null;
  const duration = recording?.audio_duration_seconds ?? 0;
  const status = recording?.transcription_status ?? "pending";

  // Speaker helpers
  const speakerIds: (string | number)[] = diarizedTranscript?.entries
    ? Array.from(
        new Set(
          diarizedTranscript.entries.map((e: any) => e.speaker_id)
        )
      )
    : [];
  const speakerCount = speakerIds.length > 0 ? speakerIds.length : 0;
  const wordCount = transcript
    ? transcript.split(/\s+/).filter(Boolean).length.toLocaleString()
    : "0";

  const getSpeakerColor = (speakerId: string | number) => {
    const id =
      parseInt(speakerId.toString().replace(/\D/g, "")) || 0;
    const colors = [
      "rgba(167,139,250,1)",
      "rgba(251,146,60,1)",
      "rgba(52,211,153,1)",
      "rgba(244,114,182,1)",
    ];
    return colors[id % colors.length];
  };

  const getSpeakerBg = (speakerId: string | number) => {
    const id =
      parseInt(speakerId.toString().replace(/\D/g, "")) || 0;
    const bgs = [
      "bg-violet-500/10 text-violet-400 border-violet-500/20 dark:border-violet-400/20",
      "bg-amber-500/10 text-amber-400 border-amber-500/20 dark:border-amber-400/20",
      "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 dark:border-emerald-400/20",
      "bg-pink-500/10 text-pink-400 border-pink-500/20 dark:border-pink-400/20",
    ];
    return bgs[id % bgs.length];
  };

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

  const formatSegmentTime = (seconds: number | string) => {
    const secs =
      typeof seconds === "string" ? parseFloat(seconds) : seconds;
    if (isNaN(secs)) return "00:00";
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const copyToClipboard = () => {
    if (!transcript) return;
    navigator.clipboard.writeText(transcript);
    toast.success("Transcript copied to clipboard!");
  };

  const downloadTextFile = () => {
    if (!transcript) return;
    const element = document.createElement("a");
    const file = new Blob([transcript], { type: "text/plain" });
    element.href = URL.createObjectURL(file);
    element.download = `meeting-transcript-${recordingId || "draft"}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        aria-describedby={undefined}
        className="!max-w-[780px] !w-full !rounded-[14px] !p-0 !gap-0 border border-black/8 dark:border-white/8 shadow-2xl overflow-hidden bg-background"
      >
        <VisuallyHidden.Root>
          <DialogTitle>Meeting Review</DialogTitle>
        </VisuallyHidden.Root>

        <div className="w-full max-w-[780px] bg-white dark:bg-[#0f0f11] rounded-[14px] overflow-hidden flex flex-col text-foreground select-none relative">
          {/* Header */}
          <header className="h-11 px-5 border-b border-black/7 dark:border-white/7 flex items-center justify-between shrink-0 bg-white dark:bg-[#0f0f11] z-10">
            <div className="flex items-center gap-2">
              <span
                className={`h-2 w-2 rounded-full ${
                  status === "completed"
                    ? "bg-emerald-500"
                    : status === "failed"
                    ? "bg-rose-500"
                    : "bg-amber-500"
                }`}
              />
              <span className="text-[11px] font-medium tracking-widest text-muted-foreground uppercase">
                Keil HQ · Meeting Review
              </span>
            </div>

            <div className="flex items-center gap-1">
              {status === "completed" && transcript && (
                <>
                  <button
                    onClick={copyToClipboard}
                    title="Copy Transcript"
                    className="p-1.5 rounded-md hover:bg-black/5 dark:hover:bg-white/5 text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                  <button
                    onClick={downloadTextFile}
                    title="Download Transcript"
                    className="p-1.5 rounded-md hover:bg-black/5 dark:hover:bg-white/5 text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                  >
                    <Download className="h-4 w-4" />
                  </button>
                  <div className="h-4 w-px bg-black/8 dark:bg-white/8 mx-1" />
                </>
              )}

              {(status === "pending" || status === "processing") && (
                <>
                  <button
                    onClick={handleCancelTranscription}
                    disabled={cancelMutation.isPending}
                    title="Cancel Transcription"
                    className="p-1.5 rounded-md hover:bg-amber-500/10 dark:hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 cursor-pointer transition-colors flex items-center justify-center shrink-0"
                  >
                    {cancelMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <X className="h-4 w-4 text-amber-500" />
                    )}
                  </button>
                  <div className="h-4 w-px bg-black/8 dark:bg-white/8 mx-1" />
                </>
              )}

              {recordingId && (
                <>
                  <button
                    onClick={handleDelete}
                    disabled={deleteMutation.isPending}
                    title="Delete Recording"
                    className="p-1.5 rounded-md hover:bg-rose-500/10 dark:hover:bg-rose-500/20 text-rose-500 dark:text-rose-400 cursor-pointer transition-colors flex items-center justify-center shrink-0"
                  >
                    {deleteMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </button>
                  <div className="h-4 w-px bg-black/8 dark:bg-white/8 mx-1" />
                </>
              )}

              <button
                onClick={() => onOpenChange(false)}
                className="p-1.5 rounded-md hover:bg-black/5 dark:hover:bg-white/5 text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </header>

          {/* Body */}
          <div className="flex flex-row w-full flex-1 overflow-hidden min-h-[380px] max-h-[480px] bg-white dark:bg-[#0f0f11]">
            {/* Left Column - Metadata */}
            <div className="w-[220px] shrink-0 flex flex-col items-center justify-between p-6 border-r border-black/8 dark:border-white/8 bg-slate-50/50 dark:bg-[#0f0f11]">
              {/* Status orb */}
              <div className="flex-1 flex flex-col items-center justify-center">
                <div
                  className="w-[90px] h-[90px] rounded-full flex items-center justify-center"
                  style={{
                    background:
                      status === "completed"
                        ? "radial-gradient(circle at center, rgba(16,185,129,0.15) 0%, transparent 75%)"
                        : status === "failed"
                        ? "radial-gradient(circle at center, rgba(239,68,68,0.15) 0%, transparent 75%)"
                        : "radial-gradient(circle at center, rgba(139,92,246,0.15) 0%, transparent 75%)",
                  }}
                >
                  {isLoading ? (
                    <Loader2 className="h-6 w-6 text-violet-500 animate-spin" />
                  ) : status === "completed" ? (
                    <div className="w-full h-full rounded-full border border-emerald-500/20 bg-emerald-500/5 dark:bg-emerald-950/20 flex items-center justify-center">
                      <CheckCircle className="h-5 w-5 text-emerald-500 dark:text-emerald-400" />
                    </div>
                  ) : status === "failed" ? (
                    <div className="w-full h-full rounded-full border border-rose-500/30 bg-rose-500/10 dark:bg-rose-950/30 flex items-center justify-center">
                      <AlertCircle className="h-6 w-6 text-rose-500 dark:text-rose-400" />
                    </div>
                  ) : (
                    <div className="w-full h-full rounded-full border border-violet-500/20 bg-violet-500/5 flex items-center justify-center">
                      <Loader2 className="h-5 w-5 text-violet-500 animate-spin" />
                    </div>
                  )}
                </div>

                {/* Duration */}
                {!isLoading && (
                  <div className="text-center mt-4">
                    <span className="text-[20px] font-normal text-foreground font-mono tracking-tight tabular-nums">
                      {formatTime(duration || 0)}
                    </span>
                    <span className="text-[11px] font-medium tracking-widest text-muted-foreground uppercase mt-0.5 block">
                      recorded
                    </span>
                  </div>
                )}
              </div>

              {/* Metadata */}
              {!isLoading && status === "completed" && (
                <div className="w-full border-t border-black/8 dark:border-white/8 pt-3 flex flex-col gap-1.5">
                  <div className="flex justify-between items-center text-[12px] font-normal text-muted-foreground">
                    <span className="text-[11px] font-medium tracking-wide uppercase">
                      Speakers
                    </span>
                    <span className="text-foreground">{speakerCount}</span>
                  </div>
                  <div className="flex justify-between items-center text-[12px] font-normal text-muted-foreground">
                    <span className="text-[11px] font-medium tracking-wide uppercase">
                      Language
                    </span>
                    <span className="text-foreground">
                      {languageDetected || "—"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-[12px] font-normal text-muted-foreground">
                    <span className="text-[11px] font-medium tracking-wide uppercase">
                      Words
                    </span>
                    <span className="text-foreground">{wordCount}</span>
                  </div>
                </div>
              )}

              {/* Error state */}
              {!isLoading && status === "failed" && (
                <div className="w-full p-3 rounded-lg bg-rose-500/5 border border-rose-500/10 text-rose-500 text-left">
                  <p className="text-[11px] leading-relaxed font-normal">
                    Transcription failed for this recording.
                  </p>
                </div>
              )}
            </div>

            {/* Right Column - Transcript */}
            <div className="flex-1 flex flex-col min-w-0 bg-white dark:bg-[#0f0f11]">
              {isLoading ? (
                <div className="flex-1 flex items-center justify-center">
                  <Loader2 className="h-5 w-5 text-muted-foreground animate-spin" />
                </div>
              ) : isError ? (
                <div className="flex-1 flex items-center justify-center px-6">
                  <p className="text-sm text-muted-foreground text-center">
                    Failed to load recording. Please try again.
                  </p>
                </div>
              ) : status !== "completed" || !transcript ? (
                <div className="flex-1 flex flex-col items-center justify-center px-6 gap-2">
                  <Mic className="h-8 w-8 text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground text-center">
                    {status === "failed"
                      ? "Transcription failed. No transcript available."
                      : status === "pending" || status === "processing"
                      ? "Transcription is still processing…"
                      : "No transcript available for this recording."}
                  </p>
                </div>
              ) : (
                <>
                  {/* Sub-header */}
                  <div className="h-10 px-5 border-b border-black/6 dark:border-white/6 flex items-center justify-between shrink-0 bg-white dark:bg-[#0f0f11]">
                    <span className="text-[11px] font-medium tracking-widest text-muted-foreground uppercase">
                      Transcript
                    </span>
                    <div className="flex items-center gap-1.5">
                      {speakerIds.map((spId) => {
                        const idNum =
                          parseInt(spId.toString().replace(/\D/g, "")) || 0;
                        return (
                          <div
                            key={spId}
                            className={`text-[10px] font-medium tracking-wide uppercase px-2 py-0.5 rounded border ${getSpeakerBg(spId)}`}
                          >
                            {`Speaker ${String.fromCharCode(65 + idNum)}`}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Scrollable transcript */}
                  <ScrollArea className="flex-1 overflow-y-auto">
                    <div className="p-5 flex flex-col gap-4">
                      {diarizedTranscript?.entries &&
                      diarizedTranscript.entries.length > 0 ? (
                        diarizedTranscript.entries.map(
                          (entry: any, index: number) => {
                            const speakerId = entry.speaker_id || "0";
                            const idNum =
                              parseInt(
                                speakerId.toString().replace(/\D/g, "")
                              ) || 0;
                            const speakerName = `Speaker ${String.fromCharCode(65 + idNum)}`;

                            return (
                              <div
                                key={index}
                                className="flex items-start gap-3 group"
                              >
                                <div
                                  className="w-[22px] h-[22px] rounded-full border flex items-center justify-center font-medium text-[10px] shrink-0"
                                  style={{
                                    backgroundColor: getSpeakerColor(
                                      speakerId
                                    ).replace("1)", "0.1)"),
                                    color: getSpeakerColor(speakerId),
                                    borderColor: getSpeakerColor(
                                      speakerId
                                    ).replace("1)", "0.2)"),
                                  }}
                                >
                                  {String.fromCharCode(65 + idNum)}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="text-[12px] font-medium text-foreground">
                                      {speakerName}
                                    </span>
                                    <span className="text-[11px] font-normal text-muted-foreground font-mono">
                                      {formatSegmentTime(
                                        entry.start_time_seconds
                                      )}
                                      <ChevronRight className="h-2.5 w-2.5 text-muted-foreground/60 inline-block mx-0.5 align-middle" />
                                      {formatSegmentTime(
                                        entry.end_time_seconds
                                      )}
                                    </span>
                                  </div>
                                  <p className="text-[13px] leading-[1.65] font-normal text-foreground/80 dark:text-white/80 mt-1 select-text">
                                    {entry.transcript}
                                  </p>
                                </div>
                              </div>
                            );
                          }
                        )
                      ) : (
                        <div className="text-[13px] leading-[1.65] font-normal text-foreground/80 dark:text-white/80 whitespace-pre-wrap select-text px-1">
                          {transcript}
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                </>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
