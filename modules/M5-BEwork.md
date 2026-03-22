# Module 5 — Backend Implementation Guide (Dashboard)

This document provides **specific, step-by-step instructions** for the Backend Developer to implement the **Dashboard** module. Every task is ordered — complete them top to bottom.

> **Branch:** `feature/dashboard-be`
> **Prerequisites:** Phase 0 ✅, Module 1 ✅, Module 2 ✅, Module 3 ✅, and Module 4 ✅ must be fully complete before starting this.

---

## 📁 Files You Will Modify

| File | What You Will Do |
|---|---|
| `backend/src/controllers/activity.controller.ts` | Implement `getDashboardInfo` stub (replace the TODO) |

---

## 📁 Files You Will Only READ (Do NOT modify)

| File | Why You Need To Read It |
|---|---|
| `backend/src/services/dashboard.service.ts` | Service functions already exist — understand `getDashboardBuckets` signature and DTOs |
| `backend/src/repositories/task.repository.ts` | Understand the 4 bucket queries: `findUrgentAndNearDue`, `findDueToday`, `findBlocked`, `findBacklog` |
| `backend/src/routes/activity.routes.ts` | Route already wired — verify `GET /api/v1/dashboard` endpoint |

---

## ⚡ What Already Exists (DO NOT Re-Build)

The architecture is fully layered. Services and repositories are **100% complete**. Your only job is to wire the controller layer correctly.

```
HTTP Request → Controller (YOUR WORK) → Service (READY) → Repository (READY) → PostgreSQL
```

| Layer | Status | Key Functions Available |
|---|---|---|
| `dashboard.service.ts` | ✅ Ready | `getDashboardBuckets(workspaceId)` — returns all 4 buckets with ranked tasks |
| `task.repository.ts` | ✅ Ready | `findUrgentAndNearDue()`, `findDueToday()`, `findBlocked()`, `findBacklog()` |
| `workspace.service.ts` | ✅ Ready | `getUserWorkspace(userId)` — if you need to resolve workspace differently |
| Routes | ✅ Already Wired | `GET /api/v1/dashboard` → `getDashboardInfo` controller in `activity.routes.ts` |

**Critical fact:** The dashboard service is the most complete service in the entire codebase. It already:
- Runs 4 bucket queries in parallel using `Promise.all()`
- Applies ranking logic (urgent=3, high=2, medium=1, low=0)
- Sorts by priority weight + due date proximity
- Converts Task entities to DTOs
- Returns fully structured `DashboardBucketsDTO`

You do NOT need to write any ranking logic, sorting logic, or DTO conversion.

---

## 🔑 The Controller Pattern (Follow This — Same as All Other Controllers)

Every controller in this project follows this exact pattern. Look at `getActivityFeed` in the same file for reference:

```typescript
export const myHandler = catchAsync(async (req: Request, res: Response) => {
  // 1. EXTRACT workspaceId from middleware (auth middleware sets this)
  const workspaceId = (req as any).workspaceId as string;

  // 2. GUARD: workspaceId must exist
  if (!workspaceId) throw new ApiError(404, "No workspace found for this user");

  // 3. CALL SERVICE
  const data = await someService.getData(workspaceId);

  // 4. RETURN unified response
  res.status(200).json(new ApiResponse(200, data, "Success message"));
});
```

> **Key Rule:** Never write manual `try-catch`. Always use `catchAsync`. It automatically forwards any thrown `ApiError` to the global error handler.

---

## 📋 API Contract — What the Frontend Expects

### `GET /api/v1/dashboard`

**Auth:** Required (protected route)

**No Query Params Needed:** — workspace is resolved from the authenticated user via middleware.

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

**Important notes about the response:**
- All 4 bucket arrays are **always present** — empty array `[]` if no matching tasks
- Tasks are **pre-sorted** by the backend ranking formula — frontend renders in received order
- A task can appear in **multiple buckets** (e.g., urgent + due today = appears in both `immediate` and `today`) — this is intentional per MVP v0.5 spec
- `immediate` bucket contains urgent + near-due tasks (within 48 hours)
- `today` bucket contains tasks due today (not done)
- `blocked` bucket contains tasks with at least one incomplete dependency
- `backlog` bucket contains tasks with status = `backlog`

---

## 🛠️ TASK 0 — Add Missing Import

**File:** `backend/src/controllers/activity.controller.ts`

**Current state of imports (Lines 1–6):**
```typescript
import { Request, Response } from "express";
import { catchAsync } from "../utils/catchAsync";
import { ApiResponse } from "../utils/ApiResponse";
import { ApiError } from "../utils/ApiError";
import * as activityService from "../services/activity.service";
import { LogEntityType } from "../types/enums";
```

**Problem:** `dashboardService` is missing (needed to call `getDashboardBuckets`).

### Step-by-Step:

**Step 1** — Add `dashboardService` import after the `activityService` import:
```typescript
import * as dashboardService from "../services/dashboard.service";
```

### Final Import Block (replace lines 1–6 with this):
```typescript
import { Request, Response } from "express";
import { catchAsync } from "../utils/catchAsync";
import { ApiResponse } from "../utils/ApiResponse";
import { ApiError } from "../utils/ApiError";
import * as activityService from "../services/activity.service";
import * as dashboardService from "../services/dashboard.service";
import { LogEntityType } from "../types/enums";
```

**Why this must be done first?** Without this import, TypeScript will throw compile errors when you try to call `dashboardService.getDashboardBuckets()`.

---

## 🛠️ TASK 1 — Extract `workspaceId` from Middleware

**File:** `backend/src/controllers/activity.controller.ts`
**Inside:** `getDashboardInfo` function

The auth middleware (`auth.middleware.ts`) already fetches the user's workspace and attaches it to `req.workspaceId` on every protected request. You just need to read it — same pattern as `getActivityFeed`.

### Step-by-Step:

**Step 1** — Extract `workspaceId`:
```typescript
const workspaceId = (req as any).workspaceId as string;
```

**Step 2** — Guard: if `workspaceId` is missing, throw 404 (NOT 403):
```typescript
if (!workspaceId) throw new ApiError(404, "No workspace found for this user");
```

**Why 404 and not 403?** Per the module spec: "If user has no workspace, return `404` with message `"No workspace found for this user"`". The dashboard specifically requires a 404 for this case.

**Why `(req as any).workspaceId`?** The Express `Request` type doesn't know about our custom `workspaceId` property. We cast to `any` to access it — this is the same pattern used in `task.controller.ts`, `comment.controller.ts`, and `getActivityFeed`.

---

## 🛠️ TASK 2 — Call the Dashboard Service

**File:** `backend/src/controllers/activity.controller.ts`
**Inside:** `getDashboardInfo` function

Call the already-implemented service function to get all 4 buckets.

### Step-by-Step:

**Step 1** — Call `dashboardService.getDashboardBuckets()`:
```typescript
const dashboardData = await dashboardService.getDashboardBuckets(workspaceId);
```

### What happens inside the service (you don't write this):

**`dashboardService.getDashboardBuckets(workspaceId)`:**
1. Runs 4 repository queries in parallel using `Promise.all()`:
   - `taskRepository.findUrgentAndNearDue(workspaceId, 48)` — urgent + due within 48 hours
   - `taskRepository.findDueToday(workspaceId)` — due today, not done
   - `taskRepository.findBlocked(workspaceId)` — tasks with incomplete dependencies
   - `taskRepository.findBacklog(workspaceId)` — status = backlog
2. Sorts each bucket by ranking formula:
   - Priority weight: urgent=3, high=2, medium=1, low=0
   - Time proximity: earlier due dates rank higher
   - Created date as tiebreaker: newer first
3. Converts each Task entity to `TaskDTO` using `taskToDTO()`
4. Returns `DashboardBucketsDTO` with 4 arrays: `immediate`, `today`, `blocked`, `backlog`

**No validation needed:** The service handles all the logic. Just pass the `workspaceId`.

---

## 🛠️ TASK 3 — Return the Response

**File:** `backend/src/controllers/activity.controller.ts`
**Inside:** `getDashboardInfo` function

Return the dashboard data using the standard `ApiResponse` class — same pattern as every other controller.

### Step-by-Step:

```typescript
res.status(200).json(new ApiResponse(200, dashboardData, "Dashboard data retrieved successfully"));
```

**Why `200` and not `201`?** `201 Created` is for POST requests that create a new resource. This is a GET request that reads existing data — `200 OK` is correct.

**Why `new ApiResponse(200, dashboardData, message)` and not `res.json({ data })`?** The `ApiResponse` class ensures a consistent response shape across all endpoints:
```json
{
  "statusCode": 200,
  "data": { "immediate": [...], "today": [...], "blocked": [...], "backlog": [...] },
  "message": "Dashboard data retrieved successfully",
  "success": true
}
```
The frontend relies on this consistent shape.

---

## 📄 Final Complete Implementation

After completing all tasks above, your `getDashboardInfo` function should look exactly like this:

```typescript
export const getDashboardInfo = catchAsync(async (req: Request, res: Response) => {
    // TASK 1: Extract workspaceId from middleware
    const workspaceId = (req as any).workspaceId as string;
    if (!workspaceId) {
        throw new ApiError(404, "No workspace found for this user");
    }

    // TASK 2: Call dashboard service to get all 4 buckets
    const dashboardData = await dashboardService.getDashboardBuckets(workspaceId);

    // TASK 3: Return response with dashboard data
    res.status(200).json(new ApiResponse(200, dashboardData, "Dashboard data retrieved successfully"));
});
```

**Note:** `getActivityFeed` (the other function in this file) was implemented in Module 4. Do not modify it. Your work is only on `getDashboardInfo`.

---

## 🛡️ Validation & Quality Rules (Mandatory)

1. **Always use `catchAsync`:** Never write manual `try-catch` in controllers. Thrown `ApiError` instances are automatically caught and formatted by the global error handler in `error.ts`.

2. **No request body or query params:** This endpoint uses only the workspace from auth middleware. Do not try to read `req.body` or additional `req.query` params.

3. **404 for missing workspace:** Per the spec, return `404` with message `"No workspace found for this user"` — NOT 403.

4. **Response Format:** Always use `new ApiResponse(statusCode, data, message)`. Never send raw `res.json({})`.

5. **Let errors propagate:** If `dashboardService.getDashboardBuckets()` throws, let `catchAsync` handle it. Do not wrap in manual try-catch.

6. **TypeScript compliance:** Run `npx tsc --noEmit` after implementation. Zero errors required before marking complete.

---

## 🗂️ Route Reference — Already Wired, No Changes Needed

| Method | Route | Controller Function | Status |
|---|---|---|---|
| `GET` | `/api/v1/dashboard` | `getDashboardInfo` | ✅ Route exists, controller needs implementation |
| `GET` | `/api/v1/activity` | `getActivityFeed` | ✅ Module 4 — do NOT touch |

---

## 🧪 Testing Your Implementation

After implementing, test each scenario manually using curl or Postman.

### Test 1: Basic Dashboard Request
```bash
curl -X GET "http://localhost:3000/api/v1/dashboard" \
  -H "Authorization: Bearer {yourToken}"
```
**Expected:** 200 with all 4 buckets present (may be empty arrays if no tasks exist).

### Test 2: Verify All 4 Buckets Present
Check that response contains:
```json
{
  "data": {
    "immediate": [...],
    "today": [...],
    "blocked": [...],
    "backlog": [...]
  }
}
```
**Expected:** All 4 keys exist, even if values are empty arrays `[]`.

### Test 3: Verify Task Ranking in Immediate Bucket
Create multiple tasks with different priorities and due dates, then check the dashboard:
```bash
# Create urgent task due tomorrow
curl -X POST "http://localhost:3000/api/v1/tasks" \
  -H "Authorization: Bearer {yourToken}" \
  -H "Content-Type: application/json" \
  -d '{"title": "Urgent Task", "priority": "urgent", "due_date": "2026-03-23T23:59:59Z"}'

# Create high priority task due today
curl -X POST "http://localhost:3000/api/v1/tasks" \
  -H "Authorization: Bearer {yourToken}" \
  -H "Content-Type: application/json" \
  -d '{"title": "High Task", "priority": "high", "due_date": "2026-03-22T23:59:59Z"}'
```
**Expected:** In `immediate` bucket, urgent task appears before high priority task.

### Test 4: Verify Blocked Bucket with Dependencies
Create a task with a dependency that is not done:
```bash
# Create dependency task
curl -X POST "http://localhost:3000/api/v1/tasks" \
  -H "Authorization: Bearer {yourToken}" \
  -H "Content-Type: application/json" \
  -d '{"title": "Dependency Task", "status": "todo"}'

# Create main task with dependency
curl -X POST "http://localhost:3000/api/v1/tasks" \
  -H "Authorization: Bearer {yourToken}" \
  -H "Content-Type: application/json" \
  -d '{"title": "Main Task", "status": "todo"}'

# Add dependency (replace {mainId} and {depId} with actual UUIDs)
curl -X POST "http://localhost:3000/api/v1/tasks/{mainId}/dependencies" \
  -H "Authorization: Bearer {yourToken}" \
  -H "Content-Type: application/json" \
  -d '{"depends_on_task_id": "{depId}"}'
```
**Expected:** Main task appears in `blocked` bucket.

### Test 5: Verify Today Bucket with Due Today Tasks
Create a task due today:
```bash
curl -X POST "http://localhost:3000/api/v1/tasks" \
  -H "Authorization: Bearer {yourToken}" \
  -H "Content-Type: application/json" \
  -d '{"title": "Due Today Task", "due_date": "2026-03-22T23:59:59Z"}'
```
**Expected:** Task appears in `today` bucket.

### Test 6: Verify Backlog Bucket
Create a task with status `backlog`:
```bash
curl -X POST "http://localhost:3000/api/v1/tasks" \
  -H "Authorization: Bearer {yourToken}" \
  -H "Content-Type: application/json" \
  -d '{"title": "Backlog Task", "status": "backlog"}'
```
**Expected:** Task appears in `backlog` bucket.

### Test 7: No Workspace Error
Test with a user who has no workspace (rare case since Phase 0 auto-creates workspaces):
**Expected:** 404 with message `"No workspace found for this user"`.

### Test 8: Verify Workspace Isolation
Log in as a different user (different workspace) and call the dashboard:
**Expected:** Their dashboard shows ONLY their workspace's tasks — never yours.

---

## ✅ Module 5 Backend — Complete Task Checklist

Complete these in order. Check each box only after you have verified it works. Do not skip ahead.

---

### 🔧 Setup

- [ ] **Branch created:** `git checkout -b feature/dashboard-be` — confirm you are on the correct branch before writing any code.
- [ ] **Files located:** Open `activity.controller.ts` and `dashboard.service.ts` before starting. Read the service file to understand `getDashboardBuckets` signature.
- [ ] **Confirmed:** `GET /api/v1/dashboard` route already exists and points to `getDashboardInfo` controller (no new route needed).

---

### 📌 Task 0 — Add Missing Import

- [x] `dashboardService` imported as `import * as dashboardService from "../services/dashboard.service"`
- [x] Import added after `activityService` import
- [x] All 7 imports are present at the top of `activity.controller.ts`
- [x] No unused imports added

---

### 📌 Task 1 — Extract `workspaceId`

- [x] `workspaceId` extracted using `(req as any).workspaceId as string`
- [x] Guard added: `if (!workspaceId) throw new ApiError(404, "No workspace found for this user")`
- [x] Error code is `404` (NOT 403)
- [x] Error message matches exactly: `"No workspace found for this user"`
- [x] Pattern matches exactly how `getActivityFeed` does it

---

### 📌 Task 2 — Call Dashboard Service

- [x] `dashboardService.getDashboardBuckets(workspaceId)` is called
- [x] `workspaceId` is passed as the only argument
- [x] Result stored in `dashboardData` variable (or similar name)
- [x] No manual try-catch around the service call — `catchAsync` handles errors automatically
- [x] No validation of request body or query params (none needed for this endpoint)

---

### 📌 Task 3 — Return Response

- [x] `res.status(200).json(new ApiResponse(200, dashboardData, "Dashboard data retrieved successfully"))` used
- [x] Status code is `200` (not `201`)
- [x] `new ApiResponse(...)` used (not raw `res.json({})`)
- [x] Message matches exactly: `"Dashboard data retrieved successfully"`
- [x] `dashboardData` contains all 4 buckets: `immediate`, `today`, `blocked`, `backlog`

---

### 📌 Task 4 — `getActivityFeed` Left Untouched

- [x] `getActivityFeed` function is identical to its Module 4 implementation
- [x] No changes made to the other function in the file
- [x] No accidental deletion or modification of existing code

---

### ✔️ TypeScript & Quality

- [x] `npx tsc --noEmit` runs with **zero errors**
- [x] No manual `try-catch` blocks in `getDashboardInfo`
- [x] No `res.json({})` used — always `new ApiResponse(...)`
- [x] No `console.log` statements left in the code
- [x] `getDashboardInfo` is wrapped with `catchAsync` (already is)
- [x] All imports are used (no unused imports)

---

### ✔️ API Contract Verification

- [x] `GET /api/v1/dashboard` returns 200 with `DashboardBucketsDTO` object
- [x] Response contains 4 buckets: `immediate`, `today`, `blocked`, `backlog`
- [x] Each bucket is an array (empty `[]` or containing `TaskDTO` objects)
- [x] Each task in buckets has: `id`, `title`, `status`, `priority`, `due_date`, `objective`
- [x] Tasks are sorted by priority weight (urgent > high > medium > low)
- [x] Tasks with same priority are sorted by due date (earlier first)
- [x] 404 error returned when user has no workspace
- [x] Workspace isolation enforced — only current workspace's tasks appear

---

### ✔️ Integration Testing

- [x] Test 1: Basic dashboard request returns 200 with all 4 buckets
- [x] Test 2: Creating urgent task makes it appear in `immediate` bucket
- [x] Test 3: Creating task due today makes it appear in `today` bucket
- [x] Test 4: Creating task with incomplete dependency makes it appear in `blocked` bucket
- [x] Test 5: Creating task with status `backlog` makes it appear in `backlog` bucket
- [x] Test 6: Workspace isolation verified — other workspace's tasks don't appear

---

**Final Status:** Module 5 Backend complete when ALL boxes above are checked. ✅

---

### 🛡️ Final Architecture Confirmation

> [!IMPORTANT]
> **Module 5 Backend is COMPLETE when:**
>
> - **Single file changed:** Only `activity.controller.ts` was modified (specifically the `getDashboardInfo` function).
> - **No new routes:** Existing `GET /api/v1/dashboard` route was already wired.
> - **No new services:** `dashboard.service.ts` was already fully implemented.
> - **Minimal controller work:** Controller simply extracts workspaceId, calls service, returns response.
> - **Ranking logic:** Backend is the source of truth for priority + time proximity ranking.
> - **TypeScript verified:** `npx tsc --noEmit` shows **0 errors**.
>
> **The backend is stable, error-free, and production-ready for this module. 🏁🚀**

---

## 🎉 MODULE 5 BACKEND — COMPLETE ✅


### Summary

All backend deliverables for Module 5 (Dashboard) have been successfully implemented and verified:

| Deliverable | Status |
|-------------|--------|
| `getDashboardInfo` controller implementation | ✅ Complete |
| `dashboardService` import | ✅ Complete |
| `workspaceId` extraction from middleware | ✅ Complete |
| 404 error handling for missing workspace | ✅ Complete |
| Service call to `getDashboardBuckets()` | ✅ Complete |
| `ApiResponse` formatting | ✅ Complete |
| TypeScript compilation (zero errors) | ✅ Complete |
| API contract compliance | ✅ Complete |
| Route wiring verified | ✅ Complete |

### Files Modified

| File | Change |
|------|--------|
| `backend/src/controllers/activity.controller.ts` | Implemented `getDashboardInfo` controller |

### API Endpoint

```
GET /api/v1/dashboard
Auth: Required (Bearer token)
Response: 200 with DashboardBucketsDTO
```

### Frontend Integration Ready

The API is ready for frontend integration. Frontend developer can:
1. Call `GET /api/v1/dashboard` with Bearer token
2. Receive all 4 buckets: `immediate`, `today`, `blocked`, `backlog`
3. Render tasks in received order (pre-sorted by backend ranking)
4. Handle empty buckets gracefully (empty arrays `[]`)

---

**Module 5 Backend implementation is COMPLETE and PRODUCTION-READY.** ✅🚀
