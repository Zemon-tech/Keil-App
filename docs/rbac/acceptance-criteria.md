# RBAC Acceptance & Testing Criteria

This document provides a comprehensive list of **Acceptance Criteria (AC)** and manual verification procedures to ensure that the two-tier Role-Based Access Control (RBAC) system functions correctly across the database, backend services, and client interfaces.

---

## 1. Database Schema & Migration Verification

| Test Reference | Objective | Action / Verification Query | Expected Result |
| :--- | :--- | :--- | :--- |
| **AC-1.1** | Role Enum Coverage | Run: `SELECT enumlabel FROM pg_enum WHERE enumtypid = 'public.member_role'::regtype;` | The database type supports both `manager` and `admin` roles. |
| **AC-1.2** | Legacy Role Cleanup | Run: `SELECT * FROM public.space_members WHERE role = 'owner';` | Returns 0 rows (confirming all space memberships were migrated to `admin`). |
| **AC-1.3** | Single Default Space | Attempt to manually set `is_default = TRUE` on two active spaces within the same organization. | The database engine rejects the command with a unique constraint error on `idx_spaces_one_default_per_org`. |

---

## 2. Organisation-Level Authorization (Org Scope)

### Test Role: Organisation Owner / Organisation Admin
* **AC-2.1: Member Invitations**
  * **Procedure**: Navigate to **Settings → Members** and click **Invite Member**.
  * **Expected Result**: The invitation link dialog appears, and generating a link completes successfully with a valid token returned.
* **AC-2.2: Space Life-Cycle**
  * **Procedure**: Navigate to **Settings → Spaces** and attempt to create a space, rename a space, archive (soft-delete) a space, and restore a space.
  * **Expected Result**: All actions are allowed, and changes persist immediately.

### Test Role: Organisation Member
* **AC-2.3: Gated Settings UI**
  * **Procedure**: Navigate through Settings panels.
  * **Expected Result**: Invitation triggers, member role selectors, and space creation/modification buttons are completely hidden or disabled.
* **AC-2.4: API Boundary Gating**
  * **Procedure**: Issue a direct `POST` request to `/api/organisations/:orgId/invite` or `/api/organisations/:orgId/spaces` using the Org Member's JWT session.
  * **Expected Result**: The server terminates the request with a `403 Forbidden` response and logs a warning: `[rbac] DENIED userId=...`.

---

## 3. Space-Level Authorization (Space Scope)

### Test Role: Space Admin
* **AC-3.1: Space Member Role Updates**
  * **Procedure**: Open the Space Settings members manager (in the **Spaces Tab** or **Settings Dialog**). Select a space member and update their role (e.g. from `member` to `manager`).
  * **Expected Result**: Dropdown selects the new role, the API request succeeds, and the member lists reload in real-time.
* **AC-3.2: Self-Demotion Prevention Guard**
  * **Procedure**: Locate yourself (the active Space Admin) in the space members list and attempt to demote yourself or click the remove button.
  * **Expected Result**: The controls are disabled or hidden, preventing lockouts.
* **AC-3.3: Peer-Demotion Protection Guard**
  * **Procedure**: Log in as a Space Admin who does not hold an Org Owner/Admin role. Try to demote another Space Admin in the members list.
  * **Expected Result**: The popover or button is disabled, protecting space admins from peer demotions.
* **AC-3.4: Comment Deletion Override**
  * **Procedure**: Navigate to a task containing comments written by other users. Click the trash icon on another user's comment.
  * **Expected Result**: Comment deletion succeeds.
* **AC-3.4b: Motion Page Override**
  * **Procedure**: Open a Motion Page in the space created by another user (e.g. a Space Manager or Member). Try to edit it.
  * **Expected Result**: Space Admin has full override capabilities and can edit any document in the space, regardless of who created it.

---

### Test Role: Space Manager
* **AC-3.5: Task & Attributes Control**
  * **Procedure**: Locate a task and attempt to: (a) Edit its title, description, priority, and dates, and (b) Add or remove assignees.
  * **Expected Result**: Inputs are fully interactive, and changes save automatically.
* **AC-3.6: Status Transitions**
  * **Procedure**: Transition any task in the space across status columns.
  * **Expected Result**: Status changes execute successfully.
* **AC-3.7: Motion Document Creation & Editing (Ownership Lockout)**
  * **Procedure**: 
    * (a) Click the `+` icon in the Motion sidebar to create a page, and type inside the document editor. (Succeeds)
    * (b) Open an existing Motion Page created by *another* user. (The editor is read-only, hide toolbar/controls).
  * **Expected Result**: 
    * Creating and editing pages owned by self succeed.
    * Editing other users' pages is strictly locked (TipTap editor is set to `editable: false`, and cover/title selectors are hidden).
* **AC-3.8: Operations Restrictions**
  * **Procedure**: Open Space Settings and try to modify a member's role, or try to delete another user's task comment.
  * **Expected Result**: Dropdowns and trash icons are completely hidden.

---

### Test Role: Space Member
* **AC-3.9: Read-Only Tasks UI**
  * **Procedure**: Open a task details panel.
  * **Expected Result**:
    * The "+ Create Task" actions are hidden.
    * The Title, Description, Priority, and Due Date inputs are disabled/read-only.
    * The Assignees selection popover is disabled.
* **AC-3.10: Status Gate Exception**
  * **Procedure**: Attempt to transition a task's status where: (a) You are an assignee, and (b) You are *not* an assignee.
  * **Expected Result**: The status dropdown is enabled only on tasks you are assigned to. It is locked/disabled for unassigned tasks.
* **AC-3.11: Comment Operations**
  * **Procedure**: Submit a comment under a task, then try to delete it. Afterwards, locate a comment written by a colleague.
  * **Expected Result**: You can write and delete your own comments. Colleagues' comments do not display a delete trash icon.
* **AC-3.12: Read-Only Documents (Motion)**
  * **Procedure**: Open the Motion documents workspace.
  * **Expected Result**:
    * The `+` (add page) icon in the sidebar is hidden.
    * opening any page loads the TipTap rich text editor in a secure read-only mode (`editable: false`).
    * Cover selection tools, text formatting headers, and sharing menus are hidden.

---

## 4. Invite & Onboarding Flows

| Test Reference | Objective | Action / Verification Flow | Expected Result |
| :--- | :--- | :--- | :--- |
| **AC-4.1** | Join Scope & Isolation | Log in as an Org Admin and generate an invitation token. Log out and go through the signup/join flow with a new user account. | 1. The user profile is created under `public.users`. <br>2. The user is added to `public.organisation_members` with the role `'member'`. <br>3. The user is **only** added to the designated default space (`is_default = TRUE`) in `public.space_members` with the role `'member'`. <br>4. The user is **not** added to any other active spaces in the organisation. |

