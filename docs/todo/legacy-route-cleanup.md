# Legacy Route Cleanup

> Status: **APPROVED — implement phase by phase**
> Scope: Migrate all frontend hooks off legacy workspace-scoped routes onto new org/space routes. Remove legacy backend route files and workspace routes entirely.

---

## What Is Legacy vs New

| Legacy (workspace-scoped) | New (org/space-scoped) |
|---|---|
| `v1/tasks` | `v1/orgs/:orgId/spaces/:spaceId/tasks` |
| `v1/tasks/:id/comments` | `v1/orgs/:orgId/spaces/:spaceId/tasks/:id/comments` |
| `v1/comments/:id` (delete) | `v1/orgs/:orgId/spaces/:spaceId/tasks/:id/comments/:commentId` |
| `v1/activity` | `v1/orgs/:orgId/spaces/:spaceId/activity` |
| `v1/dashboard` | `v1/orgs/:orgId/spaces/:spaceId/dashboard` (org mode only — see note) |
| `v1/chat/channels` | Already migrated ✅ |
| `v1/workspaces` | Removed — no frontend callers |

**Personal mode dashboard note:** `v1/dashboard` is kept for personal mode in `Dashboard.tsx`. Replacing it with a personal-task-based dashboard is out of scope for this plan. The legacy route stays alive only for this one use case and is documented as a known debt.

---

## Verified: No Frontend Callers of `v1/workspaces`

`grep` confirms zero frontend imports of `useWorkspace`, `workspaceKeys`, or `v1/workspaces`. Safe to remove.

---

## Non-Negotiable Constraints

- Personal mode must never call org-scoped APIs. All migrated hooks must be disabled when `orgId`/`spaceId` is null.
- `TaskDTO.workspace_id` stays in the type but becomes optional (`workspace_id?: string`). It will be deprecated in a future pass.
- `HistoryTab`, `ActivityTab`, `DependenciesTab` only render in org mode (enforced by `TaskDetailPane` which hides these tabs when `isPersonalMode=true`). They can safely call `useAppContext()` directly.
- Dependency picker and mention picker (`@task`) are hidden in personal mode — personal tasks have no dependencies or org-style comments.
- Do not remove `v1/dashboard` or `activity.routes.ts` — still used for personal mode dashboard.
- Do not remove `comment.routes.ts` until the delete endpoint is migrated.
- All builds must pass after each phase.

---

## Phase A — Backend: Add Missing Org-Scoped Endpoints

### A1 — Add comment delete to org-task routes

`org-task.routes.ts` has `GET/POST /:id/comments` but no `DELETE`. Add it.

`backend/src/routes/org-task.routes.ts`:
```
DELETE /:id/comments/:commentId  → deleteTaskComment (new controller function)
```

`backend/src/controllers/org-task.controller.ts`:
- Add `deleteTaskComment`: verify task is in space via `assertTaskInSpace`, then call `hardDeleteComment(commentId, userId, { workspace_id, org_id, space_id })`.

`backend/src/services/comment.service.ts`:
- `hardDeleteComment` already accepts `CommentActivityContext` — no service change needed.

### A2 — Acceptance Criteria

- [ ] `DELETE /api/v1/orgs/:orgId/spaces/:spaceId/tasks/:id/comments/:commentId` returns 200 for the comment owner.
- [ ] Returns 403 for non-owners.
- [ ] Backend TypeScript build passes.

---

## Phase B — Frontend Hooks: Migrate `useTasks.ts`

This is the largest change. `useTasks` is used in both org mode and personal mode (personal mode uses `usePersonalTasks` — `useTasks` is only called when `isPersonalMode === false`).

### B1 — Add org-scoped hooks to `useTasks.ts`

Add new hooks that call the org/space routes. Keep the existing legacy hooks intact until all call sites are migrated (Phase C).

New hooks to add:

```ts
// Replaces useTasks() in org mode
useOrgTasks(orgId: string | null, spaceId: string | null, filters?: TaskFilters)
  → GET v1/orgs/:orgId/spaces/:spaceId/tasks
  → enabled: !!orgId && !!spaceId
  → queryKey: ["org-tasks", orgId, spaceId, filters]

// Replaces useTask(id) in org mode
useOrgTask(orgId: string | null, spaceId: string | null, taskId: string)
  → GET v1/orgs/:orgId/spaces/:spaceId/tasks/:id
  → enabled: !!orgId && !!spaceId && !!taskId

// Replaces useSubtasks(parentId) in org mode
useOrgSubtasks(orgId: string | null, spaceId: string | null, parentTaskId: string)
  → GET v1/orgs/:orgId/spaces/:spaceId/tasks/:id/subtasks

// Replaces useCreateTask() in org mode
useCreateOrgTask(orgId: string | null, spaceId: string | null)
  → POST v1/orgs/:orgId/spaces/:spaceId/tasks

// Replaces useUpdateTask() in org mode
useUpdateOrgTask(orgId: string | null, spaceId: string | null)
  → PATCH v1/orgs/:orgId/spaces/:spaceId/tasks/:id

// Replaces useDeleteTask() in org mode
useDeleteOrgTask(orgId: string | null, spaceId: string | null)
  → DELETE v1/orgs/:orgId/spaces/:spaceId/tasks/:id

// Replaces useChangeTaskStatus() in org mode
useChangeOrgTaskStatus(orgId: string | null, spaceId: string | null)
  → PATCH v1/orgs/:orgId/spaces/:spaceId/tasks/:id/status

// Replaces useAssignUser() in org mode
useAssignOrgUser(orgId: string | null, spaceId: string | null)
  → POST v1/orgs/:orgId/spaces/:spaceId/tasks/:id/assignees

// Replaces useRemoveAssignee() in org mode
useRemoveOrgAssignee(orgId: string | null, spaceId: string | null)
  → DELETE v1/orgs/:orgId/spaces/:spaceId/tasks/:id/assignees/:userId

// Replaces useAddDependency() in org mode
useAddOrgDependency(orgId: string | null, spaceId: string | null)
  → POST v1/orgs/:orgId/spaces/:spaceId/tasks/:id/dependencies

// Replaces useRemoveDependency() in org mode
useRemoveOrgDependency(orgId: string | null, spaceId: string | null)
  → DELETE v1/orgs/:orgId/spaces/:spaceId/tasks/:id/dependencies/:blockedByTaskId
```

**Query key factory** — add `orgTaskKeys` alongside existing `taskKeys`:
```ts
export const orgTaskKeys = {
  all: ["org-tasks"] as const,
  lists: (orgId: string, spaceId: string) => [...orgTaskKeys.all, orgId, spaceId, "list"] as const,
  list: (orgId: string, spaceId: string, filters: object) => [...orgTaskKeys.lists(orgId, spaceId), filters] as const,
  detail: (orgId: string, spaceId: string, id: string) => [...orgTaskKeys.all, orgId, spaceId, "detail", id] as const,
  subtasks: (orgId: string, spaceId: string, parentId: string) => [...orgTaskKeys.all, orgId, spaceId, "subtasks", parentId] as const,
};
```

**`TaskDTO` update** — make `workspace_id` optional:
```ts
workspace_id?: string; // deprecated — will be removed in a future pass
```

### B2 — Add org-scoped hooks to `useComments.ts`

```ts
// Replaces useTaskComments() in org mode
useOrgTaskComments(orgId: string | null, spaceId: string | null, taskId?: string)
  → GET v1/orgs/:orgId/spaces/:spaceId/tasks/:id/comments

// Replaces useCreateComment() in org mode
useCreateOrgComment(orgId: string | null, spaceId: string | null)
  → POST v1/orgs/:orgId/spaces/:spaceId/tasks/:id/comments

// Replaces useDeleteComment() in org mode
useDeleteOrgComment(orgId: string | null, spaceId: string | null)
  → DELETE v1/orgs/:orgId/spaces/:spaceId/tasks/:id/comments/:commentId
```

### B3 — Add org-scoped hook to `useActivity.ts`

```ts
// Replaces useTaskActivity() in org mode
useOrgTaskActivity(orgId: string | null, spaceId: string | null, taskId?: string)
  → GET v1/orgs/:orgId/spaces/:spaceId/activity?entity_type=task&entity_id=:taskId
```

### B4 — Acceptance Criteria

- [ ] All new hooks are exported and TypeScript-typed.
- [ ] All new hooks are disabled (not erroring) when `orgId`/`spaceId` is null.
- [ ] Legacy hooks (`useTasks`, `useTaskComments`, etc.) still exist — no call sites broken yet.
- [ ] Frontend TypeScript build passes.

---

## Phase C — Frontend Components: Migrate Call Sites

Migrate every component from legacy hooks to org-scoped hooks. Components read `orgId`/`spaceId` from `useAppContext()` directly — no prop drilling.

### C1 — `TasksPage.tsx`

- Replace `useTasks(serverFilters)` with `useOrgTasks(activeOrgId, activeSpaceId, serverFilters)` in org mode.
- Replace `useUpdateTask()` with `useUpdateOrgTask(activeOrgId, activeSpaceId)`.
- Replace `useDeleteTask()` with `useDeleteOrgTask(activeOrgId, activeSpaceId)`.
- Replace `useAssignUser()` with `useAssignOrgUser(activeOrgId, activeSpaceId)`.
- Replace `useRemoveAssignee()` with `useRemoveOrgAssignee(activeOrgId, activeSpaceId)`.
- Guard: all org hooks disabled when `isPersonalMode === true`.

### C2 — `TaskDetailPane.tsx`

- Replace `useTask(id)` with `useOrgTask(activeOrgId, activeSpaceId, id)` in org mode.
- Replace `useUpdateTask()` with `useUpdateOrgTask(activeOrgId, activeSpaceId)`.
- Replace `useDeleteTask()` with `useDeleteOrgTask(activeOrgId, activeSpaceId)`.
- Read `activeOrgId`, `activeSpaceId` from `useAppContext()`.
- Personal mode continues to use `useUpdatePersonalTask` / `useDeletePersonalTask` — no change.

### C3 — `EventDetailPane.tsx`

Same as `TaskDetailPane` — replace `useTask`, `useUpdateTask`, `useDeleteTask` with org-scoped equivalents.

### C4 — `TaskDetailHeader.tsx` and `EventDetailHeader.tsx`

- Replace `useChangeTaskStatus()` with `useChangeOrgTaskStatus(activeOrgId, activeSpaceId)`.
- Read context from `useAppContext()`.
- Guard: in personal mode, `useChangePersonalTaskStatus` is already used — no change needed there.

### C5 — `OverviewTab.tsx` and `EventOverviewTab.tsx`

- Replace `useSubtasks(id)` with `useOrgSubtasks(activeOrgId, activeSpaceId, id)`.
- Replace `useAssignUser()` with `useAssignOrgUser(activeOrgId, activeSpaceId)`.
- Replace `useRemoveAssignee()` with `useRemoveOrgAssignee(activeOrgId, activeSpaceId)`.
- Read context from `useAppContext()` (already imported in both files).

### C6 — `TaskListPane.tsx`

- Replace `useSubtasks(id)` with `useOrgSubtasks(activeOrgId, activeSpaceId, id)`.
- Read context from `useAppContext()`.

### C7 — `CreateTaskDialog.tsx`

- Replace `useCreateTask()` with `useCreateOrgTask(activeOrgId, activeSpaceId)` in org mode.
- Replace `useUpdateTask()` with `useUpdateOrgTask(activeOrgId, activeSpaceId)` in org mode.
- Personal mode already uses `useCreatePersonalTask` / `useUpdatePersonalTask` — no change.
- Read context from `useAppContext()`.

### C8 — `TaskPreviewDialog.tsx` and `EventPreviewDialog.tsx`

- Replace `useDeleteTask()` with `useDeleteOrgTask(activeOrgId, activeSpaceId)`.
- Replace `useChangeTaskStatus()` with `useChangeOrgTaskStatus(activeOrgId, activeSpaceId)`.
- Read context from `useAppContext()`.

### C9 — `DependenciesTab.tsx`

Only renders in org mode (hidden by `TaskDetailPane` when `isPersonalMode=true`).

- Replace `useTasks()` with `useOrgTasks(activeOrgId, activeSpaceId)` — shows only tasks in the active space.
- Replace `useAddDependency()` with `useAddOrgDependency(activeOrgId, activeSpaceId)`.
- Replace `useRemoveDependency()` with `useRemoveOrgDependency(activeOrgId, activeSpaceId)`.
- Read context from `useAppContext()`.

### C10 — `ActivityTab.tsx`

Only renders in org mode.

- Replace `useTasks()` with `useOrgTasks(activeOrgId, activeSpaceId)` for the `@mention` task picker.
- Replace `useTaskComments(task.id)` with `useOrgTaskComments(activeOrgId, activeSpaceId, task.id)`.
- Replace `useCreateComment()` with `useCreateOrgComment(activeOrgId, activeSpaceId)`.
- Replace `useDeleteComment()` with `useDeleteOrgComment(activeOrgId, activeSpaceId)`.
- `activeOrgId`/`activeSpaceId` already read from `useAppContext()` in this file.

### C11 — `HistoryTab.tsx`

Only renders in org mode.

- Replace `useTaskActivity(task.id)` with `useOrgTaskActivity(activeOrgId, activeSpaceId, task.id)`.
- Read `activeOrgId`, `activeSpaceId` from `useAppContext()`.

### C12 — Acceptance Criteria

- [ ] All components in org mode call org-scoped hooks only.
- [ ] All components in personal mode call personal task hooks only.
- [ ] No component calls a legacy hook (`useTasks`, `useTaskComments`, `useTaskActivity`, `useDeleteComment`) in org mode.
- [ ] Dependency picker shows only tasks from the active space.
- [ ] `@mention` picker shows only tasks from the active space.
- [ ] Frontend TypeScript build passes.

---

## Phase D — Remove Legacy Backend Routes and Files

Only execute after Phase C is complete and verified.

### D1 — Remove from `v1.routes.ts`

Remove these lines:
```ts
router.use("/workspaces", workspaceRoutes);
router.use("/tasks", taskRoutes);
router.use("/comments", commentRoutes);
router.use("/chat", chatRoutes);
// Keep: router.use("/", activityRoutes); ← still needed for personal mode dashboard
```

### D2 — Delete legacy route files

- `backend/src/routes/workspace.routes.ts` — delete
- `backend/src/routes/task.routes.ts` — delete
- `backend/src/routes/comment.routes.ts` — delete
- `backend/src/routes/chat.routes.ts` — delete

### D3 — Delete legacy controllers

- `backend/src/controllers/workspace.controller.ts` — delete
- `backend/src/controllers/task.controller.ts` — delete
- `backend/src/controllers/chat.controller.ts` — delete
- `backend/src/controllers/comment.controller.ts` — **do not delete** — `hardDeleteComment` is still used by `org-task.controller.ts`. Remove only the HTTP handler functions (`getTaskComments`, `addComment`, `deleteComment`), keep the service-level exports.

### D4 — Remove `attachWorkspaceContext` from `auth.middleware.ts`

- Remove the `attachWorkspaceContext` export.
- Keep `protect` unchanged.
- `activity.routes.ts` still uses `attachWorkspaceContext` for the legacy dashboard — update it to use `protect` only and remove the workspace context dependency. The `getDashboardInfo` controller will need to handle the case where `workspaceId` is null gracefully (it already does — returns empty).

### D5 — Remove legacy frontend hooks

After all call sites are migrated:
- Remove legacy exports from `useTasks.ts`: `useTasks`, `useTask`, `useSubtasks`, `useCreateTask`, `useUpdateTask`, `useDeleteTask`, `useChangeTaskStatus`, `useAssignUser`, `useRemoveAssignee`, `useAddDependency`, `useRemoveDependency`.
- Keep `TaskDTO`, `TaskFilters`, `CreateTaskInput`, `UpdateTaskInput`, `orgTaskKeys` — still needed as types.
- Remove legacy exports from `useComments.ts`: `useTaskComments`, `useCreateComment`, `useDeleteComment`.
- Remove `useTaskActivity` and `useWorkspaceActivity` from `useActivity.ts`.

### D6 — Verify no remaining legacy route calls

Run grep before deleting:
```
grep -r "v1/tasks\|v1/chat\|v1/comments\|v1/workspaces" frontend/src
```
Must return zero results.

### D7 — Acceptance Criteria

- [ ] `grep -r "v1/tasks\|v1/chat/channels\|v1/comments\|v1/workspaces" frontend/src` returns zero results.
- [ ] `grep -r "attachWorkspaceContext" backend/src` returns zero results (except `activity.routes.ts` if kept).
- [ ] Backend TypeScript build passes.
- [ ] Frontend TypeScript build passes.
- [ ] All existing functionality works: org tasks, personal tasks, chat, dashboard, comments, dependencies, assignees, history.

---

## Files That Will Change

### Backend

| File | Change |
|---|---|
| `backend/src/routes/org-task.routes.ts` | Add `DELETE /:id/comments/:commentId` |
| `backend/src/controllers/org-task.controller.ts` | Add `deleteTaskComment` |
| `backend/src/routes/v1.routes.ts` | Remove workspace/task/comment/chat route registrations |
| `backend/src/middlewares/auth.middleware.ts` | Remove `attachWorkspaceContext` export |
| `backend/src/routes/activity.routes.ts` | Remove `attachWorkspaceContext`, use `protect` only |
| `backend/src/controllers/activity.controller.ts` | Handle null `workspaceId` gracefully |
| **Delete** `backend/src/routes/workspace.routes.ts` | — |
| **Delete** `backend/src/routes/task.routes.ts` | — |
| **Delete** `backend/src/routes/comment.routes.ts` | — |
| **Delete** `backend/src/routes/chat.routes.ts` | — |
| **Delete** `backend/src/controllers/workspace.controller.ts` | — |
| **Delete** `backend/src/controllers/task.controller.ts` | — |
| **Delete** `backend/src/controllers/chat.controller.ts` | — |

### Frontend

| File | Change |
|---|---|
| `frontend/src/hooks/api/useTasks.ts` | Add `useOrgTasks` + all org-scoped mutations; make `workspace_id` optional in `TaskDTO`; remove legacy hooks in Phase D |
| `frontend/src/hooks/api/useComments.ts` | Add `useOrgTaskComments`, `useCreateOrgComment`, `useDeleteOrgComment`; remove legacy hooks in Phase D |
| `frontend/src/hooks/api/useActivity.ts` | Add `useOrgTaskActivity`; remove legacy hooks in Phase D |
| `frontend/src/components/TasksPage.tsx` | Migrate to org hooks |
| `frontend/src/components/tasks/TaskDetailPane.tsx` | Migrate to org hooks |
| `frontend/src/components/tasks/EventDetailPane.tsx` | Migrate to org hooks |
| `frontend/src/components/tasks/TaskDetailHeader.tsx` | Migrate to org hooks |
| `frontend/src/components/tasks/EventDetailHeader.tsx` | Migrate to org hooks |
| `frontend/src/components/tasks/OverviewTab.tsx` | Migrate to org hooks |
| `frontend/src/components/tasks/EventOverviewTab.tsx` | Migrate to org hooks |
| `frontend/src/components/tasks/TaskListPane.tsx` | Migrate to org hooks |
| `frontend/src/components/tasks/CreateTaskDialog.tsx` | Migrate to org hooks |
| `frontend/src/components/tasks/TaskPreviewDialog.tsx` | Migrate to org hooks |
| `frontend/src/components/tasks/EventPreviewDialog.tsx` | Migrate to org hooks |
| `frontend/src/components/tasks/DependenciesTab.tsx` | Migrate to org hooks |
| `frontend/src/components/tasks/ActivityTab.tsx` | Migrate to org hooks |
| `frontend/src/components/tasks/HistoryTab.tsx` | Migrate to org hooks |

---

## Known Debt (Out of Scope)

- `v1/dashboard` (legacy) is kept alive for personal mode in `Dashboard.tsx`. A future plan should replace it with a personal-task-based dashboard and remove `activity.routes.ts` entirely.
- `TaskDTO.workspace_id` is marked optional but not removed. Remove it once all data consumers are confirmed to not need it.
- `v1/activity` (legacy) is kept alive for the same reason as `v1/dashboard`.

---

## Stop Conditions

- Stop if any org-scoped hook is called without `orgId`/`spaceId` being set.
- Stop if personal task mutations are accidentally routed to org endpoints.
- Stop if removing a legacy controller breaks a service that is still imported by an org controller.
- Stop if the frontend build fails after any phase.
