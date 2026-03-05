# Usage Guide

This guide provides practical examples of using the repository layer in your controllers.

## Basic Patterns

### Pattern 1: Simple CRUD

```typescript
import * as taskService from '../services/task.service';
import { catchAsync } from '../utils/catchAsync';
import { ApiResponse } from '../utils/ApiResponse';
import { ApiError } from '../utils/ApiError';

// Get single task
export const getTask = catchAsync(async (req: Request, res: Response) => {
  const task = await taskService.getTaskById(req.params.id);
  
  if (!task) {
    throw new ApiError(404, 'Task not found');
  }
  
  res.status(200).json(new ApiResponse(200, task, "Task retrieved successfully"));
});

// Create task
export const createTask = catchAsync(async (req: Request, res: Response) => {
  const taskDTO = await taskService.createTask({
    workspace_id: req.body.workspace_id,
    title: req.body.title,
    description: req.body.description,
    created_by: req.user.id
  });
  
  res.status(201).json(new ApiResponse(201, taskDTO, "Task created successfully"));
});

// Update task
export const updateTask = catchAsync(async (req: Request, res: Response) => {
  const taskDTO = await taskService.updateTask(
    req.params.id,
    req.body,
    req.user.id,
    req.user.workspaceId
  );
  
  if (!taskDTO) {
    throw new ApiError(404, 'Task not found');
  }
  
  res.status(200).json(new ApiResponse(200, taskDTO, "Task updated successfully"));
});

// Delete task (soft delete)
export const deleteTask = catchAsync(async (req: Request, res: Response) => {
  await taskService.deleteTask(req.params.id, req.user.id, req.user.workspaceId);
  
  res.status(200).json(new ApiResponse(200, {}, "Task deleted successfully"));
});
```

### Pattern 2: Query with Filters

```typescript
import { TaskStatus, TaskPriority } from '../types/enums';

export const getTasks = catchAsync(async (req: Request, res: Response) => {
  const { status, priority, assigneeId, dueDateStart, dueDateEnd, limit, offset, sortBy, sortOrder } = req.query;
  
  const tasks = await taskService.getTasksByWorkspace(req.user.workspaceId, {
    filters: {
      status: status as TaskStatus,
      priority: priority as TaskPriority,
      assigneeId: assigneeId as string,
      dueDateStart: dueDateStart ? new Date(dueDateStart as string) : undefined,
      dueDateEnd: dueDateEnd ? new Date(dueDateEnd as string) : undefined
    },
    sort: sortBy ? {
      field: sortBy as string,
      order: (sortOrder as string)?.toUpperCase() === 'DESC' ? 'DESC' : 'ASC'
    } : undefined,
    pagination: {
      limit: parseInt(limit as string) || 20,
      offset: parseInt(offset as string) || 0
    }
  });
  
  res.status(200).json(new ApiResponse(200, tasks, "Tasks retrieved successfully"));
});
```

### Pattern 3: Complex Operation

```typescript
// Change task status with dependency validation
export const changeTaskStatus = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { status } = req.body;
  
  // Service automatically validates dependencies
  const taskDTO = await taskService.changeTaskStatus(
    id,
    status as TaskStatus,
    req.user.id,
    req.user.workspaceId
  );
  
  if (!taskDTO) {
    throw new ApiError(404, 'Task not found');
  }
  
  res.status(200).json(new ApiResponse(200, taskDTO, "Task status updated successfully"));
});
```

## Task Service Examples

### Create Task with All Fields

```typescript
export const createTask = catchAsync(async (req: Request, res: Response) => {
  const taskDTO = await taskService.createTask({
    workspace_id: req.body.workspace_id,
    parent_task_id: req.body.parent_task_id, // For subtasks
    title: req.body.title,
    description: req.body.description,
    objective: req.body.objective,
    success_criteria: req.body.success_criteria,
    status: req.body.status || TaskStatus.BACKLOG,
    priority: req.body.priority || TaskPriority.MEDIUM,
    start_date: req.body.start_date ? new Date(req.body.start_date) : undefined,
    due_date: req.body.due_date ? new Date(req.body.due_date) : undefined,
    created_by: req.user.id
  });
  
  res.status(201).json(new ApiResponse(201, taskDTO, "Task created successfully"));
});
```

### Get Tasks with Multiple Filters

```typescript
export const getTasks = catchAsync(async (req: Request, res: Response) => {
  const {
    status,
    priority,
    assigneeId,
    dueDateStart,
    dueDateEnd,
    parentTaskId,
    limit = '20',
    offset = '0',
    sortBy = 'created_at',
    sortOrder = 'DESC'
  } = req.query;
  
  // Build filters
  const filters: any = {};
  
  if (status) {
    // Support multiple statuses: ?status=todo,in-progress
    filters.status = (status as string).includes(',')
      ? (status as string).split(',') as TaskStatus[]
      : status as TaskStatus;
  }
  
  if (priority) {
    filters.priority = priority as TaskPriority;
  }
  
  if (assigneeId) {
    filters.assigneeId = assigneeId as string;
  }
  
  if (dueDateStart) {
    filters.dueDateStart = new Date(dueDateStart as string);
  }
  
  if (dueDateEnd) {
    filters.dueDateEnd = new Date(dueDateEnd as string);
  }
  
  if (parentTaskId !== undefined) {
    filters.parentTaskId = parentTaskId === 'null' ? null : parentTaskId as string;
  }
  
  const tasks = await taskService.getTasksByWorkspace(req.user.workspaceId, {
    filters,
    sort: {
      field: sortBy as string,
      order: (sortOrder as string).toUpperCase() === 'DESC' ? 'DESC' : 'ASC'
    },
    pagination: {
      limit: parseInt(limit as string),
      offset: parseInt(offset as string)
    }
  });
  
  res.status(200).json(new ApiResponse(200, tasks, "Tasks retrieved successfully"));
});
```

### Assign User to Task

```typescript
export const assignUserToTask = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { userId } = req.body;
  
  await taskService.assignUserToTask(id, userId, req.user.id, req.user.workspaceId);
  
  res.status(200).json(new ApiResponse(200, {}, "User assigned to task"));
});
```

### Remove User from Task

```typescript
export const removeUserFromTask = catchAsync(async (req: Request, res: Response) => {
  const { id, userId } = req.params;
  
  await taskService.removeUserFromTask(id, userId, req.user.id, req.user.workspaceId);
  
  res.status(200).json(new ApiResponse(200, {}, "User removed from task"));
});
```

### Add Dependency

```typescript
export const addDependency = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { dependsOnTaskId } = req.body;
  
  // Service automatically checks for circular dependencies
  await taskService.addDependency(id, dependsOnTaskId, req.user.id, req.user.workspaceId);
  
  res.status(201).json(new ApiResponse(201, {}, "Dependency added to task"));
});
```

### Remove Dependency

```typescript
export const removeDependency = catchAsync(async (req: Request, res: Response) => {
  const { id, dependsOnTaskId } = req.params;
  
  await taskService.removeDependency(id, dependsOnTaskId, req.user.id, req.user.workspaceId);
  
  res.status(200).json(new ApiResponse(200, {}, "Dependency removed from task"));
});
```

## Workspace Service Examples

### Create Workspace

```typescript
export const createWorkspace = catchAsync(async (req: Request, res: Response) => {
  const workspaceDTO = await workspaceService.createWorkspace({
    name: req.body.name,
    owner_id: req.user.id
  });
  
  res.status(201).json(new ApiResponse(201, workspaceDTO, "Workspace created successfully"));
});
```

### Get Workspace Members

```typescript
export const getWorkspaceMembers = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { limit = '50', offset = '0' } = req.query;
  
  const members = await workspaceService.getWorkspaceMembers(id, {
    limit: parseInt(limit as string),
    offset: parseInt(offset as string)
  });
  
  res.status(200).json(new ApiResponse(200, members, "Members retrieved successfully"));
});
```

### Add Member to Workspace

```typescript
import { MemberRole } from '../types/enums';

export const addMember = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { userId, role = MemberRole.MEMBER } = req.body;
  
  const member = await workspaceService.addWorkspaceMember(
    id,
    userId,
    role as MemberRole,
    req.user.id
  );
  
  res.status(201).json(new ApiResponse(201, member, "Member added successfully"));
});
```

### Update Member Role

```typescript
export const updateMemberRole = catchAsync(async (req: Request, res: Response) => {
  const { id, userId } = req.params;
  const { role } = req.body;
  
  const member = await workspaceService.updateMemberRole(
    id,
    userId,
    role as MemberRole,
    req.user.id
  );
  
  if (!member) {
    throw new ApiError(404, 'Member not found');
  }
  
  res.status(200).json(new ApiResponse(200, member, "Member role updated successfully"));
});
```

### Remove Member

```typescript
export const removeMember = catchAsync(async (req: Request, res: Response) => {
  const { id, userId } = req.params;
  
  await workspaceService.removeMember(id, userId, req.user.id);
  
  res.status(200).json(new ApiResponse(200, {}, "Member removed successfully"));
});
```

## Comment Service Examples

### Create Comment

```typescript
export const createComment = catchAsync(async (req: Request, res: Response) => {
  const { id: taskId } = req.params;
  const { content, parent_comment_id } = req.body;
  
  const commentDTO = await commentService.createComment(
    {
      task_id: taskId,
      user_id: req.user.id,
      content,
      parent_comment_id
    },
    req.user.workspaceId
  );
  
  res.status(201).json(new ApiResponse(201, commentDTO, "Comment created successfully"));
});
```

### Get Task Comments (Flat List)

```typescript
export const getTaskComments = catchAsync(async (req: Request, res: Response) => {
  const { id: taskId } = req.params;
  const { limit = '50', offset = '0' } = req.query;
  
  const comments = await commentService.getCommentsByTask(taskId, {
    pagination: {
      limit: parseInt(limit as string),
      offset: parseInt(offset as string)
    }
  });
  
  res.status(200).json(new ApiResponse(200, comments, "Comments retrieved successfully"));
});
```

### Get Threaded Comments

```typescript
export const getThreadedComments = catchAsync(async (req: Request, res: Response) => {
  const { id: taskId } = req.params;
  
  const comments = await commentService.getThreadedComments(taskId);
  
  res.status(200).json(new ApiResponse(200, comments, "Threaded comments retrieved successfully"));
});
```

### Delete Comment

```typescript
export const deleteComment = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  
  // Soft delete (cascades to replies via DB)
  await commentService.deleteComment(id, req.user.id, req.user.workspaceId);
  
  res.status(200).json(new ApiResponse(200, {}, "Comment deleted successfully"));
});
```

## Activity Service Examples

### Get Workspace Activity Feed

```typescript
export const getActivityFeed = catchAsync(async (req: Request, res: Response) => {
  const { limit = '20', offset = '0' } = req.query;
  
  const activities = await activityService.getActivityFeed(
    req.user.workspaceId,
    parseInt(limit as string),
    parseInt(offset as string)
  );
  
  res.status(200).json(new ApiResponse(200, activities, "Activity feed retrieved successfully"));
});
```

### Get Activity for Specific Entity

```typescript
import { LogEntityType } from '../types/enums';

export const getTaskActivity = catchAsync(async (req: Request, res: Response) => {
  const { id: taskId } = req.params;
  
  const activities = await activityService.getEntityActivity(
    LogEntityType.TASK,
    taskId
  );
  
  res.status(200).json(new ApiResponse(200, activities, "Task activity retrieved successfully"));
});
```

### Get User Activity

```typescript
export const getUserActivity = catchAsync(async (req: Request, res: Response) => {
  const { userId } = req.params;
  
  const activities = await activityService.getUserActivity(
    userId,
    req.user.workspaceId
  );
  
  res.status(200).json(new ApiResponse(200, activities, "User activity retrieved successfully"));
});
```

## Dashboard Service Examples

### Get Dashboard Buckets

```typescript
export const getDashboard = catchAsync(async (req: Request, res: Response) => {
  const buckets = await dashboardService.getDashboardBuckets(req.user.workspaceId);
  
  // Returns: { immediate: [], today: [], blocked: [], backlog: [] }
  res.status(200).json(new ApiResponse(200, buckets, "Dashboard retrieved successfully"));
});
```

### Get Immediate Tasks

```typescript
export const getImmediateTasks = catchAsync(async (req: Request, res: Response) => {
  const { hoursThreshold = '48' } = req.query;
  
  const tasks = await dashboardService.getImmediateTasks(
    req.user.workspaceId,
    parseInt(hoursThreshold as string)
  );
  
  res.status(200).json(new ApiResponse(200, tasks, "Immediate tasks retrieved successfully"));
});
```

### Get Today's Tasks

```typescript
export const getTodayTasks = catchAsync(async (req: Request, res: Response) => {
  const tasks = await dashboardService.getTodayTasks(req.user.workspaceId);
  
  res.status(200).json(new ApiResponse(200, tasks, "Today's tasks retrieved successfully"));
});
```

### Get Blocked Tasks

```typescript
export const getBlockedTasks = catchAsync(async (req: Request, res: Response) => {
  const tasks = await dashboardService.getBlockedTasks(req.user.workspaceId);
  
  res.status(200).json(new ApiResponse(200, tasks, "Blocked tasks retrieved successfully"));
});
```

## Error Handling

### Service Throws ApiError

Services throw `ApiError` for business logic violations:

```typescript
// Service code
if (newStatus === TaskStatus.DONE) {
  const allDependenciesComplete = await taskDependencyRepository.checkAllDependenciesComplete(taskId);
  if (!allDependenciesComplete) {
    throw new ApiError(400, 'Cannot mark task as done. Some dependencies are incomplete.');
  }
}
```

### Controller Catches with catchAsync

Controllers use `catchAsync` wrapper to handle errors:

```typescript
export const changeTaskStatus = catchAsync(async (req: Request, res: Response) => {
  // If service throws ApiError, catchAsync passes it to error middleware
  const taskDTO = await taskService.changeTaskStatus(
    req.params.id,
    req.body.status,
    req.user.id,
    req.user.workspaceId
  );
  
  res.status(200).json(new ApiResponse(200, taskDTO, "Success"));
});
```

## Validation Patterns

### Input Validation Middleware

```typescript
import { body, param, query, validationResult } from 'express-validator';

// Validation middleware
export const validateCreateTask = [
  body('title').notEmpty().withMessage('Title is required'),
  body('workspace_id').isUUID().withMessage('Invalid workspace ID'),
  body('status').optional().isIn(['backlog', 'todo', 'in-progress', 'done']),
  body('priority').optional().isIn(['low', 'medium', 'high', 'urgent']),
  body('due_date').optional().isISO8601().withMessage('Invalid date format'),
  (req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ApiError(400, 'Validation failed', errors.array());
    }
    next();
  }
];

// Use in route
router.post('/tasks', validateCreateTask, createTask);
```

### Business Logic Validation in Service

```typescript
// Service handles business rules
export const createTask = async (data: CreateTaskData): Promise<TaskDTO> => {
  // Validate date order
  if (data.start_date && data.due_date && data.due_date < data.start_date) {
    throw new ApiError(400, 'due_date must be on or after start_date');
  }
  
  // Validate parent task exists if subtask
  if (data.parent_task_id) {
    const parentTask = await taskRepository.findById(data.parent_task_id);
    if (!parentTask) {
      throw new ApiError(404, 'Parent task not found');
    }
  }
  
  // Create task...
};
```

## Best Practices

### 1. Always Use Services in Controllers

```typescript
// ❌ Bad - Calling repository directly
const task = await taskRepository.findById(id);

// ✅ Good - Using service
const task = await taskService.getTaskById(id);
```

### 2. Let Services Handle Transactions

```typescript
// ❌ Bad - Managing transaction in controller
await taskRepository.executeInTransaction(async (client) => {
  // Complex logic here
});

// ✅ Good - Service handles transaction
await taskService.deleteTask(taskId, userId, workspaceId);
```

### 3. Use DTOs for Responses

```typescript
// ✅ Good - Service returns DTO
const taskDTO = await taskService.createTask(data);
res.json(new ApiResponse(201, taskDTO, "Success"));
```

### 4. Handle Errors with catchAsync

```typescript
// ✅ Good - Let error middleware handle errors
export const getTask = catchAsync(async (req, res) => {
  const task = await taskService.getTaskById(req.params.id);
  if (!task) throw new ApiError(404, 'Task not found');
  res.json(new ApiResponse(200, task, "Success"));
});
```

### 5. Use Type Imports

```typescript
import { TaskStatus, TaskPriority } from '../types/enums';
import { Task } from '../types/entities';
import { TaskQueryOptions } from '../types/repository';
```

## Common Pitfalls

### Pitfall 1: Not Running Migration

**Problem**: Queries fail with "column deleted_at does not exist"

**Solution**: Run `003_add_soft_delete.sql` migration

### Pitfall 2: Forgetting to Convert Dates

**Problem**: Date strings not converted to Date objects

**Solution**: Always convert date strings to Date objects

```typescript
// ✅ Good
start_date: req.body.start_date ? new Date(req.body.start_date) : undefined
```

### Pitfall 3: Not Handling Null Results

**Problem**: Accessing properties on null results

**Solution**: Always check for null

```typescript
// ✅ Good
const task = await taskService.getTaskById(id);
if (!task) {
  throw new ApiError(404, 'Task not found');
}
```

### Pitfall 4: Circular Dependencies

**Problem**: Adding dependencies that create cycles

**Solution**: Service automatically detects and prevents

```typescript
// Service handles this automatically
await taskService.addDependency(taskId, dependsOnTaskId, userId, workspaceId);
// Throws ApiError if circular dependency detected
```
