# Architecture & Design

## Conceptual Hierarchy

```text
Platform (Global Identity)
│
├── User
│   └── Personal Tasks          ← no org_id / space_id, fully private
│
└── Organisation (Tenancy Boundary)
    │
    ├── Space A (private by default)
    │   ├── Org Tasks
    │   ├── Chat Channels
    │   └── Activity Logs
    │
    └── Space B
        ├── Org Tasks
        └── Chat Channels
```

## User Lifecycle

```text
Sign up
  └── public.users row created (DB trigger on auth.users)
        └── No org, no space — lands in Personal Mode

Create Organisation  (POST /api/v1/orgs)
  └── organisations row
  └── spaces row ("General")          ← atomic transaction
  └── organisation_members (owner)
  └── space_members (owner)
  └── App switches to new org + General space

Create additional Space  (POST /api/v1/orgs/:orgId/spaces)
  └── spaces row
  └── space_members (owner = caller)
  └── Owner/admin only

Invite another user  (POST /api/v1/orgs/:orgId/invite)
  └── Signed JWT { orgId, type: "org_invite" }, 7-day expiry

Join via token  (POST /api/v1/orgs/join)
  └── organisation_members (member)
  └── space_members for default space (member)
  └── App switches to joined org + default space

Delete Space  (DELETE /api/v1/orgs/:orgId/spaces/:spaceId)
  └── Soft-delete: sets deleted_at on space + cascades to tasks
  └── Last space in org is blocked (400)
  └── If active space deleted → app auto-switches to first remaining space

Restore Space  (POST /api/v1/orgs/:orgId/spaces/:spaceId/restore)
  └── Clears deleted_at on space row only
  └── Tasks remain soft-deleted (restore separately)

Permanent Delete  (DELETE /api/v1/orgs/:orgId/spaces/:spaceId/permanent)
  └── Space must already be soft-deleted
  └── Removes all tasks, channels, activity_logs, space_members in a transaction
```

## Key Design Decisions

### 1. Explicit Context — No Implicit Workspace Inference
All APIs managing org or space-owned data receive explicit `orgId` and `spaceId` in the URL. The legacy `attachWorkspaceContext` middleware (which inferred `req.workspaceId` from the user's first workspace) is kept only as a compatibility shim for the legacy `/workspaces` routes. No new code uses it.

### 2. Personal vs. Organisational Data Separation
`personal_tasks` has no `org_id` or `space_id` columns. Org tasks live in `tasks` with both columns required. This structural separation means org admins have zero schema-level access to personal tasks, and personal tasks survive org membership changes.

### 3. Spaces as the Primary Collaboration Boundary
All collaborative data (tasks, chat, dashboard, activity) belongs to a space, not just an org. This prevents "global noise" and tightly scopes assignments and chat to explicit space members. Spaces are private by default — there is no public visibility option.

### 4. Atomic Org + Space Creation
`POST /api/v1/orgs` runs in a single DB transaction: creates the org, creates a "General" space, and adds the caller as `owner` in both `organisation_members` and `space_members`. There is no state where an org exists without at least one space.

### 5. Token-Based Invite (Org-Scoped)
Invite tokens are JWTs signed with `JWT_SECRET`, containing `{ orgId, type: "org_invite" }` with a 7-day expiry. The token is tied to the org only — joining always adds the user to the org's default (oldest) space. Admins can then add them to additional spaces manually.

### 7. Space Soft-Delete and Cascade Rules
Deleting a space is a two-step process. Soft-delete (`DELETE /spaces/:spaceId`) sets `deleted_at` on the space and cascades to `tasks` (which also have `deleted_at`). `channels` and `activity_logs` do not have `deleted_at` — they are excluded from the soft-delete cascade and are only removed on permanent deletion. `space_members` rows are preserved during soft-delete so the space can be restored. Permanent deletion (`DELETE /spaces/:spaceId/permanent`) runs in a single transaction and removes all child data. The last active space in an org is blocked from deletion at the service layer.
The frontend uses a single canonical `TaskStatus` (`"in-progress"`, hyphen). The personal task backend stores `in_progress` (underscore). `usePersonalTasks.ts` handles the conversion at the HTTP boundary so no UI component ever sees the inconsistency.

## Security Model

| Layer | Mechanism | What it enforces |
| :--- | :--- | :--- |
| Identity | `protect` middleware | Validates Supabase JWT, attaches `req.user`. No org context. |
| Org boundary | `requireOrgMember` | Checks `organisation_members` for `(orgId, userId)`. Attaches `req.org`. |
| Space boundary | `requireSpaceMember` | Checks `space_members` for `(spaceId, userId)` and that space belongs to org. Attaches `req.space`. |
| WebSocket | Channel membership check | Socket events validate `channel_members` before joining rooms or broadcasting. |
| Personal data | Schema constraint | `personal_tasks` has no `org_id`/`space_id` — inaccessible from any org-scoped API. |
