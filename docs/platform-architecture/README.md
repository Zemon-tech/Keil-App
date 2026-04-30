# Platform, Organisation, and Space Architecture

## Overview

This documentation covers the three-boundary product model implemented in Keil, transitioning from a single implicit `workspace` model to an explicit hierarchy of **Platform**, **Organisation**, and **Space**.

The primary objective of this architecture is to clearly separate personal user data from tenant (business) data, and to introduce secure, private-by-default collaboration boundaries.

- **Platform**: Owns global user identity, authentication profile, and personal tasks. Personal work is strictly platform-owned and has no organisational context.
- **Organisation**: The primary tenancy boundary. Owns tenant data, members, billing, organisation-level roles/permissions, and audit logs.
- **Space**: The team or functional unit inside an organisation (e.g., Design, Engineering). Acts as the primary visibility boundary for tasks, chat channels, and activity feeds.

## Table of Contents

- [Architecture & Design Decisions](./architecture.md)
- [Frontend Implementation Guide](./frontend.md)
- [Backend Implementation Guide](./backend.md)

## Quick Start

### Running the Application

To run the application with the new architecture, start both the frontend and backend development servers normally:

```bash
# Terminal 1: Backend
cd backend
npm run dev

# Terminal 2: Frontend
cd frontend
npm run dev
```

### Key Differences to Observe

1. **Personal Mode vs. Organisation Mode**: When you log in without any organisation memberships, you will be in "Personal Mode". Here, you can manage personal tasks which are fully private to you.
2. **Context Switching**: If you belong to an organisation, the sidebar allows you to switch between "Personal Mode" and your "Organisations".
3. **Spaces**: Within an organisation, you must select a Space. Chat channels, org tasks, and dashboards are strictly scoped to the active Space.

## Tech Stack

| Component | Technology | Purpose |
| :--- | :--- | :--- |
| **Frontend State** | React Context API | `AppContext` manages `mode`, `activeOrgId`, and `activeSpaceId` globally. |
| **Data Fetching** | TanStack Query | Query keys include `mode`, `orgId`, and `spaceId` to strictly isolate caches. |
| **Backend API** | Express.js | Explicit routes validating `:orgId` and `:spaceId`. |
| **Authentication** | Supabase Auth | Provides JWTs. Middleware `protect` extracts user identity. |
| **Authorization** | Custom Express Middlewares | `requireOrgMember` and `requireSpaceMember` enforce strict boundary checks. |
| **Database** | PostgreSQL | `organisations`, `spaces`, and `personal_tasks` tables securely separate data. |
