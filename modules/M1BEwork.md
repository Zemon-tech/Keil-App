# Module 1 — Backend Implementation Guide (Tasks Core)

This document provides specific, step-by-step instructions for the Backend Developer to implement the **Tasks Core** module.

---

## 🏗️ Step 0: Authentication & Context Setup
Before starting the controllers, ensure the `workspaceId` is globally available in every request.

### Task 0.1: Update Auth Middleware
- **File:** `backend/src/middlewares/auth.middleware.ts`
- **Action:** In the `protect` middleware, after attaching `req.user`, fetch the user's workspace ID and attach it to the request object.
- **Why?** Since every task operation requires `workspace_id`, fetching it once in middleware avoids redundant database calls in every controller.
- **Implementation Note:**
  ```typescript
  // Find workspace_id from public.workspace_members table
  const workspaceResult = await pool.query(
    'SELECT workspace_id FROM public.workspace_members WHERE user_id = $1', 
    [supabaseUser.id]
  );
  if (workspaceResult.rows.length > 0) {
    (req as any).workspaceId = workspaceResult.rows[0].workspace_id;
  }
  ```

---

## 🛠️ Step 1: Task Controllers Implementation
Implement all stubs in `backend/src/controllers/task.controller.ts`.

### 1.1 `createTask` (POST /api/v1/tasks)
*   **Source Fields:** `title` (required), `description`, `objective`, `success_criteria`, `status`, `priority`, `start_date`, `due_date`, `parent_task_id`.
*   **Service Call:** `taskService.createTask()`
*   **Logic:**
    1. Parse and validate dates (ensure `ISOString` to `Date` object conversion).
    2. Pass `req.workspaceId` and `req.user.id` (as `created_by`).
    3. Return `201 Created` with `ApiResponse`.

### 1.2 `getTasks` (GET /api/v1/tasks)
*   **Query Params:** `status`, `priority`, `assignee_id`, `limit` (default 20), `offset` (default 0), `sort_by`, `sort_order`.
*   **Service Call:** `taskService.getTasksByWorkspace()`
*   **Logic:**
    1. Construct a `TaskQueryOptions` object from `req.query`.
    2. Ensure `limit` and `offset` are parsed as numbers.
    3. Call service and return `200 OK` with `ApiResponse(data)`.

### 1.3 `getTaskById` (GET /api/v1/tasks/:id)
*   **Params:** `req.params.id`
*   **Service Call:** `taskService.getTaskById()`
*   **Security:** 
    1. Fetch task details.
    2. Check if `task.workspace_id === req.workspaceId`.
    3. If not, throw `ApiError(404, 'Task not found')` to prevent data leaking.

### 1.4 `updateTask` (PATCH /api/v1/tasks/:id)
*   **Fields:** Any subset of task fields.
*   **Service Call:** `taskService.updateTask()`
*   **Logic:**
    1. Pass `taskId`, `req.body`, `req.user.id`, and `req.workspaceId`.
    2. The service handles the Activity Logging internally based on `userId` and `workspaceId`.

### 1.5 `changeTaskStatus` (PATCH /api/v1/tasks/:id/status)
*   **Body:** `{ "status": "..." }`
*   **Service Call:** `taskService.changeTaskStatus()`
*   **Critical Detail:** 
    1. If status is being set to `done`, the service will check dependencies.
    2. If blocked, it throws an `ApiError(400)`. Your controller just needs to call the service and let errors flow to `catchAsync`.

### 1.6 `deleteTask` (DELETE /api/v1/tasks/:id)
*   **Service Call:** `taskService.deleteTask()`
*   **Logic:**
    1. Pass `taskId`, `req.user.id`, and `req.workspaceId`.
    2. Service performs a "Soft Delete".

---

## 🛡️ Validation & Quality Rules (Mandatory)

1.  **Workspace Isolation:** Every GET/PATCH/DELETE request **must** verify that the task belongs to the user's `req.workspaceId`. Never trust a raw ID from the URL without checking ownership.
2.  **Enum Matching:** 
    *   Status: `backlog | todo | in-progress | done`
    *   Priority: `low | medium | high | urgent`
3.  **Date Validation:** Ensure `due_date` is never before `start_date`. Check this early in the controller to return a clean `400 Bad Request`.
4.  **Try-Catch Cleanliness:** Use the `catchAsync` wrapper for all functions. Do not write manual try-catch blocks in controllers.
5.  **Response Format:** Use the `ApiResponse` class for all successful responses.

---

## ✅ Module 1 Backend Checklist

### [x] Infrastructure
- [x] `req.workspaceId` is successfully attached in `auth.middleware.ts`.
- [x] Task Routes are correctly wired to the implemented controllers.

### [x] CRUD Operations
- [x] `createTask` persists data correctly to DB.
- [x] `getTasks` returns tasks filtered by the user's current workspace.
- [x] `getTasks` supports pagination (`limit`, `offset`) and sorting.
- [x] `getTaskById` returns full task details including assignees.
- [x] `updateTask` successfully updates partial fields.
- [x] `deleteTask` soft-deletes the task and its associations.

### [x] Business Logic & Security
- [x] Blocking logic: `changeTaskStatus` fails with `400` if dependencies are incomplete.
- [x] Hierarchy: `parent_task_id` allows creating subtasks.
- [x] Workspace Guard: Users cannot view/edit/delete tasks from other workspaces.
- [x] Activity Logging: Every action (create, update, status change) creates an entry in the `activity_logs` table.

### [x] API Contract Stability
- [x] Enums match frontend requirements (`urgent` instead of `critical`, lowercase status).
- [x] Response payloads follow the `TaskDTO` structure defined in `task.service.ts`.
@