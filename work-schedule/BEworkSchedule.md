# Detailed Backend Work Schedule: Module 7 (Schedule & Gantt)

This document is the **highly detailed, step-by-step checklist and implementation plan** for the Backend Developer (Dev A). 
**IMPORTANT:** Every table name, column, file path, endpoint, parameter, and function name in this document is perfectly matched 1:1 with the API Contract defined in the source `draft/schedule.md`. This ensures zero friction with the Frontend Developer.

---

## 🏗️ Phase 1: Database & Validation Layer (Do this First)

### 1️⃣ Database Migration
**File to create:** `backend/src/migrations/005_schedule_schema.sql`
*(Note: Migration is `005` strictly because `004` belongs to the chat module).*

*   **Action Steps:**
    *   Write the SQL to create the `task_schedules` table exactly as follows:
        *   `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
        *   `workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE`
        *   `task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE`
        *   `user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE`
        *   `scheduled_start TIMESTAMPTZ NOT NULL`
        *   `scheduled_end TIMESTAMPTZ NOT NULL`
        *   `created_at TIMESTAMPTZ DEFAULT NOW()`
    *   Add constraint: `UNIQUE(task_id, user_id)`
    *   Add constraint: `CONSTRAINT task_schedules_valid_range CHECK (scheduled_end > scheduled_start)`
    *   Add Indexes: `idx_task_schedules_workspace_id`, `idx_task_schedules_user_id`, `idx_task_schedules_task_id`.
    *   **CRITICAL RULE:** Do **NOT** add `NOT NULL` constraints to `tasks.start_date` or `tasks.due_date` in the DB. They must remain nullable at the DB level.

### 2️⃣ Shared Date Validators
**File to create:** `backend/src/utils/validateTaskDates.ts`

*   **Action Steps:**
    *   **`validateTaskHasDates(start: Date | string | null | undefined, due: Date | string | null | undefined): void`**
        *   If `due` is absent, throw `ApiError(400, 'This task has no due date. Please set a due date before scheduling it on the calendar.')`.
        *   If `start` is absent, throw `ApiError(400, 'start_date is missing. This should have been defaulted — check the service layer.')`.
        *   Validate both formats to ensure they aren't `NaN`.
        *   Ensure `due >= start` (time comparison). Throw 400 otherwise.
    *   **`validateTimeblockRange(scheduledStart: string | undefined, scheduledEnd: string | undefined): void`**
        *   Require both parameters (throw 400 if missing or invalid date format).
        *   Ensure `scheduledEnd > scheduledStart`.
        *   Ensure the duration is at least 15 minutes (`endMs - startMs < 15 * 60 * 1000` -> throw 400).
    *   **CRITICAL RULE:** Keep these as two separate functions, do not merge them.

---

## 🗄️ Phase 2: Data Access Layer (Repository)

### 3️⃣ Schedule Repository
**File to create:** `backend/src/repositories/schedule.repository.ts`

*   **Action Steps:**
    *   Extend `BaseRepository`.
    *   **CRITICAL RULE:** Do NOT export this file from `repositories/index.ts`. Import it directly by its file path in the rest of your app to prevent circular dependencies.
    *   Implement identical functions required by `draft/schedule.md`:
        1.  `upsertTimeblock(taskId, userId, workspaceId, start, end, client?)`: Use PostgreSQL `INSERT ... ON CONFLICT (task_id, user_id) DO UPDATE SET scheduled_start = EXCLUDED.scheduled_start, scheduled_end = EXCLUDED.scheduled_end`.
        2.  `deleteTimeblock(taskId, userId, workspaceId, client?)`: `DELETE FROM task_schedules WHERE task_id = $1 AND user_id = $2 AND workspace_id = $3`.
        3.  `deleteTimeblocksByUser(taskId, userId, client?)`: `DELETE FROM task_schedules WHERE task_id = $1 AND user_id = $2`.
        4.  `shiftTimeblocks(taskId, deltaMs, client?)`: `UPDATE task_schedules SET scheduled_start = scheduled_start + ($deltaMs || ' milliseconds')::interval, scheduled_end = scheduled_end + ($deltaMs || ' milliseconds')::interval WHERE task_id = $1`.
        5.  `purgeOutOfBoundsTimeblocks(taskId, newStart, newEnd, client?)`: `DELETE FROM task_schedules WHERE task_id = $1 AND (scheduled_start < $2 OR scheduled_end > $3)`.
        6.  `getCalendarBlocks(userId, workspaceId, startRange, endRange)`: `JOIN task_schedules ts WITH tasks t`. Filter `ts.workspace_id = $workspaceId AND ts.user_id = $userId AND ts.scheduled_start < $end_range AND ts.scheduled_end > $start_range AND t.deleted_at IS NULL`.
        7.  `getUnscheduledTasks(userId, workspaceId, limit, offset, search?)`: Use a `LEFT JOIN task_schedules ts ON t.id = ts.task_id AND ts.user_id = $userId`. Filter `ts.id IS NULL`, `ta.user_id = $userId`. Add `COUNT(*) OVER()` window function for total pagination counts. Support `ILIKE` for the `$search` filter.
        8.  `getGanttTasks(workspaceId, scope, userId?, projectId?)`: `JOIN tasks WITH task_dependencies`. Filter `deleted_at IS NULL AND due_date IS NOT NULL AND workspace_id = $workspaceId`. If `scope === 'user'`, check `task_assignees`. Allow `projectId` filtering. **Select `COALESCE(start_date, CURRENT_DATE) as start_date`** so frontend gets today's date if it is null (without saving it to the DB). Return `dependencies` as an array of `depends_on_task_id` strings.

---

## ⚙️ Phase 3: Business Logic Layer (Service)

### 4️⃣ Schedule Service
**File to create:** `backend/src/services/schedule.service.ts`

*   **Action Steps:**
    *   **Imports:** `import { ScheduleRepository } from '../repositories/schedule.repository'` at the top. Bring in `taskRepository` from `repositories/index.ts`.
    *   Implement methods:
        1.  `getCalendarTasks(userId, workspaceId, startRange, endRange, targetUserId?)`: If `targetUserId` is present, check `workspaceRepository.isMember(workspaceId, targetUserId)`. Throw 403 if false. Return `scheduleRepository.getCalendarBlocks`.
        2.  `getUnscheduledTasks(userId, workspaceId, limit, offset, search?)`: Returns `{ data: results, pagination: { limit, offset, total } }`.
        3.  `updateTaskTimeblock(taskId, userId, workspaceId, scheduledStart, scheduledEnd)`:
            *   *(Inside a Transaction)*: Fetch task -> verify it exists -> verify workspace match -> 404 if not found.
            *   Null handling: If `task.start_date` is null, set `task.start_date = NOW()` via `taskRepository.update(task.id, ...)` *in DB*. If `task.due_date` is null, throw 400.
            *   Call `validateTaskHasDates(task.start_date, task.due_date)`.
            *   Check `task_assignees` to verify the user is assigned to this task -> 403 if not.
            *   Call `validateTimeblockRange(scheduledStart, scheduledEnd)`.
            *   Date Bounds check: If request times fall outside `task.start_date` or `task.due_date`, throw 400. Same for `parent_task_id` boundaries if it's a subtask.
            *   Status sync: If `task.status === 'backlog'`, call `taskRepository.updateStatus(task.id, 'todo', client)`.
            *   Call `scheduleRepository.upsertTimeblock`.
        4.  `deleteTaskTimeblock(taskId, userId, workspaceId)`: Map to repository.
        5.  `getGanttTasks(workspaceId, scope, userId?, projectId?)`: Map to repository.
        6.  `updateTaskDeadline(taskId, userId, workspaceId, newStartDate, newDueDate)`: 
            *   Check caller roles (`admin` or `owner` in `workspace_members`). Block (403) if not.
            *   Fetch task. If `status === 'done'`, return `{ updated_task: task, cascaded_task_ids: [] }` immediately (done tasks are frozen).
            *   Compute `start_delta` and `end_delta` (new - old ms).
            *   Update task `start_date` and `due_date`.
            *   If MOVE (`start_delta === end_delta`), call `scheduleRepository.shiftTimeblocks(taskId, start_delta, client)`.
            *   Always call `scheduleRepository.purgeOutOfBoundsTimeblocks(...)`.
            *   Cascade: If `end_delta !== 0`, find `task_dependencies`. Recurse up to 15 levels down. If `new_due_date >= dependent.start_date`, push dependent task forward by `end_delta`. Skip any `done` tasks. Purge cascaded elements. Track pushed IDs in `cascaded_task_ids`.
            *   Return `{ updated_task, cascaded_task_ids }`.

---

## 🔌 Phase 4: API Exposure (Controllers & Routes)

### 5️⃣ Schedule Controller
**File to create:** `backend/src/controllers/schedule.controller.ts`

*   **Action Steps:**
    *   Wrap EVERY handler with `catchAsync`.
    *   Return EVERY response using `new ApiResponse(statusCode, data, message)`.
    *   `getCalendarTasks`: Parse `start_range`, `end_range` from `req.query`, and `user_id` optionally. Throw 400 if dates missing.
    *   `getUnscheduledTasks`: Extract `limit` (default 50, max 100), `offset` (default 0), and `search` from `req.query`.
    *   `updateTaskTimeblock`: Extract `taskId` from `req.params`, `scheduled_start` and `scheduled_end` from `req.body`.
    *   `deleteTaskTimeblock`: Extract `taskId` from `req.params`.
    *   `getGanttTasks`: Extract `scope` from `req.query` (validate it is `"workspace"` or `"user"`), optional `project_id`.
    *   `updateTaskDeadline`: Extract `id` from `req.params`, `start_date` and `due_date` from `req.body`.

### 6️⃣ Schedule Routes
**File to create:** `backend/src/routes/schedule.routes.ts`

*   **Action Steps:**
    *   Apply `protect` middleware to the whole router to ensure `req.user` and `req.workspaceId` are attached.
    *   Map HTTP verbs appropriately:
        *   `GET    /calendar` -> `getCalendarTasks`
        *   `GET    /unscheduled` -> `getUnscheduledTasks`
        *   `PUT    /tasks/:taskId/timeblock` -> `updateTaskTimeblock`
        *   `DELETE /tasks/:taskId/timeblock` -> `deleteTaskTimeblock`
        *   `GET    /gantt` -> `getGanttTasks`
        *   `PATCH  /tasks/:id/deadline` -> `updateTaskDeadline`
    *   **In `backend/src/routes/v1.routes.ts`:** Add exactly one line: `router.use("/schedule", scheduleRoutes);`

---

## 🧹 Phase 5: The "Ghost" Block Fix (Integration)

### 7️⃣ Update Task Service
**File to modify:** `backend/src/services/task.service.ts`

*   **Action Steps:**
    1.  At the top of the file, add:
        `import { ScheduleRepository } from '../repositories/schedule.repository'`
        `const scheduleRepository = new ScheduleRepository()`
    2.  Find the `removeUserFromTask` method.
    3.  Inside its `executeInTransaction` callback, right after `taskAssigneeRepository.unassign(...)`, insert exactly this:
        `await scheduleRepository.deleteTimeblocksByUser(taskId, assigneeUserId, client);`
    4.  **Do NOT touch anything else in `task.service.ts`.**

---

# 🟢 Final Developer Checklist
*(Check these off as you complete them to ensure everything is strictly aligned with the Frontend contract)*

### Infrastructure
- [x] Created `backend/src/migrations/005_schedule_schema.sql` (after 004 chat).
- [x] Schema contains `UNIQUE(task_id, user_id)` and uses `TIMESTAMPTZ`.
- [x] `tasks.start_date` and `tasks.due_date` constraints remain unchanged (nullable).
- [x] `validateTaskDates.ts` created with EXACTLY two named functions: `validateTaskHasDates` and `validateTimeblockRange`.

### Repository (`schedule.repository.ts`)
- [x] File created. **Not** exported from `repositories/index.ts`.
- [x] Implemented `upsertTimeblock` with `ON CONFLICT` logic.
- [x] Implemented `deleteTimeblock` and `deleteTimeblocksByUser`.
- [x] Implemented `shiftTimeblocks` properly using pg `interval`.
- [x] Implemented `purgeOutOfBoundsTimeblocks`.
- [x] Implemented `getCalendarBlocks` with expected join logic.
- [x] Implemented `getUnscheduledTasks` with window function `COUNT(*) OVER()`.
- [x] Implemented `getGanttTasks` mapped to exclude `due_date IS NULL` and uses `COALESCE` for `start_date`.

### Service (`schedule.service.ts`)
- [x] Instantiated `ScheduleRepository` via direct path.
- [x] `updateTaskTimeblock` enclosed in a transaction, setting missing `start_date` to `NOW()`.
- [x] Backlog auto-syncs to Todo during `updateTaskTimeblock`.
- [x] Date boundaries are fully checked in `updateTaskTimeblock`.
- [x] `updateTaskDeadline` strictly returns early for `status === 'done'`.
- [x] Move vs Resize logic is flawless in `updateTaskDeadline`.
- [x] Deep cascading function is restricted to 15 levels and returns `cascaded_task_ids`.

### Controller & Setup (`schedule.controller.ts` & `routes.ts`)
- [x] Responses wrapped entirely in `catchAsync` & `ApiResponse`.
- [x] Query params correctly validated and parsed in all controllers.
- [x] `router.use("/schedule", scheduleRoutes)` applied perfectly into `v1.routes.ts`.

### Integrity Patch
- [x] Added `deleteTimeblocksByUser` cleanly inside the existing `removeUserFromTask` transaction in `task.service.ts`.
