# Frontend Implementation Guide

## File Structure

```text
frontend/src/
├── contexts/
│   ├── AppContext.tsx               # Global mode/org/space state (single source of truth)
│   └── AuthContext.tsx              # Supabase session
├── hooks/api/
│   ├── useOrganisations.ts          # useOrganisations, useOrgMembers,
│   │                                #   useCreateOrganisation, useCreateOrgInvite,
│   │                                #   useJoinOrganisation
│   ├── useSpaces.ts                 # useSpaces, useSpaceMembers, useDeletedSpaces,
│   │                                #   useCreateSpace, useRenameSpace, useDeleteSpace,
│   │                                #   useRestoreSpace, useHardDeleteSpace,
│   │                                #   useAddSpaceMember, useRemoveSpaceMember
│   ├── usePersonalTasks.ts          # Full CRUD for personal tasks
│   ├── useTasks.ts                  # Org task CRUD (legacy /v1/tasks route)
│   ├── useChat.ts                   # Chat hooks — all accept (orgId, spaceId) params
│   ├── useDashboard.ts              # useDashboard (personal), useOrgDashboard (org)
│   └── useActivity.ts              # Activity feed hooks
├── components/
│   ├── AppSidebar.tsx               # Org list with lazy space sub-menus, mode switching
│   ├── org/
│   │   ├── CreateOrganisationDialog.tsx
│   │   └── JoinOrganisationDialog.tsx
│   ├── settings/
│   │   └── SpacesTab.tsx            # Settings → Spaces tab (space list + detail panel)
│   ├── workspace/
│   │   └── InvitePage.tsx           # /invite/:token — joins org via token
│   ├── TasksPage.tsx                # Mode-aware task orchestrator
│   ├── Dashboard.tsx                # Mode-aware dashboard
│   ├── ChatDialog.tsx               # Full-screen chat dialog (org mode only)
│   ├── ChatPage.tsx                 # /chat route
│   ├── SettingsDialog.tsx           # Account + Organisation + Spaces settings
│   └── chat/
│       ├── ChannelList.tsx          # Accepts (orgId, spaceId) props
│       ├── MessageView.tsx          # Accepts (orgId, spaceId) props
│       ├── NewChatDialog.tsx        # Uses useSpaceMembers for DM/group creation
│       └── GroupSettingsDialog.tsx  # Uses useSpaceMembers for member management
└── types/
    └── task.ts                      # Canonical types (TaskStatus, TaskPriority, etc.)
```

## Core Concept: `AppContext`

`AppContext` is the single source of truth for the user's active context. `WorkspaceContext` has been fully removed.

```ts
const {
  mode,                  // "personal" | "organisation"
  activeOrgId,           // string | null
  activeSpaceId,         // string | null
  organisations,         // Organisation[]
  spaces,                // Space[] for active org
  activeOrg,             // Organisation | null
  activeSpace,           // Space | null
  setPersonalMode,       // () => void
  setOrganisationMode,   // () => void  (switches mode without selecting an org)
  setActiveOrganisation, // (orgId, spaceId?) => void
  setActiveSpace,        // (spaceId) => void
} = useAppContext();
```

**Rules:**
- Personal mode: never call org-scoped APIs. `activeOrgId` and `activeSpaceId` are `null`.
- Organisation mode: org/space queries are only enabled when both `activeOrgId` and `activeSpaceId` are set.
- Switching org clears `activeSpaceId`; the auto-select effect picks the first available space.
- On first load, the legacy `keil_active_workspace` localStorage key is removed automatically.

**Persistence keys:**

| Key | Value |
| :--- | :--- |
| `keil_app_mode` | `"personal"` \| `"organisation"` |
| `keil_active_org` | org UUID |
| `keil_active_space` | space UUID |

## Sidebar: Org List with Space Sub-Menus

The profile icon dropdown in `AppSidebar` lists organisations from `AppContext`. Each org row is a `DropdownMenuSub` — hovering/clicking it reveals that org's spaces. Spaces are fetched lazily (only when the sub-menu opens) via a dedicated `OrgSpaceSubmenu` sub-component that calls `useSpaces(org.id)`.

Selecting a space calls `setActiveOrganisation(orgId, spaceId)`.

## Chat Hooks

All chat hooks accept `orgId` and `spaceId` as explicit parameters. The component reads them from `useAppContext()` and passes them in. This keeps hooks free of context dependencies.

```ts
// In ChatDialog.tsx
const { activeOrgId, activeSpaceId } = useAppContext();
const { data: channels } = useChatChannels(activeOrgId, activeSpaceId);
const readChannel = useReadChannel(activeOrgId, activeSpaceId);
useChatSocketListeners(activeChannelId, activeOrgId, activeSpaceId);
```

Chat query keys include `[orgId, spaceId]`, so switching spaces automatically invalidates the previous space's channel list.

## Assignee Pickers

All assignee pickers (in `OverviewTab`, `ActivityTab`, `EventOverviewTab`, `TasksPage`) use `useSpaceMembers(activeOrgId, activeSpaceId)`. The `SpaceMember` shape is:

```ts
interface SpaceMember {
  user_id: string;
  role: "owner" | "admin" | "member";
  name: string | null;
  email: string;
}
```

Pickers are hidden entirely in personal mode — not just empty.

## Personal Task Status Serialisation

The personal task backend stores status with underscores (`in_progress`). The frontend canonical type uses hyphens (`in-progress`). `usePersonalTasks.ts` handles conversion at the HTTP boundary:

- `toApiStatus("in-progress")` → `"in_progress"` (sent to backend)
- `fromApiStatus("in_progress")` → `"in-progress"` (received from backend)

No UI component ever sees the underscore format.

## Space Management Hooks (`useSpaces.ts`)

All space mutation hooks follow the same pattern: accept `orgId` (and `spaceId` where needed) as parameters, invalidate the relevant cache keys on success.

| Hook | Cache invalidated | Notes |
| :--- | :--- | :--- |
| `useCreateSpace(orgId)` | `spaceKeys.list(orgId)` | Owner/admin only |
| `useRenameSpace(orgId)` | `spaceKeys.list(orgId)` | **Optimistic update** — cache updated instantly, rolled back on error |
| `useDeleteSpace(orgId)` | `list` + `deleted` | Soft-delete. Caller handles active-space fallback in `onSuccess` |
| `useRestoreSpace(orgId)` | `list` + `deleted` | Restores space row only; tasks remain soft-deleted |
| `useHardDeleteSpace(orgId)` | `spaceKeys.deleted(orgId)` | Space must already be soft-deleted |
| `useDeletedSpaces(orgId)` | — (query) | Only returns data for org owner/admin |
| `useAddSpaceMember(orgId, spaceId)` | `spaceKeys.members(orgId, spaceId)` | Target must be an org member |
| `useRemoveSpaceMember(orgId, spaceId)` | `spaceKeys.members(orgId, spaceId)` | Cannot remove self |

**Active-space fallback pattern** (used in `SpacesTab`):
```tsx
const del = useDeleteSpace(orgId);
del.mutate(spaceId, {
  onSuccess: () => {
    if (activeSpaceId === spaceId) setActiveOrganisation(orgId); // auto-selects first remaining space
  },
});
```

## Settings → Spaces Tab

`SpacesTab` (`frontend/src/components/settings/SpacesTab.tsx`) is a two-column layout inside Settings:

- **Left panel**: list of all active spaces + a "Deleted" section (org owner/admin only). Clicking a space opens the detail panel.
- **Right panel**: inline rename (optimistic), members list with remove buttons, add-member popover (shows org members not already in the space), danger zone with soft-delete button (disabled when last space).
- Deleted space detail: Restore and Delete Forever buttons with separate confirmation dialogs.
- Non-admin users see a read-only view — no rename, no add/remove, no delete.

**Check current mode before rendering org-only UI:**
```tsx
const { mode, activeOrgId, activeSpaceId } = useAppContext();
if (mode !== "organisation" || !activeOrgId || !activeSpaceId) return null;
```

**Create an organisation and switch to it:**
```tsx
const create = useCreateOrganisation();
const { setActiveOrganisation } = useAppContext();

create.mutate("Acme Corp", {
  onSuccess: ({ org, space }) => setActiveOrganisation(org.id, space.id),
});
```

**Join via invite token:**
```tsx
const join = useJoinOrganisation();
const { setActiveOrganisation } = useAppContext();

join.mutate(token, {
  onSuccess: ({ orgId, spaceId }) => setActiveOrganisation(orgId, spaceId),
});
```
