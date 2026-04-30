# Architecture & Design

## Conceptual Hierarchy

The Keil application transitions from a legacy single-workspace model to a robust Platform > Organisation > Space hierarchy.

```text
Platform (Global Identity)
│
├── User (Owner of Personal Data)
│   └── Personal Tasks (No Org/Space context)
│
└── Organisations (Tenancy Boundary)
    │
    ├── Space A (Private by default)
    │   ├── Org Tasks
    │   ├── Chat Channels
    │   └── Activity Logs
    │
    └── Space B
        ├── Org Tasks
        └── Chat Channels
```

## Key Design Decisions

### 1. Explicit Context vs. Implicit Context
**Decision:** All APIs managing organisation or space-owned data must receive explicit `orgId` and `spaceId` parameters (typically in the URL route).
**Why:** The legacy model relied on a backend middleware to infer a `req.workspaceId` from the user's first available workspace. This prevented users from belonging to multiple organisations and made it easy to accidentally leak or misroute data. Explicit context guarantees that every read and write is strictly validated against the targeted boundary.

### 2. Separation of Personal and Organisational Data
**Decision:** Personal tasks are stored in a completely separate table (`personal_tasks`) from organisational tasks (`org_tasks`), and they lack `org_id` and `space_id` columns.
**Why:** Personal data is owned by the user, not an organisation. If a user leaves an organisation, their personal tasks must remain unaffected. Furthermore, organisation admins must have zero capability to access personal tasks. Splitting the tables structurally guarantees this data isolation.

### 3. Spaces as the Primary Collaboration Boundary
**Decision:** Inside an organisation, all collaborative work (tasks, chat) must belong to a Space. Spaces are private by default.
**Why:** Modern teams require segmented visibility (e.g., HR vs. Engineering). Enforcing a space association prevents a "global noise" problem in the organisation and tightly scopes assignments and chat access to explicit space members.

### 4. Canonical `TaskStatus` and Serialization
**Decision:** A single canonical `TaskStatus` type (`"backlog" | "todo" | "in-progress" | "in-review" | "done" | "cancelled"`) is used across the entire frontend.
**Why:** The backend personal task endpoints expect snake_case (`in_progress`), while org tasks expect kebab-case (`in-progress`). Instead of letting this inconsistency leak into UI components, we handle the serialization/deserialization at the HTTP boundary (in `usePersonalTasks.ts`), ensuring UI components remain completely agnostic to the storage format.

## Security Model & Boundaries

- **Identity Authentication:** The `protect` middleware strictly verifies the Supabase JWT and attaches `req.user`. It does **not** assume any organisation context.
- **Organisation Authorization:** The `requireOrgMember` middleware validates that `req.user` belongs to the explicitly requested `:orgId`.
- **Space Authorization:** The `requireSpaceMember` middleware validates that `:spaceId` belongs to `:orgId` and that `req.user` is explicitly a member of that space.
- **WebSocket Security:** Socket events (like new messages or typing indicators) validate channel membership against the database before joining rooms or broadcasting events, preventing cross-space data leakage.
