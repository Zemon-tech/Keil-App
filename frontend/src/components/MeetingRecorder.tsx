import React, { useState, useEffect, useRef } from "react";
import api from "@/lib/api";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AgentAudioVisualizerBar } from "@/components/agent-audio-visualizer-bar";
import {
  Mic,
  MicOff,
  Play,
  Pause,
  CheckCircle,
  AlertCircle,
  Loader2,
  Copy,
  Download,
  ChevronRight,
  X,
  Minimize2,
  Bookmark,
  Sparkles,
  Notebook,
  Undo2,
  CornerDownRight,
} from "lucide-react";
import { toast } from "sonner";
import { useMeetingStore } from "@/store/useMeetingStore";
import { getSocket } from "@/lib/socket";

export const MeetingRecorder: React.FC = () => {
  const {
    status,
    setStatus,
    duration,
    setDuration,
    meetingId,
    closeDialog,
    minimizeDialog,
    requestAction,
    setRequestAction,
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

  // Mute & Pause recording state
  const [isMuted, setIsMuted] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  // Live micro volumes for store syncing
  const [localVolumes, setLocalVolumes] = useState<number[]>([0.05, 0.05, 0.05, 0.05, 0.05]);
  const setGlobalVolumes = useMeetingStore((s) => s.setVolumes);

  // Audio recording references
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<number | undefined>(undefined);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const startTimeRef = useRef<number>(0);

  // Fetch recording details if meetingId is provided (e.g. for completed reviews)
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

  // Clean up recorders and timers on unmount
  const cleanup = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = undefined;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
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

  // Web Audio real-time micro analyser hook
  useEffect(() => {
    if (status !== "recording" || !streamRef.current || isPaused) {
      setLocalVolumes([0.05, 0.05, 0.05, 0.05, 0.05]);
      setGlobalVolumes([0.05, 0.05, 0.05, 0.05, 0.05]);
      return;
    }

    let audioCtx: AudioContext | null = null;
    let analyser: AnalyserNode | null = null;
    let source: MediaStreamAudioSourceNode | null = null;
    let rafId = 0;

    try {
      audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      analyser.smoothingTimeConstant = 0.45;

      source = audioCtx.createMediaStreamSource(streamRef.current);
      source.connect(analyser);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const barCount = 5;
      const binsPerBar = Math.floor(bufferLength / barCount);

      const updateVolume = () => {
        if (!analyser) return;
        analyser.getByteFrequencyData(dataArray);

        const newBands = new Array(barCount).fill(0.05);
        for (let i = 0; i < barCount; i++) {
          let sum = 0;
          const start = i * binsPerBar;
          const end = start + binsPerBar;
          for (let j = start; j < end; j++) {
            sum += dataArray[j];
          }
          const avg = sum / binsPerBar;
          newBands[i] = Math.min(Math.max((avg / 255) * 2.2, 0.05), 1.0);
        }

        setLocalVolumes(newBands);
        setGlobalVolumes(newBands);
        rafId = requestAnimationFrame(updateVolume);
      };

      rafId = requestAnimationFrame(updateVolume);
    } catch (err) {
      console.warn("Failed to initialize frequency analyser:", err);
    }

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      if (source) source.disconnect();
      if (analyser) analyser.disconnect();
      if (audioCtx) {
        audioCtx.close().catch(() => {});
      }
    };
  }, [status, streamRef.current, isPaused]);

  // Communication handler for requestActions from the minimized dock
  useEffect(() => {
    if (!requestAction) return;

    if (requestAction === "pause" && !isPaused) {
      togglePause();
    } else if (requestAction === "resume" && isPaused) {
      togglePause();
    } else if (requestAction === "stop") {
      stopRecording();
    }

    setRequestAction(null);
  }, [requestAction]);

  // Start Capture
  const startRecording = async () => {
    try {
      setErrorMessage(null);
      setTranscript(null);
      setDiarizedTranscript(null);
      setLanguageDetected(null);
      setAudioUrl(null);
      setDuration(0);
      setIsMuted(false);
      setIsPaused(false);
      audioChunksRef.current = [];

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;

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

      startTimeRef.current = Date.now();
      timerIntervalRef.current = window.setInterval(() => {
        setDuration(Math.round((Date.now() - startTimeRef.current) / 1000));
      }, 1000);

      recorder.start(1000);
      setStatus("recording");
      toast.success("Meeting capture started");
    } catch (err: any) {
      console.error("Failed to start recording:", err);
      setErrorMessage(err.message || "Microphone access denied. Please check browser permissions.");
      setStatus("error");
      toast.error("Microphone access denied");
    }
  };

  // Mute microphone stream
  const toggleMute = () => {
    if (streamRef.current) {
      const audioTrack = streamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
        toast.success(audioTrack.enabled ? "Microphone active" : "Microphone muted");
      }
    }
  };

  // Pause / Resume recording stream
  const togglePause = () => {
    if (!mediaRecorderRef.current) return;
    if (mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = undefined;
      }
      toast.success("Recording paused");
    } else if (mediaRecorderRef.current.state === "paused") {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
      startTimeRef.current = Date.now() - duration * 1000;
      timerIntervalRef.current = window.setInterval(() => {
        setDuration(Math.round((Date.now() - startTimeRef.current) / 1000));
      }, 1000);
      toast.success("Recording resumed");
    }
  };

  // Add marker event placeholder
  const addMarker = () => {
    toast.success("Marker added at " + formatTime(duration));
  };

  // Capture quick note placeholder
  const captureNote = () => {
    toast.success("Quick note flag captured");
  };

  // Stop Capture
  const stopRecording = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = undefined;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  // Handle uploading blob to cloud S3 and Sarvam Azure in parallel
  const handleAudioUpload = async (audioBlob: Blob) => {
    if (duration > 3600) {
      toast.warning("Meeting duration exceeds 60 minutes.");
    }

    setStatus("uploading");
    toast.info("Uploading meeting audio...", {
      description: "Saving capture session securely to cloud storage.",
    });

    try {
      // Step 1: Get all upload URLs (S3 + Sarvam) in one call
      const response = await api.post("v1/meetings/upload-url", {
        meetingId: meetingId || null,
        fileName: `recording-${Date.now()}.webm`,
        contentType: audioBlob.type,
      });

      const { uploadUrl, sarvamUploadUrl, sarvamJobId, s3Key, recordingId: recId } = response.data.data;
      setRecordingId(recId);

      // Step 2: Upload to S3 and Sarvam Azure in parallel (if sarvamUploadUrl available)
      if (sarvamUploadUrl && sarvamJobId) {
        // New optimized flow: dual upload
        const [s3Result, sarvamResult] = await Promise.allSettled([
          fetch(uploadUrl, {
            method: "PUT",
            body: audioBlob,
            headers: { "Content-Type": audioBlob.type },
          }),
          fetch(sarvamUploadUrl, {
            method: "PUT",
            body: audioBlob,
            headers: { "x-ms-blob-type": "BlockBlob", "Content-Type": audioBlob.type },
          }),
        ]);

        // Handle S3 upload failure
        if (s3Result.status === "rejected" || (s3Result.status === "fulfilled" && !s3Result.value.ok)) {
          throw new Error("Failed to upload audio to S3 cloud storage.");
        }

        // Handle Sarvam upload failure — fall back to legacy flow
        if (sarvamResult.status === "rejected" || (sarvamResult.status === "fulfilled" && !sarvamResult.value.ok)) {
          console.warn("[MeetingRecorder] Sarvam direct upload failed, falling back to legacy flow");
          // Fall back: let backend handle Sarvam upload via s3Key
          setStatus("transcribing");
          toast.info("Decoding conversation map...", {
            description: "Initiating Sarvam AI speech-to-text transcription.",
          });

          const transcribeResponse = await api.post("v1/meetings/transcribe", {
            recordingId: recId,
            s3Key,
            durationSeconds: duration,
            contentType: audioBlob.type,
          });

          setJobId(transcribeResponse.data.data.jobId);
          toast.success("Meeting Sync Saved", {
            description: "Transcription and analysis are running in the background.",
          });
          resetRecorder();
          return;
        }

        // Both uploads succeeded — start the job (no download/upload needed on backend)
        setStatus("transcribing");
        toast.info("Decoding conversation map...", {
          description: "Initiating Sarvam AI speech-to-text transcription.",
        });

        const transcribeResponse = await api.post("v1/meetings/transcribe", {
          recordingId: recId,
          sarvamJobId,
          durationSeconds: duration,
        });

        setJobId(transcribeResponse.data.data.jobId);
        toast.success("Meeting Sync Saved", {
          description: "Transcription and analysis are running in the background.",
        });
        resetRecorder();
      } else {
        // Legacy flow: only S3 URL returned (Sarvam job creation failed in upload-url)
        const uploadResponse = await fetch(uploadUrl, {
          method: "PUT",
          body: audioBlob,
          headers: { "Content-Type": audioBlob.type },
        });

        if (!uploadResponse.ok) {
          throw new Error("Failed to upload audio to S3 cloud storage.");
        }

        setStatus("transcribing");
        toast.info("Decoding conversation map...", {
          description: "Initiating Sarvam AI speech-to-text transcription.",
        });

        const transcribeResponse = await api.post("v1/meetings/transcribe", {
          recordingId: recId,
          s3Key,
          durationSeconds: duration,
          contentType: audioBlob.type,
        });

        setJobId(transcribeResponse.data.data.jobId);
        toast.success("Meeting Sync Saved", {
          description: "Transcription and analysis are running in the background.",
        });
        resetRecorder();
      }
    } catch (err: any) {
      console.error("[MeetingRecorder] Processing Pipeline Error:", err);
      setErrorMessage(err.message || "An error occurred during audio upload/transcription.");
      setStatus("error");
      toast.error("Failed to process meeting recording", {
        description: err.message || "Please check developer console logs or try again."
      });
    }
  };

  // Polling server for transcription status updates (fallback — webhook handles primary)
  useEffect(() => {
    if (status !== "transcribing" || !jobId || !recordingId) return;

    let active = true;
    let pollCount = 0;
    const maxPolls = 60; // ~10 minutes with backoff
    let currentDelay = 3000; // Start at 3s

    const poll = async () => {
      if (!active) return;
      pollCount++;

      if (pollCount > maxPolls) {
        setStatus("error");
        setErrorMessage("Transcription timed out after 10 minutes.");
        toast.error("Transcription timed out");
        return;
      }

      try {
        const response = await api.get(
          `v1/meetings/transcribe/status?jobId=${jobId}&recordingId=${recordingId}`
        );
        const { status: jobStatus, recording } = response.data.data;

        if (jobStatus === "completed") {
          if (!active) return;
          setStatus("completed");
          setTranscript(recording.transcript_text);
          setDiarizedTranscript(recording.transcript_diarized);
          setLanguageDetected(recording.language_detected);
          toast.success("AI Transcription completed!");
          return;
        } else if (jobStatus === "failed") {
          if (!active) return;
          setStatus("error");
          setErrorMessage("Sarvam AI STT job processing failed.");
          toast.error("AI Transcription failed");
          return;
        }
      } catch (err) {
        console.warn("Polling error (will retry):", err);
      }

      // Exponential backoff: 3s → 4.5s → 6.75s → ... max 15s
      currentDelay = Math.min(currentDelay * 1.5, 15000);
      if (active) {
        setTimeout(poll, currentDelay);
      }
    };

    // Start first poll after initial delay
    const initialTimeout = setTimeout(poll, currentDelay);

    return () => {
      active = false;
      clearTimeout(initialTimeout);
    };
  }, [status, jobId, recordingId]);

  // WebSockets real-time status listener to instantly update UI upon STT completion
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleMeetingUpdate = (payload: {
      type: string;
      recordingId: string;
      status: string;
      recording?: any;
    }) => {
      console.log("[MeetingRecorder] WebSocket meeting update received:", payload);
      
      // Check if this update belongs to our current recording session
      if (payload.recordingId === recordingId) {
        if (payload.status === "completed" && payload.recording) {
          setStatus("completed");
          setTranscript(payload.recording.transcript_text);
          setDiarizedTranscript(payload.recording.transcript_diarized);
          setLanguageDetected(payload.recording.language_detected);
          toast.success("AI Transcription completed!");
        } else if (payload.status === "failed") {
          console.error("[MeetingRecorder] Background transcription failed for recording ID:", payload.recordingId, payload.recording);
          setStatus("error");
          setErrorMessage("Sarvam AI STT job processing failed. Check developer console logs.");
          toast.error("AI Transcription failed", {
            description: "Sarvam speech-to-text processing failed in the background."
          });
        }
      }
    };

    socket.on("meeting_update", handleMeetingUpdate);
    return () => {
      socket.off("meeting_update", handleMeetingUpdate);
    };
  }, [recordingId]);

  // Audio player preview play toggle
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
    setIsMuted(false);
    setIsPaused(false);
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

  const speakerIds = diarizedTranscript?.entries
    ? (Array.from(new Set(diarizedTranscript.entries.map((e: any) => e.speaker_id))) as (
        | string
        | number
      )[])
    : [];
  const speakerCount = speakerIds.length > 0 ? speakerIds.length : 2;
  const wordCount = transcript
    ? transcript.split(/\s+/).filter(Boolean).length.toLocaleString()
    : "0";

  // Time formatters (duration is in seconds)
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
    const secs = typeof seconds === "string" ? parseFloat(seconds) : seconds;
    if (isNaN(secs)) return "00:00";
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const isCompleted = status === "completed" || status === "error";

  // Visualizer State mapper for AgentAudioVisualizerBar styling
  const getVisualizerState = () => {
    if (status === "recording") {
      return isPaused ? "idle" : "listening";
    }
    if (status === "uploading" || status === "transcribing") {
      return "thinking";
    }
    return "idle";
  };

  return (
    <>
      <audio ref={audioPlayerRef} src={audioUrl || undefined} onEnded={handleAudioEnded} className="hidden" />

      {/* ─── LIVE RECORDING OR PROCESSING VIEW (Compact layout) ─── */}
      {!isCompleted && (
        <div className="w-full flex flex-col p-5 select-none relative animate-in fade-in zoom-in-95 duration-300">
          
          {/* HEADER */}
          <div className="flex items-center justify-between shrink-0 mb-5">
            <div className="flex items-center gap-2">
              <span
                className={`size-2 rounded-full transition-all duration-300 ${
                  status === "recording" && !isPaused ? "bg-rose-500 animate-pulse" : "bg-[#7A7A7A]"
                }`}
              />
              <span className="text-[10px] font-semibold tracking-wider text-[#7A7A7A] uppercase">
                {status === "recording"
                  ? "Capturing Active Meeting"
                  : status === "uploading"
                  ? "Ingesting context stream"
                  : status === "transcribing"
                  ? "Decoding conversation map"
                  : "AI Workspace Companion"}
              </span>
            </div>
            
            <div className="flex items-center gap-1.5">
              {status === "recording" && (
                <button
                  onClick={minimizeDialog}
                  title="Minimize to Sidebar"
                  className="size-7 rounded-lg hover:bg-white/5 border border-white/5 flex items-center justify-center text-[#B3B3B3] hover:text-white transition-colors cursor-pointer"
                >
                  <Minimize2 className="size-3.5" />
                </button>
              )}
              <button
                onClick={handleClose}
                title="Close Companion"
                className="size-7 rounded-lg hover:bg-white/5 border border-white/5 flex items-center justify-center text-[#B3B3B3] hover:text-white transition-colors cursor-pointer"
              >
                <X className="size-3.5" />
              </button>
            </div>
          </div>

          {/* MEETING TITLE PANEL */}
          <div className="text-center mb-6">
            <h2 className="text-lg font-bold text-white tracking-tight leading-tight">
              {status === "recording" ? "Workspace Meeting Sync" : "Companion Capture Studio"}
            </h2>
            <span className="text-[12px] font-mono font-medium text-[#7A7A7A] mt-1 block">
              {formatTime(duration)}
            </span>
          </div>

          {/* CENTER VISUALIZER AREA */}
          <div className="h-32 flex flex-col items-center justify-center mb-6 relative">
            <AgentAudioVisualizerBar
              size="md"
              state={getVisualizerState()}
              barCount={5}
              volumesOverride={status === "recording" && !isPaused ? localVolumes : undefined}
              className="text-cyan-500 scale-[1.05]"
            />

            {/* Context status caption below the visualizer */}
            <span className="text-[11px] font-medium text-[#7A7A7A] tracking-wide text-center absolute bottom-0">
              {status === "recording" && isPaused
                ? "Capture paused"
                : status === "recording"
                ? "Listening and gathering workspace context..."
                : status === "uploading"
                ? "Ingesting capture stream..."
                : status === "transcribing"
                ? "Analyzing conversations and context..."
                : "Ready to capture workspace intelligence"}
            </span>
          </div>

          {/* BOTTOM CONTROLS */}
          <div className="flex flex-col items-center gap-4 shrink-0 border-t border-white/5 pt-4">
            
            {/* Pill controls area */}
            <div className="flex items-center gap-3">
              {status === "idle" ? (
                <button
                  onClick={startRecording}
                  className="bg-white hover:bg-neutral-200 text-[#000] font-semibold text-[11px] tracking-wide uppercase px-6 h-9 rounded-full cursor-pointer flex items-center justify-center gap-1.5 shadow-lg shadow-white/5 transition-all active:scale-[0.98]"
                >
                  <Mic className="size-3.5 fill-[#000]/15" />
                  Start Capture
                </button>
              ) : (
                <>
                  {/* Mic mute pill */}
                  <button
                    onClick={toggleMute}
                    disabled={status !== "recording"}
                    className={`size-9 rounded-full flex items-center justify-center border transition-all ${
                      isMuted
                        ? "bg-rose-500/10 border-rose-500/30 text-rose-400 hover:bg-rose-500/20"
                        : "bg-white/5 border-white/5 text-[#B3B3B3] hover:text-white hover:bg-white/10"
                    } disabled:opacity-30 disabled:cursor-not-allowed`}
                    title={isMuted ? "Unmute Mic" : "Mute Mic"}
                  >
                    {isMuted ? <MicOff className="size-4" /> : <Mic className="size-4" />}
                  </button>

                  {/* Pause/Resume pill */}
                  <button
                    onClick={togglePause}
                    disabled={status !== "recording"}
                    className={`size-9 rounded-full flex items-center justify-center border transition-all ${
                      isPaused
                        ? "bg-cyan-500/10 border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20 animate-pulse"
                        : "bg-white/5 border-white/5 text-[#B3B3B3] hover:text-white hover:bg-white/10"
                    } disabled:opacity-30 disabled:cursor-not-allowed`}
                    title={isPaused ? "Resume Capture" : "Pause Capture"}
                  >
                    {isPaused ? <Play className="size-4 fill-cyan-400/20" /> : <Pause className="size-4" />}
                  </button>

                  {/* Bookmark/Marker pill */}
                  <button
                    onClick={addMarker}
                    disabled={status !== "recording"}
                    className="size-9 rounded-full bg-white/5 border border-white/5 flex items-center justify-center text-[#B3B3B3] hover:text-white hover:bg-white/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Add marker flag"
                  >
                    <Bookmark className="size-4" />
                  </button>

                  {/* Notes flag pill */}
                  <button
                    onClick={captureNote}
                    disabled={status !== "recording"}
                    className="size-9 rounded-full bg-white/5 border border-white/5 flex items-center justify-center text-[#B3B3B3] hover:text-white hover:bg-white/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Capture note segment"
                  >
                    <Notebook className="size-4" />
                  </button>
                </>
              )}
            </div>

            {/* Separated End Session button */}
            {status !== "idle" && (
              <div className="w-full flex justify-center mt-1">
                {status === "recording" ? (
                  <button
                    onClick={stopRecording}
                    className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 font-semibold text-[10px] tracking-widest uppercase py-1.5 px-4.5 rounded-full cursor-pointer flex items-center justify-center transition-all active:scale-[0.98] shadow-md shadow-rose-500/5 hover:border-rose-500/40"
                  >
                    End Session
                  </button>
                ) : (
                  <div className="flex items-center gap-2 text-[#7A7A7A] font-medium text-[11px] tracking-wide animate-pulse">
                    <Loader2 className="size-3.5 animate-spin" />
                    <span>
                      {status === "uploading" ? "Syncing session context..." : "Ingesting diarized timeline..."}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── POST-RECORDING REVIEW & SUCCESS STATE (Spacious 2-column layout) ─── */}
      {isCompleted && (
        <div className="w-full flex flex-col select-none relative animate-in fade-in slide-in-from-bottom-4 duration-500">
          
          {/* HEADER */}
          <header className="h-11 px-5 border-b border-white/5 flex items-center justify-between shrink-0 bg-[#070708]/90 z-10">
            <div className="flex items-center gap-2">
              <span className={`size-2 rounded-full ${status === "completed" ? "bg-emerald-500" : "bg-rose-500"}`} />
              <span className="text-[10px] font-semibold tracking-wider text-[#7A7A7A] uppercase">
                {status === "completed" ? "Meeting Studio · Review Mode" : "Meeting Studio · Diagnostic Failure"}
              </span>
            </div>

            <div className="flex items-center gap-1">
              {status === "completed" && (
                <>
                  <button
                    onClick={copyToClipboard}
                    title="Copy Transcript"
                    className="size-8 rounded-lg hover:bg-white/5 text-[#B3B3B3] hover:text-white flex items-center justify-center cursor-pointer transition-colors"
                  >
                    <Copy className="size-4" />
                  </button>
                  <button
                    onClick={downloadTextFile}
                    title="Download Transcript"
                    className="size-8 rounded-lg hover:bg-white/5 text-[#B3B3B3] hover:text-white flex items-center justify-center cursor-pointer transition-colors"
                  >
                    <Download className="size-4" />
                  </button>
                  <div className="h-4 w-[1px] bg-white/5 mx-1" />
                </>
              )}
              <button
                onClick={handleClose}
                className="size-8 rounded-lg hover:bg-white/5 text-[#B3B3B3] hover:text-white flex items-center justify-center cursor-pointer transition-colors"
              >
                <X className="size-4" />
              </button>
            </div>
          </header>

          {/* TWO COLUMN CONTENT AREA */}
          <div className="flex flex-row w-full flex-1 overflow-hidden min-h-[380px] max-h-[380px] bg-[#070708]/90">
            
            {/* Left Column - Success Orb & Stats */}
            <div className="w-[220px] flex flex-col items-center justify-between p-6 shrink-0 border-r border-white/5 bg-[#09090A]/40 transition-all select-none">
              
              <div className="flex-1 flex flex-col items-center justify-center">
                <div
                  className="size-[90px] rounded-full flex items-center justify-center"
                  style={{
                    background:
                      status === "completed"
                        ? "radial-gradient(circle at center, rgba(16,185,129,0.15) 0%, transparent 75%)"
                        : "radial-gradient(circle at center, rgba(239,68,68,0.15) 0%, transparent 75%)",
                  }}
                >
                  <div
                    className={`size-full rounded-full border flex items-center justify-center ${
                      status === "completed"
                        ? "border-emerald-500/20 bg-emerald-500/5"
                        : "border-rose-500/30 bg-rose-500/10"
                    }`}
                  >
                    {status === "completed" ? (
                      <CheckCircle className="size-7 text-emerald-500" />
                    ) : (
                      <AlertCircle className="size-7 text-rose-500" />
                    )}
                  </div>
                </div>

                <div className="text-center mt-4">
                  <div className="flex items-center gap-1.5 justify-center">
                    <span className="text-[18px] font-semibold text-white font-mono tracking-tight tabular-nums">
                      {formatTime(duration)}
                    </span>
                    {audioUrl && status === "completed" && (
                      <button
                        onClick={toggleAudioPlay}
                        className="size-6 rounded-md hover:bg-white/5 text-cyan-400 flex items-center justify-center cursor-pointer transition-colors"
                      >
                        {isAudioPlaying ? <Pause className="size-3.5" /> : <Play className="size-3.5 fill-cyan-400/20" />}
                      </button>
                    )}
                  </div>
                  <span className="text-[10px] font-semibold tracking-wider text-[#7A7A7A] uppercase mt-0.5 block">
                    {status === "completed" ? "Recorded" : "Failure"}
                  </span>
                </div>
              </div>

              {/* Reset button & Diagnostic Details */}
              <div className="w-full flex flex-col items-center shrink-0">
                <button
                  onClick={resetRecorder}
                  className="w-full border border-white/10 hover:border-white/20 text-[#B3B3B3] hover:text-white hover:bg-white/5 font-semibold text-[10px] tracking-wider uppercase rounded-lg h-9 px-4 cursor-pointer flex items-center justify-center gap-1.5 transition-all duration-200"
                >
                  <Undo2 className="size-3.5" />
                  New capture
                </button>

                {status === "error" && errorMessage && (
                  <div className="w-full mt-3 p-3 rounded-lg bg-rose-500/5 border border-rose-500/10 text-rose-500 text-left max-h-[140px] overflow-y-auto">
                    <p className="text-[10px] text-rose-500/80 leading-relaxed font-normal whitespace-pre-wrap">
                      {errorMessage}
                    </p>
                  </div>
                )}

                {status === "completed" && (
                  <div className="w-full border-t border-white/5 pt-3 mt-3.5 flex flex-col gap-1.5">
                    <div className="flex justify-between items-center text-[11px] font-medium text-[#7A7A7A]">
                      <span className="uppercase tracking-wider">Speakers</span>
                      <span className="text-white font-mono">{speakerCount}</span>
                    </div>
                    <div className="flex justify-between items-center text-[11px] font-medium text-[#7A7A7A]">
                      <span className="uppercase tracking-wider">Language</span>
                      <span className="text-white uppercase font-mono">{languageDetected || "en-IN"}</span>
                    </div>
                    <div className="flex justify-between items-center text-[11px] font-medium text-[#7A7A7A]">
                      <span className="uppercase tracking-wider">Words</span>
                      <span className="text-white font-mono">{wordCount}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right Column - Beautiful Editorial Transcript */}
            <div className="flex-1 flex flex-col min-w-0 bg-[#070708]/90">
              
              {/* Sub-header speaking timeline overview */}
              <div className="h-10 px-5 border-b border-white/5 flex items-center justify-between shrink-0 bg-[#070708]/90">
                <span className="text-[10px] font-semibold tracking-wider text-[#7A7A7A] uppercase flex items-center gap-1.5">
                  <Sparkles className="size-3 text-cyan-400" />
                  Capture Transcript Timeline
                </span>
                
                <div className="flex items-center gap-1.5">
                  {speakerIds.map((spId) => {
                    const idNum = parseInt(spId.toString().replace(/\D/g, "")) || 0;
                    return (
                      <div
                        key={spId}
                        className={`text-[9px] font-semibold tracking-wide uppercase px-2 py-0.5 rounded border ${getSpeakerBg(
                          spId
                        )}`}
                      >
                        {`Speaker ${String.fromCharCode(65 + idNum)}`}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Scrollable transcript timeline */}
              <ScrollArea className="flex-1 max-h-[336px] overflow-y-auto">
                <div className="p-5 flex flex-col gap-5">
                  {diarizedTranscript?.entries && diarizedTranscript.entries.length > 0 ? (
                    diarizedTranscript.entries.map((entry: any, index: number) => {
                      const speakerId = entry.speaker_id || "0";
                      const idNum = parseInt(speakerId.toString().replace(/\D/g, "")) || 0;
                      const speakerName = `Speaker ${String.fromCharCode(65 + idNum)}`;

                      return (
                        <div key={index} className="flex items-start gap-3.5 group animate-in fade-in duration-200">
                          {/* Circle Avatar badge */}
                          <div
                            className="size-[22px] rounded-full border flex items-center justify-center font-semibold text-[9px] shrink-0"
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
                              <span className="text-[12px] font-semibold text-white">
                                {speakerName}
                              </span>
                              <span className="text-[10px] font-mono font-medium text-[#7A7A7A] flex items-center">
                                {formatSegmentTime(entry.start_time_seconds)}
                                <CornerDownRight className="size-2 text-[#7A7A7A] mx-0.5 inline-block align-middle" />
                                {formatSegmentTime(entry.end_time_seconds)}
                              </span>
                            </div>
                            <p className="text-[12px] leading-relaxed font-normal text-neutral-300 select-text mt-1">
                              {entry.transcript}
                            </p>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-[12px] leading-relaxed font-normal text-neutral-300 whitespace-pre-wrap select-text px-1">
                      {transcript || "No dialogue segment detected. Session timeline is empty."}
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
