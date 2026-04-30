# Frontend Implementation Guide

## File Structure

Relevant files in the frontend application dealing with the new platform architecture:

```text
frontend/src/
├── contexts/
│   └── AppContext.tsx               # Global state for Mode, Org, and Space
├── hooks/api/
│   ├── usePersonalTasks.ts          # API hooks for personal tasks
│   ├── useTasks.ts                  # API hooks for org tasks
│   ├── useDashboard.ts              # Hooks for dashboard data (supports both modes)
│   └── useOrganisations.ts          # Hooks for fetching user orgs and spaces
├── components/
│   ├── AppSidebar.tsx               # Navigation and mode switching UI
│   ├── TasksPage.tsx                # High-level task page orchestrator
│   ├── Dashboard.tsx                # Mode-aware dashboard orchestrator
│   └── tasks/
│       ├── TaskListPane.tsx         # Displays tasks, accepts `isPersonalMode`
│       ├── TaskDetailPane.tsx       # Detail view, handles mode-specific rendering/mutations
│       └── CreateTaskDialog.tsx     # Mode-aware creation/edit dialog
└── types/
    └── task.ts                      # Canonical types (e.g., TaskStatus)
```

## Core Concepts

### `AppContext`

The `AppContext` is the backbone of the new frontend architecture. It replaces the legacy `WorkspaceContext` and manages the global state for the user's current operating context.

It exposes:
- `mode`: `"personal" | "organisation"`
- `activeOrgId`: `string | null`
- `activeSpaceId`: `string | null`
- Setters for the above to allow navigation components (like `AppSidebar`) to switch contexts.

When `mode` is `"personal"`, components should ignore `activeOrgId` and `activeSpaceId` and instead fetch/mutate personal data.

## Important Components

### `TasksPage.tsx`
This component acts as an orchestrator. It reads the `AppContext` and decides whether to fetch data using `usePersonalTasks` or `useTasks` (for org tasks). It unifies the shape of the data before passing it down to `TaskListPane` and `TaskDetailPane`, and passes down an `isPersonalMode` boolean flag.

### `CreateTaskDialog.tsx` & `TaskDetailPane.tsx`
These components accept the `isPersonalMode` flag. 
- In personal mode, they route mutations to `useCreatePersonalTask` / `useUpdatePersonalTask`.
- They also conditionally hide organisation-only features (e.g., assignees, time estimates, activity logs) when in personal mode.

## API Integration

Data fetching is handled by TanStack Query. It is critical that query keys include the full context to prevent cache pollution across boundaries.

Example query keys:
- Personal Tasks: `["personal_tasks", "list", filters]`
- Org Tasks: `["tasks", orgId, spaceId, filters]`

### `usePersonalTasks.ts` (The HTTP Boundary)

Because the backend expects `snake_case` statuses for personal tasks (`in_progress`) but `kebab-case` for org tasks (`in-progress`), we established a canonical `TaskStatus` type in the frontend (`in-progress`).

`usePersonalTasks.ts` acts as the translation layer:
- It uses `toApiStatus` to convert `in-progress` to `in_progress` before sending the payload to the server.
- It uses `fromApiStatus` to convert `in_progress` back to `in-progress` when receiving data from the server.
This ensures UI components only ever deal with the canonical frontend type.
