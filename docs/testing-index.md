# Testing Index

Single source of truth for all existing tests. Check this file before writing new tests to avoid duplicates.

> Related: [`docs/testing.md`](./testing.md) — full setup guide, architecture, and how to write new tests.

---

## Backend Tests

### `backend/src/routes/__tests__/health.routes.test.ts`

| # | Description | Method | Route | Assertion |
|---|---|---|---|---|
| 1 | Returns 200 with healthy status | `GET` | `/api/health` | `statusCode: 200`, `data.status: "ok"`, `data.database` present |

---

### `backend/src/routes/__tests__/org.routes.test.ts`

| # | Description | Method | Route | Assertion |
|---|---|---|---|---|
| 1 | Rejects request without token | `GET` | `/api/v1/orgs` | 401, `success: false` |
| 2 | Creates a new organisation | `POST` | `/api/v1/orgs` | 201, returns `org` + `space`, `space.name: "General"` |
| 3 | Returns list of orgs the user belongs to | `GET` | `/api/v1/orgs` | 200, `organisations` array, includes personal org + created org |

---

### `backend/src/routes/__tests__/motion-page.routes.test.ts`

Base path: `/api/v1/orgs/:orgId/spaces/:spaceId/notes`

**POST / — Create Page**

| # | Description | Assertion |
|---|---|---|
| 1 | Creates root page with default title | 201, `title: "Untitled"`, `parent_id: null` |
| 2 | Creates page with custom title | 201, `title` matches sent value |
| 3 | Creates subpage under existing parent | 201, `parent_id` matches parent's `id` |
| 4 | Rejects invalid `parent_id` | 400, message contains "Parent page not found" |
| 5 | Rejects creation by a `member` role | 403 |

**GET / — List Pages**

| # | Description | Assertion |
|---|---|---|
| 6 | Returns all active pages for the space | 200, array length matches created count, no `content` field in list items |
| 7 | Excludes soft-deleted pages | 200, deleted page absent from list |
| 8 | Accessible by `member` role | 200 |

**GET /:id — Get Page Detail**

| # | Description | Assertion |
|---|---|---|
| 9 | Returns full page data including `content` | 200, `content.type: "doc"` |
| 10 | Returns 404 for non-existent page | 404 |

**PATCH /:id — Update Page**

| # | Description | Assertion |
|---|---|---|
| 11 | Updates `title` | 200, `title` matches new value |
| 12 | Updates `content` with valid JSON | 200, `content` matches sent object |
| 13 | Rejects empty/whitespace `title` | 400 |
| 14 | Rejects non-object `content` | 400 |
| 15 | Rejects `content` larger than 1MB | 413, message contains "maximum size" |
| 16 | Updates `cover_position` within 0–100 | 200, `cover_position` matches sent value |
| 17 | Rejects `cover_position` outside 0–100 | 400 |
| 18 | Prevents page from being its own parent | 400 |
| 19 | Sets `updated_by` to the acting user | 200, `updated_by` matches token user ID |
| 20 | Rejects updates from `member` role | 403 |
| 21 | Rate limits after 60 requests/minute | 429, message contains "Too many requests" |

**DELETE /:id — Soft Delete**

| # | Description | Assertion |
|---|---|---|
| 22 | Soft-deletes page and all descendants | 200; root, child, grandchild all appear in `/trash`; active list is empty |
| 23 | Rejects deletion by `member` role | 403 |

**PATCH /:id/restore — Restore from Trash**

| # | Description | Assertion |
|---|---|---|
| 24 | Restores a soft-deleted page | 200, `deleted_at: null` |
| 25 | Returns 400 if page is not in trash | 400 |

**DELETE /:id/permanent — Hard Delete**

| # | Description | Assertion |
|---|---|---|
| 26 | Permanently deletes a page | 200; page absent from `/trash` after deletion |

**Ordering**

| # | Description | Assertion |
|---|---|---|
| 27 | Assigns incrementing positions to new pages | `position` of second page > first page |
| 28 | Lists pages ordered by position | Titles returned in creation order |

**Authentication**

| # | Description | Assertion |
|---|---|---|
| 29 | Rejects request without auth token | 401 |
| 30 | Rejects request with invalid token | 401 |

---

### `backend/src/__tests__/socket.test.ts`

| # | Description | Assertion |
|---|---|---|
| 1 | Connects with a valid auth token | `socket.connected: true` |
| 2 | Rejects connection with no auth token | `connect_error` with "Authentication error" |
| 3 | Sends and receives a message in a channel room | `receive_message` event fires with correct `content` and `sender.id` |

---

## Frontend Tests

### `frontend/src/store/__tests__/useChatStore.test.ts`

| # | Description | Assertion |
|---|---|---|
| 1 | `openChat` / `closeChat` toggle `isChatOpen` | `true` after open, `false` + `activeChannelId: null` after close |
| 2 | `openChatDialog` / `closeChatDialog` toggle `isChatDialogOpen` | `true` after open, `false` after close |
| 3 | `setActiveChannel` sets and clears `activeChannelId` | Matches set value; `null` after clearing |
| 4 | `addTypingUser` adds user, ignores duplicate; `removeTypingUser` removes | Length 1 after add, still 1 after duplicate add, 0 after remove |

---

### `frontend/src/store/__tests__/useMeetingStore.test.ts`

| # | Description | Assertion |
|---|---|---|
| 1 | Dialog open / minimize / restore / close lifecycle | `isDialogOpen` and `isMinimized` correct at each step |
| 2 | `setDuration` with direct value and functional updater | `10` after direct set; `15` after `prev + 5` |
| 3 | `setRequestAction` and `setStatus` update state | `requestAction: "pause"`, `status: "recording"` |
| 4 | `reset()` returns all fields to initial values | `status: "idle"`, `duration: 0`, `meetingId: null`, `volumes: [0.05×5]` |

---

### `frontend/src/store/__tests__/useMotionStore.test.ts`

| # | Description | Assertion |
|---|---|---|
| 1 | `hydratePages` change-detection guard — ignores identical data, updates on `parent_id` or `position` change | `parent_id` and `position` reflect updated values after re-hydrate |
| 2 | `removePageLocally` recursively removes page tree and clears dirty state for descendants | Only unrelated page remains; dirty flags for deleted pages cleared |

---

## Coverage Summary

| Area | Files with Tests | Files without Tests |
|---|---|---|
| Backend routes | `health`, `org`, `motion-page` | `activity`, `ai`, `auth`, `integration`, `meeting`, `motion`, `motion-public`, `notification`, `org-activity`, `org-chat`, `org-task`, `personal-task`, `preferences`, `public-task`, `space` (via org), `task-locator`, `user` |
| Backend socket | `socket` | typing events, disconnect cleanup, invalid room |
| Backend services/repos | — | all (tested indirectly via routes) |
| Frontend stores | `useChatStore`, `useMeetingStore`, `useMotionStore` | — |
| Frontend components | — | all of `src/components/` |
| Frontend hooks | — | `useSpaceRole`, `useTaskPermissions`, `useTaskOverdueAutoRefresh` |
