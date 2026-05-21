# RBAC Architecture & Design Decisions

## System Architecture

The Role-Based Access Control (RBAC) system in Keil operates as a highly secure, dual-boundary gating mechanism. When a request is sent from the client, it must pass through the Authentication layer and boundary validation before reaching the role-specific RBAC middleware gates.

### Request Authorization Flow

```
[ Client Request ]
       │
       ▼
┌────────────────────────────────────────────────────────┐
│ Authentication Middleware (Supabase JWT / protect)     │
│ - Decodes user identity & attaches `req.user.id`       │
└────────────────────────────────────────────────────────┘
       │
       ▼
┌────────────────────────────────────────────────────────┐
│ Boundary Middlewares (requireOrgMember / space)        │
│ - Validates user is in organization or space           │
│ - Fetches actual membership metadata                   │
│ - Attaches to request: `req.org` and `req.space`       │
└────────────────────────────────────────────────────────┘
       │
       ▼
┌────────────────────────────────────────────────────────┐
│ RBAC Middlewares (requireOrgRole / requireSpaceRole)   │
│ - O(1) role lookups matching allowed roles array       │
│ - Rejects unauthorised actions with 403 Forbidden      │
└────────────────────────────────────────────────────────┘
       │
       ▼
[ Controller Logic / Database Execution ]
```

---

## Security Model & Boundaries

### 1. Organisation-Level Authorization
* **Objective**: Protect tenant settings, billing, membership actions, and collaborative spaces creation.
* **Mechanism**: Handled by the `requireOrgRole` middleware. The prerequisite `requireOrgMember` middleware loads the organization membership database record and attaches it as `(req as any).org`.
* **Membership Role Data**:
  - `owner`: Absolute superuser for the organisation. Can delete the organization, rename it, invite users, update roles, and create/delete/restore any space.
  - `admin`: Full administrative control over members and spaces. Cannot delete the organisation or demote/remove the organisation `owner`.
  - `member`: Read-only access to organisation details. Cannot invite new members, alter organisation settings, or create/delete spaces.

### 2. Space-Level Authorization
* **Objective**: Guard resources contained strictly inside a functional workspace, including Tasks, Activity Comments, and Motion Documents.
* **Mechanism**: Handled by the `requireSpaceRole` middleware. The prerequisite `requireSpaceMember` middleware loads the space membership database record and attaches it as `(req as any).space`.
* **Membership Role Data**:
  - `admin`: Complete control over the space. Can rename the space, manage space members (add, remove, update roles), hard-delete the space, and delete any task comments.
  - `manager`: Operational leader. Can create, edit, assign, delete tasks, change task statuses, and create/update/soft-delete Motion Pages.
  - `member`: Collaboration participant. Can view tasks/pages, create and update own comments, and transition status on tasks assigned directly to them. Cannot edit/create pages or manage other space members.

---

## Key Design Decisions

### 1. Abolishment of Space-Level 'Owner'
* **Decision**: The legacy `owner` role was completely removed at the Space level and merged into the Space `admin` role.
* **Justification**: Maintaining an `owner` role per space added unnecessary schema complexity. Spaces are organizational assets, not individual tenant boundaries. An organisation `owner` or `admin` retains global authority, while individual spaces only require `admin`, `manager`, and `member` permissions to govern daily collaboration.

### 2. Strict Single Default Space Per Organisation
* **Decision**: A partial unique index was implemented in the database to ensure exactly one default space exists.
* **Schema Migration (`014_rbac_roles.sql`)**:
  ```sql
  ALTER TABLE public.spaces ADD COLUMN IF NOT EXISTS is_default BOOLEAN NOT NULL DEFAULT FALSE;

  -- Ensure only one default space per organization exists
  CREATE UNIQUE INDEX IF NOT EXISTS idx_spaces_one_default_per_org
    ON public.spaces(org_id)
    WHERE is_default = TRUE AND deleted_at IS NULL;
  ```
* **Justification**: When new users are invited to an organisation, they must be auto-assigned to a default landing workspace (usually the `#general` space). Enforcing this at the database engine level prevents application bugs from creating multiple default spaces or leaving an organisation without a landing space.

### 3. Client-Side Self-Demotion & Safety Guards
* **Decision**: Implement strict safety checks in the Space Settings members list to prevent lockouts and security bypasses.
* **Safety Logic**:
  * **Self-Demotion Block**: A user cannot update or delete their own space role (`!isSelf`). This guarantees that a space will never end up with zero admins.
  * **Peer demotion guard**: A Space Admin cannot change the role of, demote, or remove another Space Admin unless the active user also holds an Org-level `owner` or `admin` role:
    ```typescript
    const isSelf = member.user_id === currentUserId;
    const isTargetAdmin = member.role === "admin";
    const canEditRole = canManageSpaceMembers && !isSelf && (!isTargetAdmin || orgRole === "owner" || orgRole === "admin");
    ```
    This prevents standard Space Admins from maliciously demoting other Space Admins, deferring override authority strictly to Organization-level administrators.
