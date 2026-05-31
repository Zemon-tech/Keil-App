# Motion Page — Bugs, Issues & Improvements

> Comprehensive audit of the Motion (Notion-like editor) system. Organized by severity and category.

---

## 1. Critical — Data Loss Risks

### 1.1 No Local Draft Persistence
- **Problem**: Content only exists in TanStack Query (in-memory) and Zustand (in-memory). If the browser crashes, tab is killed, or user navigates away before the 1500ms debounce fires, unsaved edits are lost permanently.
- **Files**: `frontend/src/store/useMotionStore.ts`, `frontend/src/components/motion/MotionPage.tsx`
- **Fix**: Persist content to `localStorage` or IndexedDB on every keystroke. Clear the draft on successful server save. Notion, Linear, and Google Docs all do this.
- **Priority**: Critical

### 1.2 Fire-and-Forget Save on Unmount
- **Problem**: `useEffect` cleanup cannot `await` async operations. When the user navigates away while a debounced save is pending, the save fires as fire-and-forget. If it fails, there's no retry and no feedback.
- **Files**: `frontend/src/components/motion/MotionPage.tsx`
- **Fix**: Before unmount, synchronously write pending content to localStorage as a safety net. On next mount, check for stale drafts and reconcile.
- **Priority**: Critical

### 1.3 No Conflict Resolution (Last Write Wins)
- **Problem**: Two users editing the same page simultaneously will silently overwrite each other's changes. There's no OT (Operational Transform) or CRDT. The socket broadcasts full page snapshots, not granular edits.
- **Files**: `frontend/src/hooks/api/useMotionPages.ts` (socket listener), `backend/src/services/motion-page.service.ts`
- **Fix**: At minimum, detect concurrent edits via `updated_at` comparison and warn the user. Ideally, implement block-level or paragraph-level locking, or adopt CRDT (e.g., Yjs, Automerge).
- **Priority**: Critical

---

## 2. High — Cache Coherence Bugs

### 2.1 Socket Updates Don't Sync to Zustand
- **Problem**: `useMotionSocketListeners` updates TanStack Query caches directly via `queryClient.setQueryData()`, but never calls `upsertPages()` on the Zustand store. If user B edits a page while user A has it open, TanStack reflects the update but Zustand's working copy becomes stale. The editor reads from Zustand for optimistic edits, so this creates divergent state.
- **Files**: `frontend/src/hooks/api/useMotionPages.ts` (`useMotionSocketListeners` function)
- **Fix**: Call `useMotionStore.getState().upsertPages([page])` inside the socket handler for `create` and `update` events.
- **Priority**: High

### 2.2 `removePageLocally` Is Shallow (Only One Level)
- **Problem**: The Zustand `removePageLocally` action filters by `p.parent_id !== id`, which only removes direct children. A 3-level tree (A → B → C) where A is deleted leaves C as an orphan in the cache. The server uses recursive CTE to soft-delete the entire subtree, but the client-side cache doesn't match.
- **Files**: `frontend/src/store/useMotionStore.ts` (`removePageLocally`)
- **Fix**: Implement recursive descendant removal:
  ```ts
  const toRemove = new Set([id]);
  let changed = true;
  while (changed) {
    changed = false;
    pages.forEach(p => {
      if (p.parent_id && toRemove.has(p.parent_id) && !toRemove.has(p.id)) {
        toRemove.add(p.id);
        changed = true;
      }
    });
  }
  ```
- **Priority**: High

### 2.3 TanStack List Cache Not Invalidated After Update
- **Problem**: `useUpdateMotionPage` applies optimistic updates to both list and detail caches on `onMutate`, then replaces with server data on `onSuccess`. But it only invalidates analytics queries, not the list query. If the server transforms the data (e.g., sanitizes content, adjusts position), the list cache retains the optimistic version until the 30s `staleTime` expires.
- **Files**: `frontend/src/hooks/api/useMotionPages.ts` (`useUpdateMotionPage`)
- **Fix**: The `onSuccess` handler already replaces list cache with `serverPage`, which covers most cases. However, if the server modifies fields not present in the update payload (e.g., `updated_by`), the list cache may be inconsistent. Consider a targeted `invalidateQueries` on the list key.
- **Priority**: High

### 2.4 TanStack Soft Delete Optimistic Removal Is Also Shallow
- **Problem**: `useSoftDeleteMotionPage.onMutate` filters by `p.id !== id && p.parent_id !== id` — same shallow removal as the Zustand bug. Orphaned grandchildren remain visible in the sidebar until the full list refetch.
- **Files**: `frontend/src/hooks/api/useMotionPages.ts` (`useSoftDeleteMotionPage`)
- **Fix**: Same recursive descendant removal as 2.2.
- **Priority**: High

---

## 3. High — Production Resilience

### 3.1 Save Retry Is Fragile
- **Problem**: On save failure, there's a single retry after 3 seconds. No exponential backoff. If the server is temporarily down (deploys, network blip), the user gets one shot and then sees "Save failed" with no further automatic recovery.
- **Files**: `frontend/src/components/motion/MotionPage.tsx` (`flushSave`)
- **Fix**: Implement exponential backoff (1s → 2s → 4s → 8s → max 30s) with a maximum retry count (e.g., 5). Show retry count in the save indicator.
- **Priority**: High

### 3.2 No Content Size Validation
- **Problem**: TipTap content JSON is stored as `JSONB` with no size limit. Users can paste large documents, embed images as base64 data URIs, or create massive tables. This bloats the database, increases API payload sizes, and slows down the 1500ms debounced save cycle (network transfer time).
- **Files**: `backend/src/controllers/motion-page.controller.ts`, `backend/src/services/motion-page.service.ts`
- **Fix**: Add a max content size check (e.g., 1MB) at the controller/service layer. Return 413 if exceeded. On the frontend, warn users when approaching the limit.
- **Priority**: High

### 3.3 `placeholderData: previousData` Can Show Wrong Content
- **Problem**: When navigating from page A to page B, `placeholderData: (previousData) => previousData` returns page A's content as the placeholder for page B's query. If `upsertPages` hasn't seeded page B from the list cache yet (e.g., list query is stale), the editor briefly renders page A's content under page B's title.
- **Files**: `frontend/src/hooks/api/useMotionPages.ts` (`useMotionPage`)
- **Fix**: Use `keepPreviousData: true` (TanStack v5) or `select` to merge with the list cache. Alternatively, show a loading skeleton instead of stale data when `pageId` changes.
- **Priority**: High

---

## 4. Moderate — Architecture & Consistency

### 4.1 No WebSocket Auth Verification
- **Problem**: Socket.IO connections may not verify JWT tokens per-connection or per-room. If a user connects without authentication, they could potentially join any `space:${spaceId}` room and listen to `motion_change` events.
- **Files**: `backend/src/lib/socket.ts` (assumed)
- **Fix**: Verify JWT on socket connection and validate space membership before allowing room joins.
- **Priority**: Moderate

### 4.2 Dual Cache Complexity (Zustand + TanStack)
- **Problem**: Both TanStack Query and Zustand hold full page data including content. This creates a dual-write problem — every mutation must update both layers. The read path uses TanStack (`useMotionPage`) while the editor uses Zustand for optimistic edits. If the two layers diverge, bugs are hard to trace.
- **Files**: `frontend/src/store/useMotionStore.ts`, `frontend/src/hooks/api/useMotionPages.ts`
- **Fix**: Consider consolidating. Option A: Zustand only for UI state (`sidebarOpen`, `drawerOpen`, `dirtyPageIds`, `lastOpenedPages`). All page data lives in TanStack. Option B: Zustand only, no TanStack. Current dual approach works but adds maintenance burden.
- **Priority**: Moderate

### 4.3 Activity Log Content Bloat
- **Problem**: `motion_page_updates` stores `before_content`, `deleted_content`, and `added_content` as JSONB. Over time, for frequently edited pages, this table will grow significantly. There's no pruning or archival strategy.
- **Files**: `backend/src/repositories/motion-analytics.repository.ts`
- **Fix**: Add a retention policy (e.g., keep updates for 90 days). Or compress/summarize old entries. Consider storing diffs instead of full content snapshots.
- **Status**: Partially addressed (created_at index added in migration 023 to support efficient retention queries).
- **Priority**: Moderate

### 4.4 No Rate Limiting on Save Endpoint
- **Problem**: The debounced save fires every 1500ms, but there's no server-side rate limiting. Aggressive typists or automated scripts could overwhelm the PATCH endpoint. Combined with no content size limits, this is a potential DoS vector.
- **Files**: `backend/src/routes/motion-page.routes.ts`
- **Fix**: Add rate limiting middleware (e.g., `express-rate-limit`) specific to the update endpoint. Something like 60 requests per minute per user.
- **Priority**: Moderate

### 4.5 `hydratePages` Guard Can Skip Necessary Updates
- **Problem**: The `id:updated_at` composite key comparison in `hydratePages` treats the entire array as unchanged if the keys match. But if only the array order changed (e.g., a page was reparented), the guard skips the update and the UI shows stale ordering.
- **Files**: `frontend/src/store/useMotionStore.ts` (`hydratePages`)
- **Fix**: Also compare `parent_id` and `position` in the composite key, or sort both arrays before comparison.
- **Priority**: Moderate

---

## 5. Minor — UX & Polish

### 5.1 No Garbage Collection Strategy for Query Cache
- **Problem**: TanStack Query's default `gcTime` is 5 minutes. Every page detail visited in a session stays in memory for 5 minutes after unmount. Users who open many pages accumulate large in-memory caches.
- **Files**: `frontend/src/hooks/api/useMotionPages.ts`
- **Fix**: Set explicit `gcTime` on detail queries (e.g., 2 minutes). Or use `cacheTime: 0` for analytics queries that are always refetched.
- **Priority**: Minor

### 5.2 Analytics Queries Have Aggressive staleTime
- **Problem**: `staleTime: 10s` on analytics queries (views summary, viewers, editors) means they refetch frequently when the drawer is open. This creates unnecessary API calls if the user is just reading the analytics without expecting changes.
- **Files**: `frontend/src/hooks/api/useMotionAnalytics.ts`
- **Fix**: Increase to 30s-60s for analytics. These are informational, not time-critical.
- **Priority**: Minor

### 5.3 No Offline Indicator
- **Problem**: When the user goes offline, there's no UI indication. The save indicator may show "Saving..." indefinitely. The user continues editing without knowing their changes aren't being persisted.
- **Files**: `frontend/src/components/motion/MotionPage.tsx`
- **Fix**: Listen to `navigator.onLine` and `window.online/offline` events. Show an "Offline" banner and queue saves for when connectivity returns.
- **Priority**: Minor

### 5.4 No Content Compression
- **Problem**: Full TipTap JSON is sent over the wire every 1500ms. For large documents, this can be significant (100KB+ payloads). No gzip/brotli at the application level (may be handled by reverse proxy, but not guaranteed).
- **Files**: `frontend/src/hooks/api/useMotionPages.ts` (mutation), `backend/src/controllers/motion-page.controller.ts`
- **Fix**: Verify that the deployment reverse proxy (nginx/Cloudflare) compresses JSON responses. Consider sending only diffs for content updates (patch-based instead of full replace).
- **Priority**: Minor

---

## 6. Summary — Priority Matrix

| # | Issue | Severity | Category | Effort |
|---|-------|----------|----------|--------|
| 1.1 | No local draft persistence | Critical | Data Loss | Medium |
| 1.2 | Fire-and-forget save on unmount | Critical | Data Loss | Low |
| 1.3 | No conflict resolution | Critical | Data Loss | High |
| 2.1 | Socket updates don't sync to Zustand | High | Cache | Low |
| 2.2 | `removePageLocally` is shallow | High | Cache | Low |
| 2.3 | List cache not invalidated after update | High | Cache | Low |
| 2.4 | TanStack soft delete removal is shallow | High | Cache | Low |
| 3.1 | Save retry is fragile | High | Resilience | Low |
| 3.2 | No content size validation | High | Resilience | Medium |
| 3.3 | `placeholderData` shows wrong content | High | UX | Low |
| 4.1 | No WebSocket auth verification | Moderate | Security | Medium |
| 4.2 | Dual cache complexity | Moderate | Architecture | High |
| 4.3 | Activity log content bloat | Moderate | Storage | Medium |
| 4.4 | No rate limiting on save endpoint | Moderate | Security | Low |
| 4.5 | `hydratePages` guard skips order changes | Moderate | Cache | Low |
| 5.1 | No gcTime strategy | Minor | Performance | Low |
| 5.2 | Aggressive analytics staleTime | Minor | Performance | Low |
| 5.3 | No offline indicator | Minor | UX | Low |
| 5.4 | No content compression | Minor | Performance | Medium |

---

## 7. Recommended Fix Order

**Phase 1 — Stop data loss (Critical + easy High fixes):**
1. Local draft persistence (1.1)
2. Save-on-unmount safety net (1.2)
3. Recursive descendant removal — Zustand + TanStack (2.2, 2.4)
4. Socket → Zustand sync (2.1)
5. Exponential backoff for save retry (3.1)

**Phase 2 — Cache coherence:**
6. Fix `hydratePages` guard (4.5)
7. List cache invalidation on update (2.3)
8. Fix `placeholderData` flash (3.3)
9. Consolidate dual cache (4.2) — evaluate effort first

**Phase 3 — Production hardening:**
10. Content size validation (3.2)
11. WebSocket auth verification (4.1)
12. Rate limiting on save endpoint (4.4)
13. Activity log retention policy (4.3)

**Phase 4 — Polish:**
14. Offline indicator (5.3)
15. GC/cache tuning (5.1, 5.2)
16. Content compression (5.4)
17. Conflict resolution — long-term (1.3)
