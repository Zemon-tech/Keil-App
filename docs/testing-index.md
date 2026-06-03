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

<<<<<<< HEAD
=======
### `backend/src/routes/__tests__/org-task.routes.test.ts`

Base path: `/api/v1/orgs/:orgId/spaces/:spaceId/tasks`

| # | Description | Method | Route | Assertion |
|---|---|---|---|---|
| 1 | RBAC: Admin creation | `POST` | `/` | 201, matches object details |
| 2 | RBAC: Manager creation | `POST` | `/` | 201, matches object details |
| 3 | RBAC: Member creation block | `POST` | `/` | 403 Forbidden |
| 4 | Task CRUD happy paths | `GET`/`PATCH`/`DELETE` | `/`, `/:id` | Lists task, updates fields, soft-deletes, GET by ID returns 404 |
| 5 | Unassigned Admin status | `PATCH` | `/:id/status` | 200, updates status regardless of assignment |
| 6 | Unassigned Member status block | `PATCH` | `/:id/status` | 403, blocked if not assigned to the task |
| 7 | Assigned Member status | `PATCH` | `/:id/status` | 200, allowed after explicit assignment |
| 8 | Dependency check - incomplete | `PATCH` | `/:id/status` | 400, blocks completion if dependencies are incomplete |
| 9 | Dependency check - complete | `PATCH` | `/:id/status` | 200, allows completion once dependencies are marked DONE |

---

### `backend/src/routes/__tests__/personal-task.routes.test.ts`

Base path: `/api/v1/personal/tasks`

| # | Description | Method | Route | Assertion |
|---|---|---|---|---|
| 1 | Happy path Personal task CRUD | `POST`/`GET`/`PATCH`/`DELETE` | `/`, `/:id` | Correctly creates, lists, updates, reads, and deletes personal task |
| 2 | Tenancy isolation boundaries | `GET`/`PATCH`/`DELETE` | `/:id` | Blocks User B from reading, updating, or deleting User A's tasks with 404 |

---

### `backend/src/routes/__tests__/org-chat.routes.test.ts`

Base path: `/api/v1/orgs/:orgId/spaces/:spaceId/chat`

| # | Description | Method | Route | Assertion |
|---|---|---|---|---|
| 1 | DM creation and reuse | `POST` | `/channels/direct` | 201 for fresh creation, 200 for subsequent requests reusing same channel |
| 2 | Group channel space filter | `POST` | `/channels/group` | 201 if members in space, 400 if members not part of the active space |
| 3 | Unread counts indexing | `GET` | `/channels` | Correctly increments `unread_count` for User B on new messages |
| 4 | Message pagination (beforeId) | `GET` | `/channels/:id/messages` | Paginated message arrays in correct chronological order matching cursor |
| 5 | Read state marking | `POST` | `/channels/:id/read` | 200, marks channel as read and clears unread count back to 0 |

---

### `backend/src/routes/__tests__/meeting.routes.test.ts`

Base path: `/api/v1/meetings`

| # | Description | Method | Route | Assertion |
|---|---|---|---|---|
| 1 | Paginated meeting history | `GET` | `/history` | Returns paginated list of recordings for the user |
| 2 | Transcript search queries | `GET` | `/search/query` | Filters recordings containing query string in transcript |
| 3 | Deletion ownership block | `DELETE` | `/recording/:id` | Blocks user B from deleting user A's recordings (403) |
| 4 | Deletion happy path | `DELETE` | `/recording/:id` | Allows user A to delete their own recording (200) |

---

>>>>>>> 62e5a55 (test: implement unit and integration test suite)
### `backend/src/__tests__/socket.test.ts`

| # | Description | Assertion |
|---|---|---|
| 1 | Connects with a valid auth token | `socket.connected: true` |
| 2 | Rejects connection with no auth token | `connect_error` with "Authentication error" |
| 3 | Sends and receives a message in a channel room | `receive_message` event fires with correct `content` and `sender.id` |
<<<<<<< HEAD
=======
| 4 | Broadcasts typing_start & typing_end | Emitting A broadcasts typing status to other room member B, clears on end |
| 5 | Blocks unauthorized joins | Join / emit calls from unauthorized non-members are blocked from room |

---

### `backend/src/services/__tests__/org-task.service.test.ts`

| # | Description | Assertion |
|---|---|---|
| 1 | due_date before start_date on create | Throws 400 ApiError |
| 2 | due_date before start_date on update | Throws 400 ApiError |
| 3 | Circular dependency detection | Throws 400 circular dependency ApiError |
| 4 | Assigned status checks for members | Allows admins, blocks unassigned members, allows assigned members |

---

### `backend/src/services/__tests__/personal-task.service.test.ts`

| # | Description | Assertion |
|---|---|---|
| 1 | due_date before start_date checks | Throws 400 ApiError on create and update |
| 2 | Ownership checks | Wrong user retrieval returns null; updates return null; deletions return false |

---

### `backend/src/services/__tests__/org-chat.service.test.ts`

| # | Description | Assertion |
|---|---|---|
| 1 | saveMessage sender read-dot fix | Automatically marks the sender's own `last_read_at` as NOW |
| 2 | createChannel member validation | Throws 400 if any target user is not a space member |
| 3 | getChannelMessages pagination | Retrieves items using cursor-based comparison on timestamp/ID |

---

### `backend/src/services/__tests__/meeting.service.test.ts`

| # | Description | Assertion |
|---|---|---|
| 1 | Deletion owner matching | Returns `true` for recording owner, `false` for other users |
| 2 | Float duration rounding | Float durations (e.g. 15.6, 42.4) round to nearest integer in job and duration updates |

---

### `backend/src/repositories/__tests__/base.repository.test.ts`

| # | Description | Assertion |
|---|---|---|
| 1 | Empty payloads skip DB hit | `update` returns matching entity without executing SQL UPDATE statement |
| 2 | Actual updates hit DB | Executes UPDATE query when fields are provided |
| 3 | Soft deletion lifecycle | `softDelete` sets `deleted_at`, `findById` normal filters out, `includeDeleted: true` retrieves, `restore` unsets |
>>>>>>> 62e5a55 (test: implement unit and integration test suite)

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

<<<<<<< HEAD
=======
### `frontend/src/hooks/__tests__/useSpaceRole.test.ts`

| # | Description | Assertion |
|---|---|---|
| 1 | `member` role permissions | Blocks task/page creations, allows commenting/assigned status changes |
| 2 | `manager` role permissions | Allows task and page creations, blocks editing arbitrary pages |
| 3 | `admin` role permissions | Full commenting, task control, and space member management overlays |
| 4 | Org Owner overlay | Allows space configuration overlays and invite permissions |

---

### `frontend/src/hooks/__tests__/useTaskPermissions.test.ts`

| # | Description | Assertion |
|---|---|---|
| 1 | Default permissions for null task | Returns all permission capability flags as false |
| 2 | Contextual space match | Resolves permissions using the global activeSpace.role when matches |
| 3 | Out of context task fallback | Resolves using `task.user_space_role` if different org/space is selected |
| 4 | Role mappings | Correctly maps all 8 permission capabilities for member, manager, and admin |

---

### `frontend/src/hooks/__tests__/useTaskOverdueAutoRefresh.test.ts`

| # | Description | Assertion |
|---|---|---|
| 1 | Register and clear listeners | Socket events registered on mount, detached on unmount |
| 2 | Invalidate queries on overdue | Socket `task_overdue_moved` invalidates active task lists |
| 3 | Invalidate queries on gcal | Socket `gcal_tasks_updated` invalidates active task lists |
| 4 | Local auto-refresh timer | Interval invalidates active lists every 30s when context is active, clears on unmount |

---

### `frontend/src/lib/__tests__/date-utils.test.ts`

| # | Description | Assertion |
|---|---|---|
| 1 | normalizeAllDayRangeLocal defaults | End date defaults to start + 1 day when missing or invalid |
| 2 | clampTimedRange over max | Clamps long timed ranges to maxDurationMinutes (8 hours) |
| 3 | clampTimedRange zero/negative | Clamps zero or negative durations to 1 minute |
| 4 | normalizeTimedRange | Resets to default duration if start is after end |
| 5 | fromExclusiveRange conversion | Inclusive date shift back and clamping bounds |

---

### `frontend/src/lib/__tests__/tiptap-utils.test.ts`

| # | Description | Assertion |
|---|---|---|
| 1 | isAllowedUri schema blocks | Blocks javascript: scheme, allows safe URI/URL links |
| 2 | sanitizeUrl fallback | Fallback output defaults to '#' on disallowed schemes |
| 3 | formatShortcutKey symbols | Formats Mac symbols (⌘, ⌥) on macOS and full names (Ctrl, Alt) on other OS |

---

>>>>>>> 62e5a55 (test: implement unit and integration test suite)
## Coverage Summary

| Area | Files with Tests | Files without Tests |
|---|---|---|
<<<<<<< HEAD
| Backend routes | `health`, `org`, `motion-page` | `activity`, `ai`, `auth`, `integration`, `meeting`, `motion`, `motion-public`, `notification`, `org-activity`, `org-chat`, `org-task`, `personal-task`, `preferences`, `public-task`, `space` (via org), `task-locator`, `user` |
| Backend socket | `socket` | typing events, disconnect cleanup, invalid room |
| Backend services/repos | — | all (tested indirectly via routes) |
| Frontend stores | `useChatStore`, `useMeetingStore`, `useMotionStore` | — |
| Frontend components | — | all of `src/components/` |
| Frontend hooks | — | `useSpaceRole`, `useTaskPermissions`, `useTaskOverdueAutoRefresh` |
=======
| Backend routes | `health`, `org`, `motion-page`, `org-task`, `personal-task`, `org-chat`, `meeting` | `activity`, `ai`, `auth`, `integration`, `motion`, `motion-public`, `notification`, `org-activity`, `preferences`, `public-task`, `space` (via org), `task-locator`, `user` |
| Backend socket | `socket` | disconnect cleanup |
| Backend services/repos | `org-task`, `personal-task`, `org-chat`, `meeting`, `base` | all others (tested indirectly via routes) |
| Frontend stores | `useChatStore`, `useMeetingStore`, `useMotionStore` | — |
| Frontend components | — | all of `src/components/` |
| Frontend hooks | `useSpaceRole`, `useTaskPermissions`, `useTaskOverdueAutoRefresh` | — |
| Frontend lib/utils | `date-utils`, `tiptap-utils` | `socket`, `tiptap` |
>>>>>>> 62e5a55 (test: implement unit and integration test suite)
