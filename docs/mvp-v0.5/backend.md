# Backend Documentation (MVP v0.5)

## File Structure
Relevant directories and files in `backend/src/`:

```text
backend/src/
├── config/
│   ├── index.ts        # Environment configuration
│   ├── pg.ts           # PostgreSQL (pg pool) setup
│   └── supabase.ts     # Supabase client setup
├── controllers/
│   ├── activity.controller.ts  # Dashboard/Feed logic
│   ├── comment.controller.ts   # Threaded comment logic
│   ├── task.controller.ts      # Core task/assignment/dependency logic
│   └── workspace.controller.ts # Workspace/Member creation logic
├── migrations/
│   ├── 001_initial_schema.sql  # Main tables/enums/indexes
│   └── 002_auth_users_trigger.sql # Supabase Auth trigger function
├── routes/
│   ├── v1.routes.ts            # Versioning aggregator (/api/v1)
│   ├── activity.routes.ts      # Dashboard and feed endpoints
│   ├── comment.routes.ts       # Comment modification endpoints
│   ├── task.routes.ts          # Task CRUD endpoints
│   └── workspace.routes.ts     # Workspace management endpoints
├── services/                   # Business logic (WIP)
├── utils/
│   ├── ApiError.ts             # Custom error classes
│   ├── ApiResponse.ts          # Unified JSON response wrapper
│   └── catchAsync.ts           # Controller wrapper for error handling
└── middlewares/
    └── auth.middleware.ts      # Supabase JWT & Postgres User lookup
```

## Database Schema (PostgreSQL)

### Table: `public.users`
Shadow profile matching Supabase's internal auth users.
| Column       | Type        | Description                |
| :----------- | :---------- | :------------------------- |
| `id`         | UUID (PK)   | Matched to `auth.users.id` |
| `email`      | TEXT        | Unique user email          |
| `name`       | TEXT        | Full name from metadata    |
| `created_at` | TIMESTAMPTZ | Date of creation           |

### Table: `public.workspaces`
Central container for tasks and members.
| Column     | Type      | Description            |
| :--------- | :-------- | :--------------------- |
| `id`       | UUID (PK) | Unique workspace ID    |
| `name`     | TEXT      | Name of the workspace  |
| `owner_id` | UUID (FK) | Unique workspace owner |

### Table: `public.tasks`
Core work units with support for hierarchy and blocking.
| Column             | Type          | Description                                |
| :----------------- | :------------ | :----------------------------------------- |
| `id`               | UUID (PK)     | Unique task ID                             |
| `workspace_id`     | UUID (FK)     | Workspace owner                            |
| `parent_task_id`   | UUID (FK)     | Matched to another task (supports nesting) |
| `title`            | TEXT          | Task title                                 |
| `description`      | TEXT          | Full description                           |
| `objective`        | TEXT          | Why this task exists                       |
| `success_criteria` | TEXT          | What 'done' looks like                     |
| `status`           | task_status   | Enum (backlog, todo, in-progress, done)    |
| `priority`         | task_priority | Enum (low, medium, high, urgent)           |
| `start_date`       | TIMESTAMPTZ   | When task can begin                        |
| `due_date`         | TIMESTAMPTZ   | When task must be finished                 |

### Table: `public.activity_logs`
Append-only audit feed.
| Column         | Type            | Description                                     |
| :------------- | :-------------- | :---------------------------------------------- |
| `id`           | UUID (PK)       | Log ID                                          |
| `workspace_id` | UUID (FK)       | Workspace context                               |
| `entity_type`  | log_entity_type | Enum (task, comment, workspace)                 |
| `entity_id`    | UUID            | Reference ID (no FK to allow for deleted items) |
| `action_type`  | log_action_type | Enum of all tracked actions                     |
| `old_value`    | JSONB           | Change from state                               |
| `new_value`    | JSONB           | Change to state                                 |

## API Routing (v1)

### Workspaces
- `POST   /api/v1/workspaces` - Create workspace
- `GET    /api/v1/workspaces/:id` - Fetch details
- `GET    /api/v1/workspaces/:id/members` - List members
- `POST   /api/v1/workspaces/:id/members` - Add member
- `PATCH  /api/v1/workspaces/:id/members/:userId` - Change role
- `DELETE /api/v1/workspaces/:id/members/:userId` - Remove member

### Tasks
- `POST   /api/v1/tasks` - Create task/subtask
- `GET    /api/v1/tasks` - List tasks (Filtered & Paginated)
- `GET    /api/v1/tasks/:id` - Fetch single task details
- `PATCH  /api/v1/tasks/:id` - Update general details
- `PATCH  /api/v1/tasks/:id/status` - Specialized status update
- `DELETE /api/v1/tasks/:id` - Delete task (Cascades to subtasks)
- `POST   /api/v1/tasks/:id/assignees` - Add user assignee
- `DELETE /api/v1/tasks/:id/assignees/:userId` - Remove assignee
- `POST   /api/v1/tasks/:id/dependencies` - Add task block
- `DELETE /api/v1/tasks/:id/dependencies/:blockedByTaskId` - Remove block

### Collaboration
- `GET    /api/v1/tasks/:id/comments` - Paginated task comments
- `POST   /api/v1/tasks/:id/comments` - Create comment or reply
- `DELETE /api/v1/comments/:id` - Hard delete (Cascades to replies)

### Dashboard & Logs
- `GET    /api/v1/dashboard` - Fetches the rule-based dashboard buckets
- `GET    /api/v1/activity` - Fetches the paginated workspace activity feed
