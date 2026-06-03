# Testing To-Do

Tests that need to be created, ordered by priority. No tests exist for any of these yet.

> See [`testing-index.md`](./testing-index.md) for all existing tests.
> See [`testing.md`](./testing.md) for setup guide and how to write new tests.

---

## Priority 1 — Critical (Security & Core Business Rules)

### Backend

| Type | File | What to Test |
|---|---|---|
| Integration | `src/routes/__tests__/org-task.routes.test.ts` | Create task (RBAC: member blocked), update task, delete task, change status (member can only change status of tasks assigned to them), mark task done when dependencies are incomplete (should fail), list tasks |
| Integration | `src/routes/__tests__/personal-task.routes.test.ts` | Ownership isolation — user A cannot read, update, or delete user B's tasks; CRUD happy paths |
| Unit | `src/services/org-task.service.ts` | `validateDateOrder` throws when `due_date < start_date`; circular dependency detection in `addDependency`; member-only-assigned-tasks rule in `changeTaskStatus` |
| Unit | `src/services/personal-task.service.ts` | `validateDateOrder`; ownership check in `getPersonalTaskById`, `updatePersonalTask`, `deletePersonalTask` returns null/false for wrong owner |

---

## Priority 2 — Important (Core Features)

### Backend

| Type | File | What to Test |
|---|---|---|
| Integration | `src/routes/__tests__/org-chat.routes.test.ts` | Create direct channel, creating DM again with same two users reuses existing channel, create group channel rejects non-space-members, list channels with unread counts, get paginated messages, mark channel as read clears unread |
| Integration | `src/__tests__/socket.test.ts` *(extend existing)* | `typing_start` broadcasts `user_typing` to channel room, `typing_end` broadcasts `user_stopped_typing`, `join_channel` rejected if user is not a channel member, `send_message` silently dropped if user not a member |
| Unit | `src/services/org-chat.service.ts` | `saveMessage` marks sender as read immediately; `createChannel` rejects if any member is not a space member; `getChannelMessages` cursor pagination with `beforeId` |

### Frontend

| Type | File | What to Test |
|---|---|---|
| Unit | `src/hooks/useSpaceRole.ts` | `member` role → `canCreateTask: false`, `canComment: true`; `manager` role → `canCreateTask: true`, `canEditAnyPage: false`; `admin` role → `canEditAnyPage: true`, `canDeleteAnyComment: true`; org `owner` with space `member` role → `canManageSpace: true` |
| Unit | `src/hooks/useTaskPermissions.ts` | Null task → all permissions false; task org matches active → uses `activeSpace.role`; task org differs → uses `task.user_space_role`; all 8 permission flags for each role |

---

## Priority 3 — High Value (Pure Logic, Fast to Write)

### Frontend

| Type | File | What to Test |
|---|---|---|
| Unit | `src/lib/date-utils.ts` | `normalizeAllDayRangeLocal` — end ≤ start defaults to start+1 day; `fromExclusiveRange` — clamps to start if result goes before start; `normalizeTimedRange` — zero/negative/infinite duration defaults to 60 min; `clampTimedRange` — over max clamps, under 1 min becomes 1 min; `isAllDayRangeLocal` — returns false if boundaries are not at local midnight |
| Unit | `src/lib/tiptap-utils.ts` | `isAllowedUri` blocks `javascript:` scheme, allows `https:`; `sanitizeUrl` returns `"#"` for invalid/disallowed URLs; `formatShortcutKey` returns Mac symbols on Mac, capitalized key on non-Mac; `clamp` clamps correctly at min and max boundaries |

### Backend

| Type | File | What to Test |
|---|---|---|
| Unit | `src/repositories/base.repository.ts` | `update` with empty data returns existing record without hitting DB; `softDelete` sets `deleted_at`; `restore` clears `deleted_at`; `findById` excludes soft-deleted by default, includes with `includeDeleted: true` |

---

## Priority 4 — Good Coverage (Fills Gaps)

### Backend

| Type | File | What to Test |
|---|---|---|
| Integration | `src/routes/__tests__/meeting.routes.test.ts` | `GET /history` returns paginated recordings for the authenticated user; `GET /search/query` returns results matching transcript text; `DELETE /recording/:id` — user B cannot delete user A's recording (ownership check) |
| Unit | `src/services/meeting.service.ts` | `deleteRecording` returns `false` when user is not the owner; `updateRecordingDuration` rounds float to integer; `getMeetingHistory` correct pagination offset calculation |

### Frontend

| Type | File | What to Test |
|---|---|---|
| Unit | `src/hooks/useTaskOverdueAutoRefresh.ts` | Socket `task_overdue_moved` event triggers `invalidateQueries`; `gcal_tasks_updated` event triggers `invalidateQueries`; 30-second interval fires invalidation when `activeOrgId` and `activeSpaceId` are set; cleanup removes socket listeners and clears interval on unmount |

---

## Not Prioritised (Skip for Now)

| Type | Reason |
|---|---|
| E2E (Playwright/Cypress) | High setup cost, no infrastructure exists yet. Add after unit and integration coverage is solid. |
| Component tests (`ChatPage`, `MeetingDialog`, `TasksPage`) | Heavily context-dependent (router, auth, socket, react-query). High setup cost relative to value. Store and route tests already cover the logic. |
| `auth.routes.ts` (Google OAuth) | Requires mocking the full Google OAuth flow — complex and brittle. Lower risk than business logic. |
| `ApiError`, `ApiResponse`, `catchAsync` | Trivial classes, not worth dedicated test files. |
