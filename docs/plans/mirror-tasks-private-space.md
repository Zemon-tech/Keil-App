# Implementation Plan: Mirroring Engine in Private Space of Personal Organisation

## Overview
Introduce the **Mirroring Engine (Option A)** inside the user's **Private Space** of their **Personal Organisation**. When active, the Private Space's task list becomes a comprehensive "Personal Command Center", combining the user's off-the-record private tasks with all active tasks assigned to them across every collaborative organization and space they belong to.

To maintain perfect data integrity, security, and RBAC:
1. **Interactive Operations**: The mirrored task list is fully interactive. Status updates, comment additions, and task modifications are routed directly to the task's originating organization and space endpoints using the task's own `org_id` and `space_id`.
2. **Dynamic Gating**: Actions on external tasks are strictly governed by the user's active membership role in the originating space, enforced at the API layer.
3. **Advanced Filtering**: Flat-list top-bar dropdown filters will enable the user to filter the command center by specific Organizations and Spaces.

---

## User Review Required

> [!IMPORTANT]
> **No Database Schema or RBAC Policy Alterations Required**
> Because we route task detail queries, comments, and status mutations directly to each task's originating space APIs (e.g. `/api/v1/orgs/:orgId/spaces/:spaceId/tasks`), the backend's existing RBAC middleware and membership guards will automatically validate permissions. If a user is a member of the external space, the backend will allow the mutation; if they have been removed, it will throw `403`.

> [!NOTE]
> **Interactive Operations & Breadcrumbs**
> Mirrored tasks will expose their origin using a clear breadcrumb (e.g. `Org Name › Space Name`). Clicking and editing a mirrored task will open its details inline in the Private Space, supporting complete status changes and comment feeds without forcing a global context-switch.

---

## Proposed Changes

### Backend Components

#### 1. [MODIFY] [org-task.repository.ts](file:///s:/1-Project/Quild/Keil-App/backend/src/repositories/org-task.repository.ts)
Update `findBySpace` to support mirroring when a private space query requests it:
- **Mirror Logic**: If `options.filters.mirror` is active, construct a SQL query that retrieves:
  - All tasks in the target Private Space (`t.org_id = $1 AND t.space_id = $2`).
  - **OR** all active tasks assigned to the user across all other non-private spaces (`ta.user_id = $userId`) where they are active members (`EXISTS (SELECT 1 FROM space_members ...)`).
- **Organisation & Space Filtering**: Support `options.filters.orgFilter` and `options.filters.spaceFilter` to filter tasks to a specific external organization or space.

```sql
-- Conceptual SQL query inside findBySpace when options.filters.mirror is true:
SELECT
  t.*,
  (
    SELECT COUNT(*)
    FROM public.tasks s
    WHERE s.parent_task_id = t.id
      AND s.deleted_at IS NULL
  ) as subtask_count
FROM public.tasks t
WHERE t.deleted_at IS NULL
  AND (
    -- Condition A: Tasks in the user's Private Space
    (t.org_id = $1 AND t.space_id = $2)
    OR
    -- Condition B: Tasks assigned to the user in other active spaces
    (
      $3::uuid IS NOT NULL -- userId passed here
      AND t.space_id != $2
      AND t.id IN (
        SELECT task_id FROM public.task_assignees WHERE user_id = $3
      )
      AND EXISTS (
        SELECT 1 FROM public.space_members sm 
        WHERE sm.space_id = t.space_id AND sm.user_id = $3
      )
    )
  )
  -- Apply optional Org/Space filters from top bar:
  AND ($4::uuid IS NULL OR t.org_id = $4)
  AND ($5::uuid IS NULL OR t.space_id = $5)
```

#### 2. [MODIFY] [org-task.controller.ts](file:///s:/1-Project/Quild/Keil-App/backend/src/controllers/org-task.controller.ts)
Update the `getTasks` handler:
- Read `mirror`, `org_filter`, and `space_filter` query parameters.
- If `mirror === 'true'`, verify that the requested space is a private space (`space.is_private = TRUE`). If verified, attach `mirror: true`, `userId: req.user.id`, `orgFilter: org_filter`, and `spaceFilter: space_filter` to `options.filters`.

#### 3. [MODIFY] [org-task.service.ts](file:///s:/1-Project/Quild/Keil-App/backend/src/services/org-task.service.ts)
Update `getTasksBySpace` to extract and pass the mirroring options securely to the repository layer.

---

### Frontend Components

#### 4. [MODIFY] [useTasks.ts](file:///s:/1-Project/Quild/Keil-App/frontend/src/hooks/api/useTasks.ts)
Update `TaskFilters` interface to support:
- `mirror?: boolean;`
- `org_filter?: string;`
- `space_filter?: string;`

#### 5. [MODIFY] [TasksPage.tsx](file:///s:/1-Project/Quild/Keil-App/frontend/src/components/TasksPage.tsx)
Integrate Command Center filters and dynamic target resolution:
- **Filters State**:
  ```typescript
  const [selectedOrgFilter, setSelectedOrgFilter] = useState<string>("all");
  const [selectedSpaceFilter, setSelectedSpaceFilter] = useState<string>("all");
  ```
- **Filter Bar UI**:
  Render two sleek dropdown selectors at the top of the task pane if the active space is private (`activeSpace?.is_private`).
  - **Organisation Filter**: Lists "All Workspaces", the Personal Org, and all shared organisations.
  - **Space Filter**: Populates dynamically with spaces of the selected organization.
- **Server Filter Injection**:
  If the active space is private, inject:
  ```typescript
  filters.mirror = true;
  if (selectedOrgFilter !== "all") filters.org_filter = selectedOrgFilter;
  if (selectedSpaceFilter !== "all") filters.space_filter = selectedSpaceFilter;
  ```
- **Dynamic Org/Space Target Resolution**:
  ```typescript
  const selectedTaskFromList = taskList.find(t => t.id === selectedTaskId) ?? null;
  const targetOrgId = selectedTaskFromList?.org_id ?? locatedTask?.orgId ?? activeOrgId;
  const targetSpaceId = selectedTaskFromList?.space_id ?? locatedTask?.spaceId ?? activeSpaceId;
  ```
  Pass `targetOrgId` and `targetSpaceId` explicitly to `useOrgTask`, `useUpdateOrgTask`, `useDeleteOrgTask`, `useAssignOrgUser`, and `useRemoveOrgAssignee`.

#### 6. [MODIFY] [TaskDetailPane & Tab Components](file:///s:/1-Project/Quild/Keil-App/frontend/src/components/tasks/)
Decouple task details and operations from global `AppContext` variables:
Update `TaskDetailPane.tsx`, `TaskDetailHeader.tsx`, `OverviewTab.tsx`, `ActivityTab.tsx`, `DependenciesTab.tsx`, `HistoryTab.tsx`, `EventDetailPane.tsx`, `EventDetailHeader.tsx`, and `EventOverviewTab.tsx` to read:
```typescript
const taskOrgId = task?.org_id ?? activeOrgId;
const taskSpaceId = task?.space_id ?? activeSpaceId;
```
Pass `taskOrgId` and `taskSpaceId` directly into their TanStack query/mutation hooks instead of `activeOrgId`/`activeSpaceId`.

> [!TIP]
> **Dynamic Tab Selection**: Update `isPersonal` inside `TaskDetailPane` to:
> `const isPersonalTask = taskOrgId === activeOrgId ? activeOrg?.is_personal : false;`
> This dynamically shows the Activity, Dependencies, and History tabs for collaborative tasks even while the user is viewing them within the Personal Org context!

---

## Constraints

1. **Space Membership Verification**: The Mirroring Engine must only return external tasks where the user remains an active member of the hosting space (`space_members`).
2. **Gated Mutations**: All write operations (updating a title, status, posting a comment) must route to the task's originating space endpoint. This guarantees Supabase JWT and backend RBAC are honored.
3. **Visual Clarity**: Mirrored tasks must show a clean, glassmorphic origin breadcrumb in both the list and the header.
4. **No Double Listing**: Tasks residing in the Private Space must not be duplicated by the external assignee filter query.

---

## Verification Plan

### Automated Tests
- Create integration test cases verifying:
  - `GET /api/v1/orgs/:orgId/spaces/:spaceId/tasks?mirror=true` returns both personal tasks and assigned tasks.
  - Adding `org_filter` queries tasks belonging to that organization only.
  - Making a status update request with an unauthorized session results in `403`.

### Manual Verification
1. **List Aggregation**: Log in as a user with tasks assigned in Shared Org "A" (Space "B") and personal tasks in "Private Space". View the Private Space and verify both appear in the flat list.
2. **Dropdown Filtering**:
   - Select "All Workspaces" — verify both are present.
   - Select "Shared Org A" — verify only the shared task appears.
3. **Inline Mutation**:
   - Click the mirrored shared task. Verify Overview, Activity, and History tabs appear.
   - Change the task status to "Done". Verify it completes successfully and updates.
   - Post a comment. Verify the comment appears in the feed and is successfully stored under the correct space context in the DB.
