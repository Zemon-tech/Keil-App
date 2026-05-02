# Workspace Deprecation & Organisation/Space Migration

> Status: **APPROVED — ready for implementation, phase by phase**
> Predecessor: `docs/todo/platform-organisation-space-refactor.md` (Phases 1–4 complete)
> Scope: Complete the migration from legacy `WorkspaceContext` to `AppContext` (org/space), add missing CRUD endpoints, wire all UI surfaces to the new model, and remove legacy workspace dependencies.

---

## Current State (Verified Against Codebase)

### What is already done and working
- **Schema**: `organisations`, `spaces`, `organisation_members`, `space_members`, `personal_tasks` tables exist in migration `005`. DB triggers auto-create an org + default space whenever a workspace is created.
- **Backend new routes**: `GET /api/v1/orgs`, `GET /api/v1/orgs/:orgId/spaces`, `GET /api/v1/orgs/:orgId/spaces/:spaceId/members`, full CRUD for `/api/v1/personal/tasks`, full CRUD for `/api/v1/orgs/:orgId/spaces/:spaceId/tasks`, org chat routes, org dashboard/activity routes.
- **Backend middlewares**: `protect` (identity only), `requireOrgMember`, `requireSpaceMember`, `attachWorkspaceContext` (legacy compat shim) — all implemented.
- **Frontend AppContext**: `mode`, `activeOrgId`, `activeSpaceId`, `organisations`, `spaces`, `setPersonalMode`, `setWorkspaceMode`, `setActiveOrganisation`, `setActiveSpace` — all implemented with localStorage persistence and membership validation.
- **Frontend hooks**: `useOrganisations`, `useSpaces`, `useSpaceMembers`, `usePersonalTasks` (full CRUD) — all implemented.
- **Frontend pages**: `TasksPage` and `Dashboard` are already mode-aware (personal vs org).

### What is still broken / missing
1. **No `POST /api/v1/orgs`** — cannot create an organisation from the UI.
2. **No `POST /api/v1/orgs/:orgId/spaces`** — cannot create a space from the UI.
3. **No `POST /api/v1/orgs/:orgId/invite`** — no org-level invite/join flow.
4. **`useChat`** still imports `useWorkspace` and uses `workspaceId` for all query keys and API calls. Chat is broken in org mode.
5. **`useDashboard`** (legacy) still imports `useWorkspace`. Dashboard falls back to legacy route in personal mode.
6. **`ChatDialog`** uses `useWorkspace` + `useWorkspaceMembers` to populate the "new DM" user list.
7. **`SettingsDialog`** — `WorkspaceSettingsTab` and `MembersTab` both use `useWorkspace` + `useWorkspaceMembers` + `useCreateInviteLink`.
8. **`TasksPage`** — assignee member list uses `useWorkspaceMembers(orgTasks?.[0]?.workspace_id)` instead of `useSpaceMembers`.
9. **`OverviewTab`, `ActivityTab`, `EventOverviewTab`** (task detail panes) — all use `useWorkspaceMembers(task.workspace_id)` for assignee pickers.
10. **`AppSidebar`** — the dropdown section label says "Workspace", lists from `WorkspaceContext`, and the subtitle falls back to `activeWorkspaceName` from the legacy context.
11. **`CreateWorkspaceDialog`** — creates a workspace (legacy), not an organisation. Wording is wrong.
12. **`InvitePage`** — uses `useJoinWorkspace` (workspace token), not an org invite flow.
13. **`WorkspaceSwitcher`** — entirely workspace-based, not used in main sidebar but still exists.
14. **`WorkspaceContext`** — still alive and consumed by 10+ files. Cannot be removed until all consumers are migrated.
15. **`useWorkspace` hook** — still exported and used. Cannot be removed until all consumers are migrated.
16. **`keil_active_workspace` localStorage key** — still written by `WorkspaceContext`. Needs cleanup after migration.
17. **`setWorkspaceMode()`** in `AppContext` — misleadingly named; it just sets `mode = "organisation"` without selecting an org. Should be renamed or replaced.

---

## Goals

1. A user can create an organisation and a space from the UI without touching the DB.
2. A user can invite others to an organisation via a link/token.
3. All UI surfaces (chat, tasks, dashboard, settings, assignee pickers) read from `AppContext` (org/space) instead of `WorkspaceContext`.
4. `WorkspaceContext` and `useWorkspace` are fully removed from production code paths.
5. The sidebar shows "Organisation" terminology, lists organisations from `AppContext`, and the subtitle reflects the active org/space.
6. No existing functionality regresses: personal tasks, org tasks, chat, dashboard, comments, dependencies, assignees, Google Calendar integration all continue to work.

---

## Non-Negotiable Constraints

- Do not remove `WorkspaceContext` or `useWorkspace` until every consumer has been migrated in the same PR/phase. Partial removal causes runtime crashes.
- Do not remove legacy workspace backend routes until the frontend no longer calls them. The `v1/workspaces` and `v1/tasks` (legacy) routes stay as compatibility routes throughout this refactor.
- Personal mode must never call org-scoped APIs.
- Organisation mode must not run task/chat/dashboard queries without both `activeOrgId` and `activeSpaceId` set.
- Chat must only be accessible in organisation mode with an active space.
- Assignee pickers must only show members of the active space (not all workspace members).
- The `compatibility_workspace_id` field on `Space` (returned by the backend) is the bridge between the new space model and the legacy workspace-scoped chat/task APIs during transition. It must be used wherever legacy routes are still called.
- Do not change the DB schema or add new migrations in this refactor — the schema is already correct.
- Do not touch `AuthContext`, `MotionPage`, `MotionHome`, `MotionProfile`, or any motion-related code.

---

## Decisions (Confirmed)

| # | Question | Decision |
|---|---|---|
| Q1 | Org creation flow | Single-step dialog: user enters org name only. Backend auto-creates a "General" space. UI immediately switches to the new org + General space. Additional spaces can be created later in Settings. |
| Q2 | Invite/join flow | Token is tied to `org_id` only. Joining adds the user to the org and its default "General" space. Admins can add them to other spaces later. The existing `/invite/:token` route and `InvitePage` are replaced with the new org-scoped flow. |
| Q3 | Settings sections | "Workspace settings" → "Organisation settings" (shows org name, org ID, user's role). "Members" tab shows both org members and space members (two sub-sections or tabs within the Members view). |
| Q4 | `setWorkspaceMode()` rename | Rename to `setOrganisationMode()`. Update all call sites. |
| Q5 | Clicking an org in sidebar | The org list is inside the profile icon dropdown. Each org row has a space picker sub-menu (hover/click reveals spaces). Selecting a space switches to that org+space. |
| Q6 | New user with no orgs | Show empty "Organisation" section with only Join and Create buttons. No crash, no forced redirect. |

---

## Proposed Phases

> Implementation starts only after all clarifying questions above are answered and this plan is approved.

---

### Phase A — Backend: Org & Space CRUD + Invite

**What changes:**

`backend/src/controllers/organisation.controller.ts`
- Add `createOrganisation`: accepts `{ name }`, runs in a DB transaction — inserts into `organisations`, inserts caller as `owner` in `organisation_members`, inserts a "General" space in `spaces`, inserts caller as `owner` in `space_members`. Returns `{ org, space }`.
- Add `createOrgInvite`: generates a signed JWT containing `{ orgId }` with 7-day expiry. Returns `{ inviteLink, token }`.
- Add `joinOrg`: verifies the JWT, extracts `orgId`, inserts the caller into `organisation_members` (role: `member`) and into the org's default "General" space in `space_members`. Idempotent — `ON CONFLICT DO NOTHING`. Returns `{ orgId, spaceId }`.

`backend/src/controllers/space.controller.ts`
- Add `createSpace`: accepts `{ name }`, requires caller to be an org `owner` or `admin`. Inserts into `spaces`, inserts caller as `owner` in `space_members`. Returns the new space.

`backend/src/services/organisation.service.ts`
- Add `createOrganisation(userId, name)` — wraps the transaction logic.
- Add `generateInviteToken(orgId, userId)` — signs JWT, checks caller is org member.
- Add `joinOrganisation(token, userId)` — verifies JWT, finds default space (the one with `source_workspace_id = org.source_workspace_id` or the first space), inserts memberships.

`backend/src/services/space.service.ts`
- Add `createSpace(orgId, userId, name)` — validates caller is org owner/admin, inserts space + space_member.

`backend/src/repositories/organisation.repository.ts`
- Add `create(name, ownerUserId)` — inserts org row, returns it.

`backend/src/repositories/space.repository.ts`
- Add `create(orgId, name, createdBy)` — inserts space row, returns it.
- Add `findDefaultSpace(orgId)` — returns the first space in the org ordered by `created_at ASC`.

`backend/src/routes/org.routes.ts`
- `POST /` → `createOrganisation` (protected, no org membership required)
- `POST /:orgId/spaces` → `createSpace` (protected, `requireOrgMember`)
- `POST /:orgId/invite` → `createOrgInvite` (protected, `requireOrgMember`)
- `POST /:orgId/join` → `joinOrg` (protected, no org membership required — that's the point)

**No new DB migration needed** — all required tables and constraints already exist in migration `005`.

**Acceptance Criteria:**
- [ ] `POST /api/v1/orgs` with `{ name }` creates an org + "General" space atomically, adds caller as `owner` in both, returns `{ org: { id, name, ... }, space: { id, name, ... } }`.
- [ ] `POST /api/v1/orgs/:orgId/spaces` with `{ name }` creates a space, adds caller as `owner`, returns the space. Rejects non-members with 403.
- [ ] `POST /api/v1/orgs/:orgId/invite` returns `{ inviteLink, token }`. Rejects non-members with 403.
- [ ] `POST /api/v1/orgs/:orgId/join` with `{ token }` adds the caller to the org + default space. Returns `{ orgId, spaceId }`. Calling it twice does not error (idempotent).
- [ ] `POST /api/v1/orgs/:orgId/join` with an expired or invalid token returns 400.
- [ ] Backend TypeScript build passes.

---

### Phase B — Frontend Hooks: Org/Space CRUD + Chat Migration

**What changes:**

`frontend/src/hooks/api/useOrganisations.ts`
- Add `useCreateOrganisation` mutation: `POST /api/v1/orgs` with `{ name }`. On success, invalidates `orgKeys.list()` and calls `setActiveOrganisation(newOrg.id, newSpace.id)` from `AppContext`. Returns `{ org, space }`.
- Add `useCreateOrgInvite` mutation: `POST /api/v1/orgs/:orgId/invite`. Returns `{ inviteLink, token }`.
- Add `useJoinOrganisation` mutation: `POST /api/v1/orgs/:orgId/join` with `{ token }`. On success, invalidates `orgKeys.list()`.

`frontend/src/hooks/api/useSpaces.ts`
- Add `useCreateSpace` mutation: `POST /api/v1/orgs/:orgId/spaces` with `{ name }`. On success, invalidates `spaceKeys.list(orgId)`.

`frontend/src/hooks/api/useChat.ts`
- **Full migration off `WorkspaceContext`**:
  - Remove `import { useWorkspace }` and all `const { workspaceId } = useWorkspace()` calls.
  - All hooks that need org/space context accept `orgId: string | null` and `spaceId: string | null` as parameters (passed in from the component, which reads them from `useAppContext()`). This avoids calling `useAppContext()` inside a hook that is also used in non-org contexts.
  - `useChatChannels(orgId, spaceId)` — calls `v1/orgs/:orgId/spaces/:spaceId/chat/channels`. `enabled: !!orgId && !!spaceId`.
  - `chatKeys` factory updated: `channels: (orgId, spaceId) => ["chat", "channels", orgId, spaceId]`.
  - `useReadChannel(orgId, spaceId)` — invalidates `chatKeys.channels(orgId, spaceId)`.
  - `useOpenDM(orgId, spaceId)` — calls `v1/orgs/:orgId/spaces/:spaceId/chat/channels/direct`.
  - `useCreateGroup(orgId, spaceId)` — calls `v1/orgs/:orgId/spaces/:spaceId/chat/channels/group`.
  - `useAddChannelMembers(orgId, spaceId)` — invalidates `chatKeys.channels(orgId, spaceId)`.
  - `useRemoveChannelMember(orgId, spaceId)` — invalidates `chatKeys.channels(orgId, spaceId)`.
  - `useChatSocketListeners(activeChannelId, orgId, spaceId)` — uses `chatKeys.channels(orgId, spaceId)` for cache updates.
  - Message-level hooks (`useChatMessages`, `useSendMessage`) are channel-scoped and don't need org/space — no change needed.

`frontend/src/hooks/api/useDashboard.ts`
- Remove `import { useWorkspace }` from `useDashboard()`.
- `useDashboard()` (personal/legacy mode) no longer needs `workspaceId` as an enabled guard — it calls `GET /v1/dashboard` which uses `attachWorkspaceContext` on the backend. Change `enabled: !!workspaceId` to `enabled: true` (the backend handles the case where the user has no workspace gracefully).

**Constraints:**
- Chat hooks must not throw when `orgId` or `spaceId` is null — they must simply be disabled.
- Switching active space must invalidate the channel list. The new `chatKeys` factory with `[orgId, spaceId]` ensures this automatically.
- `useChatMessages` and `useSendMessage` are channel-scoped and do not change.

**Acceptance Criteria:**
- [ ] `useCreateOrganisation` creates an org + space and switches the app to that org/space.
- [ ] `useCreateSpace` creates a space and invalidates the space list.
- [ ] `useChatChannels(orgId, spaceId)` returns channels for the active space. Returns nothing (disabled) when either is null.
- [ ] Switching active space causes the channel list to refetch (cache key changes).
- [ ] `useDashboard()` no longer imports `WorkspaceContext`.
- [ ] TypeScript build passes.

---

### Phase C — Frontend UI: Sidebar + Dialogs

**What changes:**

`frontend/src/components/AppSidebar.tsx`
- Remove `useWorkspace` import and all references to `workspaces`, `workspaceId`, `setActiveWorkspace`.
- Remove `createWorkspaceOpen` state, `joinWorkspaceOpen` state, `joinWorkspaceToken` state, `joinWorkspace` mutation, and `handleJoinWorkspace` function.
- Remove `<CreateWorkspaceDialog>` and the join workspace `<Dialog>` from the JSX.
- Replace `setWorkspaceMode` calls with `setOrganisationMode` (renamed in Phase E, but update call sites here).
- **Org section label**: change `"Workspace"` → `"Organisation"`.
- **Org list**: iterate `organisations` from `useAppContext()` instead of `workspaces`.
- **Each org row**: clicking an org row does NOT immediately switch — it reveals a space sub-menu (see below).
- **Space sub-menu**: each org row in the dropdown has a `DropdownMenuSub` that lists the org's spaces. Selecting a space calls `setActiveOrganisation(org.id, space.id)`. The spaces are fetched lazily — use a sub-component `OrgSpaceSubmenu` that calls `useSpaces(org.id)` only when the submenu is opened (use `open` state on `DropdownMenuSub`).
- **Active indicator**: show a checkmark on the org row if `activeOrgId === org.id`. Show a checkmark on the space row if `activeSpaceId === space.id`.
- **Subtitle** under user name: `activeSpace?.name ?? activeOrg?.name ?? user email domain`.
- **"Create" button**: opens `<CreateOrganisationDialog>`.
- **"Join" button**: opens `<JoinOrganisationDialog>`.
- Remove `CreateWorkspaceDialog` import.

New `frontend/src/components/org/CreateOrganisationDialog.tsx`
- Single input: org name.
- On submit: calls `useCreateOrganisation` mutation.
- On success: dialog closes, app switches to new org + "General" space automatically (handled inside the mutation's `onSuccess`).
- Loading state on the Create button.
- Wording: "Create Organisation", description: "Give your organisation a name. A default General space will be created for you."

New `frontend/src/components/org/JoinOrganisationDialog.tsx`
- Single input: invite token (paste).
- On submit: calls `useJoinOrganisation` mutation. The mutation needs to know which org to join — the token encodes the `orgId`, so the backend extracts it. The frontend just posts to a generic `POST /api/v1/orgs/join` endpoint (no `:orgId` in the URL — the orgId comes from the token).
  - **Note**: this means Phase A needs a top-level `POST /api/v1/orgs/join` route (not nested under `:orgId`) so the frontend doesn't need to know the orgId before joining.
- On success: dialog closes, app switches to the joined org + its default space.
- Wording: "Join Organisation", description: "Paste an invitation token to join an existing organisation."

`frontend/src/components/workspace/InvitePage.tsx`
- Update to call `POST /api/v1/orgs/join` with the token from the URL param.
- On success: call `setActiveOrganisation(orgId, spaceId)` from `AppContext`.
- Update all user-facing strings from "workspace" to "organisation".

**Constraints:**
- The `OrgSpaceSubmenu` sub-component must not call `useSpaces` until the submenu is actually opened, to avoid N+1 queries for every org in the list.
- The sidebar must not crash when `organisations` is an empty array.
- The sidebar must not crash when `spaces` for an org is still loading.
- `WorkspaceSwitcher.tsx` is not rendered anywhere in the main app — leave it untouched in this phase (deleted in Phase E).

**Acceptance Criteria:**
- [ ] Sidebar section label reads "Organisation".
- [ ] Sidebar lists organisations from `AppContext`, not workspaces.
- [ ] Hovering/clicking an org row reveals a space sub-menu with that org's spaces.
- [ ] Selecting a space from the sub-menu calls `setActiveOrganisation(orgId, spaceId)` and switches the app.
- [ ] Active org has a checkmark; active space within it has a checkmark.
- [ ] Subtitle under user name shows active space name (or org name if no space, or email if no org).
- [ ] "Create" opens `CreateOrganisationDialog`. Submitting creates an org and switches to it.
- [ ] "Join" opens `JoinOrganisationDialog`. Submitting joins an org and switches to it.
- [ ] User with no orgs sees empty org list with only Join/Create buttons — no crash.
- [ ] `AppSidebar` no longer imports `useWorkspace` or `WorkspaceContext`.
- [ ] TypeScript build passes.

---

### Phase D — Frontend UI: Settings, Chat, Assignee Pickers

**What changes:**

`frontend/src/components/SettingsDialog.tsx`
- `WorkspaceSettingsTab` → rename to `OrganisationSettingsTab`:
  - Replace `useWorkspace()` with `useAppContext()`.
  - Show `activeOrg?.name`, `activeOrg?.id`, and the user's role from `activeOrg?.role`.
  - Update nav item label: `"Workspace settings"` → `"Organisation settings"`.
  - Update nav item id: `"workspaceSettings"` → `"organisationSettings"`.
  - Guard: if `activeOrg` is null (personal mode), show a placeholder "No organisation selected".
- `MembersTab`:
  - Replace `useWorkspace()` with `useAppContext()`.
  - Replace `useWorkspaceMembers(workspaceId)` with two queries:
    - Org members: `useOrgMembers(activeOrgId)` — new hook calling `GET /api/v1/orgs/:orgId/members` (added in Phase A).
    - Space members: `useSpaceMembers(activeOrgId, activeSpaceId)` (already exists).
  - Show both in two clearly labelled sub-sections: "Organisation Members" and "Space Members".
  - Replace `useCreateInviteLink` (workspace) with `useCreateOrgInvite` (org-scoped, added in Phase B).
- Remove `import { useWorkspace }` from `SettingsDialog.tsx`.

`frontend/src/components/ChatDialog.tsx`
- Remove `import { useWorkspace }` and `import { useWorkspaceMembers }`.
- Add `const { activeOrgId, activeSpaceId } = useAppContext()`.
- Replace `useWorkspaceMembers(workspaceId)` with `useSpaceMembers(activeOrgId, activeSpaceId)` for the "new DM" user list.
- Pass `activeOrgId` and `activeSpaceId` to all chat hooks: `useChatChannels(activeOrgId, activeSpaceId)`, `useReadChannel(activeOrgId, activeSpaceId)`, `useOpenDM(activeOrgId, activeSpaceId)`, `useCreateGroup(activeOrgId, activeSpaceId)`, `useChatSocketListeners(activeChannelId, activeOrgId, activeSpaceId)`.
- Member shape change: `SpaceMember` has `user_id` (not `user.id`), `name`, `email`. Update the DM user list filter and render accordingly.

`frontend/src/components/tasks/OverviewTab.tsx`
- Remove `import { useWorkspaceMembers }`.
- Add `const { activeOrgId, activeSpaceId, mode } = useAppContext()`.
- Replace `useWorkspaceMembers(task.workspace_id)` with `useSpaceMembers(activeOrgId, activeSpaceId)`.
- Guard: if `mode === "personal"`, pass `null, null` to `useSpaceMembers` (hook disabled) and hide the assignee section entirely.
- Member shape: update to use `member.user_id` instead of `member.user.id`, `member.name` instead of `member.user.name`.

`frontend/src/components/tasks/ActivityTab.tsx`
- Same changes as `OverviewTab`.

`frontend/src/components/tasks/EventOverviewTab.tsx`
- Same changes as `OverviewTab`.

`frontend/src/components/TasksPage.tsx`
- Replace `useWorkspaceMembers(orgTasks?.[0]?.workspace_id)` with `useSpaceMembers(activeOrgId, activeSpaceId)`.
- Update `workspaceMembers` mapping to use `member.user_id`, `member.name`, `member.email`.

**Additional backend endpoint needed (add to Phase A):**
- `GET /api/v1/orgs/:orgId/members` — returns all org members with their roles. Add to `org.routes.ts`, `organisation.controller.ts`, `organisation.service.ts`, `organisation.repository.ts`.

**Constraints:**
- In personal mode, assignee pickers must be hidden (not just empty) — do not render the section at all.
- `SpaceMember` shape (`{ user_id, role, name, email }`) differs from `WorkspaceMember` shape (`{ user: { id, name, email }, role }`). Every call site must be updated — do not mix the two shapes.
- Chat must remain fully functional in org mode after this change.
- Settings must not crash when `activeOrg` is null (user in personal mode).

**Acceptance Criteria:**
- [ ] Settings "Organisation settings" tab shows active org name, ID, and user's role.
- [ ] Settings "Members" tab shows org members and space members in two sub-sections.
- [ ] Settings "Members" tab shows an org invite link generator.
- [ ] Chat DM user list shows only space members of the active space.
- [ ] Assignee picker in task detail shows space members in org mode, is hidden in personal mode.
- [ ] `SettingsDialog`, `ChatDialog`, `OverviewTab`, `ActivityTab`, `EventOverviewTab`, `TasksPage` no longer import `useWorkspace` or `useWorkspaceMembers`.
- [ ] TypeScript build passes.

---

### Phase E — Cleanup: Remove WorkspaceContext

> Only execute after Phases A–D are complete and verified. Run `grep -r "useWorkspace\|WorkspaceContext\|WorkspaceProvider" frontend/src` first — it must return zero results outside of the files being deleted.

**What changes:**
- `frontend/src/contexts/WorkspaceContext.tsx` — delete.
- `frontend/src/hooks/api/useWorkspace.ts` — delete entirely. `useJoinWorkspace` and `useCreateInviteLink` are replaced by the new org hooks from Phase B.
- `frontend/src/main.tsx` — remove `<WorkspaceProvider>` wrapper and its import.
- `frontend/src/components/workspace/WorkspaceSwitcher.tsx` — delete (not rendered anywhere in the main app).
- `frontend/src/components/workspace/CreateWorkspaceDialog.tsx` — delete (replaced by `CreateOrganisationDialog`).
- `frontend/src/contexts/AppContext.tsx` — rename `setWorkspaceMode` to `setOrganisationMode` everywhere in the file. Update the `AppContextType` interface accordingly.
- All call sites of `setWorkspaceMode` (currently only `AppSidebar.tsx`, already updated in Phase C) — rename to `setOrganisationMode`.
- `frontend/src/contexts/AppContext.tsx` — add a one-time localStorage cleanup on mount: `localStorage.removeItem("keil_active_workspace")`.

**Constraints:**
- Do not delete any file until the grep above confirms zero remaining imports.
- The legacy backend routes (`v1/workspaces`, `v1/tasks`) are NOT removed — they stay as compatibility routes indefinitely until a separate backend cleanup phase.
- Do not touch `backend/` in this phase.

**Acceptance Criteria:**
- [ ] `grep -r "useWorkspace\|WorkspaceContext\|WorkspaceProvider\|keil_active_workspace\|setWorkspaceMode" frontend/src` returns zero results.
- [ ] Frontend TypeScript build passes with no errors.
- [ ] All existing functionality works: personal tasks, org tasks, chat, dashboard, settings, assignee pickers, Google Calendar connector.
- [ ] No runtime errors in browser console on fresh load.

---

### Phase F — Verification

**Manual QA checklist (must pass before marking complete):**
- [ ] New user signup → lands in personal mode, no org, no crash.
- [ ] Personal task create/edit/delete/status change works.
- [ ] Create organisation → org appears in sidebar dropdown, mode switches to org, "General" space is auto-selected.
- [ ] Create space inside org (via Settings) → space appears in the org's space sub-menu.
- [ ] Org invite link generated in Settings → another user can paste the token in "Join Organisation" dialog and join.
- [ ] Joined user appears in org members list and General space members list.
- [ ] Org task create/edit/delete/status change works inside active space.
- [ ] Assignee picker shows only space members in org mode.
- [ ] Assignee picker is hidden in personal mode.
- [ ] Assigning a user outside the space is rejected by the backend with a clear error.
- [ ] Chat opens only in org mode with active space.
- [ ] DM user list shows only space members of the active space.
- [ ] Switching org (via sidebar sub-menu) clears active space and auto-selects first available space of the new org.
- [ ] Switching space (via sidebar sub-menu) changes task list, dashboard, and chat channels.
- [ ] Dashboard shows data for active org+space in org mode.
- [ ] Settings "Organisation settings" shows correct org name, ID, and user role.
- [ ] Settings "Members" tab shows org members and space members in two sub-sections.
- [ ] Google Calendar connector still works.
- [ ] Sidebar subtitle shows active space name (or org name if no space, or email if no org).
- [ ] No "Workspace" terminology visible anywhere in the UI.
- [ ] No `keil_active_workspace` key in localStorage after first load.
- [ ] Backend TypeScript build passes.
- [ ] Frontend TypeScript build passes.

---

## Files That Will Change

### Backend (Phase A)
| File | Change |
|---|---|
| `backend/src/controllers/organisation.controller.ts` | Add `createOrganisation`, `createOrgInvite`, `joinOrg`, `getOrgMembers` |
| `backend/src/controllers/space.controller.ts` | Add `createSpace` |
| `backend/src/services/organisation.service.ts` | Add `createOrganisation`, `generateInviteToken`, `joinOrganisation`, `getOrgMembers` |
| `backend/src/services/space.service.ts` | Add `createSpace` |
| `backend/src/repositories/organisation.repository.ts` | Add `create()`, `findMembers()` |
| `backend/src/repositories/space.repository.ts` | Add `create()`, `findDefaultSpace()` |
| `backend/src/routes/org.routes.ts` | Add `POST /`, `POST /:orgId/spaces`, `POST /:orgId/invite`, `POST /join` (top-level), `GET /:orgId/members` |

### Frontend
| File | Phase | Change |
|---|---|---|
| `frontend/src/hooks/api/useOrganisations.ts` | B | Add `useCreateOrganisation`, `useCreateOrgInvite`, `useJoinOrganisation`, `useOrgMembers` |
| `frontend/src/hooks/api/useSpaces.ts` | B | Add `useCreateSpace` |
| `frontend/src/hooks/api/useChat.ts` | B | Full migration: remove `useWorkspace`, parameterise all hooks with `orgId`/`spaceId`, update `chatKeys`, update API URLs |
| `frontend/src/hooks/api/useDashboard.ts` | B | Remove `useWorkspace` from `useDashboard()` |
| `frontend/src/components/AppSidebar.tsx` | C | Remove workspace, add org list with space sub-menus, new dialogs |
| New `frontend/src/components/org/CreateOrganisationDialog.tsx` | C | New file |
| New `frontend/src/components/org/JoinOrganisationDialog.tsx` | C | New file |
| `frontend/src/components/workspace/InvitePage.tsx` | C | Update to org invite flow |
| `frontend/src/components/SettingsDialog.tsx` | D | Rename workspace tab, migrate members tab to org+space members |
| `frontend/src/components/ChatDialog.tsx` | D | Remove `useWorkspace`, use `useAppContext` + `useSpaceMembers` |
| `frontend/src/components/tasks/OverviewTab.tsx` | D | Replace `useWorkspaceMembers` with `useSpaceMembers` |
| `frontend/src/components/tasks/ActivityTab.tsx` | D | Replace `useWorkspaceMembers` with `useSpaceMembers` |
| `frontend/src/components/tasks/EventOverviewTab.tsx` | D | Replace `useWorkspaceMembers` with `useSpaceMembers` |
| `frontend/src/components/TasksPage.tsx` | D | Replace `useWorkspaceMembers` with `useSpaceMembers` |
| `frontend/src/contexts/AppContext.tsx` | E | Rename `setWorkspaceMode` → `setOrganisationMode`, add localStorage cleanup |
| `frontend/src/contexts/WorkspaceContext.tsx` | E | **Delete** |
| `frontend/src/hooks/api/useWorkspace.ts` | E | **Delete** |
| `frontend/src/components/workspace/WorkspaceSwitcher.tsx` | E | **Delete** |
| `frontend/src/components/workspace/CreateWorkspaceDialog.tsx` | E | **Delete** |
| `frontend/src/main.tsx` | E | Remove `<WorkspaceProvider>` |

---

## Stop Conditions

- Stop if `POST /api/v1/orgs` cannot atomically create an org + default space + add the owner as a member in a single transaction.
- Stop if removing `WorkspaceContext` breaks any component that hasn't been migrated yet.
- Stop if chat stops working after the `useChat` migration.
- Stop if personal tasks become inaccessible after any change.
- Stop if the assignee picker starts showing users from outside the active space.
