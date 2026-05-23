# RBAC Implementation Plan

## Overview

Implement a clean two-tier RBAC system across the full stack.

- **Org level:** `owner | admin` — controls org-wide operations only
- **Space level:** `admin | manager | member` — controls all in-space operations

The org `owner` is the only org-level role set at creation. `admin` is the only delegatable org role. Spaces have no `owner` concept — the user who creates a space gets `admin`. This keeps the model simple: org roles govern org management, space roles govern everything inside a space.

The plan also fixes the invite/join flow: users join the org + default "General" space only. All other spaces require explicit addition by an org admin/owner.

---

## Role Definitions

### Org-Level Roles (`organisation_members.role`)

| Role | Capabilities |
|------|-------------|
| `owner` | Create org, delete org, rename org, promote/demote org admins, remove any member, generate invite links, manage all spaces |
| `admin` | Invite users to org, create/rename/delete/restore spaces, add/remove space members, assign space roles, remove non-owner org members. Cannot delete org or touch other admins. |

> Users who are org members but not `owner` or `admin` have no org-level role row — they exist in `organisation_members` with role `member` (kept for DB integrity, but carries no special permissions beyond being in the org).

### Space-Level Roles (`space_members.role`)

| Role | Tasks | Comments | Motion Pages | Space Settings |
|------|-------|----------|--------------|----------------|
| `admin` | Full CRUD + assign + delete any | Full (create/delete any) | Create/edit/delete any | Rename space, manage members, set roles |
| `manager` | Create/update/assign/delete any + change any status | Create/delete own only | Create/edit/delete own only, view all | None |
| `member` | View only + change status of assigned tasks only | Create/delete own only | View only | None |

**Key rules:**
- Org `owner`/`admin` can generate invite links. No one else.
- Invite links always join users as `member` in `organisation_members` + `member` in the default space.
- Role assignment after joining: org `owner`/`admin` sets org role (`admin` or demote back to `member`). Space `admin` sets space role (`admin`/`manager`/`member`).
- Org `admin` cannot change another org `admin`'s role or the `owner`'s role.
- Space `admin` cannot change another space `admin`'s role — only the org `owner`/`admin` can do that.
- No `owner` role exists at the space level. Space creator gets `admin`.
- Removing a user from the org cascades to remove them from all spaces (existing FK handles this).
- Removing a user from a space does NOT remove them from the org.

---

## Current State vs Target State

### What exists
- `member_role` enum: `owner | admin | member` on both `organisation_members` and `space_members`
- Space creators are inserted as `owner` in `space_members` — this needs to change to `admin`
- Ad-hoc role checks in service functions (`requireOrgAdmin`, `assertOwnerOrAdmin`)
- `requireOrgMember` and `requireSpaceMember` middleware attach `membership_role` to `req.org`/`req.space` but do NOT enforce permissions declaratively
- Invite flow: any org member can generate invite link — needs restriction to `owner`/`admin`
- Frontend: `role` field exists on `Organisation` and `Space` types; `isAdmin` checks exist in `SpacesTab`

### What needs to change
- DB: Add `manager` to `member_role` enum
- DB: Migrate existing `owner` rows in `space_members` to `admin` (space-level owner concept is removed)
- DB: Add `is_default` flag to `spaces` table so default space is explicit, not positional
- DB: Update `spaceRepository.createWithOwner` to insert `admin` instead of `owner` for space creator
- Backend: Restrict invite generation to org `owner`/`admin` only
- Backend: Replace all ad-hoc role checks with centralized `requireOrgRole` / `requireSpaceRole` middleware
- Backend: Add role enforcement to every task, comment, and motion page operation
- Backend: Add space member role management endpoint
- Backend: Update org role management to only allow `admin`/`member` values (no `owner` assignable)
- Frontend: Update role type unions (`owner` removed from space roles)
- Frontend: Expose role-aware UI (hide/disable actions based on space role)
- Frontend: Add space member role management UI
- Frontend: Add org member management UI

---

## Phase 1 — Database Migration

**File:** `backend/src/migrations/014_rbac_roles.sql`

### Tasks

1. Add `manager` to `member_role` enum:
   ```sql
   ALTER TYPE public.member_role ADD VALUE IF NOT EXISTS 'manager';
   ```

2. Migrate space `owner` → `admin` in `space_members`. Space-level `owner` is abolished:
   ```sql
   UPDATE public.space_members SET role = 'admin' WHERE role = 'owner';
   ```

3. Add `is_default` boolean column to `spaces`:
   ```sql
   ALTER TABLE public.spaces ADD COLUMN IF NOT EXISTS is_default BOOLEAN NOT NULL DEFAULT FALSE;
   ```
   Mark the oldest active space per org as default:
   ```sql
   UPDATE public.spaces s
   SET is_default = TRUE
   FROM (
     SELECT DISTINCT ON (org_id) id
     FROM public.spaces
     WHERE deleted_at IS NULL
     ORDER BY org_id, created_at ASC
   ) first_space
   WHERE s.id = first_space.id;
   ```
   Enforce one default per org with a partial unique index:
   ```sql
   CREATE UNIQUE INDEX IF NOT EXISTS idx_spaces_one_default_per_org
     ON public.spaces(org_id)
     WHERE is_default = TRUE AND deleted_at IS NULL;
   ```

4. Update `spaceRepository.createWithOwner` — change the inserted role from `'owner'` to `'admin'`.

5. Update `spaceRepository.findDefaultSpace` — change query from `ORDER BY created_at ASC LIMIT 1` to `WHERE is_default = TRUE LIMIT 1`.

6. When `createOrganisation` creates the first space, pass `is_default = TRUE` to `spaceRepository.createWithOwner`.

---

## Phase 2 — Backend: Centralized RBAC Middleware

**File:** `backend/src/middlewares/rbac.middleware.ts` (new file)

### Design

Two middleware factories that read the role already attached by the context middleware and reject if not in the allowed list.

```typescript
// Reads req.org.membership_role (set by requireOrgMember)
requireOrgRole("owner", "admin")

// Reads req.space.membership_role (set by requireSpaceMember)
requireSpaceRole("admin", "manager")
```

Role hierarchy:
```
Org:   owner > admin > member
Space: admin > manager > member
```

### Tasks

1. Create `rbac.middleware.ts` with:
   - `requireOrgRole(...allowedRoles: OrgRole[])` — Express middleware factory
   - `requireSpaceRole(...allowedRoles: SpaceRole[])` — Express middleware factory
   - Both emit a structured warning log on denial: `[rbac] DENIED userId=... required=... actual=... path=...`
   - Both return `403` with `{ success: false, message: "Insufficient permissions" }`

2. Add to `backend/src/types/enums.ts` (or create if not exists):
   ```typescript
   export type OrgRole = "owner" | "admin" | "member";
   export type SpaceRole = "admin" | "manager" | "member";
   ```

---

## Phase 3 — Backend: Route-Level Permission Enforcement

### 3a. Org Routes (`org.routes.ts` + `organisation.service.ts`)

| Endpoint | Current guard | Target guard |
|----------|--------------|-------------|
| `POST /orgs/:orgId/invite` | any member (service) | `requireOrgRole("owner", "admin")` |
| `PATCH /orgs/:orgId` | admin+ (service) | `requireOrgRole("owner", "admin")` |
| `DELETE /orgs/:orgId` | owner only (service) | `requireOrgRole("owner")` |
| `GET /orgs/:orgId/members` | any member | no change |
| `PATCH /orgs/:orgId/members/:userId` | admin+ (service) | `requireOrgRole("owner", "admin")` |
| `DELETE /orgs/:orgId/members/:userId` | admin+ (service) | `requireOrgRole("owner", "admin")` |

Update `updateOrgMemberRole` in `organisation.service.ts`:
- Valid assignable org roles: `admin` and `member` only (`owner` is never assignable)
- Org `owner` can promote `member` → `admin` or demote `admin` → `member`
- Org `admin` can only demote `member` → `member` (no-op) — cannot promote to `admin`, cannot touch other `admin`s or `owner`
- Reject if target is `owner`

Remove the `requireOrgAdmin` helper function from `organisation.service.ts` — role checks move to middleware.

### 3b. Space Routes (`org.routes.ts` + `space.service.ts`)

All space management operations are org-level (creating, deleting, restoring spaces is an org admin power, not a space power):

| Endpoint | Current guard | Target guard |
|----------|--------------|-------------|
| `POST /orgs/:orgId/spaces` | `assertOwnerOrAdmin` | `requireOrgRole("owner", "admin")` |
| `PATCH /orgs/:orgId/spaces/:spaceId` | `assertOwnerOrAdmin` | `requireOrgRole("owner", "admin")` |
| `DELETE /orgs/:orgId/spaces/:spaceId` | `assertOwnerOrAdmin` | `requireOrgRole("owner", "admin")` |
| `POST /orgs/:orgId/spaces/:spaceId/restore` | `assertOwnerOrAdmin` | `requireOrgRole("owner", "admin")` |
| `DELETE /orgs/:orgId/spaces/:spaceId/permanent` | `requireOrgRole("owner", "admin")` | no change |
| `POST /orgs/:orgId/spaces/:spaceId/members` | `assertOwnerOrAdmin` | `requireOrgRole("owner", "admin")` |
| `DELETE /orgs/:orgId/spaces/:spaceId/members/:userId` | `assertOwnerOrAdmin` | `requireOrgRole("owner", "admin")` |

Add new endpoint for space member role update:
```
PATCH /orgs/:orgId/spaces/:spaceId/members/:userId
Body: { role: "admin" | "manager" | "member" }
Guard: requireOrgMember → requireSpaceMember → requireSpaceRole("admin")
```

Space role update rules (in `space.service.ts`):
- Space `admin` can set any non-admin member to `admin`/`manager`/`member`
- Space `admin` cannot change another `admin`'s role — only org `owner`/`admin` can do that
- `member` role in `organisation_members` is never changed by space operations

Remove `assertOwnerOrAdmin` helper from `space.service.ts` entirely.

### 3c. Task Routes (`org-task.routes.ts` + `org-task.service.ts`)

All task routes already require `protect + requireOrgMember + requireSpaceMember`. Add `requireSpaceRole` per endpoint:

| Endpoint | Allowed Space Roles |
|----------|-------------------|
| `POST /tasks` | `admin`, `manager` |
| `GET /tasks` | `admin`, `manager`, `member` |
| `GET /tasks/:id` | `admin`, `manager`, `member` |
| `PATCH /tasks/:id` | `admin`, `manager` |
| `DELETE /tasks/:id` | `admin`, `manager` |
| `PATCH /tasks/:id/status` | `admin`, `manager`, `member` (member restricted in service) |
| `POST /tasks/:id/assignees` | `admin`, `manager` |
| `DELETE /tasks/:id/assignees/:userId` | `admin`, `manager` |
| `POST /tasks/:id/dependencies` | `admin`, `manager` |
| `DELETE /tasks/:id/dependencies/:blockedByTaskId` | `admin`, `manager` |
| `GET /tasks/:id/subtasks` | `admin`, `manager`, `member` |
| `GET /tasks/:id/comments` | `admin`, `manager`, `member` |
| `POST /tasks/:id/comments` | `admin`, `manager`, `member` |
| `DELETE /tasks/:id/comments/:commentId` | `admin`, `manager`, `member` (own-only restriction in service) |

**Member status change rule** — in `org-task.service.ts` `changeTaskStatus`:
- If caller's space role is `member`, verify they are an assignee of the task
- If not an assignee: return `403` — "Members can only change status of tasks assigned to them"

**Comment delete rule** — in `comment.service.ts` `hardDeleteComment`:
- `admin`: can delete any comment
- `manager` and `member`: can only delete their own comment — return `403` if `comment.user_id !== userId`

### 3d. Motion Page Routes (`motion-page.routes.ts` + `motion-page.service.ts`)

| Endpoint | Allowed Space Roles |
|----------|-------------------|
| `GET /notes` | `admin`, `manager`, `member` |
| `GET /notes/:id` | `admin`, `manager`, `member` |
| `POST /notes` | `admin`, `manager` |
| `PATCH /notes/:id` | `admin` (any page); `manager` (own pages only — enforced in service) |
| `DELETE /notes/:id` | `admin` (any page); `manager` (own pages only — enforced in service) |
| `POST /notes/:id/shares` | `admin` (any page); `manager` (own pages only — enforced in service) |
| `DELETE /notes/:id/shares/:shareId` | `admin` (any page); `manager` (own pages only — enforced in service) |

**Manager own-page rule** — in `motion-page.service.ts`, for edit/delete/share operations:
- Fetch the page, check `page.created_by === userId`
- If not: return `403` — "Managers can only edit their own pages"

---

## Phase 4 — Backend: Invite Flow Fix

**File:** `backend/src/services/organisation.service.ts`

### Change in `generateInviteToken`

```typescript
// Replace the existing membership check:
const role = await organisationRepository.getMemberRole(orgId, userId);
if (!role) throw new ApiError(403, "Not a member of this organisation");

// With:
const role = await organisationRepository.getMemberRole(orgId, userId);
if (role !== "owner" && role !== "admin") {
  throw new ApiError(403, "Only organisation admins and owners can generate invite links");
}
```

Also add `requireOrgRole("owner", "admin")` to the route in `org.routes.ts`.

### Join flow — verify and keep as-is

`joinOrganisation` in `organisation.service.ts`:
- Adds user to org as `member` in `organisation_members` ✓
- Adds user to default space as `member` in `space_members` (using `findDefaultSpace`) ✓
- After Phase 1, `findDefaultSpace` uses `WHERE is_default = TRUE` ✓
- No other spaces are touched — correct behavior ✓

---

## Phase 5 — Backend: Space Member Role Management

**New endpoint:** `PATCH /api/v1/orgs/:orgId/spaces/:spaceId/members/:userId`

### Route (`org.routes.ts`)
```typescript
router.patch(
  "/:orgId/spaces/:spaceId/members/:userId",
  requireOrgMember,
  requireSpaceMember,
  requireSpaceRole("admin"),
  updateSpaceMemberRole
);
```

### Controller (`space.controller.ts`)
```typescript
export const updateSpaceMemberRole = catchAsync(async (req, res) => {
  const orgId = req.params.orgId as string;
  const spaceId = req.params.spaceId as string;
  const targetUserId = req.params.userId as string;
  const actorUserId = (req as any).user.id as string;
  const { role } = req.body;

  if (!["admin", "manager", "member"].includes(role)) {
    throw new ApiError(400, "Role must be admin, manager, or member");
  }

  await spaceService.updateSpaceMemberRole(orgId, spaceId, actorUserId, targetUserId, role);
  res.status(200).json(new ApiResponse(200, {}, "Space member role updated"));
});
```

### Service (`space.service.ts`)
```typescript
export const updateSpaceMemberRole = async (
  orgId: string,
  spaceId: string,
  actorUserId: string,
  targetUserId: string,
  role: "admin" | "manager" | "member",
): Promise<void> => {
  const actorSpaceRole = await spaceRepository.getMemberRole(spaceId, actorUserId);
  const targetSpaceRole = await spaceRepository.getMemberRole(spaceId, targetUserId);

  if (!targetSpaceRole) throw new ApiError(404, "Member not found in this space");

  // Space admin cannot change another admin's role
  if (targetSpaceRole === "admin" && actorSpaceRole !== "admin") {
    throw new ApiError(403, "Cannot change the role of a space admin");
  }
  // Prevent self-demotion
  if (actorUserId === targetUserId) {
    throw new ApiError(400, "Cannot change your own role");
  }

  await spaceRepository.updateMemberRole(spaceId, targetUserId, role);
};
```

### Repository additions (`space.repository.ts`)
```typescript
async getMemberRole(spaceId: string, userId: string): Promise<string | null>
async updateMemberRole(spaceId: string, userId: string, role: string): Promise<void>
```

---

## Phase 6 — Frontend: Type Updates

### `frontend/src/hooks/api/useOrganisations.ts`
- `Organisation.role`: change to `"owner" | "admin" | "member"` — keep as-is, `member` is still a valid org membership state
- `OrgMember.role`: change to `"owner" | "admin" | "member"` — keep as-is

### `frontend/src/hooks/api/useSpaces.ts`
- `Space.role`: change from `"owner" | "admin" | "member"` to `"admin" | "manager" | "member"` — `owner` removed
- `SpaceMember.role`: change to `"admin" | "manager" | "member"` — `owner` removed
- Add mutation hook `useUpdateSpaceMemberRole(orgId, spaceId)`

### `frontend/src/contexts/AppContext.tsx`
- No structural changes needed — `activeSpace.role` will reflect the updated type automatically

---

## Phase 7 — Frontend: Role-Aware UI

### 7a. Utility hook — `useSpaceRole`

**File:** `frontend/src/hooks/useSpaceRole.ts` (new)

```typescript
import { useAppContext } from "@/contexts/AppContext";

export type SpaceRole = "admin" | "manager" | "member";
export type OrgRole = "owner" | "admin" | "member";

const SPACE_RANK: Record<SpaceRole, number> = { admin: 3, manager: 2, member: 1 };

export function useSpaceRole() {
  const { activeSpace, activeOrg } = useAppContext();
  const spaceRole = (activeSpace?.role ?? "member") as SpaceRole;
  const orgRole = (activeOrg?.role ?? "member") as OrgRole;

  const spaceRank = SPACE_RANK[spaceRole] ?? 1;

  return {
    spaceRole,
    orgRole,
    // Task permissions
    canCreateTask:           spaceRank >= SPACE_RANK.manager,
    canEditTask:             spaceRank >= SPACE_RANK.manager,
    canDeleteTask:           spaceRank >= SPACE_RANK.manager,
    canAssignTask:           spaceRank >= SPACE_RANK.manager,
    canChangeAnyStatus:      spaceRank >= SPACE_RANK.manager,
    canChangeAssignedStatus: spaceRank >= SPACE_RANK.member,
    // Comment permissions
    canComment:              spaceRank >= SPACE_RANK.member,
    canDeleteOwnComment:     spaceRank >= SPACE_RANK.member,
    canDeleteAnyComment:     spaceRank >= SPACE_RANK.admin,
    // Motion page permissions
    canCreatePage:           spaceRank >= SPACE_RANK.manager,
    canEditAnyPage:          spaceRank >= SPACE_RANK.admin,
    // Org/space management (org-level check)
    canManageSpace:          orgRole === "owner" || orgRole === "admin",
    canInviteToOrg:          orgRole === "owner" || orgRole === "admin",
    canManageOrgMembers:     orgRole === "owner" || orgRole === "admin",
    canManageSpaceMembers:   spaceRank >= SPACE_RANK.admin,
  };
}
```

### 7b. Task UI changes

**`frontend/src/components/tasks/TaskListPane.tsx`**
- Hide "Create Task" button when `!canCreateTask`

**`frontend/src/components/tasks/TaskDetailPane.tsx` / `TaskDetailHeader.tsx`**
- Hide edit fields (title, description, priority, dates) when `!canEditTask`
- Hide delete button when `!canDeleteTask`
- Hide assignee add/remove controls when `!canAssignTask`
- Status dropdown: visible to all roles; for `member`, only render as interactive if they are in `task.assignees`
- Hide dependency add/remove when `!canEditTask`

**`frontend/src/components/tasks/OverviewTab.tsx`**
- Hide comment input when `!canComment`
- Comment delete button: show for own comments always; show for others' comments only when `canDeleteAnyComment`

### 7c. Motion Pages UI changes

**`frontend/src/components/motion/MotionSidebar.tsx`**
- Hide "New Page" button when `!canCreatePage`

**`frontend/src/components/motion/MotionPage.tsx`**
- Editor read-only logic:
  - `member`: always read-only
  - `manager`: read-only if `page.created_by !== currentUserId`
  - `admin`: always editable
- Hide share/edit controls when editor is read-only

### 7d. Space management UI (`SpacesTab.tsx`)

- `isAdmin` check (org-level) already gates space create/delete/restore — keep this
- In `SpaceDetailPanel`, add role selector per member row:
  - Visible only when `canManageSpaceMembers` (space `admin`)
  - Options: `admin`, `manager`, `member`
  - Disabled for self and for other `admin`s (space admin cannot demote another admin)
  - Uses `useUpdateSpaceMemberRole` mutation
  - On error: `toast.error(err?.response?.data?.message ?? "Failed to update role")`

### 7e. Org member management UI

Create `frontend/src/components/settings/MembersTab.tsx`:
- List all org members with their org role badge
- Org `owner`/`admin` see role change controls:
  - `owner` can promote `member` → `admin` or demote `admin` → `member`
  - `admin` can only demote `member` → `member` (no promote to admin)
- Org `owner`/`admin` see remove button (cannot remove self or owner)
- Org `owner`/`admin` see "Generate Invite Link" button → copies to clipboard
- Uses `useOrgMembers`, `useUpdateOrgMemberRole`, `useRemoveOrgMember`, `useCreateOrgInvite`

### 7f. Error handling — consistent 403 pattern

Apply to all mutations across `useTasks.ts`, `useSpaces.ts`, `useOrganisations.ts`, `useMotionPages.ts`, `useComments.ts`:

```typescript
onError: (err: any) => {
  const status = err?.response?.status;
  const message = err?.response?.data?.message;
  if (status === 403) {
    toast.error(message ?? "You don't have permission to do this");
  } else if (status === 404) {
    toast.error(message ?? "Resource not found");
  } else {
    toast.error(message ?? "Something went wrong");
  }
}
```

---

## Phase 8 — Logging

### Backend (`rbac.middleware.ts`)
```typescript
// On denial:
console.warn(`[rbac] DENIED userId=${userId} required=[${allowedRoles}] actual=${actualRole} path=${req.method} ${req.originalUrl}`);

// On sensitive operations in service layer (role changes, member removal):
console.info(`[rbac] role_change actor=${actorUserId} target=${targetUserId} from=${currentRole} to=${newRole} scope=${orgId|spaceId}`);
console.info(`[rbac] member_removed actor=${actorUserId} target=${targetUserId} scope=${orgId|spaceId}`);
```

### Frontend
```typescript
// In api.ts interceptor or per-mutation onError:
if (import.meta.env.DEV && status === 403) {
  console.warn("[rbac] 403 Forbidden:", { url: err.config?.url, message });
}
```

---

## Implementation Order

```
Phase 1  → DB migration (manager enum + space owner→admin migration + is_default)
Phase 2  → rbac.middleware.ts (requireOrgRole + requireSpaceRole factories)
Phase 3  → Route + service enforcement (org, spaces, tasks, motion pages, comments)
Phase 4  → Invite flow restriction
Phase 5  → Space member role management endpoint
Phase 6  → Frontend type updates (remove owner from space roles)
Phase 7  → Frontend role-aware UI
Phase 8  → Logging (alongside phases 2–7)
```

Phases 1–5 are backend-only and independently deployable before any frontend changes. The backend enforces all permissions regardless of frontend state.

---

## Files to Create

| File | Purpose |
|------|---------|
| `backend/src/migrations/014_rbac_roles.sql` | Add `manager`, migrate space `owner`→`admin`, add `is_default` |
| `backend/src/middlewares/rbac.middleware.ts` | `requireOrgRole` and `requireSpaceRole` middleware factories |
| `frontend/src/hooks/useSpaceRole.ts` | Centralized permission hook for UI |
| `frontend/src/components/settings/MembersTab.tsx` | Org member management UI |

## Files to Modify

| File | Changes |
|------|---------|
| `backend/src/routes/org.routes.ts` | Add `requireOrgRole` guards, add space member role update route |
| `backend/src/routes/org-task.routes.ts` | Add `requireSpaceRole` per endpoint |
| `backend/src/routes/motion-page.routes.ts` | Add `requireSpaceRole` per endpoint |
| `backend/src/services/organisation.service.ts` | Restrict invite to admin+, remove `requireOrgAdmin` helper, update role change rules |
| `backend/src/services/space.service.ts` | Remove `assertOwnerOrAdmin`, add `updateSpaceMemberRole`, update `createWithOwner` to insert `admin` |
| `backend/src/services/org-task.service.ts` | Member status-change restriction |
| `backend/src/services/motion-page.service.ts` | Manager own-page restriction |
| `backend/src/services/comment.service.ts` | Own-comment delete restriction for manager/member |
| `backend/src/controllers/space.controller.ts` | Add `updateSpaceMemberRole` controller |
| `backend/src/repositories/space.repository.ts` | Add `getMemberRole`, `updateMemberRole`; update `createWithOwner` to insert `admin` |
| `frontend/src/hooks/api/useSpaces.ts` | Remove `owner` from space role types, add `useUpdateSpaceMemberRole` |
| `frontend/src/hooks/api/useOrganisations.ts` | Restrict `updateOrgMemberRole` to `admin`/`member` values only |
| `frontend/src/components/settings/SpacesTab.tsx` | Add space member role selector |
| `frontend/src/components/tasks/TaskListPane.tsx` | Hide create button by role |
| `frontend/src/components/tasks/TaskDetailPane.tsx` | Role-gated edit/delete/assign UI |
| `frontend/src/components/tasks/TaskDetailHeader.tsx` | Role-gated edit fields |
| `frontend/src/components/tasks/OverviewTab.tsx` | Role-gated comment input + delete |
| `frontend/src/components/motion/MotionSidebar.tsx` | Hide new page button by role |
| `frontend/src/components/motion/MotionPage.tsx` | Read-only editor by role |
| `frontend/src/hooks/api/useTasks.ts` | Consistent 403 error handling |
| `frontend/src/hooks/api/useMotionPages.ts` | Consistent 403 error handling |
| `frontend/src/hooks/api/useComments.ts` | Consistent 403 error handling |

---

## Constraints & Notes for Agents

- `owner` role in `organisation_members` is set only at org creation and is never assignable via API. Do not add any endpoint that can set `owner`.
- `owner` role in `space_members` is abolished. Phase 1 migration converts all existing `owner` rows to `admin`. The `createWithOwner` method in `space.repository.ts` must be updated to insert `admin` not `owner`. The method name can stay the same.
- The `space_members_org_user_fk` FK already cascades: removing a user from `organisation_members` auto-removes them from all `space_members`. Do not duplicate this logic in service code.
- `findDefaultSpace` must use `WHERE is_default = TRUE` after Phase 1 runs. Do not leave it using `ORDER BY created_at ASC LIMIT 1`.
- `requireSpaceRole` must be placed AFTER `requireSpaceMember` in the middleware chain — it reads `req.space.membership_role` which is set by `requireSpaceMember`.
- `requireOrgRole` must be placed AFTER `requireOrgMember` in the middleware chain — it reads `req.org.membership_role` which is set by `requireOrgMember`.
- All middleware must call `next(error)` on failure, not `throw` — follow the pattern in `org-context.middleware.ts`.
- Frontend role checks are UI-only conveniences. The backend is the source of truth for all permissions.
- Do not add Supabase RLS policies for these tables. All access control goes through the Express API layer.
- The `compatibility_workspace_id` field on spaces is legacy. Do not touch it.
- The `member` value in `member_role` enum is kept for `organisation_members` (users who are in the org but not owner/admin). It is NOT a valid space role — space membership starts at `member` but the enum value is shared. Agents must not assign `owner` to space members.
