# Platform, Organisation, and Space Architecture

## Overview

Keil uses a unified tenant product model with a specialized tiering: **Personal Organisation & System-Managed Private Space**.

- **Personal Organisation**: Every user is automatically assigned a Personal Organisation on signup. It behaves like a standard organisation but cannot be deleted and is pinned at the top of the user's workspace list.
- **Private Space**: Within the Personal Organisation, a system-managed Private space is created automatically. It is visible only to the owner, does not allow member invitations, and acts as the secure repository for the user's personal tasks.
- **Shared Organisation**: Standard collaborative workspaces created explicitly by users or joined via invite tokens.
- **My Tasks**: A unified, cross-organisation read-only aggregate dashboard that pools all active tasks assigned to the user across every workspace they are a member of.

## Table of Contents

- [Architecture & Design Decisions](./architecture.md)
- [Frontend Implementation Guide](./frontend.md)
- [Backend Implementation Guide](./backend.md)
- [Role-Based Access Control (RBAC) System](../rbac/README.md)

## Quick Start

```bash
# Terminal 1: Backend
cd backend && npm run dev

# Terminal 2: Frontend
cd frontend && npm run dev
```

### Key Behaviours

1. **Personal Home Context**: On first load, users automatically land in their Personal Organisation.
2. **Standard Task Schema**: Personal tasks are normal task entities inside the `public.tasks` table, scoped to the Personal Org and Private Space. They support comments, dependencies, and history natively.
3. **Cross-Org Aggregation**: The "My Tasks" view pulls assigned active tasks from all organisations, sorted by overdue status first, and provides "Open in Space" quick navigation.
4. **Invite Flow**: Org owners/admins generate an invite link from Settings → Members. Joining adds the user to the target org. If the default space is private, the invite flow safely redirects to the oldest non-private space.
5. **Settings Guards**: Settings dialogs dynamically protect system-managed items. Deleting a personal organisation, deleting/archiving a private space, or inviting members to a private space are restricted at both API and UI layers.

## Tech Stack

| Component | Technology | Purpose |
| :--- | :--- | :--- |
| **Frontend State** | `AppContext` (React Context) | Manages active context. Derives `isPersonalOrg` dynamically from `activeOrg?.is_personal`. |
| **Data Fetching** | TanStack Query | Isolated cache keys per organisation and space. Includes `my-tasks` cross-org cache. |
| **Backend API** | Express.js | Standardized `:orgId` and `:spaceId` routes. Added `/api/v1/my-tasks` cross-org endpoint. |
| **Authentication** | Supabase Auth | Provides JWTs. `protect` middleware attaches authenticated identity. |
| **Authorization** | `requireOrgMember`, `requireSpaceMember` | Enforce tenant boundary checks. Service guards block actions on personal/private rows. |
| **Database** | PostgreSQL (Supabase) | Unified `organisations`, `spaces`, and `tasks` tables with `is_personal` and `is_private` system flags. |

