# Frontend Implementation Guide

## File Structure

```text
frontend/src/
├── contexts/
│   ├── AppContext.tsx               # Global activeOrg/activeSpace state (single source of truth)
│   └── AuthContext.tsx              # Supabase session
├── hooks/api/
│   ├── useOrganisations.ts          # useOrganisations, useOrgMembers, create, join
│   ├── useSpaces.ts                 # useSpaces, space mutations, member add/remove
│   ├── useMyTasks.ts                # hook querying backend cross-org /my-tasks endpoint
│   ├── useTasks.ts                  # Standard organisation task CRUD
│   ├── useChat.ts                   # Chat hooks (scoped to orgId, spaceId)
│   ├── useDashboard.ts              # useOrgDashboard (scoped to orgId, spaceId)
│   └── useActivity.ts               # Activity feed hooks
├── components/
│   ├── AppSidebar.tsx               # Pins personal org, displays aggregate My Tasks nav, lazy spaces list
│   ├── settings/
│   │   └── SpacesTab.tsx            # Settings → Spaces tab (gated details for Private space)
│   ├── workspace/
│   │   └── InvitePage.tsx           # /invite/:token — joins org and navigates to default space
│   ├── TasksPage.tsx                # Unified task dashboard
│   ├── MyTasksPage.tsx              # Unified read-only aggregate cross-org dashboard
│   ├── Dashboard.tsx                # Context-aware dashboard
│   └── SettingsDialog.tsx           # General Org + Space settings (gated for system-managed rows)
└── types/
    └── task.ts                      # Canonical types (TaskStatus, TaskPriority, etc.)
```

## Core Concept: `AppContext`

`AppContext` is the single source of truth for the user's active context. It coordinates active organisation and active space contexts with 100% type safety. Legacy "modes" and separate frontend-only states have been fully removed.

```ts
const {
  activeOrgId,           // string | null
  activeSpaceId,         // string | null
  organisations,         // Organisation[]
  spaces,                // Space[] for active org
  activeOrg,             // Organisation | null
  activeSpace,           // Space | null
  isPersonalOrg,         // boolean (derived dynamically from activeOrg?.is_personal)
  setActiveOrganisation, // (orgId, spaceId?) => void
  setActiveSpace,        // (spaceId) => void
} = useAppContext();
```

**Auto-Select & Fallback Rules**:
- On initial page load (or if no active workspace is selected), the application scans the user's organisation list, finds their Personal Organisation (`is_personal: true`), and automatically sets it as the active context.
- If a user is removed from their active organisation, the context switcher automatically shifts focus back to the Personal Organisation fallback cleanly.
- Legacy `keil_app_mode` and `keil_active_workspace` local storage keys are cleaned up automatically on first load.

**Persistence keys**:

| Key | Value |
| :--- | :--- |
| `keil_active_org` | active organisation UUID |
| `keil_active_space` | active space UUID |

## Sidebar: Personal Organisation & Aggregate "My Tasks"

`AppSidebar` leverages standard styling to render the navigation:
- **Personal Organisation Row**: Displays at the top of the sidebar org list with a custom `User` icon avatar and a subtle `(Personal)` label badge to visually separate it from shared workspaces.
- **My Tasks aggregate navigation link**: Permanently pinned inside the main navigation sidebar (URL `/my-tasks`). Also rendered at the top of the Personal Organisation space list, above a divider.
- **Private Space Visibility**: The system-managed `Private` space is strictly hidden inside the organisation spaces submenu for non-owners.

## Aggregate View: My Tasks

The `MyTasksPage` (`frontend/src/components/MyTasksPage.tsx`) provides a premium, unified flat list of all active tasks assigned to the user:
- **Premium Interface**: Integrates HSL-colored glassmorphic statistics widgets (Total Assigned, Overdue, In Progress, High/Urgent) and inline filter controls.
- **Due Date Indicator**: Pulsates with overdue warnings (e.g. "Overdue by X days") in custom rose/amber warning alerts.
- **Touchpad Scrolling**: Wraps elements inside an `overflow-y-auto custom-scrollbar-page pb-20` scrolling block with standard page boundaries (`h-dvh overflow-hidden`), enabling native touchpad swipe gestures and styling scrollbars cleanly.
- **Cross-Context Navigation**: Every task row exposes an "Open in Space →" link. Clicking it updates `AppContext` to switch to that task's `org_id` and `space_id` and navigates the user directly to the interactive task detail pane at `/tasks/:taskId`.

## Settings & Space Management Guards

To prevent users from accidentally deleting or corrupting system-managed structures, custom UI guards are integrated:

### 1. Organisation Settings (`SettingsDialog.tsx`)
In `OrgGeneralTab`, the **Delete Organisation** container is hidden completely if `selectedOrg?.is_personal` is true. On standard organisation deletion, success routing finds the personal organisation and redirects to it contextually.

### 2. Spaces Settings (`SpacesTab.tsx` and `SettingsDialog.tsx`)
When viewing settings for a system-managed `Private` space (`space.is_private` is true):
- **Add Member** triggers and inputs are hidden.
- **Danger Zone** (Delete/Archive Space) sections are completely hidden.
- Role editing and member removal options are disabled in the members pane.

## API Integration & Usage Examples

The frontend manages data queries and mutations using TanStack Query. Cache invalidations occur automatically on successful updates.

### 1. Unified Workspace Context
Using `useAppContext` allows any component to retrieve the current tenancy state, active IDs, and derived personal flags.

```tsx
import { useAppContext } from "@/contexts/AppContext";

export function ActiveIndicator() {
  const { isPersonalOrg, activeOrg, activeSpace } = useAppContext();

  return (
    <div>
      <p>Organisation: {activeOrg?.name} {isPersonalOrg && "(Personal)"}</p>
      <p>Active Space: {activeSpace?.name}</p>
    </div>
  );
}
```

### 2. Fetching Aggregate "My Tasks"
To populate a cross-org aggregate checklist (like the premium `MyTasksPage` dashboard), consume the `useMyTasks` hook:

```tsx
import { useMyTasks } from "@/hooks/api/useMyTasks";

export function ActiveTasksList() {
  // Query all active tasks across all organisations and spaces assigned to the user
  const { data: tasks = [], isLoading } = useMyTasks({
    status: "in-progress",
    priority: "high"
  });

  if (isLoading) return <div>Loading assigned tasks...</div>;

  return (
    <ul>
      {tasks.map(task => (
        <li key={task.id}>
          {task.title} - <em>{task.space_name} ({task.org_name})</em>
        </li>
      ))}
    </ul>
  );
}
```

### 3. Join Organisation Flow
Standard collaborative or shared workspaces can be joined via signed JWT tokens. When joining succeeds, the application shifts the global workspace context to the new organisation and landing space.

```tsx
import { useJoinOrganisation } from "@/hooks/api/useOrganisations";
import { useAppContext } from "@/contexts/AppContext";

export function JoinWorkspace({ token }: { token: string }) {
  const join = useJoinOrganisation();
  const { setActiveOrganisation } = useAppContext();

  const handleJoin = () => {
    join.mutate(token, {
      onSuccess: ({ orgId, spaceId }) => {
        // Switches workspace active context & navigates to space
        setActiveOrganisation(orgId, spaceId);
      }
    });
  };

  return <button onClick={handleJoin}>Join Workspace</button>;
}
```

### 4. Custom Space Management
Spaces within an organisation support full soft-deletion and restoration, backed by strict client-side guards that prevent modifications to system-managed `Private` spaces.

```tsx
import { useDeleteSpace } from "@/hooks/api/useSpaces";
import { useAppContext } from "@/contexts/AppContext";

export function SpaceDangerZone({ spaceId }: { spaceId: string }) {
  const { activeOrgId, activeSpaceId, setActiveOrganisation } = useAppContext();
  const deleteSpace = useDeleteSpace(activeOrgId);

  const handleDelete = () => {
    deleteSpace.mutate(spaceId, {
      onSuccess: () => {
        // Fallback: If deleting the currently active space, auto-select the next available space
        if (activeSpaceId === spaceId && activeOrgId) {
          setActiveOrganisation(activeOrgId);
        }
      }
    });
  };

  return <button onClick={handleDelete}>Delete Space</button>;
}
```
