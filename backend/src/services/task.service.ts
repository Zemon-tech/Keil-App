import {
  taskRepository,
  taskAssigneeRepository,
  taskDependencyRepository,
  activityRepository,
  commentRepository
} from '../repositories';
import { Task, User } from '../types/entities';
import { TaskStatus, TaskPriority, LogEntityType, LogActionType } from '../types/enums';
import { TaskQueryOptions } from '../types/repository';
import { ApiError } from '../utils/ApiError';

/**
 * Task Service - Business logic layer using repositories
 * Repositories return Entities, Services convert Entity → DTO
 */

// DTOs (Data Transfer Objects) for API responses
export interface TaskDTO {
  id: string;
  workspace_id: string;
  parent_task_id: string | null;
  title: string;
  description: string | null;
  objective: string | null;
  success_criteria: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  start_date: string | null;
  due_date: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  assignees?: User[];
}

export interface CreateTaskData {
  workspace_id: string;
  parent_task_id?: string | null;
  title: string;
  description?: string;
  objective?: string;
  success_criteria?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  start_date?: Date;
  due_date?: Date;
  created_by: string;
}

export interface UpdateTaskData {
  title?: string;
  description?: string | null;
  objective?: string | null;
  success_criteria?: string | null;
  status?: TaskStatus;
  priority?: TaskPriority;
  start_date?: Date | null;
  due_date?: Date | null;
}

/**
 * Convert Task entity to DTO
 */
const taskToDTO = (task: Task & { assignees?: User[] }): TaskDTO => {
  return {
    id: task.id,
    workspace_id: task.workspace_id,
    parent_task_id: task.parent_task_id,
    title: task.title,
    description: task.description,
    objective: task.objective,
    success_criteria: task.success_criteria,
    status: task.status,
    priority: task.priority,
    start_date: task.start_date ? task.start_date.toISOString() : null,
    due_date: task.due_date ? task.due_date.toISOString() : null,
    created_by: task.created_by,
    created_at: task.created_at.toISOString(),
    updated_at: task.updated_at.toISOString(),
    assignees: task.assignees
  };
};

/**
 * Create a new task
 */
export const createTask = async (data: CreateTaskData): Promise<TaskDTO> => {
  // Validate date order
  if (data.start_date && data.due_date && data.due_date < data.start_date) {
    throw new ApiError(400, 'due_date must be on or after start_date');
  }

  const task = await taskRepository.executeInTransaction(async (client) => {
    // Create task
    const newTask = await taskRepository.create(data, client);

    // Log activity
    await activityRepository.log({
      workspace_id: data.workspace_id,
      user_id: data.created_by,
      entity_type: LogEntityType.TASK,
      entity_id: newTask.id,
      action_type: LogActionType.TASK_CREATED,
      old_value: null,
      new_value: { title: newTask.title, status: newTask.status }
    }, client);

    return newTask;
  });

  return taskToDTO(task);
};

/**
 * Get tasks by workspace with filters
 */
export const getTasksByWorkspace = async (
  workspaceId: string,
  options: TaskQueryOptions = {}
): Promise<TaskDTO[]> => {
  const tasks = await taskRepository.findByWorkspace(workspaceId, options);
  return tasks.map(taskToDTO);
};

/**
 * Get task by ID including assignees
 */
export const getTaskById = async (taskId: string): Promise<TaskDTO | null> => {
  const task = await taskRepository.findWithAssignees(taskId);
  return task ? taskToDTO(task) : null;
};

/**
 * Update task
 */
export const updateTask = async (
  taskId: string,
  data: UpdateTaskData,
  userId: string,
  workspaceId: string
): Promise<TaskDTO | null> => {
  // Validate date order if both are provided
  if (data.start_date && data.due_date && data.due_date < data.start_date) {
    throw new ApiError(400, 'due_date must be on or after start_date');
  }

  const result = await taskRepository.executeInTransaction(async (client) => {
    // Get old task for activity log
    const oldTask = await taskRepository.findById(taskId, client);
    if (!oldTask) {
      return null;
    }

    // Update task
    const updatedTask = await taskRepository.update(taskId, data, client);
    if (!updatedTask) {
      return null;
    }

    // Log changes
    if (data.title !== undefined && data.title !== oldTask.title) {
      await activityRepository.log({
        workspace_id: workspaceId,
        user_id: userId,
        entity_type: LogEntityType.TASK,
        entity_id: taskId,
        action_type: LogActionType.TITLE_UPDATED,
        old_value: { title: oldTask.title },
        new_value: { title: data.title }
      }, client);
    }

    if (data.description !== undefined && data.description !== oldTask.description) {
      await activityRepository.log({
        workspace_id: workspaceId,
        user_id: userId,
        entity_type: LogEntityType.TASK,
        entity_id: taskId,
        action_type: LogActionType.DESCRIPTION_UPDATED,
        old_value: { description: oldTask.description },
        new_value: { description: data.description }
      }, client);
    }

    if (data.objective !== undefined && data.objective !== oldTask.objective) {
      await activityRepository.log({
        workspace_id: workspaceId,
        user_id: userId,
        entity_type: LogEntityType.TASK,
        entity_id: taskId,
        action_type: LogActionType.OBJECTIVE_UPDATED,
        old_value: { objective: oldTask.objective },
        new_value: { objective: data.objective }
      }, client);
    }

    if (data.success_criteria !== undefined && data.success_criteria !== oldTask.success_criteria) {
      await activityRepository.log({
        workspace_id: workspaceId,
        user_id: userId,
        entity_type: LogEntityType.TASK,
        entity_id: taskId,
        action_type: LogActionType.SUCCESS_CRITERIA_UPDATED,
        old_value: { success_criteria: oldTask.success_criteria },
        new_value: { success_criteria: data.success_criteria }
      }, client);
    }

    if (data.status !== undefined && data.status !== oldTask.status) {
      await activityRepository.log({
        workspace_id: workspaceId,
        user_id: userId,
        entity_type: LogEntityType.TASK,
        entity_id: taskId,
        action_type: LogActionType.STATUS_CHANGED,
        old_value: { status: oldTask.status },
        new_value: { status: data.status }
      }, client);
    }

    if (data.priority !== undefined && data.priority !== oldTask.priority) {
      await activityRepository.log({
        workspace_id: workspaceId,
        user_id: userId,
        entity_type: LogEntityType.TASK,
        entity_id: taskId,
        action_type: LogActionType.PRIORITY_CHANGED,
        old_value: { priority: oldTask.priority },
        new_value: { priority: data.priority }
      }, client);
    }

    const oldStart = oldTask.start_date ? new Date(oldTask.start_date).getTime() : null;
    const newStart = data.start_date ? data.start_date.getTime() : null;
    if (data.start_date !== undefined && newStart !== oldStart) {
      await activityRepository.log({
        workspace_id: workspaceId,
        user_id: userId,
        entity_type: LogEntityType.TASK,
        entity_id: taskId,
        action_type: LogActionType.START_DATE_CHANGED,
        old_value: { start_date: oldTask.start_date },
        new_value: { start_date: data.start_date }
      }, client);
    }

    const oldDue = oldTask.due_date ? new Date(oldTask.due_date).getTime() : null;
    const newDue = data.due_date ? data.due_date.getTime() : null;
    if (data.due_date !== undefined && newDue !== oldDue) {
      await activityRepository.log({
        workspace_id: workspaceId,
        user_id: userId,
        entity_type: LogEntityType.TASK,
        entity_id: taskId,
        action_type: LogActionType.DUE_DATE_CHANGED,
        old_value: { due_date: oldTask.due_date },
        new_value: { due_date: data.due_date }
      }, client);
    }

    return updatedTask;
  });

  return result ? taskToDTO(result) : null;
};

/**
 * Delete task (soft delete)
 */
export const deleteTask = async (
  taskId: string,
  userId: string,
  workspaceId: string
): Promise<void> => {
  await taskRepository.executeInTransaction(async (client) => {
    const task = await taskRepository.findById(taskId, client);
    if (!task) {
      throw new ApiError(404, 'Task not found');
    }

    // Soft delete task and its associations (comments)
    await taskRepository.softDelete(taskId, client);
    await commentRepository.softDeleteByTaskId(taskId, client);

    // Log deletion
    await activityRepository.log({
      workspace_id: workspaceId,
      user_id: userId,
      entity_type: LogEntityType.TASK,
      entity_id: taskId,
      action_type: LogActionType.TASK_DELETED,
      old_value: { title: task.title },
      new_value: null
    }, client);
  });
};

/**
 * Change task status with dependency validation
 */
export const changeTaskStatus = async (
  taskId: string,
  newStatus: TaskStatus,
  userId: string,
  workspaceId: string
): Promise<TaskDTO | null> => {
  // If changing to 'done', check dependencies
  if (newStatus === TaskStatus.DONE) {
    const allDependenciesComplete = await taskDependencyRepository.checkAllDependenciesComplete(taskId);
    if (!allDependenciesComplete) {
      throw new ApiError(400, 'Cannot mark task as done. Some dependencies are incomplete.');
    }
  }

  const result = await taskRepository.executeInTransaction(async (client) => {
    const oldTask = await taskRepository.findById(taskId, client);
    if (!oldTask) {
      return null;
    }

    const updatedTask = await taskRepository.updateStatus(taskId, newStatus, client);
    if (!updatedTask) {
      return null;
    }

    // Log status change
    await activityRepository.log({
      workspace_id: workspaceId,
      user_id: userId,
      entity_type: LogEntityType.TASK,
      entity_id: taskId,
      action_type: LogActionType.STATUS_CHANGED,
      old_value: { status: oldTask.status },
      new_value: { status: newStatus }
    }, client);

    return updatedTask;
  });

  return result ? taskToDTO(result) : null;
};

/**
 * Assign user to task
 */
export const assignUserToTask = async (
  taskId: string,
  assigneeUserId: string,
  userId: string,
  workspaceId: string
): Promise<void> => {
  await taskRepository.executeInTransaction(async (client) => {
    await taskAssigneeRepository.assign(taskId, assigneeUserId, client);

    // Log assignment
    await activityRepository.log({
      workspace_id: workspaceId,
      user_id: userId,
      entity_type: LogEntityType.TASK,
      entity_id: taskId,
      action_type: LogActionType.ASSIGNMENT_ADDED,
      old_value: null,
      new_value: { assigned_user_id: assigneeUserId }
    }, client);
  });
};

/**
 * Remove user from task
 */
export const removeUserFromTask = async (
  taskId: string,
  assigneeUserId: string,
  userId: string,
  workspaceId: string
): Promise<void> => {
  await taskRepository.executeInTransaction(async (client) => {
    await taskAssigneeRepository.unassign(taskId, assigneeUserId, client);

    // Log removal
    await activityRepository.log({
      workspace_id: workspaceId,
      user_id: userId,
      entity_type: LogEntityType.TASK,
      entity_id: taskId,
      action_type: LogActionType.ASSIGNMENT_REMOVED,
      old_value: { assigned_user_id: assigneeUserId },
      new_value: null
    }, client);
  });
};

/**
 * Add dependency
 */
export const addDependency = async (
  taskId: string,
  dependsOnTaskId: string,
  userId: string,
  workspaceId: string
): Promise<void> => {
  // Check for circular dependency
  const hasCircular = await taskDependencyRepository.hasCircularDependency(taskId, dependsOnTaskId);
  if (hasCircular) {
    throw new ApiError(400, 'Cannot add dependency. This would create a circular dependency.');
  }

  await taskRepository.executeInTransaction(async (client) => {
    await taskDependencyRepository.addDependency(taskId, dependsOnTaskId, client);

    // Log dependency
    await activityRepository.log({
      workspace_id: workspaceId,
      user_id: userId,
      entity_type: LogEntityType.TASK,
      entity_id: taskId,
      action_type: LogActionType.DEPENDENCY_ADDED,
      old_value: null,
      new_value: { depends_on_task_id: dependsOnTaskId }
    }, client);
  });
};

/**
 * Remove dependency
 */
export const removeDependency = async (
  taskId: string,
  dependsOnTaskId: string,
  userId: string,
  workspaceId: string
): Promise<void> => {
  await taskRepository.executeInTransaction(async (client) => {
    await taskDependencyRepository.removeDependency(taskId, dependsOnTaskId, client);

    // Log removal
    await activityRepository.log({
      workspace_id: workspaceId,
      user_id: userId,
      entity_type: LogEntityType.TASK,
      entity_id: taskId,
      action_type: LogActionType.DEPENDENCY_REMOVED,
      old_value: { depends_on_task_id: dependsOnTaskId },
      new_value: null
    }, client);
  });
};
