# Module 7 — Schedule & Gantt

> **Prerequisite:** Phase 0 (Foundation) and Module 1 (Tasks Core) must be fully completed.
> 
> **Architectural Decisions:** 
> 1. **Multi-User Calendars:** We use a `task_schedules` mapping table so each assigned user can schedule the same overarching task at varying times on their personal calendars.
> 2. **Mandatory Deadlines:** Both `start_date` and `due_date` are strictly mandatory for all tasks. If `start_date` is omitted during creation or assignment, the backend will automatically set it to the current day.
> 3. **Status Sync:** When a user schedules a task on their calendar, if the task is currently in `backlog`, the API automatically moves it to `todo`.
> 4. **Auto-Shifting Gantt Logic:** If an Admin **moves** a task on the Gantt Chart (both `start_date` and `due_date` change by the exact same delta), the backend shifts all users' existing `task_schedules` blocks by that delta. If an Admin merely **stretches/resizes** one edge (only `start_date` or only `due_date` changes, or they change by different amounts), user calendar blocks are **NOT** shifted — they stay exactly where they are. After any resize, any `task_schedules` records that now fall outside the new bounds are deleted to force a reschedule. **CRITICAL:** Any task where `status === 'done'` is completely frozen. It is excluded entirely from all shifting and cascade logic to preserve historical records.
> 5. **Auto-Cascading Dependencies:** If an Admin delays Task A's `due_date` by 1 day and that new `due_date` now overlaps or exceeds a dependent Task B's `start_date`, the system automatically pushes Task B's **both** `start_date` and `due_date` forward by the same amount (preserving Task B's original duration). This cascades recursively through the entire chain. **CRITICAL:** To prevent infinite recursive loop server crashes, enforce a strict `maxDepth` limit of 15 iterations. The cascade stops safely after 15 levels. Skip cascade entirely on tasks that are `status === 'done'`.
> 6. **Ghost Block Prevention:** If an Admin un-assigns a user from a task, the system automatically deletes any `task_schedules` items that user had placed for that task.
> 7. **Subtask Boundary Enforcement:** Subtasks can never exceed their Parent task constraints. The API will block/reject attempts to move a subtask outside the parent's deadlines.
> 8. **Assignee-Only Scheduling:** Only users who are actually assigned to a task (verified via the `task_assignees` table) are allowed to schedule it on their calendar. Any non-assignee attempting to call the timeblock endpoint receives a `403 Forbidden`.

---

## Context

The Schedule & Gantt module introduces personal time-block management and project timeline visualization to Keil HQ.

**What already exists:**
- `tasks` table stores `start_date` and `due_date` (Timestamps).
- `tasks` table supports dependencies, parent/children, and multiple assignees.
- Task CRUD, permissions, and workspace tracking logic work.
- `auth.middleware.ts` attaches `req.workspaceId` to protected requests.

**What is missing:**
- A `task_schedules` table linking a `task_id` and a `user_id` to exact time-blocks (`scheduled_start`, `scheduled_end`) with workspace scoping.
- Dedicated endpoints for fetching Gantt data (hierarchy) and Calendar bounds.
- A weekly/monthly calendar view that supports time-blocking via drag-and-drop and slot-selection.
- A Gantt timeline view displaying macro task boundaries (`start_date` to `due_date`) and dependencies.

---

## API Contract

Both developers must agree on and freeze these shapes before writing code. Existing APIs must remain untouched to prevent regressions.

### 1. Database Schema Update (Migration)
```sql
-- Migration: 00X_schedule_schema.sql
CREATE TABLE task_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  scheduled_start TIMESTAMPTZ NOT NULL,
  scheduled_end TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(task_id, user_id), -- Ensures 1 contiguous block per user per task.
  CONSTRAINT task_schedules_valid_range CHECK (scheduled_end > scheduled_start)
);

CREATE INDEX idx_task_schedules_workspace_id ON task_schedules(workspace_id);
CREATE INDEX idx_task_schedules_user_id ON task_schedules(user_id);
CREATE INDEX idx_task_schedules_task_id ON task_schedules(task_id);

-- Note: In existing schema, ALTER TABLE tasks ALTER COLUMN due_date SET NOT NULL, ALTER COLUMN start_date SET NOT NULL.
```

### 2. GET /api/v1/schedule/calendar
**Query params:** `start_range` (ISO Date), `end_range` (ISO Date), `user_id` (Optional, defaults to `req.user.id`).
**Description:** Fetches specifically from the `task_schedules` table mapped with basic `tasks` info.
**Backend Logic:**
1. If `user_id` is provided, verify it belongs to the same workspace as `req.user` via the `workspace_members` table. If not, throw **403 Forbidden** to prevent cross-workspace calendar snooping.
2. All queries must include `WHERE tasks.deleted_at IS NULL` and scope strictly to `req.workspaceId`.
**Response 200:** Array of Schedule DTOs containing `scheduled_start` and `scheduled_end`.

### 3. GET /api/v1/schedule/unscheduled
**Description:** Fetches tasks assigned to the user that do NOT have a record in `task_schedules`.
**Response 200:** Array of `tasks` (id, title, due_date, etc.)

### 4. PUT /api/v1/schedule/tasks/:taskId/timeblock
**Description:** Used by the Calendar Drag & Drop and Slot Select UI. Upserts the user's schedule.
**Request body:**
```json
{
  "scheduled_start": "ISO",
  "scheduled_end": "ISO"
}
```
**Backend Logic:**
1. **Assignee Verification:** Query the `task_assignees` table. If `req.user.id` is NOT listed as an assignee of this task, throw **403 Forbidden**.
2. **Minimum Duration Validation:** Reject (400) if `scheduled_end <= scheduled_start` or if block duration is `< 15 minutes`.
3. **Boundary Validation:** If `scheduled_start < task.start_date` or `scheduled_end > task.due_date`, throw **400 Bad Request**.
4. **Status Sync:** If `task.status === 'backlog'`, automatically update `task.status = 'todo'`.
**Response 200:** Updated Schedule DTO.

### 5. DELETE /api/v1/schedule/tasks/:taskId/timeblock
**Description:** Removes the personal time block from the user's calendar.
**Backend Logic:** Deletes the specific row in `task_schedules` where `task_id` matches and `user_id = req.user.id`. Does *not* revert task status.
**Response:** `200 OK`

### 6. GET /api/v1/schedule/gantt
**Query params:** `scope: "workspace" | "user"`, `project_id` (optional).
**Description:** Fetches tasks formatted for Gantt chart rendering.
**Backend Logic:** All queries must include `WHERE tasks.deleted_at IS NULL` and scope strictly to `req.workspaceId`.
**Response 200:** Array of Tasks with `parent_task_id`, `dependencies` arrays, `start_date`, and `due_date`.

### 7. PATCH /api/v1/schedule/tasks/:id/deadline
**Description:** Admin Gantt Chart Drag & Drop. Updates macro `tasks` layout.
**Request body:** `{ "start_date": "ISO", "due_date": "ISO" }`
**Permissions & Logic:**
- Requires Admin/Owner Role via Workspace membership.
- **Completed Task Freeze:** If `status === 'done'`, return 200 silently.
- **Move vs Resize Detection:** If `start_delta === end_delta` (MOVE), shift linked `task_schedules` by that delta. If RESIZE, do **NOT** shift.
- **Resize Purge Cleanup:** Delete `task_schedules` records that fall outside the new task boundaries.
- **Auto-Cascade:** Push dependent tasks' start and due dates forward. **Max depth: 15.** Skip `done` tasks.
**Response 200:** Success.

---

## Developer A — Backend

> Branch: `feature/schedule-be`

### Setup & Migrations
- [ ] Create SQL migration for `task_schedules` with `workspace_id`, FKs, `NOT NULL`, uniqueness, and range `CHECK`.
- [ ] Migrate `tasks` table to enforce `NOT NULL` on `start_date` and `due_date`.

### Controller Implementation (`schedule.controller.ts`)
- [ ] Implement `getCalendarTasks` — Validate `user_id` workspace scoping. Filter out soft-deleted and scope to `workspaceId`.
- [ ] Implement `getUnscheduledTasks` — Fetch assigned tasks without a schedule record.
- [ ] Implement `updateTaskTimeblock` — Enforce assignee-only check, 15min duration, and Boundary Validation. Sync `status` to `todo`.
- [ ] Implement `deleteTaskTimeblock` — Scope to `req.user.id` and `workspaceId`.
- [ ] Implement `getGanttTasks` — Execute efficient queries for hierarchy and dependencies. Scope to `workspaceId`.
- [ ] Implement `updateTaskDeadline` — Auth check, Done Freeze, Move vs Resize detection, and recursive Cascade (Max depth 15).

### Core Task Hooks (`task.controller.ts`)
- [ ] Update `removeUserFromTask` in `task.controller.ts`: Add logic to delete from `task_schedules` where `task_id = taskId AND user_id = userId` to destroy ghost blocks when a user is unassigned.

---

## Developer B — Frontend

> Branch: `feature/schedule-fe`

### Component & Library Setup
- [ ] Add Calendar (`@fullcalendar/react`) and Gantt Chart (`gantt-task-react`) packages.

### Schedule Hooks — `src/hooks/api/useSchedule.ts`
- [ ] `useCalendarTasks({ start_range, end_range, user_id })` — Fetch scheduled blocks.
- [ ] `useUnscheduledTasks()` — Fetch tasks awaiting scheduling.
- [ ] `useUpdateTaskTimeblock()` — `PUT` mutation for scheduling.
- [ ] `useDeleteTaskTimeblock()` — `DELETE` mutation.
- [ ] `useGanttTasks()` — Fetch Gantt data.
- [ ] `useUpdateTaskDeadline()` — `PATCH` mutation for Gantt shifts.

### Calendar Implementation (`src/pages/SchedulePage.tsx` & `CalendarGrid.tsx`)
- [ ] **Render Grid:** Implement `CalendarGrid.tsx` using FullCalendar. Map API data to events.
- [ ] **Slot Selection (New Task Flow):** 
    - Implement `select` callback in FullCalendar.
    - When an empty slot is clicked/dragged, open a **Schedule Task Modal**.
    - **Modal Content:** 
        - A dropdown using `useUnscheduledTasks()` to select which task to place. 
        - Fields to confirm/edit `scheduled_start` and `scheduled_end` (defaults to the selected slot). 
        - **Subtask support:** If the user creates/selects a subtask here, show the parent's `due_date` as a reference.
    - On submit, call `useUpdateTaskTimeblock()`.
- [ ] **Drag & Drop:** Enable event dragging. On drop, call `useUpdateTaskTimeblock()`. Rollback + Toast on 400/403.
- [ ] **Un-Schedule:** `x` icon on blocks calling `useDeleteTaskTimeblock()`.
- [ ] **Status Sync:** Global UI update to `todo` when a backlog task is scheduled.

### Wire Gantt View (`src/pages/GanttPage.tsx`)
- [ ] Render timeline. Hide editing for non-admins.
- [ ] Gray out and freeze `status === 'done'` tasks.
- [ ] Cascade Toast when downstream tasks are pushed by an admin move.

---

## Files Modified Summary

### Backend
| File | Change |
|---|---|
| `backend/src/migrations/XXX_schedule_schema.sql` | Add `task_schedules` table with workspace scoping and safety constraints |
| `backend/src/routes/schedule.routes.ts` | **New file** — Route declarations |
| `backend/src/routes/v1.routes.ts` | Register `schedule.routes.ts` |
| `backend/src/controllers/schedule.controller.ts` | **New file** — Calendar, Unscheduled, and Gantt handlers |
| `backend/src/services/schedule.service.ts` | **New file** — Logic, boundaries, and cascade math |
| `backend/src/controllers/task.controller.ts` | Update `removeUserFromTask` to cleanup ghost blocks |

### Frontend
| File | Change |
|---|---|
| `frontend/src/hooks/api/useSchedule.ts` | **New file** — API hooks for calendar, unscheduled, and gantt |
| `frontend/src/pages/SchedulePage.tsx` | **New file** — Calendar wrapper |
| `frontend/src/components/schedule/CalendarGrid.tsx` | **New file** — FullCalendar implementation and slot selection |
| `frontend/src/components/schedule/ScheduleTaskModal.tsx` | **New file** — Modal with dropdown for unscheduled tasks |
| `frontend/src/pages/GanttPage.tsx` | **New file** — Gantt view and constraint logic |

---

## Acceptance Criteria

- [ ] `task_schedules` schema exists with `workspace_id` scoping and range constraints.
- [ ] Users see assigned but unscheduled tasks in a dropdown when clicking an empty calendar slot.
- [ ] Scheduling a subtask via the calendar allows confirming start/end times within parent bounds.
- [ ] Only assigned users can schedule tasks — non-assignees receive 403.
- [ ] Admins moving a task on Gantt auto-shifts all assignees' calendar blocks.
- [ ] Resizing a task on Gantt purges out-of-bounds calendar blocks but doesn't shift others.
- [ ] Completed tasks are frozen and immune to all shifts and cascades.
- [ ] Removing an assignee clears their localized calendar immediately via `removeUserFromTask` update.
