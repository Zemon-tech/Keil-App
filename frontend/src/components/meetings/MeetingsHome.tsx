import { Mic, Clock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAppContext } from "@/contexts/AppContext";
import { useMeetingHistory } from "@/hooks/api/useMeetings";
import { formatDistanceToNow } from "date-fns";
import { useState } from "react";
import { MeetingDialog } from "@/components/MeetingDialog";

export function MeetingsHome() {
  const { activeOrgId, activeSpaceId } = useAppContext();
  const [meetingDialogOpen, setMeetingDialogOpen] = useState(false);

  const { data, isLoading } = useMeetingHistory(1, 6);
  const recentRecordings = data?.recordings ?? [];

  const noContext = !activeOrgId || !activeSpaceId;

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return "0:00";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="flex-1 flex flex-col h-full min-h-0 overflow-hidden">
      <div className="flex-1 overflow-y-auto min-h-0 custom-scrollbar-page pb-20">
        <main className="max-w-4xl mx-auto w-full px-6 pt-10">
          <div className="mb-12">
            <h1 className="text-[32px] font-bold tracking-tight text-foreground/90">
              Meetings
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Record, transcribe, and review your meetings.
            </p>
          </div>

          {noContext ? (
            <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
              <p className="text-sm text-muted-foreground">
                Select an organisation and space to use Meetings.
              </p>
            </div>
          ) : (
            <>
              {/* Start New Meeting CTA */}
              <div className="mb-10 flex items-center gap-4">
                <Button
                  onClick={() => setMeetingDialogOpen(true)}
                  className="h-11 px-6 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-medium text-sm gap-2"
                >
                  <Mic className="h-4 w-4" />
                  Start New Meeting
                </Button>
              </div>

              {/* Recent Recordings */}
              <section className="mb-10">
                <div className="flex items-center gap-2 mb-4 text-muted-foreground/60">
                  <Clock className="size-3.5" />
                  <span className="text-[11px] font-semibold uppercase tracking-wider">
                    Recent recordings
                  </span>
                </div>

                {isLoading ? (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground py-4">
                    <Loader2 className="size-3.5 animate-spin" />
                    Loading recordings…
                  </div>
                ) : recentRecordings.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center gap-3 border border-dashed border-border rounded-xl bg-muted/30">
                    <Mic className="h-8 w-8 text-muted-foreground/40" />
                    <p className="text-sm text-muted-foreground">
                      No recordings yet. Start a meeting to get going.
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {recentRecordings.map((recording) => (
                      <div
                        key={recording.id}
                        className="flex items-center gap-4 px-4 py-3 rounded-xl border border-border bg-card hover:bg-accent/50 transition-colors cursor-pointer"
                      >
                        <div className="h-9 w-9 rounded-lg bg-violet-500/10 flex items-center justify-center shrink-0">
                          <Mic className="h-4 w-4 text-violet-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">
                            Recording · {formatDuration(recording.audio_duration_seconds)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(recording.created_at), { addSuffix: true })}
                            {recording.language_detected && ` · ${recording.language_detected}`}
                          </p>
                        </div>
                        <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                          recording.transcription_status === "completed"
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                            : recording.transcription_status === "failed"
                            ? "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                            : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                        }`}>
                          {recording.transcription_status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </>
          )}
        </main>
      </div>

      {/* Meeting Recorder Dialog */}
      <MeetingDialog
        open={meetingDialogOpen}
        onOpenChange={setMeetingDialogOpen}
      />
    </div>
  );
}
