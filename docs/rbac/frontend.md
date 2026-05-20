# RBAC Frontend Implementation Guide

## Relevant Files

Here is the file structure representing the UI gating and permission hook locations:

```
frontend/src/
├── hooks/
│   └── useSpaceRole.ts              # Centralised hook for role and permission resolution
├── components/
│   ├── SettingsDialog.tsx           # Org settings & space members popovers
│   ├── settings/
│   │   └── SpacesTab.tsx            # Space creation, rename, and members manager
│   ├── tasks/
│   │   ├── OverviewTab.tsx          # Gated task attributes, assignees, and subtasks
│   │   ├── TaskListPane.tsx         # Task creation button and list controls gating
│   │   ├── TaskDetailHeader.tsx     # Task title, priority, status modifications gating
│   │   └── ActivityTab.tsx          # Comment submission and deletion guards
│   └── motion/
│       ├── MotionSidebar.tsx        # Motion page addition restrictions
│       └── MotionPage.tsx           # TipTap rich-text editor read-only logic
```

---

## Core Concepts & The `useSpaceRole` Hook

The frontend determines user capabilities dynamically using the `useSpaceRole()` hook. This hook extracts active organization and space contexts from `AppContext`, maps roles to an integer rank, and returns descriptive boolean flags.

### Space Permissions Mapping Matrix

| Permission Flag | Space Rank Requirement | Allowed Roles | Description |
| :--- | :--- | :--- | :--- |
| `canCreateTask` | `>= 2` | `admin`, `manager` | Permitted to create new tasks in the space |
| `canEditTask` | `>= 2` | `admin`, `manager` | Permitted to change task description, priority, etc. |
| `canDeleteTask` | `>= 2` | `admin`, `manager` | Permitted to archive/delete tasks |
| `canAssignTask` | `>= 2` | `admin`, `manager` | Permitted to add or remove assignees from tasks |
| `canChangeAnyStatus` | `>= 2` | `admin`, `manager` | Permitted to transition any task status |
| `canChangeAssignedStatus` | `>= 1` | All | Permitted to transition statuses of tasks they are assigned to |
| `canComment` | `>= 1` | All | Permitted to post task comments |
| `canDeleteOwnComment` | `>= 1` | All | Permitted to delete comments they authored |
| `canDeleteAnyComment` | `>= 3` | `admin` | Permitted to delete any user comment |
| `canCreatePage` | `>= 2` | `admin`, `manager` | Permitted to create Motion Pages |
| `canEditAnyPage` | `>= 3` | `admin` | Permitted to edit shared/system level pages |
| `canManageSpaceMembers` | `>= 3` | `admin` | Permitted to add/remove and update roles in a space |

---

## UI Gating Highlights

### 1. Task Details Gating (`OverviewTab.tsx` / `TaskDetailHeader.tsx`)
Interactive elements are conditionalized based on the permission flags:
* **Assignees**: The selector dropdown is hidden/disabled if `!canAssignTask`.
* **Attributes**: Fields like Title, Priority, Due Date, and Subtasks display plain text or disabled hover styles if `!canEditTask`.
* **Task Statuses**: Gated by role constraints. Managers and Admins can transition any status. Standard members can transition only tasks that are explicitly assigned to them.

### 2. Activity Comments Gating (`ActivityTab.tsx`)
* **Creating Comments**: The text input and post button are hidden or display a helpful message if the user's role is unauthorized.
* **Deleting Comments**: The delete trash icon is conditionally rendered based on authorship and role:
  ```typescript
  const isOwnComment = comment.user_id === currentUser?.id;
  const showDeleteIcon = (isOwnComment && canDeleteOwnComment) || canDeleteAnyComment;
  ```

### 3. Motion Page Read-Only Mode (`MotionPage.tsx`)
In `MotionPage.tsx`, the editor must be completely read-only for standard members:
* The Sidebar's `+ Add page` action is gated by `canCreatePage` (disappears for standard `member`).
* In the main page view, standard members can view pages but cannot type. The TipTap rich text editor is placed in read-only mode by passing `editable: false`:
  ```typescript
  const isPageReadOnly = spaceRole === "member";
  ```
  This is strictly enforced to protect page contents from unauthorized modifications.

---

## Developer Usage Examples

### Consuming Permissions in a UI Component

```tsx
import { useSpaceRole } from "@/hooks/useSpaceRole";

export function CustomTaskAction() {
  const { canEditTask, spaceRole } = useSpaceRole();

  if (!canEditTask) {
    return (
      <div className="text-xs text-muted-foreground p-2">
        Your role ({spaceRole}) does not permit task modification.
      </div>
    );
  }

  return (
    <button onClick={handleUpdate} className="btn-primary">
      Update Task
    </button>
  );
}
```

### Performing Management Updates (Self-Demotion Guard)

When rendering role selection in member management, prevent the current user from modifying their own role to prevent locking themselves out of administrative privileges:

```tsx
const { canManageSpaceMembers, orgRole } = useSpaceRole();
const isSelf = member.user_id === currentUserId;
const isTargetAdmin = member.role === "admin";

// Define if editing is allowed
const canEditRole = canManageSpaceMembers && !isSelf && (!isTargetAdmin || orgRole === "owner" || orgRole === "admin");
```
