# Backend Implementation Guide

## File Structure

```text
backend/src/
├── migrations/
│   ├── 005_platform_organisation_space_schema.sql  # organisations, spaces, personal_tasks
│   └── ...                                         # earlier migrations kept for history
├── middlewares/
│   ├── auth.middleware.ts           # protect (identity), attachWorkspaceContext (compat shim)
│   └── org-context.middleware.ts    # requireOrgMember, requireSpaceMember
├── routes/
│   ├── org.routes.ts                # All /orgs/* routes
│   ├── org-task.routes.ts           # /orgs/:orgId/spaces/:spaceId/tasks
│   ├── org-chat.routes.ts           # /orgs/:orgId/spaces/:spaceId/chat/channels
│   ├── org-activity.routes.ts       # /orgs/:orgId/spaces/:spaceId/dashboard + activity
│   ├── personal-task.routes.ts      # /personal/tasks
│   ├── workspace.routes.ts          # Legacy compatibility routes (kept, not removed)
│   └── v1.routes.ts                 # Main router
├── controllers/
│   ├── organisation.controller.ts   # getOrganisations, createOrganisation,
│   │                                #   createOrgInvite, joinOrg, getOrgMembers
│   ├── space.controller.ts          # getSpaces, getSpaceMembers, createSpace,
│   │                                #   renameSpace, deleteSpace, restoreSpace,
│   │                                #   hardDeleteSpace, getDeletedSpaces,
│   │                                #   addSpaceMember, removeSpaceMember
│   ├── org-task.controller.ts
│   ├── org-chat.controller.ts
│   ├── org-activity.controller.ts
│   └── personal-task.controller.ts
├── services/
│   ├── organisation.service.ts      # createOrganisation, generateInviteToken,
│   │                                #   joinOrganisation, getOrgMembers
│   ├── space.service.ts             # getVisibleSpaces, getSpaceMembers, createSpace,
│   │                                #   renameSpace, deleteSpace, restoreSpace,
│   │                                #   hardDeleteSpace, getDeletedSpaces,
│   │                                #   addSpaceMember, removeSpaceMember
│   └── personal-task.service.ts
└── repositories/
    ├── organisation.repository.ts   # createWithOwner, findMembers, getMemberRole, addMember
    └── space.repository.ts          # createWithOwner, findDefaultSpace, addMember,
                                     #   rename, softDeleteSpace, restore, hardDelete,
                                     #   findDeletedByOrg, countActiveByOrg, removeMember
```

## API Routes

### Organisation & Space Management

| Method | Route | Auth | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/orgs` | `protect` | List user's organisations |
| `POST` | `/api/v1/orgs` | `protect` | Create org + default General space (atomic) |
| `POST` | `/api/v1/orgs/join` | `protect` | Join org via invite token |
| `GET` | `/api/v1/orgs/:orgId/members` | `protect` + `requireOrgMember` | List org members |
| `POST` | `/api/v1/orgs/:orgId/invite` | `protect` + `requireOrgMember` | Generate invite link |
| `GET` | `/api/v1/orgs/:orgId/spaces` | `protect` + `requireOrgMember` | List visible (non-deleted) spaces |
| `POST` | `/api/v1/orgs/:orgId/spaces` | `protect` + `requireOrgMember` | Create space (owner/admin only) |
| `GET` | `/api/v1/orgs/:orgId/spaces/deleted` | `protect` + `requireOrgMember` | List soft-deleted spaces (owner/admin only) |
| `PATCH` | `/api/v1/orgs/:orgId/spaces/:spaceId` | `protect` + both middlewares | Rename space (owner/admin only) |
| `DELETE` | `/api/v1/orgs/:orgId/spaces/:spaceId` | `protect` + both middlewares | Soft-delete space. Blocked if last space. |
| `POST` | `/api/v1/orgs/:orgId/spaces/:spaceId/restore` | `protect` + `requireOrgMember` | Restore soft-deleted space |
| `DELETE` | `/api/v1/orgs/:orgId/spaces/:spaceId/permanent` | `protect` + `requireOrgMember` | Permanently delete space (must be soft-deleted first) |
| `GET` | `/api/v1/orgs/:orgId/spaces/:spaceId/members` | `protect` + both middlewares | List space members |
| `POST` | `/api/v1/orgs/:orgId/spaces/:spaceId/members` | `protect` + both middlewares | Add org member to space |
| `DELETE` | `/api/v1/orgs/:orgId/spaces/:spaceId/members/:userId` | `protect` + both middlewares | Remove member from space |

> **Route ordering note:** `GET /spaces/deleted` is registered before `GET /spaces/:spaceId/members` in `org.routes.ts` to prevent Express treating the literal string `"deleted"` as a `spaceId` parameter. `restore` and `permanent` routes use only `requireOrgMember` (not `requireSpaceMember`) because `requireSpaceMember` filters `deleted_at IS NULL` and would block operations on soft-deleted spaces.

### Space-Scoped Data

| Method | Route | Description |
| :--- | :--- | :--- |
| `GET/POST/PATCH/DELETE` | `/api/v1/orgs/:orgId/spaces/:spaceId/tasks` | Org task CRUD |
| `GET/POST` | `/api/v1/orgs/:orgId/spaces/:spaceId/chat/channels` | Chat channels |
| `GET` | `/api/v1/orgs/:orgId/spaces/:spaceId/dashboard` | Space dashboard |
| `GET` | `/api/v1/orgs/:orgId/spaces/:spaceId/activity` | Space activity feed |

### Personal Data

| Method | Route | Description |
| :--- | :--- | :--- |
| `GET/POST/PATCH/DELETE` | `/api/v1/personal/tasks` | Personal task CRUD |
| `PATCH` | `/api/v1/personal/tasks/:id/status` | Update personal task status |

## Database Schema

| Table | Key Columns | Notes |
| :--- | :--- | :--- |
| `users` | `id`, `email`, `name` | Created by DB trigger on `auth.users` insert |
| `organisations` | `id`, `name`, `owner_user_id` | No auto-creation on signup |
| `organisation_members` | `org_id`, `user_id`, `role` | Unique on `(org_id, user_id)` |
| `spaces` | `id`, `org_id`, `name`, `visibility`, `deleted_at` | Always `private`. `workspace_id` is nullable (NULL for new org-model spaces). `compatibility_workspace_id` bridges legacy routes. |
| `space_members` | `org_id`, `space_id`, `user_id`, `role` | FK to `organisation_members` — must be org member first |
| `personal_tasks` | `id`, `owner_user_id` | No `org_id` or `space_id` columns |
| `tasks` (org tasks) | `id`, `org_id`, `space_id`, `workspace_id` | `org_id` and `space_id` required |

## Middlewares

### `protect`
Validates the Supabase JWT from the `Authorization` header and attaches `req.user`. Does **not** infer any organisation context.

### `requireOrgMember`
Used on all `/:orgId` routes. Queries `organisation_members` for `(orgId, userId)`. Returns `403` if not a member. Attaches `req.org` (includes `membership_role`).

### `requireSpaceMember`
Used on all `/:orgId/spaces/:spaceId` routes. Validates the space belongs to the org and the user is in `space_members`. Returns `403` if not a member. Attaches `req.space` (includes `compatibility_workspace_id` for legacy route bridging).

### `attachWorkspaceContext` (Legacy Compat Shim)
Used only on legacy `/workspaces` routes. Infers `req.workspaceId` from the user's first workspace membership. Not used by any new code.

## Space Delete Behaviour

Space deletion is a two-step process enforced at the service layer:

**Soft-delete** (`DELETE /spaces/:spaceId`):
- Sets `deleted_at` on the space row.
- Cascades `deleted_at` to all `tasks` in the space.
- `channels` and `activity_logs` do not have `deleted_at` — they are excluded from the cascade and become inaccessible but are not removed.
- `space_members` rows are **preserved** so the space can be restored.
- Blocked with `400` if this is the last active space in the org.

**Restore** (`POST /spaces/:spaceId/restore`):
- Clears `deleted_at` on the space row only.
- Tasks that were cascade-deleted remain soft-deleted and must be restored separately.

**Permanent delete** (`DELETE /spaces/:spaceId/permanent`):
- Space must already be soft-deleted (returns `400` otherwise).
- Runs in a single transaction: deletes `task_dependencies`, `task_assignees`, `comments`, `tasks`, `channels` (cascades to `channel_members` and `messages`), `activity_logs`, `space_members`, then the space row itself.

## Org Creation — Atomic Transaction

`POST /api/v1/orgs` runs the following in a single DB transaction:

```sql
INSERT INTO organisations (name, owner_user_id) ...
INSERT INTO organisation_members (org_id, user_id, role='owner') ...
INSERT INTO spaces (org_id, name='General', visibility='private', created_by) ...
INSERT INTO space_members (org_id, space_id, user_id, role='owner') ...
```

Returns `{ org: OrganisationDTO, space: SpaceDTO }`.

## Invite Token

`POST /api/v1/orgs/:orgId/invite` signs a JWT:
```json
{ "orgId": "<uuid>", "type": "org_invite" }
```
Expiry: 7 days. Signed with `JWT_SECRET`.

`POST /api/v1/orgs/join` (top-level, no `:orgId` in URL — orgId comes from the token):
1. Verifies and decodes the JWT.
2. Finds the org's default space (`ORDER BY created_at ASC LIMIT 1`).
3. Inserts into `organisation_members` and `space_members` with `ON CONFLICT DO NOTHING` (idempotent).
4. Returns `{ orgId, spaceId }`.
