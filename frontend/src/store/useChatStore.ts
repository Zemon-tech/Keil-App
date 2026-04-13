// src/store/useChatStore.ts

import { create } from "zustand";
import type { ChatMessage } from "@/hooks/api/useChat";

// Reaction map: emoji → array of user IDs who reacted
export type ReactionMap = Record<string, string[]>;

interface ChatStore {
  // ── Visibility ───────────────────────────────────────────────
  isChatOpen: boolean;
  activeChannelId: string | null;

  // ── Typing ───────────────────────────────────────────────────
  typingUsers: Record<string, { userId: string; name: string }[]>;

  // ── Thread panel ─────────────────────────────────────────────
  threadMessage: ChatMessage | null;   // the parent message whose thread is open
  openThread: (msg: ChatMessage) => void;
  closeThread: () => void;

  // ── Sidebar filter tab ───────────────────────────────────────
  sidebarFilter: "all" | "unread" | "mentions";
  setSidebarFilter: (f: "all" | "unread" | "mentions") => void;

  // ── Pinned channels (local state, no server needed) ──────────
  pinnedChannelIds: string[];
  togglePinChannel: (id: string) => void;

  // ── Local emoji reactions (per message) ──────────────────────
  reactions: Record<string, ReactionMap>; // messageId → ReactionMap
  toggleReaction: (messageId: string, emoji: string, myUserId: string) => void;

  // ── Global search query ──────────────────────────────────────
  searchOpen: boolean;
  searchQuery: string;
  openSearch: () => void;
  closeSearch: () => void;
  setSearchQuery: (q: string) => void;

  // ── Actions ──────────────────────────────────────────────────
  openChat: () => void;
  closeChat: () => void;
  setActiveChannel: (channelId: string | null) => void;
  addTypingUser: (channelId: string, userId: string, name: string) => void;
  removeTypingUser: (channelId: string, userId: string) => void;
}

export const useChatStore = create<ChatStore>((set) => ({
  // ── Visibility ───────────────────────────────────────────────
  isChatOpen: false,
  activeChannelId: null,

  // ── Typing ───────────────────────────────────────────────────
  typingUsers: {},

  // ── Thread panel ─────────────────────────────────────────────
  threadMessage: null,
  openThread: (msg) => set({ threadMessage: msg }),
  closeThread: () => set({ threadMessage: null }),

  // ── Sidebar filter tab ───────────────────────────────────────
  sidebarFilter: "all",
  setSidebarFilter: (f) => set({ sidebarFilter: f }),

  // ── Pinned channels ──────────────────────────────────────────
  pinnedChannelIds: [],
  togglePinChannel: (id) =>
    set((state) => ({
      pinnedChannelIds: state.pinnedChannelIds.includes(id)
        ? state.pinnedChannelIds.filter((x) => x !== id)
        : [...state.pinnedChannelIds, id],
    })),

  // ── Local emoji reactions ─────────────────────────────────────
  reactions: {},
  toggleReaction: (messageId, emoji, myUserId) =>
    set((state) => {
      const msgReactions: ReactionMap = { ...(state.reactions[messageId] ?? {}) };
      const users = msgReactions[emoji] ?? [];
      if (users.includes(myUserId)) {
        msgReactions[emoji] = users.filter((u) => u !== myUserId);
        if (msgReactions[emoji].length === 0) delete msgReactions[emoji];
      } else {
        msgReactions[emoji] = [...users, myUserId];
      }
      return { reactions: { ...state.reactions, [messageId]: msgReactions } };
    }),

  // ── Global search ─────────────────────────────────────────────
  searchOpen: false,
  searchQuery: "",
  openSearch: () => set({ searchOpen: true }),
  closeSearch: () => set({ searchOpen: false, searchQuery: "" }),
  setSearchQuery: (q) => set({ searchQuery: q }),

  // ── Visibility actions ───────────────────────────────────────
  openChat: () => set({ isChatOpen: true }),
  closeChat: () => set({ isChatOpen: false, activeChannelId: null, threadMessage: null }),
  setActiveChannel: (channelId) => set({ activeChannelId: channelId, threadMessage: null }),

  addTypingUser: (channelId, userId, name) =>
    set((state) => {
      const current = state.typingUsers[channelId] || [];
      if (current.find((u) => u.userId === userId)) return state;
      return {
        typingUsers: { ...state.typingUsers, [channelId]: [...current, { userId, name }] },
      };
    }),

  removeTypingUser: (channelId, userId) =>
    set((state) => {
      const current = state.typingUsers[channelId] || [];
      return {
        typingUsers: {
          ...state.typingUsers,
          [channelId]: current.filter((u) => u.userId !== userId),
        },
      };
    }),
}));
