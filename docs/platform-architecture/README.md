# Platform, Organisation, and Space Architecture

## Overview

Keil uses a three-boundary product model: **Platform → Organisation → Space**.

- **Platform**: Owns global user identity and personal tasks. Personal work is strictly user-owned with no organisational context.
- **Organisation**: The primary tenancy boundary. Owns members, spaces, tasks, chat, and activity. Created explicitly by users — never auto-created on signup.
- **Space**: The team or functional unit inside an organisation (e.g., Design, Engineering). All collaborative work (tasks, chat, dashboard) is scoped to a space. Private by default.

A new user who signs up lands in **Personal Mode** with no organisation. They must explicitly create or join an organisation to access collaborative features.

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

1. **Personal Mode**: Default for new users. Personal tasks are private and never visible to any organisation.
2. **Organisation Mode**: Activated by creating or joining an org. The sidebar profile dropdown lists orgs; hovering an org reveals its spaces in a sub-menu.
3. **Space Scope**: All org tasks, chat channels, and dashboard data are strictly scoped to the active space. Switching space changes all data.
4. **Invite Flow**: Org owners/admins generate an invite link from Settings → Members. The token encodes the `orgId`. Joining adds the user to the org and its default General space.
5. **Space Management**: Org owners/admins can create, rename, soft-delete, restore, and permanently delete spaces from Settings → Spaces. Members can be added (from org members) or removed per space. The last space in an org cannot be deleted.

## Tech Stack

| Component | Technology | Purpose |
| :--- | :--- | :--- |
| **Frontend State** | `AppContext` (React Context) | Manages `mode`, `activeOrgId`, `activeSpaceId` globally. `WorkspaceContext` has been removed. |
| **Data Fetching** | TanStack Query | Query keys include `orgId` and `spaceId` to strictly isolate caches per space. |
| **Backend API** | Express.js | Explicit routes validating `:orgId` and `:spaceId`. Legacy `/workspaces` routes kept as compatibility shims. |
| **Authentication** | Supabase Auth | Provides JWTs. `protect` middleware extracts user identity only. |
| **Authorization** | `requireOrgMember`, `requireSpaceMember` | Enforce strict boundary checks on every org/space-scoped route. |
| **Database** | PostgreSQL (Supabase) | `organisations`, `spaces`, `personal_tasks` tables enforce data isolation at the schema level. |
