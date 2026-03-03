# Backend Implementation

## File Structure

```
backend/src/
├── types/
│   ├── index.ts              # Exports all types
│   ├── enums.ts              # Database enums (TaskStatus, TaskPriority, etc.)
│   ├── entities.ts           # Entity interfaces (Task, Workspace, etc.)
│   └── repository.ts         # Query types (PaginationOptions, TaskQueryOptions)
│
├── repositories/
│   ├── base.repository.ts    # Abstract base with CRUD + transactions
│   ├── user.repository.ts
│   ├── workspace.repository.ts
│   ├── task.repository.ts
│   ├── task-assignee.repository.ts
│   ├── task-dependency.repository.ts
│   ├── comment.repository.ts
│   ├── activity.repository.ts
│   └── index.ts              # Exports singleton instances
│
├── services/
│   ├── task.service.ts       # Task CRUD, assignments, dependencies
│   ├── workspace.service.ts  # Workspace CRUD, member management
│   ├── comment.service.ts    # Comment CRUD, threaded comments
│   ├── activity.service.ts   # Activity logs, feeds
│   └── dashboard.service.ts  # Dashboard buckets with ranking
│
└── migrations/
    └── 003_add_soft_delete.sql  # Adds deleted_at columns
```

## Type Definitions

### Enums (`types/enums.ts`)

TypeScript enums matching PostgreSQL enum types:

```typescript
export enum TaskStatus {
  BACKLOG = 'backlog',
  TODO = 'todo',
  IN_PROGRESS = 'in-progress',
  DONE = 'done'
}

export enum TaskPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent'
}

export enum MemberRole {
  OWNER = 'owner',
  ADMIN = 'admin',
  MEMBER = 'member'
}

export enum LogEntityType {
  TASK = 'task',
  COMMENT = 'comment',
  WORKSPACE = 'workspace'
}

export enum LogActionType {
  TASK_CREATED = 'task_created',
  TASK_DELETED = 'task_deleted',
  STATUS_CHANGED = 'status_changed',
  // ... all action types
}
```

### Entities (`types/entities.ts`)

Interfaces matching database tables:

| Entity | Key Fields | Soft Delete |
|:-------|:-----------|:------------|
| `User` | id, email, name | No |
| `Workspace` | id, name, owner_id | Yes |
| `WorkspaceMember` | id, workspace_id, user_id, role | No |
| `Task` | id, workspace_id, title, status, priority | Yes |
| `TaskAssignee` | id, task_id, user_id | No |
| `TaskDependency` | id, task_id, depends_on_task_id | No |
| `Comment` | id, task_id, user_id, content | Yes |
| `ActivityLog` | id, workspace_id, entity_type, action_type | No |

**Example Entity**:
```typescript
export interface Task {
  id: string;
  workspace_id: string;
  parent_task_id: string | null;
  title: string;
  description: string | null;
  objective: string | null;
  success_criteria: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  start_date: Date | null;
  due_date: Date | null;
  created_by: string;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}
```

### Repository Types (`types/repository.ts`)

Query options and filters:

```typescript
export interface PaginationOptions {
  limit: number;
  offset: number;
}

export interface TaskQueryOptions {
  filters?: {
    status?: TaskStatus | TaskStatus[];
    priority?: TaskPriority | TaskPriority[];
    assigneeId?: string;
    dueDateStart?: Date;
    dueDateEnd?: Date;
    parentTaskId?: string | null;
  };
  sort?: {
    field: string;
    order: 'ASC' | 'DESC';
  };
  pagination?: PaginationOptions;
  includeDeleted?: boolean;
}
```

## Repository Layer

### Base Repository (`repositories/base.repository.ts`)

Abstract class providing common operations:

| Method | Parameters | Returns | Description |
|:-------|:-----------|:--------|:------------|
| `findById` | id, client?, includeDeleted? | T \| null | Get single record |
| `findAll` | filters?, pagination?, client?, includeDeleted? | T[] | Get multiple records |
| `create` | data, client? | T | Insert new record |
| `update` | id, data, client? | T \| null | Update existing record |
| `delete` | id, client? | void | Hard delete record |
| `softDelete` | id, client? | T \| null | Set deleted_at |
| `restore` | id, client? | T \| null | Unset deleted_at |
| `count` | filters?, client?, includeDeleted? | number | Count records |
| `executeInTransaction` | callback | Promise<R> | Execute in transaction |
| `checkConnection` | - | boolean | Health check |

**Key Features**:
- Generic type support: `BaseRepository<T>`
- Automatic soft delete filtering
- Transaction support with client parameter
- Connection pooling via pg Pool

### Specialized Repositories

#### UserRepository
```typescript
class UserRepository extends BaseRepository<User> {
  findByEmail(email: string): Promise<User | null>
  getUserWorkspace(userId: string): Promise<Workspace | null>
}
```

#### WorkspaceRepository
```typescript
class WorkspaceRepository extends BaseRepository<Workspace> {
  findByOwnerId(ownerId: string): Promise<Workspace | null>
  findByUserId(userId: string): Promise<Workspace | null>
  getMembers(workspaceId: string, pagination?): Promise<WorkspaceMember[]>
  addMember(workspaceId: string, userId: string, role: MemberRole): Promise<WorkspaceMember>
  updateMemberRole(workspaceId: string, userId: string, role: MemberRole): Promise<WorkspaceMember | null>
  removeMember(workspaceId: string, userId: string): Promise<void>
  isMember(workspaceId: string, userId: string): Promise<boolean>
}
```

#### TaskRepository
```typescript
class TaskRepository extends BaseRepository<Task> {
  // Query methods
  findByWorkspace(workspaceId: string, options: TaskQueryOptions): Promise<Task[]>
  findSubtasks(parentTaskId: string): Promise<Task[]>
  findWithAssignees(taskId: string): Promise<Task & { assignees: User[] }>
  findWithDependencies(taskId: string): Promise<Task & { dependencies: Task[]; blockedTasks: Task[] }>
  findByAssignee(userId: string, workspaceId: string): Promise<Task[]>
  findByDueDate(workspaceId: string, startDate: Date, endDate: Date): Promise<Task[]>
  
  // Update methods
  updateStatus(taskId: string, newStatus: TaskStatus): Promise<Task | null>
  
  // Dashboard methods
  findUrgentAndNearDue(workspaceId: string, hoursThreshold: number): Promise<Task[]>
  findDueToday(workspaceId: string): Promise<Task[]>
  findBlocked(workspaceId: string): Promise<Task[]>
  findBacklog(workspaceId: string): Promise<Task[]>
}
```

#### TaskAssigneeRepository
```typescript
class TaskAssigneeRepository extends BaseRepository<TaskAssignee> {
  assign(taskId: string, userId: string): Promise<TaskAssignee>
  unassign(taskId: string, userId: string): Promise<void>
  findByTask(taskId: string): Promise<TaskAssignee[]>
  findByUser(userId: string, workspaceId: string): Promise<TaskAssignee[]>
  isAssigned(taskId: string, userId: string): Promise<boolean>
}
```

#### TaskDependencyRepository
```typescript
class TaskDependencyRepository extends BaseRepository<TaskDependency> {
  addDependency(taskId: string, dependsOnTaskId: string): Promise<TaskDependency>
  removeDependency(taskId: string, dependsOnTaskId: string): Promise<void>
  findDependencies(taskId: string): Promise<Task[]>
  findBlockedTasks(taskId: string): Promise<Task[]>
  checkAllDependenciesComplete(taskId: string): Promise<boolean>
  hasCircularDependency(taskId: string, dependsOnTaskId: string): Promise<boolean>
}
```

#### CommentRepository
```typescript
class CommentRepository extends BaseRepository<Comment> {
  findByTask(taskId: string, options: CommentQueryOptions): Promise<Comment[]>
  findThreaded(taskId: string): Promise<Comment & { replies: Comment[] }[]>
  findReplies(parentCommentId: string): Promise<Comment[]>
}
```

#### ActivityRepository
```typescript
class ActivityRepository extends BaseRepository<ActivityLog> {
  log(data: CreateActivityLogData): Promise<ActivityLog>
  findByWorkspace(workspaceId: string, options: ActivityQueryOptions): Promise<ActivityLog[]>
  findByEntity(entityType: LogEntityType, entityId: string): Promise<ActivityLog[]>
  findByUser(userId: string, workspaceId: string): Promise<ActivityLog[]>
  findRecent(workspaceId: string, limit: number): Promise<ActivityLog[]>
}
```

## Service Layer

Services implement business logic and convert entities to DTOs.

### Service Pattern

```typescript
// 1. Define DTOs
export interface TaskDTO {
  id: string;
  title: string;
  created_at: string; // Date → string
  // ... other fields
}

// 2. Entity → DTO conversion
const taskToDTO = (task: Task): TaskDTO => {
  return {
    id: task.id,
    title: task.title,
    created_at: task.created_at.toISOString(),
    // ... other fields
  };
};

// 3. Service methods
export const createTask = async (data: CreateTaskData): Promise<TaskDTO> => {
  // Validate business rules
  if (data.due_date && data.start_date && data.due_date < data.start_date) {
    throw new ApiError(400, 'due_date must be on or after start_date');
  }
  
  // Execute in transaction
  const task = await taskRepository.executeInTransaction(async (client) => {
    const newTask = await taskRepository.create(data, client);
    await activityRepository.log({ /* ... */ }, client);
    return newTask;
  });
  
  // Convert to DTO
  return taskToDTO(task);
};
```

### Available Services

#### task.service.ts
| Method | Description |
|:-------|:------------|
| `createTask` | Create task with activity logging |
| `getTasksByWorkspace` | Get tasks with filters/sort/pagination |
| `getTaskById` | Get single task |
| `updateTask` | Update task with activity logging |
| `deleteTask` | Soft delete task |
| `changeTaskStatus` | Change status with dependency validation |
| `assignUserToTask` | Assign user to task |
| `removeUserFromTask` | Remove user assignment |
| `addDependency` | Add dependency with circular check |
| `removeDependency` | Remove dependency |

#### workspace.service.ts
| Method | Description |
|:-------|:------------|
| `createWorkspace` | Create workspace (enforces 1 per user) |
| `getWorkspaceById` | Get workspace |
| `getUserWorkspace` | Get user's workspace |
| `updateWorkspace` | Update workspace |
| `deleteWorkspace` | Soft delete workspace |
| `getWorkspaceMembers` | Get members with pagination |
| `addWorkspaceMember` | Add member (enforces 1 workspace per user) |
| `updateMemberRole` | Update role (prevents owner change) |
| `removeMember` | Remove member (prevents owner removal) |
| `isWorkspaceMember` | Check membership |

#### comment.service.ts
| Method | Description |
|:-------|:------------|
| `createComment` | Create comment/reply |
| `getCommentsByTask` | Get comments with pagination |
| `getThreadedComments` | Get nested comment structure |
| `getCommentById` | Get single comment |
| `getCommentReplies` | Get replies |
| `deleteComment` | Soft delete (cascades to replies) |
| `hardDeleteComment` | Permanent delete |

#### activity.service.ts
| Method | Description |
|:-------|:------------|
| `getWorkspaceActivity` | Get activity with filters/pagination |
| `getEntityActivity` | Get activity for specific entity |
| `getUserActivity` | Get user's activity |
| `getRecentActivity` | Get recent activity |
| `getActivityFeed` | Get paginated feed |

#### dashboard.service.ts
| Method | Description |
|:-------|:------------|
| `getDashboardBuckets` | Get all buckets with ranking |
| `getImmediateTasks` | Get urgent + near due |
| `getTodayTasks` | Get tasks due today |
| `getBlockedTasks` | Get tasks with incomplete dependencies |
| `getBacklogTasks` | Get backlog tasks |

## Business Logic Implementation

### 1 Workspace Per User
```typescript
// In workspace.service.ts
const existingWorkspace = await workspaceRepository.findByOwnerId(data.owner_id);
if (existingWorkspace) {
  throw new ApiError(400, 'User already owns a workspace');
}
```

### Circular Dependency Detection
```typescript
// In task-dependency.repository.ts
async hasCircularDependency(taskId: string, dependsOnTaskId: string): Promise<boolean> {
  // Recursive CTE to check if dependsOnTaskId depends on taskId
  const query = `
    WITH RECURSIVE dependency_chain AS (
      SELECT task_id, depends_on_task_id
      FROM task_dependencies
      WHERE task_id = $1
      UNION
      SELECT td.task_id, td.depends_on_task_id
      FROM task_dependencies td
      INNER JOIN dependency_chain dc ON td.task_id = dc.depends_on_task_id
    )
    SELECT 1 FROM dependency_chain WHERE depends_on_task_id = $2
  `;
  // ...
}
```

### Dependency Validation Before Status Change
```typescript
// In task.service.ts
if (newStatus === TaskStatus.DONE) {
  const allDependenciesComplete = await taskDependencyRepository.checkAllDependenciesComplete(taskId);
  if (!allDependenciesComplete) {
    throw new ApiError(400, 'Cannot mark task as done. Some dependencies are incomplete.');
  }
}
```

### Date Validation
```typescript
// In task.service.ts
if (data.start_date && data.due_date && data.due_date < data.start_date) {
  throw new ApiError(400, 'due_date must be on or after start_date');
}
```

## Transaction Examples

### Simple Transaction
```typescript
await taskRepository.executeInTransaction(async (client) => {
  const task = await taskRepository.create(data, client);
  await activityRepository.log(logData, client);
  return task;
});
```

### Complex Transaction
```typescript
await taskRepository.executeInTransaction(async (client) => {
  // Get old task
  const oldTask = await taskRepository.findById(taskId, client);
  
  // Update task
  const updatedTask = await taskRepository.update(taskId, data, client);
  
  // Log multiple changes
  if (data.status !== oldTask.status) {
    await activityRepository.log({ /* status change */ }, client);
  }
  if (data.priority !== oldTask.priority) {
    await activityRepository.log({ /* priority change */ }, client);
  }
  
  return updatedTask;
});
```

## Soft Delete Implementation

### Database Schema
```sql
ALTER TABLE tasks ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
CREATE INDEX idx_tasks_deleted_at ON tasks(deleted_at) WHERE deleted_at IS NULL;
```

### Repository Filtering
```typescript
// Automatically filters deleted records
async findAll(filters?, pagination?, client?, includeDeleted = false) {
  let query = `SELECT * FROM ${this.tableName} WHERE 1=1`;
  
  if (!includeDeleted) {
    query += ` AND deleted_at IS NULL`;
  }
  // ...
}
```

### Soft Delete Method
```typescript
async softDelete(id: string, client?: PoolClient): Promise<T | null> {
  const query = `
    UPDATE ${this.tableName}
    SET deleted_at = NOW()
    WHERE id = $1 AND deleted_at IS NULL
    RETURNING *
  `;
  // ...
}
```

### Restore Method
```typescript
async restore(id: string, client?: PoolClient): Promise<T | null> {
  const query = `
    UPDATE ${this.tableName}
    SET deleted_at = NULL
    WHERE id = $1 AND deleted_at IS NOT NULL
    RETURNING *
  `;
  // ...
}
```

## Error Handling

### Repository Layer
- Throws database errors (connection, constraint violations)
- No business logic errors
- Passes errors up to service layer

### Service Layer
- Catches repository errors
- Throws `ApiError` for business logic violations
- Provides user-friendly error messages

```typescript
try {
  const task = await taskRepository.findById(taskId);
} catch (error) {
  throw new ApiError(500, 'Database error occurred');
}
```

### Controller Layer
- Uses `catchAsync` wrapper
- Passes errors to error middleware
- Returns standardized error responses

```typescript
export const getTask = catchAsync(async (req, res) => {
  const task = await taskService.getTaskById(req.params.id);
  if (!task) throw new ApiError(404, 'Task not found');
  res.json(new ApiResponse(200, task, "Success"));
});
```

## Testing Strategy

### Unit Tests - Repositories
```typescript
describe('TaskRepository', () => {
  test('findById should return task', async () => {
    const task = await taskRepository.findById('task-id');
    expect(task).toBeDefined();
  });
  
  test('softDelete should set deleted_at', async () => {
    const task = await taskRepository.softDelete('task-id');
    expect(task?.deleted_at).not.toBeNull();
  });
});
```

### Unit Tests - Services
```typescript
jest.mock('../repositories');

describe('TaskService', () => {
  test('createTask should create task and log activity', async () => {
    const mockTask = { id: '1', title: 'Test' };
    (taskRepository.create as jest.Mock).mockResolvedValue(mockTask);
    
    const result = await taskService.createTask({
      workspace_id: 'ws-1',
      title: 'Test',
      created_by: 'user-1'
    });
    
    expect(result.title).toBe('Test');
  });
});
```

### Integration Tests
```typescript
describe('Task API', () => {
  test('POST /api/v1/tasks should create task', async () => {
    const response = await request(app)
      .post('/api/v1/tasks')
      .send({ title: 'Test Task' })
      .expect(201);
    
    expect(response.body.data.title).toBe('Test Task');
  });
});
```
