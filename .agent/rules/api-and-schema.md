---
trigger: model_decision
description: when working on API routes, backend services, or modifying the database schema.
---

# API & Database Schema Rules

This document outlines the strict guidelines for designing and implementing API routes and database schema changes in the ClarityOS backend.

## 1. Database Schema Guidelines (Supabase PostgreSQL)

- **1 Workspace Per User**: A user can only belong to **ONE** workspace total globally. This is enforced by `UNIQUE(user_id)` in `workspace_members` and `UNIQUE(owner_id)` in `workspaces`.
- **Foreign Keys & Cascading**: Always use `ON DELETE CASCADE` appropriately to clean up orphan records (e.g., deleting a task should delete its dependencies, comments, and assignee records). Use `ON DELETE RESTRICT` for users to prevent deleting users who have created tasks.
- **Enums**: Use PostgreSQL `ENUM` types for fixed constraints:
  - `task_status`: `backlog`, `todo`, `in-progress`, `done`
  - `task_priority`: `low`, `medium`, `high`, `urgent`
  - `member_role`: `owner`, `admin`, `member`
- **Activity Logs**: 
  - `activity_logs` is append-only.
  - `entity_id` is a bare `UUID` (NOT a foreign key) so logs remain even if the entity is deleted.
  - Store previous/new states in `JSONB` columns (`old_value`, `new_value`).
- **Dates & Times**: Always use `TIMESTAMPTZ` (Timestamp with Time Zone), defaulting to `NOW()`. 
- **Validation Constraints**: Enforce business logic in the database where possible (e.g., `CHECK (due_date >= start_date)` and `CHECK (task_id <> depends_on_task_id)`).
- **Schema-Code Consistency**: TypeScript entity types and repository queries are NOT ground truth for the DB schema — the applied migration state is. When a `column does not exist` 500 occurs, search ALL migration files (not just `001_initial_schema.sql`) for the column. If found in a later migration, it hasn't been applied to the live DB. If not found anywhere, the migration needs to be written. The full chain must be in sync: `Applied migrations ↔ Entity type ↔ Repository queries ↔ Service logic`.
- **GROUP BY with computed JSON columns in CTEs**: `json` type has no equality operator in PostgreSQL — it cannot appear in GROUP BY via wildcard expansion (`SELECT *`). When a CTE computes a `json_build_object(...)` alias, the outer grouped query MUST enumerate columns explicitly (no `SELECT tlc.*`) and include the json column by name in both SELECT and GROUP BY.
  ```sql
  -- ❌ BROKEN: SELECT * expands to include json alias, which can't be grouped
  SELECT tlc.*, json_agg(r.*) as replies
  FROM top_level_comments tlc
  GROUP BY tlc.id, tlc.user_id  -- missing tlc.user, but * still pulls it in
  
  -- ❌ ALSO BROKEN: removing from GROUP BY doesn't help if SELECT * still includes it
  SELECT tlc.*, json_agg(r.*) as replies
  GROUP BY tlc.id, tlc.user_id, tlc.content, tlc.created_at, tlc.deleted_at
  
  -- ✅ CORRECT: explicit columns in SELECT + json column named in GROUP BY
  SELECT tlc.id, tlc.task_id, tlc.user_id, tlc.content, tlc.parent_comment_id,
         tlc.created_at, tlc.deleted_at, tlc.user, json_agg(r.*) as replies
  FROM top_level_comments tlc
  GROUP BY tlc.id, tlc.task_id, tlc.user_id, tlc.content, tlc.parent_comment_id,
           tlc.created_at, tlc.deleted_at, tlc.user
  ```
- **SQL 500 debugging order**: Get the actual PostgreSQL error string from server logs FIRST before reading query code. The error message identifies the exact clause and type that failed — guessing from code alone leads to wrong hypotheses.

## 2. pg Date Parsing Rules — Service Layer

When mapping query results to DTOs, `pg` only auto-parses `TIMESTAMPTZ` columns into `Date` objects at the **top level** of a result row. Values inside `json_build_object()`, `jsonb_build_object()`, or `json_agg()` are returned as plain JSON strings — never `Date` objects.

**Rule: never call `.toISOString()` directly on a field from inside a JSON aggregate.** Always use a safe helper:

```typescript
// ✅ Always use this pattern in DTO mappers
const toISO = (val: Date | string): string =>
  val instanceof Date ? val.toISOString() : val as string;

// ❌ CRASHES when val comes from inside json_build_object
created_at: comment.user.created_at.toISOString()

// ✅ Safe regardless of source
created_at: toISO(comment.user.created_at)
```

**pg parsing summary:**
- Top-level `TIMESTAMPTZ` column → `Date` object (auto-parsed)
- `TIMESTAMPTZ` inside `json_build_object` / `jsonb_build_object` → ISO string (not parsed)
- `TIMESTAMPTZ` inside `json_agg(row.*)` → ISO string (not parsed)

**When a query works but the endpoint still 500s** — the bug is in the mapping/service layer. Write a debug script that runs the query AND simulates the DTO mapper against real rows to find it immediately.

## 2. API Design Principles (RESTful)

- **Versioning**: All API routes must be prefixed with the version, current is `/api/v1/`.
- **Resource Naming**: Use plural nouns for resources (e.g., `/api/v1/tasks`, not `/task` or `/getTasks`).
- **HTTP Methods**: 
  - `GET` for reading (safe, idempotent)
  - `POST` for creating
  - `PATCH` for partial updates (e.g., changing just the status or title)
  - `DELETE` for removal
- **Nesting**: Use nested routes logically but avoid deep nesting. 
  - *Good*: `/api/v1/tasks/:id/comments`
  - *Good*: `/api/v1/workspaces/:id/members`
- **Global Context**: Since a user belongs to exactly one workspace, global endpoints like `/api/v1/dashboard` and `/api/v1/activity` do not need a `workspaceId` in the path. The backend service should extrapolate the workspace ID natively via the authenticated user context.

## 3. Backend Implementation Architecture

- **Separation of Concerns**:
  - **Routes** (`routes/`): Merely map HTTP verbs and paths to specific controllers.
  - **Controllers** (`controllers/`): Extract `req.params`, `req.body`, `req.query`, call the Service layer, and return standard API responses. Controllers should contain NO raw SQL or deep business validation.
  - **Services** (`services/`): Pure TypeScript functions executing business logic and database queries using the `pg` pool. Kept entirely separate from the `Request`/`Response` Express objects.
- **Error Handling**: Use the existing `catchAsync` wrapper on all controllers to pipe errors gracefully to the central error middleware. Do not scatter `try/catch` in controllers.
- **Standardized Responses**: All successful responses must use the custom `ApiResponse` class (e.g., `new ApiResponse(200, data, "Message")`).
- **Authorization**: Protected routes must extract the user from the Supabase JWT (implemented in `auth.middleware.ts`) and append it to `req.user`.
- **Relationship Endpoint Validation**: For any endpoint that creates a link between two entities (e.g., assignees, dependencies), validate both entity IDs before calling the service. Raw PostgreSQL FK violations (from non-existent IDs) produce 500s because they're not `ApiError` instances. Explicit validation returns a clean 404 instead.
  ```typescript
  // ✅ Validate both sides of a relationship
  const targetTask = await taskService.getTaskById(depends_on_task_id);
  if (!targetTask || targetTask.workspace_id !== workspaceId) throw new ApiError(404, "Dependency task not found");
  ```
