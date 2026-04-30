# Backend Implementation Guide

## File Structure

Relevant files in the backend application dealing with the new platform architecture:

```text
backend/src/
├── migrations/
│   └── 005_platform_organisation_space_schema.sql  # Schema defining the new boundaries
├── middlewares/
│   ├── auth.middleware.ts                 # Validates JWT, sets req.user
│   └── boundary.middleware.ts             # Provides requireOrgMember, requireSpaceMember
├── routes/
│   ├── personal-task.routes.ts            # Routes for platform personal tasks
│   ├── org-activity.routes.ts             # Routes for scoped dashboard/activity
│   ├── v1.routes.ts                       # Main router wiring the new paths
│   └── workspace.routes.ts                # Legacy compatibility routes
├── controllers/
│   ├── personal-task.controller.ts
│   ├── org-activity.controller.ts
│   └── ...
└── services/
    ├── personal-task.service.ts
    ├── org-activity.service.ts
    └── ...
```

## Models & Schema

The database relies on strict relational constraints to enforce boundaries.

| Table | Primary Key | Parent Boundary | Notes |
| :--- | :--- | :--- | :--- |
| `users` | `id` | None (Platform) | Global identity. |
| `personal_tasks` | `id` | `owner_user_id` | No `org_id` or `space_id` allowed. Fully private. |
| `organisations` | `id` | None (Platform) | The core tenant boundary. |
| `spaces` | `id` | `org_id` | Must belong to an organisation. |
| `organisation_members`| `id` | `org_id`, `user_id` | Links users to organisations with a role. |
| `space_members` | `id` | `space_id`, `user_id` | Links users to spaces. Validates `org_id` matches. |
| `tasks` (Org Tasks) | `id` | `org_id`, `space_id` | Must belong to a specific space. |

## Middlewares & Logic

The new architecture decouples identity authentication from boundary authorization.

### `protect` (Identity)
Extracts the Supabase JWT from the Authorization header, validates it, and attaches `req.user`. It intentionally **does not** query or attach organisation memberships.

### `requireOrgMember` (Organisation Authorization)
Used on routes starting with `/orgs/:orgId`. Validates that `req.user.id` exists in `organisation_members` for the requested `:orgId`. Attaches `req.orgContext`.

### `requireSpaceMember` (Space Authorization)
Used on routes extending into spaces: `/orgs/:orgId/spaces/:spaceId`. Validates that the space belongs to the organisation, and that the user exists in `space_members`. Attaches `req.spaceContext`.

## Routing Examples

API routes are structured hierarchically to mandate explicit context. The use of Express's `mergeParams: true` is essential for deeply nested routers to access `:orgId` and `:spaceId`.

**Personal Data (No Org/Space Context):**
```ts
// Routes: /api/v1/personal/tasks
router.use("/personal/tasks", protect, personalTaskRoutes);
```

**Organisation/Space Data (Strict Context Required):**
```ts
// Routes: /api/v1/orgs/:orgId/spaces/:spaceId/tasks
router.use(
  "/orgs/:orgId/spaces/:spaceId",
  protect,
  requireOrgMember,
  requireSpaceMember,
  spaceScopedRouter
);
```
