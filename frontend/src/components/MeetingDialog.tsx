import React, { useState, useEffect, useRef, useMemo } from "react";
import { useMeetingStore } from "@/store/useMeetingStore";
import { type AgentState } from "@livekit/components-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "motion/react";
import { ScrollArea } from "@/components/ui/scroll-area";
import api from "@/lib/api";
import { getSocket } from "@/lib/socket";
import { useMeetingRecording, useDeleteRecording, useCancelTranscription, useTranscribeRecording, meetingKeys } from "@/hooks/api/useMeetings";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Volume2, VolumeX } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

// Audio Visualizer Components
import { AgentAudioVisualizerBar } from "@/components/agent-audio-visualizer-bar";
import { AgentAudioVisualizerAura } from "@/components/agents-ui/agent-audio-visualizer-aura";
import { AgentAudioVisualizerGrid } from "@/components/agents-ui/agent-audio-visualizer-grid";
import { AgentAudioVisualizerWave } from "@/components/agents-ui/agent-audio-visualizer-wave";
import { AgentAudioVisualizerRadial } from "@/components/agents-ui/agent-audio-visualizer-radial";

// Lucide Icons
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
  X,
  Minimize2,
  Maximize2,
  Bookmark,
  Sparkles,
  Notebook,
  Undo2,
  CornerDownRight,
  Trash2,
  Sliders,
  Activity,
  CircleDot,
  RotateCcw,
  Grid as GridIcon,
  SkipBack,
  SkipForward,
  ChevronDown,
} from "lucide-react";

const visualizers = [
  { id: "bar", name: "Bar", icon: Sliders },
  { id: "aura", name: "Aura", icon: Sparkles },
  { id: "grid", name: "Grid", icon: GridIcon },
  { id: "wave", name: "Wave", icon: Activity },
  { id: "radial", name: "Radial", icon: CircleDot },
] as const;

export const MeetingDialog: React.FC = () => {
  const queryClient = useQueryClient();
  const {
    isDialogOpen,
    isMinimized,
    status,
    duration,
    closeDialog,
    minimizeDialog,
    restoreDialog,
    setRequestAction,
    setStatus,
    setDuration,
    meetingId,
    requestAction,
  } = useMeetingStore();

  const [isHovered, setIsHovered] = useState(false);

  // Visualizer selection stored in localStorage
  const [visualizerType, setVisualizerType] = useState<"bar" | "aura" | "grid" | "wave" | "radial">(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("keil_meeting_visualizer") as any) || "bar";
    }
    return "bar";
  });

  // Local recording states (for newly captured meetings)
  const [recordingId, setRecordingId] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [localTranscript, setLocalTranscript] = useState<string | null>(null);
  const [localDiarizedTranscript, setLocalDiarizedTranscript] = useState<any | null>(null);
  const [localLanguageDetected, setLocalLanguageDetected] = useState<string | null>(null);
  const [localErrorMessage, setLocalErrorMessage] = useState<string | null>(null);
  const [localAudioUrl, setLocalAudioUrl] = useState<string | null>(null);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);

  // Audio Playback progress & rate states
  const [currentTime, setCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isVolumeMuted, setIsVolumeMuted] = useState(false);
  const [audioVolume] = useState(1);
  const [selectedProvider, setSelectedProvider] = useState<"sarvam" | "elevenlabs">("sarvam");
  const [selectedSpeakers, setSelectedSpeakers] = useState<string[]>([]);

  const [isMuted, setIsMuted] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [localVolumes, setLocalVolumes] = useState<number[]>([0.05, 0.05, 0.05, 0.05, 0.05]);
  // Track active MediaStream as state so the analyser useEffect re-triggers properly
  const [activeStream, setActiveStream] = useState<MediaStream | null>(null);

  // Audio recording references
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<number | undefined>(undefined);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const startTimeRef = useRef<number>(0);
  // When true, the next recorder.onstop fires in discard mode — no upload, no processing
  const discardRef = useRef<boolean>(false);

  // Queries & Mutations for historical reviews / actions
  const isHistoricalReview = !!meetingId;
  const { data: dbRecording, isLoading: isDbLoading, isError: isDbError } = useMeetingRecording(
    isDialogOpen && meetingId ? meetingId : null
  );

  const deleteMutation = useDeleteRecording();
  const cancelMutation = useCancelTranscription();
  const transcribeMutation = useTranscribeRecording();

  // Sync selected provider with loaded database recording's provider
  useEffect(() => {
    if (dbRecording?.stt_provider) {
      setSelectedProvider(dbRecording.stt_provider as "sarvam" | "elevenlabs");
    }
  }, [dbRecording?.stt_provider]);

  // Unified computed states
  const currentStatus = isHistoricalReview
    ? (dbRecording?.transcription_status === "completed"
      ? "completed"
      : dbRecording?.transcription_status === "failed"
        ? "error"
        : dbRecording?.transcription_status === "pending" || dbRecording?.transcription_status === "processing"
          ? "transcribing"
          : "idle")
    : status;

  const currentDuration = isHistoricalReview ? (dbRecording?.audio_duration_seconds ?? 0) : duration;
  const currentTranscript = isHistoricalReview ? dbRecording?.transcript_text : localTranscript;
  const currentDiarizedTranscript = isHistoricalReview ? dbRecording?.transcript_diarized : localDiarizedTranscript;

  // Speaker filter states & computed entries
  const toggleSpeakerFilter = (speakerId: string) => {
    setSelectedSpeakers((prev) =>
      prev.includes(speakerId)
        ? prev.filter((id) => id !== speakerId)
        : [...prev, speakerId]
    );
  };

  const filteredEntries = useMemo(() => {
    if (!currentDiarizedTranscript?.entries) return [];
    if (selectedSpeakers.length === 0) return currentDiarizedTranscript.entries;
    return currentDiarizedTranscript.entries.filter((entry: any) =>
      selectedSpeakers.includes(entry.speaker_id || "0")
    );
  }, [currentDiarizedTranscript?.entries, selectedSpeakers]);

  const currentLanguageDetected = isHistoricalReview ? dbRecording?.language_detected : localLanguageDetected;
  const currentAudioUrl = isHistoricalReview ? (dbRecording as any)?.audio_url : localAudioUrl;
  const currentErrorMessage = isHistoricalReview
    ? (dbRecording?.transcription_status === "failed" ? "Transcription failed for this recording." : null)
    : localErrorMessage;

  const isCompleted = currentStatus === "completed" || currentStatus === "error";
  const isLoadingRecording = isHistoricalReview && isDbLoading;
  const isErrorLoadingRecording = isHistoricalReview && isDbError;

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
    setActiveStream(null);
  };

  useEffect(() => {
    return () => {
      cleanup();
    };
  }, []);

  // Web Audio real-time micro analyser
  // NOTE: We depend on `activeStream` (React state) instead of `streamRef.current` (a ref),
  // so the effect properly re-runs when a new stream becomes available.
  useEffect(() => {
    if (currentStatus !== "recording" || !activeStream || isPaused) {
      // Symmetric fallback when not recording: flat baseline
      setLocalVolumes([0.05, 0.05, 0.05, 0.05, 0.05]);
      return;
    }

    let audioCtx: AudioContext | null = null;
    let analyser: AnalyserNode | null = null;
    let source: MediaStreamAudioSourceNode | null = null;
    let rafId = 0;

    try {
      audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      // Resume context in case it was suspended (required by some browsers)
      if (audioCtx.state === "suspended") {
        audioCtx.resume().catch(() => { });
      }
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.6;

      source = audioCtx.createMediaStreamSource(activeStream);
      source.connect(analyser);
      // NOTE: intentionally do NOT connect to audioCtx.destination to avoid feedback

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      // Focus on speech frequency range (approx 80Hz – 4kHz), split into 3 bands.
      // With fftSize=256 and typical 48kHz sample rate, each bin = ~187Hz.
      // Speech: bins 1–21 cover ~187Hz–4kHz.
      const speechStart = 1;
      const speechEnd = Math.min(22, Math.floor(bufferLength * 0.17));
      const speechBins = speechEnd - speechStart;
      const bandCount = 3;
      const binsPerBand = Math.max(1, Math.floor(speechBins / bandCount));

      const updateVolume = () => {
        if (!analyser) return;
        analyser.getByteFrequencyData(dataArray);

        // Compute 3 raw bands within speech frequency range
        const rawBands = new Array(bandCount).fill(0.05);
        for (let i = 0; i < bandCount; i++) {
          let sum = 0;
          const start = speechStart + i * binsPerBand;
          const end = start + binsPerBand;
          for (let j = start; j < end; j++) {
            sum += dataArray[j];
          }
          const avg = sum / binsPerBand;
          rawBands[i] = Math.min(Math.max((avg / 255) * 3.2, 0.05), 1.0);
        }

        // Mirror center-out: [high, mid, low, mid, high]
        // This puts the loudest frequency (low/mid, band 0-1) in the CENTER
        // so all visualizers look balanced regardless of audio content.
        const mirrored = [
          rawBands[2],           // high   (outer left)
          rawBands[1],           // mid    (inner left)
          rawBands[0],           // low    (center — typically loudest)
          rawBands[1],           // mid    (inner right, same as left)
          rawBands[2],           // high   (outer right, same as left)
        ];

        setLocalVolumes(mirrored);
        // NOTE: intentionally NOT writing to Zustand store here.
        // setVolumes was being called 60fps which caused global re-renders
        // across all components subscribed to useMeetingStore, making
        // navigation to other pages (e.g. Tasks) feel frozen/laggy.
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
        audioCtx.close().catch(() => { });
      }
    };
  }, [currentStatus, activeStream, isPaused]);

  // Handle requestActions from minimized dock
  useEffect(() => {
    if (!requestAction) return;

    if (requestAction === "pause" && !isPaused) {
      togglePause();
    } else if (requestAction === "resume" && isPaused) {
      togglePause();
    } else if (requestAction === "stop") {
      stopRecording();
    } else if (requestAction === "discard") {
      discardRecording();
    }

    setRequestAction(null);
  }, [requestAction]);

  // Start Capture
  const startRecording = async () => {
    try {
      setLocalErrorMessage(null);
      setLocalTranscript(null);
      setLocalDiarizedTranscript(null);
      setLocalLanguageDetected(null);
      setLocalAudioUrl(null);
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
      setActiveStream(stream); // Trigger re-render so analyser useEffect fires

      const options = { mimeType: "audio/webm;codecs=opus" };
      let recorder: MediaRecorder;
      try {
        recorder = new MediaRecorder(stream, options);
      } catch {
        recorder = new MediaRecorder(stream);
      }

      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        const shouldDiscard = discardRef.current;
        discardRef.current = false; // reset for future sessions

        if (shouldDiscard) {
          // Wipe buffered audio chunks so the blob is never created
          audioChunksRef.current = [];
          cleanup();
          resetRecorder(true);
          closeDialog();
          toast.info("Recording discarded", {
            description: "No data was uploaded or processed.",
          });
        } else {
          const audioBlob = new Blob(audioChunksRef.current, { type: recorder.mimeType });
          const durationSeconds = Math.round((Date.now() - startTimeRef.current) / 1000);
          handleAudioUpload(audioBlob, durationSeconds);
          cleanup();
          resetRecorder(true);
          closeDialog();
          toast.info("Meeting capture ended", {
            description: "Starting background processing and sync...",
          });
        }
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
      setLocalErrorMessage(err.message || "Microphone access denied. Please check browser permissions.");
      setStatus("error");
      toast.error("Microphone access denied");
    }
  };

  // Mute Mic
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

  // Markers & Notes placeholders
  const addMarker = () => {
    toast.success("Marker added at " + formatTime(duration));
  };

  const captureNote = () => {
    toast.success("Quick note flag captured");
  };

  // Stop Capture — ends the session and triggers upload + transcription
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
    setActiveStream(null);
  };

  // Discard Recording — stops without uploading or processing anything
  const discardRecording = () => {
    discardRef.current = true;
    stopRecording();
  };

  // Audio Upload pipeline — uploads to S3 then triggers ElevenLabs transcription in background
  const handleAudioUpload = async (audioBlob: Blob, durationSeconds: number) => {
    if (durationSeconds > 3600) {
      toast.warning("Meeting duration exceeds 60 minutes.");
    }

    try {
      const response = await api.post("v1/meetings/upload-url", {
        meetingId: null,
        fileName: `recording-${Date.now()}.webm`,
        contentType: audioBlob.type,
      });

      const { uploadUrl, s3Key, recordingId: recId } = response.data.data;

      // Upload audio to S3
      const uploadResponse = await fetch(uploadUrl, {
        method: "PUT",
        body: audioBlob,
        headers: { "Content-Type": audioBlob.type },
      });

      if (!uploadResponse.ok) {
        throw new Error("Failed to upload audio to S3 cloud storage.");
      }

      // Trigger transcription
      await api.post("v1/meetings/transcribe", {
        recordingId: recId,
        s3Key,
        durationSeconds: durationSeconds,
        contentType: audioBlob.type,
      });
    } catch (err: any) {
      console.error("[MeetingCompanion] Background Upload Error:", err);
      toast.error("Failed to process meeting recording", {
        description: err.message || "Please check developer console logs or try again."
      });
    }
  };

  // Transcription status Polling fallback
  useEffect(() => {
    if (status !== "transcribing" || !jobId || !recordingId) return;

    let active = true;
    let pollCount = 0;
    const maxPolls = 60;
    let currentDelay = 3000;

    const poll = async () => {
      if (!active) return;
      pollCount++;

      if (pollCount > maxPolls) {
        setStatus("error");
        setLocalErrorMessage("Transcription timed out after 10 minutes.");
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
          setLocalTranscript(recording.transcript_text);
          setLocalDiarizedTranscript(recording.transcript_diarized);
          setLocalLanguageDetected(recording.language_detected);
          toast.success("AI Transcription completed!");
          return;
        } else if (jobStatus === "failed") {
          if (!active) return;
          setStatus("error");
          setLocalErrorMessage("AI transcription job processing failed.");
          toast.error("AI Transcription failed");
          return;
        }
      } catch (err) {
        console.warn("Polling error (will retry):", err);
      }

      currentDelay = Math.min(currentDelay * 1.5, 15000);
      if (active) {
        setTimeout(poll, currentDelay);
      }
    };

    const initialTimeout = setTimeout(poll, currentDelay);

    return () => {
      active = false;
      clearTimeout(initialTimeout);
    };
  }, [status, jobId, recordingId]);

  // WebSocket instant notifications
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleMeetingUpdate = (payload: {
      type: string;
      recordingId: string;
      status: string;
      recording?: any;
    }) => {
      const activeId = meetingId || recordingId;
      if (payload.recordingId === activeId) {
        // Invalidate queries to ensure latest state is fetched
        queryClient.invalidateQueries({ queryKey: meetingKeys.recording(activeId) });
        queryClient.invalidateQueries({ queryKey: meetingKeys.all });

        if (payload.status === "completed" && payload.recording) {
          setStatus("completed");
          setLocalTranscript(payload.recording.transcript_text);
          setLocalDiarizedTranscript(payload.recording.transcript_diarized);
          setLocalLanguageDetected(payload.recording.language_detected);
          toast.success("AI Transcription completed!");
        } else if (payload.status === "failed") {
          setStatus("error");
          setLocalErrorMessage("AI transcription job processing failed. Check console logs.");
          toast.error("AI Transcription failed");
        }
      }
    };

    socket.on("meeting_update", handleMeetingUpdate);
    return () => {
      socket.off("meeting_update", handleMeetingUpdate);
    };
  }, [meetingId, recordingId, queryClient]);

  // Audio Playback
  const toggleAudioPlay = () => {
    if (!audioPlayerRef.current || !currentAudioUrl) return;
    if (isAudioPlaying) {
      audioPlayerRef.current.pause();
      setIsAudioPlaying(false);
    } else {
      audioPlayerRef.current.play().catch(e => console.error("Audio play failed:", e));
      setIsAudioPlaying(true);
    }
  };

  const handleAudioEnded = () => {
    setIsAudioPlaying(false);
    setCurrentTime(0);
  };

  const handleSeek = (value: number) => {
    if (audioPlayerRef.current) {
      audioPlayerRef.current.currentTime = value;
      setCurrentTime(value);
    }
  };

  const handlePlaybackRateChange = (rate: number) => {
    setPlaybackRate(rate);
    if (audioPlayerRef.current) {
      audioPlayerRef.current.playbackRate = rate;
    }
  };

  const toggleVolumeMute = () => {
    const nextMuted = !isVolumeMuted;
    setIsVolumeMuted(nextMuted);
    if (audioPlayerRef.current) {
      audioPlayerRef.current.volume = nextMuted ? 0 : audioVolume;
    }
  };

  // Review Dialog Mutations handlers
  const deleteRecordingId = meetingId || recordingId;
  const handleDelete = async () => {
    if (!deleteRecordingId) return;
    if (confirm("Permanently delete this meeting recording and its audio file? This action is irreversible.")) {
      try {
        await deleteMutation.mutateAsync(deleteRecordingId);
        toast.success("Recording deleted successfully");
        cleanup();
        resetRecorder();
        closeDialog();
      } catch (err: any) {
        console.error("Failed to delete recording:", err);
        toast.error("Failed to delete recording", {
          description: err.message || "An unexpected error occurred."
        });
      }
    }
  };

  const handleCancelTranscription = async () => {
    const cancelId = meetingId || recordingId;
    if (!cancelId) return;
    try {
      await cancelMutation.mutateAsync(cancelId);
      toast.success("Transcription sync cancelled");
      cleanup();
      resetRecorder();
      closeDialog();
    } catch (err: any) {
      console.error("Failed to cancel transcription:", err);
      toast.error("Failed to cancel transcription", {
        description: err.message || "An unexpected error occurred."
      });
    }
  };

  // Helpers
  const copyToClipboard = () => {
    if (!currentTranscript) return;
    navigator.clipboard.writeText(currentTranscript);
    toast.success("Transcript copied to clipboard!");
  };

  const downloadTextFile = () => {
    if (!currentTranscript) return;
    const element = document.createElement("a");
    const file = new Blob([currentTranscript], { type: "text/plain" });
    element.href = URL.createObjectURL(file);
    element.download = `meeting-transcript-${deleteRecordingId || "draft"}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const resetRecorder = (resetStatus = true) => {
    if (resetStatus) setStatus("idle");
    setDuration(0);
    setLocalTranscript(null);
    setLocalDiarizedTranscript(null);
    setLocalLanguageDetected(null);
    setLocalErrorMessage(null);
    setLocalAudioUrl(null);
    setIsAudioPlaying(false);
    setRecordingId(null);
    setJobId(null);
    setIsMuted(false);
    setIsPaused(false);
  };

  const handleClose = () => {
    if (currentStatus === "recording") {
      // Closing during an active recording always discards — no upload, no processing
      discardRecording();
    } else {
      closeDialog();
    }
  };

  const handleOverlayClick = () => {
    if (currentStatus === "recording") {
      minimizeDialog();
    } else {
      closeDialog();
    }
  };

  const handleVisualizerChange = (type: "bar" | "aura" | "grid" | "wave" | "radial") => {
    setVisualizerType(type);
    localStorage.setItem("keil_meeting_visualizer", type);
  };

  // Helper speaker styles
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



  // Speaker metrics
  const speakerIds = currentDiarizedTranscript?.entries
    ? (Array.from(new Set(currentDiarizedTranscript.entries.map((e: any) => e.speaker_id))) as (string | number)[])
    : [];
  const speakerCount = speakerIds.length > 0 ? speakerIds.length : 0;
  const wordCount = currentTranscript ? currentTranscript.split(/\s+/).filter(Boolean).length.toLocaleString() : "0";

  // Visualizer volume converters
  // IMPORTANT: All 5 visualizers only activate volume-reactive rendering when state === "speaking".
  // "listening" just shows an idle animation pattern without audio data. So we MUST use
  // "speaking" during active recording so the volumesOverride/volumeOverride props actually drive the visuals.
  const getVisualizerState = () => {
    if (currentStatus === "recording") {
      if (isPaused) return "idle";
      return "speaking"; // ← MUST be "speaking" for all visualizers to react to audio
    }
    if (currentStatus === "uploading" || currentStatus === "transcribing") {
      return "thinking";
    }
    return "idle";
  };

  // True 0-1 average volume (no floor) for wave/aura hooks that expect clean 0-1 range
  const averageVolume = useMemo(() => {
    if (currentStatus !== "recording" || isPaused) return 0;
    const avg = localVolumes.reduce((sum, v) => sum + v, 0) / localVolumes.length;
    // Subtract the baseline 0.05 floor we add in the analyser, then clamp 0-1
    return Math.min(Math.max((avg - 0.05) / 0.95, 0), 1);
  }, [localVolumes, currentStatus, isPaused]);

  const interpolateVolumes = (volumes: number[], targetLength: number): number[] => {
    if (volumes.length === 0) return new Array(targetLength).fill(0);
    const result: number[] = [];
    for (let i = 0; i < targetLength; i++) {
      const floatIndex = (i / (targetLength - 1)) * (volumes.length - 1);
      const low = Math.floor(floatIndex);
      const high = Math.ceil(floatIndex);
      const weight = floatIndex - low;
      const value = volumes[low] * (1 - weight) + volumes[high] * weight;
      result.push(value);
    }
    return result;
  };

  const radialVolumes = useMemo(() => {
    return currentStatus === "recording" && !isPaused ? interpolateVolumes(localVolumes, 24) : new Array(24).fill(0);
  }, [localVolumes, currentStatus, isPaused]);

  // Unified visualizer renderer
  //
  // KEY DESIGN:
  // - isIdlePreview=true  → decorative preview on the idle screen, uses "listening" state + fixed demo volumes
  // - isIdlePreview=false → live recording screen, uses "speaking" state + real mic volumes
  //   (All 5 visualizers only render volume-reactively when state === "speaking")
  const renderVisualizer = (isIdlePreview = false) => {
    // For the idle preview: use "listening" for a nice animated look but fixed demo data
    // For live recording: "speaking" activates all volume-reactive code paths in each component
    const liveState = getVisualizerState() as AgentState;
    const activeState: AgentState = isIdlePreview ? "listening" : liveState;

    // Volumes for live mode — always real mic data when speaking; zero otherwise
    const liveVolumes5 = currentStatus === "recording" && !isPaused ? localVolumes : new Array(5).fill(0);
    const liveAvg = currentStatus === "recording" && !isPaused ? averageVolume : 0;
    const liveRadial = currentStatus === "recording" && !isPaused ? radialVolumes : new Array(24).fill(0);

    // Demo volumes for the idle preview — center-heavy pyramid shape for visual balance
    // Matches the mirrored center-out layout [outer, inner, CENTER, inner, outer]
    const previewVolumes5 = [0.15, 0.45, 0.80, 0.45, 0.15];
    const previewAvg = 0.40;
    const previewRadial = interpolateVolumes(previewVolumes5, 24);

    const volumesFor5 = isIdlePreview ? previewVolumes5 : liveVolumes5;
    const avgVol = isIdlePreview ? previewAvg : liveAvg;
    const radialVols = isIdlePreview ? previewRadial : liveRadial;

    const isDark = typeof document !== "undefined" && document.documentElement.classList.contains("dark");
    const themeMode = isDark ? "dark" : "light";

    switch (visualizerType) {
      case "bar":
        // Bar: volumesOverride sets bar heights; works with any state when override is provided
        return (
          <div className="flex items-center justify-center w-full">
            <AgentAudioVisualizerBar
              size="lg"
              state={activeState}
              barCount={5}
              volumesOverride={volumesFor5}
              className="text-cyan-500"
            />
          </div>
        );
      case "aura":
        // Aura: volumeOverride only drives the scale when state="speaking"
        return (
          <div className="flex items-center justify-center w-full">
            <AgentAudioVisualizerAura
              size="lg"
              state={activeState}
              color="#06b6d4"
              themeMode={themeMode}
              volumeOverride={avgVol}
              className="scale-95"
            />
          </div>
        );
      case "grid":
        // Grid: volumesOverride only drives cell highlights when state="speaking"
        // NOTE: wrapped in centering div because CSS grid with 1fr and no explicit width
        // resolves to min-content in flex parents, causing left-shift
        return (
          <div className="flex items-center justify-center w-full">
            <AgentAudioVisualizerGrid
              size="xl"
              state={activeState}
              rowCount={5}
              columnCount={5}
              color="#06b6d4"
              volumesOverride={volumesFor5}
            />
          </div>
        );
      case "wave":
        // Wave: volumeOverride only drives amplitude/frequency when state="speaking"
        return (
          <div className="flex items-center justify-center w-full">
            <AgentAudioVisualizerWave
              size="xl"
              state={activeState}
              color="#06b6d4"
              colorShift={0.3}
              lineWidth={2}
              blur={0.1}
              volumeOverride={avgVol}
              className="w-full max-w-[400px] h-[160px]"
            />
          </div>
        );
      case "radial":
        // Radial: volumesOverride only drives bar heights when state="speaking"
        return (
          <div className="flex items-center justify-center w-full">
            <AgentAudioVisualizerRadial
              size="lg"
              state={activeState}
              barCount={24}
              color="#06b6d4"
              volumesOverride={radialVols}
            />
          </div>
        );
      default:
        return null;
    }
  };

  const shouldRender = isDialogOpen || isMinimized || (currentStatus !== "idle" && currentStatus !== "completed");
  if (!shouldRender) return null;

  const isVisible = isDialogOpen && !isMinimized;

  // Formatting segment times
  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return [h > 0 ? h : null, m.toString().padStart(2, "0"), s.toString().padStart(2, "0")]
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

  return (
    <>
      <audio
        ref={audioPlayerRef}
        src={currentAudioUrl || undefined}
        onEnded={handleAudioEnded}
        onTimeUpdate={() => {
          if (audioPlayerRef.current) {
            setCurrentTime(audioPlayerRef.current.currentTime);
          }
        }}
        onLoadedMetadata={() => {
          if (audioPlayerRef.current) {
            setAudioDuration(audioPlayerRef.current.duration);
            audioPlayerRef.current.playbackRate = playbackRate;
            audioPlayerRef.current.volume = isVolumeMuted ? 0 : audioVolume;
          }
        }}
        className="hidden"
      />

      {/* ─── Standard Dialog Overlay ─── */}
      {isDialogOpen && (
        <div
          className={cn(
            "fixed inset-0 z-50 flex items-center justify-center transition-all duration-500",
            isVisible ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
          )}
        >
          <div
            className={cn(
              "absolute inset-0 bg-black/30 dark:bg-black/50 backdrop-blur-sm transition-opacity duration-500",
              isVisible ? "opacity-100" : "opacity-0"
            )}
            onClick={handleOverlayClick}
          />

          {/* Floating companion shell container with dynamic scaling */}
          <motion.div
            layout
            transition={{ type: "spring", stiffness: 350, damping: 25 }}
            className={cn(
              "relative w-full overflow-hidden transition-all duration-300 transform",
              isCompleted ? "max-w-[1020px] px-4 md:px-0" : "max-w-[620px] px-4"
            )}
          >
            <div className="w-full bg-background border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col">
              {isLoadingRecording ? (
                <div className="h-48 flex flex-col items-center justify-center gap-3">
                  <Loader2 className="size-6 animate-spin text-cyan-500" />
                  <span className="text-xs text-muted-foreground">Loading session details...</span>
                </div>
              ) : isErrorLoadingRecording ? (
                <div className="p-6 text-center flex flex-col items-center gap-4">
                  <AlertCircle className="size-8 text-rose-500" />
                  <h3 className="text-sm font-semibold text-foreground">Failed to load meeting review</h3>
                  <button
                    onClick={handleClose}
                    className="bg-primary hover:bg-primary/95 text-primary-foreground text-xs px-4 py-2 rounded-lg cursor-pointer"
                  >
                    Close Dialog
                  </button>
                </div>
              ) : (
                <>
                  {/* IDLE STATE */}
                  {currentStatus === "idle" && (
                    <div className="w-full flex flex-col select-none animate-in fade-in zoom-in-95 duration-300 min-h-[460px]">
                      {/* Unified header: title | tabs | minimize | close */}
                      <div className="flex items-center gap-2 shrink-0 px-4 py-2.5 border-border/50">
                        <div className="flex items-center gap-2 shrink-0">
                          <Mic className="size-4 text-muted-foreground" />
                          <span className="text-[12px] font-semibold tracking-wide text-foreground">
                            Meeting Sync
                          </span>
                        </div>

                        {/* Menu component to show all types of view of recorder — centered, flex-1 */}
                        <div className="flex flex-1 justify-center">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border/50 bg-muted/30 hover:bg-muted/60 text-[11px] font-semibold text-foreground transition-all cursor-pointer select-none active:scale-[0.97]">
                                {(() => {
                                  const vis = visualizers.find((v) => v.id === visualizerType) || visualizers[0];
                                  const Icon = vis.icon;
                                  return (
                                    <>
                                      <Icon className="size-3.5 text-cyan-500" />
                                      <span>{vis.name} View</span>
                                      <ChevronDown className="size-3 text-muted-foreground ml-0.5" />
                                    </>
                                  );
                                })()}
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="center" className="w-36">
                              {visualizers.map((vis) => {
                                const Icon = vis.icon;
                                const active = visualizerType === vis.id;
                                return (
                                  <DropdownMenuItem
                                    key={vis.id}
                                    onClick={() => handleVisualizerChange(vis.id)}
                                    className={cn(
                                      "flex items-center gap-2 text-[11px] cursor-pointer",
                                      active ? "text-cyan-500 font-semibold bg-cyan-500/[0.04]" : "text-foreground"
                                    )}
                                  >
                                    <Icon className={cn("size-3.5", active ? "text-cyan-500" : "text-muted-foreground")} />
                                    <span>{vis.name}</span>
                                  </DropdownMenuItem>
                                );
                              })}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>

                        {/* Minimize + Close */}
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={minimizeDialog}
                            title="Minimize"
                            className="size-7 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors cursor-pointer border border-border/50"
                          >
                            <Minimize2 className="size-3.5" />
                          </button>
                          <button
                            onClick={handleClose}
                            className="size-7 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors cursor-pointer border border-border/50"
                          >
                            <X className="size-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Visualizer — center-aligned with soft breathing gradient aura */}
                      <div className="relative flex flex-1 items-center justify-center py-10 px-5 overflow-hidden">
                        <motion.div
                          animate={{
                            scale: [0.98, 1.05, 0.98],
                            opacity: [0.08, 0.15, 0.08],
                          }}
                          transition={{
                            duration: 4,
                            repeat: Infinity,
                            ease: "easeInOut",
                          }}
                          className="absolute w-[200px] h-[200px] rounded-full bg-cyan-500/20 blur-[50px] pointer-events-none z-0"
                        />
                        <div className="relative z-10 w-full flex justify-center">
                          {renderVisualizer(true)}
                        </div>
                      </div>

                      {/* Premium Start Capture Button Footer */}
                      <div className="flex justify-center border-t border-border px-5 py-5">
                        <button
                          onClick={startRecording}
                          className="relative group bg-primary hover:bg-primary/95 text-primary-foreground font-semibold text-xs tracking-wider uppercase px-8 h-10 rounded-full cursor-pointer flex items-center justify-center gap-2.5 shadow-md hover:shadow-primary/10 transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.98] active:translate-y-0 border border-primary/20 overflow-hidden"
                        >
                          <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                          <Mic className="size-4 text-primary-foreground/90 transition-transform group-hover:scale-110 duration-200" />
                          <span>Start Capture</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* RECORDING / PROCESSING / TRANSCRIBING */}
                  {currentStatus !== "idle" && !isCompleted && (
                    <div className="w-full flex flex-col select-none animate-in fade-in zoom-in-95 duration-300 min-h-[460px]">

                      {/* Unified header: status | tabs | minimize | close */}
                      <div className="flex items-center gap-2 shrink-0 px-4 py-2.5 border-border/50">
                        <div className="flex items-center gap-2 shrink-0">
                          {currentStatus === "recording" ? (
                            <CircleDot
                              className={cn(
                                "size-4 transition-all duration-300",
                                isPaused ? "text-amber-500" : "text-rose-500 animate-pulse"
                              )}
                            />
                          ) : (
                            <Loader2 className="size-4 animate-spin text-cyan-500" />
                          )}
                          <span className="text-[12px] font-semibold tracking-wide text-foreground">
                            {currentStatus === "recording"
                              ? (isPaused ? "Paused" : "Recording")
                              : currentStatus === "uploading"
                                ? "Uploading"
                                : "Processing"}
                          </span>
                        </div>

                        {/* Menu component to show all types of view of recorder — centered, flex-1 */}
                        <div className="flex flex-1 justify-center">
                          {currentStatus === "recording" && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border/50 bg-muted/30 hover:bg-muted/60 text-[11px] font-semibold text-foreground transition-all cursor-pointer select-none active:scale-[0.97]">
                                  {(() => {
                                    const vis = visualizers.find((v) => v.id === visualizerType) || visualizers[0];
                                    const Icon = vis.icon;
                                    return (
                                      <>
                                        <Icon className="size-3.5 text-cyan-500" />
                                        <span>{vis.name} View</span>
                                        <ChevronDown className="size-3 text-muted-foreground ml-0.5" />
                                      </>
                                    );
                                  })()}
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="center" className="w-36">
                                {visualizers.map((vis) => {
                                  const Icon = vis.icon;
                                  const active = visualizerType === vis.id;
                                  return (
                                    <DropdownMenuItem
                                      key={vis.id}
                                      onClick={() => handleVisualizerChange(vis.id)}
                                      className={cn(
                                        "flex items-center gap-2 text-[11px] cursor-pointer",
                                        active ? "text-cyan-500 font-semibold bg-cyan-500/[0.04]" : "text-foreground"
                                      )}
                                    >
                                      <Icon className={cn("size-3.5", active ? "text-cyan-500" : "text-muted-foreground")} />
                                      <span>{vis.name}</span>
                                    </DropdownMenuItem>
                                  );
                                })}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </div>

                        {/* Minimize + Cancel/Close */}
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={minimizeDialog}
                            title="Minimize to Sidebar"
                            className="size-7 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors cursor-pointer border border-border/50"
                          >
                            <Minimize2 className="size-3.5" />
                          </button>

                          {(currentStatus === "transcribing" || currentStatus === "uploading") && deleteRecordingId && (
                            <button
                              onClick={handleCancelTranscription}
                              title="Cancel Transcription"
                              className="size-7 rounded-lg hover:bg-rose-500/10 flex items-center justify-center text-rose-500 transition-colors cursor-pointer border border-border/50"
                            >
                              <X className="size-3.5" />
                            </button>
                          )}

                          <button
                            onClick={handleClose}
                            title="Close"
                            className="size-7 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors cursor-pointer border border-border/50"
                          >
                            <X className="size-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Immersive Visualizer Canvas with Floating Controls Capsule */}
                      <div className="relative w-full bg-muted/10 dark:bg-zinc-900/20 border-border/30 flex-1 flex flex-col items-center justify-center py-10 px-4 min-h-[280px]">
                        {/* Dynamic breathing glow aura */}
                        <motion.div
                          animate={{
                            scale: currentStatus === "recording" && !isPaused ? [0.95, 1.12, 0.95] : 1.0,
                            opacity: currentStatus === "recording" && !isPaused ? [0.15, 0.28, 0.15] : 0.15,
                          }}
                          transition={{
                            duration: 3,
                            repeat: Infinity,
                            ease: "easeInOut",
                          }}
                          className={cn(
                            "absolute w-[240px] h-[240px] rounded-full blur-[60px] pointer-events-none z-0 transition-colors duration-1000",
                            currentStatus === "recording" && !isPaused
                              ? "bg-rose-500/25"
                              : currentStatus === "recording" && isPaused
                                ? "bg-amber-500/20"
                                : currentStatus === "uploading" || currentStatus === "transcribing"
                                  ? "bg-cyan-500/25"
                                  : "bg-zinc-500/10"
                          )}
                        />

                        {/* Visualizer component */}
                        <div className="relative z-10 w-full flex justify-center py-4">
                          {renderVisualizer(false)}
                        </div>

                        {/* Floating HUD Control Capsule (Only show when recording) */}
                        {currentStatus === "recording" && (
                          <div className="absolute bottom-4 z-20 flex flex-col items-center gap-3">
                            <div className="flex items-center gap-3 px-4 py-2 bg-popover/90 dark:bg-zinc-950/85 border border-border shadow-xl backdrop-blur-md rounded-full">
                              {/* Monospace timer with status dot */}
                              <div className="flex items-center gap-2 pr-2.5 border-r border-border/60">
                                <CircleDot
                                  className={cn(
                                    "size-3.5 transition-all duration-300",
                                    isPaused ? "text-amber-500" : "text-rose-500 animate-pulse"
                                  )}
                                />
                                <span className="text-xs font-mono font-bold text-foreground tabular-nums select-none min-w-[38px]">
                                  {formatTime(duration)}
                                </span>
                              </div>

                              {/* Capture controls */}
                              <div className="flex items-center gap-1.5">
                                <button
                                  onClick={toggleMute}
                                  className={cn(
                                    "size-7.5 rounded-full flex items-center justify-center border transition-all active:scale-90 cursor-pointer",
                                    isMuted
                                      ? "bg-rose-500/10 border-rose-500/30 text-rose-500 hover:bg-rose-500/25"
                                      : "bg-muted/80 border-border/60 text-muted-foreground hover:text-foreground hover:bg-muted"
                                  )}
                                  title={isMuted ? "Unmute Mic" : "Mute Mic"}
                                >
                                  {isMuted ? <MicOff className="size-3.5" /> : <Mic className="size-3.5" />}
                                </button>

                                <button
                                  onClick={togglePause}
                                  className={cn(
                                    "size-7.5 rounded-full flex items-center justify-center border transition-all active:scale-90 cursor-pointer",
                                    isPaused
                                      ? "bg-cyan-500/15 border-cyan-500/30 text-cyan-500 hover:bg-cyan-500/25 animate-pulse"
                                      : "bg-muted/80 border-border/60 text-muted-foreground hover:text-foreground hover:bg-muted"
                                  )}
                                  title={isPaused ? "Resume Capture" : "Pause Capture"}
                                >
                                  {isPaused ? <Play className="size-3.5 text-cyan-500 fill-cyan-500" /> : <Pause className="size-3.5" />}
                                </button>

                                <button
                                  onClick={addMarker}
                                  className="size-7.5 rounded-full bg-muted/80 border border-border/60 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors active:scale-90 cursor-pointer"
                                  title="Add marker flag"
                                >
                                  <Bookmark className="size-3.5" />
                                </button>

                                <button
                                  onClick={captureNote}
                                  className="size-7.5 rounded-full bg-muted/80 border border-border/60 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors active:scale-90 cursor-pointer"
                                  title="Capture note segment"
                                >
                                  <Notebook className="size-3.5" />
                                </button>
                              </div>

                              {/* End Session Button inside HUD */}
                              <div className="pl-2.5 border-l border-border/60">
                                <button
                                  onClick={stopRecording}
                                  className="bg-rose-500 hover:bg-rose-600 text-white font-semibold text-[9px] tracking-wider uppercase h-7 px-3.5 rounded-full cursor-pointer flex items-center justify-center gap-1 transition-all active:scale-95 shadow-sm shadow-rose-500/10"
                                >
                                  <span>End</span>
                                </button>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Uploading/processing loader inside visualizer canvas */}
                        {currentStatus !== "recording" && (
                          <div className="absolute bottom-6 z-20 flex items-center gap-2 text-muted-foreground font-semibold text-[10px] tracking-widest uppercase bg-popover/85 dark:bg-zinc-950/85 border border-border/50 px-4.5 py-2 rounded-full shadow-md backdrop-blur-sm">
                            <Loader2 className="size-3.5 animate-spin text-cyan-500" />
                            <span>
                              {currentStatus === "uploading" ? "Syncing session context..." : "Ingesting diarized timeline..."}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="w-full flex flex-col p-6 pt-4 select-none">
                        <p className="text-[11px] font-medium text-muted-foreground/80 tracking-wide text-center">
                          {currentStatus === "recording" && isPaused
                            ? "Capture paused"
                            : currentStatus === "recording"
                              ? "Listening and gathering workspace context..."
                              : currentStatus === "uploading"
                                ? "Ingesting capture stream..."
                                : "Analyzing conversations and context..."}
                        </p>

                        {currentStatus === "recording" && (
                          <div className="flex justify-center mt-3">
                            <button
                              onClick={discardRecording}
                              className="text-[10px] font-semibold text-muted-foreground/50 hover:text-rose-500 hover:bg-rose-500/[0.04] dark:hover:bg-rose-500/[0.06] tracking-wider uppercase transition-colors cursor-pointer px-3.5 py-1.5 rounded-lg border border-transparent hover:border-rose-500/10"
                            >
                              Discard capture
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* REVIEW / COMPLETED MODE */}
                  {isCompleted && (
                    <div className="w-full flex flex-col select-none relative animate-in fade-in slide-in-from-bottom-4 duration-500">
                      <div className="flex flex-col md:flex-row w-full overflow-hidden h-[560px] bg-background">
                        {/* Left Column */}
                        <div className="w-full md:w-[240px] flex flex-col items-center justify-between p-5 shrink-0 md:border-r border-border bg-muted-[0.02] dark:bg-zinc-900/[0.02] transition-all select-none">
                          <div className="w-full flex-1 flex flex-col items-center justify-center gap-5">
                            {/* Circular Playback Progress Ring */}
                            <div className="relative size-[100px] flex items-center justify-center group">
                              {/* Background track circle */}
                              <svg className="absolute inset-0 size-full -rotate-90">
                                <circle
                                  cx="50"
                                  cy="50"
                                  r="42"
                                  className="stroke-muted/20 dark:stroke-zinc-800/60 fill-transparent"
                                  strokeWidth="3"
                                />
                                {/* Dynamic progress circle */}
                                <motion.circle
                                  cx="50"
                                  cy="50"
                                  r="42"
                                  className={cn(
                                    "fill-transparent transition-all duration-150 ease-out",
                                    currentStatus === "completed" ? "stroke-cyan-500" : "stroke-rose-500"
                                  )}
                                  strokeWidth="3"
                                  strokeLinecap="round"
                                  strokeDasharray={2 * Math.PI * 42}
                                  animate={{
                                    strokeDashoffset: 2 * Math.PI * 42 - (((currentDuration || audioDuration) ? (currentTime / (currentDuration || audioDuration)) * 100 : 0) / 100) * (2 * Math.PI * 42)
                                  }}
                                  transition={{ duration: 0.1, ease: "linear" }}
                                />
                              </svg>

                              {/* Inner Status Icon */}
                              <div className="flex flex-col items-center justify-center">
                                {currentStatus === "completed" ? (
                                  <CheckCircle className="size-6 text-emerald-500 animate-in fade-in duration-300" />
                                ) : (
                                  <AlertCircle className="size-6 text-rose-500 animate-in fade-in duration-300" />
                                )}
                                <span className="text-[9px] font-bold tracking-widest text-muted-foreground uppercase mt-1">
                                  {currentStatus === "completed" ? "Recorded" : "Failure"}
                                </span>
                              </div>
                            </div>

                            <div className="text-center w-full flex flex-col gap-3.5">
                              {currentAudioUrl && (
                                <div className="w-full bg-muted/20 dark:bg-zinc-900/30 border border-border/30 rounded-xl p-3 flex flex-col gap-2.5 shadow-sm">
                                  {/* Time display */}
                                  <div className="flex justify-between items-center text-[10px] font-mono text-muted-foreground">
                                    <span className="tabular-nums">{formatTime(currentTime)}</span>
                                    <span className="tabular-nums">{formatTime(currentDuration || audioDuration)}</span>
                                  </div>

                                  {/* Seek Slider Container */}
                                  <div className="relative w-full group/seek flex items-center h-2">
                                    <input
                                      type="range"
                                      min={0}
                                      max={currentDuration || audioDuration || 100}
                                      value={currentTime}
                                      step={0.1}
                                      onChange={(e) => handleSeek(parseFloat(e.target.value))}
                                      className="w-full h-1 bg-muted dark:bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-cyan-500 focus:outline-none transition-all group-hover/seek:h-1.5 [&::-webkit-slider-runnable-track]:bg-transparent [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-cyan-500 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:opacity-0 [&::-webkit-slider-thumb]:group-hover/seek:opacity-100 [&::-webkit-slider-thumb]:transition-opacity"
                                    />
                                    {/* Visual fill track */}
                                    <div
                                      className="absolute top-0 bottom-0 left-0 bg-cyan-500 rounded-lg pointer-events-none transition-all group-hover/seek:h-1.5"
                                      style={{
                                        width: `${(currentDuration || audioDuration) ? (currentTime / (currentDuration || audioDuration)) * 100 : 0}%`,
                                        height: '4px'
                                      }}
                                    />
                                  </div>

                                  {/* Playback Control Console */}
                                  <div className="flex items-center justify-between w-full mt-1.5">
                                    {/* Volume Mute Toggle */}
                                    <button
                                      onClick={toggleVolumeMute}
                                      className="size-7 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-all duration-200 active:scale-95 cursor-pointer"
                                      title={isVolumeMuted ? "Unmute" : "Mute"}
                                    >
                                      {isVolumeMuted ? (
                                        <VolumeX className="size-4 text-rose-500 animate-in zoom-in-95 duration-150" />
                                      ) : (
                                        <Volume2 className="size-4 animate-in zoom-in-95 duration-150" />
                                      )}
                                    </button>

                                    {/* Play/Pause & Skip group */}
                                    <div className="flex items-center gap-1.5">
                                      <button
                                        onClick={() => handleSeek(Math.max(currentTime - 10, 0))}
                                        className="size-7 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-all duration-150 active:scale-95 cursor-pointer"
                                        title="Rewind 10s"
                                      >
                                        <SkipBack className="size-3.5" />
                                      </button>

                                      <button
                                        onClick={toggleAudioPlay}
                                        className="size-9 rounded-full bg-cyan-500 hover:bg-cyan-600 active:scale-[0.93] text-white flex items-center justify-center transition-all duration-150 shadow-md hover:shadow-cyan-500/10 cursor-pointer"
                                        title={isAudioPlaying ? "Pause" : "Play"}
                                      >
                                        {isAudioPlaying ? (
                                          <Pause className="size-4 fill-white" />
                                        ) : (
                                          <Play className="size-4 fill-white ml-0.5" />
                                        )}
                                      </button>

                                      <button
                                        onClick={() => handleSeek(Math.min(currentTime + 10, currentDuration || audioDuration || 0))}
                                        className="size-7 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-all duration-150 active:scale-95 cursor-pointer"
                                        title="Forward 10s"
                                      >
                                        <SkipForward className="size-3.5" />
                                      </button>
                                    </div>

                                    {/* Speed Selector */}
                                    <div className="relative group/speed">
                                      <button
                                        className="h-7 px-1.5 rounded-lg hover:bg-muted border border-border/30 text-[9px] font-semibold font-mono text-muted-foreground hover:text-foreground transition-all duration-200 flex items-center justify-center gap-1 active:scale-95 cursor-pointer"
                                      >
                                        {playbackRate}x
                                      </button>
                                      <div className="absolute bottom-full right-0 mb-1 hidden group-hover/speed:flex flex-col bg-background border border-border shadow-lg rounded-xl p-0.5 z-30 min-w-14 animate-in fade-in duration-100">
                                        {[1.0, 1.25, 1.5, 2.0].map((rate) => (
                                          <button
                                            key={rate}
                                            onClick={() => handlePlaybackRateChange(rate)}
                                            className={cn(
                                              "w-full text-left px-2 py-1 rounded-md text-[9px] font-mono transition-colors cursor-pointer",
                                              playbackRate === rate
                                                ? "bg-cyan-500/10 text-cyan-500 font-semibold"
                                                : "text-muted-foreground hover:text-foreground hover:bg-muted"
                                            )}
                                          >
                                            {rate}x
                                          </button>
                                        ))}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="w-full flex flex-col items-center gap-4 shrink-0 mt-4">
                            {!isHistoricalReview && (
                              <button
                                onClick={() => resetRecorder(true)}
                                className="w-full border border-border hover:border-border/80 text-muted-foreground hover:text-foreground hover:bg-muted/50 font-semibold text-[10px] tracking-wider uppercase rounded-lg h-8 px-4 cursor-pointer flex items-center justify-center gap-1.5 transition-all duration-200 active:scale-98"
                              >
                                <Undo2 className="size-3.5" />
                                New capture
                              </button>
                            )}

                            {currentStatus === "error" && currentErrorMessage && (
                              <div className="w-full mt-1 p-2.5 rounded-lg bg-rose-500/5 border border-rose-500/10 text-rose-500 text-left max-h-[100px] overflow-y-auto">
                                <p className="text-[10px] text-rose-500/80 leading-relaxed font-normal whitespace-pre-wrap">
                                  {currentErrorMessage}
                                </p>
                              </div>
                            )}

                            {/* Horizontal Grid Metrics */}
                            {currentStatus === "completed" && (
                              <div className="w-full grid grid-cols-3 gap-1 bg-muted/30 dark:bg-zinc-900/30 border border-border/20 p-2 rounded-xl text-center shadow-sm">
                                <div className="flex flex-col gap-0.5">
                                  <span className="text-[8px] font-bold text-muted-foreground/80 uppercase tracking-widest">Speakers</span>
                                  <span className="text-[11px] font-semibold text-foreground font-mono">{speakerCount}</span>
                                </div>
                                <div className="flex flex-col gap-0.5 border-x border-border/20">
                                  <span className="text-[8px] font-bold text-muted-foreground/80 uppercase tracking-widest">Language</span>
                                  <span className="text-[11px] font-semibold text-foreground uppercase font-mono">{currentLanguageDetected || "en-IN"}</span>
                                </div>
                                <div className="flex flex-col gap-0.5">
                                  <span className="text-[8px] font-bold text-muted-foreground/80 uppercase tracking-widest">Words</span>
                                  <span className="text-[11px] font-semibold text-foreground font-mono">{wordCount}</span>
                                </div>
                              </div>
                            )}

                            {/* STT Model Selector */}
                            {deleteRecordingId && (
                              <div className="w-full flex flex-col gap-1 text-left">
                                <label className="text-[8px] font-bold uppercase tracking-widest text-muted-foreground/85">
                                  Transcription Model
                                </label>
                                <div className="relative flex p-0.5 bg-muted/40 dark:bg-zinc-900/40 rounded-lg border border-border/20">
                                  {/* Sliding background slider indicator */}
                                  <div
                                    className={cn(
                                      "absolute top-0.5 bottom-0.5 w-[calc(50%-2px)] bg-background rounded-md shadow-sm border border-border/40 transition-transform duration-200 ease-out",
                                      selectedProvider === "elevenlabs" ? "translate-x-full" : "translate-x-0"
                                    )}
                                  />
                                  <button
                                    onClick={() => setSelectedProvider("sarvam")}
                                    className={cn(
                                      "relative flex-1 py-1 rounded-md text-[9px] font-semibold transition-colors duration-200 cursor-pointer text-center z-10 active:scale-98",
                                      selectedProvider === "sarvam"
                                        ? "text-cyan-500"
                                        : "text-muted-foreground hover:text-foreground"
                                    )}
                                  >
                                    Sarvam AI
                                  </button>
                                  <button
                                    onClick={() => setSelectedProvider("elevenlabs")}
                                    className={cn(
                                      "relative flex-1 py-1 rounded-md text-[9px] font-semibold transition-colors duration-200 cursor-pointer text-center z-10 active:scale-98",
                                      selectedProvider === "elevenlabs"
                                        ? "text-cyan-500"
                                        : "text-muted-foreground hover:text-foreground"
                                    )}
                                  >
                                    ElevenLabs
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Right Column */}
                        <div className="flex-1 flex flex-col min-w-0 bg-background">
                          <div className="h-11 px-5 border-border flex items-center justify-between shrink-0 bg-background select-none">
                            <div className="flex items-center gap-2">
                              {currentStatus === "completed" ? (
                                <CheckCircle className="size-4 text-emerald-500" />
                              ) : (
                                <AlertCircle className="size-4 text-rose-500" />
                              )}
                              <span className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
                                Capture Transcript Timeline
                              </span>
                            </div>

                            <div className="flex items-center gap-3">
                              {/* Speaker Filter Pills */}
                              {speakerIds.length > 0 && (
                                <div className="flex items-center gap-1">
                                  {speakerIds.map((spId) => {
                                    const idNum = parseInt(spId.toString().replace(/\D/g, "")) || 0;
                                    const isSelected = selectedSpeakers.includes(spId.toString());
                                    return (
                                      <button
                                        key={spId}
                                        onClick={() => toggleSpeakerFilter(spId.toString())}
                                        className={cn(
                                          "text-[9px] font-semibold tracking-wide uppercase px-2 py-0.5 rounded-full border transition-all duration-150 active:scale-95 cursor-pointer",
                                          isSelected
                                            ? "bg-cyan-500/10 border-cyan-500/30 text-cyan-500"
                                            : "bg-muted/30 border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/60"
                                        )}
                                      >
                                        {`Speaker ${String.fromCharCode(65 + idNum)}`}
                                      </button>
                                    );
                                  })}
                                </div>
                              )}

                              {/* Divider between speaker filters and transcribe button */}
                              {speakerIds.length > 0 && deleteRecordingId && (
                                <div className="h-4 w-[1px] bg-border" />
                              )}

                              {/* Transcribe Again Button */}
                              {deleteRecordingId && (
                                <button
                                  onClick={async () => {
                                    try {
                                      toast.loading("Re-triggering transcription...", { id: "transcribe-retry" });
                                      const res = await transcribeMutation.mutateAsync({
                                        recordingId: deleteRecordingId,
                                        provider: selectedProvider,
                                      });
                                      setStatus("transcribing");
                                      setJobId(res.jobId);
                                      setRecordingId(res.recordingId);
                                      toast.success("AI Transcription triggered!", { id: "transcribe-retry" });
                                    } catch (err: any) {
                                      console.error("Transcription trigger failed:", err);
                                      toast.error(err.message || "Failed to trigger transcription.", { id: "transcribe-retry" });
                                    }
                                  }}
                                  disabled={transcribeMutation.isPending}
                                  className="flex items-center gap-1 px-2.5 h-7 bg-cyan-500 hover:bg-cyan-600 disabled:bg-muted disabled:text-muted-foreground text-white font-semibold text-[9px] tracking-wider uppercase rounded-lg transition-all duration-200 active:scale-95 cursor-pointer shadow-sm select-none"
                                  title="Re-transcribe using the selected model"
                                >
                                  {transcribeMutation.isPending ? (
                                    <Loader2 className="size-3 animate-spin" />
                                  ) : (
                                    <RotateCcw className="size-3" />
                                  )}
                                  <span>{transcribeMutation.isPending ? "Transcribing..." : "Transcribe"}</span>
                                </button>
                              )}

                              {/* Divider between transcribe button and standard action buttons */}
                              {deleteRecordingId && (
                                <div className="h-4 w-[1px] bg-border" />
                              )}

                              {/* Action Buttons: Copy, Download, Delete, Minimize, Close */}
                              <div className="flex items-center gap-0.5">
                                {currentStatus === "completed" && currentTranscript && (
                                  <>
                                    <button
                                      onClick={copyToClipboard}
                                      title="Copy Transcript"
                                      className="size-7 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center cursor-pointer transition-colors"
                                    >
                                      <Copy className="size-3.5" />
                                    </button>
                                    <button
                                      onClick={downloadTextFile}
                                      title="Download Transcript"
                                      className="size-7 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center cursor-pointer transition-colors"
                                    >
                                      <Download className="size-3.5" />
                                    </button>
                                  </>
                                )}

                                {deleteRecordingId && (
                                  <button
                                    onClick={handleDelete}
                                    disabled={deleteMutation.isPending}
                                    title="Delete Recording"
                                    className="size-7 rounded-lg hover:bg-rose-500/10 text-rose-500 hover:text-rose-600 flex items-center justify-center cursor-pointer transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                  >
                                    {deleteMutation.isPending ? (
                                      <Loader2 className="size-3.5 animate-spin" />
                                    ) : (
                                      <Trash2 className="size-3.5" />
                                    )}
                                  </button>
                                )}

                                <button
                                  onClick={minimizeDialog}
                                  title="Minimize"
                                  className="size-7 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center cursor-pointer transition-colors"
                                >
                                  <Minimize2 className="size-3.5" />
                                </button>

                                <button
                                  onClick={handleClose}
                                  className="size-7 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center cursor-pointer transition-colors"
                                >
                                  <X className="size-3.5" />
                                </button>
                              </div>
                            </div>
                          </div>

                          <ScrollArea className="flex-1 overflow-y-auto">
                            <div className="p-5 flex flex-col gap-4">
                              {filteredEntries && filteredEntries.length > 0 ? (
                                filteredEntries.map((entry: any, index: number) => {
                                  const speakerId = entry.speaker_id || "0";
                                  const idNum = parseInt(speakerId.toString().replace(/\D/g, "")) || 0;
                                  const speakerName = `Speaker ${String.fromCharCode(65 + idNum)}`;
                                  const isSegmentActive = isAudioPlaying && currentTime >= entry.start_time_seconds && currentTime <= entry.end_time_seconds;

                                  return (
                                    <div
                                      key={index}
                                      className={cn(
                                        "flex items-start gap-3.5 group animate-in fade-in duration-200 p-2.5 rounded-xl border border-transparent transition-all duration-200",
                                        isSegmentActive && "bg-cyan-500/[0.04] dark:bg-cyan-500/[0.06] border-cyan-500/20 dark:border-cyan-500/30 shadow-sm shadow-cyan-500/5"
                                      )}
                                    >
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
                                          <span className="text-[12px] font-semibold text-foreground">
                                            {speakerName}
                                          </span>
                                          <span className="text-[10px] font-mono font-medium text-muted-foreground flex items-center">
                                            {formatSegmentTime(entry.start_time_seconds)}
                                            <CornerDownRight className="size-2.5 text-muted-foreground mx-0.5 inline-block align-middle" />
                                            {formatSegmentTime(entry.end_time_seconds)}
                                          </span>
                                        </div>
                                        <p className="text-[12px] leading-relaxed font-normal text-foreground/90 select-text mt-1.5">
                                          {entry.transcript}
                                        </p>
                                      </div>
                                    </div>
                                  );
                                })
                              ) : (
                                <div className="text-[12px] leading-relaxed font-normal text-foreground/90 whitespace-pre-wrap select-text px-1">
                                  {currentTranscript || "No dialogue segment detected. Session timeline is empty."}
                                </div>
                              )}
                            </div>
                          </ScrollArea>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </motion.div>
        </div>
      )}

      {/* ─── Minimized Draggable Floating Dock ─── */}
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
            className="fixed bottom-6 right-6 z-[99999] w-[260px] bg-background border border-border p-3.5 rounded-2xl shadow-2xl cursor-grab active:cursor-grabbing select-none hover:border-border/80 transition-colors"
          >
            <div className="flex flex-col gap-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CircleDot
                    className={cn(
                      "size-3.5 transition-all duration-300",
                      currentStatus === "recording" && !isPaused ? "text-rose-500 animate-pulse" : "text-amber-500"
                    )}
                  />
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {currentStatus === "recording"
                      ? "Recording"
                      : currentStatus === "uploading"
                        ? "Uploading"
                        : "Processing"}
                  </span>
                </div>
                <span className="text-[11px] font-mono font-medium text-foreground/90 tabular-nums">
                  {formatTime(duration)}
                </span>
              </div>

              <div className="h-6 flex items-center justify-center gap-[3px] mt-0.5">
                {localVolumes.map((val, idx) => (
                  <motion.div
                    key={idx}
                    animate={{
                      height: currentStatus === "recording" && !isPaused ? `${Math.max(val * 100, 15)}%` : "15%",
                    }}
                    transition={{
                      type: "spring",
                      stiffness: 350,
                      damping: 18,
                    }}
                    className={cn(
                      "w-[3px] rounded-full transition-colors duration-300",
                      currentStatus === "recording" && !isPaused ? "bg-cyan-500/80" : "bg-muted-foreground/30"
                    )}
                  />
                ))}
              </div>
            </div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: isHovered ? 1 : 0 }}
              transition={{ duration: 0.15 }}
              className="absolute inset-0 bg-background rounded-2xl flex items-center justify-between px-4 pointer-events-auto"
              style={{ pointerEvents: isHovered ? "auto" : "none" }}
            >
              <div className="flex items-center gap-1.5">
                <Mic className="size-3.5 text-muted-foreground" />
                <span className="text-[10px] font-medium text-foreground truncate max-w-[90px]">
                  Capture Companion
                </span>
              </div>

              <div className="flex items-center gap-1">
                {currentStatus === "recording" && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setRequestAction("pause");
                    }}
                    className="size-7 rounded-lg hover:bg-muted border border-border/50 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                    title="Pause recording"
                  >
                    <Pause className="size-3.5" />
                  </button>
                )}
                {currentStatus === "recording" && (
                  <>
                    {/* End session — stops and processes the recording */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setRequestAction("stop");
                      }}
                      className="size-7 rounded-lg hover:bg-rose-500/10 border border-border/50 flex items-center justify-center text-rose-500 hover:text-rose-600 transition-colors cursor-pointer"
                      title="End Session & Process"
                    >
                      <X className="size-3.5" />
                    </button>
                    {/* Discard — stops without uploading or processing */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setRequestAction("discard");
                      }}
                      className="size-7 rounded-lg hover:bg-muted border border-border/50 flex items-center justify-center text-muted-foreground/50 hover:text-rose-400 transition-colors cursor-pointer"
                      title="Discard recording (no processing)"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    restoreDialog();
                  }}
                  className="size-7 rounded-lg hover:bg-muted border border-border/50 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
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
