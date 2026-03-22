# Module 2 — Assignees & Dependencies

## Prerequisites
- Phase 0 (Foundation) must be complete
- Module 1 (Tasks Core) must be complete
- Real task IDs must exist in the database before dependencies can be tested

---

## Context for Developers

### What already exists
- **Backend services are fully implemented**
  - `taskService.assignUserToTask()` — assigns a user, logs activity
  - `taskService.removeUserFromTask()` — removes assignee, logs activity
  - `taskService.addDependency()` — adds dependency, checks for circular deps, logs activity
  - `taskService.removeDependency()` — removes dependency, logs activity
  - `workspaceService.getWorkspaceMembers()` — lists all workspace members with user info
- **Backend repositories are fully implemented**
  - `task-assignee.repository.ts` — assign, unassign, findByTask, findByUser, isAssigned
  - `task-dependency.repository.ts` — add, remove, findDependencies, checkAllDependenciesComplete, hasCircularDependency (recursive CTE)
- **Routes are already wired** in `backend/src/routes/task.routes.ts` and `backend/src/routes/workspace.routes.ts`
- **Frontend UI components exist** in `TaskDetailPane.tsx` — AssigneesChip (L134), DependencyRow (L563), DependenciesTab (L583) — but are driven by mock task data

### What is missing
- All 4 task controller handlers are stubs returning empty 200s
- `getWorkspaceMembers` workspace controller is a stub
- Frontend has no TanStack Query hooks for assignees or dependencies
- Frontend shows "Blocked" as a stored status — must become a derived UI state
- Assignees section shows strings from `task.assignees[]` — must become real user objects

### Important rule
`Blocked` is **not a stored status**. A task is shown as blocked in UI when it has at least one dependency whose status is not `done`. Do not add a `blocked` status to the DB or enums.

---

## Branch Names
- `feature/assignees-deps-be` — Dev A
- `feature/assignees-deps-fe` — Dev B

---

## API Contract

Both developers must agree on these shapes before coding.

### `POST /api/v1/tasks/:id/assignees`
```
Body:   { "user_id": "uuid" }
201:    { success: true, data: null, message: "User assigned to task" }
400:    user already assigned
404:    task not found
```

### `DELETE /api/v1/tasks/:id/assignees/:userId`
```
204/200: { success: true, data: null, message: "User removed from task" }
404:     task or assignee not found
```

### `POST /api/v1/tasks/:id/dependencies`
```
Body:   { "depends_on_task_id": "uuid" }
201:    { success: true, data: null, message: "Dependency added" }
400:    circular dependency detected / self-reference
404:    task not found
```

### `DELETE /api/v1/tasks/:id/dependencies/:blockedByTaskId`
```
200:    { success: true, data: null, message: "Dependency removed" }
404:    dependency not found
```

### `GET /api/v1/workspaces/:id/members`
```
200: {
  success: true,
  data: [
    {
      id: "uuid",
      workspace_id: "uuid",
      user_id: "uuid",
      role: "owner" | "admin" | "member",
      created_at: "ISO string",
      user: { id, email, name, created_at }
    }
  ]
}
```

### Updated `GET /api/v1/tasks/:id` response (extended from Module 1)
The single task detail endpoint should now include assignees and dependencies:
```
data: {
  ...taskFields,
  assignees: [{ id, email, name, assigned_at }],
  dependencies: [{ id, title, status, priority, due_date }],
  blocked_by_count: number   // how many incomplete dependencies exist
}
```

---

## Dev A — Backend Deliverables

### task.controller.ts
File: `backend/src/controllers/task.controller.ts`

- [x] Implement `assignUserToTask`
  - Extract `user_id` from `req.body`
  - Extract `task_id` from `req.params.id`
  - Validate both are present and valid UUIDs
  - Get workspace from `req.user` (or attached workspace context)
  - Call `taskService.assignUserToTask(taskId, assigneeUserId, req.user.id, workspaceId)`
  - Return 201 on success

- [x] Implement `removeUserFromTask`
  - Extract `userId` from `req.params.userId`
  - Extract `task_id` from `req.params.id`
  - Call `taskService.removeUserFromTask(taskId, userId, req.user.id, workspaceId)`
  - Return 200 on success

- [x] Implement `addDependency`
  - Extract `depends_on_task_id` from `req.body`
  - Extract `task_id` from `req.params.id`
  - Validate both UUIDs present and not equal (no self-dependency)
  - Call `taskService.addDependency(taskId, dependsOnTaskId, req.user.id, workspaceId)`
  - Service already throws 400 if circular dependency detected — let `catchAsync` propagate it
  - Return 201 on success

- [x] Implement `removeDependency`
  - Extract `blockedByTaskId` from `req.params.blockedByTaskId`
  - Call `taskService.removeDependency(taskId, blockedByTaskId, req.user.id, workspaceId)`
  - Return 200 on success

- [x] Update `getTaskById` to include assignees and dependencies in response
  - Use `taskRepository.findWithAssignees()` and `taskRepository.findWithDependencies()` which already exist
  - Or compose the result from separate repo calls
  - Add `blocked_by_count` to the response (count of incomplete dependencies)

### workspace.controller.ts
File: `backend/src/controllers/workspace.controller.ts`

- [x] Implement `getWorkspaceMembers`
  - Extract `id` (workspaceId) from `req.params.id`
  - Verify the requesting user belongs to this workspace
  - Call `workspaceService.getWorkspaceMembers(workspaceId)`
  - Return 200 with member array

---

## Dev B — Frontend Deliverables

### Hooks
File to create: `frontend/src/hooks/api/useTasks.ts` (extend existing from Module 1)

- [ ] Add `useAssignUser` mutation hook
  - `POST /api/v1/tasks/:id/assignees`
  - On success: invalidate task query for that task ID

- [ ] Add `useRemoveAssignee` mutation hook
  - `DELETE /api/v1/tasks/:id/assignees/:userId`
  - On success: invalidate task query for that task ID

- [ ] Add `useAddDependency` mutation hook
  - `POST /api/v1/tasks/:id/dependencies`
  - On success: invalidate task query for that task ID

- [ ] Add `useRemoveDependency` mutation hook
  - `DELETE /api/v1/tasks/:id/dependencies/:blockedByTaskId`
  - On success: invalidate task query for that task ID

File to create: `frontend/src/hooks/api/useWorkspace.ts`

- [ ] Add `useWorkspaceMembers` query hook
  - `GET /api/v1/workspaces/:workspaceId/members`
  - Use `workspaceId` from WorkspaceContext
  - Returns member list with user info for the assignee picker

### TaskDetailPane.tsx
File: `frontend/src/components/tasks/TaskDetailPane.tsx`

- [ ] Update `AssigneesChip` component (L134–160)
  - Accept `assignees` as real user objects `{ id, email, name }[]` instead of string array
  - Display user name (or email fallback if name is null)
  - Add remove assignee button that calls `useRemoveAssignee`

- [ ] Add assignee picker
  - Use `useWorkspaceMembers` to populate a dropdown/popover of available users
  - On select: call `useAssignUser` mutation
  - Filter out already-assigned users from the picker list

- [ ] Update `DependenciesTab` (L583–660)
  - Replace mock dependency data with real data from task detail response
  - `DependencyRow` (L563–581) — display `title`, `status`, `priority` from real dependency task objects

- [ ] Implement `useAddDependency` in DependenciesTab
  - Add input or search to find a task by ID/title to add as dependency
  - Call `useAddDependency` mutation on submit
  - Show error toast if circular dependency is detected (backend returns 400)

- [ ] Implement `useRemoveDependency` in DependenciesTab
  - Remove button on each dependency row
  - Call `useRemoveDependency` mutation

- [ ] Replace hardcoded `"Blocked"` status references
  - In `TaskListPane.tsx` `statusColorMap`: remove `"Blocked"` key
  - In `TaskListPane.tsx` `FILTER_OPTIONS`: replace "Blocked" filter with a derived filter
  - The "Blocked" filter in the list pane should filter tasks where `blocked_by_count > 0`

### types/task.ts
File: `frontend/src/types/task.ts`

- [ ] Update `Dependency` type to match real backend shape:
  ```
  type Dependency = {
    id: string;
    taskId: string;
    title: string;
    status: TaskStatus;   // uses the corrected backend enum from Phase 0
    priority: TaskPriority;
    due_date: string | null;
  }
  ```

- [ ] Update `Task` type: change `assignees: string[]` to `assignees: AssigneeUser[]`
  ```
  type AssigneeUser = { id: string; email: string; name: string | null }
  ```

---

## Acceptance Criteria

- [x] A user can be assigned to a task and the assignment persists after page refresh
- [x] A user can be removed from a task
- [x] Only workspace members appear in the assignee picker
- [x] A dependency can be added to a task
- [x] A dependency can be removed from a task
- [x] Attempting to add a circular dependency shows an error message — task does not update
- [x] A task with all dependencies marked `done` can be marked `done`
- [x] A task with at least one incomplete dependency cannot be marked `done` (backend blocks it with 400)
- [x] The "blocked" visual indicator in the task list and detail view is derived from `blocked_by_count > 0`, not a stored status
- [x] The "Blocked" filter in the task list works as a derived filter (not a backend status filter)

---

## Files Modified Summary

| File | Who | Change |
|---|---|---|
| `backend/src/controllers/task.controller.ts` | Dev A | Implement 4 stub handlers + extend getTaskById |
| `backend/src/controllers/workspace.controller.ts` | Dev A | Implement getWorkspaceMembers |
| `frontend/src/hooks/api/useTasks.ts` | Dev B | Add 4 mutation hooks |
| `frontend/src/hooks/api/useWorkspace.ts` | Dev B | Create with useWorkspaceMembers |
| `frontend/src/components/tasks/TaskDetailPane.tsx` | Dev B | Wire assignees + dependencies UI |
| `frontend/src/components/tasks/TaskListPane.tsx` | Dev B | Fix Blocked filter to be derived |
| `frontend/src/types/task.ts` | Dev B | Update Dependency and assignees types |

---

## Impact on Other Modules

| Module | Impact |
|---|---|
| Module 3 (Comments) | No dependency. Can start after Module 1 is done. |
| Module 4 (Activity) | Activity logs for assignment/dependency changes are already written by `task.service.ts`. Module 4 just exposes them — no changes needed here. |
| Module 5 (Dashboard) | Dashboard's "blocked tasks" bucket relies on the dependency data inserted in this module. Dashboard must come after this. |