# KEIL HQ — MVP v0.5 Development Plan

## Purpose

This document defines the recommended development approach for **KEIL HQ MVP v0.5** based on the current codebase, existing documentation, and the confirmed implementation decisions.

The goal is to help the team build the product **module by module**, while allowing **2 fullstack developers** to work in parallel without breaking previous work. This plan is written for team execution, review, and merge discipline.

---

## Confirmed Decisions

These decisions are treated as final for this plan:

1. **Team setup**
   - 2 developers
   - Both are **fullstack**
   - Both will use **AI-assisted coding**

2. **Development style**
   - Work should happen **module-wise**
   - Backend and frontend should be built **simultaneously per module**
   - Existing UI should be **wired first**, then improved later

3. **Scope decisions**
   - `Schedule` is **parked for later**
   - `Chat` is **parked for later**
   - Workspace onboarding UI will be handled later
   - For now, a workspace should be **auto-created by backend** for new users

4. **Source of truth**
   - Backend is the **source of truth** for domain rules and enums
   - Frontend must align to backend values

5. **Task model decisions**
   - Remove `Blocked` as a real task status
   - A task is considered **blocked only as a derived UI state** when dependencies are incomplete
   - Frontend should use `urgent`, not `critical`

6. **Frontend data layer**
   - Use **TanStack Query**

---

## What Exists Today

## Backend

The backend already has strong foundational work completed:

- Database schema is designed
- PostgreSQL migrations exist
- Repositories are implemented
- Services are implemented
- Auth middleware exists
- Routes exist

### Current backend gap

The main missing layer is:

- **Controllers are mostly stubs / TODOs**

This means the architecture is already partially ready:

**Request → Controller → Service → Repository → PostgreSQL**

But right now the controller-to-service wiring is incomplete.

## Frontend

The frontend already has:

- Auth flow integrated with Supabase
- Protected routes
- Existing task UI
- Dashboard UI
- API client setup
- Mock-data-driven state for tasks

### Current frontend gap

The main missing pieces are:

- Real backend integration
- TanStack Query setup
- Frontend types aligned with backend
- Workspace bootstrap flow after login
- Replacing mock task state with API-backed state

---

## Guiding Development Principles

To keep work safe, fast, and mergeable, the team should follow these principles.

### 1. Build module by module

Do not build all backend first and all frontend later.  
Do not redesign UI while core features are still disconnected.

Instead, finish each module like this:

1. Define API contract
2. Implement backend endpoints
3. Implement frontend query/mutation hooks
4. Integrate UI with live backend
5. Test the module end-to-end
6. Merge only when that module works

This is the safest and fastest path for your team size.

### 2. Backend contract is frozen before parallel work starts

For every module, both developers should first agree on:

- endpoint paths
- request payloads
- response shapes
- validation rules
- error shapes

This should happen **before coding starts** for that module.

That way:
- backend can build independently
- frontend can build independently
- integration friction stays low

### 3. Never break stable contracts mid-module

Once frontend starts against a response shape, backend should not rename fields casually.

Allowed:
- adding new optional fields

Avoid:
- renaming fields
- removing fields
- changing enum values
- changing pagination shapes without coordination

### 4. Keep `main` always stable

The project owner should only merge tested module work into `main`.

---

## Recommended Git / Branch Strategy

Use this structure:

- `main` → always stable, reviewed, merge-only
- `develop` → integration branch
- `feature/<module>-be` → backend work for a module
- `feature/<module>-fe` → frontend work for a module

### Example

- `feature/foundation-be`
- `feature/foundation-fe`
- `feature/tasks-be`
- `feature/tasks-fe`
- `feature/comments-be`
- `feature/comments-fe`

### Merge flow

1. Both developers agree on module contract
2. Each developer works on their own branch
3. Both branches merge into `develop`
4. Module is tested end-to-end on `develop`
5. Owner reviews
6. Owner merges `develop` into `main`

This gives you:
- safe isolation
- easier rollback
- controlled integration
- clear review checkpoints

---

## Recommended Team Working Model

Since both developers are fullstack, the best model is still:

- **Developer A**: primarily backend lead for current module
- **Developer B**: primarily frontend lead for current module

But because both are fullstack, they should still be able to:
- review each other’s module work
- unblock each other
- handle overflow if one side finishes earlier

This is better than splitting by permanent ownership like:
- one person always frontend
- one person always backend

For a 2-person team, module ownership is stronger than layer ownership.

---

## Recommended Development Sequence

This is the best order for KEIL HQ MVP v0.5.

### Phase 0 — Foundation
### Module 1 — Tasks Core
### Module 2 — Assignees & Dependencies
### Module 3 — Comments
### Module 4 — Activity Feed / Audit Logs
### Module 5 — Dashboard
### Later — Workspace UI / Schedule / Chat / UI redesign

This order is important because each later module depends on earlier stability.

---

# Phase 0 — Foundation

This phase must be completed before module development starts.

## Goals

- align frontend types with backend source of truth
- set up TanStack Query
- create user/workspace bootstrap flow
- add backend auto-workspace creation
- make auth session usable for all later modules

---

## Phase 0 — Backend Work

### 1. Create or complete `GET /api/v1/users/me`

This endpoint should:

- identify authenticated user from middleware
- return basic user profile
- return current workspace info
- return role in workspace

### 2. Auto-create default workspace for new users

Since workspace UI is deferred, backend should auto-create a workspace if a user has no workspace yet.

Recommended name pattern:

- `"<name>'s Workspace"` when `name` exists
- `"My Workspace"` fallback when name is missing

### 3. Auto-create logic should happen transactionally

The operation should be safe and atomic:

1. detect no workspace membership
2. create workspace
3. ensure owner membership exists
4. return user + workspace

### 4. Add validation helpers

Before tasks module starts, the backend needs a consistent validation approach for:

- body params
- query params
- enum validation
- date validation
- required/optional fields

This can be lightweight, but it must be consistent.

### 5. Standardize controller pattern

All controllers should follow one structure:

1. extract request input
2. validate input
3. call service
4. return unified response
5. delegate errors cleanly

This reduces variance across all modules.

---

## Phase 0 — Frontend Work

### 1. Align task types to backend enums

Frontend must stop using values that conflict with backend.

#### Task status must be:

- `backlog`
- `todo`
- `in-progress`
- `done`

#### Task priority must be:

- `low`
- `medium`
- `high`
- `urgent`

### 2. Remove `Blocked` as a real status

`Blocked` should not exist as a stored status.

Instead, blocked should be computed in UI, for example:

- task has incomplete dependencies
- therefore show blocked badge/indicator

### 3. Replace `Critical` with `urgent`

All frontend code should use `urgent`.

### 4. Install and configure TanStack Query

Set up:

- query client
- provider at app root
- standard stale time / retry behavior
- shared query key conventions

### 5. Create auth bootstrap hooks

Frontend needs a reliable initial app bootstrap flow after login:

- fetch current user
- fetch workspace info
- store workspace context globally
- make workspace ID available for all later task queries

### 6. Create shared API hook structure

Recommended structure:

- `src/hooks/api/useMe.ts`
- `src/hooks/api/useTasks.ts`
- `src/hooks/api/useComments.ts`
- `src/hooks/api/useActivity.ts`
- `src/hooks/api/useDashboard.ts`

Even if not all hooks are implemented immediately, this structure should be established early.

---

## Phase 0 — API Contract

### `GET /api/v1/users/me`

**Success response example:**

```/dev/null/keil-hq-users-me-response.json#L1-18
{
  "success": true,
  "data": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "User Name",
    "workspace": {
      "id": "workspace-uuid",
      "name": "User Name's Workspace",
      "role": "owner"
    }
  }
}
```

---

## Phase 0 — Done Criteria

Do not move to Module 1 until all of these are true:

- user can sign in
- frontend can fetch current user
- backend auto-creates workspace if missing
- frontend has access to `workspaceId`
- frontend task types fully align with backend
- TanStack Query is installed and active
- mock auth bootstrap is replaced with real bootstrap

---

# Module 1 — Tasks Core

This is the most important module in MVP v0.5.

## Scope

Implement and integrate:

- create task
- list tasks
- task detail
- update task
- delete task
- change task status
- filtering
- sorting
- pagination
- parent-child task hierarchy
- date validation
- objective
- success criteria

---

## Why this module comes first

Everything else depends on tasks:

- assignees belong to tasks
- dependencies belong to tasks
- comments belong to tasks
- activity logs are mostly task-driven
- dashboard depends on task data

If tasks are unstable, everything above them becomes unstable.

---

## Module 1 — Backend Work

### 1. Wire task controllers to existing services

The services and repositories already contain a lot of the actual business logic. The controller layer should now connect them properly.

Controllers to complete:

- create task
- get tasks
- get task by id
- update task
- delete task
- change task status

### 2. Validate all task payloads

Must validate:

- required title
- valid `status`
- valid `priority`
- `due_date >= start_date`
- valid UUIDs
- `parent_task_id` if provided
- task belongs to current workspace

### 3. Scope all task access to current workspace

Even if a task ID is valid, it must not be accessible outside the user’s workspace.

### 4. Make listing fully match MVP v0.5

Task listing must support:

- pagination
- filtering by `status`
- filtering by `priority`
- filtering by `assignee`
- filtering by `due_date`
- sorting by `due_date`
- sorting by `priority`
- sorting by `created_at`

### 5. Support parent-child tasks

Create and fetch tasks with `parent_task_id` support.

---

## Module 1 — Frontend Work

### 1. Replace mock tasks with TanStack Query

The existing task UI should now fetch real tasks.

### 2. Create task hooks

Recommended hooks:

- `useTasks`
- `useTask`
- `useCreateTask`
- `useUpdateTask`
- `useDeleteTask`
- `useChangeTaskStatus`

### 3. Connect task list page to real data

Replace local `useState(mockTasks)` flow with server-backed state.

### 4. Keep the current UI for now

Do not redesign the UI in this phase.  
Only adapt it enough to support the backend model.

### 5. Add loading, empty, and error states

Every task view must safely handle:

- loading
- empty lists
- API failure
- missing task details

### 6. Update create/edit task forms to backend shape

Fields must match backend exactly.

---

## Module 1 — Integration Rules

Before merge:

- task creation works
- list reflects newly created tasks
- task update persists correctly
- task deletion works
- status change works
- filters work
- sorting works
- pagination works
- subtasks can be created using `parent_task_id`

---

## Module 1 — Done Criteria

- no task UI depends on mock task data anymore
- all core task CRUD works against backend
- status and priority values match backend everywhere
- create and detail views both use live data
- end-to-end testing on `develop` passes manually

---

# Module 2 — Assignees & Dependencies

This module extends tasks after the core CRUD is stable.

## Scope

- multi-assignee tasks
- assignee listing by user
- dependency create/remove
- dependency completion blocking
- blocked state shown as derived UI
- circular dependency protection

---

## Module 2 — Backend Work

### Assignees
Implement:

- add assignee
- remove assignee
- fetch task assignee data where needed
- list tasks by assignee if required by frontend filters

### Dependencies
Implement:

- add dependency
- remove dependency
- dependency validation
- circular dependency checks
- prevent marking task done when dependencies are incomplete

This logic already belongs in backend and should remain there.

---

## Module 2 — Frontend Work

### 1. Add assignee hooks

Recommended hooks:

- `useAssignTaskUser`
- `useRemoveTaskUser`

### 2. Add dependency hooks

Recommended hooks:

- `useAddDependency`
- `useRemoveDependency`

### 3. Show derived blocked state in UI

Do not persist `blocked` as status.

Instead show a blocked indicator when:

- a task has dependencies
- one or more dependency tasks are not done

### 4. Update filters carefully

If the UI still wants a "Blocked" filter, it should be a **derived frontend filter**, not a real backend status filter.

---

## Module 2 — Done Criteria

- users can be assigned to tasks
- assignees persist correctly
- dependencies can be added and removed
- task cannot be marked done if dependencies are incomplete
- blocked is shown in UI without changing backend enum model

---

# Module 3 — Comments

This module should start only after task detail views are stable.

## Scope

- top-level comments
- nested replies
- paginated comment listing
- hard delete with cascade

---

## Module 3 — Backend Work

Implement and wire:

- get task comments
- create comment
- create reply
- delete comment

Backend must enforce:

- comment belongs to task in current workspace
- reply parent exists
- delete behavior is correct

---

## Module 3 — Frontend Work

### 1. Replace mock comments with real API hooks

Recommended hooks:

- `useTaskComments`
- `useCreateComment`
- `useDeleteComment`

### 2. Wire task detail comment area

The existing detail pane should:

- load comments from backend
- create comments live
- support replies if UI supports it now
- refresh correctly after mutations

### 3. Keep UI simple first

Do not over-improve comment UI yet.  
First make it function correctly.

---

## Module 3 — Done Criteria

- comments load from backend
- comments can be created
- replies can be created
- deletions work
- UI refreshes correctly after mutation

---

# Module 4 — Activity Feed / Audit Logs

This module becomes much more useful once tasks, dependencies, and comments are active.

## Scope

Expose the activity feed already supported by backend logging rules.

Required logs include:

- task created
- task deleted
- status changed
- assignment changed
- due date changed
- dependency changed
- comment created/deleted
- objective/success criteria updated

---

## Module 4 — Backend Work

Implement and wire:

- workspace activity feed endpoint
- optional task-scoped activity feed if desired from existing service patterns

Ensure:

- workspace scoping is correct
- pagination works
- newest entries appear first

---

## Module 4 — Frontend Work

### 1. Create activity hooks

Recommended hooks:

- `useWorkspaceActivity`
- `useTaskActivity` if the UI needs task-level history

### 2. Replace mock history / activity if present

Wherever the UI currently shows fake task history or event history, switch it to real backend activity.

### 3. Keep pagination predictable

Use cursor or offset consistently according to backend decision. Do not mix both patterns across modules.

---

## Module 4 — Done Criteria

- activity feed loads real data
- logs appear after actual task/comment/dependency actions
- pagination works
- no fake activity data remains where live data exists

---

# Module 5 — Dashboard

The dashboard should be done only after core task data and activity data are stable.

## Scope

Implement backend-powered dashboard buckets:

1. Immediate Tasks
2. Today’s Tasks
3. Blocked Tasks
4. Backlog

And ranking logic based on:

- priority weight
- time proximity

---

## Module 5 — Backend Work

Implement dashboard controller and wire service logic for:

- urgent + near due
- due today / scheduled today
- blocked tasks
- backlog tasks

Backend should remain the source of truth for ranking logic.

### Ranking rule

Follow MVP v0.5 rule:

- urgent = 3
- high = 2
- medium = 1
- low = 0

Combine this with due-date proximity.

---

## Module 5 — Frontend Work

### 1. Replace dashboard mocks with real query hooks

Recommended hook:

- `useDashboard`

### 2. Map current dashboard widgets to backend buckets

Existing cards should consume backend data with minimal UI changes for now.

### 3. Handle partial data gracefully

Dashboard should still render if one bucket is empty.

---

## Module 5 — Done Criteria

- dashboard reflects live task data
- bucket logic matches backend
- urgent near-due tasks surface correctly
- blocked tasks are derived correctly
- backlog appears correctly
- no dashboard widget relies on hardcoded task content

---

# What Should Be Developed Later

These should not interrupt MVP v0.5 core execution.

## 1. Workspace UI
Defer:
- workspace creation screen
- invite flow
- member management UX polishing

Reason:
backend auto-creation removes current blocker

## 2. Schedule Module
Park for later

Reason:
not needed for current MVP completion path

## 3. Chat Module
Park for later

Reason:
not in current MVP execution scope

## 4. UI / UX redesign
Do later, after live integration is stable

Reason:
wiring a temporary UI is cheaper than redesigning a mock-based one and then rewiring it again

---

# Recommended Ownership Per Module

For each module, use this split:

## Developer A
- API contract draft
- backend controllers
- backend validation
- backend integration fixes
- DB-related consistency checks

## Developer B
- TanStack Query hooks
- frontend integration
- replacing mock state
- loading/error/empty handling
- component adaptation to live data

## Shared
- contract review
- end-to-end testing on `develop`
- bug fixing before merge
- code review support

Because both are fullstack, they can swap if one side finishes early.

---

# Testing Strategy

For a small team, keep testing practical.

## Minimum per module

Before a module is merged to `main`, verify:

1. happy path works
2. bad input is rejected
3. loading state works
4. empty state works
5. error state works
6. auth-protected route still works
7. changes persist after refresh

## Suggested manual test checklist format

For each module create a small checklist in PR:

- [ ] create works
- [ ] read works
- [ ] update works
- [ ] delete works
- [ ] validation works
- [ ] permissions/scoping work
- [ ] frontend refreshes correctly
- [ ] no mock data dependency remains

---

# Important Technical Rules

## 1. Backend enum values are the source of truth

Frontend must align with:

### Status
- `backlog`
- `todo`
- `in-progress`
- `done`

### Priority
- `low`
- `medium`
- `high`
- `urgent`

## 2. Blocked is derived, not stored

A task is blocked when incomplete dependencies exist.

## 3. Use TanStack Query for all server-backed modules

Do not mix:
- mock state
- ad hoc axios calls
- server data inside random component state

Use hooks consistently.

## 4. Workspace context must be available globally

Since all task data depends on workspace scoping, workspace identity must be initialized very early.

## 5. Redesign later, not now

Do only the minimum UI adjustments required for integration.

---

# Merge Readiness Checklist

A module is ready to merge only when:

- backend endpoint works
- frontend uses live data
- no mock dependency remains for that module
- validation is in place
- loading/error states are handled
- workspace scoping is correct
- module works after page refresh
- integration is verified on `develop`
- owner review is complete

---

# Final Recommended Execution Order

## Step 1
Finish **Phase 0 — Foundation**

## Step 2
Finish **Module 1 — Tasks Core**

## Step 3
Finish **Module 2 — Assignees & Dependencies**

## Step 4
Finish **Module 3 — Comments**

## Step 5
Finish **Module 4 — Activity Feed / Audit Logs**

## Step 6
Finish **Module 5 — Dashboard**

## Step 7
Only after all above are stable:
- improve UI/UX
- add workspace UI
- return to schedule/chat if needed

---

# Final Recommendation

For **KEIL HQ MVP v0.5**, the best development approach is:

- **contract-first**
- **module-by-module**
- **backend + frontend in parallel**
- **stable branch discipline**
- **wire current UI first**
- **redesign only after live functionality is stable**

This gives your team the best balance of:
- speed
- low merge conflict risk
- low regression risk
- easy review
- predictable integration

If you want, the next best step is to create a second document after this one:

**`docs/KEIL-HQ-mvp-v0.5-task-breakdown.md`**

That file should turn this plan into:
- developer-wise task lists
- PR-sized implementation chunks
- per-module acceptance criteria
- daily execution sequence
- review checklist for merges
