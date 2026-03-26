# Module 4 — Activity Feed / Audit Logs

## Prerequisites
- Phase 0 (Foundation) must be complete
- Module 1 (Tasks Core) must be complete
- Module 3 (Comments) should be complete — comment events appear in the activity feed, and testing the feed is more meaningful with comment actions present

---

## Context for Developers

### What already exists

**Backend — fully implemented below the controller layer**
- `backend/src/services/activity.service.ts` — fully implemented:
  - `getWorkspaceActivity(workspaceId, options)` — paginated workspace-level feed
  - `getEntityActivity(entityType, entityId)` — all activity for a specific task or comment
  - `getActivityFeed(workspaceId, limit, offset)` — convenience wrapper for paginated feed
- `backend/src/repositories/activity.repository.ts` — fully implemented:
  - `findByWorkspace()` — with filters for `entityType`, `entityId`, `userId`, and pagination
  - `findByEntity()` — scoped to a single entity (e.g. one task's history)
  - `findByUser()` — all actions by a specific user in a workspace
  - `findRecent()` — latest N entries for a workspace
- Activity logs are **already being written** by all other services — every task create/update/delete/status change/assignment/dependency change/comment create/delete already inserts a row into `activity_logs`. No new logging needs to be added.
- Route exists: `GET /api/v1/activity` → `getActivityFeed` controller (stub)
- Route exists: `GET /api/v1/dashboard` → `getDashboardInfo` controller (stub) — dashboard is Module 5, leave it

**Frontend**
- `TaskDetailPane.tsx` has a `HistoryTab` (L664–717) that currently renders `task.history` — a mock array of `HistoryEntry` objects (`{ id, field, from, to, user, timestamp }`)
- The `HistoryEntry` type in `src/types/task.ts` is a frontend-only shape — it does not match the real `ActivityLogDTO` from the backend
- No `useActivity` hook exists yet — the placeholder file was created in Phase 0

### What is missing
- `getActivityFeed` controller in `activity.controller.ts` is a stub returning an empty array
- No task-scoped activity endpoint exists — the current route only fetches workspace-level feed. We need entity-level filtering via query params.
- Frontend `HistoryTab` uses `task.history` mock data
- No TanStack Query hooks for activity exist yet

### How activity logging works
Every time a service mutates data, it calls `activityRepository.log(...)` inside the same transaction. This means by the time Module 1, 2, and 3 are complete, the `activity_logs` table will already have real data. This module only needs to **expose** what is already there.

---

## Branch Names
- `feature/activity-be` — Dev A
- `feature/activity-fe` — Dev B

---

## API Contract

Both developers must agree on these shapes before writing code.

### `GET /api/v1/activity`

Used for the workspace-level activity feed (future workspace dashboard view).

**Query params:**
```
limit        number   default 20, max 100
offset       number   default 0
entity_type  string   optional — "task" | "comment" | "workspace"
entity_id    uuid     optional — filter to a specific entity's history
```

**Auth:** Required

**Response 200:**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Activity feed retrieved successfully",
  "data": [
    {
      "id": "uuid",
      "workspace_id": "uuid",
      "user_id": "uuid or null",
      "entity_type": "task",
      "entity_id": "uuid",
      "action_type": "status_changed",
      "old_value": { "status": "todo" },
      "new_value": { "status": "in-progress" },
      "created_at": "ISO string",
      "user": {
        "id": "uuid",
        "email": "user@example.com",
        "name": "User Name or null",
        "created_at": "ISO string"
      }
    }
  ]
}
```

**Notes:**
- `user` can be `null` if the user was deleted (the DB stores `ON DELETE SET NULL`)
- `old_value` is `null` for creation events
- `new_value` is `null` for deletion events
- When `entity_id` is passed, the response is the history for that specific task/comment

---

## Dev A — Backend Deliverables

> Branch: `feature/activity-be`

### File: `backend/src/controllers/activity.controller.ts`

- [ ] Implement `getActivityFeed` controller:
  - Extract workspace from `req.user` (same pattern as other controllers)
  - Parse query params: `limit` (default 20, max 100), `offset` (default 0), `entity_type`, `entity_id`
  - If `entity_id` is provided, call `activityService.getEntityActivity(entityType, entityId)`
  - Otherwise call `activityService.getActivityFeed(workspaceId, limit, offset)`
  - Validate `entity_type` against allowed values (`"task" | "comment" | "workspace"`) if provided
  - Return `200` with array of `ActivityLogDTO`

- [ ] Leave `getDashboardInfo` as a stub — it belongs to Module 5

### Validation
- [ ] `limit` must be a positive integer — clamp to max 100 silently or return 400
- [ ] `offset` must be a non-negative integer
- [ ] `entity_type`, if provided, must be one of the valid `LogEntityType` enum values
- [ ] `entity_id`, if provided, must be a valid UUID format
- [ ] Workspace scoping: the activity returned must only belong to the requesting user's workspace — the service already handles this via `workspace_id`, but verify it is passed correctly

### No new routes needed
- The existing `GET /api/v1/activity` route already handles both workspace-level and entity-level fetching via query params
- Do **not** add a `GET /api/v1/tasks/:id/activity` route — use query params instead to keep the surface area small

---

## Dev B — Frontend Deliverables

> Branch: `feature/activity-fe`

### File: `frontend/src/hooks/api/useActivity.ts`

- [ ] Add `useWorkspaceActivity(options?)` query hook
  - Calls `GET /api/v1/activity` with `workspaceId` from WorkspaceContext
  - Accepts optional `limit` and `offset` params
  - Query key: `["activity", "workspace", workspaceId, options]`

- [ ] Add `useTaskActivity(taskId)` query hook
  - Calls `GET /api/v1/activity?entity_type=task&entity_id=<taskId>`
  - Query key: `["activity", "task", taskId]`
  - Only fetch when `taskId` is truthy — use `enabled: !!taskId`

### File: `frontend/src/types/task.ts`

- [ ] Add a new type `ActivityLogEntry` that matches the real backend `ActivityLogDTO` shape:
  ```
  type ActivityLogEntry = {
    id: string;
    entity_type: "task" | "comment" | "workspace";
    entity_id: string;
    action_type: string;
    old_value: Record<string, any> | null;
    new_value: Record<string, any> | null;
    created_at: string;
    user: { id: string; email: string; name: string | null } | null;
  }
  ```
- [ ] Keep the existing `HistoryEntry` type temporarily — remove it only after `HistoryTab` is fully wired and `task.history` usage is gone

### File: `frontend/src/components/tasks/TaskDetailPane.tsx`

**Wire the HistoryTab (L664–717):**

- [ ] Replace the current `task.history.map(...)` rendering with data from `useTaskActivity(task.id)`
- [ ] Add a loading state inside HistoryTab — a simple "Loading history..." text or skeleton is fine
- [ ] Add an empty state when no activity entries exist — "No history yet"
- [ ] For each `ActivityLogEntry`, render a human-readable description:
  - Map `action_type` values to readable labels:
    - `task_created` → "Task created"
    - `status_changed` → "Status changed from `old_value.status` to `new_value.status`"
    - `priority_changed` → "Priority changed from `old_value.priority` to `new_value.priority`"
    - `assignment_added` → "Assigned to a user"
    - `assignment_removed` → "Unassigned a user"
    - `due_date_changed` → "Due date updated"
    - `dependency_added` → "Dependency added"
    - `dependency_removed` → "Dependency removed"
    - `comment_created` → "Comment added"
    - `comment_deleted` → "Comment deleted"
    - `objective_updated` → "Objective updated"
    - `success_criteria_updated` → "Success criteria updated"
    - `title_updated` → "Title updated"
    - `description_updated` → "Description updated"
    - Any unknown `action_type` → display the raw string as fallback
  - Show `user.name ?? user.email ?? "Unknown user"` as the actor
  - Show `created_at` formatted as a relative time (e.g. "2 hours ago") — `date-fns` is already installed, use `formatDistanceToNow`
- [ ] Remove the `HistoryEntry` import from `task.ts` once the tab is fully driven by live data
- [ ] Remove the `task.history` field from the `Task` type in `task.ts` once no component references it

---

## Files Modified Summary

| File | Who | Change |
|---|---|---|
| `backend/src/controllers/activity.controller.ts` | Dev A | Implement `getActivityFeed` |
| `frontend/src/hooks/api/useActivity.ts` | Dev B | Create with `useWorkspaceActivity` and `useTaskActivity` |
| `frontend/src/types/task.ts` | Dev B | Add `ActivityLogEntry` type, remove `HistoryEntry` after wiring |
| `frontend/src/components/tasks/TaskDetailPane.tsx` | Dev B | Wire `HistoryTab` to `useTaskActivity` |

---

## Acceptance Criteria

- [x] After creating a task in the UI, a `task_created` entry appears in the task's history tab
- [x] After changing a task status, a `status_changed` entry appears showing the old and new status values
- [x] After adding an assignee (Module 2), an `assignment_added` entry appears in task history
- [ ] After adding a comment (Module 3), a `comment_created` entry appears in task history
- [ ] History entries show the correct user name and a relative timestamp
- [ ] History tab shows a loading state while fetching
- [ ] History tab shows an empty state when no events exist yet
- [ ] No reference to `task.history` mock data remains in the history tab
- [ ] Pagination: `limit` and `offset` params work correctly on the backend endpoint
- [ ] `entity_id` filtering works — passing a task ID returns only that task's events

---

## Impact on Other Modules

| Module | Impact |
|---|---|
| Module 1 (Tasks Core) | No changes needed. Task service already writes activity logs on every mutation. |
| Module 2 (Assignees & Deps) | No changes needed. Assignment and dependency events are already logged. |
| Module 3 (Comments) | No changes needed. Comment events are already logged. |
| Module 5 (Dashboard) | The `getActivityFeed` controller lives in the same file (`activity.controller.ts`) as `getDashboardInfo`. Dev A should **not** touch the `getDashboardInfo` stub — leave it for Module 5. |
| Owner (reviewer) | When reviewing, test the history tab after performing a sequence of actions on a task to verify the log is accurate and ordered correctly (newest first). |

---

## Notes

- `date-fns` is already installed in the frontend — use `formatDistanceToNow(new Date(entry.created_at), { addSuffix: true })` for relative times
- The `activity_logs` table uses `entity_id` as a plain UUID without a foreign key (intentional — allows logging deleted entities). This means the frontend should not expect a task to still exist just because a log references it.
- Activity logs are **append-only** — there is no update or delete operation on them. Do not add any delete endpoint.
- The `old_value` and `new_value` fields are JSONB on the DB side and arrive as plain objects. Access them safely with optional chaining: `entry.old_value?.status`.
