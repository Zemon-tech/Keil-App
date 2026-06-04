import { create } from "zustand";
import type { SettingsTab } from "@/components/SettingsDialog";

interface SettingsStore {
  isOpen: boolean;
  initialTab: SettingsTab;
  openSettings: (tab?: SettingsTab) => void;
  closeSettings: () => void;
}

export const useSettingsStore = create<SettingsStore>((set) => ({
  isOpen: false,
  initialTab: "account",
  openSettings: (tab = "account") => set({ isOpen: true, initialTab: tab }),
  closeSettings: () => set({ isOpen: false }),
}));
