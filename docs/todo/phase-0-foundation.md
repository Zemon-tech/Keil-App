# Phase 0 — Foundation

## Overview

One-time setup that every module depends on. Neither developer should start Module 1 until all items in this file are checked off. This phase has no user-facing feature — it exists to make all future integration safe and fast.

**Branch:** `feature/foundation-be` (Dev A) · `feature/foundation-fe` (Dev B)  
**Merge target:** `develop` → owner reviews → `main`

---

## Context for Developers

### What already exists

**Backend**
- Auth middleware (`src/middlewares/auth.middleware.ts`) already verifies Supabase JWT and attaches the `public.users` row to `req.user` as `{ id, email, name, created_at }`
- `GET /api/users/me` exists in `src/routes/user.routes.ts` and is mounted at `/api/users/me` — but it only returns `req.user` with no workspace info
- `workspaceService` (`src/services/workspace.service.ts`) has `createWorkspace()` and `getUserWorkspace()` fully implemented
- `workspaceRepository` (`src/repositories/workspace.repository.ts`) has `findByUserId()` ready to use
- `ApiResponse` and `ApiError` utilities exist in `src/utils/`

**Frontend**
- Supabase auth is working — `AuthContext.tsx` manages session and already calls `api.get('users/me')` after login (non-blocking, currently ignored)
- Axios API client (`src/lib/api.ts`) auto-attaches the Supabase JWT to every request
- `main.tsx` currently wraps the app with `BrowserRouter`, `AuthProvider`, `ThemeProvider` — no TanStack Query yet
- `src/types/task.ts` uses wrong status/priority strings (`"In Progress"`, `"Blocked"`, `"Critical"`) that conflict with backend enums

### What is missing

- `GET /api/users/me` does not return workspace info and does not auto-create a workspace
- Frontend has no workspace context — `workspaceId` is unavailable to any component
- TanStack Query is not installed or configured
- Frontend status/priority types do not match backend PostgreSQL enums
- Mock data in `mockTasks.ts` uses the wrong enum values

### Why this matters for later modules

Every task API call requires a `workspace_id`. Without a WorkspaceContext, Module 1 cannot start. Without fixed types, every integration point will have TypeScript errors.

---

## API Contract

Both developers must agree on this shape before writing any code.

**Endpoint:** `GET /api/users/me`  
**Auth:** Required (Bearer token)

**Success response `200`:**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "User profile retrieved successfully",
  "data": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "User Name or null",
    "created_at": "ISO string",
    "workspace": {
      "id": "uuid",
      "name": "User Name's Workspace",
      "role": "owner"
    }
  }
}
```

**Notes:**
- `workspace` is always present after this endpoint runs — it auto-creates if missing
- `role` is `"owner" | "admin" | "member"` from the `member_role` DB enum
- This is the only endpoint needed in Phase 0

---

## Dev A — Backend Deliverables

**File:** `backend/src/routes/user.routes.ts`  
**File:** `backend/src/controllers/` (create `user.controller.ts`)

### Tasks

- [ ] Create `backend/src/controllers/user.controller.ts`
- [ ] In `getMe` controller: extract `user` from `(req as any).user`
- [ ] Call `workspaceRepository.findByUserId(user.id)` to check for existing workspace
- [ ] If no workspace found: call `workspaceService.createWorkspace({ name: "<name>'s Workspace" or "My Workspace", owner_id: user.id })` inside a try/catch
- [ ] Fetch the user's role from `workspace_members` table using `workspaceRepository.getMembers(workspace.id)` and find the current user's role
- [ ] Return `ApiResponse` with user + workspace shape matching the contract above
- [ ] Update `backend/src/routes/user.routes.ts` to import and use the new controller instead of the inline handler
- [ ] Ensure `protect` middleware is applied on the `/me` route (it already is — verify it stays)
- [ ] Add a `workspace_id` field onto `req` so downstream controllers can use it without re-fetching — extend the middleware or handle in controller (team decision)

### Validation rules

- [ ] If `user.id` is missing from `req.user`, return `401`
- [ ] Workspace auto-creation must be wrapped in a try/catch — if it fails, return `500` with a clear message
- [ ] Do not create a second workspace if one already exists (the service already enforces this via `UNIQUE owner_id` — verify the service throws `ApiError 400` correctly)

### Files to modify

| File | Change |
|---|---|
| `backend/src/routes/user.routes.ts` | Replace inline handler with controller import |
| `backend/src/controllers/user.controller.ts` | **Create new** — `getMe` handler |

---

## Dev B — Frontend Deliverables

### Task 1 — Fix type mismatches

- [ ] Open `frontend/src/types/task.ts`
- [ ] Change `TaskStatus` to: `"backlog" | "todo" | "in-progress" | "done"`
- [ ] Remove `"Blocked"` from `TaskStatus` entirely
- [ ] Change `TaskPriority` to: `"low" | "medium" | "high" | "urgent"`
- [ ] Remove `"Critical"` from `TaskPriority`
- [ ] Run TypeScript — fix every compile error the type change causes (the compiler will point to each broken file)

### Task 2 — Fix mock data

- [ ] Open `frontend/src/data/mockTasks.ts`
- [ ] Update all `status` values: `"In Progress"` → `"in-progress"`, `"Backlog"` → `"backlog"`, `"Done"` → `"done"`, `"Blocked"` → `"in-progress"` (temporarily, until deps are wired)
- [ ] Update all `priority` values: `"High"` → `"high"`, `"Medium"` → `"medium"`, `"Low"` → `"low"`, `"Critical"` → `"urgent"`

### Task 3 — Fix components using old enum strings

- [ ] Open `frontend/src/components/tasks/TaskListPane.tsx`
- [ ] Update `statusColorMap` (around L49–54): change keys to `"in-progress"`, `"backlog"`, `"done"`, `"todo"` — remove `"Blocked"`
- [ ] Update `FILTER_OPTIONS` (around L57–63): change filter logic from `"In Progress"` string to `"in-progress"`, `"Backlog"` to `"backlog"`, etc.
- [ ] Open `frontend/src/components/tasks/TaskDetailPane.tsx`
- [ ] Update `STATUS_OPTIONS` (around L55): use lowercase backend values
- [ ] Update `STATUS_COLOR` map (around L57–62): keys should be `"done"`, `"in-progress"`, `"backlog"`, `"todo"`
- [ ] Update `PRIORITY_CONFIG` (around L64–69): keys should be `"urgent"`, `"high"`, `"medium"`, `"low"` — rename `"Critical"` → `"urgent"`

### Task 4 — Install TanStack Query

- [ ] Run: `npm install @tanstack/react-query`
- [ ] Open `frontend/src/main.tsx`
- [ ] Import `QueryClient` and `QueryClientProvider` from `@tanstack/react-query`
- [ ] Create a `queryClient` instance with `defaultOptions`: `staleTime: 5 * 60 * 1000`, `retry: 1`
- [ ] Wrap the entire app tree with `<QueryClientProvider client={queryClient}>` — place it outside `AuthProvider` so it is available to everything
- [ ] (Optional but recommended) Add `ReactQueryDevtools` for dev builds only

### Task 5 — Create WorkspaceContext

- [ ] Create `frontend/src/contexts/WorkspaceContext.tsx`
- [ ] Define context shape: `{ workspaceId: string | null, workspaceName: string | null, workspaceRole: string | null, isLoading: boolean }`
- [ ] Inside the provider, call `GET /api/users/me` using TanStack Query (`useQuery`) — key: `["me"]`
- [ ] Once data is returned, expose `workspaceId`, `workspaceName`, `workspaceRole` to all consumers
- [ ] Export `useWorkspace()` hook — throw if used outside provider
- [ ] Add `WorkspaceProvider` to `main.tsx` — place it inside `AuthProvider` so it can access the session

### Task 6 — Create API hook folder structure

- [ ] Create folder: `frontend/src/hooks/api/`
- [ ] Create `frontend/src/hooks/api/useMe.ts` — wraps `GET /api/users/me` with `useQuery`
- [ ] Create empty placeholder files (just exports, no logic yet):
  - `frontend/src/hooks/api/useTasks.ts`
  - `frontend/src/hooks/api/useComments.ts`
  - `frontend/src/hooks/api/useActivity.ts`
  - `frontend/src/hooks/api/useDashboard.ts`

### Task 7 — Update AuthContext

- [ ] Open `frontend/src/contexts/AuthContext.tsx`
- [ ] The existing non-blocking `api.get('users/me')` call on auth state change can remain — it acts as a warm-up. No logic change needed here.
- [ ] Verify that `AuthProvider` wraps `WorkspaceProvider` correctly in `main.tsx` (session must exist before workspace fetch fires)

### Files to modify

| File | Change |
|---|---|
| `frontend/src/types/task.ts` | Fix `TaskStatus` and `TaskPriority` enums |
| `frontend/src/data/mockTasks.ts` | Update all status/priority string values |
| `frontend/src/components/tasks/TaskListPane.tsx` | Fix `statusColorMap`, filter strings |
| `frontend/src/components/tasks/TaskDetailPane.tsx` | Fix `STATUS_OPTIONS`, `STATUS_COLOR`, `PRIORITY_CONFIG` |
| `frontend/src/main.tsx` | Add `QueryClientProvider`, `WorkspaceProvider` |
| `frontend/src/contexts/WorkspaceContext.tsx` | **Create new** |
| `frontend/src/hooks/api/useMe.ts` | **Create new** |
| `frontend/src/hooks/api/useTasks.ts` | **Create new** (empty placeholder) |
| `frontend/src/hooks/api/useComments.ts` | **Create new** (empty placeholder) |
| `frontend/src/hooks/api/useActivity.ts` | **Create new** (empty placeholder) |
| `frontend/src/hooks/api/useDashboard.ts` | **Create new** (empty placeholder) |

---

## How This Affects the Other Developer

| If you are | What to wait for |
|---|---|
| Dev A (backend) | Dev B's type fixes are independent — no waiting needed. Both can work simultaneously. |
| Dev B (frontend) | The new `/api/users/me` response shape must be agreed on before `useMe.ts` is written. Agree on the contract above first. |

**After both merge to `develop`:**
- Manually verify: sign in → `GET /api/users/me` returns workspace data → workspace is auto-created for new users → `useWorkspace()` returns a valid `workspaceId`
- Only then start Module 1

---

## Acceptance Criteria

- [ ] A brand new user signs up → a workspace is auto-created → `/api/users/me` returns full workspace data
- [ ] An existing user logs in → their existing workspace is returned, no duplicate created
- [ ] `useWorkspace()` hook returns a non-null `workspaceId` after login
- [ ] TypeScript compiles with zero errors across the entire frontend after type changes
- [ ] TanStack Query is active — wrap with `ReactQueryDevtools` and confirm it appears in dev
- [ ] No `"Blocked"` or `"Critical"` strings remain anywhere in frontend source
- [ ] Mock tasks render correctly in the UI after the enum value changes
