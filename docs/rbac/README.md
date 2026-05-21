# Role-Based Access Control (RBAC) System

## Overview

Keil implements a robust, secure **two-tier Role-Based Access Control (RBAC)** system designed to enforce fine-grained permissions across the entire platform. The authorization layers are strictly segregated into two scopes:

1. **Organisation-Level Scope**: Determines administrative permissions for resources spanning the entire tenant (e.g., billing, organisation settings, member invitations, and space creation/deletion).
   - Roles: `owner` (highest), `admin`, `member`
2. **Space-Level Scope**: Controls access to individual project collaboration areas, protecting pages, tasks, statuses, assignees, subtasks, and comments.
   - Roles: `admin` (highest), `manager`, `member`
   - *Note*: Space-level `owner` has been abolished and migrated to space-level `admin` to maintain a clean, collaborative model.

This document serves as the developer entry point for understanding the RBAC implementation, setup, and execution.

---

## Table of Contents

| Document | Description |
| --- | --- |
| [Architecture & Design](./architecture.md) | Database schemas, unique space index constraints, key design decisions, and ASCII auth flows. |
| [Frontend Guide](./frontend.md) | The centralised `useSpaceRole` permissions hook, capabilities matrix, UI gating, and read-only text editors. |
| [Backend Guide](./backend.md) | Centralised RBAC middleware (`requireOrgRole`, `requireSpaceRole`), Express route protection, and service validation. |
| [Acceptance & Testing Criteria](./acceptance-criteria.md) | Standard checklists and verification procedures to manually test and audit the RBAC implementation. |

---

## Quick Start

### 1. Database Migrations
Make sure the RBAC role migration is applied to your Postgres database:
```bash
# Apply migrations sequentially
# Migration s:\1-Project\Quild\Keil-App\backend\src\migrations\014_rbac_roles.sql
```

The migration performs the following:
1. Adds `manager` role to the space-level `member_role` database enum.
2. Migrates legacy `owner` entries inside `space_members` to `admin`.
3. Adds `is_default` boolean column to the `spaces` table (marking the oldest active space per organisation as default).
4. Creates a partial unique index ensuring **exactly one default space** exists per organisation.

### 2. Running Local Typechecking
To verify that all typescript interfaces are safe and aligned with role capabilities:
```bash
# In the backend workspace
npm run build # or npx tsc --noEmit

# In the frontend workspace (using project reference compilation)
npx tsc -b --noEmit
```

### 3. Verification & Testing
To test the RBAC capabilities in the application:
1. Log in as an **Org Admin/Owner** to manage space members in **Settings → Spaces** or the **Space Settings Dialog**.
2. Update a member's role (e.g., from `member` to `manager` or `admin`). Self-demotion is prevented via UI guards.
3. Access a space as a **Space Member** and verify that task editing, deleting, assignee updates, and page creation/editing are strictly read-only/gated.
4. Access as a **Space Manager** and verify that you can create/edit tasks, but cannot manage space members or delete pages.

---

## Tech Stack & Core Mechanisms

| Layer | Component | Purpose |
| --- | --- | --- |
| **Database** | PostgreSQL | Extends `public.member_role` enum, enforces default space uniqueness via partial unique index `idx_spaces_one_default_per_org`. |
| **Backend Middleware** | `rbac.middleware.ts` | Centralises `requireOrgRole` and `requireSpaceRole` Express route gates. |
| **Frontend Hook** | `useSpaceRole.ts` | Single source of truth for UI feature flags and role rankings. |
| **Rich Editor Gating** | TipTap / MotionPage | Implements strict read-only states for TipTap based on space-level permission rankings. |
| **Safety Guards** | Client UI Control | Self-demotion blocks and peer demotion protection (only Org Admins/Owners can demotion-protect Space Admins). |
