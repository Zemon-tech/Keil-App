/**
 * useMotionStore — in-memory optimistic layer for Motion pages.
 *
 * Role after backend integration:
 * - NOT persisted to localStorage (no more persist middleware)
 * - Seeded from the API response via hydratePages()
 * - Acts as the working copy while editing (instant UI, no latency)
 * - dirtyPageIds tracks pages with unsaved content changes
 * - sidebarOpen is pure UI state (no backend involvement)
 *
 * The TanStack Query cache (useMotionPages hook) is the source of truth
 * for server state. This store is only used for:
 *   1. Optimistic in-editor content (before the debounced save fires)
 *   2. Sidebar open/close state
 *   3. Dirty tracking for the save indicator
 */

import { create } from 'zustand';

export type MotionPageId = string;

interface MotionStore {
  // ── Client state ────────────────────────────────────────────────────────────
  /** Set of page ids that have unsaved content changes. */
  dirtyPageIds: Set<string>;

  // ── UI state ─────────────────────────────────────────────────────────────────
  sidebarOpen: boolean;

  /**
   * Scoped dictionary tracking the last opened page per workspace.
   * Persisted to localStorage as an orgId:spaceId -> pageId dictionary.
   */
  lastOpenedPages: Record<string, string>;

  // ── Actions ──────────────────────────────────────────────────────────────────

  // ── Dirty tracking ────────────────────────────────────────────────────────────
  setDirty: (id: MotionPageId) => void;
  clearDirty: (id: MotionPageId) => void;
  isDirty: (id: MotionPageId) => boolean;

  // ── UI ────────────────────────────────────────────────────────────────────────
  setSidebarOpen: (open: boolean) => void;
  drawerOpen: boolean;
  drawerTab: "updates" | "analytics";
  setDrawerOpen: (open: boolean) => void;
  setDrawerTab: (tab: "updates" | "analytics") => void;
  shareOpen: boolean;
  setShareOpen: (open: boolean) => void;

  /** Records the last visited page id for the active org/space and persists it to localStorage. */
  setLastOpenedPageId: (orgId: string, spaceId: string, pageId: string | null) => void;
}

export const useMotionStore = create<MotionStore>()((set, get) => ({
  dirtyPageIds: new Set<string>(),
  sidebarOpen: true,
  drawerOpen: false,
  drawerTab: "updates",
  shareOpen: false,
  lastOpenedPages: (() => {
    try {
      const saved = localStorage.getItem("motion:lastOpenedPages");
      return saved ? JSON.parse(saved) : {};
    } catch { return {}; }
  })(),

  // ── Dirty tracking ────────────────────────────────────────────────────────────

  setDirty: (id) =>
    set((state) => ({
      dirtyPageIds: new Set([...state.dirtyPageIds, id]),
    })),

  clearDirty: (id) =>
    set((state) => {
      const next = new Set(state.dirtyPageIds);
      next.delete(id);
      return { dirtyPageIds: next };
    }),

  isDirty: (id) => get().dirtyPageIds.has(id),

  // ── UI ────────────────────────────────────────────────────────────────────────

  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  setDrawerOpen: (open) => set({ drawerOpen: open }),
  setDrawerTab: (tab) => set({ drawerTab: tab }),
  setShareOpen: (open) => set({ shareOpen: open }),

  setLastOpenedPageId: (orgId, spaceId, pageId) => {
    if (!orgId || !spaceId) return;
    const key = `${orgId}:${spaceId}`;
    set((state) => {
      const updated = { ...state.lastOpenedPages };
      if (pageId) {
        updated[key] = pageId;
      } else {
        delete updated[key];
      }
      try {
        localStorage.setItem("motion:lastOpenedPages", JSON.stringify(updated));
      } catch { /* ignore */ }
      return { lastOpenedPages: updated };
    });
  },
}));
