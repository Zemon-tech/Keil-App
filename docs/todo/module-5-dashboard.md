# Module 5 — Dashboard

## Prerequisites
- Phase 0 (Foundation) must be complete — `workspaceId` must be available globally
- Module 1 (Tasks Core) must be complete — real task data must exist in the database
- Module 2 (Assignees & Dependencies) must be complete — blocked bucket relies on dependency data

---

## Context for Developers

### What already exists

**Backend**
- `dashboard.service.ts` is **fully implemented** — `getDashboardBuckets(workspaceId)` runs all 4 bucket queries in parallel and returns sorted results
- All 4 repository queries are implemented in `task.repository.ts`:
  - `findUrgentAndNearDue(workspaceId, 48)` — urgent + due within 48 hours
  - `findDueToday(workspaceId)` — due today, not done
  - `findBlocked(workspaceId)` — tasks with at least one incomplete dependency
  - `findBacklog(workspaceId)` — status = backlog
- Ranking logic (urgent=3, high=2, medium=1, low=0 + time proximity) is already implemented in `dashboard.service.ts` `sortTasksByRanking()`
- Route is wired: `GET /api/v1/dashboard` → `getDashboardInfo` controller in `activity.routes.ts`

**Frontend**
- `Dashboard.tsx` renders a grid of cards — layout is in place
- All 5 card components exist but every single one is **fully hardcoded mock content**:
  - `CurrentFocusCard.tsx` — hardcoded task title "Fix login timeout bug"
  - `ImmediateBlockersCard.tsx` — hardcoded blocker text
  - `UpNextCard.tsx` — hardcoded content
  - `NeedsReplyCard.tsx` — hardcoded content
  - `NextEventCard.tsx` — schedule-related, parked for later
- `src/hooks/api/useDashboard.ts` exists as an empty placeholder from Phase 0

### What is missing
- `getDashboardInfo` controller in `activity.controller.ts` is a `// TODO` stub — it calls nothing and returns `{}`
- No frontend data fetching for the dashboard — all cards render static JSX
- Cards have no concept of empty state, loading state, or real data props

### Card to bucket mapping

| Card | Data source | Notes |
|---|---|---|
| `CurrentFocusCard` | `immediate[0]` | Show the single most critical task |
| `ImmediateBlockersCard` | `immediate[]` | Show all urgent/near-due tasks |
| `UpNextCard` | `today[]` | Tasks due or scheduled today |
| `NeedsReplyCard` | Not in MVP v0.5 | Park — show empty/placeholder state |
| `NextEventCard` | Schedule module — parked | Park — show empty/placeholder state |

---

## Branch Names
- `feature/dashboard-be` — Dev A
- `feature/dashboard-fe` — Dev B

---

## API Contract

Both developers must agree on this shape before coding.

### `GET /api/v1/dashboard`
**Auth:** Required (Bearer token)  
**No query params needed** — workspace is resolved from the authenticated user

**Response 200:**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Dashboard data retrieved successfully",
  "data": {
    "immediate": [
      {
        "id": "uuid",
        "title": "string",
        "status": "backlog | todo | in-progress | done",
        "priority": "low | medium | high | urgent",
        "due_date": "ISO string or null",
        "objective": "string or null"
      }
    ],
    "today": [ "...same shape..." ],
    "blocked": [ "...same shape..." ],
    "backlog": [ "...same shape..." ]
  }
}
```

**Notes:**
- All 4 bucket arrays are always present — empty array `[]` if no matching tasks
- Tasks are pre-sorted by the backend ranking formula — frontend should render in the order received
- A task can appear in multiple buckets (e.g. urgent + due today = appears in both `immediate` and `today`) — this is intentional

---

## Dev A — Backend Deliverables

> Branch: `feature/dashboard-be`

File: `backend/src/controllers/activity.controller.ts`

### Controller — `getDashboardInfo`

- [ ] Replace the `// TODO` stub in `getDashboardInfo` with real implementation
- [ ] Extract `req.user` from the request (attached by auth middleware)
- [ ] Resolve `workspaceId` from the user — use `workspaceService.getUserWorkspace(user.id)` or the attached workspace context (use the same approach decided in Module 1)
- [ ] If user has no workspace, return `404` with message `"No workspace found for this user"`
- [ ] Call `dashboardService.getDashboardBuckets(workspaceId)`
- [ ] Return `200` with the full buckets object using `ApiResponse`
- [ ] Wrap in `catchAsync` — do not add manual try/catch

### Validation
- [ ] No request body or query params needed — workspace comes from auth
- [ ] If `getDashboardBuckets` throws, let `catchAsync` propagate it cleanly

### Import check
- [ ] Confirm `dashboardService` is imported from `../services/dashboard.service`
- [ ] Confirm `workspaceService` or the workspace resolution approach is available in this file

### Files to modify

| File | Change |
|---|---|
| `backend/src/controllers/activity.controller.ts` | Implement `getDashboardInfo` — call `dashboardService.getDashboardBuckets()` |

---

## Dev B — Frontend Deliverables

> Branch: `feature/dashboard-fe`

### Step 1 — Build `useDashboard` hook
File: `frontend/src/hooks/api/useDashboard.ts`

- [ ] Implement `useDashboard()` — `useQuery` wrapping `GET /api/v1/dashboard`
  - Query key: `["dashboard", workspaceId]`
  - Get `workspaceId` from `useWorkspace()` context
  - Only run query when `workspaceId` is not null — use `enabled: !!workspaceId`
  - Return `{ data, isLoading, isError }` — callers should handle all 3 states

### Step 2 — Update `Dashboard.tsx`
File: `frontend/src/components/Dashboard.tsx`

- [ ] Call `useDashboard()` at the top of `Dashboard.tsx`
- [ ] Pass relevant bucket slices as props to each card:
  - `<CurrentFocusCard task={data?.immediate[0] ?? null} isLoading={isLoading} />`
  - `<ImmediateBlockersCard tasks={data?.immediate ?? []} isLoading={isLoading} />`
  - `<UpNextCard tasks={data?.today ?? []} isLoading={isLoading} />`
  - `<NeedsReplyCard />` — leave as-is, no data prop (parked)
  - `<NextEventCard />` — leave as-is, no data prop (parked)
- [ ] If `isLoading` is true, cards should render a skeleton placeholder
- [ ] If `isError` is true, show a subtle error indicator — do not crash the page

### Step 3 — Update `CurrentFocusCard.tsx`
File: `frontend/src/components/dashboard/CurrentFocusCard.tsx`

- [ ] Accept props: `task: TaskDTO | null`, `isLoading: boolean`
- [ ] Replace all hardcoded text with values from `task`
  - Title: `task.title`
  - Goal section: `task.objective` (label "Goal", fallback: `"No objective set"`)
  - Show `task.priority` as a badge
  - Show `task.due_date` formatted (e.g. "Due today", "Due in 2 days")
- [ ] If `isLoading`: show a skeleton placeholder (a few grey rounded bars)
- [ ] If `task` is null (no immediate tasks): show an empty state — "No urgent tasks right now"

### Step 4 — Update `ImmediateBlockersCard.tsx`
File: `frontend/src/components/dashboard/ImmediateBlockersCard.tsx`

- [ ] Accept props: `tasks: TaskDTO[]`, `isLoading: boolean`
- [ ] If `isLoading`: show skeleton
- [ ] If `tasks` is empty: show "No immediate blockers" in muted text
- [ ] If tasks exist: render a list of tasks — show `title`, `priority` badge, and relative due date
- [ ] Show max 3 tasks in the card — do not overflow the card height

### Step 5 — Update `UpNextCard.tsx`
File: `frontend/src/components/dashboard/UpNextCard.tsx`

- [ ] Accept props: `tasks: TaskDTO[]`, `isLoading: boolean`
- [ ] If `isLoading`: show skeleton
- [ ] If `tasks` is empty: show "Nothing due today"
- [ ] If tasks exist: render task titles with status dots — max 4 items
- [ ] Each task row: `title` + `priority` indicator

### Step 6 — Park remaining cards
File: `frontend/src/components/dashboard/NeedsReplyCard.tsx`  
File: `frontend/src/components/dashboard/NextEventCard.tsx`

- [ ] Keep existing JSX as-is — do not wire to any data
- [ ] Add a subtle `// TODO: Wire in future module` comment at the top of each file
- [ ] Do not pass any data props to these from `Dashboard.tsx`

### Types
File: `frontend/src/types/task.ts`

- [ ] Add a `DashboardTaskDTO` type or reuse the existing `Task` type for dashboard card props — whichever is cleaner. The dashboard only needs a subset: `id`, `title`, `status`, `priority`, `due_date`, `objective`.

---

## Acceptance Criteria

- [ ] Dashboard page loads real data — no hardcoded task names or blocker text remain in wired cards
- [ ] `CurrentFocusCard` shows the highest-ranked urgent/near-due task from the `immediate` bucket
- [ ] `ImmediateBlockersCard` shows the correct list of urgent/near-due tasks from the backend
- [ ] `UpNextCard` shows tasks that are due today
- [ ] All wired cards handle loading state — a skeleton or spinner is shown while fetching
- [ ] All wired cards handle empty state — a readable empty message is shown when a bucket has no tasks
- [ ] `NeedsReplyCard` and `NextEventCard` remain static and do not error
- [ ] Dashboard does not crash or show blank cards on API error
- [ ] Refreshing the page re-fetches dashboard data correctly
- [ ] Adding a new urgent task in the tasks page and returning to dashboard shows it in the immediate bucket (TanStack Query cache invalidation or stale time makes this work)

---

## Files Modified Summary

| File | Who | Change |
|---|---|---|
| `backend/src/controllers/activity.controller.ts` | Dev A | Implement `getDashboardInfo` stub |
| `frontend/src/hooks/api/useDashboard.ts` | Dev B | Implement `useDashboard` query hook |
| `frontend/src/components/Dashboard.tsx` | Dev B | Call `useDashboard`, pass data as props to cards |
| `frontend/src/components/dashboard/CurrentFocusCard.tsx` | Dev B | Replace hardcoded content with real props |
| `frontend/src/components/dashboard/ImmediateBlockersCard.tsx` | Dev B | Replace hardcoded content with real props |
| `frontend/src/components/dashboard/UpNextCard.tsx` | Dev B | Replace hardcoded content with real props |
| `frontend/src/components/dashboard/NeedsReplyCard.tsx` | Dev B | Add TODO comment only — no wiring |
| `frontend/src/components/dashboard/NextEventCard.tsx` | Dev B | Add TODO comment only — no wiring |

---

## Impact on Other Modules

| Module | Impact |
|---|---|
| Module 1 (Tasks) | Dashboard reads from the same `tasks` table. If task CRUD is stable, dashboard data will be accurate. No code conflict. |
| Module 2 (Deps) | The `blocked` bucket in dashboard depends on `task_dependencies` rows. This module must be merged before the blocked bucket shows real results. |
| Module 3 (Comments) | No dependency. `NeedsReplyCard` is parked and not wired yet. |
| Module 4 (Activity) | No dependency. Activity feed is a separate endpoint. |

---

## Notes

- `dashboard.service.ts` is the most complete service in the entire codebase. The controller work here is minimal — the main effort is on the frontend.
- A task can appear in multiple buckets (e.g. urgent + due today). This is intentional per MVP v0.5 spec. Do not deduplicate across buckets on the frontend.
- The backend ranking is already applied before the response is returned — frontend should render in the received order.
- `NeedsReplyCard` requires comment threading data to determine which tasks have unanswered comments. This is non-trivial and depends on Module 3 being fully stable. Leave it parked.
- `NextEventCard` requires the Schedule module which is explicitly parked for later. Leave it as static UI.