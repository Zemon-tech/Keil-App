# RBAC Backend Implementation Guide

## Relevant Files

Here is the file structure representing the backend components modified or created for RBAC:

```
backend/src/
├── migrations/
│   └── 014_rbac_roles.sql           # Database enum changes, space migration, and unique index
├── types/
│   └── enums.ts                     # Runtime TS definitions for OrgRole and SpaceRole
├── middlewares/
│   └── rbac.middleware.ts           # Centralised express role gates
└── routes/
    ├── org.routes.ts                # Space creation, deletion, and member mapping routes
    ├── org-task.routes.ts           # Task & comment gating routes
    └── motion-page.routes.ts        # Motion page documents and sharing gates
```

---

## Database Models & Schema Notes

### Role Types
At the database level, roles are stored inside the `public.member_role` enum type:
* **Organisation Membership Roles**:
  - `owner` (Tenant creator, maximum privileges)
  - `admin` (Tenant administrator)
  - `member` (Standard workspace participant)
* **Space Membership Roles**:
  - `admin` (Space administrator; upgraded from legacy space owners)
  - `manager` (Space coordinator; handles tasks and page operations)
  - `member` (Standard space participant; read-only for tasks/pages, read-write for comments)

### Space Default Configuration Table Updates
The `public.spaces` table includes the `is_default` attribute to mark the landing space for new users:

| Column | Type | Default | Nullable | Description |
| :--- | :--- | :--- | :--- | :--- |
| `is_default` | `BOOLEAN` | `FALSE` | `NOT NULL` | Designates if the space is the tenant's primary landing space |

A partial unique database index enforces that **no more than one** default space exists per organisation:
```sql
CREATE UNIQUE INDEX idx_spaces_one_default_per_org
  ON public.spaces(org_id)
  WHERE is_default = TRUE AND deleted_at IS NULL;
```

---

## Centralised Middleware Mechanics

The middleware functions `requireOrgRole` and `requireSpaceRole` act as gatekeepers for API requests. They perform O(1) checks against the authenticated user metadata attached by preceding boundary middlewares (`requireOrgMember` / `requireSpaceMember`).

```typescript
import { NextFunction, Request, Response } from "express";
import { OrgRole, SpaceRole } from "../types/enums";

// Organization level gate
export const requireOrgRole = (...allowedRoles: OrgRole[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const actualRole = (req as any).org?.membership_role as OrgRole | undefined;

      if (!actualRole || !allowedRoles.includes(actualRole)) {
        res.status(403).json({ success: false, message: "Insufficient permissions" });
        return;
      }
      next();
    } catch (error) {
      next(error);
    }
  };
};

// Space level gate
export const requireSpaceRole = (...allowedRoles: SpaceRole[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const actualRole = (req as any).space?.membership_role as SpaceRole | undefined;

      if (!actualRole || !allowedRoles.includes(actualRole)) {
        res.status(403).json({ success: false, message: "Insufficient permissions" });
        return;
      }
      next();
    } catch (error) {
      next(error);
    }
  };
};
```

---

## Route Protection Registry

The following tables show which backend endpoints are secured by the RBAC middleware layer:

### 1. Organisation and Space Management (`org.routes.ts`)
*Pre-authorized by `requireOrgMember` middleware.*

| Endpoint | Method | Required Org Role | Purpose |
| :--- | :--- | :--- | :--- |
| `/api/organisations/:orgId` | `PATCH` | `owner`, `admin` | Rename organisation |
| `/api/organisations/:orgId` | `DELETE` | `owner` | Terminate organisation |
| `/api/organisations/:orgId/invite` | `POST` | `owner`, `admin` | Invite user to organisation |
| `/api/organisations/:orgId/members/:userId` | `PATCH` | `owner`, `admin` | Update organisation member's role |
| `/api/organisations/:orgId/spaces` | `POST` | `owner`, `admin` | Create a space inside organisation |
| `/api/organisations/:orgId/spaces/:spaceId` | `PATCH` | `owner`, `admin` | Rename a space |
| `/api/organisations/:orgId/spaces/:spaceId` | `DELETE` | `owner`, `admin` | Soft delete / archive a space |
| `/api/organisations/:orgId/spaces/:spaceId/members` | `POST` | `owner`, `admin` | Add organization member to space |
| `/api/organisations/:orgId/spaces/:spaceId/members/:userId` | `DELETE` | `owner`, `admin` | Remove member from space |

---

### 2. Task Management (`org-task.routes.ts`)
*Pre-authorized by `requireSpaceMember` middleware.*

| Endpoint | Method | Required Space Role | Action |
| :--- | :--- | :--- | :--- |
| `/api/spaces/:spaceId/tasks` | `POST` | `admin`, `manager` | Create new task |
| `/api/spaces/:spaceId/tasks` | `GET` | `admin`, `manager`, `member` | List tasks inside space |
| `/api/spaces/:spaceId/tasks/:id` | `GET` | `admin`, `manager`, `member` | Retrieve single task |
| `/api/spaces/:spaceId/tasks/:id` | `PATCH` | `admin`, `manager` | Update task details (title, priority, etc.) |
| `/api/spaces/:spaceId/tasks/:id` | `DELETE` | `admin`, `manager` | Delete a task |
| `/api/spaces/:spaceId/tasks/:id/status` | `PATCH` | `admin`, `manager`, `member` | Change task status (*members are gated by assignee logic in controller*) |
| `/api/spaces/:spaceId/tasks/:id/assignees` | `POST` | `admin`, `manager` | Assign user to task |
| `/api/spaces/:spaceId/tasks/:id/assignees/:userId` | `DELETE` | `admin`, `manager` | Unassign user from task |
| `/api/spaces/:spaceId/tasks/:id/comments` | `POST` | `admin`, `manager`, `member` | Post comment on task |
| `/api/spaces/:spaceId/tasks/:id/comments/:commentId` | `DELETE` | `admin`, `manager`, `member` | Delete comment (*members can only delete their own comments*) |

---

### 3. Motion Document Management (`motion-page.routes.ts`)
*Pre-authorized by `requireSpaceMember` middleware.*

| Endpoint | Method | Required Space Role | Action |
| :--- | :--- | :--- | :--- |
| `/api/spaces/:spaceId/motion-pages` | `GET` | `admin`, `manager`, `member` | List pages in space |
| `/api/spaces/:spaceId/motion-pages` | `POST` | `admin`, `manager` | Create a new page |
| `/api/spaces/:spaceId/motion-pages/:id` | `GET` | `admin`, `manager`, `member` | Fetch single page contents |
| `/api/spaces/:spaceId/motion-pages/:id` | `PATCH` | `admin`, `manager` | Save edits / revision history |
| `/api/spaces/:spaceId/motion-pages/:id` | `DELETE` | `admin`, `manager` | Soft delete page to trash |
| `/api/spaces/:spaceId/motion-pages/:id/restore` | `POST` | `admin`, `manager` | Restore page from trash |
| `/api/spaces/:spaceId/motion-pages/:id/permanent` | `DELETE` | `admin`, `manager` | Purge page forever |
| `/api/spaces/:spaceId/motion-pages/:id/shares` | `POST` | `admin`, `manager` | Share page to space or web link |
