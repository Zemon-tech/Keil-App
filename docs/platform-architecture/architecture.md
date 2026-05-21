# Architecture & Design

## Conceptual Hierarchy

```text
Platform (Global Identity)
│
└── Organisations (Tenancy Boundaries)
    ├── Personal Organisation (pinned at top, auto-created on signup, non-deletable)
    │   ├── Private Space (system-managed, owner-only, holds personal tasks)
    │   │   └── Personal Tasks (standard task entities, private)
    │   └── Collaborative Space A
    │
    └── Shared Organisations (standard collaborative workspaces)
        ├── Space A
        │   ├── Shared Tasks
        │   ├── Chat Channels
        │   └── Activity Logs
        └── Space B
```

## User Lifecycle

```text
Sign up
  └── public.users row created
  └── Personal Organisation created atomically (is_personal = TRUE)
  └── Owner membership assigned to the user
  └── Private Space created atomically (name = 'Private', is_private = TRUE)
  └── Admin membership assigned to the user for Private space
  └── Lands directly in Personal Organisation + Private Space

Create Organisation  (POST /api/v1/orgs)
  └── Standard organisations row
  └── Spaces row ("General")          ← atomic transaction
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
      └── If default space is private, falls back to oldest non-private space
  └── App switches to joined org + default space

Delete Space  (DELETE /api/v1/orgs/:orgId/spaces/:spaceId)
  └── Soft-delete: sets deleted_at on space + cascades to tasks
  └── Private spaces and last active spaces in org are blocked (400)
  └── If active space deleted → app auto-switches to first remaining space

Restore Space  (POST /api/v1/orgs/:orgId/spaces/:spaceId/restore)
  └── Clears deleted_at on space row only
  └── Tasks remain soft-deleted (restore separately)

Permanent Delete  (DELETE /api/v1/orgs/:orgId/spaces/:spaceId/permanent)
  └── Space must already be soft-deleted
  └── Private spaces are blocked (400)
  └── Removes all tasks, channels, activity_logs, space_members in a transaction
```

## Key Design Decisions

### 1. Explicit Context — No Implicit Workspace Inference
All APIs managing org or space-owned data receive explicit `orgId` and `spaceId` in the URL. The legacy `attachWorkspaceContext` middleware (which inferred `req.workspaceId` from the user's first workspace) is kept only as a compatibility shim for the legacy `/workspaces` routes. No new code uses it.

### 2. Unified Schema via Personal Organisation & Private Space
Legacy `personal_tasks` are deprecated in favor of storing personal tasks directly inside the main `public.tasks` table, scoped to the user's Personal Organisation and Private Space. This unified schema guarantees that personal tasks natively support all platform features—including rich text descriptions, comments, activity logs, file attachments, and dependencies—while remaining strictly confidential and isolated.

### 3. Spaces as the Primary Collaboration Boundary
All collaborative data (tasks, chat, dashboard, activity) belongs to a space, not just an org. This prevents "global noise" and tightly scopes assignments and chat to explicit space members. Spaces are private by default — there is no public visibility option.

### 4. Atomic Org + Space Creation
`POST /api/v1/orgs` runs in a single DB transaction: creates the org, creates a "General" space, and adds the caller as `owner` in both `organisation_members` and `space_members`. There is no state where an org exists without at least one space.

### 5. Token-Based Invite (Org-Scoped)
Invite tokens are JWTs signed with `JWT_SECRET`, containing `{ orgId, type: "org_invite" }` with a 7-day expiry. The token is tied to the org only. If the default space is system-managed as private, the service automatically identifies the oldest non-private space as the target landing space to prevent guests from landing in a locked private space.

### 6. Space Soft-Delete and Cascade Rules
Deleting a space is a two-step process. Soft-delete (`DELETE /spaces/:spaceId`) sets `deleted_at` on the space and cascades to `tasks` (which also have `deleted_at`). `channels` and `activity_logs` do not have `deleted_at` — they are excluded from the soft-delete cascade and are only removed on permanent deletion. `space_members` rows are preserved during soft-delete so the space can be restored. Permanent deletion (`DELETE /spaces/:spaceId/permanent`) runs in a single transaction and removes all child data. The last active space in an org and system-managed private spaces are blocked from deletion at the service layer.

### 7. Read-Only Aggregate Dashboard ("My Tasks")
The aggregate dashboard is a virtual, flat list pooling active tasks assigned to the user across all of their active memberships. Queries run across multiple organisations and space contexts, ordering overdue tasks at the top, followed by upcoming due dates. To preserve clean data mutations, My Tasks is strictly read-only; editing or updating a task is handled by context-switching the active organisation and space in the UI and navigating the user directly to the interactive task pane in its native space.

## Security Model

| Layer | Mechanism | What it enforces |
| :--- | :--- | :--- |
| Identity | `protect` middleware | Validates Supabase JWT, attaches `req.user`. No org context. |
| Org boundary | `requireOrgMember` | Checks `organisation_members` for `(orgId, userId)`. Attaches `req.org` (includes role). |
| Space boundary | `requireSpaceMember` | Checks `space_members` for `(spaceId, userId)` and that space belongs to org. Attaches `req.space`. |
| WebSocket | Channel membership check | Socket events validate `channel_members` before joining rooms or broadcasting. |
| Service Layer Guards | Hardcoded row checks | Blocks deletions of personal organisations (`is_personal = TRUE`) and private spaces (`is_private = TRUE`), and blocks member additions to private spaces. |

