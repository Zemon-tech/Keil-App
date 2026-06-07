# Role-Based Access Control (RBAC) Testing Plan

This document defines the comprehensive testing plan and specifications for all role-based permissions and boundaries in the Keil-App codebase, including:
- **Workspace/Organisation Level Roles** (`owner`, `admin`, `member`)
- **Space Level Roles** (`admin`, `manager`, `member`)
- **Group Channel Roles** (`admin`, `member`)
- **Tenancy Boundaries & Ownership Isolation** (Personal tasks, meeting recordings, comments)

Use this document to design and implement unit, integration, and socket tests to ensure our security models remain robust.

---

## Role Permission Matrices

### 1. Workspace / Organisation Level Roles
The organisation level controls top-level structural resources: renaming/deleting the organisation, invitations, and space CRUD.

| Capability | Owner | Admin | Member | DB / Route Level Middleware |
|---|:---:|:---:|:---:|---|
| Rename Organisation | ✅ | ✅ | ❌ | `requireOrgRole("owner", "admin")` |
| Delete Organisation | ✅ | ❌ | ❌ | `requireOrgRole("owner")` |
| Create Org Invite | ✅ | ✅ | ❌ | `requireOrgRole("owner", "admin")` |
| Update Org Member Role | ✅ | ✅ | ❌ | `requireOrgRole("owner", "admin")` |
| Remove Org Member | ✅ | ✅ | ❌ | `requireOrgRole("owner", "admin")` |
| Create Space | ✅ | ✅ | ❌ | `requireOrgRole("owner", "admin")` |
| Rename Space | ✅ | ✅ | ❌ | `requireOrgRole("owner", "admin")` |
| Delete Space | ✅ | ✅ | ❌ | `requireOrgRole("owner", "admin")` |
| Restore / Hard-Delete Space | ✅ | ✅ | ❌ | `requireOrgRole("owner", "admin")` |
| Add / Remove Space Member | ✅ | ✅ | ❌ | `requireOrgRole("owner", "admin")` |

### 2. Space Level Roles
Space roles govern day-to-day work resources (tasks, subtasks, pages, comments) inside a specific workspace space.

| Capability | Admin | Manager | Member | Middleware / Service Constraint |
|---|:---:|:---:|:---:|---|
| Create Task / Assign User | ✅ | ✅ | ❌ | Route: `requireSpaceRole("admin", "manager")` |
| Update / Delete Task | ✅ | ✅ | ❌ | Route: `requireSpaceRole("admin", "manager")` |
| Read Space Tasks / Subtasks | ✅ | ✅ | ✅ | Route: `requireSpaceRole("admin", "manager", "member")` |
| Change Any Task Status | ✅ | ✅ | ❌ | Service: `if (spaceRole === "member") checkAssigned()` |
| Change Assigned Task Status | ✅ | ✅ | ✅ | Service: `taskAssigneeRepository.isAssigned()` |
| Create Motion Page | ✅ | ✅ | ❌ | Route: `requireSpaceRole("admin", "manager")` |
| Read Motion Pages / Trash | ✅ | ✅ | ✅ | Route: `requireSpaceRole("admin", "manager", "member")` |
| Edit Local Page | ✅ | ✅ (Own) | ❌ | Service: `if (spaceRole === "manager") page.created_by === userId` |
| Soft-Delete / Restore Page | ✅ | ✅ (Own) | ❌ | Service: `if (spaceRole === "manager") page.created_by === userId` |
| Permanently Delete Page | ✅ | ✅ (Own) | ❌ | Service: `if (spaceRole === "manager") page.created_by === userId` |
| Share Page (Public/Space) | ✅ | ✅ (Own) | ❌ | Service: `if (spaceRole === "manager") page.created_by === userId` |
| Update / Revoke Page Share | ✅ | ✅ (Own) | ❌ | Service: `if (spaceRole === "manager") page.created_by === userId` |
| Write / Read Chat Messages | ✅ | ✅ | ✅ | Route: `requireSpaceMember` |
| Delete Own Comment | ✅ | ✅ | ✅ | Service: `comment.user_id === userId` |
| Delete Any Comment | ✅ | ❌ | ❌ | Service: `spaceRole === "admin"` |
| Update Space Member Role | ✅ | ❌ | ❌ | Route: `requireSpaceRole("admin")` |

### 3. Channel Level Roles (Group Chat)
Channel level permissions govern chat management within group channels.

| Capability | Channel Admin (Creator) | Channel Member | Controller / Service Constraint |
|---|:---:|:---:|---|
| Send / Read Messages | ✅ | ✅ | `public.channel_members` row check |
| Add Members to Group | ✅ | ❌ | `roleCheck.role === 'admin'` check |
| Remove Members from Group | ✅ | ❌ (Own only) | Admin can remove anyone; members can self-remove |
| Delete Group Channel | ✅ | ❌ | `roleCheck.role === 'admin'` check |

---

## Detailed Test Cases

### I. Backend Route & Integration Tests

#### 1. Organisation & Space Management (`backend/src/routes/__tests__/org.routes.test.ts`)

These tests verify top-level organisation RBAC boundaries.

| # | Route | Method | User Org Role | Expected Result | Assertion Details |
|---|---|---|---|---|---|
| 1 | `/api/v1/orgs/:orgId` | `PATCH` | Owner | 200 OK | Org name updated in database |
| 2 | `/api/v1/orgs/:orgId` | `PATCH` | Admin | 200 OK | Org name updated in database |
| 3 | `/api/v1/orgs/:orgId` | `PATCH` | Member | 403 Forbidden | Name unchanged |
| 4 | `/api/v1/orgs/:orgId` | `DELETE` | Owner | 200 OK | Org marked as soft-deleted (`deleted_at` set) |
| 5 | `/api/v1/orgs/:orgId` | `DELETE` | Admin | 403 Forbidden | Org remains active |
| 6 | `/api/v1/orgs/:orgId` | `DELETE` | Member | 403 Forbidden | Org remains active |
| 7 | `/api/v1/orgs/:orgId/invite` | `POST` | Admin | 201 Created | Invite row inserted with code |
| 8 | `/api/v1/orgs/:orgId/invite` | `POST` | Member | 403 Forbidden | Blocked, no invite row created |
| 9 | `/api/v1/orgs/:orgId/members/:userId` | `PATCH` | Admin | 200 OK | Target user's role updated |
| 10 | `/api/v1/orgs/:orgId/members/:userId` | `PATCH` | Member | 403 Forbidden | Role unchanged |
| 11 | `/api/v1/orgs/:orgId/members/:userId` | `DELETE` | Admin | 200 OK | Target user removed from `organisation_members` |
| 12 | `/api/v1/orgs/:orgId/members/:userId` | `DELETE` | Member | 403 Forbidden | Member remains in org |
| 13 | `/api/v1/orgs/:orgId/spaces` | `POST` | Admin | 201 Created | Space created, creator added as space owner/admin |
| 14 | `/api/v1/orgs/:orgId/spaces` | `POST` | Member | 403 Forbidden | No space created |
| 15 | `/api/v1/orgs/:orgId/spaces/:spaceId` | `PATCH` | Admin | 200 OK | Space name updated |
| 16 | `/api/v1/orgs/:orgId/spaces/:spaceId` | `PATCH` | Member | 403 Forbidden | Space name unchanged |
| 17 | `/api/v1/orgs/:orgId/spaces/:spaceId` | `DELETE` | Admin | 200 OK | Space soft-deleted (`deleted_at` set) |
| 18 | `/api/v1/orgs/:orgId/spaces/:spaceId` | `DELETE` | Member | 403 Forbidden | Space remains active |
| 19 | `/api/v1/orgs/:orgId/spaces/:spaceId/restore` | `POST` | Admin | 200 OK | Space restored (`deleted_at` is null) |
| 20 | `/api/v1/orgs/:orgId/spaces/:spaceId/restore` | `POST` | Member | 403 Forbidden | Space remains deleted |
| 21 | `/api/v1/orgs/:orgId/spaces/:spaceId/permanent` | `DELETE` | Admin | 200 OK | Space row removed from DB completely |
| 22 | `/api/v1/orgs/:orgId/spaces/:spaceId/permanent` | `DELETE` | Member | 403 Forbidden | Row remains in DB |
| 23 | `/api/v1/orgs/:orgId/spaces/:spaceId/members` | `POST` | Admin | 200 OK | User added to `space_members` |
| 24 | `/api/v1/orgs/:orgId/spaces/:spaceId/members` | `POST` | Member | 403 Forbidden | User not added |
| 25 | `/api/v1/orgs/:orgId/spaces/:spaceId/members/:userId` | `PATCH` | Space Admin | 200 OK | Space member's role updated |
| 26 | `/api/v1/orgs/:orgId/spaces/:spaceId/members/:userId` | `PATCH` | Space Manager | 403 Forbidden | Space member role unchanged |

---

#### 2. Org Tasks Management (`backend/src/routes/__tests__/org-task.routes.test.ts`)

Ensures task creation, modifications, assignees, and comment rules are tested.

| # | Endpoint | Method | User Space Role | Condition | Expected Result |
|---|---|---|---|---|---|
| 1 | `/` | `POST` | Manager | Valid data | 201 Created (task matches payload) |
| 2 | `/` | `POST` | Member | Valid data | 403 Forbidden (members cannot create tasks) |
| 3 | `/:id` | `PATCH` | Manager | Valid updates | 200 OK (task details updated) |
| 4 | `/:id` | `PATCH` | Member | Valid updates | 403 Forbidden (members cannot update tasks) |
| 5 | `/:id` | `DELETE` | Manager | Local task | 200 OK (task soft-deleted) |
| 6 | `/:id` | `DELETE` | Member | Local task | 403 Forbidden |
| 7 | `/:id/status` | `PATCH` | Member | Unassigned task | 403 Forbidden ("Members can only change status of tasks assigned to them") |
| 8 | `/:id/status` | `PATCH` | Member | Assigned task | 200 OK (status updated successfully) |
| 9 | `/:id/status` | `PATCH` | Manager | Unassigned task | 200 OK (managers bypass assignee check) |
| 10 | `/:id/assignees` | `POST` | Manager | Assign a user | 201 Created (user assigned) |
| 11 | `/:id/assignees` | `POST` | Member | Assign a user | 403 Forbidden |
| 12 | `/:id/dependencies` | `POST` | Manager | Add task dependency | 201 Created |
| 13 | `/:id/dependencies` | `POST` | Member | Add task dependency | 403 Forbidden |
| 14 | `/:id/comments/:commentId` | `DELETE` | Member | Comment belongs to other user | 403 Forbidden |
| 15 | `/:id/comments/:commentId` | `DELETE` | Member | Comment belongs to this user | 200 OK (comment hard-deleted) |
| 16 | `/:id/comments/:commentId` | `DELETE` | Space Admin | Comment belongs to other user | 200 OK (admins can delete any comment) |
| 17 | `/:id/comments/:commentId` | `DELETE` | Space Manager | Comment belongs to other user | 403 Forbidden (managers cannot delete others' comments) |

---

#### 3. Motion Pages (`backend/src/routes/__tests__/motion-page.routes.test.ts`)

Motion page capabilities are fine-grained, especially for the `manager` role.

| # | Endpoint | Method | User Space Role | Page Created By | Expected Result | Assertion Details |
|---|---|---|---|---|---|---|
| 1 | `/` | `POST` | Manager | — | 201 Created | Page created with user's ID |
| 2 | `/` | `POST` | Member | — | 403 Forbidden | Blocked, no page created |
| 3 | `/:id` | `PATCH` | Manager | Self | 200 OK | Page fields updated in DB |
| 4 | `/:id` | `PATCH` | Manager | Other User | 403 Forbidden | Blocked, fields unchanged |
| 5 | `/:id` | `PATCH` | Member | — | 403 Forbidden | Blocked, cannot update |
| 6 | `/:id` | `PATCH` | Admin | Other User | 200 OK | Admins can edit any page in the space |
| 7 | `/:id` | `DELETE` | Manager | Self | 200 OK | Page soft-deleted |
| 8 | `/:id` | `DELETE` | Manager | Other User | 403 Forbidden | Page remains active |
| 9 | `/:id/restore` | `PATCH` | Manager | Self | 200 OK | Page restored |
| 10 | `/:id/restore` | `PATCH` | Manager | Other User | 403 Forbidden | Page remains in trash |
| 11 | `/:id/permanent` | `DELETE` | Manager | Self | 200 OK | Page deleted permanently from DB |
| 12 | `/:id/permanent` | `DELETE` | Manager | Other User | 403 Forbidden | Page remains in trash |
| 13 | `/:id/shares` | `POST` | Manager | Self | 201 Created | Page share created |
| 14 | `/:id/shares` | `POST` | Manager | Other User | 403 Forbidden | Share blocked |
| 15 | `/:id/shares/:shareId` | `DELETE` | Manager | Self | 200 OK | Share revoked |
| 16 | `/:id/shares/:shareId` | `DELETE` | Manager | Other User | 403 Forbidden | Share remains active |
| 17 | `/:id/shares` | `POST` | Member | — | 403 Forbidden | Sharing page blocked for members |

---

#### 4. Group Chat Channels (`backend/src/routes/__tests__/org-chat.routes.test.ts`)

Verifies channel-level role restrictions for group chat channels.

| # | Endpoint | Method | Group Channel Role | Action | Expected Result |
|---|---|---|---|---|---|
| 1 | `/channels/:id/members` | `POST` | Admin (Creator) | Invite new members | 200 OK (members added) |
| 2 | `/channels/:id/members` | `POST` | Member | Invite new members | 403 Forbidden |
| 3 | `/channels/:id/members/:userId` | `DELETE` | Admin (Creator) | Kick another member | 200 OK (member kicked) |
| 4 | `/channels/:id/members/:userId` | `DELETE` | Member | Kick another member | 403 Forbidden |
| 5 | `/channels/:id/members/:userId` | `DELETE` | Member | Self-leave (userId matches own) | 200 OK (removed successfully) |
| 6 | `/channels/:id` | `DELETE` | Admin (Creator) | Delete group channel | 200 OK (channel deleted) |
| 7 | `/channels/:id` | `DELETE` | Member | Delete group channel | 403 Forbidden |
| 8 | `/channels/:id/messages` | `GET` | Non-Member | Read messages from channel | 403 Forbidden (blocked if not a channel member) |

---

### II. Backend Socket Integration Tests (`backend/src/__tests__/socket.test.ts`)

Socket.io connects user clients in real-time, matching memberships.

| # | Socket Event | Acting User Context | Target Room/Channel | Expected Result / Assertion |
|---|---|---|---|---|
| 1 | `join_channel` | Space Member | Active channel | Connection successful; user receives messages broadcasted to the room |
| 2 | `join_channel` | Non-Space Member | Active channel | Disallowed; socket join request ignored, client does not receive events |
| 3 | `send_message` | Space Member | Active channel | Broadcasts `receive_message` event containing payload to all members |
| 4 | `send_message` | Non-Space Member | Active channel | Message silently dropped; no broadcast triggers |
| 5 | `typing_start` | Space Member | Active channel | Broadcasts `user_typing` to other members in the room |
| 6 | `typing_start` | Non-Space Member | Active channel | Ignored; no event broadcasted |
| 7 | *(any event)* | Kicked Member | Space channel | Room access immediately revoked / socket connection blocked |

---

### III. Backend Service Unit Tests

#### 1. Org Tasks Service (`backend/src/services/__tests__/org-task.service.test.ts`)

| # | Method | Role Context | Parameter | Condition | Expected Assertion |
|---|---|---|---|---|---|
| 1 | `changeTaskStatus` | Member | `status` | Task is assigned to member | Returns updated task DTO |
| 2 | `changeTaskStatus` | Member | `status` | Task is NOT assigned to member | Throws `ApiError(403)` (insufficient permission) |
| 3 | `changeTaskStatus` | Manager | `status` | Task is NOT assigned to manager | Returns updated task DTO (bypasses check) |

#### 2. Motion Pages Service (`backend/src/services/__tests__/motion-page.service.test.ts`)

| # | Method | Role Context | Parameter | Condition | Expected Assertion |
|---|---|---|---|---|---|
| 1 | `updatePage` | Member | Local Page | Local page edit attempted | Throws `ApiError(403)` (members cannot edit pages) |
| 2 | `updatePage` | Manager | Local Page | Page created by other user | Throws `ApiError(403)` (managers edit own only) |
| 3 | `updatePage` | Manager | Local Page | Page created by self | Returns updated page DTO |
| 4 | `updatePage` | Admin | Local Page | Page created by other user | Returns updated page DTO |
| 5 | `updatePage` | Member | Shared Page | Shared page permission is `VIEW` | Throws `ApiError(403)` (only has view access) |
| 6 | `updatePage` | Manager | Shared Page | Shared page permission is `EDIT_ADMINS` | Throws `ApiError(403)` (admins only) |
| 7 | `updatePage` | Manager | Shared Page | Shared page permission is `EDIT_MANAGERS` | Returns updated page DTO |

#### 3. Comments Service (`backend/src/services/__tests__/comment.service.test.ts`)

| # | Method | Role Context | Comment Owner | Expected Assertion |
|---|---|---|---|---|
| 1 | `hardDeleteComment` | Member | Self | Deletion succeeds; database row removed |
| 2 | `hardDeleteComment` | Member | Other User | Throws `ApiError(403)` (cannot delete others' comments) |
| 3 | `hardDeleteComment` | Manager | Other User | Throws `ApiError(403)` (managers cannot delete others' comments) |
| 4 | `hardDeleteComment` | Admin | Other User | Deletion succeeds; database row removed |

---

### IV. Frontend Unit Tests

#### 1. Hook permissions (`frontend/src/hooks/__tests__/useSpaceRole.test.ts`)

Tests standard mapping capabilities return correct booleans inside `useSpaceRole`.

| # | Input activeSpace.role | Input activeOrg.role | Expected Permissions Mapping |
|---|---|---|---|
| 1 | `member` | `member` | `canCreateTask: false`, `canComment: true`, `canDeleteOwnComment: true`, `canDeleteAnyComment: false`, `canCreatePage: false`, `canEditAnyPage: false`, `canManageSpace: false`, `canManageSpaceMembers: false` |
| 2 | `manager` | `member` | `canCreateTask: true`, `canEditTask: true`, `canDeleteTask: true`, `canAssignTask: true`, `canCreatePage: true`, `canEditAnyPage: false` |
| 3 | `admin` | `member` | `canCreateTask: true`, `canDeleteAnyComment: true`, `canEditAnyPage: true`, `canManageSpaceMembers: true`, `canManageSpace: false` |
| 4 | `member` | `owner` | `canCreateTask: false`, `canManageSpace: true`, `canInviteToOrg: true`, `canManageOrgMembers: true` (Owner overrides org limits, but space limits persist) |
| 5 | `member` | `admin` | `canCreateTask: false`, `canManageSpace: true`, `canInviteToOrg: true`, `canManageOrgMembers: true` |

#### 2. Task permissions (`frontend/src/hooks/__tests__/useTaskPermissions.test.ts`)

Ensures `useTaskPermissions` handles active context matching vs query fallbacks.

| # | Task details | activeOrgId | activeSpace.id | activeSpace.role | Expected resolved spaceRole |
|---|---|---|---|---|---|
| 1 | `{ org_id: "orgA", space_id: "spaceA" }` | `"orgA"` | `"spaceA"` | `"manager"` | `"manager"` (matches active context) |
| 2 | `{ org_id: "orgA", space_id: "spaceB", user_space_role: "admin" }` | `"orgA"` | `"spaceA"` | `"manager"` | `"admin"` (falls back to `user_space_role`) |
| 3 | `{ org_id: "orgB", space_id: "spaceA", user_space_role: "member" }` | `"orgA"` | `"spaceA"` | `"manager"` | `"member"` (org mismatch, falls back) |
| 4 | `null` | `"orgA"` | `"spaceA"` | `"manager"` | `"member"` (default safe fallback) |

---

### V. Data Isolation & Multi-Tenancy Boundary Tests

Role testing must verify user A cannot access user B's data at the cross-tenant boundaries.

#### 1. Personal Tasks isolation (`backend/src/routes/__tests__/personal-task.routes.test.ts`)
- **GET `/:id`**: User B querying User A's task ID must receive `404 Not Found`.
- **PATCH `/:id`**: User B modifying User A's task ID must receive `404 Not Found`.
- **DELETE `/:id`**: User B deleting User A's task ID must receive `404 Not Found`.

#### 2. Meeting Recordings isolation (`backend/src/routes/__tests__/meeting.routes.test.ts`)
- **DELETE `/recording/:id`**: User B attempting to delete User A's recording must return `403 Forbidden` or `404 Not Found`.
- **GET `/history`**: Authenticated User A only receives recordings belonging to User A's user ID. User B's recordings must be absent.
