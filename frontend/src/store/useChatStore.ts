// src/store/useChatStore.ts

import { create } from "zustand";

// --- Define the shape of the store ---
interface ChatStore {
  isChatOpen: boolean;            // true = drawer is visible
  activeChannelId: string | null; // null = showing channel list, otherwise showing messages
  typingUsers: Record<string, { userId: string, name: string }[]>; // channelId -> array of users typing

  // Actions (functions that update the state)
  openChat: () => void;
  closeChat: () => void;
  setActiveChannel: (channelId: string | null) => void; // pass null to go back to list
  addTypingUser: (channelId: string, userId: string, name: string) => void;
  removeTypingUser: (channelId: string, userId: string) => void;
}

// --- Create and export the store ---
export const useChatStore = create<ChatStore>((set) => ({
  // Initial values
  isChatOpen: false,
  activeChannelId: null,
  typingUsers: {},

  // Calling openChat() → sets isChatOpen to true
  openChat: () => set({ isChatOpen: true }),

  // Calling closeChat() → hides drawer AND resets the active channel
  closeChat: () => set({ isChatOpen: false, activeChannelId: null }),

  // Calling setActiveChannel("abc-123") → opens that channel's messages
  // Calling setActiveChannel(null)      → goes back to the channel list
  setActiveChannel: (channelId) => set({ activeChannelId: channelId }),

  addTypingUser: (channelId, userId, name) => set((state) => {
    const current = state.typingUsers[channelId] || [];
    if (current.find(u => u.userId === userId)) return state;
    return {
      typingUsers: { ...state.typingUsers, [channelId]: [...current, { userId, name }] }
    };
  }),

  removeTypingUser: (channelId, userId) => set((state) => {
    const current = state.typingUsers[channelId] || [];
    return {
      typingUsers: { ...state.typingUsers, [channelId]: current.filter(u => u.userId !== userId) }
    };
  }),
}));
