# Motion Backend Integration Plan

## Context Summary

- Motion is a Notion-like notes feature, currently 100% frontend (Zustand + localStorage)
- Goal: move to a PostgreSQL backend, scope pages to org+space, add sharing (public links + cross-space), keep UX production-ready
- Layout: Option A1 — Motion stays inside `<Layout>`, AppSidebar auto-collapses on `/motion/*` routes
- Save strategy: Zustand as optimistic working copy, debounced API sync (~1.5s), flush on navigation
- localStorage data: ignored (start fresh from backend)
- `motionStorage.ts`: delete it (dead code)
- Subpages: same org+space as parent, enforced at DB level
- Trash: cascade-delete all subpages on permanent delete
- Permissions: stub `owner`/`editor`/`viewer` roles now, enforce later

---

## Architecture Decisions

### DB Schema

Two tables:

**`motion_pages`** — the page itself
```
id, org_id, space_id, created_by,
parent_id (self-ref, nullable),
title, content (JSONB), icon, cover_image,
position (float8, for ordering),
deleted_at, created_at, updated_at
```
- `(space_id, org_id)` FK → `spaces(id, org_id)` — same composite FK pattern as tasks
- `parent_id` FK → `motion_pages(id) ON DELETE CASCADE` — permanent delete cascades to all subpages
- Soft delete: `deleted_at` (trash), hard delete: actual row removal
- `position` float8 for fractional indexing (insert between pages without rewriting all positions)
- `content` JSONB — stores Tiptap JSONContent directly

**`motion_page_shares`** — sharing
```
id, page_id, 
share_type (enum: 'public_link' | 'space'),
target_org_id (nullable — null for public_link),
target_space_id (nullable — null for public_link),
share_token (text, unique — for public_link type),
permission (enum: 'view' | 'edit'),
created_by, created_at, expires_at (nullable)
```
- One row per share grant
- `share_token` is a cryptographically random string (32 bytes hex), indexed, unique
- Public link: `share_type='public_link'`, `share_token` set, `target_*` null
- Cross-space: `share_type='space'`, `target_org_id`+`target_space_id` set, `share_token` null
- `expires_at` nullable — allows time-limited shares

### API Routes

All under `protect` + `requireOrgMember` + `requireSpaceMember` middleware (same as tasks):

```
GET    /v1/orgs/:orgId/spaces/:spaceId/notes          — list (sidebar tree)
POST   /v1/orgs/:orgId/spaces/:spaceId/notes          — create
GET    /v1/orgs/:orgId/spaces/:spaceId/notes/:id      — get single page
PATCH  /v1/orgs/:orgId/spaces/:spaceId/notes/:id      — update (title, content, icon, cover)
DELETE /v1/orgs/:orgId/spaces/:spaceId/notes/:id      — soft delete (trash)
DELETE /v1/orgs/:orgId/spaces/:spaceId/notes/:id/permanent — hard delete
PATCH  /v1/orgs/:orgId/spaces/:spaceId/notes/:id/restore   — restore from trash

POST   /v1/orgs/:orgId/spaces/:spaceId/notes/:id/shares         — create share
GET    /v1/orgs/:orgId/spaces/:spaceId/notes/:id/shares         — list shares for a page
DELETE /v1/orgs/:orgId/spaces/:spaceId/notes/:id/shares/:shareId — revoke share

GET    /v1/notes/public/:token   — public read (no auth required)
GET    /v1/notes/shared          — list pages shared TO the current user's active space
```

### Frontend Save Strategy

```
User types
  → update Zustand store immediately (optimistic, instant UI)
  → debounce 1500ms
  → PATCH API call (fire with retry on failure)
  → on success: mark page as "saved" (clear dirty flag)
  → on failure: show subtle "Save failed" indicator, retry once after 3s
  → on navigate away: cancel debounce, flush immediately (await the PATCH before navigation)
```

Zustand store becomes the optimistic layer. On page load, fetch from API → hydrate store. While editing, store is source of truth. API is synced asynchronously.

### AppSidebar Auto-Collapse (A1)

In `AppSidebar.tsx` (or its parent), detect if `location.pathname.startsWith('/motion')`. If yes, collapse the sidebar (set `open=false` on the shadcn `Sidebar`). Restore on leaving `/motion`. This is a pure frontend change, no backend involvement.

---

## Phase 1 — Database

**Files to create/modify:**
- `backend/src/migrations/010_motion_pages.sql` — new migration

**What the migration does:**
1. Create `motion_page_share_type` enum: `'public_link'`, `'space'`
2. Create `motion_page_permission` enum: `'view'`, `'edit'`
3. Create `motion_pages` table with all columns, indexes, FK constraints, `set_updated_at` trigger
4. Create `motion_page_shares` table with all columns, indexes, unique constraint on `share_token`
5. Index: `(org_id, space_id)` on `motion_pages` for space-scoped list queries
6. Index: `(parent_id)` on `motion_pages` for tree queries
7. Index: `(share_token)` on `motion_page_shares` for public link lookups
8. Index: `(target_org_id, target_space_id)` on `motion_page_shares` for cross-space queries
9. Partial index on `deleted_at IS NULL` for active page queries

**No changes to existing tables.**

---

## Phase 2 — Backend (Repository → Service → Controller → Routes)

### 2a. Types

**File:** `backend/src/types/entities.ts`
- Add `MotionPage` interface
- Add `MotionPageShare` interface

**File:** `backend/src/types/enums.ts`
- Add `MotionShareType` enum
- Add `MotionPermission` enum

### 2b. Repository

**File:** `backend/src/repositories/motion-page.repository.ts`
- Extends `BaseRepository<MotionPage>`
- `findBySpace(orgId, spaceId)` — returns tree-ordered list (ORDER BY parent_id NULLS FIRST, position ASC)
- `findWithShares(pageId)` — joins `motion_page_shares`
- `findByShareToken(token)` — for public link resolution
- `findSharedToSpace(orgId, spaceId)` — pages shared to a given space
- `hardDelete(id, client?)` — actual row removal (cascades to subpages via FK)

**File:** `backend/src/repositories/index.ts`
- Add `MotionPageRepository` import and singleton export

### 2c. Service

**File:** `backend/src/services/motion-page.service.ts`

DTOs: `MotionPageDTO`, `MotionPageShareDTO`

Functions:
- `getPagesBySpace(orgId, spaceId)` → `MotionPageDTO[]`
- `getPageById(orgId, spaceId, pageId)` → `MotionPageDTO | null` (validates org+space ownership)
- `createPage(orgId, spaceId, userId, input)` → `MotionPageDTO`
- `updatePage(orgId, spaceId, pageId, userId, input)` → `MotionPageDTO | null`
- `softDeletePage(orgId, spaceId, pageId, userId)` — sets `deleted_at`
- `restorePage(orgId, spaceId, pageId, userId)` — clears `deleted_at`
- `hardDeletePage(orgId, spaceId, pageId, userId)` — removes row (cascades subpages)
- `createShare(orgId, spaceId, pageId, userId, input)` → `MotionPageShareDTO`
- `revokeShare(orgId, spaceId, pageId, shareId, userId)`
- `getSharesByPage(orgId, spaceId, pageId)` → `MotionPageShareDTO[]`
- `getPageByPublicToken(token)` → `MotionPageDTO | null` (checks expiry, returns page if valid)
- `getSharedToSpace(orgId, spaceId)` → `MotionPageDTO[]`

Share token generation: `crypto.randomBytes(32).toString('hex')` — Node built-in, no new dependency.

### 2d. Controller

**File:** `backend/src/controllers/motion-page.controller.ts`

One `catchAsync` handler per route. Validates input with `ApiError`, returns `ApiResponse`. Extracts `orgId`/`spaceId` from params, `userId` from `req.user.id`.

`assertPageInSpace` helper — verifies page belongs to the requested org+space before any mutation (same pattern as `assertTaskInSpace` in org-task controller).

### 2e. Routes

**File:** `backend/src/routes/motion-page.routes.ts`
- `Router({ mergeParams: true })`
- `router.use(protect, requireOrgMember, requireSpaceMember)`
- Wire all CRUD + share endpoints

**File:** `backend/src/routes/motion-public.routes.ts`
- `GET /notes/public/:token` — no auth middleware
- Calls `getPageByPublicToken`, returns 404 if not found or expired

**File:** `backend/src/routes/v1.routes.ts`
- Add: `router.use('/orgs/:orgId/spaces/:spaceId/notes', motionPageRoutes)`
- Add: `router.use('/', motionPublicRoutes)` (for the public token endpoint)

---

## Phase 3 — Frontend: Store & API Hook

### 3a. Remove dead code

- Delete `frontend/src/components/motion/motionStorage.ts`

### 3b. API Hook

**File:** `frontend/src/hooks/api/useMotionPages.ts`

Query key factory:
```ts
motionPageKeys = {
  all: ['motion-pages'],
  list: (orgId, spaceId) => [..., orgId, spaceId, 'list'],
  detail: (orgId, spaceId, id) => [..., orgId, spaceId, 'detail', id],
  shared: (orgId, spaceId) => [..., orgId, spaceId, 'shared'],
}
```

Hooks:
- `useMotionPages(orgId, spaceId)` — `useQuery`, `enabled: !!orgId && !!spaceId`
- `useMotionPage(orgId, spaceId, pageId)` — `useQuery`
- `useCreateMotionPage(orgId, spaceId)` — `useMutation`, optimistic insert into list cache
- `useUpdateMotionPage(orgId, spaceId)` — `useMutation`, optimistic update in list + detail cache
- `useSoftDeleteMotionPage(orgId, spaceId)` — `useMutation`, optimistic remove from list
- `useRestoreMotionPage(orgId, spaceId)` — `useMutation`
- `useHardDeleteMotionPage(orgId, spaceId)` — `useMutation`
- `useCreateMotionPageShare(orgId, spaceId, pageId)` — `useMutation`
- `useRevokeMotionPageShare(orgId, spaceId, pageId)` — `useMutation`
- `useMotionPageShares(orgId, spaceId, pageId)` — `useQuery`
- `useSharedToSpace(orgId, spaceId)` — `useQuery` (pages shared into this space)

### 3c. Zustand Store Refactor

**File:** `frontend/src/store/useMotionStore.ts`

Keep the store but change its role:
- Remove `persist` middleware (no more localStorage)
- Store becomes a pure in-memory working copy / optimistic layer
- Add `dirtyPageIds: Set<string>` — tracks pages with unsaved changes
- Add `setDirty(id)` / `clearDirty(id)` actions
- Add `hydratePages(pages: MotionPageRecord[])` — called after API fetch to seed the store
- `addPage`, `updatePage`, `deletePage`, `restorePage`, `permanentlyDeletePage` remain but now also trigger the corresponding API mutation (passed in or called from the component)
- `sidebarOpen` / `setSidebarOpen` stays as-is (pure UI state, no backend)

The store is seeded on mount from the API response. Edits go to the store first (instant), then sync to the API via debounce.

---

## Phase 4 — Frontend: Components

### 4a. AppSidebar auto-collapse

**File:** `frontend/src/components/AppSidebar.tsx` (or its parent in `Layout.tsx`)

- Use `useLocation()` from react-router-dom
- If `location.pathname.startsWith('/motion')`, set sidebar `open={false}`
- On leaving `/motion`, restore previous open state
- This is a `useEffect` watching `location.pathname`

### 4b. MotionSidebar — connect to backend + org/space switcher

**File:** `frontend/src/components/motion/MotionSidebar.tsx`

Changes:
- Remove all direct Zustand store reads for page data
- Use `useMotionPages(orgId, spaceId)` from the new hook
- Use `useAppContext()` to get `activeOrgId`, `activeSpaceId`, `organisations`, `spaces`, `setActiveOrganisation`
- Add org/space switcher in the sidebar header (dropdown showing orgs → spaces, calls `setActiveOrganisation`)
- Show loading skeleton while `useMotionPages` is fetching
- Show "Select an organisation to use Motion" if no org/space active
- All mutations (add, delete, rename) call the API hooks, which update the cache, which re-renders the sidebar
- Keep `sidebarOpen`/`setSidebarOpen` from Zustand (UI-only state)

### 4c. MotionPage — debounced save

**File:** `frontend/src/components/motion/MotionPage.tsx`

Changes:
- On mount: if page not in Zustand store, fetch from `useMotionPage(orgId, spaceId, pageId)` and hydrate
- Title save: on blur, call `useUpdateMotionPage` mutation directly (title changes are discrete, not streamed)
- Content save:
  - On editor change → update Zustand store immediately (optimistic)
  - Mark page as dirty (`setDirty(pageId)`)
  - Debounce 1500ms → call `useUpdateMotionPage` mutation
  - On navigation away → cancel debounce, flush immediately (call mutation, await it)
  - Show subtle save indicator: "Saving..." while dirty, "Saved" after success, "Save failed" on error
- Read `orgId`/`spaceId` from `useAppContext()`
- If no `orgId`/`spaceId`, show "Select an organisation to use Motion"
- Redirect to `/motion` if page not found (same as current behavior)

### 4d. MotionHome — connect to backend

**File:** `frontend/src/components/motion/MotionHome.tsx`

Changes:
- Replace Zustand `pages` with `useMotionPages(orgId, spaceId)` data
- Show loading state while fetching
- Show empty state + "Create your first page" if no pages
- Show "Select an organisation" if no org/space active
- `handleCreatePage` calls `useCreateMotionPage` mutation

### 4e. MotionProfile — minor update

**File:** `frontend/src/components/motion/MotionProfile.tsx`

- `pageCount` reads from `useMotionPages` data length instead of Zustand store

---

## Phase 5 — Sharing UI

### 5a. Share modal component

**File:** `frontend/src/components/motion/MotionShareModal.tsx`

- Triggered from the `MoreHorizontal` button in `MotionPage` header (currently a no-op button)
- Shows existing shares for the page (`useMotionPageShares`)
- "Share via public link" section:
  - Button to generate public link (calls `useCreateMotionPageShare` with `share_type: 'public_link'`)
  - Shows the link with copy button once created
  - Option to set expiry
  - Revoke button
- "Share with space" section:
  - Org/space selector (dropdowns)
  - Permission selector (view/edit)
  - "Share" button calls `useCreateMotionPageShare` with `share_type: 'space'`
  - Lists existing space shares with revoke buttons

### 5b. Public page viewer

**File:** `frontend/src/components/motion/MotionPublicPage.tsx`

- New route: `/notes/public/:token` — outside `<Layout>`, no auth required
- Fetches `GET /v1/notes/public/:token`
- Renders page title + content in read-only mode (SimpleEditor with `editable={false}`)
- Shows 404 if token invalid or expired

**File:** `frontend/src/App.tsx`
- Add public route: `<Route path="/notes/public/:token" element={<MotionPublicPage />} />`
- This route is outside `<ProtectedRoute>` and outside `<Layout>`

### 5c. Shared-to-me section in MotionSidebar

- Add a "Shared with this space" collapsible section in `MotionSidebar`
- Uses `useSharedToSpace(orgId, spaceId)`
- Shows pages shared into the current space from other spaces
- Clicking navigates to `/motion/:pageId` (the page is fetched via its own endpoint which checks share access)

---

## Phase 6 — Cleanup & Guards

- Remove `motionStorage.ts`
- Update `useMotionStore` to remove `persist` and localStorage references
- Add guard in all Motion components: if `mode !== 'organisation' || !activeOrgId || !activeSpaceId`, render an empty state prompt ("Switch to an organisation to use Motion") instead of the page content
- Ensure `MotionPage` flushes pending saves before unmount (`useEffect` cleanup)
- Ensure `key={pageId}` on `SimpleEditor` is preserved (forces remount on page navigation, preventing stale editor state)

---

## File Change Summary

### New files
| File | Purpose |
|---|---|
| `backend/src/migrations/010_motion_pages.sql` | DB schema |
| `backend/src/repositories/motion-page.repository.ts` | DB queries |
| `backend/src/services/motion-page.service.ts` | Business logic |
| `backend/src/controllers/motion-page.controller.ts` | HTTP handlers |
| `backend/src/routes/motion-page.routes.ts` | Authenticated routes |
| `backend/src/routes/motion-public.routes.ts` | Public token route |
| `frontend/src/hooks/api/useMotionPages.ts` | TanStack Query hooks |
| `frontend/src/components/motion/MotionShareModal.tsx` | Share UI |
| `frontend/src/components/motion/MotionPublicPage.tsx` | Public viewer |

### Modified files
| File | Change |
|---|---|
| `backend/src/types/entities.ts` | Add `MotionPage`, `MotionPageShare` interfaces |
| `backend/src/types/enums.ts` | Add `MotionShareType`, `MotionPermission` enums |
| `backend/src/repositories/index.ts` | Register `motionPageRepository` singleton |
| `backend/src/routes/v1.routes.ts` | Mount motion routes |
| `frontend/src/store/useMotionStore.ts` | Remove persist, add dirty tracking, add hydrate action |
| `frontend/src/components/motion/MotionSidebar.tsx` | Connect to API, add org/space switcher |
| `frontend/src/components/motion/MotionPage.tsx` | Debounced save, API integration, save indicator |
| `frontend/src/components/motion/MotionHome.tsx` | Connect to API |
| `frontend/src/components/motion/MotionProfile.tsx` | Read page count from API |
| `frontend/src/components/AppSidebar.tsx` | Auto-collapse on `/motion/*` routes |
| `frontend/src/App.tsx` | Add public route outside Layout |

### Deleted files
| File | Reason |
|---|---|
| `frontend/src/components/motion/motionStorage.ts` | Dead code, superseded by Zustand store |

---

## Implementation Order

1. Phase 1 — migration (run it, verify schema)
2. Phase 2 — full backend stack (repo → service → controller → routes)
3. Phase 3a+3b — delete dead code, create API hook
4. Phase 3c — refactor Zustand store
5. Phase 4a — AppSidebar auto-collapse (isolated, no risk)
6. Phase 4b — MotionSidebar connected to backend
7. Phase 4c+4d+4e — MotionPage, MotionHome, MotionProfile connected
8. Phase 5 — sharing (modal, public viewer, shared-to-me sidebar section)
9. Phase 6 — cleanup, guards, edge cases

Each phase is independently testable before moving to the next.
