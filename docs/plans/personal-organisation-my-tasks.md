# Personal Organisation & My Tasks — Implementation Plan

## Overview

Remove the concept of "personal mode" as a separate frontend-only state and replace it with a
**personal organisation** that is auto-created for every user on signup. The personal org behaves
like any other organisation with two differences: it cannot be deleted, and it contains a
system-managed **Private space** that is visible only to the owner and cannot have members added.

A new **My Tasks** view is introduced inside the personal org — a read-only, cross-org aggregate
of all tasks assigned to the user across every organisation they belong to.

---

## Full Context

### What Is Already Implemented

#### Personal Mode (current)
- `AppContext` holds `mode: "personal" | "organisation"` as a frontend-only flag persisted to
  `localStorage` under `keil_app_mode`.
- `setPersonalMode()` / `setOrganisationMode()` actions exist in `AppContext`.
- `isPersonalMode` is threaded as a prop through `TasksPage`, `TaskDetailPane`, `TaskListPane`,
  `CreateTaskDialog`, `OverviewTab`, `EventOverviewTab`.
- The sidebar has a dedicated "Personal" item under a "Mode" section.
- When in personal mode, org/space queries are disabled and personal task endpoints are used.

#### Personal Tasks (current)
- Separate `public.personal_tasks` table — no `org_id` or `space_id` columns.
- Dedicated routes: `GET/POST/PATCH/DELETE /api/v1/personal/tasks`.
- Dedicated service: `personal-task.service.ts`.
- Dedicated controller: `personal-task.controller.ts`.
- Dedicated frontend hook: `usePersonalTasks.ts`.
- Status values use underscores (`in_progress`) — converted at the HTTP boundary in
  `usePersonalTasks.ts` to the canonical hyphenated format (`in-progress`).
- Personal tasks have no comments, activity logs, assignees, or dependencies.

#### Organisation / Space System (current)
- Full org/space model: `organisations`, `organisation_members`, `spaces`, `space_members`, `tasks`.
- Signup trigger (`handle_new_user`) creates only a `public.users` row — no org is auto-created.
- `user.controller.ts` `getMe` contains legacy code that auto-creates a **workspace** (old model)
  if none exists. This is a dead shim — it does not create an org.
- `GET /api/v1/orgs` returns all orgs the user belongs to, sorted by `created_at ASC`.
- `OrganisationDTO` fields: `id`, `name`, `owner_user_id`, `created_at`, `updated_at`, `role`.
- `SpaceDTO` fields: `id`, `org_id`, `name`, `visibility`, `is_default`, `membership_role`,
  `compatibility_workspace_id`, `created_at`.

#### Dashboard (current)
- `Dashboard.tsx` uses `useDashboard()` (legacy workspace-scoped) in personal mode and
  `useOrgDashboard(orgId, spaceId)` in org mode.
- Legacy `GET /v1/dashboard` resolves workspace context from the user's first workspace membership.
- Org dashboard: `GET /api/v1/orgs/:orgId/spaces/:spaceId/dashboard`.

#### My Tasks (current)
- **Does not exist.** No cross-org assigned tasks view anywhere in the codebase.
- `task-locator.controller.ts` exists for a different purpose: given a `taskId`, it returns
  which `orgId`/`spaceId` owns it (used for deep-link auto-switching). This is kept as-is.

#### RBAC (current — fully implemented)
- Two-tier: org-level (`owner | admin | member`) and space-level (`admin | manager | member`).
- `requireOrgRole` / `requireSpaceRole` middleware in `rbac.middleware.ts`.
- `useSpaceRole()` hook in frontend for UI gating.
- All task, comment, and motion page routes are gated.

---

### Decisions Made

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | Personal org auto-created on signup via DB trigger | Guarantees every user always has a home context. No lazy creation needed. |
| 2 | Personal tasks migrate to `tasks` table under personal org's Private space | One unified task system. Eliminates parallel `personal_tasks` table, routes, service, and hook. Enables comments, activity, assignees on personal tasks. |
| 3 | `personal_tasks` table and `/personal/tasks` routes kept alive (not dropped) | Existing users are on the live system. Legacy code is deprecated but not removed until a dedicated cleanup phase. |
| 4 | `mode: "personal" \| "organisation"` replaced by `isPersonalOrg: boolean` | Derived from `activeOrg?.is_personal`. Simpler — no separate state to manage or persist. |
| 5 | Personal org is renameable but not deletable | Deleting it would leave the user with no home context. Renaming is harmless. |
| 6 | Private space: owner-only, no members, enforced at UI level only | DB-level enforcement adds complexity with no real security benefit — the API already requires space membership to access tasks. |
| 7 | My Tasks is a UI-only virtual view, not a real DB space | It aggregates data from other spaces. Making it a real space adds schema complexity with zero benefit. |
| 8 | My Tasks is read-only with "Open in Space →" navigation | Mutations require org/space context. Forcing the user to navigate to the native space keeps the data model clean and avoids permission complexity. |
| 9 | My Tasks flat list sorted by: overdue first → due date ASC → no due date last | Most actionable tasks surface first. No grouping by org — breadcrumb provides context. |
| 10 | Personal org pinned at top of sidebar org list with subtle visual distinction | Always accessible, visually identifiable, but not jarring. |
| 11 | Private space hidden from non-owners in sidebar | Non-owners of the personal org should never see the owner's private tasks. |
| 12 | Full RBAC applies to non-Private spaces in the personal org | Personal org can be shared (e.g., side projects). No special-casing needed. |
| 13 | Personal org named `"{user's display name}'s Org"` | Personal, clear, derived from signup metadata. Falls back to email prefix if no name. |

---

## Constraints

1. **Never drop `personal_tasks` table or `/personal/tasks` routes** until Phase 6 (legacy cleanup)
   is explicitly executed. Live users depend on them.
2. **`is_personal` flag is immutable** after org creation. No endpoint may set or unset it.
3. **`is_private` flag is immutable** after space creation. No endpoint may set or unset it.
4. **Personal org cannot be deleted.** `deleteOrganisation` must throw `400` if
   `org.is_personal = TRUE`. This is enforced at the service layer.
5. **Private space cannot have members added.** `addSpaceMember` must throw `400` if
   `space.is_private = TRUE`. Enforced at the service layer.
6. **Private space cannot be soft-deleted or hard-deleted.** `deleteSpace` and `hardDeleteSpace`
   must throw `400` if `space.is_private = TRUE`.
7. **One personal org per user.** Enforced by a partial unique index on
   `organisations(owner_user_id) WHERE is_personal = TRUE AND deleted_at IS NULL`.
8. **My Tasks endpoint is auth-only** — no `orgId`/`spaceId` in the URL. It queries across all
   orgs the user is a member of.
9. **My Tasks is read-only.** No mutation endpoints are added to the My Tasks route.
10. **`requireSpaceRole` must be placed after `requireSpaceMember`** in all middleware chains.
    It reads `req.space.membership_role` set by `requireSpaceMember`.
11. **Do not add Supabase RLS policies.** All access control goes through the Express API layer.
12. **`compatibility_workspace_id` on spaces is legacy.** Do not touch it.
13. **The `owner` role in `organisation_members` is set only at org creation** (both regular and
    personal). It is never assignable via API.
14. **Frontend role checks are UI-only conveniences.** The backend is the source of truth.
15. **The `keil_app_mode` localStorage key must be cleaned up** on first load after this change
    ships, the same way `keil_active_workspace` was cleaned up previously.

---

## Phase-Wise Implementation Plan

### Phase 1 — Database Migration

**File:** `backend/src/migrations/015_personal_organisation.sql`

#### Tasks

1. Add `is_personal BOOLEAN NOT NULL DEFAULT FALSE` column to `public.organisations`.
2. Add `is_private BOOLEAN NOT NULL DEFAULT FALSE` column to `public.spaces`.
3. Create partial unique index enforcing one personal org per user:
   ```sql
   CREATE UNIQUE INDEX IF NOT EXISTS idx_organisations_one_personal_per_user
     ON public.organisations(owner_user_id)
     WHERE is_personal = TRUE AND deleted_at IS NULL;
   ```
4. Replace `public.handle_new_user()` trigger function to:
   - Insert into `public.users` (existing logic, unchanged).
   - Derive org name: `COALESCE(full_name, name, email_prefix) || '''s Org'`.
   - Insert into `public.organisations` with `is_personal = TRUE`.
   - Insert into `public.organisation_members` with `role = 'owner'`.
   - Insert into `public.spaces` with `name = 'Private'`, `is_default = TRUE`,
     `is_private = TRUE`.
   - Insert into `public.space_members` with `role = 'admin'`.
   - All inserts in a single atomic block (the trigger function runs in one transaction).
5. Update `OrganisationDTO` in `organisation.service.ts` to include `is_personal: boolean`.
6. Update `SpaceDTO` (wherever spaces are returned) to include `is_private: boolean`.

#### Notes
- The trigger replaces the existing `handle_new_user` from migration `006`. Use
  `CREATE OR REPLACE FUNCTION`.
- Existing users in the DB will NOT have a personal org after this migration. That is acceptable
  because the decision is to wipe data before deploying. If that changes, a backfill block must
  be added.
- The `is_default = TRUE` on the Private space means it becomes the default landing space for
  invite joins. This is intentional — if someone is invited to the personal org (to a non-private
  space), they land in the Private space... which they cannot access. This is a known edge case:
  the invite flow for personal orgs should always specify a non-private space as the target.
  **Add a service-layer guard in `joinOrganisation`: if the default space is `is_private = TRUE`,
  find the next oldest non-private space instead.**

---

### Phase 2 — Backend: Service Guards & DTO Updates

**Files:** `organisation.service.ts`, `space.service.ts`, `organisation.repository.ts`

#### Tasks

1. **`organisation.service.ts`**
   - `deleteOrganisation`: fetch org row, throw `ApiError(400, "Personal organisation cannot be deleted")` if `org.is_personal = TRUE`.
   - `toDTO`: add `is_personal: row.is_personal` to `OrganisationDTO`.
   - `getUserOrganisations`: sort result so personal org is always first. Add `ORDER BY is_personal DESC, created_at ASC` to the repository query.

2. **`space.service.ts`**
   - `addSpaceMember`: fetch space row, throw `ApiError(400, "Cannot add members to a private space")` if `space.is_private = TRUE`.
   - `deleteSpace` (soft): throw `ApiError(400, "Cannot delete the private space")` if `space.is_private = TRUE`.
   - `hardDeleteSpace`: throw `ApiError(400, "Cannot delete the private space")` if `space.is_private = TRUE`.
   - Space DTO mapping: add `is_private: row.is_private` wherever spaces are returned.

3. **`organisation.repository.ts`**
   - Update `findByUserId` query: add `ORDER BY o.is_personal DESC, o.created_at ASC` so personal org is always first in the returned array.

4. **`joinOrganisation` in `organisation.service.ts`**
   - After finding `defaultSpace`, check `defaultSpace.is_private`. If true, query for the oldest non-private, non-deleted space in the org instead. If none exists, throw `ApiError(400, "This organisation has no joinable spaces")`.

---

### Phase 3 — Backend: My Tasks Endpoint

**New files:** `backend/src/controllers/my-tasks.controller.ts`,
`backend/src/services/my-tasks.service.ts`

**Modified files:** `backend/src/routes/v1.routes.ts`

#### API Contract

```
GET /api/v1/my-tasks
Auth: protect (no org/space scope)
Query params:
  status?:   "backlog" | "todo" | "in-progress" | "done"
  priority?: "low" | "medium" | "high" | "urgent"
  org_id?:   UUID (filter to a single org)

Response 200:
{
  tasks: MyTaskDTO[]
}
```

#### `MyTaskDTO` shape

```typescript
interface MyTaskDTO {
  id: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  start_date: string | null;
  created_at: string;
  updated_at: string;
  org_id: string;
  org_name: string;
  space_id: string;
  space_name: string;
}
```

#### SQL query (in `my-tasks.service.ts`)

```sql
SELECT
  t.id, t.title, t.status, t.priority,
  t.due_date, t.start_date, t.created_at, t.updated_at,
  o.id   AS org_id,   o.name   AS org_name,
  s.id   AS space_id, s.name   AS space_name
FROM public.tasks t
INNER JOIN public.task_assignees ta
  ON ta.task_id = t.id AND ta.user_id = $1
INNER JOIN public.organisations o
  ON o.id = t.org_id AND o.deleted_at IS NULL
INNER JOIN public.spaces s
  ON s.id = t.space_id AND s.deleted_at IS NULL
INNER JOIN public.organisation_members om
  ON om.org_id = t.org_id AND om.user_id = $1
WHERE t.deleted_at IS NULL
  AND ($2::task_status IS NULL OR t.status = $2)
  AND ($3::task_priority IS NULL OR t.priority = $3)
  AND ($4::uuid IS NULL OR t.org_id = $4)
ORDER BY
  CASE WHEN t.due_date < NOW() THEN 0 ELSE 1 END ASC,
  t.due_date ASC NULLS LAST,
  t.created_at DESC
```

#### Tasks

1. Create `my-tasks.service.ts` with `getMyTasks(userId, filters)` function.
2. Create `my-tasks.controller.ts` with `getMyTasks` handler using `catchAsync`.
3. Register route in `v1.routes.ts`: `router.get("/my-tasks", protect, getMyTasksController)`.

---

### Phase 4 — Frontend: AppContext Refactor

**File:** `frontend/src/contexts/AppContext.tsx`

#### Tasks

1. **Remove** `mode: AppMode`, `AppMode` type, `setPersonalMode`, `setOrganisationMode`.
2. **Remove** `STORAGE_MODE` localStorage key (`keil_app_mode`). Add cleanup on first load:
   ```typescript
   useEffect(() => {
     localStorage.removeItem("keil_app_mode");
     localStorage.removeItem(LEGACY_WORKSPACE_KEY);
   }, []);
   ```
3. **Add** `isPersonalOrg: boolean` to `AppContextType`, derived as:
   ```typescript
   const isPersonalOrg = useMemo(
     () => activeOrg?.is_personal ?? false,
     [activeOrg]
   );
   ```
4. **Update auto-select logic on load:** If no `activeOrgId` is stored in localStorage (new user
   or cleared state), find the personal org in the `organisations` list and call
   `setActiveOrganisation(personalOrg.id)`. This replaces the old "land in personal mode" behavior.
   ```typescript
   useEffect(() => {
     if (isLoadingOrgs || organisations.length === 0) return;
     if (!activeOrgId) {
       const personal = organisations.find(o => o.is_personal);
       if (personal) setActiveOrganisation(personal.id);
     }
   }, [organisations, isLoadingOrgs, activeOrgId]);
   ```
5. **Update membership validation effect:** When the stored `activeOrgId` is no longer in the
   org list, fall back to the personal org instead of clearing to null:
   ```typescript
   const personal = organisations.find(o => o.is_personal);
   if (personal) setActiveOrganisation(personal.id);
   else { /* clear state as before */ }
   ```
6. **Remove** `setOrganisationMode` from the context value and type entirely.
7. **Update** `useSpaces` call — remove the `mode === "organisation" ?` guard. Spaces are always
   fetched when `activeOrgId` is set (personal org always has an `activeOrgId`):
   ```typescript
   const { data: spaces = [], isLoading: isLoadingSpaces } = useSpaces(activeOrgId);
   ```
8. **Update** `Organisation` type in `useOrganisations.ts` to add `is_personal: boolean`.
9. **Update** `Space` type in `useSpaces.ts` to add `is_private: boolean`.

---

### Phase 5 — Frontend: AppSidebar Refactor

**File:** `frontend/src/components/AppSidebar.tsx`

#### Tasks

1. **Remove** the "Mode" section (the `DropdownMenuItem` for "Personal" and its separator).
2. **Remove** the `setPersonalMode` import and usage.
3. **Remove** the "Organisation" label section header with the Join/Create buttons — move those
   buttons to a simpler location (e.g., at the bottom of the org list).
4. **Update** `currentSpaceLabel`: remove the `mode === "personal"` branch. Always show
   `activeSpace?.name ?? activeOrg?.name ?? "..."`.
5. **Update** `OrgSpaceSubmenu` to filter out the Private space for non-owners:
   ```typescript
   const isOrgOwner = org.role === "owner";
   const visibleSpaces = spaces.filter(s => !s.is_private || isOrgOwner);
   ```
6. **Add** "My Tasks" as a special entry at the top of the personal org's space submenu:
   - Rendered only when `org.is_personal === true`.
   - Uses `ListChecks` icon (or `Inbox`).
   - `onSelect`: `navigate("/my-tasks")` — does NOT call `setActiveOrganisation`.
   - Shown above the actual space list, separated by a thin divider.
7. **Visual distinction for personal org row:**
   - Replace the letter-avatar with a `User` icon in a muted circle.
   - Add a small `(Personal)` label in muted text below the org name, or use a subtle badge.
   - Keep the same `OrgSpaceSubmenu` component — only the avatar rendering changes.
8. **Org list ordering:** Personal org is always first because the backend already returns it
   first (`ORDER BY is_personal DESC`). No frontend sorting needed.
9. **Add My Tasks to the main navigation items** as a sidebar nav link:
   ```typescript
   { title: "My Tasks", url: "/my-tasks", icon: ListChecks }
   ```
   This gives it a permanent home in the nav, not just inside the personal org submenu.

---

### Phase 6 — Frontend: Remove `isPersonalMode` Prop Threading

**Files:** `TasksPage.tsx`, `TaskDetailPane.tsx`, `TaskListPane.tsx`, `CreateTaskDialog.tsx`,
`OverviewTab.tsx`, `EventOverviewTab.tsx`

#### Tasks

1. **`TasksPage.tsx`**
   - Remove `isPersonalMode` derivation from `mode`.
   - Remove `usePersonalTasks` import and all `personalTasksRaw` / `personalTasks` logic.
   - Remove the `isPersonalMode ? personalTasks : orgTasks` branching — always use `orgTasks`.
   - Remove `isPersonalMode ? null : activeOrgId` guards — always pass `activeOrgId`.
   - Remove `isPersonalMode ? {} : serverFilters` — always pass `serverFilters`.
   - Remove `isPersonalMode` from `handleUpdateTask`, `handleDeleteTask`, `handleTaskSchedule`.
   - Remove `isPersonalMode` prop from all child component usages.
   - Remove `updatePersonalTask` and `deletePersonalTask` mutation imports.
   - The `is_all_day` field: personal tasks (now in `tasks` table) support it — remove the
     personal-mode special case in `handleTaskSchedule`.

2. **`TaskDetailPane.tsx`**
   - Remove `isPersonalMode` prop from interface and implementation.
   - Remove the `isPersonalMode ? null : activeOrgId` guard on `useOrgTask`.
   - Remove the tab restriction logic (`isPersonalMode ? "xl:w-[200px] grid-cols-1" : ...`).
     All four tabs (Overview, Activity, Dependencies, History) are now always shown.
   - Remove `updatePersonalTask` and `deletePersonalTask` imports and usage.

3. **`TaskListPane.tsx`**
   - Remove `isPersonalMode` prop from interface and implementation.
   - Remove `isPersonalMode` pass-through to `CreateTaskDialog`.

4. **`CreateTaskDialog.tsx`**
   - Remove `isPersonalMode` prop from interface and implementation.
   - Remove the `isPersonalMode ? personalCreate : orgCreate` branching — always use org endpoints.
   - Remove `useCreatePersonalTask` and `useUpdatePersonalTask` imports.

5. **`OverviewTab.tsx`**
   - Remove `mode` from `useAppContext()` destructure.
   - Remove `isOrgMode` derivation — assignee picker is always enabled (org context always exists).

6. **`EventOverviewTab.tsx`**
   - Same as `OverviewTab.tsx` — remove `isOrgMode` and always enable assignee picker.

7. **Delete `frontend/src/hooks/api/usePersonalTasks.ts`** — no longer referenced anywhere.

---

### Phase 7 — Frontend: My Tasks Page

**New files:** `frontend/src/components/MyTasksPage.tsx`,
`frontend/src/hooks/api/useMyTasks.ts`

**Modified files:** `frontend/src/App.tsx`

#### `useMyTasks.ts`

```typescript
export interface MyTaskDTO {
  id: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  start_date: string | null;
  created_at: string;
  updated_at: string;
  org_id: string;
  org_name: string;
  space_id: string;
  space_name: string;
}

export interface MyTasksFilters {
  status?: TaskStatus;
  priority?: TaskPriority;
  org_id?: string;
}

export function useMyTasks(filters: MyTasksFilters = {}) {
  return useQuery<MyTaskDTO[]>({
    queryKey: ["my-tasks", filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.status)   params.set("status",   filters.status);
      if (filters.priority) params.set("priority", filters.priority);
      if (filters.org_id)   params.set("org_id",   filters.org_id);
      const res = await api.get<{ data: { tasks: MyTaskDTO[] } }>(
        `v1/my-tasks?${params.toString()}`
      );
      return res.data.data.tasks ?? [];
    },
  });
}
```

#### `MyTasksPage.tsx` — component structure

```
MyTasksPage
├── Header: "My Tasks" title + subtitle "Tasks assigned to you across all organisations"
├── FilterBar
│   ├── StatusFilter (dropdown: All / Backlog / Todo / In Progress / Done)
│   ├── PriorityFilter (dropdown: All / Low / Medium / High / Urgent)
│   └── OrgFilter (dropdown: All orgs + each org by name)
├── TaskList (flat, no pagination initially)
│   └── MyTaskRow (per task)
│       ├── StatusBadge (read-only colored chip)
│       ├── PriorityChip (read-only)
│       ├── Title
│       ├── Breadcrumb: "{org_name} › {space_name}" (muted, below title)
│       ├── DueDate (red if overdue, amber if today)
│       └── "Open in Space →" button
└── EmptyState (when no tasks assigned)
```

#### "Open in Space →" behavior

```typescript
const { setActiveOrganisation } = useAppContext();
const navigate = useNavigate();

const handleOpen = (task: MyTaskDTO) => {
  setActiveOrganisation(task.org_id, task.space_id);
  navigate(`/tasks/${task.id}`);
};
```

#### Route registration in `App.tsx`

```tsx
<Route path="/my-tasks" element={<Layout><MyTasksPage /></Layout>} />
```

---

### Phase 8 — Frontend: Settings Guards

**File:** `frontend/src/components/SettingsDialog.tsx`

#### Tasks

1. **Hide "Delete Organisation" button** when `activeOrg?.is_personal === true`.
   ```tsx
   {!activeOrg?.is_personal && (
     <Button variant="destructive" onClick={handleDeleteOrg}>
       Delete Organisation
     </Button>
   )}
   ```
2. **Hide "Add Member to Space" button** in `SpacesTab` when the selected space has
   `is_private === true`.
   ```tsx
   {!selectedSpace?.is_private && <AddMemberButton />}
   ```
3. **Hide "Delete Space" button** in `SpacesTab` when `selectedSpace?.is_private === true`.
4. In `SettingsDialog`, when `deleteOrg` succeeds, instead of calling `setPersonalMode()`,
   call `setActiveOrganisation(personalOrg.id)` where `personalOrg` is found from the
   `organisations` list.

---

### Phase 9 — Legacy Cleanup (Deferred — Do Not Execute Until Explicitly Scheduled)

This phase removes all legacy personal-mode infrastructure. It must only be executed after
confirming that no active users are relying on the `/personal/tasks` endpoints (monitor API
logs for calls to `/api/v1/personal/tasks`).

#### Backend — files to delete

| File | Reason |
|------|--------|
| `backend/src/controllers/personal-task.controller.ts` | Replaced by org task controller |
| `backend/src/services/personal-task.service.ts` | Replaced by org task service |
| `backend/src/routes/personal-task.routes.ts` | Route removed |
| `backend/src/routes/activity.routes.ts` | Legacy dashboard/activity routes |

#### Backend — files to modify

| File | Change |
|------|--------|
| `backend/src/routes/v1.routes.ts` | Remove `router.use("/personal", personalTaskRoutes)` and `router.use("/", activityRoutes)` |
| `backend/src/controllers/activity.controller.ts` | Remove `resolveWorkspaceId` helper and legacy `getDashboardInfo` / `getActivityFeed` handlers |
| `backend/src/controllers/user.controller.ts` | Remove workspace auto-creation from `getMe` |

#### Frontend — files to delete

| File | Reason |
|------|--------|
| `frontend/src/hooks/api/usePersonalTasks.ts` | Already deleted in Phase 6 |

#### Frontend — files to modify

| File | Change |
|------|--------|
| `frontend/src/hooks/api/useDashboard.ts` | Remove `useDashboard()` legacy export; keep `useOrgDashboard` only |
| `frontend/src/components/Dashboard.tsx` | Remove `useDashboard()` usage; always use `useOrgDashboard(activeOrgId, activeSpaceId)` |

#### Database — tables to drop (in a new migration `016_drop_personal_tasks.sql`)

```sql
DROP TABLE IF EXISTS public.personal_tasks CASCADE;
```

> **Warning:** Run this only after confirming zero traffic to `/api/v1/personal/tasks` and after
> all users have been migrated or data has been wiped.

---

## Files to Create

| File | Phase | Purpose |
|------|-------|---------|
| `backend/src/migrations/015_personal_organisation.sql` | 1 | DB schema changes + trigger update |
| `backend/src/controllers/my-tasks.controller.ts` | 3 | My Tasks route handler |
| `backend/src/services/my-tasks.service.ts` | 3 | Cross-org assigned tasks query |
| `frontend/src/components/MyTasksPage.tsx` | 7 | My Tasks read-only view |
| `frontend/src/hooks/api/useMyTasks.ts` | 7 | My Tasks data fetching hook |

## Files to Modify

| File | Phase | Changes |
|------|-------|---------|
| `backend/src/services/organisation.service.ts` | 2 | Delete guard, `is_personal` in DTO, sort order |
| `backend/src/services/space.service.ts` | 2 | Private space guards, `is_private` in DTO |
| `backend/src/repositories/organisation.repository.ts` | 2 | Sort by `is_personal DESC` |
| `backend/src/routes/v1.routes.ts` | 3 | Register `/my-tasks` route |
| `frontend/src/contexts/AppContext.tsx` | 4 | Remove `mode`, add `isPersonalOrg`, fix auto-select |
| `frontend/src/hooks/api/useOrganisations.ts` | 4 | Add `is_personal: boolean` to `Organisation` type |
| `frontend/src/hooks/api/useSpaces.ts` | 4 | Add `is_private: boolean` to `Space` type |
| `frontend/src/components/AppSidebar.tsx` | 5 | Remove Personal mode item, personal org styling, My Tasks entry |
| `frontend/src/components/TasksPage.tsx` | 6 | Remove all `isPersonalMode` branching |
| `frontend/src/components/tasks/TaskDetailPane.tsx` | 6 | Remove `isPersonalMode` prop |
| `frontend/src/components/tasks/TaskListPane.tsx` | 6 | Remove `isPersonalMode` prop |
| `frontend/src/components/tasks/CreateTaskDialog.tsx` | 6 | Remove `isPersonalMode` prop |
| `frontend/src/components/tasks/OverviewTab.tsx` | 6 | Remove `isOrgMode` guard |
| `frontend/src/components/tasks/EventOverviewTab.tsx` | 6 | Remove `isOrgMode` guard |
| `frontend/src/components/SettingsDialog.tsx` | 8 | Hide delete org + private space member controls |
| `frontend/src/App.tsx` | 7 | Register `/my-tasks` route |

## Files to Delete (Phase 6)

| File | Reason |
|------|--------|
| `frontend/src/hooks/api/usePersonalTasks.ts` | Replaced by `useOrgTasks` |

---

## Acceptance Criteria

### AC-1: Personal Org Auto-Creation on Signup

| Ref | Test | Expected |
|-----|------|----------|
| AC-1.1 | Sign up with a new account (email + password) | `public.organisations` has a row with `is_personal = TRUE` and `owner_user_id = new_user_id` |
| AC-1.2 | Sign up with Google OAuth | Same as AC-1.1; org name derived from Google display name |
| AC-1.3 | Check org name after signup | Org name is `"{display_name}'s Org"` or `"{email_prefix}'s Org"` if no display name |
| AC-1.4 | Check spaces after signup | One space exists: `name = 'Private'`, `is_default = TRUE`, `is_private = TRUE` |
| AC-1.5 | Check org membership after signup | User is in `organisation_members` with `role = 'owner'` |
| AC-1.6 | Check space membership after signup | User is in `space_members` with `role = 'admin'` for the Private space |
| AC-1.7 | Attempt to create a second personal org via DB | Rejected by `idx_organisations_one_personal_per_user` unique constraint |

### AC-2: Personal Org Restrictions

| Ref | Test | Expected |
|-----|------|----------|
| AC-2.1 | Call `DELETE /api/v1/orgs/:personalOrgId` | Returns `400` with message "Personal organisation cannot be deleted" |
| AC-2.2 | Call `PATCH /api/v1/orgs/:personalOrgId` with a new name | Returns `200`; org is renamed successfully |
| AC-2.3 | Call `POST /api/v1/orgs/:personalOrgId/spaces/:privateSpaceId/members` | Returns `400` with message "Cannot add members to a private space" |
| AC-2.4 | Call `DELETE /api/v1/orgs/:personalOrgId/spaces/:privateSpaceId` | Returns `400` with message "Cannot delete the private space" |
| AC-2.5 | Call `DELETE /api/v1/orgs/:personalOrgId/spaces/:privateSpaceId/permanent` | Returns `400` with message "Cannot delete the private space" |

### AC-3: Frontend — Personal Org in Sidebar

| Ref | Test | Expected |
|-----|------|----------|
| AC-3.1 | Open sidebar profile dropdown | No "Personal" mode item exists; no "Mode" section header |
| AC-3.2 | Inspect org list in dropdown | Personal org is always the first entry |
| AC-3.3 | Visual distinction of personal org | Personal org row shows a `User` icon avatar (not a letter) and a subtle "(Personal)" indicator |
| AC-3.4 | Hover personal org row to open submenu | "My Tasks" entry appears at the top of the submenu, above the space list |
| AC-3.5 | Log in as a non-owner member of a personal org | Private space does NOT appear in the space submenu for that user |
| AC-3.6 | Log in as the owner of a personal org | Private space DOES appear in the space submenu |

### AC-4: App Context — No Personal Mode

| Ref | Test | Expected |
|-----|------|----------|
| AC-4.1 | Fresh login (no localStorage) | App auto-selects the personal org and its Private space |
| AC-4.2 | `localStorage` after login | `keil_app_mode` key does not exist; `keil_active_org` is set to personal org UUID |
| AC-4.3 | `useAppContext()` in any component | `mode` property does not exist; `isPersonalOrg` is `true` when personal org is active |
| AC-4.4 | Switch to a regular org | `isPersonalOrg` becomes `false` |
| AC-4.5 | Remove user from a regular org externally | App falls back to personal org automatically |

### AC-5: Tasks in Personal Org Private Space

| Ref | Test | Expected |
|-----|------|----------|
| AC-5.1 | Navigate to Tasks while personal org + Private space is active | Task list loads using `GET /api/v1/orgs/:personalOrgId/spaces/:privateSpaceId/tasks` |
| AC-5.2 | Create a task in the Private space | Task is created in `public.tasks` with `org_id = personalOrgId`, `space_id = privateSpaceId` |
| AC-5.3 | Open a task detail in the Private space | All four tabs (Overview, Activity, Dependencies, History) are visible |
| AC-5.4 | Check `isPersonalMode` prop in any component | Prop does not exist anywhere in the component tree |

### AC-6: My Tasks View

| Ref | Test | Expected |
|-----|------|----------|
| AC-6.1 | Navigate to `/my-tasks` | Page renders with a flat list of tasks assigned to the user across all orgs |
| AC-6.2 | Each task row | Shows title, read-only status badge, read-only priority chip, due date (red if overdue), and org+space breadcrumb |
| AC-6.3 | Click "Open in Space →" on a task | App switches to that org+space and navigates to `/tasks/:taskId` |
| AC-6.4 | Filter by status | List updates to show only tasks with that status |
| AC-6.5 | Filter by org | List updates to show only tasks from that org |
| AC-6.6 | Task from an org the user has left | Does not appear in the list |
| AC-6.7 | No tasks assigned | Empty state is shown |
| AC-6.8 | `GET /api/v1/my-tasks` with no auth | Returns `401` |
| AC-6.9 | `GET /api/v1/my-tasks` with valid auth | Returns only tasks where the user is both an org member AND a task assignee |
| AC-6.10 | Overdue tasks | Appear at the top of the list; due date shown in red |

### AC-7: Settings Guards

| Ref | Test | Expected |
|-----|------|----------|
| AC-7.1 | Open Settings while personal org is active | "Delete Organisation" button is not visible |
| AC-7.2 | Open Settings while a regular org is active | "Delete Organisation" button is visible |
| AC-7.3 | Open Settings → Spaces, select the Private space | "Add Member" button is not visible; "Delete Space" button is not visible |
| AC-7.4 | Open Settings → Spaces, select a non-private space in personal org | "Add Member" and "Delete Space" buttons are visible (normal behavior) |

### AC-8: Legacy Compatibility (Pre-Phase-9)

| Ref | Test | Expected |
|-----|------|----------|
| AC-8.1 | Call `GET /api/v1/personal/tasks` with valid auth | Returns `200` with existing personal tasks (legacy route still active) |
| AC-8.2 | `public.personal_tasks` table | Still exists in the database |
| AC-8.3 | `useDashboard()` legacy hook | Still exported from `useDashboard.ts` (not yet removed) |

---

## Implementation Order

```
Phase 1  → DB migration (015_personal_organisation.sql)
Phase 2  → Backend service guards + DTO updates
Phase 3  → Backend My Tasks endpoint
Phase 4  → Frontend AppContext refactor
Phase 5  → Frontend AppSidebar refactor
Phase 6  → Frontend remove isPersonalMode prop threading + delete usePersonalTasks
Phase 7  → Frontend MyTasksPage + useMyTasks + route registration
Phase 8  → Frontend Settings guards
Phase 9  → Legacy cleanup (deferred — schedule separately)
```

Phases 1–3 are backend-only and can be deployed independently before any frontend changes.
Phases 4–8 are a single frontend deployment. Phase 9 is a separate, explicitly scheduled release.
