# 📘 Documentation Plan — Backend Implementation

> **File Source**: `docs/repository/backend.md`
> **Goal**: Understand how the backend is built — types, repositories, services, business rules, and error handling — all in one simple guide.

---

## 🗺️ What Is This File About?

This file explains **the full backend code structure** of the project.

It has **3 main building blocks**:

| Block | File Location | Job |
|---|---|---|
| **Types** | `types/` | Defines the shape of all data |
| **Repositories** | `repositories/` | Talks directly to the database |
| **Services** | `services/` | Contains all business rules & logic |

> Think of it like a factory: **Types = Blueprint**, **Repository = Raw Material Store**, **Service = Assembly Line**

---

## 📋 Documentation Plan — Section by Section

---

### ✅ Section 1: File Structure

**What it covers**: How all the backend files are organized into folders.

**Simple Explanation**:
```
backend/src/
├── types/         → All TypeScript data definitions
├── repositories/  → One file per database table
├── services/      → One file per feature (tasks, workspace, etc.)
└── migrations/    → SQL scripts that change the database
```

**Key Files to Know**:

| File | Purpose |
|---|---|
| `types/enums.ts` | All allowed values (e.g. task status, priority) |
| `types/entities.ts` | Shape of database rows (interfaces) |
| `types/repository.ts` | How query options are structured |
| `repositories/base.repository.ts` | Shared database methods for all repositories |
| `repositories/index.ts` | Exports one ready-to-use copy of each repository |

**Doc Goal**: Show the folder tree and explain each folder in 1 sentence.

---

### ✅ Section 2: Type Definitions (3 Parts)

> Types define the **shape of all data** flowing through the backend.

---

#### Part A — Enums (`types/enums.ts`)

These are the **allowed values** — like a dropdown list stored in code.

| Enum | Allowed Values |
|---|---|
| `TaskStatus` | `backlog`, `todo`, `in-progress`, `done` |
| `TaskPriority` | `low`, `medium`, `high`, `urgent` |
| `MemberRole` | `owner`, `admin`, `member` |
| `LogEntityType` | `task`, `comment`, `workspace` |
| `LogActionType` | `task_created`, `task_deleted`, `status_changed`, etc. |

> ✅ These match exactly what PostgreSQL stores in the database.

---

#### Part B — Entities (`types/entities.ts`)

These are **TypeScript interfaces** that mirror each database table.

| Entity | Key Fields | Soft Delete? |
|---|---|---|
| `User` | id, email, name | ❌ No |
| `Workspace` | id, name, owner_id | ✅ Yes |
| `Task` | id, workspace_id, title, status, priority | ✅ Yes |
| `Comment` | id, task_id, user_id, content | ✅ Yes |
| `TaskAssignee` | id, task_id, user_id | ❌ No |
| `TaskDependency` | id, task_id, depends_on_task_id | ❌ No |
| `ActivityLog` | id, workspace_id, entity_type, action_type | ❌ No |

> Entities with ✅ Soft Delete have a `deleted_at` field — they are never fully removed.

---

#### Part C — Repository Types (`types/repository.ts`)

These define **how to filter and page** data when querying.

```
PaginationOptions  →  limit (how many), offset (skip how many)
TaskQueryOptions   →  filters (status, priority, assignee, dates)
                      sort   (which field, ascending or descending)
                      pagination (limit + offset)
                      includeDeleted (show deleted records?)
```

---

### ✅ Section 3: Repository Layer

> Repositories are the **only layer that touches the database**.

---

#### Part A — Base Repository (`base.repository.ts`)

This is the **shared parent class**. Every repository extends it and gets these methods for free:

| Method | What It Does |
|---|---|
| `findById` | Get one record by ID |
| `findAll` | Get a list of records (with optional filters) |
| `create` | Add a new record |
| `update` | Change an existing record |
| `delete` | Permanently remove a record |
| `softDelete` | Mark a record as deleted (sets `deleted_at`) |
| `restore` | Bring a soft-deleted record back |
| `count` | Count how many records exist |
| `executeInTransaction` | Run multiple DB steps as one safe block |
| `checkConnection` | Check if database is reachable |

**Key Features**:
```
✅ Generic — works with any data type (Task, User, Comment, etc.)
✅ Auto-hides deleted records (deleted_at = NULL filter)
✅ Supports transactions (pass the same `client` to all steps)
✅ Uses pg Pool for connection management
```

---

#### Part B — Specialized Repositories

Each repository **extends Base** and adds its own custom methods:

---

**UserRepository** — Finds users and their workspace:
```
findByEmail(email)        → Find user by email address
getUserWorkspace(userId)  → Find the workspace a user belongs to
```

---

**WorkspaceRepository** — Manages workspaces and members:
```
findByOwnerId(ownerId)                → Get workspace by owner
findByUserId(userId)                  → Get workspace a user is part of
getMembers(workspaceId)               → List all members
addMember(workspaceId, userId, role)  → Add someone to a workspace
updateMemberRole(...)                 → Change someone's role
removeMember(workspaceId, userId)     → Remove someone
isMember(workspaceId, userId)         → Check if someone belongs
```

---

**TaskRepository** — The most feature-rich repository:
```
findByWorkspace(workspaceId, options)  → Get tasks (with filters/sort/pagination)
findSubtasks(parentTaskId)            → Get child tasks
findWithAssignees(taskId)             → Task + list of assigned users
findWithDependencies(taskId)          → Task + what it depends on + what blocks it
findByAssignee(userId, workspaceId)   → All tasks assigned to a user
findByDueDate(workspaceId, start, end)→ Tasks in a date range
updateStatus(taskId, newStatus)        → Change task status

Dashboard helpers:
findUrgentAndNearDue(workspaceId)     → Urgent or almost-due tasks
findDueToday(workspaceId)             → Tasks due today
findBlocked(workspaceId)              → Tasks stuck on dependencies
findBacklog(workspaceId)              → Backlog tasks
```

---

**TaskAssigneeRepository** — Handles who is assigned to tasks:
```
assign(taskId, userId)        → Assign a user to a task
unassign(taskId, userId)      → Remove assignment
findByTask(taskId)            → All assignees of a task
findByUser(userId, workspaceId) → All tasks assigned to a user
isAssigned(taskId, userId)    → Check if assigned
```

---

**TaskDependencyRepository** — Manages task dependencies:
```
addDependency(taskId, dependsOnTaskId)    → Link two tasks
removeDependency(taskId, dependsOnTaskId) → Remove link
findDependencies(taskId)                  → What this task depends on
findBlockedTasks(taskId)                  → What tasks depend on this one
checkAllDependenciesComplete(taskId)      → Are all dependencies done?
hasCircularDependency(taskId, ...)        → Would this create a loop?
```

---

**CommentRepository** — Handles task comments:
```
findByTask(taskId, options)       → All comments on a task
findThreaded(taskId)              → Comments with nested replies
findReplies(parentCommentId)      → Replies to a comment
```

---

**ActivityRepository** — Tracks what happened in the system:
```
log(data)                              → Save a new activity log
findByWorkspace(workspaceId, options)  → Activity in a workspace
findByEntity(entityType, entityId)     → Activity for one item
findByUser(userId, workspaceId)        → Activity by a user
findRecent(workspaceId, limit)         → Latest N activities
```

---

### ✅ Section 4: Service Layer

> Services contain **all business logic**. They sit between controllers and repositories.

---

#### The Service Pattern (3 Steps)

Every service follows the same 3-step pattern:

```
Step 1 → Define DTOs    (what the API response looks like)
Step 2 → Convert        Entity (raw DB object) → DTO (clean API format)
Step 3 → Service Method → Validate → Execute in Transaction → Return DTO
```

> **Entity** = what the database returns (has raw Date objects, etc.)
> **DTO** = what the API sends back (has strings, clean formats)

---

#### Available Services — Quick Reference

**task.service.ts**:
| Method | What It Does |
|---|---|
| `createTask` | Create a task + log the activity |
| `getTasksByWorkspace` | List tasks with filters, sorting, pagination |
| `getTaskById` | Get one task by ID |
| `updateTask` | Update task + log changes |
| `deleteTask` | Soft delete a task |
| `changeTaskStatus` | Change status (validates dependencies first) |
| `assignUserToTask` | Add a user to a task |
| `removeUserFromTask` | Remove a user from a task |
| `addDependency` | Add dependency (checks for circular loops) |
| `removeDependency` | Remove a dependency |

---

**workspace.service.ts**:
| Method | What It Does |
|---|---|
| `createWorkspace` | Create workspace (max 1 per user enforced) |
| `getWorkspaceById` | Get workspace by ID |
| `getUserWorkspace` | Get the workspace belonging to a user |
| `updateWorkspace` | Edit workspace details |
| `deleteWorkspace` | Soft delete workspace |
| `getWorkspaceMembers` | List members with pagination |
| `addWorkspaceMember` | Add someone (enforces 1 workspace per user rule) |
| `updateMemberRole` | Change role (owner cannot be changed) |
| `removeMember` | Remove someone (owner cannot be removed) |
| `isWorkspaceMember` | Check if user is in workspace |

---

**comment.service.ts**:
| Method | What It Does |
|---|---|
| `createComment` | Add a comment or a reply |
| `getCommentsByTask` | List all comments with pagination |
| `getThreadedComments` | Get nested comment tree |
| `getCommentById` | Get one comment |
| `getCommentReplies` | Get replies to a comment |
| `deleteComment` | Soft delete (cascades to all replies) |
| `hardDeleteComment` | Permanently delete |

---

**activity.service.ts**:
| Method | What It Does |
|---|---|
| `getWorkspaceActivity` | Get activity with filtering + pagination |
| `getEntityActivity` | Get activity for one item (task, comment, etc.) |
| `getUserActivity` | Get activity done by a user |
| `getRecentActivity` | Get latest activity |
| `getActivityFeed` | Paginated feed of activity |

---

**dashboard.service.ts**:
| Method | What It Does |
|---|---|
| `getDashboardBuckets` | Get ALL dashboard sections at once (with ranking) |
| `getImmediateTasks` | Urgent + near-deadline tasks |
| `getTodayTasks` | Tasks due today |
| `getBlockedTasks` | Tasks stuck waiting on dependencies |
| `getBacklogTasks` | All backlog tasks |

---

### ✅ Section 5: Business Logic Rules

> These are the **built-in rules** the system enforces automatically.

---

#### Rule 1 — 1 Workspace Per User
```
Before creating a workspace → Check if user already owns one
If yes → Throw error: "User already owns a workspace"
```

---

#### Rule 2 — Circular Dependency Prevention
```
Before adding dependency A → B:
  Run a recursive SQL query to check if B already depends on A
If circular → Block the dependency from being added
```

SQL used (recursive CTE):
```
WITH RECURSIVE dependency_chain AS (
  SELECT task → its dependency
  UNION
  SELECT next level dependencies...
)
Check if the chain comes back to the original task
```

---

#### Rule 3 — Dependencies Must Complete Before "Done"
```
Before changing status to DONE:
  Check if ALL dependencies are also DONE
If not all done → Throw error: "Some dependencies are incomplete"
```

---

#### Rule 4 — Date Validation
```
Before creating or updating a task:
  If due_date < start_date → Throw error: "due_date must be on or after start_date"
```

---

### ✅ Section 6: Transactions

> Transactions **group multiple DB steps together**. If one fails, ALL are rolled back.

---

#### Simple Transaction (2 steps together):
```
Begin transaction
  Step 1: Create the task
  Step 2: Log the activity
If both succeed → Commit ✅
If either fails  → Rollback ❌ (nothing is saved)
```

---

#### Complex Transaction (multiple conditional steps):
```
Begin transaction
  Step 1: Get old task data
  Step 2: Update the task
  Step 3: Log "status changed"  ← only if status changed
  Step 4: Log "priority changed" ← only if priority changed
Commit ✅ or Rollback ❌
```

> All steps share the same `client` parameter to stay in the same transaction.

---

### ✅ Section 7: Soft Delete System

> Records are **never truly deleted** — they're just hidden using `deleted_at`.

---

#### How It Works:
```
deleted_at = NULL        → Record is ACTIVE  ✅ (shown to users)
deleted_at = (timestamp) → Record is DELETED 🗑️ (hidden from users)
```

---

#### Three Operations:

| Operation | What It Does |
|---|---|
| `softDelete(id)` | Sets `deleted_at = NOW()` on the record |
| `restore(id)` | Sets `deleted_at = NULL` (brings record back) |
| `findAll(includeDeleted=false)` | Auto-filters out deleted records |

---

#### Database Setup:
```sql
ALTER TABLE tasks ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
CREATE INDEX idx_tasks_deleted_at ON tasks(deleted_at) WHERE deleted_at IS NULL;
```
> The index makes filtering active records very fast.

---

### ✅ Section 8: Error Handling

> Errors are **caught at each layer** and converted into clean responses.

---

#### Error Flow (3 Layers):
```
Repository Layer
  → Throws raw DB errors (connection broken, unique constraint, etc.)
         ↓
Service Layer
  → Catches those errors
  → Throws clean ApiError (with HTTP code + user-friendly message)
         ↓
Controller Layer
  → Uses catchAsync wrapper (no try/catch needed in controller)
  → Sends standardized JSON error response to the client
```

---

#### Error at Each Layer:

| Layer | Error Source | What It Throws |
|---|---|---|
| **Repository** | DB connection, SQL constraints | Raw database error |
| **Service** | Business rule violations | `ApiError(400/404/500, "message")` |
| **Controller** | Not found, unauthorized | Passes to error middleware |

---

### ✅ Section 9: Testing Strategy (3 Levels)

> There are **3 levels of tests** to cover every part of the backend.

---

#### Level 1 — Unit Tests for Repositories
```
Test each repository method individually
Connect to a real or test database
Examples:
  ✅ findById → returns the correct task
  ✅ softDelete → sets deleted_at correctly
```

---

#### Level 2 — Unit Tests for Services
```
Mock the repositories (fake DB calls)
Test only the business logic
Examples:
  ✅ createTask → creates task AND logs activity
  ✅ changeTaskStatus to DONE → fails if dependencies not complete
```

---

#### Level 3 — Integration Tests (Full API)
```
Send real HTTP requests to the running server
Check status codes and response body
Examples:
  ✅ POST /api/v1/tasks → 201 Created
  ✅ GET /api/v1/tasks/:id → returns correct task data
```

---

## 🧠 Quick Summary (TL;DR)

```
Client sends request
        ↓
Controller  →  Reads params, calls service
        ↓
Service     →  Validates rules, calls repository, converts Entity → DTO
        ↓
Repository  →  Runs SQL query, returns Entity
        ↓
PostgreSQL  →  Stores / returns data
        ↓
Response sent back ✅
```

**Core Rules in One Line Each**:
- 🏗️ **Structure** → Types → Repositories → Services (strict separation)
- 🗑️ **Soft Delete** → Records are hidden not removed (`deleted_at`)
- 🔄 **Transactions** → All related steps succeed or all fail together
- 🔒 **Business Rules** → 1 workspace/user, no circular deps, date checks
- ❌ **Error Handling** → Repository → Service (ApiError) → Controller (catchAsync)
- 🧪 **Testing** → Unit (repos), Unit (services mocked), Integration (full API)

---

*Documentation plan created for `docs/repository/backend.md`*
