# Space Management

> Status: **APPROVED — ready for implementation, phase by phase**
> Scope: Full CRUD for spaces (create already exists), rename, soft-delete with restore/hard-delete, member add/remove. Backend + frontend.

---

## Decisions

| # | Decision |
|---|---|
| Rename | Included. Owner/admin only. |
| Delete | Soft delete (`deleted_at`). Cascade deletes tasks, channels, activity, space_members. Last space in org is not deletable. |
| Delete warning | Confirmation dialog listing what will be lost. |
| Soft-deleted spaces | Visible to org owner/admin only. Can restore or permanently hard-delete. |
| Active space deleted | Auto-switch to first remaining space in org. |
| Who can manage spaces | Org `owner` or `admin` only (same as create). |
| Add member to space | User must already be an org member. Picker shows org members not yet in the space. Role always `member`. |
| Remove member from space | Removes from space only. Org owner/admin only. |
| Self-removal | Not allowed. |
| Frontend location | Settings → new "Spaces" tab. List of all org spaces on left, detail panel on right. |
| Optimistic UI | Rename updates the UI instantly before server confirms. |

---

## Current State (What Already Exists)

**Backend:**
- `POST /api/v1/orgs/:orgId/spaces` — create space ✅
- `GET /api/v1/orgs/:orgId/spaces` — list visible (non-deleted) spaces ✅
- `GET /api/v1/orgs/:orgId/spaces/:spaceId/members` — list members ✅
- `spaceRepository.addMember()` — adds a member ✅
- `spaceRepository.findMembers()` — lists members ✅

**Missing:** rename, delete, restore, hard-delete, remove member, list deleted spaces.

**Frontend:**
- `useSpaces(orgId)` — fetches visible spaces ✅
- `useSpaceMembers(orgId, spaceId)` — fetches members ✅
- `useCreateSpace(orgId)` — creates space ✅
- Settings has "Organisation settings" and "Members" tabs ✅

**Missing:** `useRenameSpace`, `useDeleteSpace`, `useRestoreSpace`, `useHardDeleteSpace`, `useAddSpaceMember`, `useRemoveSpaceMember`, `useDeletedSpaces`. No Spaces tab in Settings.

---

## Non-Negotiable Constraints

- Never delete the last space in an org — return 400.
- Soft delete only from the user-facing delete action. Hard delete is a separate explicit action.
- Cascade on soft delete: set `deleted_at` on `tasks`, `channels`, `activity_logs` that belong to the space. Do NOT delete `space_members` rows on soft delete (needed for restore).
- Cascade on hard delete: permanently remove all space data including `space_members`, `tasks`, `channels`, `activity_logs`, `comments`, `task_assignees`, `task_dependencies`.
- Only org `owner` or `admin` can rename, delete, restore, hard-delete, add/remove members.
- Add member: target user must already be in `organisation_members`.
- Remove member: cannot remove yourself.
- Soft-deleted spaces are excluded from `GET /api/v1/orgs/:orgId/spaces` (existing query already filters `deleted_at IS NULL`).
- Soft-deleted spaces are returned by a new `GET /api/v1/orgs/:orgId/spaces/deleted` endpoint, visible only to org owner/admin.
- If the active space is deleted, `AppContext` must auto-switch to the first remaining non-deleted space.
- Do not break `useSpaces`, `useSpaceMembers`, `useChatChannels`, `useOrgDashboard`, or any existing hook that reads space data.

---

## Phase A — Backend

### A1 — Repository additions (`space.repository.ts`)

- `rename(spaceId, name, client?)` — `UPDATE spaces SET name=$1 WHERE id=$2 RETURNING *`
- `softDelete(spaceId, client)` — sets `deleted_at = NOW()` on the space row
- `restore(spaceId, client)` — sets `deleted_at = NULL`
- `hardDelete(spaceId, client)` — `DELETE FROM spaces WHERE id=$1`
- `findDeletedByOrg(orgId, client?)` — spaces where `org_id=$1 AND deleted_at IS NOT NULL`
- `countActiveByOrg(orgId, client?)` — count of spaces where `org_id=$1 AND deleted_at IS NULL`
- `removeMember(spaceId, userId, client)` — `DELETE FROM space_members WHERE space_id=$1 AND user_id=$2`

### A2 — Service additions (`space.service.ts`)

All service functions check caller role via `organisationRepository.getMemberRole(orgId, userId)` and throw `403` if not `owner` or `admin`.

- `renameSpace(orgId, spaceId, userId, name)` — validates, calls `repo.rename()`
- `deleteSpace(orgId, spaceId, userId)`:
  1. Check caller is owner/admin.
  2. `countActiveByOrg` — if count is 1, throw `400 "Cannot delete the last space"`.
  3. In a transaction: soft-delete the space, then soft-delete all `tasks`, `channels`, `activity_logs` with `space_id = spaceId` (set their `deleted_at`).
- `restoreSpace(orgId, spaceId, userId)` — validates, calls `repo.restore()`, then restores `tasks`/`channels`/`activity_logs` that were deleted at the same time (match on `deleted_at` timestamp within a 1-second window, or store the deletion timestamp and use it).
  - **Simpler approach**: restore the space row only. Tasks/channels remain soft-deleted — user can decide to restore them separately. Document this behaviour clearly.
  - **Use the simpler approach** to avoid complexity.
- `hardDeleteSpace(orgId, spaceId, userId)` — validates, checks space is already soft-deleted (throw `400` if not), runs a transaction that deletes all child data then the space row.
- `getDeletedSpaces(orgId, userId)` — validates caller is owner/admin, calls `repo.findDeletedByOrg()`.
- `addSpaceMember(orgId, spaceId, userId, targetUserId)`:
  1. Validate caller is org owner/admin.
  2. Check `targetUserId` is in `organisation_members` — throw `400 "User is not an org member"` if not.
  3. Call `repo.addMember(orgId, spaceId, targetUserId, 'member', client)`.
- `removeSpaceMember(orgId, spaceId, userId, targetUserId)`:
  1. Validate caller is org owner/admin.
  2. Prevent `userId === targetUserId` — throw `400 "Cannot remove yourself"`.
  3. `DELETE FROM space_members WHERE space_id=$1 AND user_id=$2`.

### A3 — Controller additions (`space.controller.ts`)

- `renameSpace` — `PATCH /orgs/:orgId/spaces/:spaceId` with `{ name }`
- `deleteSpace` — `DELETE /orgs/:orgId/spaces/:spaceId`
- `restoreSpace` — `POST /orgs/:orgId/spaces/:spaceId/restore`
- `hardDeleteSpace` — `DELETE /orgs/:orgId/spaces/:spaceId/permanent`
- `getDeletedSpaces` — `GET /orgs/:orgId/spaces/deleted`
- `addSpaceMember` — `POST /orgs/:orgId/spaces/:spaceId/members` with `{ user_id }`
- `removeSpaceMember` — `DELETE /orgs/:orgId/spaces/:spaceId/members/:userId`

### A4 — Route additions (`org.routes.ts`)

```
PATCH   /:orgId/spaces/:spaceId                    requireOrgMember + requireSpaceMember → renameSpace
DELETE  /:orgId/spaces/:spaceId                    requireOrgMember + requireSpaceMember → deleteSpace
POST    /:orgId/spaces/:spaceId/restore            requireOrgMember → restoreSpace
DELETE  /:orgId/spaces/:spaceId/permanent          requireOrgMember → hardDeleteSpace
GET     /:orgId/spaces/deleted                     requireOrgMember → getDeletedSpaces
POST    /:orgId/spaces/:spaceId/members            requireOrgMember + requireSpaceMember → addSpaceMember
DELETE  /:orgId/spaces/:spaceId/members/:userId    requireOrgMember + requireSpaceMember → removeSpaceMember
```

**Route ordering note:** `GET /:orgId/spaces/deleted` must be registered **before** `GET /:orgId/spaces/:spaceId/members` to prevent Express treating `"deleted"` as a `spaceId`.

### A5 — Acceptance Criteria

- [ ] `PATCH /spaces/:spaceId` renames the space. Returns 403 for non-owner/admin.
- [ ] `DELETE /spaces/:spaceId` soft-deletes. Returns 400 if it's the last space.
- [ ] `GET /spaces/deleted` returns soft-deleted spaces. Returns 403 for plain members.
- [ ] `POST /spaces/:spaceId/restore` restores the space row.
- [ ] `DELETE /spaces/:spaceId/permanent` hard-deletes. Returns 400 if space is not soft-deleted first.
- [ ] `POST /spaces/:spaceId/members` adds an org member to the space. Returns 400 if target is not an org member.
- [ ] `DELETE /spaces/:spaceId/members/:userId` removes a member. Returns 400 on self-removal.
- [ ] Backend TypeScript build passes.

---

## Phase B — Frontend Hooks (`useSpaces.ts`)

Add the following mutations. All invalidate `spaceKeys.list(orgId)` on success.

- `useRenameSpace(orgId)` — `PATCH /orgs/:orgId/spaces/:spaceId` with `{ name }`. **Optimistic update**: immediately update the space name in the `spaceKeys.list(orgId)` cache before the request resolves. Roll back on error.
- `useDeleteSpace(orgId)` — `DELETE /orgs/:orgId/spaces/:spaceId`. On success, also invalidates `spaceKeys.deleted(orgId)`.
- `useRestoreSpace(orgId)` — `POST /orgs/:orgId/spaces/:spaceId/restore`. Invalidates both `spaceKeys.list(orgId)` and `spaceKeys.deleted(orgId)`.
- `useHardDeleteSpace(orgId)` — `DELETE /orgs/:orgId/spaces/:spaceId/permanent`. Invalidates `spaceKeys.deleted(orgId)`.
- `useDeletedSpaces(orgId)` — `GET /orgs/:orgId/spaces/deleted`. Query key: `spaceKeys.deleted(orgId)`.
- `useAddSpaceMember(orgId, spaceId)` — `POST /orgs/:orgId/spaces/:spaceId/members`. Invalidates `spaceKeys.members(orgId, spaceId)`.
- `useRemoveSpaceMember(orgId, spaceId)` — `DELETE /orgs/:orgId/spaces/:spaceId/members/:userId`. Invalidates `spaceKeys.members(orgId, spaceId)`.

Add to `spaceKeys`:
```ts
deleted: (orgId: string) => [...spaceKeys.all, orgId, "deleted"] as const,
```

**Active space fallback** — in `useDeleteSpace.onSuccess`: if the deleted space was the active space (`activeSpaceId === spaceId`), call `setActiveOrganisation(orgId)` with no `lastSpaceId`. `AppContext` will auto-select the first remaining space.

**Acceptance Criteria:**
- [ ] `useRenameSpace` updates the space name in the cache instantly (optimistic).
- [ ] `useDeleteSpace` removes the space from the active list and triggers active-space fallback if needed.
- [ ] `useDeletedSpaces` returns soft-deleted spaces.
- [ ] `useRestoreSpace` and `useHardDeleteSpace` invalidate the correct caches.
- [ ] `useAddSpaceMember` and `useRemoveSpaceMember` invalidate `spaceKeys.members`.
- [ ] TypeScript build passes.

---

## Phase C — Frontend UI: Settings → Spaces Tab

### C1 — Add "Spaces" nav item to `SettingsDialog.tsx`

Add to `settingsNavItems`:
```ts
{ id: "spaces", label: "Spaces", icon: Layers, group: "workspace" }
```
Add `"spaces"` to the `SettingsTab` union type. Add `spaces: SpacesTab` to `tabContent`.

### C2 — `SpacesTab` component (new file: `frontend/src/components/settings/SpacesTab.tsx`)

**Layout:** Two-column. Left: space list. Right: detail panel for the selected space.

**Left panel — Space list:**
- Reads `useSpaces(activeOrgId)` for active spaces.
- Reads `useDeletedSpaces(activeOrgId)` for soft-deleted spaces (only if caller is org owner/admin — check `activeOrg.role`).
- Each active space row: space name, member count badge, click to select.
- Selected space row is highlighted.
- Soft-deleted spaces shown in a separate "Deleted" section below, visually dimmed, with a "Restore" button and a "Delete permanently" button inline.
- "Create Space" button at the top (calls `useCreateSpace`, already exists).
- Guard: if `mode !== "organisation" || !activeOrg` show empty state "No organisation selected".

**Right panel — Space detail:**
- Shown when a space is selected from the left list.
- Empty state when nothing is selected: "Select a space to manage it."

**Detail panel sections:**

1. **Space name** — inline editable input. On blur or Enter, calls `useRenameSpace`. Shows optimistic update immediately. Only editable if caller is org owner/admin.

2. **Members** — list from `useSpaceMembers(activeOrgId, selectedSpaceId)`. Each row: avatar, name, email, role badge. Remove button (trash icon) per row — calls `useRemoveSpaceMember`. Remove button hidden for the caller's own row and hidden if caller is not owner/admin.

3. **Add member** — shown only to org owner/admin. A searchable combobox/popover that lists org members not already in this space (derive by diffing `useOrgMembers(activeOrgId)` against `useSpaceMembers`). Selecting a user calls `useAddSpaceMember`.

4. **Danger zone** — shown only to org owner/admin. "Delete Space" button — opens a confirmation dialog (see C3). Disabled with tooltip "Cannot delete the last space" if this is the only active space in the org (check `spaces.length === 1`).

### C3 — Delete confirmation dialog

Inline within `SpacesTab` (not a separate file). Uses a `Dialog` from the UI library.

Content:
- Title: "Delete [space name]?"
- Body: "This will permanently archive this space. All tasks, chat channels, and activity in this space will be hidden. This action can be undone from the Deleted section."
- Two buttons: "Cancel" and "Delete Space" (destructive variant, red).
- On confirm: calls `useDeleteSpace`. Dialog closes on success.

### C4 — Hard delete confirmation dialog

Separate `Dialog` triggered from the "Delete permanently" button in the deleted spaces section.

Content:
- Title: "Permanently delete [space name]?"
- Body: "This cannot be undone. All tasks, channels, members, and activity in this space will be permanently removed."
- Two buttons: "Cancel" and "Delete Forever" (destructive).
- On confirm: calls `useHardDeleteSpace`.

### C5 — Active space fallback wiring

`useDeleteSpace` hook (Phase B) handles the `AppContext` fallback. No additional wiring needed in the UI — the sidebar subtitle and space sub-menu will update automatically when `useSpaces` refetches.

**Acceptance Criteria:**
- [ ] "Spaces" tab appears in Settings under the workspace section.
- [ ] Space list shows all active spaces for the active org.
- [ ] Clicking a space opens the detail panel.
- [ ] Renaming a space updates the name instantly (optimistic) and persists.
- [ ] Members list shows all space members with remove buttons.
- [ ] Remove member works. Cannot remove self.
- [ ] Add member picker shows only org members not in the space.
- [ ] Delete button is disabled when only one space exists.
- [ ] Delete opens confirmation dialog. Confirming soft-deletes the space.
- [ ] Deleted spaces section visible to org owner/admin only.
- [ ] Restore button restores the space back to the active list.
- [ ] "Delete permanently" opens hard-delete confirmation. Confirming removes the space.
- [ ] If the active space is deleted, the app auto-switches to the next available space.
- [ ] Non-owner/admin members see the Spaces tab as read-only (no rename, no delete, no add/remove members).
- [ ] Frontend TypeScript build passes.

---

## Files That Will Change

| File | Change |
|---|---|
| `backend/src/repositories/space.repository.ts` | Add `rename`, `softDelete`, `restore`, `hardDelete`, `findDeletedByOrg`, `countActiveByOrg`, `removeMember` |
| `backend/src/services/space.service.ts` | Add `renameSpace`, `deleteSpace`, `restoreSpace`, `hardDeleteSpace`, `getDeletedSpaces`, `addSpaceMember`, `removeSpaceMember` |
| `backend/src/controllers/space.controller.ts` | Add 7 new controller functions |
| `backend/src/routes/org.routes.ts` | Add 7 new routes (mind ordering of `/deleted` before `/:spaceId`) |
| `frontend/src/hooks/api/useSpaces.ts` | Add 7 new hooks + `spaceKeys.deleted` |
| `frontend/src/components/SettingsDialog.tsx` | Add `"spaces"` tab to nav + tab content map |
| New `frontend/src/components/settings/SpacesTab.tsx` | Full Spaces tab component |

---

## Stop Conditions

- Stop if deleting the last space is not blocked at the service layer.
- Stop if hard delete does not run in a transaction.
- Stop if the optimistic rename update causes a cache shape mismatch.
- Stop if the active-space fallback is not triggered when the active space is deleted.
- Stop if non-owner/admin users can access rename/delete/member-management actions.
