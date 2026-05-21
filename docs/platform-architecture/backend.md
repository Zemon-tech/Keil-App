# Backend Implementation Guide

## File Structure

```text
backend/src/
├── migrations/
│   ├── 015_personal_organisation.sql       # adds is_personal, is_private, user triggers
│   └── ...                                 # earlier migrations kept for history
├── middlewares/
│   ├── auth.middleware.ts                  # protect (identity), attachWorkspaceContext (compat shim)
│   ├── org-context.middleware.ts           # requireOrgMember, requireSpaceMember
│   └── rbac.middleware.ts                  # requireOrgRole, requireSpaceRole
├── routes/
│   ├── org.routes.ts                       # All /orgs/* routes
│   ├── org-task.routes.ts                  # /orgs/:orgId/spaces/:spaceId/tasks
│   ├── org-chat.routes.ts                  # /orgs/:orgId/spaces/:spaceId/chat/channels
│   ├── org-activity.routes.ts              # /orgs/:orgId/spaces/:spaceId/dashboard + activity
│   ├── my-tasks.routes.ts                  # /my-tasks (cross-org aggregate)
│   ├── personal-task.routes.ts             # /personal/tasks (DEPRECATED - legacy compatibility)
│   ├── workspace.routes.ts                 # Legacy compatibility routes (kept, not removed)
│   └── v1.routes.ts                        # Main router
├── controllers/
│   ├── organisation.controller.ts          # getOrganisations, createOrganisation
│   ├── space.controller.ts                 # getSpaces, space member management
│   ├── my-tasks.controller.ts              # getMyTasks cross-org aggregate handler
│   ├── org-task.controller.ts
│   ├── org-chat.controller.ts
│   ├── org-activity.controller.ts
│   └── personal-task.controller.ts         # DEPRECATED
├── services/
│   ├── organisation.service.ts             # handles deletion blocks on personal orgs
│   ├── space.service.ts                    # handles deletion/membership blocks on private spaces
│   ├── my-tasks.service.ts                 # cross-org assigned tasks query aggregator
│   └── personal-task.service.ts            # DEPRECATED
└── repositories/
    ├── organisation.repository.ts          # createWithOwner, findByUserId (sorted)
    └── space.repository.ts                 # createWithOwner, findOldestNonPrivateSpace
```

## API Routes

### Organisation & Space Management

| Method | Route | Auth | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/orgs` | `protect` | List user's organisations (personal first) |
| `POST` | `/api/v1/orgs` | `protect` | Create org + default General space (atomic) |
| `POST` | `/api/v1/orgs/join` | `protect` | Join org via invite token (safety fallback if default private) |
| `GET` | `/api/v1/orgs/:orgId/members` | `protect` + `requireOrgMember` | List org members |
| `POST` | `/api/v1/orgs/:orgId/invite` | `protect` + `requireOrgMember` | Generate invite link |
| `GET` | `/api/v1/orgs/:orgId/spaces` | `protect` + `requireOrgMember` | List visible (non-deleted) spaces |
| `POST` | `/api/v1/orgs/:orgId/spaces` | `protect` + `requireOrgMember` | Create space (owner/admin only) |
| `GET` | `/api/v1/orgs/:orgId/spaces/deleted` | `protect` + `requireOrgMember` | List soft-deleted spaces (owner/admin only) |
| `PATCH` | `/api/v1/orgs/:orgId/spaces/:spaceId` | `protect` + both middlewares | Rename space. Blocked if private. |
| `DELETE` | `/api/v1/orgs/:orgId/spaces/:spaceId` | `protect` + both middlewares | Soft-delete space. Blocked if last space or private. |
| `POST` | `/api/v1/orgs/:orgId/spaces/:spaceId/restore` | `protect` + `requireOrgMember` | Restore soft-deleted space |
| `DELETE` | `/api/v1/orgs/:orgId/spaces/:spaceId/permanent` | `protect` + `requireOrgMember` | Permanently delete space (blocked if private) |
| `GET` | `/api/v1/orgs/:orgId/spaces/:spaceId/members` | `protect` + both middlewares | List space members (blocked if private) |
| `POST` | `/api/v1/orgs/:orgId/spaces/:spaceId/members` | `protect` + both middlewares | Add org member to space (blocked if private) |
| `DELETE` | `/api/v1/orgs/:orgId/spaces/:spaceId/members/:userId` | `protect` + both middlewares | Remove member from space (blocked if private) |

### Space-Scoped Data

| Method | Route | Description |
| :--- | :--- | :--- |
| `GET/POST/PATCH/DELETE` | `/api/v1/orgs/:orgId/spaces/:spaceId/tasks` | Standard & personal task CRUD |
| `GET/POST` | `/api/v1/orgs/:orgId/spaces/:spaceId/chat/channels` | Chat channels (non-private spaces only) |
| `GET` | `/api/v1/orgs/:orgId/spaces/:spaceId/dashboard` | Org space dashboard |
| `GET` | `/api/v1/orgs/:orgId/spaces/:spaceId/activity` | Org space activity feed |

### Cross-Org Aggregate Data

| Method | Route | Auth | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/my-tasks` | `protect` | Fetch assigned active tasks across all organisations |

### Personal Data (Legacy Compatibility Layer)

| Method | Route | Description |
| :--- | :--- | :--- |
| `GET/POST/PATCH/DELETE` | `/api/v1/personal/tasks` | DEPRECATED legacy personal task CRUD |

## Database Schema

| Table | Key Columns | Notes |
| :--- | :--- | :--- |
| `users` | `id`, `email`, `name` | Triggers creation of personal org & Private space atomically |
| `organisations` | `id`, `name`, `is_personal` | `is_personal` marks the non-deletable personal org |
| `organisation_members` | `org_id`, `user_id`, `role` | Links users to org roles (`owner`, `admin`, `member`) |
| `spaces` | `id`, `org_id`, `is_private`, `deleted_at` | `is_private` marks the system-managed private space |
| `space_members` | `org_id`, `space_id`, `user_id`, `role` | FK to `organisation_members` |
| `tasks` | `id`, `org_id`, `space_id` | Unified table. Personal tasks live here scoped to Private space |

## Signup Triggers & Database Constraints

Atomic signup behavior is handled natively in PostgreSQL inside `015_personal_organisation.sql`. 
When a new user signs up:
1. An insert is triggered into `public.organisations` with `is_personal = TRUE`.
2. The user is added to `public.organisation_members` as `owner`.
3. A system-managed space is created in `public.spaces` named `'Private'` with `is_private = TRUE` and `is_default = TRUE`.
4. The user is added to `space_members` as `admin` for that space.

**Index Constraint**:
To prevent duplicate personal organisations, a partial unique index is enforced:
```sql
CREATE UNIQUE INDEX idx_organisations_one_personal_per_user 
ON public.organisations(owner_user_id) 
WHERE is_personal = TRUE AND deleted_at IS NULL;
```

## Middlewares

### `protect`
Validates the Supabase JWT from the `Authorization` header and attaches `req.user`.

### `requireOrgMember`
Validates that `(orgId, userId)` exists in `organisation_members`. Attaches `req.org` containing the user's role.

### `requireSpaceMember`
Validates that `(spaceId, userId)` exists in `space_members` and the space belongs to the target organisation. Attaches `req.space`.

## Service Guards

Service guards are placed strictly in the business-logic layers:
- **Organisation Deletion Block**: `deleteOrganisation` in `organisation.service.ts` throws `400` if `org.is_personal` is true.
- **Space Deletion Block**: `deleteSpace` and `hardDeleteSpace` in `space.service.ts` throw `400` if `space.is_private` is true.
- **Private Space Membership Block**: `addSpaceMember` in `space.service.ts` throws `400` if `space.is_private` is true.
- **Safe Invite Joins**: When a user joins an organisation via token, `joinOrganisation` queries the oldest *non-private* space as the target landing page if the default space is private.

