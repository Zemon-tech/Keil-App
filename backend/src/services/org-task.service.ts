import {
  activityRepository,
  commentRepository,
  orgTaskRepository,
  taskAssigneeRepository,
  taskDependencyRepository,
} from "../repositories";
import { Task, User } from "../types/entities";
import { LogActionType, LogEntityType, TaskPriority, TaskStatus, SpaceRole } from "../types/enums";
import { TaskQueryOptions } from "../types/repository";
import { ApiError } from "../utils/ApiError";
import { syncTaskToCalendar, deleteCalendarEvent } from "./google-calendar.service";
import { createServiceLogger } from "../lib/logger";

const log = createServiceLogger("gcal");

export interface OrgTaskDTO {
  id: string;
  workspace_id: string | null;
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
  creator_name: string | null;
  creator_email: string | null;
  created_at: string;
  updated_at: string;
  assignees?: Array<{ id: string; email: string; name: string | null; created_at: string }>;
  dependencies?: Array<{ id: string; title: string; status: TaskStatus; priority: TaskPriority; due_date: string | null }>;
  blocked_by_count?: number;
  subtask_count?: number;
  parent_task_title?: string;
  type?: 'task' | 'event';
  event_type?: string | null;
  user_space_role?: string;
  org_name?: string;
  space_name?: string;
}

export interface OrgTaskContext {
  orgId: string;
  spaceId: string;
}

export interface CreateOrgTaskInput {
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
  type?: 'task' | 'event';
  event_type?: string | null;
  location?: string | null;
  is_all_day?: boolean;
  assignee_ids?: string[];
  story_points?: number | null;
  time_estimate?: number | null;
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
  type?: 'task' | 'event';
  event_type?: string | null;
  location?: string | null;
  is_all_day?: boolean;
  story_points?: number | null;
  time_estimate?: number | null;
}

const toISO = (value: Date | string | null | undefined): string | null => {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
};

const toDTO = (task: Task & { assignees?: User[]; user_space_role?: string; creator_name?: string | null; creator_email?: string | null }): OrgTaskDTO => ({
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
  creator_name: task.creator_name ?? null,
  creator_email: task.creator_email ?? null,
  created_at: toISO(task.created_at)!,
  updated_at: toISO(task.updated_at)!,
  assignees: task.assignees as any,
  subtask_count: task.subtask_count ? parseInt(task.subtask_count.toString(), 10) : 0,
  type: task.type,
  event_type: task.event_type,
  user_space_role: task.user_space_role,
  org_name: (task as any).org_name,
  space_name: (task as any).space_name,
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

  // Separate assignee_ids from the DB columns
  const { assignee_ids, story_points, time_estimate, ...taskData } = input;

  const task = await orgTaskRepository.executeInTransaction(async (client) => {
    const created = await orgTaskRepository.create(taskData as Partial<Task>, client);

    // Insert assignees if provided
    if (assignee_ids && assignee_ids.length > 0) {
      for (const userId of assignee_ids) {
        await taskAssigneeRepository.assign(created.id, userId, client);
      }

      // Trigger task_assigned outbox job
      const senderRes = await client.query('SELECT name, email FROM public.users WHERE id = $1', [input.created_by]);
      const senderName = senderRes.rows[0]?.name || senderRes.rows[0]?.email || 'Someone';

      await client.query(
        `INSERT INTO public.notification_outbox (workspace_id, org_id, space_id, sender_id, event_type, entity_type, entity_id, payload)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          created.workspace_id ?? null,
          context.orgId,
          context.spaceId,
          input.created_by,
          'task_assigned',
          'task',
          created.id,
          JSON.stringify({
            recipient_ids: assignee_ids,
            task_title: created.title,
            sender_name: senderName
          })
        ]
      );
    }

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

  // Fire-and-forget Google Calendar sync — never blocks the task creation
  if (task.start_date) {
    syncTaskToCalendar(input.created_by, {
      id: task.id,
      title: task.title,
      description: task.description,
      start_date: task.start_date ? new Date(task.start_date) : null,
      due_date: task.due_date ? new Date(task.due_date) : null,
      is_all_day: false,
      location: null,
      status: task.status,
      google_event_id: task.google_event_id,
      source: 'tasks',
    }).catch(err => log.error({ err }, 'Org task create sync failed'));
  }

  return toDTO(task);
};

export const updateTask = async (
  context: OrgTaskContext,
  taskId: string,
  userId: string,
  input: UpdateOrgTaskInput,
  options?: { skipGoogleSync?: boolean },
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

      // Trigger task_status_changed outbox job
      const assigneesRes = await client.query('SELECT user_id FROM public.task_assignees WHERE task_id = $1', [taskId]);
      const assigneeIds = assigneesRes.rows.map((r: any) => r.user_id as string);
      
      if (assigneeIds.length > 0) {
        const senderRes = await client.query('SELECT name, email FROM public.users WHERE id = $1', [userId]);
        const senderName = senderRes.rows[0]?.name || senderRes.rows[0]?.email || 'Someone';

        await client.query(
          `INSERT INTO public.notification_outbox (workspace_id, org_id, space_id, sender_id, event_type, entity_type, entity_id, payload)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            existingTask.workspace_id ?? null,
            context.orgId,
            context.spaceId,
            userId,
            'task_status_changed',
            'task',
            taskId,
            JSON.stringify({
              recipient_ids: assigneeIds,
              task_title: existingTask.title,
              sender_name: senderName,
              status: input.status
            })
          ]
        );
      }
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

  if (result && !options?.skipGoogleSync) {
    // Fire-and-forget Google Calendar sync — never blocks the task update
    syncTaskToCalendar(userId, {
      id: result.id,
      title: result.title,
      description: result.description,
      start_date: result.start_date ? new Date(result.start_date) : null,
      due_date: result.due_date ? new Date(result.due_date) : null,
      is_all_day: false,
      location: null,
      status: result.status,
      google_event_id: result.google_event_id,
      source: 'tasks',
    }).catch(err => log.error({ err }, 'Org task update sync failed'));
  }

  return result ? toDTO(result) : null;
};

export const changeTaskStatus = async (
  context: OrgTaskContext,
  taskId: string,
  userId: string,
  status: TaskStatus,
  spaceRole: SpaceRole,
): Promise<OrgTaskDTO | null> => {
  if (spaceRole === "member") {
    const isAssigned = await taskAssigneeRepository.isAssigned(taskId, userId);
    if (!isAssigned) {
      throw new ApiError(403, "Members can only change status of tasks assigned to them");
    }
  }

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

    // Trigger task_status_changed outbox job
    const assigneesRes = await client.query('SELECT user_id FROM public.task_assignees WHERE task_id = $1', [taskId]);
    const assigneeIds = assigneesRes.rows.map((r: any) => r.user_id as string);
    
    if (assigneeIds.length > 0) {
      const senderRes = await client.query('SELECT name, email FROM public.users WHERE id = $1', [userId]);
      const senderName = senderRes.rows[0]?.name || senderRes.rows[0]?.email || 'Someone';

      await client.query(
        `INSERT INTO public.notification_outbox (workspace_id, org_id, space_id, sender_id, event_type, entity_type, entity_id, payload)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          existing.workspace_id ?? null,
          context.orgId,
          context.spaceId,
          userId,
          'task_status_changed',
          'task',
          taskId,
          JSON.stringify({
            recipient_ids: assigneeIds,
            task_title: existing.title,
            sender_name: senderName,
            status: status
          })
        ]
      );
    }

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

    // Fire-and-forget Google Calendar event deletion
    if (existing.google_event_id) {
      deleteCalendarEvent(userId, existing.google_event_id)
        .catch(err => log.error({ err }, 'Org task delete calendar event failed'));
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

    // Trigger task_assigned outbox job
    const taskRes = await client.query('SELECT workspace_id, title FROM public.tasks WHERE id = $1', [taskId]);
    const task = taskRes.rows[0];
    if (task) {
      const senderRes = await client.query('SELECT name, email FROM public.users WHERE id = $1', [userId]);
      const senderName = senderRes.rows[0]?.name || senderRes.rows[0]?.email || 'Someone';

      await client.query(
        `INSERT INTO public.notification_outbox (workspace_id, org_id, space_id, sender_id, event_type, entity_type, entity_id, payload)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          task.workspace_id ?? null,
          context.orgId,
          context.spaceId,
          userId,
          'task_assigned',
          'task',
          taskId,
          JSON.stringify({
            recipient_ids: [assigneeUserId],
            task_title: task.title,
            sender_name: senderName
          })
        ]
      );
    }
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
