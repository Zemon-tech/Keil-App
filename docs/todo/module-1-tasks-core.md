# Module 1 — Tasks Core

> **Prerequisite:** Phase 0 (Foundation) must be fully merged before this module starts.
> Both `workspaceId` must be available in frontend context and backend `/users/me` must return it.

---

## Context

The task module is the core of KEIL HQ. Everything else (assignees, dependencies, comments, activity, dashboard) builds on top of it.

**What already exists:**
- All routes are wired in `backend/src/routes/task.routes.ts` — no route changes needed
- Service layer is fully implemented in `backend/src/services/task.service.ts` — business logic, date validation, and activity logging are already handled
- Repository layer is fully implemented in `backend/src/repositories/task.repository.ts` — all SQL queries including filtering, sorting, and pagination exist
- Auth middleware already attaches `req.user` (`{ id, email, name, created_at }`) to every protected request

**What is missing:**
- Controllers in `backend/src/controllers/task.controller.ts` are all `// TODO` stubs — they do nothing but return empty `200` responses
- Frontend `TasksPage.tsx` runs entirely off `useState(mockTasks)` from `src/data/mockTasks.ts`
- No TanStack Query hooks exist yet for tasks
- Frontend task type values (`"In Progress"`, `"Blocked"`, `"Critical"`) do not match the backend enums — this is fixed in Phase 0 first

**How workspace_id is derived:**
Controllers do not receive `workspace_id` from a URL param. Since each user belongs to exactly one workspace, the controller should call `workspaceService.getUserWorkspace(req.user.id)` to resolve it, or the auth middleware can be enhanced to attach `req.workspaceId` directly. Either approach is acceptable — pick one and keep it consistent across all controllers in this module.

---

## API Contract

Both developers must agree on and freeze these shapes before writing code.

### POST /api/v1/tasks
**Request body:**
```json
{
  "title": "string (required)",
  "description": "string (optional)",
  "objective": "string (optional)",
  "success_criteria": "string (optional)",
  "status": "backlog | todo | in-progress | done (optional, default: backlog)",
  "priority": "low | medium | high | urgent (optional, default: medium)",
  "start_date": "ISO string (optional)",
  "due_date": "ISO string (optional)",
  "parent_task_id": "uuid (optional, for subtasks)"
}
```
**Response 201:** Full task object (see TaskDTO in `task.service.ts`)

### GET /api/v1/tasks
**Query params:** `status`, `priority`, `assignee_id`, `due_date_start`, `due_date_end`, `sort_by` (`due_date | priority | created_at`), `sort_order` (`asc | desc`), `limit` (default 20), `offset` (default 0), `parent_task_id` (pass `null` string for top-level only)
**Response 200:** Array of TaskDTO

### GET /api/v1/tasks/:id
**Response 200:** Full TaskDTO including assignees array

### PATCH /api/v1/tasks/:id
**Request body:** Any subset of `title`, `description`, `objective`, `success_criteria`, `priority`, `start_date`, `due_date`
**Response 200:** Updated TaskDTO

### PATCH /api/v1/tasks/:id/status
**Request body:** `{ "status": "backlog | todo | in-progress | done" }`
**Response 200:** Updated TaskDTO
**Response 400:** If trying to set `done` but dependencies are incomplete

### DELETE /api/v1/tasks/:id
**Response 200:** Empty data, success message

---

## Developer A — Backend

> Branch: `feature/tasks-be`

### Setup
- [ ] Decide and implement how `workspace_id` is resolved in controllers (middleware attachment vs. per-controller lookup). Document the chosen approach in a code comment at the top of `task.controller.ts`.

### Controller Implementation
- [ ] Implement `createTask` — validate required fields, call `taskService.createTask()`, return `201`
- [ ] Implement `getTasks` — parse and forward all query params to `taskService.getTasksByWorkspace()`, return `200`
- [ ] Implement `getTaskById` — call `taskRepository.findWithAssignees()` for full detail, return `200` or `404`
- [ ] Implement `updateTask` — validate body, call `taskService.updateTask()`, return `200` or `404`
- [ ] Implement `deleteTask` — call `taskService.deleteTask()`, return `200` or `404`
- [ ] Implement `changeTaskStatus` — validate `status` enum, call `taskService.changeTaskStatus()`, handle `400` for blocked-by-dependencies case

### Validation Rules
- [ ] `title` — required, non-empty string
- [ ] `status` — must be one of `backlog | todo | in-progress | done`
- [ ] `priority` — must be one of `low | medium | high | urgent`
- [ ] `due_date >= start_date` — return `400` if violated (service already does this, but also validate early in controller)
- [ ] `parent_task_id` — if provided, must be a valid UUID of a task in the same workspace
- [ ] All task operations — verify task belongs to the user's current workspace before proceeding; return `404` if not found or `403` if not in workspace

### Quality
- [ ] Every controller must call `next(error)` or use `catchAsync` for unhandled errors — do not swallow exceptions
- [ ] Return consistent `ApiResponse` shape on success, `ApiError` on failure

---

## Developer B — Frontend

> Branch: `feature/tasks-fe`

### Phase 0 dependency check
- [ ] Confirm `@tanstack/react-query` is installed and `QueryClientProvider` is active in `main.tsx`
- [ ] Confirm `WorkspaceContext` is available and `workspaceId` is accessible via `useWorkspace()` hook
- [ ] Confirm `src/types/task.ts` enums are already updated to `backlog | todo | in-progress | done` and `low | medium | high | urgent`

### Create Task Hooks — `src/hooks/api/useTasks.ts`
- [ ] `useTasks(filters?)` — `useQuery` wrapping `GET /api/v1/tasks` with `workspaceId` and optional filter params; query key should include all active filters so changing a filter refetches
- [ ] `useTask(taskId)` — `useQuery` wrapping `GET /api/v1/tasks/:id`
- [ ] `useCreateTask()` — `useMutation` wrapping `POST /api/v1/tasks`; on success, invalidate the `useTasks` query
- [ ] `useUpdateTask()` — `useMutation` wrapping `PATCH /api/v1/tasks/:id`; on success, invalidate both `useTasks` and `useTask(id)` queries
- [ ] `useDeleteTask()` — `useMutation` wrapping `DELETE /api/v1/tasks/:id`; on success, invalidate `useTasks` and clear selected task if it was deleted
- [ ] `useChangeTaskStatus()` — `useMutation` wrapping `PATCH /api/v1/tasks/:id/status`; on success, invalidate `useTask(id)` and `useTasks`

### Wire TasksPage — `src/components/TasksPage.tsx`
- [ ] Replace `useState<Task[]>(mockTasks)` with `useTasks()` from the new hook
- [ ] Replace local filter/sort state with query params passed into `useTasks()`
- [ ] Replace `onUpdateTask` prop callback pattern with mutations called directly from child components (or keep the callback but wire it to `useUpdateTask` mutation internally)
- [ ] Remove the `import { mockTasks }` line
- [ ] Pass `isLoading` down to `TaskListPane` so it can show a skeleton/loading state

### Wire TaskListPane — `src/components/tasks/TaskListPane.tsx`
- [ ] Update `statusColorMap` keys to match new enum values: `"in-progress"`, `"done"`, `"backlog"`, `"todo"` — remove `"Blocked"`
- [ ] Update `STATUS_OPTIONS` array values to match backend enums
- [ ] Update `FILTER_OPTIONS` — remove the filter that checks `status === "Blocked"` (blocked is derived, not a real status)
- [ ] Replace `handleCreateSubmit` mock task construction with `useCreateTask()` mutation call — remove the fake `id`, `projectId`, `history`, etc. fields; only send fields the backend accepts
- [ ] Add loading skeleton when `isLoading` is true (simple placeholder rows are fine, no over-engineering)
- [ ] Add empty state when task list is empty and not loading

### Wire TaskDetailPane — `src/components/tasks/TaskDetailPane.tsx`
- [ ] The detail pane currently receives a `task` prop from `TasksPage` — this is fine for now; it will use the task data from the list query
- [ ] Update `STATUS_OPTIONS` constant (L55) values to `"backlog" | "todo" | "in-progress" | "done"`
- [ ] Update `STATUS_COLOR` map (L57–62) keys to match new enum values
- [ ] Update `PRIORITY_CONFIG` map (L64–69) — rename `"Critical"` key to `"urgent"`
- [ ] Wire inline status change in `handleStatusChange` (L171–172) to `useChangeTaskStatus()` mutation
- [ ] Wire `handleMarkDone` (L174–175) to `useChangeTaskStatus()` mutation
- [ ] Handle the case where `changeTaskStatus` returns a `400` (blocked by dependencies) — show an error toast explaining why
- [ ] Update the task detail display to use `useTask(taskId)` for fresh data when a task is selected (so navigating to a task always shows current server state)

---

## Files Modified

### Backend
| File | Change |
|---|---|
| `backend/src/controllers/task.controller.ts` | Full implementation of all 6 stubs |
| `backend/src/middlewares/auth.middleware.ts` | Optional: attach `workspaceId` to request if that approach is chosen |

### Frontend
| File | Change |
|---|---|
| `frontend/src/hooks/api/useTasks.ts` | **New file** — all task query/mutation hooks |
| `frontend/src/components/TasksPage.tsx` | Replace `useState(mockTasks)` with `useTasks()` |
| `frontend/src/components/tasks/TaskListPane.tsx` | Fix enum values, wire create to mutation, add loading state |
| `frontend/src/components/tasks/TaskDetailPane.tsx` | Fix enum values, wire status change to mutations |
| `frontend/src/data/mockTasks.ts` | No longer imported by TasksPage — file can remain for reference |

---

## Acceptance Criteria

- [x] A task can be created via the UI and appears in the list after refresh without a page reload
- [x] Task list reflects real database data — not `mockTasks`
- [x] Selecting a task shows its real detail from the backend
- [ ] A task's title and description can be edited and the change persists after page refresh
- [ ] A task can be deleted and disappears from the list
- [ ] Status can be changed inline; the updated status persists
- [ ] Attempting to set status to `done` on a task with incomplete dependencies returns a visible error (this will be fully testable once Module 2 is done, but the error handling path must exist)
- [ ] Filters (`status`, `priority`) pass through to the backend and the list reflects filtered results
- [ ] Pagination works — more tasks can be loaded
- [ ] Parent task can be created with `parent_task_id` pointing to another task
- [ ] Loading state is shown while tasks are fetching
- [ ] Empty state is shown when no tasks exist
- [ ] No reference to `mockTasks` remains in production code paths

---

## Impact on Other Developers

| Who | Impact |
|---|---|
| **Module 2 dev** | Assignee and dependency hooks will extend `useTasks.ts` — do not delete or rename existing hooks in this file |
| **Module 3 dev** | Comments are nested under tasks via `GET /api/v1/tasks/:id/comments` — the task route file is already wired for this, no changes needed from this module |
| **Module 4 dev** | Activity logs are already being written by `taskService` during create/update/delete/status change — no extra work needed from this module |
| **Module 5 dev** | Dashboard queries the same `tasks` table — task data stability from this module directly improves dashboard accuracy |
| **Owner (reviewer)** | Review both backend PR and frontend PR together before merging — verify integration on `develop` branch end-to-end before merging to `main` |

---

## Notes

- The `task.service.ts` already handles date validation (`due_date >= start_date`) and activity logging. Controllers should not re-implement this logic — just call the service.
- The `task.repository.ts` already has all query logic including `findWithAssignees` for rich task detail. Use these methods rather than writing raw SQL in controllers.
- `mockTasks.ts` uses `"In Progress"`, `"Blocked"`, `"Critical"` — these should be corrected in Phase 0. If Phase 0 is done correctly, TypeScript will catch any remaining mismatches in this module.
- The `handleCreateSubmit` in `TaskListPane.tsx` currently generates fake fields like `projectId`, `projectTitle`, `owner`, `labels`, `storyPoints` etc. that do not exist in the backend schema. When replacing with the real mutation, only send fields the API accepts.
