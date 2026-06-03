import { create } from "zustand";

export type RecorderState = "idle" | "recording" | "uploading" | "transcribing" | "completed" | "error";

interface MeetingStore {
  isDialogOpen: boolean;
  isMinimized: boolean;
  status: RecorderState;
  duration: number;
  meetingId: string | null;
  volumes: number[];
  requestAction: "pause" | "stop" | "resume" | "discard" | null;

  // Actions
  openDialog: (meetingId?: string | null) => void;
  closeDialog: () => void;
  minimizeDialog: () => void;
  restoreDialog: () => void;
  setStatus: (status: RecorderState) => void;
  setDuration: (duration: number | ((prev: number) => number)) => void;
  setMeetingId: (meetingId: string | null) => void;
  setVolumes: (volumes: number[]) => void;
  setRequestAction: (action: "pause" | "stop" | "resume" | "discard" | null) => void;
  reset: () => void;
}

export const useMeetingStore = create<MeetingStore>((set) => ({
  isDialogOpen: false,
  isMinimized: false,
  status: "idle",
  duration: 0,
  meetingId: null,
  volumes: [0.05, 0.05, 0.05, 0.05, 0.05],
  requestAction: null,

  openDialog: (meetingId = null) =>
    set({ isDialogOpen: true, isMinimized: false, meetingId }),
  closeDialog: () =>
    set({ isDialogOpen: false, isMinimized: false }),
  minimizeDialog: () =>
    set({ isDialogOpen: false, isMinimized: true }),
  restoreDialog: () =>
    set({ isDialogOpen: true, isMinimized: false }),
  setStatus: (status) => set({ status }),
  setDuration: (duration) =>
    set((state) => ({
      duration: typeof duration === "function" ? duration(state.duration) : duration,
    })),
  setMeetingId: (meetingId) => set({ meetingId }),
  setVolumes: (volumes) => set({ volumes }),
  setRequestAction: (action) => set({ requestAction: action }),
  reset: () =>
    set({
      status: "idle",
      duration: 0,
      meetingId: null,
      isMinimized: false,
      isDialogOpen: false,
      volumes: [0.05, 0.05, 0.05, 0.05, 0.05],
      requestAction: null,
    }),
}));
