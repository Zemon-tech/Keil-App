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
│   ├── useSpaces.ts                 # useSpaces, useSpaceMembers, useCreateSpace
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
│   ├── workspace/
│   │   └── InvitePage.tsx           # /invite/:token — joins org via token
│   ├── TasksPage.tsx                # Mode-aware task orchestrator
│   ├── Dashboard.tsx                # Mode-aware dashboard
│   ├── ChatDialog.tsx               # Full-screen chat dialog (org mode only)
│   ├── ChatPage.tsx                 # /chat route
│   ├── SettingsDialog.tsx           # Account + Organisation settings
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

## Usage Examples

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
