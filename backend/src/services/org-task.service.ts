import {
  activityRepository,
  commentRepository,
  orgTaskRepository,
  taskAssigneeRepository,
  taskDependencyRepository,
} from "../repositories";
import { Task, User } from "../types/entities";
import { LogActionType, LogEntityType, TaskPriority, TaskStatus } from "../types/enums";
import { TaskQueryOptions } from "../types/repository";
import { ApiError } from "../utils/ApiError";

export interface OrgTaskDTO {
  id: string;
  workspace_id: string;
  org_id: string | null;
  space_id: string | null;
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
  assignees?: Array<{ id: string; email: string; name: string | null; created_at: string }>;
  dependencies?: Array<{ id: string; title: string; status: TaskStatus; priority: TaskPriority; due_date: string | null }>;
  blocked_by_count?: number;
  subtask_count?: number;
  parent_task_title?: string;
}

export interface OrgTaskContext {
  workspaceId: string;
  orgId: string;
  spaceId: string;
}

export interface CreateOrgTaskInput {
  workspace_id: string;
  org_id: string;
  space_id: string;
  parent_task_id?: string | null;
  title: string;
  description?: string | null;
  objective?: string | null;
  success_criteria?: string | null;
  status?: TaskStatus;
  priority?: TaskPriority;
  start_date?: Date | null;
  due_date?: Date | null;
  created_by: string;
}

export interface UpdateOrgTaskInput {
  title?: string;
  description?: string | null;
  objective?: string | null;
  success_criteria?: string | null;
  status?: TaskStatus;
  priority?: TaskPriority;
  start_date?: Date | null;
  due_date?: Date | null;
}

const toISO = (value: Date | string | null | undefined): string | null => {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
};

const toDTO = (task: Task & { assignees?: User[] }): OrgTaskDTO => ({
  id: task.id,
  workspace_id: task.workspace_id,
  org_id: task.org_id ?? null,
  space_id: task.space_id ?? null,
  parent_task_id: task.parent_task_id,
  title: task.title,
  description: task.description,
  objective: task.objective,
  success_criteria: task.success_criteria,
  status: task.status,
  priority: task.priority,
  start_date: toISO(task.start_date),
  due_date: toISO(task.due_date),
  created_by: task.created_by,
  created_at: toISO(task.created_at)!,
  updated_at: toISO(task.updated_at)!,
  assignees: task.assignees as any,
  subtask_count: task.subtask_count ? parseInt(task.subtask_count.toString(), 10) : 0,
});

const validateDateOrder = (startDate?: Date | null, dueDate?: Date | null): void => {
  if (startDate && dueDate && dueDate < startDate) {
    throw new ApiError(400, "due_date must be on or after start_date");
  }
};

const logSpaceActivity = async (
  context: OrgTaskContext,
  userId: string | null,
  entityType: LogEntityType,
  entityId: string,
  actionType: LogActionType,
  oldValue: Record<string, unknown> | null,
  newValue: Record<string, unknown> | null,
  client: any,
): Promise<void> => {
  await activityRepository.log(
    {
      workspace_id: context.workspaceId,
      org_id: context.orgId,
      space_id: context.spaceId,
      user_id: userId,
      entity_type: entityType,
      entity_id: entityId,
      action_type: actionType,
      old_value: oldValue,
      new_value: newValue,
    },
    client,
  );
};

export const getTasksBySpace = async (
  orgId: string,
  spaceId: string,
  options: TaskQueryOptions = {},
): Promise<OrgTaskDTO[]> => {
  const tasks = await orgTaskRepository.findBySpace(orgId, spaceId, options);
  return tasks.map((task) => toDTO(task));
};

export const getTaskById = async (taskId: string): Promise<OrgTaskDTO | null> => {
  const task = await orgTaskRepository.findWithAssignees(taskId);
  if (!task) return null;

  const taskWithDeps = await orgTaskRepository.findWithDependencies(taskId);
  const rawDependencies: any[] = taskWithDeps?.dependencies ?? [];
  const dependencies = rawDependencies.map((dep) => ({
    id: dep.id,
    title: dep.title,
    status: dep.status,
    priority: dep.priority,
    due_date: toISO(dep.due_date),
  }));

  const subtasks = await orgTaskRepository.findSubtasks(taskId);
  const parentTaskTitle =
    task.parent_task_id !== null
      ? (await orgTaskRepository.findById(task.parent_task_id))?.title
      : undefined;

  return {
    ...toDTO(task),
    dependencies,
    blocked_by_count: dependencies.filter((dep) => dep.status !== TaskStatus.DONE).length,
    subtask_count: subtasks.length,
    parent_task_title: parentTaskTitle,
  };
};

export const getSubtasks = async (taskId: string): Promise<OrgTaskDTO[]> => {
  const tasks = await orgTaskRepository.findSubtasks(taskId);
  return tasks.map((task) => toDTO(task));
};

export const createTask = async (
  context: OrgTaskContext,
  input: CreateOrgTaskInput,
): Promise<OrgTaskDTO> => {
  validateDateOrder(input.start_date ?? null, input.due_date ?? null);

  const task = await orgTaskRepository.executeInTransaction(async (client) => {
    const created = await orgTaskRepository.create(input as Partial<Task>, client);
    await logSpaceActivity(
      context,
      input.created_by,
      LogEntityType.TASK,
      created.id,
      LogActionType.TASK_CREATED,
      null,
      { title: created.title, status: created.status },
      client,
    );
    return created;
  });

  return toDTO(task);
};

export const updateTask = async (
  context: OrgTaskContext,
  taskId: string,
  userId: string,
  input: UpdateOrgTaskInput,
): Promise<OrgTaskDTO | null> => {
  const existingTask = await orgTaskRepository.findById(taskId);
  if (!existingTask) {
    return null;
  }

  validateDateOrder(
    input.start_date !== undefined ? input.start_date : existingTask.start_date,
    input.due_date !== undefined ? input.due_date : existingTask.due_date,
  );

  const result = await orgTaskRepository.executeInTransaction(async (client) => {
    const updated = await orgTaskRepository.update(taskId, input as Partial<Task>, client);
    if (!updated) return null;

    if (input.title !== undefined && input.title !== existingTask.title) {
      await logSpaceActivity(context, userId, LogEntityType.TASK, taskId, LogActionType.TITLE_UPDATED, { title: existingTask.title }, { title: input.title }, client);
    }
    if (input.description !== undefined && input.description !== existingTask.description) {
      await logSpaceActivity(context, userId, LogEntityType.TASK, taskId, LogActionType.DESCRIPTION_UPDATED, { description: existingTask.description }, { description: input.description }, client);
    }
    if (input.objective !== undefined && input.objective !== existingTask.objective) {
      await logSpaceActivity(context, userId, LogEntityType.TASK, taskId, LogActionType.OBJECTIVE_UPDATED, { objective: existingTask.objective }, { objective: input.objective }, client);
    }
    if (input.success_criteria !== undefined && input.success_criteria !== existingTask.success_criteria) {
      await logSpaceActivity(context, userId, LogEntityType.TASK, taskId, LogActionType.SUCCESS_CRITERIA_UPDATED, { success_criteria: existingTask.success_criteria }, { success_criteria: input.success_criteria }, client);
    }
    if (input.status !== undefined && input.status !== existingTask.status) {
      await logSpaceActivity(context, userId, LogEntityType.TASK, taskId, LogActionType.STATUS_CHANGED, { status: existingTask.status }, { status: input.status }, client);
    }
    if (input.priority !== undefined && input.priority !== existingTask.priority) {
      await logSpaceActivity(context, userId, LogEntityType.TASK, taskId, LogActionType.PRIORITY_CHANGED, { priority: existingTask.priority }, { priority: input.priority }, client);
    }
    if (input.start_date !== undefined && toISO(input.start_date) !== toISO(existingTask.start_date)) {
      await logSpaceActivity(context, userId, LogEntityType.TASK, taskId, LogActionType.START_DATE_CHANGED, { start_date: toISO(existingTask.start_date) }, { start_date: toISO(input.start_date) }, client);
    }
    if (input.due_date !== undefined && toISO(input.due_date) !== toISO(existingTask.due_date)) {
      await logSpaceActivity(context, userId, LogEntityType.TASK, taskId, LogActionType.DUE_DATE_CHANGED, { due_date: toISO(existingTask.due_date) }, { due_date: toISO(input.due_date) }, client);
    }

    return updated;
  });

  return result ? toDTO(result) : null;
};

export const changeTaskStatus = async (
  context: OrgTaskContext,
  taskId: string,
  userId: string,
  status: TaskStatus,
): Promise<OrgTaskDTO | null> => {
  if (status === TaskStatus.DONE) {
    const allDependenciesComplete = await taskDependencyRepository.checkAllDependenciesComplete(taskId);
    if (!allDependenciesComplete) {
      throw new ApiError(400, "Cannot mark task as done. Some dependencies are incomplete.");
    }
  }

  const result = await orgTaskRepository.executeInTransaction(async (client) => {
    const existing = await orgTaskRepository.findById(taskId, client);
    if (!existing) return null;
    const updated = await orgTaskRepository.updateStatus(taskId, status, client as any);
    if (!updated) return null;

    await logSpaceActivity(
      context,
      userId,
      LogEntityType.TASK,
      taskId,
      LogActionType.STATUS_CHANGED,
      { status: existing.status },
      { status },
      client,
    );

    return updated;
  });

  return result ? toDTO(result) : null;
};

export const deleteTask = async (
  context: OrgTaskContext,
  taskId: string,
  userId: string,
): Promise<void> => {
  await orgTaskRepository.executeInTransaction(async (client) => {
    const existing = await orgTaskRepository.findById(taskId, client);
    if (!existing) {
      throw new ApiError(404, "Task not found");
    }

    await orgTaskRepository.softDelete(taskId, client);
    await commentRepository.softDeleteByTaskId(taskId, client);
    await logSpaceActivity(
      context,
      userId,
      LogEntityType.TASK,
      taskId,
      LogActionType.TASK_DELETED,
      { title: existing.title },
      null,
      client,
    );
  });
};

export const assignUser = async (
  context: OrgTaskContext,
  taskId: string,
  assigneeUserId: string,
  userId: string,
): Promise<void> => {
  await orgTaskRepository.executeInTransaction(async (client) => {
    await taskAssigneeRepository.assign(taskId, assigneeUserId, client);
    await logSpaceActivity(
      context,
      userId,
      LogEntityType.TASK,
      taskId,
      LogActionType.ASSIGNMENT_ADDED,
      null,
      { assigned_user_id: assigneeUserId },
      client,
    );
  });
};

export const unassignUser = async (
  context: OrgTaskContext,
  taskId: string,
  assigneeUserId: string,
  userId: string,
): Promise<void> => {
  await orgTaskRepository.executeInTransaction(async (client) => {
    await taskAssigneeRepository.unassign(taskId, assigneeUserId, client);
    await logSpaceActivity(
      context,
      userId,
      LogEntityType.TASK,
      taskId,
      LogActionType.ASSIGNMENT_REMOVED,
      { assigned_user_id: assigneeUserId },
      null,
      client,
    );
  });
};

export const addDependency = async (
  context: OrgTaskContext,
  taskId: string,
  dependsOnTaskId: string,
  userId: string,
): Promise<void> => {
  const hasCircular = await taskDependencyRepository.hasCircularDependency(taskId, dependsOnTaskId);
  if (hasCircular) {
    throw new ApiError(400, "Cannot add dependency. This would create a circular dependency.");
  }

  await orgTaskRepository.executeInTransaction(async (client) => {
    await taskDependencyRepository.addDependency(taskId, dependsOnTaskId, client);
    await logSpaceActivity(
      context,
      userId,
      LogEntityType.TASK,
      taskId,
      LogActionType.DEPENDENCY_ADDED,
      null,
      { depends_on_task_id: dependsOnTaskId },
      client,
    );
  });
};

export const removeDependency = async (
  context: OrgTaskContext,
  taskId: string,
  dependsOnTaskId: string,
  userId: string,
): Promise<void> => {
  await orgTaskRepository.executeInTransaction(async (client) => {
    await taskDependencyRepository.removeDependency(taskId, dependsOnTaskId, client);
    await logSpaceActivity(
      context,
      userId,
      LogEntityType.TASK,
      taskId,
      LogActionType.DEPENDENCY_REMOVED,
      { depends_on_task_id: dependsOnTaskId },
      null,
      client,
    );
  });
};
