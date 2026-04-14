# Module 7 — Schedule & Gantt

## Prerequisites
- Phase 0 (Foundation) must be complete — `workspaceId` must be available globally and `req.workspaceId` must be attached by auth middleware
- Module 1 (Tasks Core) must be complete — real task IDs, assignees, and dependencies must exist in the database
- Module 2 (Assignees & Dependencies) must be complete — `task_assignees` and `task_dependencies` tables are required for scheduling logic and cascade
- Chat (Module 6) must be merged — it occupies migration `004_chat_schema.sql`, so this module's migration is `005`

---

## Overview

Module 7 introduces two major features to Keil HQ:

1. **Personal Calendar** — Each assigned user can time-block a task on their own calendar. Multiple users can schedule the same task at different times. The calendar is powered by FullCalendar (already installed) and backed by a new `task_schedules` table.

2. **Gantt Timeline** — Admins can view and drag task deadlines on a project timeline. Moving a task auto-shifts all assignees' calendar blocks. Resizing purges out-of-bounds blocks. Delaying a task's due date cascades to all dependent tasks automatically.

**Branch Names:**
- `feature/schedule-be` — Dev A (Backend)
- `feature/schedule-fe` — Dev B (Frontend)

**Merge target:** `develop` → owner reviews → `main`

---

## Context for Developers

### What already exists

**Backend**
- `tasks` table stores `start_date` and `due_date` as nullable `TIMESTAMPTZ`
- `task_assignees` table links users to tasks — used for assignee-only scheduling enforcement
- `task_dependencies` table stores blocking relationships — used for cascade logic
- `auth.middleware.ts` attaches both `req.user` (`{ id, email, name, created_at }`) and `req.workspaceId` to every protected request
- `workspaceRepository.isMember(workspaceId, userId)` exists and can be used for cross-workspace checks
- `taskRepository.update(id, data, client?)` exists and accepts a `PoolClient` for transactional updates
- `BaseRepository` pattern is established — `schedule.repository.ts` must extend it
- `ApiResponse` and `ApiError` utilities exist in `src/utils/`
- `catchAsync` wrapper exists in `src/utils/catchAsync.ts` — all controllers must use it

**Frontend**
- `SchedulePage.tsx` already exists at `frontend/src/components/SchedulePage.tsx` — built with mock data, uses `TaskSchedulePane` and `TaskTimelinePane`. **Do NOT recreate it.**
- `TaskSchedulePane.tsx` already exists at `frontend/src/components/tasks/TaskSchedulePane.tsx` — FullCalendar fully implemented with drag-drop, slot selection, event rendering, and conflict detection. **Wire it, do not rewrite it.**
- `TaskTimelinePane.tsx` already exists at `frontend/src/components/tasks/TaskTimelinePane.tsx` — `frappe-gantt` fully implemented with view mode switching and custom popups. **Wire it, do not rewrite it.**
- FullCalendar packages (`@fullcalendar/react`, `@fullcalendar/daygrid`, `@fullcalendar/timegrid`, `@fullcalendar/interaction`, `@fullcalendar/list`) are **already installed**
- `frappe-gantt` is **already installed** — do NOT install `gantt-task-react`
- `App.tsx` already has a `/schedule` route pointing to `SchedulePage`
- `date-fns` is already installed — use `startOfToday`, `endOfToday`, `format`, `formatDistanceToNow`
- `useTask(taskId)` hook already exists in `src/hooks/api/useTasks.ts` from Module 1
- `useTasks(filters?)` hook already exists in `src/hooks/api/useTasks.ts` from Module 1
- `useWorkspace()` context hook already exists — provides `workspaceId` and `workspaceRole`
- `NextEventCard.tsx` exists at `frontend/src/components/dashboard/NextEventCard.tsx` — currently a static placeholder with a `// TODO` comment. This module wires it.

### What is missing

**Backend**
- `task_schedules` table (migration `005`)
- `backend/src/utils/validateTaskDates.ts` — two separate validator functions
- `backend/src/repositories/schedule.repository.ts` — all schedule DB queries
- `backend/src/services/schedule.service.ts` — all business logic
- `backend/src/controllers/schedule.controller.ts` — all 6 handlers
- `backend/src/routes/schedule.routes.ts` — route declarations
- One-line addition to `backend/src/routes/v1.routes.ts`
- One-line addition to `backend/src/services/task.service.ts` (ghost block cleanup)

**Frontend**
- `frontend/src/hooks/api/useSchedule.ts` — all 6 schedule hooks
- `frontend/src/components/schedule/ScheduleTaskModal.tsx` — new modal component
- Wiring of `SchedulePage.tsx`, `TaskSchedulePane.tsx`, `TaskTimelinePane.tsx` to real APIs
- Wiring of `NextEventCard.tsx` and `Dashboard.tsx`
- 3 new types in `frontend/src/types/task.ts`

### Architectural Decisions

1. **Multi-User Calendars:** Each assigned user can schedule the same task at different times via the `task_schedules` table. One row per `(task_id, user_id)` pair — one contiguous block per user per task.

2. **Mandatory Deadlines (App-Level):** `start_date` and `due_date` remain nullable in the DB to avoid breaking existing tasks. The schedule service enforces them at the application layer: if `start_date` is null, it is automatically defaulted to today and persisted. If `due_date` is null, the API throws `400` with a user-facing message asking them to set a due date first.

3. **Status Sync:** Scheduling a `backlog` task automatically moves it to `todo` in the same transaction.

4. **Move vs Resize (Gantt):** A MOVE is when both `start_date` and `due_date` change by the exact same delta — all `task_schedules` blocks shift by that delta. A RESIZE is when only one edge changes or they change by different amounts — blocks are NOT shifted, but any that now fall outside the new bounds are deleted.

5. **Cascade (Dependencies):** Cascade only triggers when `due_date` actually changes (`end_delta !== 0`). A `start_date`-only change never cascades. When Task A's `due_date` is delayed, all tasks that depend on A (queried via `task_dependencies WHERE depends_on_task_id = taskA.id`) are pushed forward by the same `end_delta` if their `start_date` now overlaps Task A's new `due_date`. This recurses up to 15 levels deep. Tasks with `status === 'done'` are completely frozen — skipped in all cascade, shift, and purge logic.

6. **Ghost Block Prevention:** When a user is unassigned from a task, their `task_schedules` record is deleted atomically in the same transaction as the unassign inside `task.service.ts`.

7. **Subtask Boundary Enforcement:** A subtask's scheduled block cannot exceed its parent task's `start_date`/`due_date` bounds.

8. **Assignee-Only Scheduling:** Only users in `task_assignees` for a given task may call the timeblock endpoint. Non-assignees receive `403`.

9. **Gantt Null Date Handling:** Tasks with null `due_date` are excluded from the Gantt response entirely. Tasks with null `start_date` are included but `start_date` is returned as `CURRENT_DATE` in the response only — not persisted to the DB.

---

## Shared Validation Layer

Two separate validator functions must be created in `backend/src/utils/validateTaskDates.ts`. Do not merge them — their error messages and purposes are different.

```typescript
// backend/src/utils/validateTaskDates.ts
import { ApiError } from './ApiError';

/**
 * Validator 1 — Task date presence check.
 * Called on the task object AFTER start_date has been defaulted to NOW() if null.
 * Throws user-facing 400 if due_date is null.
 */
export function validateTaskHasDates(
  start: Date | string | null | undefined,
  due: Date | string | null | undefined
): void {
  if (!due) throw new ApiError(400, 'This task has no due date. Please set a due date before scheduling it on the calendar.');
  if (!start) throw new ApiError(400, 'start_date is missing. This should have been defaulted — check the service layer.');
  const startMs = new Date(start).getTime();
  const dueMs = new Date(due).getTime();
  if (isNaN(startMs)) throw new ApiError(400, 'Invalid start_date format on task');
  if (isNaN(dueMs)) throw new ApiError(400, 'Invalid due_date format on task');
  if (dueMs < startMs) throw new ApiError(400, 'Task due_date must be on or after start_date');
}

/**
 * Validator 2 — Timeblock range check.
 * Called on the incoming request body (scheduled_start / scheduled_end), not on the task.
 * Also enforces the 15-minute minimum duration rule.
 */
export function validateTimeblockRange(
  scheduledStart: string | undefined,
  scheduledEnd: string | undefined
): void {
  if (!scheduledStart) throw new ApiError(400, 'scheduled_start is required');
  if (!scheduledEnd) throw new ApiError(400, 'scheduled_end is required');
  const startMs = new Date(scheduledStart).getTime();
  const endMs = new Date(scheduledEnd).getTime();
  if (isNaN(startMs)) throw new ApiError(400, 'Invalid scheduled_start format');
  if (isNaN(endMs)) throw new ApiError(400, 'Invalid scheduled_end format');
  if (endMs <= startMs) throw new ApiError(400, 'scheduled_end must be after scheduled_start');
  if (endMs - startMs < 15 * 60 * 1000) throw new ApiError(400, 'Timeblock must be at least 15 minutes long');
}
```

---

## Frontend Type Additions

Dev B must add these three types to `frontend/src/types/task.ts`. Do NOT remove or rename any existing types — only add.

```typescript
// Add to frontend/src/types/task.ts

// Returned by GET /api/v1/schedule/calendar
export type ScheduleBlockDTO = {
  id: string;
  task_id: string;
  task_title: string;
  task_status: TaskStatus;
  scheduled_start: string; // ISO
  scheduled_end: string;   // ISO
};

// Returned by GET /api/v1/schedule/gantt
export type GanttTaskDTO = {
  id: string;
  title: string;
  status: TaskStatus;
  start_date: string; // ISO — never null (backend defaults null start_date to today in response)
  due_date: string;   // ISO — never null (backend excludes tasks with null due_date)
  parent_task_id: string | null;
  dependencies: string[]; // array of task UUIDs this task depends on
};

// Returned by GET /api/v1/schedule/unscheduled
export type UnscheduledTaskDTO = {
  id: string;
  title: string;
  start_date: string | null;
  due_date: string | null;
  status: TaskStatus;
  priority: TaskPriority;
};
```

---

## API Contract

Both developers must agree on and freeze these shapes before writing any code. Existing APIs must remain untouched.

### 1. Database Migration — `005_schedule_schema.sql`

```sql
-- Migration: 005_schedule_schema.sql
-- NOTE: 004_chat_schema.sql is already taken by the Chat module. This is 005.

CREATE TABLE task_schedules (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID        NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  task_id         UUID        NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id         UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  scheduled_start TIMESTAMPTZ NOT NULL,
  scheduled_end   TIMESTAMPTZ NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW(),

  -- One contiguous block per user per task
  UNIQUE(task_id, user_id),

  -- Block must have positive duration (DB-level safety net)
  CONSTRAINT task_schedules_valid_range CHECK (scheduled_end > scheduled_start)
);

CREATE INDEX idx_task_schedules_workspace_id ON task_schedules(workspace_id);
CREATE INDEX idx_task_schedules_user_id      ON task_schedules(user_id);
CREATE INDEX idx_task_schedules_task_id      ON task_schedules(task_id);

-- tasks.start_date and tasks.due_date remain nullable at the DB level.
-- Null handling is enforced at the application layer in schedule.service.ts.
-- Do NOT add NOT NULL constraints to those columns.
```

### 2. GET /api/v1/schedule/calendar

**Auth:** Required  
**Query params:**
- `start_range` (ISO Date, **required**)
- `end_range` (ISO Date, **required**)
- `user_id` (UUID, optional — defaults to `req.user.id`)

**Backend Logic:**
1. Validate `start_range` and `end_range` are present and parseable. Throw `400` if missing or invalid.
2. If `user_id` is provided, verify it exists in `workspace_members` with `workspace_id = req.workspaceId`. Throw `403` if not — prevents cross-workspace calendar snooping.
3. Query `task_schedules` joined with `tasks`: `WHERE ts.workspace_id = $workspaceId AND ts.user_id = $userId AND ts.scheduled_start < $end_range AND ts.scheduled_end > $start_range AND t.deleted_at IS NULL`.

**Response 200:**
```json
[
  {
    "id": "uuid",
    "task_id": "uuid",
    "task_title": "string",
    "task_status": "backlog | todo | in-progress | done",
    "scheduled_start": "ISO string",
    "scheduled_end": "ISO string"
  }
]
```

### 3. GET /api/v1/schedule/unscheduled

**Auth:** Required  
**Query params:**
- `limit` (number, default `50`, max `100`)
- `offset` (number, default `0`)
- `search` (string, optional) — case-insensitive title filter

**Backend Logic:**
```sql
SELECT t.id, t.title, t.start_date, t.due_date, t.status, t.priority,
       COUNT(*) OVER() AS total_count
FROM tasks t
INNER JOIN task_assignees ta ON t.id = ta.task_id
LEFT  JOIN task_schedules ts ON t.id = ts.task_id AND ts.user_id = $userId
WHERE ta.user_id     = $userId
  AND t.workspace_id = $workspaceId
  AND t.deleted_at   IS NULL
  AND ts.id          IS NULL
  AND ($search IS NULL OR t.title ILIKE '%' || $search || '%')
ORDER BY t.due_date ASC NULLS LAST
LIMIT $limit OFFSET $offset;
```

**Response 200:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "title": "string",
      "start_date": "ISO string or null",
      "due_date": "ISO string or null",
      "status": "backlog | todo | in-progress | done",
      "priority": "low | medium | high | urgent"
    }
  ],
  "pagination": { "limit": 50, "offset": 0, "total": 42 }
}
```

### 4. PUT /api/v1/schedule/tasks/:taskId/timeblock

**Auth:** Required  
**Request body:** `{ "scheduled_start": "ISO string", "scheduled_end": "ISO string" }`

**Backend Logic (all steps inside one transaction):**
1. Fetch task. Verify it exists and `task.workspace_id === req.workspaceId`. Throw `404` if not.
2. **Null date handling:** If `task.start_date` is null, set it to `NOW()` and persist via `taskRepository.update(task.id, { start_date: new Date() }, client)`. If `task.due_date` is null, throw `400`: `"This task has no due date. Please set a due date before scheduling it on the calendar."` Stop here.
3. Call `validateTaskHasDates(task.start_date, task.due_date)`.
4. Query `task_assignees WHERE task_id = :taskId AND user_id = req.user.id`. Throw `403` if not found.
5. Call `validateTimeblockRange(scheduled_start, scheduled_end)` — checks format, order, and 15-minute minimum.
6. **Boundary check (timestamp-level):** If `new Date(scheduled_start) < new Date(task.start_date)` OR `new Date(scheduled_end) > new Date(task.due_date)`, throw `400 Bad Request`.
7. **Subtask boundary check:** If `task.parent_task_id` is set, fetch parent task. If `new Date(scheduled_start) < new Date(parent.start_date)` OR `new Date(scheduled_end) > new Date(parent.due_date)`, throw `400 Bad Request`.
8. If `task.status === 'backlog'`, update `task.status = 'todo'` via `taskRepository.updateStatus(task.id, 'todo', client)`.
9. Upsert: `INSERT INTO task_schedules ... ON CONFLICT (task_id, user_id) DO UPDATE SET scheduled_start = EXCLUDED.scheduled_start, scheduled_end = EXCLUDED.scheduled_end`.

**Response 200:** Updated `ScheduleBlockDTO`.

### 5. DELETE /api/v1/schedule/tasks/:taskId/timeblock

**Auth:** Required  
**Backend Logic:** `DELETE FROM task_schedules WHERE task_id = :taskId AND user_id = req.user.id AND workspace_id = req.workspaceId`. Does not revert task status.  
**Response 200:** `{ "success": true, "data": null, "message": "Timeblock removed" }`

### 6. GET /api/v1/schedule/gantt

**Auth:** Required  
**Query params:**
- `scope` (`"workspace" | "user"`, **required**)
- `project_id` (UUID, optional — filters to a specific parent task tree)

**Backend Logic:**
- Base filter: `WHERE tasks.deleted_at IS NULL AND tasks.due_date IS NOT NULL AND tasks.workspace_id = $workspaceId`
- Tasks with null `due_date` are excluded entirely — the Gantt library requires valid date ranges
- Tasks with null `start_date` are included but `start_date` is returned as `CURRENT_DATE` in the response — do NOT persist this to the DB
- When `scope = "user"`: add `AND tasks.id IN (SELECT task_id FROM task_assignees WHERE user_id = $userId)`
- When `project_id` is provided: add `AND (tasks.id = $projectId OR tasks.parent_task_id = $projectId)`
- For each task, return its `dependencies` as an array of `depends_on_task_id` values from `task_dependencies`

**Response 200:**
```json
[
  {
    "id": "uuid",
    "title": "string",
    "status": "backlog | todo | in-progress | done",
    "start_date": "ISO string",
    "due_date": "ISO string",
    "parent_task_id": "uuid or null",
    "dependencies": ["uuid", "uuid"]
  }
]
```

### 7. PATCH /api/v1/schedule/tasks/:id/deadline

**Auth:** Required (Admin or Owner only)  
**Request body:** `{ "start_date": "ISO string", "due_date": "ISO string" }`

**Backend Logic:**
1. Verify `req.user` has `admin` or `owner` role in `workspace_members` for `req.workspaceId`. Throw `403` if not.
2. Both `start_date` and `due_date` are required. Validate format and order (`due_date >= start_date`). Throw `400` if invalid.
3. Fetch task. If `task.status === 'done'`, return `200` immediately with no changes — completed tasks are frozen.
4. Compute deltas: `start_delta = new Date(start_date) - new Date(task.start_date)` (ms), `end_delta = new Date(due_date) - new Date(task.due_date)` (ms).
5. Update task dates: `UPDATE tasks SET start_date = $1, due_date = $2 WHERE id = $3`.
6. **If MOVE** (`start_delta === end_delta`): `UPDATE task_schedules SET scheduled_start = scheduled_start + $delta, scheduled_end = scheduled_end + $delta WHERE task_id = $taskId`.
7. **Purge** (runs after both MOVE and RESIZE): `DELETE FROM task_schedules WHERE task_id = $taskId AND (scheduled_start < $new_start_date OR scheduled_end > $new_due_date)`.
8. **Cascade** (only when `end_delta !== 0`): Query `SELECT task_id FROM task_dependencies WHERE depends_on_task_id = :taskId`. For each dependent task where `new_due_date >= dependent.start_date`, push that dependent's `start_date` and `due_date` forward by `end_delta`. Recurse up to **15 levels deep**. Skip tasks where `status === 'done'`. Run purge (step 7) for each cascaded task. Collect all cascaded task IDs.

**Response 200:**
```json
{
  "success": true,
  "data": {
    "updated_task": { "id": "uuid", "start_date": "ISO string", "due_date": "ISO string" },
    "cascaded_task_ids": ["uuid", "uuid"]
  },
  "message": "Task deadline updated"
}
```
`cascaded_task_ids` is `[]` when no cascade occurred.

---

## Dev A — Backend Deliverables

> Branch: `feature/schedule-be`

### Task 1 — Migration

- [x] Create `backend/src/migrations/005_schedule_schema.sql` with the exact SQL from the API Contract section above
- [x] Do NOT add `NOT NULL` to `tasks.start_date` or `tasks.due_date` — they remain nullable

### Task 2 — Shared Validators

- [x] Create `backend/src/utils/validateTaskDates.ts`
- [x] Export `validateTaskHasDates(start, due)` — see Shared Validation Layer section for full implementation
- [x] Export `validateTimeblockRange(scheduledStart, scheduledEnd)` — see Shared Validation Layer section for full implementation
- [x] Do NOT merge these into one function — they have different error messages and call sites

### Task 3 — Repository

File: `backend/src/repositories/schedule.repository.ts`

- [ ] Create the file extending `BaseRepository` — follow the same pattern as `task.repository.ts`
- [ ] Implement `upsertTimeblock(taskId: string, userId: string, workspaceId: string, start: Date, end: Date, client
---

## Developer A — Backend

> Branch: `feature/schedule-be`

### Setup & Migrations
- [x] Create `backend/src/migrations/005_schedule_schema.sql` — `task_schedules` table as defined in the API Contract above. Do NOT add `NOT NULL` to `tasks.start_date` or `tasks.due_date`. Migration number is `005` because `004` is taken by `004_chat_schema.sql`.
- [x] Create `backend/src/utils/validateTaskDates.ts` — two separate exported functions: `validateTaskHasDates` and `validateTimeblockRange` exactly as defined in the Shared Validation Layer section above.

### Repository — `backend/src/repositories/schedule.repository.ts`
- [x] Create the file extending `BaseRepository` (same pattern as `task.repository.ts`).
- [x] `upsertTimeblock(taskId, userId, workspaceId, start, end, client?)` — `INSERT INTO task_schedules ... ON CONFLICT (task_id, user_id) DO UPDATE SET scheduled_start = EXCLUDED.scheduled_start, scheduled_end = EXCLUDED.scheduled_end`.
- [x] `deleteTimeblock(taskId, userId, workspaceId, client?)` — `DELETE FROM task_schedules WHERE task_id = $1 AND user_id = $2 AND workspace_id = $3`.
- [x] `deleteTimeblocksByUser(taskId, userId, client?)` — used by `task.service.ts` for ghost block cleanup on unassign. `DELETE FROM task_schedules WHERE task_id = $1 AND user_id = $2`.
- [x] `shiftTimeblocks(taskId, deltaMs, client?)` — `UPDATE task_schedules SET scheduled_start = scheduled_start + ($deltaMs || ' milliseconds')::interval, scheduled_end = scheduled_end + ($deltaMs || ' milliseconds')::interval WHERE task_id = $1`.
- [x] `purgeOutOfBoundsTimeblocks(taskId, newStart, newEnd, client?)` — `DELETE FROM task_schedules WHERE task_id = $1 AND (scheduled_start < $2 OR scheduled_end > $3)`.
- [x] `getCalendarBlocks(userId, workspaceId, startRange, endRange)` — join `task_schedules` with `tasks`, filter by workspace + user + date overlap + `tasks.deleted_at IS NULL`. Return `ScheduleBlockDTO` shape.
- [x] `getUnscheduledTasks(userId, workspaceId, limit, offset, search?)` — LEFT JOIN query with `ILIKE` search and `COUNT(*) OVER()` window function for total count.
- [x] `getGanttTasks(workspaceId, scope, userId?, projectId?)` — join `tasks` with `task_dependencies`. Exclude `due_date IS NULL`. Return `start_date` as `COALESCE(start_date, CURRENT_DATE)` in the SELECT — do NOT update the DB row.
- [x] **Do NOT export from `repositories/index.ts`** — import directly by path everywhere to avoid circular dependencies.

### Service — `backend/src/services/schedule.service.ts`
- [x] Import `ScheduleRepository` directly: `import { ScheduleRepository } from '../repositories/schedule.repository'`. Instantiate at the top: `const scheduleRepository = new ScheduleRepository()`. Do NOT use `repositories/index.ts`.
- [x] Also import `taskRepository` from `repositories/index.ts` (already exported there) — needed for task fetches and status updates inside transactions.
- [x] `getCalendarTasks(userId, workspaceId, startRange, endRange, targetUserId?)`:
  - If `targetUserId` provided, verify it's in `workspace_members` with `workspaceId` using `workspaceRepository.isMember(workspaceId, targetUserId)`. Throw `403` if not.
  - Call `scheduleRepository.getCalendarBlocks(targetUserId ?? userId, workspaceId, startRange, endRange)`.
- [x] `getUnscheduledTasks(userId, workspaceId, limit, offset, search?)` — call repository, return `{ data, pagination }`.
- [x] `updateTaskTimeblock(taskId, userId, workspaceId, scheduledStart, scheduledEnd)` — full validation chain in one transaction (see API Contract step-by-step logic for endpoint 4).
- [x] `deleteTaskTimeblock(taskId, userId, workspaceId)` — call `scheduleRepository.deleteTimeblock`.
- [x] `getGanttTasks(workspaceId, scope, userId?, projectId?)` — call repository.
- [x] `updateTaskDeadline(taskId, userId, workspaceId, newStartDate, newDueDate)`:
  - Verify admin/owner role via `workspaceRepository.getMembers` or a direct query.
  - Fetch task. If `status === 'done'`, return early with `{ updated_task: task, cascaded_task_ids: [] }`.
  - Compute `start_delta` and `end_delta`.
  - Update task dates.
  - If MOVE: call `scheduleRepository.shiftTimeblocks(taskId, start_delta, client)`.
  - Always run purge: `scheduleRepository.purgeOutOfBoundsTimeblocks(taskId, newStartDate, newDueDate, client)`.
  - If `end_delta !== 0`: run recursive cascade (max depth 15, skip `done` tasks, purge each cascaded task). Collect `cascaded_task_ids`.
  - Return `{ updated_task, cascaded_task_ids }`.

### Controller — `backend/src/controllers/schedule.controller.ts`
- [x] All controllers must use `catchAsync` wrapper — no manual try/catch.
- [x] All controllers must return `new ApiResponse(statusCode, data, message)`.
- [x] `getCalendarTasks`: Extract `start_range`, `end_range`, `user_id` from `req.query`. Validate `start_range` and `end_range` are present and parseable — throw `400` if not. Call service.
- [x] `getUnscheduledTasks`: Extract `limit` (default 50, max 100), `offset` (default 0), `search` from `req.query`. Call service.
- [x] `updateTaskTimeblock`: Extract `taskId` from `req.params`, `scheduled_start` and `scheduled_end` from `req.body`. Call service.
- [x] `deleteTaskTimeblock`: Extract `taskId` from `req.params`. Call service.
- [x] `getGanttTasks`: Extract `scope` and `project_id` from `req.query`. Validate `scope` is `"workspace"` or `"user"` — throw `400` if not. Call service.
- [x] `updateTaskDeadline`: Extract `id` from `req.params`, `start_date` and `due_date` from `req.body`. Call service.

### Routes — `backend/src/routes/schedule.routes.ts`
- [x] Create the file. Apply `protect` middleware to all routes.
- [x] `GET  /calendar` → `getCalendarTasks`
- [x] `GET  /unscheduled` → `getUnscheduledTasks`
- [x] `PUT  /tasks/:taskId/timeblock` → `updateTaskTimeblock`
- [x] `DELETE /tasks/:taskId/timeblock` → `deleteTaskTimeblock`
- [x] `GET  /gantt` → `getGanttTasks`
- [x] `PATCH /tasks/:id/deadline` → `updateTaskDeadline`
- [x] Register in `backend/src/routes/v1.routes.ts`: add `router.use("/schedule", scheduleRoutes)` — this is the only change to `v1.routes.ts`.

### Core Task Hook Fix — `backend/src/services/task.service.ts`
- [x] At the top of the file, add: `import { ScheduleRepository } from '../repositories/schedule.repository'` and `const scheduleRepository = new ScheduleRepository()`. Do NOT import via `repositories/index.ts`.
- [x] Inside the existing `removeUserFromTask` function, inside the existing `executeInTransaction` callback, after `taskAssigneeRepository.unassign(taskId, assigneeUserId, client)`, add one line: `await scheduleRepository.deleteTimeblocksByUser(taskId, assigneeUserId, client)`.
- [x] This is the **only** change to `task.service.ts`. All other existing logic stays untouched.

---

## Developer B — Frontend

> Branch: `feature/schedule-fe`

### IMPORTANT — What already exists, do NOT recreate

| File | Current state | Your job |
|---|---|---|
| `frontend/src/components/SchedulePage.tsx` | Built with `mockTasks` and `mockCalendarBlocks` | Replace mock data with real API hooks |
| `frontend/src/components/tasks/TaskSchedulePane.tsx` | FullCalendar fully implemented with drag-drop, resize, conflict detection | Wire `onTaskSchedule` callback to `useUpdateTaskTimeblock` mutation; add error revert |
| `frontend/src/components/tasks/TaskTimelinePane.tsx` | `frappe-gantt` fully implemented with view modes and custom popups | Add admin-only editing, wire `on_date_change` to `useUpdateTaskDeadline` |
| `frontend/src/components/dashboard/NextEventCard.tsx` | Static placeholder with `// TODO` comment | Accept props, wire to `useCalendarTasks` |
| `frontend/src/components/Dashboard.tsx` | Already calls `useDashboard()` and renders cards | Add `useCalendarTasks` for today, pass to `NextEventCard` |

### Library note
- FullCalendar packages are **already installed** — do NOT run install commands.
- `frappe-gantt` is **already installed** — do NOT install `gantt-task-react`. The project uses `frappe-gantt`.
- `zustand` is NOT needed — the project uses React Query + existing context.
- `date-fns` is already installed — use `startOfToday`, `endOfToday`, `format`, `formatDistanceToNow`.

### Step 1 — Add types to `frontend/src/types/task.ts`
- [ ] Add `ScheduleBlockDTO`, `GanttTaskDTO`, and `UnscheduledTaskDTO` as defined in the Frontend Type Additions section above.
- [ ] Do NOT remove or modify any existing types — only add.

### Step 2 — Create `frontend/src/hooks/api/useSchedule.ts`
- [ ] `useCalendarTasks({ start_range, end_range, user_id? })`:
  - `GET /api/v1/schedule/calendar`
  - `enabled: !!start_range && !!end_range`
  - Query key: `["schedule", "calendar", workspaceId, start_range, end_range, user_id]`
  - Returns `ScheduleBlockDTO[]`
- [ ] `useUnscheduledTasks({ limit = 50, offset = 0, search? })`:
  - `GET /api/v1/schedule/unscheduled`
  - Query key: `["schedule", "unscheduled", workspaceId, { limit, offset, search }]`
  - Returns `{ data: UnscheduledTaskDTO[], pagination: { limit, offset, total } }`
- [ ] `useUpdateTaskTimeblock()`:
  - `PUT /api/v1/schedule/tasks/:taskId/timeblock`
  - On `400`/`403`: show error Toast with the server's error message (from `error.response.data.message`)
  - On success: invalidate `["schedule", "calendar", workspaceId]` and `["schedule", "unscheduled", workspaceId]`
- [ ] `useDeleteTaskTimeblock()`:
  - `DELETE /api/v1/schedule/tasks/:taskId/timeblock`
  - On success: invalidate `["schedule", "calendar", workspaceId]` and `["schedule", "unscheduled", workspaceId]`
- [ ] `useGanttTasks({ scope, project_id? })`:
  - `GET /api/v1/schedule/gantt`
  - Query key: `["schedule", "gantt", workspaceId, scope, project_id]`
  - Returns `GanttTaskDTO[]`
- [ ] `useUpdateTaskDeadline()`:
  - `PATCH /api/v1/schedule/tasks/:id/deadline`
  - On success: (1) invalidate `["schedule", "gantt", workspaceId]` so Gantt re-fetches updated dates, (2) read `cascaded_task_ids` from `response.data.cascaded_task_ids` — if `length > 0`, show Toast: `"<N> dependent task(s) were automatically shifted."`

### Step 3 — Create `frontend/src/components/schedule/ScheduleTaskModal.tsx`
New component — does not exist yet.

- [ ] Props: `open: boolean`, `onClose: () => void`, `defaultStart: string`, `defaultEnd: string`, `onScheduled: () => void`
- [ ] Search input — debounced 300ms — calls `useUnscheduledTasks({ search })`. Show results in a scrollable list.
- [ ] `scheduled_start` and `scheduled_end` datetime fields defaulting to `defaultStart`/`defaultEnd`.
- [ ] When a task is selected from the list:
  - If `task.parent_task_id` is set, call `useTask(task.parent_task_id)` from `src/hooks/api/useTasks.ts` and show: `"Parent task due: <formatted date>"` as a reference label.
  - If `task.due_date` is null, show inline error: `"This task has no due date. Please set a due date in the task detail before scheduling."` and disable the submit button.
- [ ] **Hard block + warning:** If the user edits `scheduled_start`/`scheduled_end` to exceed `task.start_date`/`task.due_date` bounds (or parent bounds for subtasks), show an inline warning and disable submit. Submission is blocked until times are within bounds.
- [ ] On valid submit: call `useUpdateTaskTimeblock({ taskId: selectedTask.id, scheduled_start, scheduled_end })`. On success: call `onScheduled()` and `onClose()`.

### Step 4 — Wire `frontend/src/components/SchedulePage.tsx`
- [ ] Remove `import { mockTasks } from "@/data/mockTasks"` and the `mockCalendarBlocks` array.
- [ ] Replace `useState<Task[]>(mockTasks)` with `const { data: tasks = [] } = useTasks()` from `src/hooks/api/useTasks.ts`.
- [ ] Add state for the current calendar view window: `const [calendarRange, setCalendarRange] = useState({ start: startOfToday().toISOString(), end: endOfToday().toISOString() })`. Update it when FullCalendar's `datesSet` callback fires (already wired in `TaskSchedulePane` via `onViewChange` — extend this to also pass the date range).
- [ ] Call `useCalendarTasks({ start_range: calendarRange.start, end_range: calendarRange.end })`. Map the result to `CalendarBlock[]` for the `blocks` prop: `scheduleBlocks.map(b => ({ id: b.id, type: 'task_slot' as CalendarBlockType, title: b.task_title, startISO: b.scheduled_start, endISO: b.scheduled_end, taskId: b.task_id }))`.
- [ ] Wire `onTaskSchedule` callback: `(taskId, startISO, endISO) => updateTaskTimeblock({ taskId, scheduled_start: startISO, scheduled_end: endISO })`.
- [ ] Add `ScheduleTaskModal` state: `const [modalOpen, setModalOpen] = useState(false)` and `const [slotRange, setSlotRange] = useState({ start: '', end: '' })`. Open the modal when FullCalendar's `select` callback fires — pass the selected slot's start/end as `defaultStart`/`defaultEnd`. The `select` callback is already wired in `TaskSchedulePane` — extend it to call a new `onSlotSelect` prop.
- [ ] Pass `useGanttTasks({ scope: 'workspace' })` data to `TaskTimelinePane` as the `tasks` prop. Map `GanttTaskDTO` to the minimum `Task` shape the component needs: `{ id, title, status, plannedStartISO: start_date, plannedEndISO: due_date, dependencies: dependencies.map(depId => ({ id: depId, title: '', status: 'todo' as TaskStatus, priority: 'medium' as TaskPriority, due_date: null })), projectId: '', projectTitle: '', owner: '', assignees: [], labels: [], dueDateISO: due_date, objective: '', success_criteria: '', context: [], subtasks: [], comments: [] }`.

### Step 5 — Wire `frontend/src/components/tasks/TaskSchedulePane.tsx`
- [ ] Add `onSlotSelect?: (start: string, end: string) => void` to the `Props` type.
- [ ] In the `select` callback (already exists), call `onSlotSelect?.(info.startStr, info.endStr)` in addition to the existing `setSelectedBlockId("")`.
- [ ] Add error handling for the `onTaskSchedule` callback: the callback is now async (returns a promise from the mutation). If it throws/rejects, call `info.revert()` on the relevant FullCalendar event info and show a Toast with the error message. This applies to `eventReceive`, `eventDrop`, and `eventResize` handlers.

### Step 6 — Wire `frontend/src/components/tasks/TaskTimelinePane.tsx`
- [ ] Add `onDeadlineChange?: (taskId: string, newStart: string, newEnd: string) => void` to the `Props` type.
- [ ] In the `frappe-gantt` options, add `on_date_change: (task, start, end) => { onDeadlineChange?.(task.id, start.toISOString(), end.toISOString()) }`.
- [ ] Add `readonly` prop support: accept `isReadOnly?: boolean` in props. If `true`, pass `readonly: true` to `frappe-gantt` options to disable drag-and-drop.
- [ ] The `is-done` custom class is already applied via `custom_class` in `toGanttTask` — verify `calendar-styles.css` has a `.is-done` style that grays out the bar. If not, add: `.is-done .bar { opacity: 0.4; pointer-events: none; }` to `calendar-styles.css`.

### Step 7 — Wire `frontend/src/components/dashboard/NextEventCard.tsx`
- [ ] Remove the `// TODO: Wire in future module` comment.
- [ ] Change the function signature to accept props: `function NextEventCard({ block, isLoading }: { block: ScheduleBlockDTO | null; isLoading: boolean })`.
- [ ] If `isLoading`: render a skeleton (two grey rounded bars matching the existing card height).
- [ ] If `block` is null: show `"No events scheduled for today"` in muted text.
- [ ] If `block` exists: show `block.task_title` as the title and `format(new Date(block.scheduled_start), 'h:mm a')` as the time (e.g. `"Starts at 2:30 PM"`).

### Step 8 — Update `frontend/src/components/Dashboard.tsx`
- [ ] Import `useCalendarTasks` from `src/hooks/api/useSchedule.ts` and `startOfToday`/`endOfToday` from `date-fns`.
- [ ] Add: `const { data: todayBlocks, isLoading: calendarLoading } = useCalendarTasks({ start_range: startOfToday().toISOString(), end_range: endOfToday().toISOString() })`.
- [ ] Update `<NextEventCard />` to `<NextEventCard block={todayBlocks?.[0] ?? null} isLoading={calendarLoading} />`.
- [ ] All other cards (`CurrentFocusCard`, `ImmediateBlockersCard`, `UpNextCard`, `NeedsReplyCard`) are untouched.

---

## Files Modified Summary

### Backend
| File | Change |
|---|---|
| `backend/src/migrations/005_schedule_schema.sql` | **New file** — `task_schedules` table (migration 005, after chat's 004) |
| `backend/src/utils/validateTaskDates.ts` | **New file** — `validateTaskHasDates` and `validateTimeblockRange` |
| `backend/src/repositories/schedule.repository.ts` | **New file** — All schedule DB queries. NOT exported from `repositories/index.ts` |
| `backend/src/routes/schedule.routes.ts` | **New file** — All 6 routes with `protect` middleware |
| `backend/src/routes/v1.routes.ts` | Add one line: `router.use("/schedule", scheduleRoutes)` |
| `backend/src/controllers/schedule.controller.ts` | **New file** — All 6 handlers using `catchAsync` and `ApiResponse` |
| `backend/src/services/schedule.service.ts` | **New file** — Business logic, null date handling, boundaries, cascade math |
| `backend/src/services/task.service.ts` | Add direct import of `ScheduleRepository` + one line in `removeUserFromTask` transaction |

### Frontend
| File | Change |
|---|---|
| `frontend/src/types/task.ts` | Add 3 new types: `ScheduleBlockDTO`, `GanttTaskDTO`, `UnscheduledTaskDTO` — no existing types removed |
| `frontend/src/hooks/api/useSchedule.ts` | **New file** — All 6 schedule hooks |
| `frontend/src/components/schedule/ScheduleTaskModal.tsx` | **New file** — Slot-selection modal with debounced search, boundary validation, no-due-date error |
| `frontend/src/components/SchedulePage.tsx` | Wire mock data → real hooks. Remove `mockTasks`/`mockCalendarBlocks`. Add `ScheduleTaskModal`. |
| `frontend/src/components/tasks/TaskSchedulePane.tsx` | Add `onSlotSelect` prop; add error revert + toast on failed `onTaskSchedule` |
| `frontend/src/components/tasks/TaskTimelinePane.tsx` | Add `onDeadlineChange` prop, `isReadOnly` prop, `on_date_change` callback, verify `is-done` CSS |
| `frontend/src/components/dashboard/NextEventCard.tsx` | Accept `block`/`isLoading` props, wire to real data, remove TODO comment |
| `frontend/src/components/Dashboard.tsx` | Add `useCalendarTasks` for today, pass result to `NextEventCard` |

---

## Integration Notes

### Does not break existing modules
- `task.service.ts` change is additive — one import + one line inside an existing transaction. All other existing logic stays untouched.
- `repositories/index.ts` is NOT modified — `scheduleRepository` is imported directly by path.
- `v1.routes.ts` gets one new `router.use` line — all existing routes untouched.
- Chat (`/api/v1/chat/*`) and schedule (`/api/v1/schedule/*`) are completely separate namespaces.
- Migration `005` runs after `004` — no conflict.
- `frontend/src/types/task.ts` — only additions, no removals. All existing components unaffected.
- `SchedulePage.tsx`, `TaskSchedulePane.tsx`, `TaskTimelinePane.tsx` — existing UI and layout preserved. Only data source changes from mock to real.
- `Dashboard.tsx` — only `NextEventCard` changes. All other cards untouched.

### Dev A / Dev B coordination points
- Dev B cannot test `useUpdateTaskTimeblock`, `useDeleteTaskTimeblock`, or `useUpdateTaskDeadline` until Dev A's backend is deployed. Use mock responses or `msw` during frontend development.
- The `ScheduleBlockDTO` shape in the API Contract section is the agreed contract — Dev A's response must match exactly, Dev B's hooks must consume exactly that shape.
- Dev B must NOT change the `TaskSchedulePane` or `TaskTimelinePane` component APIs (props) beyond what is specified in Steps 5 and 6 — `SchedulePage` is the primary file that changes how data flows into them.
- Both devs should agree on the `ScheduleBlockDTO` shape before Dev B starts Step 2.

---

## Acceptance Criteria

- [x] Migration `005_schedule_schema.sql` runs cleanly after `004_chat_schema.sql` with no conflicts.
- [x] `validateTaskHasDates` and `validateTimeblockRange` are two separate functions in `validateTaskDates.ts`.
- [ ] Scheduling a task with no `due_date` returns `400` with a user-facing message asking them to set a due date.
- [ ] Scheduling a task with no `start_date` automatically defaults it to today and proceeds.
- [ ] `GET /schedule/calendar` requires `start_range` and `end_range`; returns `400` if either is missing.
- [ ] `GET /schedule/unscheduled` returns paginated results (default limit 50) with `data` and `pagination` fields. `search` param filters by title case-insensitively.
- [ ] `ScheduleTaskModal` has a debounced search input that filters the unscheduled task dropdown.
- [ ] Boundary validation uses full `TIMESTAMPTZ` comparison, not date-only.
- [ ] Scheduling a subtask shows the parent `due_date` as a reference and hard-blocks submission if times exceed parent bounds.
- [ ] Only assigned users can schedule tasks — non-assignees receive `403`.
- [ ] Admins moving a task on Gantt auto-shifts all assignees' calendar blocks.
- [ ] Resizing a task on Gantt purges out-of-bounds calendar blocks but does not shift others.
- [ ] Cascade is only triggered when `due_date` changes (`end_delta !== 0`). A `start_date`-only change never cascades.
- [ ] Cascaded tasks shift by `end_delta`, preserving their original duration. Max depth 15. `done` tasks are skipped.
- [ ] `PATCH /deadline` response includes `cascaded_task_ids` (empty array if no cascade).
- [ ] Gantt query is invalidated after `useUpdateTaskDeadline` succeeds — chart re-renders with updated dates.
- [ ] `GET /schedule/gantt` excludes tasks with null `due_date`. Tasks with null `start_date` show today's date in the response without persisting it.
- [ ] Completed tasks (`status === 'done'`) are frozen and immune to all shifts and cascades.
- [ ] Removing an assignee atomically deletes their `task_schedules` record in the same transaction via `task.service.ts`. `scheduleRepository` is imported directly by path, not via `index.ts`.
- [ ] `NextEventCard` on the Dashboard shows today's first scheduled block. Shows empty state if none.
- [ ] `SchedulePage` renders real calendar data — no `mockTasks` or `mockCalendarBlocks` remain in production code paths.
- [ ] `TaskTimelinePane` is read-only for non-admin/non-owner users. Admin drag-and-drop triggers `useUpdateTaskDeadline`.
- [ ] Failed `useUpdateTaskTimeblock` calls revert the FullCalendar event to its original position and show a Toast with the server error message.

---

## Developer A — Backend

> Branch: `feature/schedule-be`

### Setup & Migrations
- [x] Create `backend/src/migrations/005_schedule_schema.sql` — `task_schedules` table as defined above. Do NOT add `NOT NULL` to `tasks.start_date` or `tasks.due_date`. Migration number is `005` because `004` is taken by `004_chat_schema.sql`.
- [x] Create `backend/src/utils/validateTaskDates.ts` — two separate exported functions: `validateTaskHasDates` and `validateTimeblockRange` exactly as defined in the Shared Validation Layer section above.

### Repository — `backend/src/repositories/schedule.repository.ts`
- [x] Create the file extending `BaseRepository` (same pattern as `task.repository.ts`).
- [x] `upsertTimeblock(taskId, userId, workspaceId, start, end, client?)` — `INSERT INTO task_schedules ... ON CONFLICT (task_id, user_id) DO UPDATE SET scheduled_start = EXCLUDED.scheduled_start, scheduled_end = EXCLUDED.scheduled_end`.
- [x] `deleteTimeblock(taskId, userId, workspaceId, client?)` — `DELETE FROM task_schedules WHERE task_id = $1 AND user_id = $2 AND workspace_id = $3`.
- [x] `deleteTimeblocksByUser(taskId, userId, client?)` — used by `task.service.ts` for ghost block cleanup. `DELETE FROM task_schedules WHERE task_id = $1 AND user_id = $2`.
- [x] `shiftTimeblocks(taskId, deltaMs, client?)` — shifts `scheduled_start` and `scheduled_end` for all users of a task by delta milliseconds using PostgreSQL interval arithmetic.
- [x] `purgeOutOfBoundsTimeblocks(taskId, newStart, newEnd, client?)` — `DELETE FROM task_schedules WHERE task_id = $1 AND (scheduled_start < $2 OR scheduled_end > $3)`.
- [x] `getCalendarBlocks(userId, workspaceId, startRange, endRange)` — join `task_schedules` with `tasks`, filter by workspace + user + date overlap + `tasks.deleted_at IS NULL`. Return `ScheduleBlockDTO` shape.
- [x] `getUnscheduledTasks(userId, workspaceId, limit, offset, search?)` — LEFT JOIN query with `ILIKE` search and `COUNT(*) OVER()` window function for total count.
- [x] `getGanttTasks(workspaceId, scope, userId?, projectId?)` — join `tasks` with `task_dependencies`. Exclude `due_date IS NULL`. Return `start_date` as `COALESCE(start_date, CURRENT_DATE)` in the SELECT — do NOT update the DB row.
- [x] **Do NOT export from `repositories/index.ts`** — import directly by path everywhere to avoid circular dependencies.

### Service — `backend/src/services/schedule.service.ts`
- [x] Import `ScheduleRepository` directly: `import { ScheduleRepository } from '../repositories/schedule.repository'`. Instantiate at top: `const scheduleRepository = new ScheduleRepository()`. Do NOT use `repositories/index.ts`.
- [x] Also import `taskRepository` from `repositories/index.ts` (already exported there) — needed for task fetches and status updates inside transactions.
- [x] `getCalendarTasks(userId, workspaceId, startRange, endRange, targetUserId?)` — if `targetUserId` provided, verify it's in `workspace_members` with `workspaceId` using `workspaceRepository.isMember`. Throw `403` if not. Call `scheduleRepository.getCalendarBlocks`.
- [x] `getUnscheduledTasks(userId, workspaceId, limit, offset, search?)` — call repository, return `{ data, pagination }`.
- [x] `updateTaskTimeblock(taskId, userId, workspaceId, scheduledStart, scheduledEnd)` — full validation chain in one transaction per API Contract endpoint 4 logic.
- [x] `deleteTaskTimeblock(taskId, userId, workspaceId)` — call `scheduleRepository.deleteTimeblock`.
- [x] `getGanttTasks(workspaceId, scope, userId?, projectId?)` — call repository.
- [x] `updateTaskDeadline(taskId, userId, workspaceId, newStartDate, newDueDate)`:
  - Verify admin/owner role via `workspace_members` query.
  - Fetch task. If `status === 'done'`, return early with `{ updated_task: task, cascaded_task_ids: [] }`.
  - Compute `start_delta` and `end_delta`.
  - Update task dates.
  - If MOVE (`start_delta === end_delta`): call `scheduleRepository.shiftTimeblocks`.
  - Always run purge: `scheduleRepository.purgeOutOfBoundsTimeblocks`.
  - If `end_delta !== 0`: run recursive cascade (max depth 15, skip `done` tasks, purge each cascaded task). Collect `cascaded_task_ids`.
  - Return `{ updated_task, cascaded_task_ids }`.

### Controller — `backend/src/controllers/schedule.controller.ts`
- [x] All controllers must use `catchAsync` wrapper — no manual try/catch.
- [x] All controllers must return `new ApiResponse(statusCode, data, message)`.
- [x] `getCalendarTasks` — extract `start_range`, `end_range`, `user_id` from `req.query`. Validate `start_range` and `end_range` are present and parseable — throw `400` if not. Call service.
- [x] `getUnscheduledTasks` — extract `limit` (default 50, max 100), `offset` (default 0), `search` from `req.query`. Call service.
- [x] `updateTaskTimeblock` — extract `taskId` from `req.params`, `scheduled_start` and `scheduled_end` from `req.body`. Call service.
- [x] `deleteTaskTimeblock` — extract `taskId` from `req.params`. Call service.
- [x] `getGanttTasks` — extract `scope` and `project_id` from `req.query`. Validate `scope` is `"workspace"` or `"user"` — throw `400` if not. Call service.
- [x] `updateTaskDeadline` — extract `id` from `req.params`, `start_date` and `due_date` from `req.body`. Call service.

### Routes — `backend/src/routes/schedule.routes.ts`
- [x] Create the file. Apply `protect` middleware to all routes.
- [x] `GET    /calendar`              → `getCalendarTasks`
- [x] `GET    /unscheduled`           → `getUnscheduledTasks`
- [x] `PUT    /tasks/:taskId/timeblock` → `updateTaskTimeblock`
- [x] `DELETE /tasks/:taskId/timeblock` → `deleteTaskTimeblock`
- [x] `GET    /gantt`                 → `getGanttTasks`
- [x] `PATCH  /tasks/:id/deadline`   → `updateTaskDeadline`
- [x] Register in `backend/src/routes/v1.routes.ts`: add `router.use("/schedule", scheduleRoutes)` — this is the only change to `v1.routes.ts`.

### Core Task Hook Fix — `backend/src/services/task.service.ts`
- [x] At the top of the file add: `import { ScheduleRepository } from '../repositories/schedule.repository'` and `const scheduleRepository = new ScheduleRepository()`. Do NOT import via `repositories/index.ts`.
- [x] Inside the existing `removeUserFromTask` function, inside the existing `executeInTransaction` callback, after `taskAssigneeRepository.unassign(taskId, assigneeUserId, client)`, add one line: `await scheduleRepository.deleteTimeblocksByUser(taskId, assigneeUserId, client)`.
- [x] This is the **only** change to `task.service.ts`. All other existing logic stays untouched.

---

## Developer B — Frontend

> Branch: `feature/schedule-fe`

### IMPORTANT — What already exists, do NOT recreate

| File | Current state | Your job |
|---|---|---|
| `frontend/src/components/SchedulePage.tsx` | Built with `mockTasks` and `mockCalendarBlocks` | Replace mock data with real API hooks |
| `frontend/src/components/tasks/TaskSchedulePane.tsx` | FullCalendar fully implemented with drag-drop, resize, conflict detection | Add `onSlotSelect` prop; add error revert on failed mutation |
| `frontend/src/components/tasks/TaskTimelinePane.tsx` | `frappe-gantt` fully implemented with view modes | Add `onDeadlineChange` + `isReadOnly` props; wire `on_date_change` |
| `frontend/src/components/dashboard/NextEventCard.tsx` | Static placeholder with `// TODO` comment | Accept `block`/`isLoading` props, wire to real data |
| `frontend/src/components/Dashboard.tsx` | Already calls `useDashboard()` and renders cards | Add `useCalendarTasks` for today, pass to `NextEventCard` |

### Library note
- FullCalendar packages are **already installed** — do NOT run install commands.
- `frappe-gantt` is **already installed** — do NOT install `gantt-task-react`. The project uses `frappe-gantt`.
- `zustand` is NOT needed — the project uses React Query + existing context.
- `date-fns` is already installed — use `startOfToday`, `endOfToday`, `format`.

### Step 1 — Add types to `frontend/src/types/task.ts`
- [ ] Add `ScheduleBlockDTO`, `GanttTaskDTO`, and `UnscheduledTaskDTO` as defined in the Frontend Type Additions section above.
- [ ] Do NOT remove or modify any existing types — only add.

### Step 2 — Create `frontend/src/hooks/api/useSchedule.ts`
- [ ] `useCalendarTasks({ start_range, end_range, user_id? })` — `GET /api/v1/schedule/calendar`. `enabled: !!start_range && !!end_range`. Query key: `["schedule", "calendar", workspaceId, start_range, end_range, user_id]`. Returns `ScheduleBlockDTO[]`.
- [ ] `useUnscheduledTasks({ limit = 50, offset = 0, search? })` — `GET /api/v1/schedule/unscheduled`. Query key: `["schedule", "unscheduled", workspaceId, { limit, offset, search }]`. Returns `{ data: UnscheduledTaskDTO[], pagination }`.
- [ ] `useUpdateTaskTimeblock()` — `PUT /api/v1/schedule/tasks/:taskId/timeblock`. On `400`/`403`: show error Toast with `error.response.data.message`. On success: invalidate `["schedule", "calendar", workspaceId]` and `["schedule", "unscheduled", workspaceId]`.
- [ ] `useDeleteTaskTimeblock()` — `DELETE /api/v1/schedule/tasks/:taskId/timeblock`. On success: invalidate `["schedule", "calendar", workspaceId]` and `["schedule", "unscheduled", workspaceId]`.
- [ ] `useGanttTasks({ scope, project_id? })` — `GET /api/v1/schedule/gantt`. Query key: `["schedule", "gantt", workspaceId, scope, project_id]`. Returns `GanttTaskDTO[]`.
- [ ] `useUpdateTaskDeadline()` — `PATCH /api/v1/schedule/tasks/:id/deadline`. On success: (1) invalidate `["schedule", "gantt", workspaceId]`, (2) if `response.data.cascaded_task_ids.length > 0`, show Toast: `"<N> dependent task(s) were automatically shifted."`.

### Step 3 — Create `frontend/src/components/schedule/ScheduleTaskModal.tsx`
New component — does not exist yet.

- [ ] Props: `open: boolean`, `onClose: () => void`, `defaultStart: string`, `defaultEnd: string`, `onScheduled: () => void`.
- [ ] Search input — debounced 300ms — calls `useUnscheduledTasks({ search })`. Show results in a scrollable list.
- [ ] `scheduled_start` and `scheduled_end` datetime fields defaulting to `defaultStart`/`defaultEnd`.
- [ ] When a task is selected: if `task.parent_task_id` is set, call `useTask(task.parent_task_id)` from `src/hooks/api/useTasks.ts` (Module 1) and show `"Parent task due: <formatted date>"` as a reference label.
- [ ] If `task.due_date` is null: show `"This task has no due date. Please set a due date in the task detail before scheduling."` and disable submit.
- [ ] **Hard block + warning:** If edited times exceed `task.start_date`/`task.due_date` bounds (or parent bounds for subtasks), show inline warning and disable submit.
- [ ] On valid submit: call `useUpdateTaskTimeblock`. On success: call `onScheduled()` and `onClose()`.

### Step 4 — Wire `frontend/src/components/SchedulePage.tsx`
- [ ] Remove `import { mockTasks } from "@/data/mockTasks"` and the `mockCalendarBlocks` array.
- [ ] Replace `useState<Task[]>(mockTasks)` with `const { data: tasks = [] } = useTasks()` from `src/hooks/api/useTasks.ts`.
- [ ] Add state for the current calendar view window: `const [calendarRange, setCalendarRange] = useState({ start: startOfToday().toISOString(), end: endOfToday().toISOString() })`. Update it when FullCalendar's `datesSet` fires — extend `onViewChange` prop in `TaskSchedulePane` to also pass the date range.
- [ ] Call `useCalendarTasks({ start_range: calendarRange.start, end_range: calendarRange.end })`. Map result to `CalendarBlock[]`: `scheduleBlocks.map(b => ({ id: b.id, type: 'task_slot' as CalendarBlockType, title: b.task_title, startISO: b.scheduled_start, endISO: b.scheduled_end, taskId: b.task_id }))`.
- [ ] Wire `onTaskSchedule` callback: `(taskId, startISO, endISO) => updateTaskTimeblock({ taskId, scheduled_start: startISO, scheduled_end: endISO })`.
- [ ] Add `ScheduleTaskModal` state. Open it when FullCalendar's `select` fires — pass slot start/end as `defaultStart`/`defaultEnd`. Wire via new `onSlotSelect` prop on `TaskSchedulePane`.
- [ ] Pass `useGanttTasks({ scope: 'workspace' })` data to `TaskTimelinePane` as the `tasks` prop. Map `GanttTaskDTO` to the minimum `Task` shape: `{ id, title, status, plannedStartISO: start_date, plannedEndISO: due_date, dependencies: dependencies.map(depId => ({ id: depId, title: '', status: 'todo' as TaskStatus, priority: 'medium' as TaskPriority, due_date: null })), projectId: '', projectTitle: '', owner: '', assignees: [], labels: [], dueDateISO: due_date, objective: '', success_criteria: '', context: [], subtasks: [], comments: [] }`.
- [ ] Pass `onDeadlineChange` to `TaskTimelinePane`: `(taskId, newStart, newEnd) => updateTaskDeadline({ id: taskId, start_date: newStart, due_date: newEnd })`.
- [ ] Pass `isReadOnly={workspaceRole !== 'admin' && workspaceRole !== 'owner'}` to `TaskTimelinePane`.

### Step 5 — Wire `frontend/src/components/tasks/TaskSchedulePane.tsx`
- [ ] Add `onSlotSelect?: (start: string, end: string) => void` to the `Props` type.
- [ ] In the existing `select` callback, call `onSlotSelect?.(info.startStr, info.endStr)`.
- [ ] Add error handling: `onTaskSchedule` is now async. If it rejects, call `info.revert()` on the relevant event info and show a Toast with the error message. Apply this to `eventReceive`, `eventDrop`, and `eventResize` handlers.

### Step 6 — Wire `frontend/src/components/tasks/TaskTimelinePane.tsx`
- [ ] Add `onDeadlineChange?: (taskId: string, newStart: string, newEnd: string) => void` to the `Props` type.
- [ ] Add `isReadOnly?: boolean` to the `Props` type.
- [ ] In `frappe-gantt` options: add `on_date_change: (task, start, end) => { onDeadlineChange?.(task.id, start.toISOString(), end.toISOString()) }`.
- [ ] Pass `readonly: isReadOnly ?? false` to `frappe-gantt` options.
- [ ] Verify `calendar-styles.css` has `.is-done .bar { opacity: 0.4; pointer-events: none; }`. If not, add it.

### Step 7 — Wire `frontend/src/components/dashboard/NextEventCard.tsx`
- [ ] Remove the `// TODO: Wire in future module` comment.
- [ ] Change signature to: `function NextEventCard({ block, isLoading }: { block: ScheduleBlockDTO | null; isLoading: boolean })`.
- [ ] If `isLoading`: render a skeleton (two grey rounded bars).
- [ ] If `block` is null: show `"No events scheduled for today"` in muted text.
- [ ] If `block` exists: show `block.task_title` and `format(new Date(block.scheduled_start), 'h:mm a')` (e.g. `"Starts at 2:30 PM"`).

### Step 8 — Update `frontend/src/components/Dashboard.tsx`
- [ ] Import `useCalendarTasks` from `src/hooks/api/useSchedule.ts` and `startOfToday`/`endOfToday` from `date-fns`.
- [ ] Add: `const { data: todayBlocks, isLoading: calendarLoading } = useCalendarTasks({ start_range: startOfToday().toISOString(), end_range: endOfToday().toISOString() })`.
- [ ] Update: `<NextEventCard block={todayBlocks?.[0] ?? null} isLoading={calendarLoading} />`.
- [ ] All other cards (`CurrentFocusCard`, `ImmediateBlockersCard`, `UpNextCard`, `NeedsReplyCard`) are untouched.

---

## Files Modified Summary

### Backend
| File | Change |
|---|---|
| `backend/src/migrations/005_schedule_schema.sql` | **New file** — `task_schedules` table (migration 005, after chat's 004) |
| `backend/src/utils/validateTaskDates.ts` | **New file** — `validateTaskHasDates` and `validateTimeblockRange` |
| `backend/src/repositories/schedule.repository.ts` | **New file** — All schedule DB queries. NOT exported from `repositories/index.ts` |
| `backend/src/routes/schedule.routes.ts` | **New file** — All 6 routes with `protect` middleware |
| `backend/src/routes/v1.routes.ts` | Add one line: `router.use("/schedule", scheduleRoutes)` |
| `backend/src/controllers/schedule.controller.ts` | **New file** — All 6 handlers using `catchAsync` and `ApiResponse` |
| `backend/src/services/schedule.service.ts` | **New file** — Business logic, null date handling, boundaries, cascade math |
| `backend/src/services/task.service.ts` | Add direct import of `ScheduleRepository` + one line in `removeUserFromTask` transaction |

### Frontend
| File | Change |
|---|---|
| `frontend/src/types/task.ts` | Add 3 new types: `ScheduleBlockDTO`, `GanttTaskDTO`, `UnscheduledTaskDTO` — no existing types removed |
| `frontend/src/hooks/api/useSchedule.ts` | **New file** — All 6 schedule hooks |
| `frontend/src/components/schedule/ScheduleTaskModal.tsx` | **New file** — Slot-selection modal with debounced search, boundary validation, no-due-date error |
| `frontend/src/components/SchedulePage.tsx` | Wire mock data → real hooks. Remove `mockTasks`/`mockCalendarBlocks`. Add `ScheduleTaskModal`. |
| `frontend/src/components/tasks/TaskSchedulePane.tsx` | Add `onSlotSelect` prop; add error revert + toast on failed `onTaskSchedule` |
| `frontend/src/components/tasks/TaskTimelinePane.tsx` | Add `onDeadlineChange` + `isReadOnly` props, `on_date_change` callback, verify `is-done` CSS |
| `frontend/src/components/dashboard/NextEventCard.tsx` | Accept `block`/`isLoading` props, wire to real data, remove TODO comment |
| `frontend/src/components/Dashboard.tsx` | Add `useCalendarTasks` for today, pass result to `NextEventCard` |

---

## Integration Notes

### Does not break existing modules
- `task.service.ts` change is additive — one import + one line inside an existing transaction. All other existing logic stays untouched.
- `repositories/index.ts` is NOT modified — `scheduleRepository` is imported directly by path.
- `v1.routes.ts` gets one new `router.use` line — all existing routes untouched.
- Chat (`/api/v1/chat/*`) and schedule (`/api/v1/schedule/*`) are completely separate namespaces.
- Migration `005` runs after `004` — no conflict.
- `frontend/src/types/task.ts` — only additions, no removals. All existing components unaffected.
- `SchedulePage.tsx`, `TaskSchedulePane.tsx`, `TaskTimelinePane.tsx` — existing UI and layout preserved. Only data source changes from mock to real.
- `Dashboard.tsx` — only `NextEventCard` changes. All other cards untouched.

### Dev A / Dev B coordination points
- Dev B cannot test `useUpdateTaskTimeblock`, `useDeleteTaskTimeblock`, or `useUpdateTaskDeadline` until Dev A's backend is deployed. Use mock responses during frontend development.
- The `ScheduleBlockDTO` shape in the API Contract section is the agreed contract — Dev A's response must match exactly, Dev B's hooks must consume exactly that shape.
- Dev B must NOT change the `TaskSchedulePane` or `TaskTimelinePane` component APIs (props) beyond what is specified in Steps 5 and 6.
- Both devs should agree on the `ScheduleBlockDTO` shape before Dev B starts Step 2.

---

## Acceptance Criteria

- [ ] Migration `005_schedule_schema.sql` runs cleanly after `004_chat_schema.sql` with no conflicts.
- [ ] `validateTaskHasDates` and `validateTimeblockRange` are two separate functions in `validateTaskDates.ts`.
- [ ] Scheduling a task with no `due_date` returns `400` with a user-facing message asking them to set a due date.
- [ ] Scheduling a task with no `start_date` automatically defaults it to today and proceeds.
- [ ] `GET /schedule/calendar` requires `start_range` and `end_range`; returns `400` if either is missing.
- [ ] `GET /schedule/unscheduled` returns paginated results (default limit 50) with `data` and `pagination` fields. `search` param filters by title case-insensitively.
- [ ] `ScheduleTaskModal` has a debounced search input that filters the unscheduled task dropdown.
- [ ] Boundary validation uses full `TIMESTAMPTZ` comparison, not date-only.
- [ ] Scheduling a subtask shows the parent `due_date` as a reference and hard-blocks submission if times exceed parent bounds.
- [ ] Only assigned users can schedule tasks — non-assignees receive `403`.
- [ ] Admins moving a task on Gantt auto-shifts all assignees' calendar blocks.
- [ ] Resizing a task on Gantt purges out-of-bounds calendar blocks but does not shift others.
- [ ] Cascade is only triggered when `due_date` changes (`end_delta !== 0`). A `start_date`-only change never cascades.
- [ ] Cascaded tasks shift by `end_delta`, preserving their original duration. Max depth 15. `done` tasks are skipped.
- [ ] `PATCH /deadline` response includes `cascaded_task_ids` (empty array if no cascade).
- [ ] Gantt query is invalidated after `useUpdateTaskDeadline` succeeds — chart re-renders with updated dates.
- [ ] `GET /schedule/gantt` excludes tasks with null `due_date`. Tasks with null `start_date` show today's date in the response without persisting it.
- [ ] Completed tasks (`status === 'done'`) are frozen and immune to all shifts and cascades.
- [ ] Removing an assignee atomically deletes their `task_schedules` record in the same transaction via `task.service.ts`. `scheduleRepository` is imported directly by path, not via `index.ts`.
- [ ] `NextEventCard` on the Dashboard shows today's first scheduled block. Shows empty state if none.
- [ ] `SchedulePage` renders real calendar data — no `mockTasks` or `mockCalendarBlocks` remain in production code paths.
- [ ] `TaskTimelinePane` is read-only for non-admin/non-owner users. Admin drag-and-drop triggers `useUpdateTaskDeadline`.
- [ ] Failed `useUpdateTaskTimeblock` calls revert the FullCalendar event to its original position and show a Toast with the server error message.
- [ ] `GET /schedule/calendar` cross-workspace snooping is blocked — providing another workspace's `user_id` returns `403`.
- [ ] `scheduleRepository` is never imported via `repositories/index.ts` — always imported directly by file path.
