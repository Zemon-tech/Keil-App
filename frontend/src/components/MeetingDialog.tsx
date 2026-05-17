import React, { useState, useEffect, useRef } from "react";
import api from "@/lib/api";
import { VoicePoweredOrb } from "@/components/ui/voice-powered-orb";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { VisuallyHidden } from "radix-ui";
import {
  Mic,
  Square,
  Play,
  Pause,
  CheckCircle,
  AlertCircle,
  Loader2,
  Copy,
  Download,
  Volume2,
  ChevronRight,
  Sparkles,
  RefreshCw,
  X
} from "lucide-react";
import { toast } from "sonner";

type RecorderState = "idle" | "recording" | "uploading" | "transcribing" | "completed" | "error";

interface MeetingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  meetingId?: string;
}

export const MeetingDialog: React.FC<MeetingDialogProps> = ({
  open,
  onOpenChange,
  meetingId
}) => {
  const [status, setStatus] = useState<RecorderState>("idle");
  const [duration, setDuration] = useState(0);
  const [recordingId, setRecordingId] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<string | null>(null);
  const [diarizedTranscript, setDiarizedTranscript] = useState<any | null>(null);
  const [languageDetected, setLanguageDetected] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [viewMode, setViewMode] = useState<"dialogue" | "flat">("dialogue");

  // Audio recording references
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<number | undefined>(undefined);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const startTimeRef = useRef<number>(0);

  // Timing helper: formats seconds to MM:SS or HH:MM:SS
  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return [
      h > 0 ? h : null,
      m.toString().padStart(2, "0"),
      s.toString().padStart(2, "0")
    ].filter(x => x !== null).join(":");
  };

  // Format diarization timestamps
  const formatSegmentTime = (seconds: number | string) => {
    const secs = typeof seconds === "string" ? parseFloat(seconds) : seconds;
    if (isNaN(secs)) return "00:00";
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  // Clean up recorders and timers on unmount or dialog close
  const cleanup = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = undefined;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
  };

  useEffect(() => {
    return () => {
      cleanup();
    };
  }, []);

  // Stop recording if the dialog is closed while active
  useEffect(() => {
    if (!open) {
      cleanup();
      // Keep state if completed so they don't lose the transcript immediately on close, 
      // but reset if it was recording or failed
      if (status === "recording" || status === "idle") {
        resetRecorder();
      }
    }
  }, [open]);

  const startRecording = async () => {
    try {
      setErrorMessage(null);
      setTranscript(null);
      setDiarizedTranscript(null);
      setLanguageDetected(null);
      setAudioUrl(null);
      setDuration(0);
      audioChunksRef.current = [];

      // Get microphone permissions
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      });
      streamRef.current = stream;

      // Initialize MediaRecorder
      const options = { mimeType: "audio/webm;codecs=opus" };
      let recorder: MediaRecorder;
      try {
        recorder = new MediaRecorder(stream, options);
      } catch (e) {
        // Fallback for browsers that don't support WebM/Opus directly
        recorder = new MediaRecorder(stream);
      }

      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: recorder.mimeType });

        // Create local playback URL
        const localUrl = URL.createObjectURL(audioBlob);
        setAudioUrl(localUrl);

        await handleAudioUpload(audioBlob);
      };

      // Start timer
      startTimeRef.current = Date.now();
      timerIntervalRef.current = window.setInterval(() => {
        setDuration(Math.round((Date.now() - startTimeRef.current) / 1000));
      }, 1000);

      // Record in 1s chunks
      recorder.start(1000);
      setStatus("recording");
      toast.success("Meeting capture started");
    } catch (err: any) {
      console.error("Failed to start recording:", err);
      setErrorMessage(err.message || "Microphone access denied. Please verify browser settings.");
      setStatus("error");
      toast.error("Microphone access denied");
    }
  };

  const stopRecording = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = undefined;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  // Upload audio and trigger transcription
  const handleAudioUpload = async (audioBlob: Blob) => {
    if (duration > 3600) {
      toast.warning("Warning: Meeting duration exceeds 60 minutes.");
    }

    setStatus("uploading");
    try {
      // 1. Fetch Presigned PUT URL
      const response = await api.post("v1/meetings/upload-url", {
        meetingId: meetingId || null,
        fileName: `recording-${Date.now()}.webm`,
        contentType: audioBlob.type
      });

      const { uploadUrl, s3Key, recordingId } = response.data.data;
      setRecordingId(recordingId);

      // 2. Upload audio directly to S3 bucket
      console.log("Uploading audio file to S3...");
      const uploadResponse = await fetch(uploadUrl, {
        method: "PUT",
        body: audioBlob,
        headers: {
          "Content-Type": audioBlob.type
        }
      });

      if (!uploadResponse.ok) {
        throw new Error("Failed to upload audio to S3 cloud storage.");
      }

      console.log("Upload completed. Initiating transcription job...");

      // 3. Call backend endpoint to trigger transcription
      setStatus("transcribing");
      const transcribeResponse = await api.post("v1/meetings/transcribe", {
        recordingId,
        s3Key,
        durationSeconds: duration,
        contentType: audioBlob.type
      });

      const { jobId: sarvamJobId } = transcribeResponse.data.data;
      setJobId(sarvamJobId);

    } catch (err: any) {
      console.error("Processing Pipeline Error:", err);
      setErrorMessage(err.message || "An error occurred during audio upload/transcription.");
      setStatus("error");
      toast.error("Failed to process meeting recording");
    }
  };

  // Polling server for Sarvam job state changes
  useEffect(() => {
    if (status !== "transcribing" || !jobId || !recordingId) return;

    let pollCount = 0;
    const maxPolls = 120; // 10 minutes at 5s intervals

    const interval = window.setInterval(async () => {
      pollCount++;

      if (pollCount > maxPolls) {
        clearInterval(interval);
        setStatus("error");
        setErrorMessage("Transcription timed out after 10 minutes.");
        toast.error("Transcription timed out");
        return;
      }

      try {
        const response = await api.get(`v1/meetings/transcribe/status?jobId=${jobId}&recordingId=${recordingId}`);
        const { status: jobStatus, recording } = response.data.data;

        if (jobStatus === "completed") {
          clearInterval(interval);
          setStatus("completed");
          setTranscript(recording.transcript_text);
          setDiarizedTranscript(recording.transcript_diarized);
          setLanguageDetected(recording.language_detected);
          toast.success("AI Transcription completed!");
        } else if (jobStatus === "failed") {
          clearInterval(interval);
          setStatus("error");
          setErrorMessage("Sarvam AI STT job processing failed.");
          toast.error("AI Transcription failed");
        }
      } catch (err) {
        console.warn("Polling error (will retry):", err);
      }
    }, 5000); // Poll every 5 seconds

    return () => clearInterval(interval);
  }, [status, jobId, recordingId]);

  // Audio preview controls
  const toggleAudioPlay = () => {
    if (!audioPlayerRef.current) return;

    if (isAudioPlaying) {
      audioPlayerRef.current.pause();
      setIsAudioPlaying(false);
    } else {
      audioPlayerRef.current.play();
      setIsAudioPlaying(true);
    }
  };

  const handleAudioEnded = () => {
    setIsAudioPlaying(false);
  };

  // Copy transcript to clipboard
  const copyToClipboard = () => {
    if (!transcript) return;
    navigator.clipboard.writeText(transcript);
    toast.success("Transcript copied to clipboard!");
  };

  // Download transcript as text file
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

  // Reset recorder back to idle
  const resetRecorder = () => {
    setStatus("idle");
    setDuration(0);
    setTranscript(null);
    setDiarizedTranscript(null);
    setLanguageDetected(null);
    setErrorMessage(null);
    setAudioUrl(null);
    setIsAudioPlaying(false);
    setRecordingId(null);
    setJobId(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        aria-describedby={undefined}
        className="!max-w-[calc(100vw-40px)] !w-[calc(100vw-40px)] !h-[calc(100vh-40px)] !max-h-[calc(100vh-40px)] !rounded-2xl !p-0 !gap-0 border border-border shadow-2xl overflow-hidden bg-background"
      >
        <div className="relative w-full h-full flex flex-col items-center justify-center bg-background/95 backdrop-blur-xl overflow-hidden rounded-2xl">
          <VisuallyHidden.Root>
            <DialogTitle>Meeting Studio</DialogTitle>
          </VisuallyHidden.Root>

          {/* Ambient radial blur backdrops */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,var(--color-primary)/0.03_0%,transparent_65%)] pointer-events-none" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-tr from-violet-500/5 via-cyan-500/5 to-indigo-500/5 blur-[120px] rounded-full pointer-events-none" />

          {/* Top bar with minimal info and close button */}
          <div className="absolute top-6 left-6 right-6 flex items-center justify-between z-20">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-violet-400 animate-pulse" />
              <span className="text-[11px] font-bold tracking-widest text-muted-foreground uppercase">
                Keil HQ Meeting Studio
              </span>
            </div>
            <button
              onClick={() => onOpenChange(false)}
              className="p-2 rounded-full border border-border/40 bg-muted/10 hover:bg-muted/40 hover:scale-105 active:scale-95 transition-all text-muted-foreground hover:text-foreground cursor-pointer z-50 shadow-sm"
            >
              <X className="h-4.5 w-4.5" />
            </button>
          </div>

          {/* Main Content Area */}
          <div className="flex-1 w-full flex flex-col items-center justify-center max-w-4xl mx-auto px-6 py-12 overflow-y-auto scrollbar-none z-10 select-none">
            
            {/* Main Voice Orb Canvas Wrapper */}
            <div className="relative w-[340px] h-[340px] rounded-full border border-violet-500/10 bg-black/10 flex items-center justify-center overflow-hidden shadow-[inset_0_4px_30px_rgba(0,0,0,0.4),0_8px_30px_rgba(0,0,0,0.5)] shrink-0 mb-6 group transition-all duration-500 hover:border-violet-500/25">
              <div className="absolute inset-0 bg-gradient-to-b from-violet-600/5 to-cyan-600/5 pointer-events-none" />
              
              <VoicePoweredOrb
                className="w-full h-full scale-[1.08]"
                enableVoiceControl={status === "recording"}
                hue={status === "recording" ? 280 : 210}
                voiceSensitivity={1.8}
                maxRotationSpeed={1.5}
                maxHoverIntensity={0.9}
              />

              {/* Inner status icon and indicator */}
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none p-4">
                {status === "idle" && (
                  <div className="bg-black/40 backdrop-blur-md rounded-full p-4.5 border border-border/30 shadow-lg">
                    <Mic className="h-10 w-10 text-indigo-400 animate-pulse" />
                  </div>
                )}
                {status === "recording" && (
                  <div className="flex flex-col items-center space-y-2">
                    <div className="bg-red-500/20 rounded-full p-3 border border-red-500/30 animate-ping">
                      <div className="h-3.5 w-3.5 rounded-full bg-red-500" />
                    </div>
                    <span className="text-red-400 text-[10px] font-black tracking-widest uppercase animate-pulse">
                      Live
                    </span>
                  </div>
                )}
                {(status === "uploading" || status === "transcribing") && (
                  <Loader2 className="h-12 w-12 text-indigo-400 animate-spin" />
                )}
                {status === "completed" && (
                  <div className="bg-emerald-500/20 rounded-full p-4 border border-emerald-500/30 shadow-lg">
                    <CheckCircle className="h-10 w-10 text-emerald-400" />
                  </div>
                )}
                {status === "error" && (
                  <div className="bg-red-500/20 rounded-full p-4 border border-red-500/30 shadow-lg">
                    <AlertCircle className="h-10 w-10 text-red-400" />
                  </div>
                )}
              </div>
            </div>

            {/* Time & Duration counter */}
            <div className="text-center mb-8 shrink-0">
              <span className="text-5xl font-mono font-black tracking-tight bg-gradient-to-b from-foreground to-foreground/75 bg-clip-text text-transparent">
                {formatTime(duration)}
              </span>
              <p className="text-[9px] text-muted-foreground font-black tracking-widest uppercase mt-1.5">
                {status === "recording" ? "Live session length" : "Duration"}
              </p>
            </div>

            {/* Core Recording Control Button */}
            <div className="w-full max-w-sm flex flex-col items-center gap-4 shrink-0 mb-6">
              {status === "idle" && (
                <button
                  onClick={startRecording}
                  className="w-full py-5 rounded-full bg-gradient-to-r from-violet-600 via-indigo-600 to-indigo-700 hover:from-violet-500 hover:to-indigo-500 text-white shadow-xl shadow-indigo-500/10 text-sm font-black tracking-wider uppercase gap-2.5 flex items-center justify-center transition-all duration-300 hover:scale-[1.03] active:scale-95 cursor-pointer border border-violet-400/20"
                >
                  <Mic className="h-4.5 w-4.5" />
                  Start Recording
                </button>
              )}

              {status === "recording" && (
                <button
                  onClick={stopRecording}
                  className="w-full py-5 rounded-full bg-red-600 hover:bg-red-500 text-white shadow-xl shadow-red-500/15 text-sm font-black tracking-wider uppercase gap-2.5 flex items-center justify-center transition-all duration-300 hover:scale-[1.03] active:scale-95 cursor-pointer border border-red-500/30 animate-pulse"
                >
                  <Square className="h-4 w-4 bg-white/20 p-0.5 rounded-sm" />
                  Stop Recording
                </button>
              )}

              {(status === "uploading" || status === "transcribing") && (
                <div className="w-full py-5 rounded-full bg-muted/40 border border-border/50 text-xs font-black tracking-wider uppercase flex items-center justify-center gap-2.5 text-muted-foreground animate-pulse">
                  <Loader2 className="h-4.5 w-4.5 animate-spin text-indigo-400" />
                  {status === "uploading" ? "Uploading audio..." : "Transcribing speech..."}
                </div>
              )}

              {(status === "completed" || status === "error") && (
                <button
                  onClick={resetRecorder}
                  className="w-full py-5 rounded-full bg-card hover:bg-muted border border-border/50 text-xs font-black tracking-wider uppercase gap-2.5 flex items-center justify-center transition-all duration-300 hover:scale-[1.03] active:scale-95 cursor-pointer text-foreground"
                >
                  <RefreshCw className="h-4 w-4" />
                  Record Again
                </button>
              )}
            </div>

            {/* Preview player */}
            {audioUrl && status === "completed" && (
              <div className="w-full max-w-2xl bg-muted/15 border border-border/30 p-4 rounded-2xl flex items-center gap-3.5 shrink-0 mb-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <audio
                  ref={audioPlayerRef}
                  src={audioUrl}
                  onEnded={handleAudioEnded}
                  className="hidden"
                />
                <button
                  onClick={toggleAudioPlay}
                  className="h-11 w-11 rounded-full hover:bg-muted bg-card shrink-0 flex items-center justify-center border border-border/40 cursor-pointer shadow-sm transition-all hover:scale-105 active:scale-95"
                >
                  {isAudioPlaying ? (
                    <Pause className="h-4.5 w-4.5 text-indigo-400 fill-indigo-400/20" />
                  ) : (
                    <Play className="h-4.5 w-4.5 text-indigo-400 fill-indigo-400/20 ml-0.5" />
                  )}
                </button>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold truncate text-foreground/90">
                    Recording playback preview
                  </p>
                  <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5 font-medium">
                    <Volume2 className="h-3.5 w-3.5" />
                    Listen to the audio recording locally
                  </p>
                </div>
              </div>
            )}

            {/* Transcribed Text Scrollarea (ONLY displayed below record button when finished) */}
            {status === "completed" && transcript && (
              <div className="w-full max-w-3xl flex flex-col border border-border/40 bg-card/30 backdrop-blur-md rounded-2xl overflow-hidden h-[360px] shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-500 mt-4 select-text">
                {/* Header */}
                <div className="px-5 py-4 border-b border-border/40 bg-muted/10 flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-2.5">
                    <Sparkles className="h-4.5 w-4.5 text-violet-400" />
                    <span className="text-xs font-black tracking-wider uppercase text-foreground">
                      Speech-to-Text Transcript
                    </span>
                    {languageDetected && (
                      <Badge variant="outline" className="text-[9px] border-indigo-500/20 bg-indigo-500/5 text-indigo-400 font-bold px-2 py-0.5 rounded-md">
                        {languageDetected.toUpperCase()}
                      </Badge>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <button
                      onClick={copyToClipboard}
                      title="Copy Transcript"
                      className="h-8 w-8 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer flex items-center justify-center transition-colors"
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                    <button
                      onClick={downloadTextFile}
                      title="Download Transcript"
                      className="h-8 w-8 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer flex items-center justify-center transition-colors"
                    >
                      <Download className="h-4 w-4" />
                    </button>
                    
                    <div className="h-5 w-[1px] bg-border/40 mx-1.5" />
                    
                    <div className="flex items-center border border-border/50 rounded-lg p-0.5 bg-muted/10">
                      <button
                        onClick={() => setViewMode("dialogue")}
                        className={`h-7 px-3 text-[10px] font-black tracking-wider uppercase rounded-md transition-all cursor-pointer ${viewMode === "dialogue" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                      >
                        Dialogue
                      </button>
                      <button
                        onClick={() => setViewMode("flat")}
                        className={`h-7 px-3 text-[10px] font-black tracking-wider uppercase rounded-md transition-all cursor-pointer ${viewMode === "flat" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                      >
                        Flat
                      </button>
                    </div>
                  </div>
                </div>

                {/* Scroller */}
                <ScrollArea className="flex-1 p-5">
                  {viewMode === "flat" ? (
                    <div className="text-[13px] leading-relaxed text-foreground/80 whitespace-pre-wrap select-text px-1">
                      {transcript}
                    </div>
                  ) : (
                    <div className="space-y-4 select-text">
                      {diarizedTranscript && diarizedTranscript.entries && diarizedTranscript.entries.length > 0 ? (
                        diarizedTranscript.entries.map((entry: any, index: number) => {
                          const speakerId = entry.speaker_id || "0";
                          const isSpeakerEven = speakerId.toString().includes("2") || speakerId.toString().includes("0") || speakerId.toString().includes("even");
                          const speakerName = isSpeakerEven ? "Speaker A" : "Speaker B";
                          const avatarColor = isSpeakerEven
                            ? "bg-violet-500/10 text-violet-400 border-violet-500/20"
                            : "bg-cyan-500/10 text-cyan-400 border-cyan-500/20";

                          return (
                            <div key={index} className="flex items-start gap-3.5 group animate-in fade-in duration-200">
                              <div className={`h-8 w-8 rounded-full border flex items-center justify-center font-bold text-xs shrink-0 ${avatarColor}`}>
                                {speakerName[8]}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-bold text-foreground/90">
                                    {speakerName}
                                  </span>
                                  <span className="text-[9px] text-muted-foreground font-mono bg-muted/40 px-1.5 py-0.5 rounded-full">
                                    {formatSegmentTime(entry.start_time_seconds)}
                                    <ChevronRight className="h-2 w-2 text-muted-foreground/60 inline mx-0.5" />
                                    {formatSegmentTime(entry.end_time_seconds)}
                                  </span>
                                </div>
                                <p className="text-[13px] leading-relaxed text-foreground/75 mt-1 select-text">
                                  {entry.transcript}
                                </p>
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div className="text-[13px] leading-relaxed text-foreground/80 whitespace-pre-wrap select-text px-1">
                          {transcript}
                        </div>
                      )}
                    </div>
                  )}
                </ScrollArea>
              </div>
            )}

            {/* Under error state, let's render an error banner below the record button */}
            {status === "error" && errorMessage && (
              <div className="w-full max-w-2xl bg-destructive/10 border border-destructive/20 p-4.5 rounded-2xl flex items-center gap-3.5 shrink-0 mt-4 animate-in fade-in duration-300">
                <AlertCircle className="h-5 w-5 text-red-400 shrink-0" />
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-xs font-bold text-red-400">Processing error</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                    {errorMessage}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
