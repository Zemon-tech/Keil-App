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
