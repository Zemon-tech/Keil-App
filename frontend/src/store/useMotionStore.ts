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

  /**
   * Scoped dictionary tracking the last opened page per workspace.
   * Persisted to localStorage as an orgId:spaceId -> pageId dictionary.
   */
  lastOpenedPages: Record<string, string>;

  // ── Actions ──────────────────────────────────────────────────────────────────

  /**
   * Seeds the store from the API response.
   * Called after useMotionPages resolves. Replaces the current page list.
   */
  hydratePages: (pages: MotionPageRecord[]) => void;

  /**
   * Merges specific pages into the store.
   * Updates existing pages by ID and adds new ones. Does NOT remove missing pages.
   */
  upsertPages: (pages: MotionPageRecord[]) => void;

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
  pages: [],
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

  // ── Hydration ─────────────────────────────────────────────────────────────────

  hydratePages: (pages) => {
    // Guard: only update the store if the content actually changed, including positions or parents.
    const current = get().pages;
    const incomingKey = pages.map((p) => `${p.id}:${p.updated_at}:${p.parent_id}:${p.position}`).join(",");
    const currentKey = current.map((p) => `${p.id}:${p.updated_at}:${p.parent_id}:${p.position}`).join(",");
    if (incomingKey === currentKey) return;

    // Merge strategy: incoming list data may lack `content` (the list endpoint
    // excludes it for performance). Preserve existing content from the store
    // so that navigating back to a page doesn't lose its loaded content.
    const contentMap = new Map<string, any>();
    current.forEach((p) => {
      if (p.content) contentMap.set(p.id, p.content);
    });

    const merged = pages.map((p) => {
      if (!p.content && contentMap.has(p.id)) {
        return { ...p, content: contentMap.get(p.id) };
      }
      return p;
    });

    set({ pages: merged });
  },

  upsertPages: (incoming) => {
    set((state) => {
      const nextPages = [...state.pages];
      incoming.forEach((inPage) => {
        const idx = nextPages.findIndex((p) => p.id === inPage.id);
        if (idx > -1) {
          const current = nextPages[idx];
          const inTime = new Date(inPage.updated_at).getTime();
          const curTime = new Date(current.updated_at).getTime();

          // Only update if incoming is newer or we are not in a dirty state.
          // This prevents older server responses from overwriting newer optimistic updates.
          if (inTime >= curTime) {
            nextPages[idx] = { ...current, ...inPage };
          }
        } else {
          nextPages.push(inPage);
        }
      });
      return { pages: nextPages };
    });
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
    set((state) => {
      const idsToRemove = new Set<string>([id]);
      let added = true;
      while (added) {
        added = false;
        state.pages.forEach((p) => {
          if (p.parent_id && idsToRemove.has(p.parent_id) && !idsToRemove.has(p.id)) {
            idsToRemove.add(p.id);
            added = true;
          }
        });
      }

      return {
        pages: state.pages.filter((p) => !idsToRemove.has(p.id)),
        dirtyPageIds: new Set(
          [...state.dirtyPageIds].filter((dirtyId) => !idsToRemove.has(dirtyId))
        ),
      };
    }),

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
