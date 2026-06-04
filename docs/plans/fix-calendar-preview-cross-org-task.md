# Fix Plan: Calendar Preview Shows "Not Found" for Cross-Org Tasks

## Overview

When a user is in their **personal/private org** and views the calendar, tasks that were created in a **collaborative org** and assigned to them appear correctly on the calendar (because of the mirroring engine). However, clicking any of those tasks shows a **"Not found."** popup instead of the task preview.

The root cause is that `TaskPreviewDialog` always fetches the task using `activeOrgId`/`activeSpaceId` from `AppContext` — the personal org's coordinates — rather than the task's actual `org_id`/`space_id`. Since the task does not live in the personal org, the API returns a 404 and the dialog falls into the empty state.

The fix is **Option A: thread `org_id`/`space_id` through the calendar event into the dialog**. The data already exists on the `TaskDTO` at event-build time; it just isn't stored in `extendedProps` or passed as props to `TaskPreviewDialog`.

---

## Context

### How the bug manifests

1. User is in their personal org (private space, `is_private: true`).
2. The task list uses `filters.mirror = true`, which returns tasks assigned to the user in other orgs. Each `TaskDTO` in the response carries `org_id` and `space_id` pointing to the originating collaborative org.
3. `TaskSchedulePane` builds FullCalendar `EventInput` objects from this list. The `extendedProps` of each event stores `taskId`, `taskType`, `taskStatus`, etc. — **but not `org_id` or `space_id`**.
4. When the user clicks a calendar event, `TaskSchedulePane` calls `setSelectedTaskId(taskId)` and opens `TaskPreviewDialog`.
5. `TaskPreviewDialog` reads `{ activeOrgId, activeSpaceId }` from `useAppContext()` and calls `useOrgTask(activeOrgId, activeSpaceId, taskId)`.
6. The API call `GET v1/orgs/{personal_org}/spaces/{personal_space}/tasks/{taskId}` returns 404 — the task lives in a different org.
7. `task` is `null`, and the dialog renders `<p>Not found.</p>`.

### Why the task detail page is unaffected

`TasksPage` has a `useLocateTask` fallback. When `useOrgTask` 404s, it fires `GET v1/tasks/{taskId}/locate`, gets back the correct `orgId`/`spaceId`, and switches the active workspace context. That recovery path does not exist in `TaskPreviewDialog`.

### Why Option A is the correct fix

`TaskPreviewDialog` is always opened from an in-memory calendar event that was built from a fully-loaded `TaskDTO`. The `org_id` and `space_id` are already available at the point the event is constructed — the dialog just isn't receiving them. Carrying them through `extendedProps` → props costs nothing: no extra API calls, no async recovery, no visible loading flash.

`useLocateTask` (Option B) is the right pattern for URL-driven deep links where no task data is in memory. Using it inside a calendar popup would add two unnecessary round-trips (`/locate` + re-fetch) and a perceptible delay every time a user clicks a scheduled task.

---

## Constraints

1. **No new API endpoints or backend changes.** `org_id` and `space_id` are already returned by the existing tasks list API.
2. **No context switching.** The fix must not call `setActiveOrganisation`. The user stays in their personal org; only the fetch coordinates change inside the dialog.
3. **All four mutation hooks must use the same resolved coordinates.** `useUpdateOrgTask`, `useDeleteOrgTask`, and `useChangeOrgTaskStatus` inside `TaskPreviewDialog` must all operate against the task's real `org_id`/`space_id`, not the active context.
4. **The "more" popover path must receive the same treatment.** The month-view overflow popover in `TaskSchedulePane` independently opens `TaskPreviewDialog`. It must also carry `orgId`/`spaceId`.
5. **Do not break the non-mirrored (same-org) case.** When `t.org_id` equals `activeOrgId`, behavior must be identical to before.
6. **TypeScript correctness.** All new fields must be properly typed; no `as any` escapes.

---

## Phases

### Phase 1 — Store `org_id`/`space_id` in Calendar Event `extendedProps`

**File:** `frontend/src/components/tasks/TaskSchedulePane.tsx`

In the `useEffect` that builds `taskEvents` from the `tasks` prop, add `orgId` and `spaceId` to the `extendedProps` of each scheduled task event:

```ts
extendedProps: {
  taskId: t.id,
  orgId: t.org_id ?? activeOrgId,       // ← add
  spaceId: t.space_id ?? activeSpaceId, // ← add
  taskTitle: t.title,
  projectTitle: t.projectTitle,
  taskStatus: t.status,
  taskPriority: t.priority,
  taskType: t.type,
  isScheduledTask: true,
},
```

`TaskSchedulePane` needs to read `activeOrgId`/`activeSpaceId` from `useAppContext()` as the fallback values for tasks that don't carry their own coordinates (own-org tasks where `org_id` may be undefined).

---

### Phase 2 — Lift `orgId`/`spaceId` State in `TaskSchedulePane`

**File:** `frontend/src/components/tasks/TaskSchedulePane.tsx`

Add two new state variables alongside `selectedTaskId`:

```ts
const [selectedTaskId, setSelectedTaskId] = useState<string>("");
const [selectedTaskOrgId, setSelectedTaskOrgId] = useState<string>("");
const [selectedTaskSpaceId, setSelectedTaskSpaceId] = useState<string>("");
```

Update every place that sets `selectedTaskId` to also set the org/space:

**`eventClick` handler:**
```ts
eventClick={(arg) => {
  if (arg.event.extendedProps.isScheduledTask) {
    setSelectedTaskId(arg.event.extendedProps.taskId);
    setSelectedTaskOrgId(arg.event.extendedProps.orgId);
    setSelectedTaskSpaceId(arg.event.extendedProps.spaceId);
    // ... existing position logic
  }
}}
```

**Month-view "more" popover click handler:**
```ts
onClick={() => {
  const event = morePopover.events.find(e => e.taskId === item.taskId);
  setSelectedTaskId(item.taskId);
  setSelectedTaskOrgId(event?.orgId ?? activeOrgId);
  setSelectedTaskSpaceId(event?.spaceId ?? activeSpaceId);
  setMorePopover(null);
}}
```

The `morePopover` state's event shape must also be extended to carry `orgId` and `spaceId` when it is populated.

---

### Phase 3 — Extend `TaskPreviewDialogProps` and Update the Dialog

**File:** `frontend/src/components/tasks/TaskPreviewDialog.tsx`

**Step 1 — Add props to the interface:**
```ts
interface TaskPreviewDialogProps {
  taskId: string;
  orgId: string;    // ← new: the task's home org
  spaceId: string;  // ← new: the task's home space
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUnschedule?: (taskId: string) => void;
  onStatusChange?: (taskId: string, newStatus: string) => void;
  position?: { x: number; y: number } | null;
}
```

**Step 2 — Replace `useAppContext` with the explicit props:**
```ts
export function TaskPreviewDialog({
  taskId,
  orgId,     // ← use this
  spaceId,   // ← use this
  open,
  onOpenChange,
  onUnschedule,
  onStatusChange,
  position,
}: TaskPreviewDialogProps) {
  const navigate = useNavigate();
  // Remove: const { activeOrgId, activeSpaceId } = useAppContext();

  const { data: task, isLoading } = useOrgTask(orgId, spaceId, taskId);
  const updateTask = useUpdateOrgTask(orgId, spaceId);
  const deleteTask = useDeleteOrgTask(orgId, spaceId);
  const changeTaskStatus = useChangeOrgTaskStatus(orgId, spaceId);
  // ...rest unchanged
}
```

All four hooks now operate against the task's actual org+space. The navigation path (`/tasks/:id` or `/events/:id`) is unaffected — it only uses `taskId`.

---

### Phase 4 — Pass New Props from `TaskSchedulePane` to `TaskPreviewDialog`

**File:** `frontend/src/components/tasks/TaskSchedulePane.tsx`

Update the `<TaskPreviewDialog>` render to pass the new state:

```tsx
<TaskPreviewDialog
  taskId={selectedTaskId}
  orgId={selectedTaskOrgId}       // ← new
  spaceId={selectedTaskSpaceId}   // ← new
  open={!!selectedTaskId && !!dialogPosition}
  onOpenChange={(open) => {
    if (!open) {
      setSelectedTaskId("");
      setSelectedTaskOrgId("");
      setSelectedTaskSpaceId("");
      setDialogPosition(null);
    }
  }}
  onUnschedule={handleTaskUnschedule}
  onStatusChange={handleStatusChange}
  position={dialogPosition}
/>
```

---

## Acceptance Criteria

### Functional

- [ ] Clicking a mirrored cross-org task in the calendar (month, week, day, or list view) opens the task preview dialog with full task data — title, status, description, assignees, timings.
- [ ] The "Not found." message no longer appears for any task that exists in the system and the user has access to.
- [ ] Status change (mark done / change status dropdown) from the preview dialog works correctly and updates the task in its originating org.
- [ ] "Unschedule" from the preview dialog works correctly on cross-org tasks.
- [ ] "Delete" from the preview dialog works correctly on cross-org tasks.
- [ ] "View details" navigation from the preview dialog opens the correct task detail page.
- [ ] The month-view overflow popover ("X more") also shows correct previews for cross-org tasks.

### Non-regression

- [ ] Tasks created and owned by the user in the personal org still preview correctly (same-org path unchanged).
- [ ] Tasks in a collaborative org viewed from within that org's context still preview correctly.
- [ ] No additional network requests are made when clicking a calendar event (verify in DevTools Network tab — no `/locate` call).
- [ ] TypeScript compiles with zero new errors or `any` escapes.

### Edge Cases

- [ ] If `t.org_id` is `undefined` on a `TaskDTO` (old data / edge case), the fallback to `activeOrgId`/`activeSpaceId` is used and no crash occurs.
- [ ] Closing and reopening the preview dialog clears the previous `orgId`/`spaceId` state correctly, so a fast second click on a different task shows the right data.
