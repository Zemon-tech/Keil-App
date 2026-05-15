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
import type { MotionPageDTO } from '@/hooks/api/useMotionPages';

// Re-export the DTO type under the legacy name so existing component
// imports of MotionPageRecord continue to work during the migration.
export type MotionPageRecord = MotionPageDTO;
export type MotionPageId = string;

interface MotionStore {
  // ── Working copy ────────────────────────────────────────────────────────────
  /** In-memory page map. Seeded from API, updated optimistically while editing. */
  pages: MotionPageRecord[];

  /** Set of page ids that have unsaved content changes. */
  dirtyPageIds: Set<string>;

  // ── UI state ─────────────────────────────────────────────────────────────────
  sidebarOpen: boolean;

  // ── Actions ──────────────────────────────────────────────────────────────────

  /**
   * Seeds the store from the API response.
   * Called after useMotionPages resolves. Replaces the current page list.
   */
  hydratePages: (pages: MotionPageRecord[]) => void;

  /**
   * Optimistically updates a page in the working copy.
   * Does NOT call the API — the component is responsible for debounced saves.
   */
  updatePageLocally: (id: MotionPageId, updates: Partial<MotionPageRecord>) => void;

  /**
   * Optimistically adds a page to the working copy.
   * Called after useCreateMotionPage succeeds (with the server-returned page).
   */
  addPageLocally: (page: MotionPageRecord) => void;

  /**
   * Removes a page (and its descendants) from the working copy.
   * Called after soft-delete or hard-delete succeeds.
   */
  removePageLocally: (id: MotionPageId) => void;

  // ── Dirty tracking ────────────────────────────────────────────────────────────
  setDirty: (id: MotionPageId) => void;
  clearDirty: (id: MotionPageId) => void;
  isDirty: (id: MotionPageId) => boolean;

  // ── Selectors ─────────────────────────────────────────────────────────────────
  getPageById: (id: MotionPageId) => MotionPageRecord | undefined;
  getRootPages: () => MotionPageRecord[];
  getSubpages: (parentId: MotionPageId) => MotionPageRecord[];
  getTrashPages: () => MotionPageRecord[];

  // ── UI ────────────────────────────────────────────────────────────────────────
  setSidebarOpen: (open: boolean) => void;
}

export const useMotionStore = create<MotionStore>()((set, get) => ({
  pages: [],
  dirtyPageIds: new Set<string>(),
  sidebarOpen: true,

  // ── Hydration ─────────────────────────────────────────────────────────────────

  hydratePages: (pages) => {
    // Guard: only update the store if the content actually changed.
    // Compare by serialising id+updated_at of each page. This prevents
    // the infinite loop caused by TanStack Query returning a new array
    // reference on every render even when the data is identical.
    const current = get().pages;
    const incomingKey = pages.map((p) => `${p.id}:${p.updated_at}`).join(',');
    const currentKey = current.map((p) => `${p.id}:${p.updated_at}`).join(',');
    if (incomingKey === currentKey) return; // nothing changed — skip set()
    set({ pages });
  },

  // ── Local optimistic mutations ────────────────────────────────────────────────

  updatePageLocally: (id, updates) =>
    set((state) => ({
      pages: state.pages.map((p) =>
        p.id === id
          ? { ...p, ...updates, updated_at: new Date().toISOString() }
          : p
      ),
    })),

  addPageLocally: (page) =>
    set((state) => ({
      // Prepend — new pages appear at the top of the list
      pages: [page, ...state.pages.filter((p) => p.id !== page.id)],
    })),

  removePageLocally: (id) =>
    set((state) => ({
      // Remove the page and all its descendants
      pages: state.pages.filter((p) => p.id !== id && p.parent_id !== id),
      dirtyPageIds: new Set(
        [...state.dirtyPageIds].filter((dirtyId) => dirtyId !== id)
      ),
    })),

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

  // ── Selectors ─────────────────────────────────────────────────────────────────

  getPageById: (id) => get().pages.find((p) => p.id === id),

  getRootPages: () =>
    get()
      .pages.filter((p) => !p.parent_id && !p.deleted_at)
      .sort((a, b) => a.position - b.position),

  getSubpages: (parentId) =>
    get()
      .pages.filter((p) => p.parent_id === parentId && !p.deleted_at)
      .sort((a, b) => a.position - b.position),

  getTrashPages: () => get().pages.filter((p) => !!p.deleted_at),

  // ── UI ────────────────────────────────────────────────────────────────────────

  setSidebarOpen: (open) => set({ sidebarOpen: open }),
}));
