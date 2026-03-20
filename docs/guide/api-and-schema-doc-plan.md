# 📘 API & Schema Rules — Documentation Plan

> **Source File:** `.agent/rules/api-and-schema.md`
> **Purpose:** This file defines the strict rules any developer or AI agent must follow when working on **API routes**, **backend services**, or **database schema changes** in the ClarityOS backend.
> **When it activates:** Automatically triggered on model decision whenever API or schema work is being done.

---

## 🗺️ Big Picture Overview

This rule file has **3 major sections**. Think of them as 3 pillars that hold the backend together:

```
┌──────────────────────────────────────────────────────┐
│           api-and-schema.md  (3 Pillars)             │
├──────────────────────┬───────────────┬───────────────┤
│  1. Database Schema  │  2. API Design │  3. Backend   │
│     Guidelines       │   Principles  │  Architecture │
└──────────────────────┴───────────────┴───────────────┘
```

---

## 📦 Section 1 — Database Schema Guidelines (Supabase PostgreSQL)

> **What it covers:** How to design and structure the database tables safely and correctly.

### 1.1 One Workspace Per User (Hard Rule)
| Rule | How it's enforced |
|------|------------------|
| A user belongs to **exactly ONE workspace** | `UNIQUE(user_id)` in `workspace_members` |
| Each workspace has **one owner** | `UNIQUE(owner_id)` in `workspaces` |

**Simple explanation:** No user can join two workspaces. The database itself blocks it.

---

### 1.2 Foreign Keys & Cascading (Cleanup Rules)
| Behavior | When to use | Example |
|----------|------------|---------|
| `ON DELETE CASCADE` | When child records should auto-delete | Delete task → auto-delete its comments, dependencies |
| `ON DELETE RESTRICT` | When deletion should be blocked | Can't delete a user who has created tasks |

**Simple explanation:** Cascade = clean up after yourself. Restrict = prevent accidents.

---

### 1.3 Fixed Value Types (ENUMs)
Use PostgreSQL `ENUM` for columns that can only have specific values:

| ENUM Name | Allowed Values |
|-----------|---------------|
| `task_status` | `backlog` · `todo` · `in-progress` · `done` |
| `task_priority` | `low` · `medium` · `high` · `urgent` |
| `member_role` | `owner` · `admin` · `member` |

**Simple explanation:** ENUMs are like a dropdown menu — only listed options are accepted.

---

### 1.4 Activity Logs (Append-Only Table)
- **Never update or delete** activity log rows — only `INSERT`.
- `entity_id` is a plain UUID, **NOT a foreign key** — so logs survive even if the entity is deleted.
- Store before/after changes as `JSONB` in `old_value` and `new_value` columns.

**Simple explanation:** Activity logs are like a permanent history book — you can only add pages, never erase them.

---

### 1.5 Date & Time (Always Use Timezone)
- ✅ Always use: `TIMESTAMPTZ` (Timestamp **with** Time Zone)
- ✅ Always default to: `NOW()`
- ❌ Never use: plain `TIMESTAMP` (no timezone)

**Simple explanation:** Always store time with timezone info so it works globally.

---

### 1.6 Validation Constraints (Business Logic in DB)
Enforce data rules at the database level using `CHECK` constraints:

| Constraint | What it prevents |
|-----------|-----------------|
| `CHECK (due_date >= start_date)` | Due date can't be before start date |
| `CHECK (task_id <> depends_on_task_id)` | A task can't depend on itself |

**Simple explanation:** Put safety guards in the database, not just in the code.

---

## 🌐 Section 2 — API Design Principles (RESTful)

> **What it covers:** How all API routes must be named, structured, and called.

### 2.1 Versioning (Mandatory Prefix)
- Every API route **must** start with `/api/v1/`
- Current version: **v1**

```
✅ /api/v1/tasks
❌ /tasks
❌ /api/tasks
```

---

### 2.2 Resource Naming (Plural Nouns Only)
| ✅ Correct | ❌ Wrong |
|-----------|---------|
| `/api/v1/tasks` | `/task` |
| `/api/v1/workspaces` | `/getWorkspaces` |
| `/api/v1/users` | `/fetchUser` |

**Simple rule:** Name routes after things (nouns), never actions (verbs). Always plural.

---

### 2.3 HTTP Methods — What Each Does
| Method | Purpose | Example |
|--------|---------|---------|
| `GET` | Read data (safe, no changes) | `GET /api/v1/tasks` |
| `POST` | Create a new record | `POST /api/v1/tasks` |
| `PATCH` | Update part of a record | `PATCH /api/v1/tasks/:id` |
| `DELETE` | Remove a record | `DELETE /api/v1/tasks/:id` |

**Simple rule:** Match the action to the correct HTTP method — never use GET to create things.

---

### 2.4 Nested Routes (When to Nest)
Use nesting to show relationships, but keep it **shallow** (max 1 level deep):

```
✅ /api/v1/tasks/:id/comments       → comments for a task
✅ /api/v1/workspaces/:id/members   → members of a workspace

❌ /api/v1/workspaces/:id/tasks/:id/comments/:id   → too deep!
```

---

### 2.5 Global Context (No WorkspaceId Needed in Path)
- Since a user = one workspace, endpoints like `/api/v1/dashboard` and `/api/v1/activity` **don't need** `?workspaceId=...` in the URL.
- The backend automatically figures out the workspace from the logged-in user's session (JWT token).

**Simple explanation:** The server already knows who you are and which workspace you're in — no need to repeat it in every URL.

---

## 🏗️ Section 3 — Backend Implementation Architecture

> **What it covers:** How the backend code is organized into separate layers with clear responsibilities.

### 3.1 The 3-Layer Architecture (Separation of Concerns)

```
HTTP Request
     │
     ▼
┌─────────────┐
│   ROUTES    │  ← Just maps URL + HTTP method to a controller
│ (routes/)   │    Example: router.get('/tasks', tasksController.getAll)
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ CONTROLLERS │  ← Reads req.params / req.body, calls service, sends response
│(controllers)│    NO raw SQL here. NO deep business logic here.
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  SERVICES   │  ← All business logic + database queries live here
│ (services/) │    Pure TypeScript. No Express req/res objects here.
└─────────────┘
```

| Layer | Allowed to do | NOT allowed to do |
|-------|--------------|-------------------|
| Routes | Map paths to controllers | Business logic, SQL |
| Controllers | Read req, call service, send response | Write raw SQL, deep validation |
| Services | Business logic, DB queries | Use `req` or `res` objects |

---

### 3.2 Error Handling (One Central Place)
- Wrap **every** controller with `catchAsync(...)` — this sends errors to central error middleware automatically.
- ❌ **Never** write `try/catch` blocks inside individual controllers.

```ts
// ✅ Correct
export const getTask = catchAsync(async (req, res) => {
  const task = await taskService.getById(req.params.id);
  res.json(new ApiResponse(200, task, "Task fetched"));
});

// ❌ Wrong
export const getTask = async (req, res) => {
  try { ... } catch (err) { res.status(500).json({error: err.message}) }
};
```

---

### 3.3 Standardized Responses (Always Use ApiResponse)
Every successful response **must** use the custom `ApiResponse` class:

```ts
new ApiResponse(statusCode, data, "Human readable message")
```

| Part | Example |
|------|---------|
| Status Code | `200`, `201` |
| Data | The actual data object or array |
| Message | `"Task created successfully"` |

**Simple rule:** All success responses look the same — consistent for the frontend.

---

### 3.4 Authorization (JWT via Supabase)
- All protected routes use the `auth.middleware.ts` middleware.
- The middleware reads the **Supabase JWT** token and attaches the user to `req.user`.
- Services and controllers can then read `req.user` to know who is making the request.

**Simple flow:**
```
Client sends JWT token in header
       ↓
auth.middleware.ts verifies it with Supabase
       ↓
Sets req.user = { id, email, ... }
       ↓
Controller/Service reads req.user
```

---

## ✅ Quick Reference Cheat Sheet

| Topic | The Rule |
|-------|---------|
| Workspace per user | ONE workspace only — enforced by DB UNIQUE constraint |
| Cascade deletes | Use `ON DELETE CASCADE` for child records |
| User deletes | Use `ON DELETE RESTRICT` to block accidental deletion |
| Fixed values | Use PostgreSQL ENUMs |
| Activity logs | Append-only, entity_id is NOT a FK |
| Timestamps | Always `TIMESTAMPTZ`, default `NOW()` |
| DB validation | Use `CHECK` constraints |
| API prefix | Always `/api/v1/` |
| Route names | Plural nouns only, no verbs |
| HTTP methods | GET=read, POST=create, PATCH=update, DELETE=remove |
| Route nesting | Max 1 level deep |
| Error handling | `catchAsync` on all controllers, no individual try/catch |
| Responses | Always use `new ApiResponse(code, data, message)` |
| Auth | `auth.middleware.ts` sets `req.user` from JWT |
| Services | No `req`/`res` objects — pure TypeScript functions |

---

## 📁 File Structure Reference

```
backend/
├── routes/          ← Section 3.1 — map URLs to controllers
├── controllers/     ← Section 3.1 — handle req/res cycle
├── services/        ← Section 3.1 — business logic + DB queries
├── middlewares/
│   └── auth.middleware.ts   ← Section 3.4 — JWT authorization
└── utils/
    ├── catchAsync.ts        ← Section 3.2 — error wrapper
    └── ApiResponse.ts       ← Section 3.3 — standard response class
```

---

> 📌 **Remember:** These rules are enforced automatically whenever you work on API routes, backend services, or database schema. Following them ensures the backend stays consistent, safe, and maintainable.
