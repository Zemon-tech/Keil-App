import React, { useState, useEffect, useRef } from "react";
import api from "@/lib/api";
import { ScrollArea } from "@/components/ui/scroll-area";
import { VoicePoweredOrb } from "@/components/ui/voice-powered-orb";
import {
  Mic,
  Play,
  Pause,
  CheckCircle,
  AlertCircle,
  Loader2,
  Copy,
  Download,
  ChevronRight,
  X,
  Minimize2
} from "lucide-react";
import { toast } from "sonner";
import { useMeetingStore } from "@/store/useMeetingStore";



export const MeetingRecorder: React.FC = () => {
  const {
    status,
    setStatus,
    duration,
    setDuration,
    meetingId,
    closeDialog,
    minimizeDialog,
  } = useMeetingStore();

  const [recordingId, setRecordingId] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<string | null>(null);
  const [diarizedTranscript, setDiarizedTranscript] = useState<any | null>(null);
  const [languageDetected, setLanguageDetected] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [isPipMode, setIsPipMode] = useState(false);

  // Fetch recording details if meetingId is provided
  useEffect(() => {
    if (!meetingId) {
      if (status !== "recording" && status !== "uploading" && status !== "transcribing") {
        resetRecorder();
      }
      return;
    }


    let active = true;
    const fetchRecording = async () => {
      setStatus("transcribing");
      try {
        const response = await api.get(`v1/meetings/recording/${meetingId}/review`);
        if (!active) return;
        
        const recording = response.data.data;
        if (recording) {
          setRecordingId(recording.id);
          setDuration(recording.audio_duration_seconds || 0);
          setTranscript(recording.transcript_text);
          setDiarizedTranscript(recording.transcript_diarized);
          setLanguageDetected(recording.language_detected);
          setAudioUrl(recording.audio_url || null);
          
          if (recording.transcription_status === "completed") {
            setStatus("completed");
          } else if (recording.transcription_status === "failed") {
            setStatus("error");
            setErrorMessage("Transcription failed for this recording.");
          } else {
            setStatus("transcribing");
            setJobId(recording.sarvam_job_id);
          }
        }
      } catch (err: any) {
        if (!active) return;
        console.error("Failed to fetch recording:", err);
        setErrorMessage(err.message || "Failed to load recording.");
        setStatus("error");
      }
    };

    fetchRecording();

    return () => {
      active = false;
    };
  }, [meetingId]);

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

  // Clean up recorders and timers on unmount
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
        const localUrl = URL.createObjectURL(audioBlob);
        setAudioUrl(localUrl);
        await handleAudioUpload(audioBlob);
      };

      // Start timer
      startTimeRef.current = Date.now();
      timerIntervalRef.current = window.setInterval(() => {
        setDuration(Math.round((Date.now() - startTimeRef.current) / 1000));
      }, 1000);

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

  const handleAudioUpload = async (audioBlob: Blob) => {
    if (duration > 3600) {
      toast.warning("Warning: Meeting duration exceeds 60 minutes.");
    }

    setStatus("uploading");
    try {
      const response = await api.post("v1/meetings/upload-url", {
        meetingId: meetingId || null,
        fileName: `recording-${Date.now()}.webm`,
        contentType: audioBlob.type
      });

      const { uploadUrl, s3Key, recordingId } = response.data.data;
      setRecordingId(recordingId);

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
    }, 5000);

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

  const handleClose = () => {
    if (status === "recording") {
      if (confirm("Stop and discard current recording?")) {
        cleanup();
        resetRecorder();
        closeDialog();
      }
    } else {
      closeDialog();
    }
  };


  // Dynamic values for ElevenLabs compact metadata
  const speakerIds = diarizedTranscript?.entries
    ? Array.from(new Set(diarizedTranscript.entries.map((e: any) => e.speaker_id))) as (string | number)[]
    : [];
  const speakerCount = speakerIds.length > 0 ? speakerIds.length : 2;
  const wordCount = transcript ? transcript.split(/\s+/).filter(Boolean).length.toLocaleString() : "0";

  // Speaker legend pills style helpers
  const getSpeakerColor = (speakerId: string | number) => {
    const id = parseInt(speakerId.toString().replace(/\D/g, "")) || 0;
    const colors = [
      "rgba(167,139,250,1)", // purple
      "rgba(251,146,60,1)",  // amber
      "rgba(52,211,153,1)",  // teal
      "rgba(244,114,182,1)",  // pink
    ];
    return colors[id % colors.length];
  };

  const getSpeakerBg = (speakerId: string | number) => {
    const id = parseInt(speakerId.toString().replace(/\D/g, "")) || 0;
    const bgs = [
      "bg-violet-500/10 text-violet-400 border-violet-500/20 dark:border-violet-400/20",
      "bg-amber-500/10 text-amber-400 border-amber-500/20 dark:border-amber-400/20",
      "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 dark:border-emerald-400/20",
      "bg-pink-500/10 text-pink-400 border-pink-500/20 dark:border-pink-400/20",
    ];
    return bgs[id % bgs.length];
  };

  // Two-column dynamic widths
  const isExpanded = status === "completed" || status === "error";

  // State-specific header dot styles
  const getHeaderDotBg = () => {
    switch (status) {
      case "idle":
      case "recording":
        return "bg-violet-500";
      case "completed":
        return "bg-emerald-500";
      case "uploading":
      case "transcribing":
      case "error":
        return status === "error" ? "bg-rose-500" : "bg-amber-500";
    }
  };

  return (
    <>
      {/* PiP (Picture-in-Picture) floating mini-recorder */}
      {isPipMode && status === "recording" && (
        <div className="pip-mode fixed bottom-6 right-6 z-[9999] flex items-center gap-3 rounded-full bg-black/90 dark:bg-white/10 backdrop-blur-xl px-4 py-2.5 shadow-2xl border border-white/10 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <span className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
          <span className="text-sm font-mono text-white tabular-nums">
            {formatTime(duration)}
          </span>
          <button
            onClick={() => {
              stopRecording();
              setIsPipMode(false);
            }}
            className="ml-1 h-7 w-7 rounded-full bg-rose-600 hover:bg-rose-500 flex items-center justify-center transition-colors cursor-pointer"
            title="Stop recording"
          >
            <div className="h-2.5 w-2.5 rounded-sm bg-white" />
          </button>
        </div>
      )}

      <div className={`w-full max-w-[780px] bg-white dark:bg-[#0f0f11] rounded-[14px] border border-black/8 dark:border-white/8 shadow-2xl overflow-hidden flex flex-col text-foreground select-none relative ${isPipMode ? "hidden" : ""}`}>
      
      {/* Dynamic Keyframes Injection */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes orb-pulse {
          0%, 100% { opacity: 0.4; transform: scale(1); }
          50%       { opacity: 0.08; transform: scale(1.06); }
        }
        @keyframes orb-spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        .animate-pulse-slow {
          animation: orb-pulse 2s infinite ease-in-out;
        }
      ` }} />

      {/* Audio player preview element */}
      <audio
        ref={audioPlayerRef}
        src={audioUrl || ""}
        onEnded={handleAudioEnded}
        className="hidden"
      />

      {/* Header bar */}
      <header className="h-11 px-5 border-b border-black/7 dark:border-white/7 flex items-center justify-between shrink-0 bg-white dark:bg-[#0f0f11] z-10">
        <div className="flex items-center gap-2">
          <span className={`size-2 rounded-full ${getHeaderDotBg()} ${status === "recording" ? "animate-pulse" : ""}`} />
          <span className="text-[11px] font-medium tracking-[0.1em] text-muted-foreground uppercase">
            Keil HQ · Meeting Studio
          </span>
        </div>
        
        <div className="flex items-center gap-1">
          {status === "recording" && (
            <button
              onClick={() => setIsPipMode(true)}
              title="Picture-in-Picture mode"
              className="p-1.5 rounded-md hover:bg-black/5 dark:hover:bg-white/5 text-muted-foreground hover:text-foreground cursor-pointer transition-colors text-[10px] font-semibold tracking-wide uppercase border border-black/8 dark:border-white/8 mr-1"
            >
              PiP
            </button>
          )}
          {status !== "idle" && (
            <button
              onClick={minimizeDialog}
              title="Minimize to Sidebar"
              className="p-1.5 rounded-md hover:bg-black/5 dark:hover:bg-white/5 text-muted-foreground hover:text-foreground cursor-pointer transition-colors mr-1"
            >
              <Minimize2 className="size-4" />
            </button>
          )}
          {status === "completed" && (
            <>
              <button
                onClick={copyToClipboard}
                title="Copy Transcript"
                className="p-1.5 rounded-md hover:bg-black/5 dark:hover:bg-white/5 text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
              >
                <Copy className="size-4" />
              </button>
              <button
                onClick={downloadTextFile}
                title="Download Transcript"
                className="p-1.5 rounded-md hover:bg-black/5 dark:hover:bg-white/5 text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
              >
                <Download className="size-4" />
              </button>
              <div className="h-4 w-[1px] bg-black/8 dark:bg-white/8 mx-1" />
            </>
          )}
          <button
            onClick={handleClose}
            className="p-1.5 rounded-md hover:bg-black/5 dark:hover:bg-white/5 text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>
      </header>

      {/* Two-column layout block */}
      <div className="flex flex-row w-full flex-1 overflow-hidden min-h-[380px] max-h-[380px] bg-white dark:bg-[#0f0f11]">
        
        {/* Left Column - Orb & Control Area */}
        <div
          className="flex flex-col items-center justify-between p-6 shrink-0 border-r border-black/8 dark:border-white/8 bg-slate-50/50 dark:bg-[#0f0f11] transition-all duration-[400ms] ease-in-out select-none"
          style={{
            width: isExpanded ? "220px" : "100%",
            flexBasis: isExpanded ? "220px" : "100%",
            borderRightWidth: isExpanded ? "1px" : "0px",
          }}
        >
          {/* Main Voice Orb Box */}
          <div className="flex-1 flex flex-col items-center justify-center">
            <div
              className={`relative rounded-full flex items-center justify-center transition-all duration-[400ms] ease-in-out ${
                status === "completed" ? "w-[90px] h-[90px]" : "w-[130px] h-[130px]"
              }`}
              style={{
                background: status === "completed"
                  ? "radial-gradient(circle at center, rgba(16,185,129,0.15) 0%, transparent 75%)"
                  : status === "recording"
                  ? "radial-gradient(circle at center, rgba(239,68,68,0.15) 0%, transparent 75%)"
                  : status === "error"
                  ? "radial-gradient(circle at center, rgba(239,68,68,0.15) 0%, transparent 75%)"
                  : "radial-gradient(circle at center, rgba(139,92,246,0.15) 0%, transparent 75%)"
              }}
            >
              {/* Outer pulsing ring for live recording */}
              {status === "recording" && (
                <div className="absolute inset-0 rounded-full border border-rose-500/20 animate-pulse-slow pointer-events-none z-10" />
              )}

              {/* Render high-fidelity WebGL Voice Orb in idle/recording states */}
              {(status === "idle" || status === "recording") ? (
                <div className="absolute inset-0 rounded-full overflow-hidden flex items-center justify-center">
                  <VoicePoweredOrb
                    className="size-full scale-[1.25]"
                    enableVoiceControl={status === "recording"}
                    voiceSensitivity={1.8}
                  />
                  {status === "idle" && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
                      <Mic className="size-6 text-white/80 drop-shadow-md" />
                    </div>
                  )}
                </div>
              ) : (
                /* Inner Circle Orb Frame for completed, processing or error */
                <div
                  className={`size-full rounded-full border flex items-center justify-center transition-all duration-[400ms] ${
                    status === "completed"
                      ? "border-emerald-500/20 bg-emerald-500/5 dark:bg-emerald-950/20"
                      : "border-rose-500/30 bg-rose-500/10 dark:bg-rose-950/30"
                  }`}
                >
                  {(status === "uploading" || status === "transcribing") && (
                    <Loader2 className="size-6 text-violet-500 dark:text-violet-400 animate-spin" />
                  )}
                  {status === "completed" && <CheckCircle className="size-5 text-emerald-500 dark:text-emerald-400" />}
                  {status === "error" && <AlertCircle className="size-6 text-rose-500 dark:text-rose-400" />}
                </div>
              )}

              {/* Spinner Ring Overlay for Uploading/Transcribing */}
              {(status === "uploading" || status === "transcribing") && (
                <div className="absolute inset-[-4px] rounded-full p-[2px] animate-[orb-spin_1.5s_linear_infinite] pointer-events-none">
                  <div className="size-full rounded-full bg-transparent border-2 border-transparent border-t-violet-500 border-r-violet-500" />
                </div>
              )}
            </div>

            {/* Timer / Status section */}
            <div className="text-center mt-4">
              {status === "idle" && (
                <div className="flex flex-col items-center">
                  <span className="text-[28px] font-normal leading-tight text-foreground font-mono tracking-tight tabular-nums">
                    00:00
                  </span>
                  <span className="text-[11px] font-medium tracking-[0.1em] text-muted-foreground uppercase mt-0.5">
                    duration
                  </span>
                </div>
              )}

              {status === "recording" && (
                <div className="flex flex-col items-center">
                  <div className="flex items-center gap-1.5 justify-center">
                    <span className="size-1.5 rounded-full bg-rose-500 animate-ping" />
                    <span className="text-[28px] font-normal leading-tight text-foreground font-mono tracking-tight tabular-nums">
                      {formatTime(duration)}
                    </span>
                  </div>
                  <span className="text-[11px] font-medium tracking-[0.1em] text-rose-500 uppercase mt-0.5">
                    recording
                  </span>
                </div>
              )}

              {status === "uploading" && (
                <span className="text-[13px] font-normal text-muted-foreground block animate-pulse">
                  Uploading…
                </span>
              )}

              {status === "transcribing" && (
                <span className="text-[13px] font-normal text-muted-foreground block animate-pulse">
                  Transcribing…
                </span>
              )}

              {status === "completed" && (
                <div className="flex flex-col items-center">
                  <div className="flex items-center gap-1.5 justify-center">
                    <span className="text-[20px] font-normal text-foreground font-mono tracking-tight tabular-nums">
                      {formatTime(duration)}
                    </span>
                    {audioUrl && (
                      <button
                        onClick={toggleAudioPlay}
                        className="p-1 rounded-md hover:bg-black/5 dark:hover:bg-white/5 text-violet-500 cursor-pointer transition-colors"
                      >
                        {isAudioPlaying ? <Pause className="size-3.5" /> : <Play className="size-3.5 fill-violet-500/20" />}
                      </button>
                    )}
                  </div>
                  <span className="text-[11px] font-medium tracking-[0.1em] text-muted-foreground uppercase mt-0.5">
                    recorded
                  </span>
                </div>
              )}

              {status === "error" && (
                <span className="text-[13px] font-normal text-rose-500 block">
                  Error Occurred
                </span>
              )}
            </div>
          </div>

          {/* Action button & Metadata bottom panel */}
          <div className="w-full flex flex-col items-center shrink-0">
            
            {/* Core Action Button */}
            {status === "idle" && (
              <button
                onClick={startRecording}
                className="w-full bg-violet-600 hover:bg-violet-500 text-white font-medium text-[11px] tracking-[0.06em] uppercase rounded-lg h-9 px-4 cursor-pointer flex items-center justify-center transition-all duration-200 border border-violet-600/30"
              >
                Start recording
              </button>
            )}

            {status === "recording" && (
              <button
                onClick={stopRecording}
                className="w-full bg-rose-600 hover:bg-rose-500 text-white font-medium text-[11px] tracking-[0.06em] uppercase rounded-lg h-9 px-4 cursor-pointer flex items-center justify-center transition-all duration-200 border border-rose-600/30"
              >
                Stop & process
              </button>
            )}

            {(status === "uploading" || status === "transcribing") && (
              <button
                disabled
                className="w-full border border-black/8 dark:border-white/8 text-muted-foreground font-medium text-[11px] tracking-[0.06em] uppercase rounded-lg h-9 px-4 flex items-center justify-center cursor-not-allowed opacity-50 bg-black/5 dark:bg-white/5"
              >
                Processing…
              </button>
            )}

            {(status === "completed" || status === "error") && (
              <button
                onClick={resetRecorder}
                className="w-full border border-violet-500/20 hover:border-violet-500/40 text-violet-500 hover:bg-violet-500/5 dark:text-violet-400 dark:border-violet-400/20 dark:hover:border-violet-400/40 dark:hover:bg-violet-400/5 font-medium text-[11px] tracking-[0.06em] uppercase rounded-lg h-9 px-4 cursor-pointer flex items-center justify-center transition-all duration-200"
              >
                New recording
              </button>
            )}

            {/* Error Message Panel */}
            {status === "error" && errorMessage && (
              <div className="w-full mt-3 p-3 rounded-lg bg-rose-500/5 border border-rose-500/10 text-rose-500 text-left max-h-[140px] overflow-y-auto">
                <p className="text-[11px] text-rose-500/80 leading-relaxed font-normal whitespace-pre-wrap">
                  {errorMessage}
                </p>
              </div>
            )}

            {/* ElevenLabs Compact Metadata Row (completed state only) */}
            {status === "completed" && (
              <div className="w-full border-t border-black/8 dark:border-white/8 pt-3 mt-3.5 flex flex-col gap-1.5">
                <div className="flex justify-between items-center text-[12px] font-normal text-muted-foreground">
                  <span className="text-[11px] font-medium tracking-[0.06em] uppercase">Speakers</span>
                  <span className="text-foreground">{speakerCount}</span>
                </div>
                <div className="flex justify-between items-center text-[12px] font-normal text-muted-foreground">
                  <span className="text-[11px] font-medium tracking-[0.06em] uppercase">Language</span>
                  <span className="text-foreground">{languageDetected || "en-IN"}</span>
                </div>
                <div className="flex justify-between items-center text-[12px] font-normal text-muted-foreground">
                  <span className="text-[11px] font-medium tracking-[0.06em] uppercase">Words</span>
                  <span className="text-foreground">{wordCount}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column - Transcript Area (completed state only) */}
        {status === "completed" && (
          <div className="flex-1 flex flex-col min-w-0 bg-white dark:bg-[#0f0f11] animate-in fade-in slide-in-from-right-4 duration-[400ms] ease-in-out">
            {/* Sub-header */}
            <div className="h-10 px-5 border-b border-black/6 dark:border-white/6 flex items-center justify-between shrink-0 bg-white dark:bg-[#0f0f11]">
              <span className="text-[11px] font-medium tracking-[0.1em] text-muted-foreground uppercase">
                Transcript
              </span>
              
              {/* Dynamic speaker color legend pills */}
              <div className="flex items-center gap-1.5">
                {speakerIds.map((spId) => {
                  const idNum = parseInt(spId.toString().replace(/\D/g, "")) || 0;
                  return (
                    <div
                      key={spId}
                      className={`text-[10px] font-medium tracking-[0.06em] uppercase px-2 py-0.5 rounded border ${getSpeakerBg(spId)}`}
                    >
                      {`Speaker ${String.fromCharCode(65 + idNum)}`}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Scrollable transcript body */}
            <ScrollArea className="flex-1 max-h-[336px] overflow-y-auto">
              <div className="p-5 flex flex-col gap-4">
                {diarizedTranscript?.entries && diarizedTranscript.entries.length > 0 ? (
                  diarizedTranscript.entries.map((entry: any, index: number) => {
                    const speakerId = entry.speaker_id || "0";
                    const idNum = parseInt(speakerId.toString().replace(/\D/g, "")) || 0;
                    const speakerName = `Speaker ${String.fromCharCode(65 + idNum)}`;
                    
                    return (
                      <div key={index} className="flex items-start gap-3 group animate-in fade-in duration-200">
                        {/* Speaker avatar initials circle */}
                        <div
                          className="w-[22px] h-[22px] rounded-full border flex items-center justify-center font-medium text-[10px] shrink-0"
                          style={{
                            backgroundColor: getSpeakerColor(speakerId).replace("1)", "0.1)"),
                            color: getSpeakerColor(speakerId),
                            borderColor: getSpeakerColor(speakerId).replace("1)", "0.2)"),
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
                              {formatSegmentTime(entry.start_time_seconds)}
                              <ChevronRight className="size-2.5 text-muted-foreground/60 inline-block mx-0.5 align-middle" />
                              {formatSegmentTime(entry.end_time_seconds)}
                            </span>
                          </div>
                          <p className="text-[13px] leading-[1.65] font-normal text-foreground/80 dark:text-white/80 mt-1 select-text">
                            {entry.transcript}
                          </p>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-[13px] leading-[1.65] font-normal text-foreground/80 dark:text-white/80 whitespace-pre-wrap select-text px-1">
                    {transcript}
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        )}
      </div>
    </div>
    </>
  );
};
