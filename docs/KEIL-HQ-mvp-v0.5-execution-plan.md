# KEIL HQ — MVP v0.5 Parallel Execution Plan
> **For team execution, stakeholder review, and merge discipline.**
> **2 Full-Stack Developers · AI-Assisted · Module-by-Module Delivery**

---

## Quick Reference

| Symbol | Meaning |
|--------|---------|
| 🔵 Dev A | Primary owner: backend controllers, validation, service wiring |
| 🟢 Dev B | Primary owner: TanStack Query hooks, frontend integration |
| 🤝 Shared | Both developers must align before or during this step |
| 🔴 BLOCKER | Work cannot start until this gate is cleared |
| ⚠️ RISK | Decision or area that needs attention before coding |
| ✅ EXIT | This criterion must be true before the module is considered done |

---

## How to Read This Document

This plan is **module-first, not sprint-first**. Every module has:
- A clear **scope boundary** — what's in, what's out
- Explicit **ownership** — who owns what file/layer at any moment
- A **contract-first rule** — both developers agree on API shape before coding
- **Entry gates** — what must be true before this module starts
- **Exit criteria** — what must be true before this module merges

> ⚠️ **Golden Rule**: A module is not done when code is written. It is done when the module works end-to-end on `develop`, is reviewed, and meets all exit criteria below.

---

## Confirmed Non-Negotiables (Respect These Always)

These are locked decisions. **Do not re-open them during execution.**

| Decision | What it means |
|---------|---------------|
| Backend is source of truth | Frontend types, enums, and shapes must always mirror backend |
| `Blocked` is derived, not stored | No `blocked` in DB enum. UI computes it from dependency state |
| `urgent` not `critical` | Frontend must use `urgent` everywhere |
| Task status values | `backlog` · `todo` · `in-progress` · `done` |
| Task priority values | `low` · `medium` · `high` · `urgent` |
| TanStack Query everywhere | No ad hoc axios calls, no component-local server state |
| Auto-workspace on login | Backend auto-creates workspace for users with none |
| Schedule & Chat parked | Do not touch these modules in MVP v0.5 |
| UI wired first, redesigned later | Do not redesign UI while core features are disconnected |
| 1 workspace per user | Enforced at DB level: `UNIQUE(user_id)` in `workspace_members` |

---

## Tech Stack (Do Not Deviate)

### Backend
- **Runtime**: Node.js + TypeScript
- **Framework**: Express.js v5
- **Database**: PostgreSQL via Supabase (`pg` pool)
- **Auth**: Supabase JWT → `auth.middleware.ts` → `req.user`
- **Response pattern**: `new ApiResponse(statusCode, data, message)`
- **Error pattern**: `catchAsync` wrapper + `ApiError` class
- **Architecture**: Route → Controller → Service → Repository → PostgreSQL

### Frontend
- **Framework**: React + TypeScript
- **Data layer**: TanStack Query (React Query v5)
- **Auth**: Supabase client
- **Hook location**: `src/hooks/api/`

---

## Repository & Branch Strategy

```
main          ← always stable · merge-protected · reviewed only
  └── develop ← integration branch · both developers merge here
        ├── feature/phase0-be    (Dev A)
        ├── feature/phase0-fe    (Dev B)
        ├── feature/tasks-be     (Dev A)
        ├── feature/tasks-fe     (Dev B)
        ├── feature/assignees-deps-be  (Dev A)
        ├── feature/assignees-deps-fe  (Dev B)
        ├── feature/comments-be  (Dev A)
        ├── feature/comments-fe  (Dev B)
        ├── feature/activity-be  (Dev A)
        ├── feature/activity-fe  (Dev B)
        ├── feature/dashboard-be (Dev A)
        └── feature/dashboard-fe (Dev B)
```

### Merge Flow (same for every module)

```
Step 1 → 🤝 Both agree on API contract for the module
Step 2 → 🔵 Dev A works on feature/<module>-be
Step 3 → 🟢 Dev B works on feature/<module>-fe
Step 4 → Both branches merge into develop
Step 5 → End-to-end test on develop together
Step 6 → 🤝 Both do code review
Step 7 → Owner merges develop → main
```

### File Ownership Rules (Conflict Prevention)

> **Two developers must never have overlapping write ownership on the same files at the same time.**

| Files | Owned By |
|-------|----------|
| `backend/src/controllers/**` | 🔵 Dev A |
| `backend/src/services/**` | 🔵 Dev A |
| `backend/src/routes/**` | 🔵 Dev A |
| `backend/src/middlewares/**` | 🔵 Dev A |
| `backend/src/models/**` | 🔵 Dev A |
| `backend/src/utils/**` | 🔵 Dev A |
| `frontend/src/hooks/api/**` | 🟢 Dev B |
| `frontend/src/pages/**` | 🟢 Dev B |
| `frontend/src/components/**` | 🟢 Dev B |
| `frontend/src/types/**` | 🤝 Shared — align before touching |
| `frontend/src/lib/queryClient.ts` | 🟢 Dev B (set up once in Phase 0) |
| `docs/**` | 🤝 Shared |

---

## Module Dependency Map

```
Phase 0 — Foundation
    └── Module 1 — Tasks Core
            └── Module 2 — Assignees & Dependencies
            └── Module 3 — Comments
                    └── Module 4 — Activity Feed
                            └── Module 5 — Dashboard
```

> 🔴 **Sequential dependency is unavoidable for Phase 0 → Module 1.**
> Phase 0 cannot be parallelized against Module 1 because Module 1 requires workspace ID, TanStack Query, and aligned types — all of which Phase 0 produces.
>
> After Phase 0, Modules 2 and 3 can be worked on in parallel (one dev on each), because they extend tasks independently without touching each other's files.

---

---

# Phase 0 — Foundation

> **This phase must complete before any other module starts.**
> **Both developers work together here — this is the only fully sequential phase.**

## Scope

Phase 0 establishes the shared infrastructure that every module depends on. If this is skipped or done carelessly, every later module breaks.

**In scope:**
- `GET /api/v1/users/me` endpoint (creates workspace if missing)
- Standardized controller pattern for all future modules
- Backend validation helper
- TanStack Query global setup
- Frontend type alignment with backend enums
- Auth bootstrap hook (fetch user + workspace on login)
- Remove `blocked` as stored status; remove `critical` as priority

**Out of scope:**
- Workspace invite UI
- Workspace member management UI
- Any task features

---

## Phase 0 — Ownership Table

| Task | Owner | Branch |
|------|-------|--------|
| `GET /api/v1/users/me` controller | 🔵 Dev A | `feature/phase0-be` |
| Auto-workspace creation logic (transactional) | 🔵 Dev A | `feature/phase0-be` |
| Standardize controller pattern | 🔵 Dev A | `feature/phase0-be` |
| Backend validation helpers | 🔵 Dev A | `feature/phase0-be` |
| Install + configure TanStack Query | 🟢 Dev B | `feature/phase0-fe` |
| Align `src/types/task.ts` to backend enums | 🟢 Dev B | `feature/phase0-fe` |
| Remove `Blocked` status from frontend | 🟢 Dev B | `feature/phase0-fe` |
| Replace `critical` with `urgent` globally | 🟢 Dev B | `feature/phase0-fe` |
| Create `useMe()` hook | 🟢 Dev B | `feature/phase0-fe` |
| Auth bootstrap flow (user + workspace) | 🟢 Dev B | `feature/phase0-fe` |
| Create hook file stubs for all modules | 🟢 Dev B | `feature/phase0-fe` |

---

## Phase 0 — API Contract (🤝 Lock Before Coding)

### `GET /api/v1/users/me`

**Auth required**: Yes (Supabase JWT → `req.user`)

**Behavior**: If user has no workspace, auto-create one transactionally.

**Success Response:**
```json
{
  "statusCode": 200,
  "success": true,
  "message": "User fetched successfully",
  "data": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "Ritik",
    "workspace": {
      "id": "workspace-uuid",
      "name": "Ritik's Workspace",
      "role": "owner"
    }
  }
}
```

**Auto-workspace naming rule:**
- `"<name>'s Workspace"` when name exists
- `"My Workspace"` when name is missing

**Workspace creation must be atomic:**
1. Check if user has any workspace membership
2. If none: create workspace → create `owner` membership in one transaction
3. Return user + workspace in same response

---

## Phase 0 — Backend Implementation Detail (🔵 Dev A)

### Controller pattern (apply to all future controllers)

```typescript
// Standard controller shape — use this for EVERY controller
export const getMe = catchAsync(async (req: Request, res: Response) => {
  // 1. Extract input from req
  const userId = req.user.id;

  // 2. Validate input (use shared validator)
  // (no body validation needed here, but show the pattern)

  // 3. Call service
  const result = await userService.getMeWithWorkspace(userId);

  // 4. Return unified response
  return res.status(200).json(new ApiResponse(200, result, "User fetched successfully"));
  // 5. Errors are caught by catchAsync → central error middleware
});
```

### Validation helper to build

Create `backend/src/utils/validate.ts` (or similar). Must support:
- Required string/UUID checks
- Enum value validation (status, priority, role)
- Date range validation (`due_date >= start_date`)
- Optional field detection

---

## Phase 0 — Frontend Implementation Detail (🟢 Dev B)

### TanStack Query setup

```typescript
// src/lib/queryClient.ts
import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});
```

### Query key convention (lock this now)

```typescript
// All query keys must follow this pattern
export const QUERY_KEYS = {
  me: ["me"],
  tasks: (workspaceId: string) => ["tasks", workspaceId],
  task: (taskId: string) => ["task", taskId],
  comments: (taskId: string) => ["comments", taskId],
  activity: (workspaceId: string) => ["activity", workspaceId],
  dashboard: (workspaceId: string) => ["dashboard", workspaceId],
};
```

### Hook file stubs (create all of these in Phase 0, even if empty)

```
src/hooks/api/
  useMe.ts        ← implement now
  useTasks.ts     ← stub now, implement in Module 1
  useComments.ts  ← stub now, implement in Module 3
  useActivity.ts  ← stub now, implement in Module 4
  useDashboard.ts ← stub now, implement in Module 5
```

### Type alignment (align now, never drift again)

```typescript
// src/types/task.ts — final values
export type TaskStatus = "backlog" | "todo" | "in-progress" | "done";
export type TaskPriority = "low" | "medium" | "high" | "urgent";

// Blocked is NOT a status. It is derived:
export function isTaskBlocked(task: Task): boolean {
  return task.dependencies?.some(dep => dep.status !== "done") ?? false;
}
```

---

## Phase 0 — Risks

| Risk | Mitigation |
|------|-----------|
| Auto-workspace creation fails silently | Must be transactional + test negative case (user with no workspace) |
| Frontend still has `critical` or `Blocked` in hidden places | Dev B must grep for both strings and eliminate them completely |
| TanStack Query version mismatch | Lock version in `package.json` before Dev B starts |
| `workspaceId` not available when task hooks run | Bootstrap hook must complete before any task query fires |

---

## Phase 0 — Exit Criteria

> ✅ Do not open any Module 1 branches until **all** of these are true.

- [ ] `GET /api/v1/users/me` returns user + workspace
- [ ] Auto-workspace creates successfully for a new user
- [ ] Auto-workspace is idempotent (calling twice doesn't create two workspaces)
- [ ] Frontend `useMe()` hook fetches and exposes `workspaceId`
- [ ] TanStack Query provider wraps the entire app
- [ ] Frontend type file has zero references to `critical` or `Blocked` (as stored status)
- [ ] All enum values are `backlog | todo | in-progress | done` and `low | medium | high | urgent`
- [ ] All hook stubs exist in `src/hooks/api/`
- [ ] Auth flow works: sign in → bootstrap → workspace context available

---

---

# Module 1 — Tasks Core

> **This is the heaviest and most critical module. Get this right.**
> **🔴 Requires Phase 0 to be fully merged into `develop` first.**

## Scope

**In scope:**
- Full CRUD: create, read (list + detail), update, delete
- Status change as a dedicated operation
- Server-side filtering (status, priority, assignee, due_date)
- Server-side sorting (due_date, priority, created_at)
- Server-side pagination (limit + offset)
- Parent-child tasks via `parent_task_id`
- Objective and success criteria fields
- Date validation (`due_date >= start_date`)
- Workspace scoping (task cannot be accessed outside its workspace)
- Replace all mock task state with live API-backed state

**Out of scope (do in Module 2):**
- Assignee assignment/removal endpoints
- Dependency management

---

## Module 1 — Ownership Table

| Task | Owner | Branch |
|------|-------|--------|
| Wire `createTask` controller to service | 🔵 Dev A | `feature/tasks-be` |
| Wire `getTasks` controller (with filters + pagination) | 🔵 Dev A | `feature/tasks-be` |
| Wire `getTaskById` controller | 🔵 Dev A | `feature/tasks-be` |
| Wire `updateTask` controller | 🔵 Dev A | `feature/tasks-be` |
| Wire `deleteTask` controller | 🔵 Dev A | `feature/tasks-be` |
| Wire `changeTaskStatus` controller | 🔵 Dev A | `feature/tasks-be` |
| Validate all task payloads | 🔵 Dev A | `feature/tasks-be` |
| Workspace scoping for all task endpoints | 🔵 Dev A | `feature/tasks-be` |
| `parent_task_id` support in create + fetch | 🔵 Dev A | `feature/tasks-be` |
| Implement `useTasks` hook | 🟢 Dev B | `feature/tasks-fe` |
| Implement `useTask` hook | 🟢 Dev B | `feature/tasks-fe` |
| Implement `useCreateTask` mutation | 🟢 Dev B | `feature/tasks-fe` |
| Implement `useUpdateTask` mutation | 🟢 Dev B | `feature/tasks-fe` |
| Implement `useDeleteTask` mutation | 🟢 Dev B | `feature/tasks-fe` |
| Implement `useChangeTaskStatus` mutation | 🟢 Dev B | `feature/tasks-fe` |
| Replace mock task state in task list page | 🟢 Dev B | `feature/tasks-fe` |
| Replace mock task state in task detail page | 🟢 Dev B | `feature/tasks-fe` |
| Add loading / empty / error states to all task views | 🟢 Dev B | `feature/tasks-fe` |
| Adapt create/edit forms to backend shape | 🟢 Dev B | `feature/tasks-fe` |

---

## Module 1 — API Contract (🤝 Lock Before Coding)

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v1/tasks` | Create task |
| `GET` | `/api/v1/tasks` | List tasks with filters + pagination |
| `GET` | `/api/v1/tasks/:id` | Get task by ID |
| `PATCH` | `/api/v1/tasks/:id` | Update task fields |
| `DELETE` | `/api/v1/tasks/:id` | Delete task |
| `PATCH` | `/api/v1/tasks/:id/status` | Change task status only |

### Query Parameters for `GET /api/v1/tasks`

```
?status=todo
?priority=urgent
?assignee=<userId>
?due_date=2025-04-01
?sort_by=due_date|priority|created_at
?sort_order=asc|desc
?limit=20
?offset=0
```

### `POST /api/v1/tasks` — Request Body

```json
{
  "title": "string (required)",
  "description": "string (optional)",
  "status": "backlog | todo | in-progress | done",
  "priority": "low | medium | high | urgent",
  "start_date": "ISO timestamp (optional)",
  "due_date": "ISO timestamp (optional, must be >= start_date)",
  "parent_task_id": "uuid (optional)",
  "objective": "string (optional)",
  "success_criteria": "string (optional)"
}
```

### Task Response Shape

```json
{
  "statusCode": 200,
  "success": true,
  "message": "Tasks fetched successfully",
  "data": {
    "tasks": [
      {
        "id": "uuid",
        "title": "string",
        "description": "string | null",
        "status": "todo",
        "priority": "high",
        "start_date": "2025-04-01T00:00:00Z | null",
        "due_date": "2025-04-05T00:00:00Z | null",
        "parent_task_id": "uuid | null",
        "objective": "string | null",
        "success_criteria": "string | null",
        "workspace_id": "uuid",
        "created_at": "2025-03-01T00:00:00Z",
        "updated_at": "2025-03-01T00:00:00Z"
      }
    ],
    "pagination": {
      "total": 100,
      "limit": 20,
      "offset": 0,
      "has_more": true
    }
  }
}
```

### Validation Rules (Backend enforces, Frontend respects)

| Field | Rule |
|-------|------|
| `title` | Required, non-empty string |
| `status` | Must be a valid `task_status` enum value |
| `priority` | Must be a valid `task_priority` enum value |
| `due_date` | If provided, must be `>= start_date` |
| `parent_task_id` | Must exist and belong to same workspace |
| Task ID in path | Must be a valid UUID belonging to user's workspace |

---

## Module 1 — Parallel Work Rules

> Both branches can proceed in parallel after the contract above is locked.

**Dev A must not touch:**
- `frontend/` directory files

**Dev B must not touch:**
- `backend/src/controllers/task*`
- `backend/src/services/task*`
- `backend/src/routes/task*`

**Shared files that need coordination:**
- `frontend/src/types/task.ts` → Dev B owns, Dev A must not modify

---

## Module 1 — Risks

| Risk | Mitigation |
|------|-----------|
| Controller wiring misses workspace scoping | Dev A must add workspace scope check to every task query |
| Frontend hook fires before `workspaceId` is available | `useTasks` must be disabled/suspended until `workspaceId` exists |
| Pagination shape differs between backend and frontend expectation | Lock the exact `pagination` response shape in this document before coding |
| Form fields don't map to backend shape | Dev B must read API contract and remap form field names exactly |
| `parent_task_id` creates circular hierarchy in DB | Already guarded by `CHECK (task_id <> depends_on_task_id)` in DB — Dev A must not bypass it |

---

## Module 1 — Exit Criteria

> ✅ Do not open Module 2 or 3 branches until **all** of these are true on `develop`.

- [ ] Task creation works and task appears in list immediately
- [ ] Task list fetches live data (zero mock task state)
- [ ] Task detail view fetches live data
- [ ] Task update persists correctly
- [ ] Task deletion removes task from list
- [ ] Status change persists and reflects in list
- [ ] Filter by `status` works
- [ ] Filter by `priority` works
- [ ] Sort by `due_date` works
- [ ] Pagination navigation works
- [ ] Subtask (child task) can be created with valid `parent_task_id`
- [ ] Validation errors are returned for invalid payload and shown in UI
- [ ] All task views show proper loading, empty, and error states
- [ ] No component imports mock task data anymore

---

---

# Module 2 — Assignees & Dependencies

> **Can start after Module 1 exit criteria are met.**
> **This module extends tasks. Does not replace or modify the task CRUD layer.**

## Scope

**In scope:**
- Add assignee to task
- Remove assignee from task
- Fetch assignees as part of task detail
- Add dependency between tasks
- Remove dependency between tasks
- Circular dependency prevention (backend)
- Block status transition: cannot mark task `done` if dependencies are incomplete
- UI shows derived `blocked` indicator (no DB enum change)

**Out of scope:**
- Comments (Module 3)
- Workspace member management UI

---

## Module 2 — Ownership Table

| Task | Owner | Branch |
|------|-------|--------|
| `POST /api/v1/tasks/:id/assignees` | 🔵 Dev A | `feature/assignees-deps-be` |
| `DELETE /api/v1/tasks/:id/assignees/:userId` | 🔵 Dev A | `feature/assignees-deps-be` |
| `POST /api/v1/tasks/:id/dependencies` | 🔵 Dev A | `feature/assignees-deps-be` |
| `DELETE /api/v1/tasks/:id/dependencies/:depId` | 🔵 Dev A | `feature/assignees-deps-be` |
| Circular dependency check in service | 🔵 Dev A | `feature/assignees-deps-be` |
| Block `done` status if dep is incomplete (service) | 🔵 Dev A | `feature/assignees-deps-be` |
| Include assignees in task detail response | 🔵 Dev A | `feature/assignees-deps-be` |
| `useAssignTaskUser` mutation hook | 🟢 Dev B | `feature/assignees-deps-fe` |
| `useRemoveTaskUser` mutation hook | 🟢 Dev B | `feature/assignees-deps-fe` |
| `useAddDependency` mutation hook | 🟢 Dev B | `feature/assignees-deps-fe` |
| `useRemoveDependency` mutation hook | 🟢 Dev B | `feature/assignees-deps-fe` |
| Derived `isBlocked()` UI logic | 🟢 Dev B | `feature/assignees-deps-fe` |
| Assignee selector in task detail/edit | 🟢 Dev B | `feature/assignees-deps-fe` |
| Dependency picker in task detail | 🟢 Dev B | `feature/assignees-deps-fe` |
| Blocked indicator in task list + detail | 🟢 Dev B | `feature/assignees-deps-fe` |

---

## Module 2 — API Contract (🤝 Lock Before Coding)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v1/tasks/:id/assignees` | Assign user to task |
| `DELETE` | `/api/v1/tasks/:id/assignees/:userId` | Remove assignee |
| `POST` | `/api/v1/tasks/:id/dependencies` | Add dependency |
| `DELETE` | `/api/v1/tasks/:id/dependencies/:depId` | Remove dependency |

### Task Detail Response — Updated to include assignees & dependencies

```json
{
  "data": {
    "id": "uuid",
    "title": "...",
    "assignees": [
      { "id": "user-uuid", "name": "Alice", "email": "alice@example.com" }
    ],
    "dependencies": [
      { "id": "dep-uuid", "task_id": "uuid", "depends_on_task_id": "uuid", "depends_on_task": { "id": "uuid", "title": "...", "status": "in-progress" } }
    ]
  }
}
```

### Derived Blocked State (Frontend Only)

```typescript
// This is the ONLY place "blocked" logic lives
export function isTaskBlocked(task: TaskDetail): boolean {
  return (task.dependencies ?? []).some(
    (dep) => dep.depends_on_task.status !== "done"
  );
}
```

---

## Module 2 — Risks

| Risk | Mitigation |
|------|-----------|
| Circular dependency slips through | Dev A must implement graph traversal check in service, not just DB constraint |
| `done` status bypass when deps exist | Service layer for `changeTaskStatus` must query dependency table before allowing transition |
| UI `Blocked` filter sends status query to backend | Dev B must implement this as a frontend filter on already-fetched data, not a query param |

---

## Module 2 — Exit Criteria

- [ ] Assignees can be added to a task and persist
- [ ] Assignees can be removed
- [ ] Dependencies can be added between tasks
- [ ] Dependencies can be removed
- [ ] Task cannot be marked `done` if any dependency is in `backlog`, `todo`, or `in-progress`
- [ ] Circular dependency is rejected by backend with clear error
- [ ] UI shows blocked indicator without any `blocked` value in DB or response enums
- [ ] Task detail page shows assignees and dependencies from live API

---

---

# Module 3 — Comments

> **Can start after Module 1 exit criteria are met.**
> **Module 3 and Module 2 can be worked in parallel — they touch different files.**

## Scope

**In scope:**
- Get comments for a task (paginated)
- Create top-level comment
- Create reply to an existing comment
- Delete comment (hard delete, cascades to replies)

**Out of scope:**
- Comment editing
- Reactions or mentions
- Real-time updates (no WebSocket in MVP v0.5)

---

## Module 3 — Ownership Table

| Task | Owner | Branch |
|------|-------|--------|
| `GET /api/v1/tasks/:id/comments` | 🔵 Dev A | `feature/comments-be` |
| `POST /api/v1/tasks/:id/comments` | 🔵 Dev A | `feature/comments-be` |
| `POST /api/v1/tasks/:id/comments/:commentId/replies` | 🔵 Dev A | `feature/comments-be` |
| `DELETE /api/v1/tasks/:id/comments/:commentId` | 🔵 Dev A | `feature/comments-be` |
| Cascade delete on reply parent removal | 🔵 Dev A | `feature/comments-be` |
| Workspace + task scoping for comments | 🔵 Dev A | `feature/comments-be` |
| `useTaskComments` query hook | 🟢 Dev B | `feature/comments-fe` |
| `useCreateComment` mutation hook | 🟢 Dev B | `feature/comments-fe` |
| `useCreateReply` mutation hook | 🟢 Dev B | `feature/comments-fe` |
| `useDeleteComment` mutation hook | 🟢 Dev B | `feature/comments-fe` |
| Wire task detail comment area to live data | 🟢 Dev B | `feature/comments-fe` |
| Refresh comment list after create/delete | 🟢 Dev B | `feature/comments-fe` |

---

## Module 3 — API Contract (🤝 Lock Before Coding)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/tasks/:id/comments` | List comments (paginated) |
| `POST` | `/api/v1/tasks/:id/comments` | Create top-level comment |
| `POST` | `/api/v1/tasks/:id/comments/:commentId/replies` | Create reply |
| `DELETE` | `/api/v1/tasks/:id/comments/:commentId` | Delete comment |

### Comment Response Shape

```json
{
  "data": {
    "comments": [
      {
        "id": "uuid",
        "content": "string",
        "author": { "id": "uuid", "name": "string" },
        "parent_comment_id": null,
        "replies": [
          {
            "id": "uuid",
            "content": "string",
            "author": { "id": "uuid", "name": "string" },
            "parent_comment_id": "uuid",
            "created_at": "ISO"
          }
        ],
        "created_at": "ISO"
      }
    ],
    "pagination": { "total": 10, "limit": 20, "offset": 0, "has_more": false }
  }
}
```

---

## Module 3 — Parallel Work Note

> ⚠️ **Module 2 and Module 3 can run fully in parallel** because:
> - Module 2 touches `assignees` and `dependencies` tables and hooks
> - Module 3 touches `comments` table and hooks
> - No shared files between these two branches

Both dev branches can be open simultaneously:
- Dev A works `feature/assignees-deps-be` AND `feature/comments-be` sequentially or hands off
- Dev B works `feature/assignees-deps-fe` AND `feature/comments-fe` sequentially or hands off

---

## Module 3 — Exit Criteria

- [ ] Comments load from backend on task detail page
- [ ] New comment can be created and appears immediately (optimistic or refetch)
- [ ] Reply can be created under a top-level comment
- [ ] Deleting a top-level comment removes it and all its replies
- [ ] Pagination works for large comment threads
- [ ] UI refreshes correctly after all mutations
- [ ] No mock comment data remains anywhere

---

---

# Module 4 — Activity Feed / Audit Logs

> **🔴 Start only after Module 1, 2, and 3 are merged to `develop`.**
> **Activity data is only meaningful once real task/comment/dependency actions exist.**

## Scope

**In scope:**
- Workspace-level activity feed (paginated, newest first)
- Task-level activity (optional, if UI has a dedicated history panel)
- Log types to expose:
  - `task_created`, `task_deleted`
  - `status_changed`
  - `assignment_changed`
  - `due_date_changed`
  - `dependency_changed`
  - `comment_created`, `comment_deleted`
  - `objective_updated`, `success_criteria_updated`

**Out of scope:**
- Real-time activity push
- User-level activity filtering by actor

---

## Module 4 — Ownership Table

| Task | Owner | Branch |
|------|-------|--------|
| `GET /api/v1/activity` (workspace-scoped) | 🔵 Dev A | `feature/activity-be` |
| `GET /api/v1/tasks/:id/activity` (optional) | 🔵 Dev A | `feature/activity-be` |
| Pagination + sort (newest first) | 🔵 Dev A | `feature/activity-be` |
| Workspace scoping via `req.user` (no path param needed) | 🔵 Dev A | `feature/activity-be` |
| `useWorkspaceActivity` hook | 🟢 Dev B | `feature/activity-fe` |
| `useTaskActivity` hook (optional) | 🟢 Dev B | `feature/activity-fe` |
| Replace mock activity/history in UI | 🟢 Dev B | `feature/activity-fe` |
| Paginated activity feed component | 🟢 Dev B | `feature/activity-fe` |

---

## Module 4 — API Contract (🤝 Lock Before Coding)

> **Important**: The `/api/v1/activity` endpoint does NOT need `workspaceId` as a path param.
> Backend extracts workspace from `req.user` (1 workspace per user rule).

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/activity` | Workspace activity feed |
| `GET` | `/api/v1/tasks/:id/activity` | Task-scoped activity (optional) |

### Activity Response Shape

```json
{
  "data": {
    "activity": [
      {
        "id": "uuid",
        "entity_type": "task",
        "entity_id": "uuid",
        "action": "status_changed",
        "actor": { "id": "uuid", "name": "string" },
        "old_value": { "status": "todo" },
        "new_value": { "status": "in-progress" },
        "created_at": "ISO"
      }
    ],
    "pagination": { "total": 50, "limit": 20, "offset": 0, "has_more": true }
  }
}
```

> ⚠️ `entity_id` is a bare UUID — NOT a foreign key. Logs persist even if the task is deleted. Do not attempt to JOIN `entity_id` to task table on frontend.

---

## Module 4 — Exit Criteria

- [ ] Activity feed loads real data on workspace view
- [ ] Activity entries appear after performing task/comment/dependency actions
- [ ] Newest entries appear first
- [ ] Pagination works
- [ ] No mock/fake activity data remains in UI
- [ ] Deleted task activity still appears (entity_id is preserved)

---

---

# Module 5 — Dashboard

> **🔴 Start only after Module 1 and Module 4 are merged to `develop`.**
> **Dashboard depends on live task data and activity for meaningful output.**

## Scope

**In scope:**
- 4 dashboard buckets:
  1. **Immediate Tasks** — urgent priority + due within 24–48h
  2. **Today's Tasks** — due or scheduled today
  3. **Blocked Tasks** — derived: has incomplete dependencies
  4. **Backlog** — standard backlog items
- Ranking formula applied by backend
- Replace all hardcoded/mock dashboard cards

**Out of scope:**
- Charts or analytics
- Team-level dashboard (MVP v0.5 is per-user workspace)

---

## Module 5 — Ownership Table

| Task | Owner | Branch |
|------|-------|--------|
| `GET /api/v1/dashboard` controller | 🔵 Dev A | `feature/dashboard-be` |
| Bucket query logic in service | 🔵 Dev A | `feature/dashboard-be` |
| Ranking formula (priority weight + time proximity) | 🔵 Dev A | `feature/dashboard-be` |
| Blocked tasks derived in service (query dep table) | 🔵 Dev A | `feature/dashboard-be` |
| `useDashboard` hook | 🟢 Dev B | `feature/dashboard-fe` |
| Map existing dashboard widgets to backend buckets | 🟢 Dev B | `feature/dashboard-fe` |
| Handle partial/empty bucket gracefully | 🟢 Dev B | `feature/dashboard-fe` |
| Loading and error states for dashboard | 🟢 Dev B | `feature/dashboard-fe` |

---

## Module 5 — API Contract (🤝 Lock Before Coding)

> Same as Activity — no `workspaceId` in path. Backend resolves it from `req.user`.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/dashboard` | Workspace dashboard buckets |

### Dashboard Response Shape

```json
{
  "data": {
    "immediate": [
      { "id": "uuid", "title": "...", "priority": "urgent", "due_date": "ISO", "status": "in-progress" }
    ],
    "today": [ ... ],
    "blocked": [ ... ],
    "backlog": [ ... ]
  }
}
```

### Ranking Formula (Backend Must Implement)

```
score = priority_weight + time_proximity_weight

priority_weight:
  urgent = 3
  high   = 2
  medium = 1
  low    = 0

time_proximity_weight (add to priority_weight):
  due within 24h  = +3
  due within 48h  = +2
  due within 7d   = +1
  beyond 7d       = 0

Sort buckets by score DESC.
```

---

## Module 5 — Exit Criteria

- [ ] Dashboard loads live data (no hardcoded cards)
- [ ] Immediate tasks bucket shows urgent + near-due tasks correctly
- [ ] Today's tasks bucket shows tasks due today
- [ ] Blocked bucket shows tasks with incomplete dependencies
- [ ] Backlog bucket shows backlog tasks
- [ ] Ranking is applied correctly within each bucket
- [ ] Empty buckets render gracefully (no crash, no skeleton loop)
- [ ] Dashboard works after page refresh (TanStack Query)

---

---

# What Is Explicitly Parked (Do Not Touch in MVP v0.5)

| Module | Reason Parked |
|--------|--------------|
| Workspace invite & member management UI | Backend auto-creation removes the blocker; UI can come after |
| Schedule module | Not on MVP v0.5 execution path |
| Chat module | Not on MVP v0.5 execution path |
| UI / UX redesign | Wire first, redesign after live integration is stable |
| Real-time (WebSocket) | Not in MVP v0.5 scope |
| Comment editing | Not in MVP v0.5 scope |

---

# Testing Checklist Per Module (Use in PRs)

Paste this into every PR description and check off before requesting review.

```markdown
## Module Test Checklist

### Backend
- [ ] Happy path works (curl or Postman test included)
- [ ] Bad input (invalid enum, missing required field) is rejected with correct error
- [ ] Workspace scoping enforced (can't access another user's tasks)
- [ ] Auth-protected: unauthenticated request returns 401
- [ ] Edge cases tested (empty list, not found, etc.)

### Frontend
- [ ] Loading state shows correctly
- [ ] Empty state shows correctly
- [ ] Error state shows correctly (API failure)
- [ ] Data persists after browser refresh
- [ ] No mock data dependency remains for this module
- [ ] Mutations invalidate and refetch correctly
- [ ] Console is clean (no unhandled errors or warnings)

### Integration
- [ ] Full flow works on `develop` branch
- [ ] Create → Read → Update → Delete tested end-to-end
- [ ] Auth flow still works after changes
```

---

# Merge Readiness Gate (All Modules)

A module branch is **not allowed to merge into `develop`** unless:

| Gate | Status |
|------|--------|
| Backend endpoint responds correctly | ✅ Required |
| Frontend uses live data (zero mock) | ✅ Required |
| Validation in place (backend + form) | ✅ Required |
| Loading / empty / error states handled | ✅ Required |
| Workspace scoping verified | ✅ Required |
| Module works after page refresh | ✅ Required |
| End-to-end test on `develop` passed | ✅ Required |
| Code review by other developer | ✅ Required |
| PR test checklist filled and all checked | ✅ Required |

---

# Final Execution Order Summary

```
Phase 0   → 🤝 Both developers · sequential · must finish completely
    ↓
Module 1  → 🔵 Dev A (be) + 🟢 Dev B (fe) · parallel
    ↓
Module 2  → 🔵 Dev A (be) + 🟢 Dev B (fe) · parallel with Module 3
Module 3  → 🔵 Dev A (be) + 🟢 Dev B (fe) · parallel with Module 2
    ↓
Module 4  → 🔵 Dev A (be) + 🟢 Dev B (fe) · parallel · needs M1+M2+M3
    ↓
Module 5  → 🔵 Dev A (be) + 🟢 Dev B (fe) · parallel · needs M1+M4
    ↓
Post-MVP  → UI/UX polish · Workspace UI · Schedule · Chat
```

---

# Document Maintenance

- This document is the **single source of truth** for what is in scope and in what order.
- API contracts defined here are **frozen once a module starts**.
- Any breaking change to a contract during active development **requires both developers to stop and align** before continuing.
- The tech lead or project owner should update the exit criteria checkboxes as modules complete.
