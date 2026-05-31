# Motion Page — Cache & Storage Optimization Plan

> Production-ready implementation plan to make Motion pages load faster and use storage efficiently.

---

## Context

The Motion system (Notion-like editor) has verified issues across three domains:

1. **Frontend cache coherence** — Dual-layer state (Zustand + TanStack Query) with sync gaps causing stale UI, orphaned nodes, and content flashes during navigation.
2. **Backend storage efficiency** — No content size limits, unbounded activity logs, and `SELECT *` queries that transfer full page content when only metadata is needed.
3. **Network efficiency** — Full JSONB payloads on every save, no rate limiting, aggressive refetch intervals on informational queries.

### Key Files

| File | Role |
|------|------|
| `frontend/src/store/useMotionStore.ts` | Zustand working copy (optimistic edits, dirty tracking) |
| `frontend/src/hooks/api/useMotionPages.ts` | TanStack Query hooks + socket listeners |
| `frontend/src/hooks/api/useMotionAnalytics.ts` | Analytics query hooks |
| `frontend/src/components/motion/MotionPage.tsx` | Editor component (debounced save, unmount flush) |
| `backend/src/repositories/motion-page.repository.ts` | DB queries (`findBySpace`, `softDeleteWithDescendants`) |
| `backend/src/services/motion-page.service.ts` | Business logic (update, delete, broadcast) |
| `backend/src/controllers/motion-page.controller.ts` | Request validation |
| `backend/src/routes/motion-page.routes.ts` | Route definitions |
| `backend/src/repositories/motion-analytics.repository.ts` | Activity log storage |

---

## Constraints

- No breaking API changes — frontend and backend must remain compatible during rollout.
- No new infrastructure dependencies (no Redis, no CRDT library) in this phase.
- All changes must be backward-compatible with existing page data in production.
- Frontend changes must not regress the editor's responsiveness (< 16ms per keystroke).
- Backend changes must not require a database migration that locks tables for extended periods.
- Tests must run against local PostgreSQL (no Supabase CLI required).

---

## Phase 1 — Backend Storage & Query Optimization

**Goal**: Reduce payload sizes, protect the database from unbounded growth, and add rate limiting.

### 1.1 Exclude content from list queries

**What**: Create a new `findBySpaceLite()` method that returns all columns except `content`. Update `getPagesBySpace` service to use it. The existing `findBySpace` (with content) remains for internal use.

**Why**: The sidebar only needs `id`, `title`, `icon`, `parent_id`, `position`, `cover_image`, `deleted_at`, `updated_at`, `created_by`, `updated_by`, `org_id`, `space_id`, `small_text`, `full_width`. Excluding `content` (often 10-100KB per page) reduces list response size by 80-95%.

**Files to change**:
- `backend/src/repositories/motion-page.repository.ts` — Add `findBySpaceLite()`
- `backend/src/services/motion-page.service.ts` — Use lite query in `getPagesBySpace()`
- `frontend/src/hooks/api/useMotionPages.ts` — Update `MotionPageDTO` to make `content` optional in list responses

**Acceptance criteria**:
- [ ] `GET /v1/orgs/:orgId/spaces/:spaceId/notes` returns pages without `content` field
- [ ] `GET /v1/orgs/:orgId/spaces/:spaceId/notes/:id` still returns full page with `content`
- [ ] Frontend sidebar renders correctly with content-less list data
- [ ] Page editor still loads content from the detail endpoint

### 1.2 Add content size validation

**What**: Reject content payloads larger than 1MB (serialized JSON) at the controller layer. Return HTTP 413.

**Files to change**:
- `backend/src/controllers/motion-page.controller.ts` — Add size check in `updatePage`

**Acceptance criteria**:
- [ ] PATCH with content > 1MB returns `413 Payload Too Large`
- [ ] PATCH with content ≤ 1MB succeeds normally
- [ ] Error message is descriptive: "Content exceeds maximum size of 1MB"

### 1.3 Add rate limiting to the update endpoint

**What**: Apply per-user rate limiting (60 requests/minute) to `PATCH /:id`. Use `express-rate-limit` with in-memory store (sufficient for single-instance deployment).

**Files to change**:
- `backend/src/routes/motion-page.routes.ts` — Add rate limiter middleware to PATCH route
- `backend/package.json` — Add `express-rate-limit` dependency

**Acceptance criteria**:
- [ ] 61st PATCH request within 60 seconds returns `429 Too Many Requests`
- [ ] Rate limit is per-user (keyed by `req.user.id`), not global
- [ ] Other endpoints (GET, POST, DELETE) are unaffected

### 1.4 Activity log retention — add created_at index

**What**: Add a partial index on `motion_page_updates.created_at` to support future retention queries. Add a scheduled cleanup query (documented, not auto-scheduled yet).

**Files to change**:
- `backend/src/migrations/0XX_motion_updates_index.sql` — Add index
- `docs/todo/motion-issues.md` — Mark 4.3 as partially addressed

**Acceptance criteria**:
- [ ] Index exists: `CREATE INDEX idx_motion_updates_created ON motion_page_updates (created_at)`
- [ ] A documented SQL query can delete updates older than 90 days efficiently

---

## Phase 2 — Frontend Cache Coherence

**Goal**: Eliminate stale state, orphaned nodes, and content flashes.

### 2.1 Socket updates sync to Zustand

**What**: In `useMotionSocketListeners`, after updating TanStack Query cache, also call `useMotionStore.getState().upsertPages([page])` for `create` and `update` events.

**Files to change**:
- `frontend/src/hooks/api/useMotionPages.ts` — `handleMotionChange` function

**Acceptance criteria**:
- [ ] When user B edits a page, user A's editor reflects the change without refresh
- [ ] The `upsertPages` call respects the existing "skip if current user" guard
- [ ] No infinite loop between socket → Zustand → TanStack

### 2.2 Recursive descendant removal in Zustand

**What**: Replace the shallow `p.parent_id !== id` filter in `removePageLocally` with a recursive traversal that collects all descendants.

**Files to change**:
- `frontend/src/store/useMotionStore.ts` — `removePageLocally` action

**Acceptance criteria**:
- [ ] Deleting page A (which has child B, which has child C) removes A, B, and C from the store
- [ ] Performance: handles 100+ pages without noticeable delay (< 5ms)
- [ ] `dirtyPageIds` is cleaned for all removed pages

### 2.3 Recursive descendant removal in TanStack soft delete

**What**: Same recursive logic in `useSoftDeleteMotionPage.onMutate`.

**Files to change**:
- `frontend/src/hooks/api/useMotionPages.ts` — `useSoftDeleteMotionPage` onMutate

**Acceptance criteria**:
- [ ] Optimistic removal includes grandchildren and deeper descendants
- [ ] Rollback on error restores the full previous list (already handled by `invalidateQueries`)

### 2.4 Fix `hydratePages` guard to include position and parent_id

**What**: Extend the composite key to `${p.id}:${p.updated_at}:${p.parent_id}:${p.position}`.

**Files to change**:
- `frontend/src/store/useMotionStore.ts` — `hydratePages` action

**Acceptance criteria**:
- [ ] Reparenting a page (changing `parent_id`) triggers a store update even if `updated_at` is the same
- [ ] Position reordering is reflected immediately

### 2.5 Fix `placeholderData` content flash

**What**: Replace `placeholderData: (previousData) => previousData` with `placeholderData: undefined` (show loading state) or use `initialData` seeded from the list cache (which no longer contains content, so it shows title/icon immediately while content loads).

**Files to change**:
- `frontend/src/hooks/api/useMotionPages.ts` — `useMotionPage` hook

**Acceptance criteria**:
- [ ] Navigating from page A to page B never shows page A's content under page B's title
- [ ] Page B shows a loading skeleton or empty editor until its content arrives
- [ ] If page B's detail is already cached, it renders instantly (no flash)

---

## Phase 3 — Query Cache Tuning

**Goal**: Reduce unnecessary network requests and memory usage.

### 3.1 Increase analytics staleTime

**What**: Change `staleTime` from `10_000` to `60_000` for `useViewsSummary`, `usePageViewers`, and `usePageEditors`.

**Files to change**:
- `frontend/src/hooks/api/useMotionAnalytics.ts`

**Acceptance criteria**:
- [ ] Analytics drawer does not refetch on window focus within 60 seconds
- [ ] Manual refresh (close/reopen drawer) still triggers a fresh fetch

### 3.2 Set explicit gcTime on detail queries

**What**: Add `gcTime: 2 * 60 * 1000` (2 minutes) to `useMotionPage` to free memory sooner for pages the user has navigated away from.

**Files to change**:
- `frontend/src/hooks/api/useMotionPages.ts` — `useMotionPage` hook

**Acceptance criteria**:
- [ ] After navigating away from a page, its detail cache is garbage-collected after 2 minutes
- [ ] Navigating back within 2 minutes still uses the cached data (no refetch)

### 3.3 Set gcTime: 0 for analytics queries

**What**: Analytics queries are always refetched when the drawer opens. Set `gcTime: 0` so they don't linger in memory.

**Files to change**:
- `frontend/src/hooks/api/useMotionAnalytics.ts`

**Acceptance criteria**:
- [ ] Analytics data is freed from memory immediately after the drawer closes
- [ ] Reopening the drawer triggers a fresh fetch

---

## Phase 4 — Save Resilience (Bonus)

**Goal**: Prevent data loss on save failures.

### 4.1 Exponential backoff for save retry

**What**: Replace the single 3-second retry with exponential backoff (1s → 2s → 4s → 8s → 16s, max 5 retries).

**Files to change**:
- `frontend/src/components/motion/MotionPage.tsx` — `flushSave` function

**Acceptance criteria**:
- [ ] On first failure, retry after 1 second
- [ ] On second failure, retry after 2 seconds
- [ ] After 5 failures, stop retrying and show persistent "Save failed" indicator
- [ ] Successful save at any retry resets the counter

### 4.2 Local draft persistence (localStorage safety net)

**What**: On every content change, write `{ pageId, content, timestamp }` to localStorage. Clear on successful save. On mount, check for stale drafts and reconcile.

**Files to change**:
- `frontend/src/components/motion/MotionPage.tsx` — `handleContentChange`, mount effect
- New utility: `frontend/src/lib/motion-drafts.ts`

**Acceptance criteria**:
- [ ] Browser crash during editing → content recoverable on next visit
- [ ] Successful save clears the draft from localStorage
- [ ] Draft older than 24 hours is auto-discarded
- [ ] localStorage quota errors are caught silently (no crash)

---

## Test Coverage Requirements

All phases must include corresponding tests:

| Phase | Test Type | Location |
|-------|-----------|----------|
| 1.1 | Backend integration | `backend/src/routes/__tests__/motion-page.routes.test.ts` |
| 1.2 | Backend integration | Same file (413 response test) |
| 1.3 | Backend integration | Same file (429 response test) |
| 2.1–2.5 | Frontend unit | `frontend/src/store/__tests__/useMotionStore.test.ts` |
| 3.1–3.3 | Frontend unit | Covered by store tests + manual verification |
| 4.1–4.2 | Frontend unit | `frontend/src/components/motion/__tests__/MotionPage.test.ts` |

---

## Rollout Order

1. **Phase 1** first — backend changes are independent and immediately reduce load.
2. **Phase 2** next — cache fixes depend on Phase 1's content-less list response.
3. **Phase 3** after Phase 2 — tuning is safe once cache coherence is fixed.
4. **Phase 4** last — resilience improvements are additive.

Each phase can be deployed independently. No phase depends on a later phase.

---

## Success Metrics

| Metric | Before | Target |
|--------|--------|--------|
| List endpoint response size (50 pages) | ~3-5 MB | < 50 KB |
| Time to render sidebar after API response | ~200ms (parsing large JSON) | < 30ms |
| Detail endpoint response time | Unchanged | Unchanged |
| Memory usage after visiting 20 pages | ~100MB (cached content) | < 20MB |
| Save failure recovery | 1 retry, then permanent failure | 5 retries with backoff |
| Orphaned nodes after deep delete | Visible until refetch (30s) | Immediate removal |
