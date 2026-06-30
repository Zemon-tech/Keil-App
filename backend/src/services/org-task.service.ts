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
import { syncTaskToCalendar, deleteCalendarEvent, createGoogleMeetSpace } from "./google-calendar.service";
import { createServiceLogger } from "../lib/logger";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getS3Client } from "../lib/s3";
import { config } from "../config";
import pool from "../config/pg";


const log = createServiceLogger("gcal");

export interface OrgTaskDTO {
  id: string;
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
  creator_avatar_url?: string | null;
  created_at: string;
  updated_at: string;
  assignees?: Array<{ id: string; email: string; name: string | null; created_at: string }>;
  dependencies?: Array<{ id: string; title: string; status: TaskStatus; priority: TaskPriority; due_date: string | null }>;
  blocked_by_count?: number;
  subtask_count?: number;
  parent_task_title?: string;
  type?: 'task' | 'event';
  event_type?: string | null;
  location?: string | null;
  is_all_day?: boolean;
  meet_link?: string | null;
  guests?: string[] | null;
  user_space_role?: string;
  org_name?: string;
  space_name?: string;
  context?: any[] | null;
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
  meet_link?: string | null;
  create_meet_link?: boolean;
  guests?: string[];
  context?: any[] | null;
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
  meet_link?: string | null;
  create_meet_link?: boolean;
  guests?: string[];
  context?: any[] | null;
}

const toISO = (value: Date | string | null | undefined): string | null => {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
};

const toDTO = (task: Task & { assignees?: User[]; user_space_role?: string; creator_name?: string | null; creator_email?: string | null; creator_avatar_url?: string | null }): OrgTaskDTO => ({
  id: task.id,
  org_id: task.org_id ?? null,
  space_id: task.space_id ?? null,
  parent_task_id: task.parent_task_id,
  title: task.title,
  description: task.description ?? null,
  objective: task.objective ?? null,
  success_criteria: task.success_criteria ?? null,
  status: task.status,
  priority: task.priority,
  start_date: toISO(task.start_date),
  due_date: toISO(task.due_date),
  created_by: task.created_by,
  creator_name: task.creator_name ?? null,
  creator_email: task.creator_email ?? null,
  creator_avatar_url: task.creator_avatar_url ?? null,
  created_at: toISO(task.created_at)!,
  updated_at: toISO(task.updated_at)!,
  assignees: task.assignees as any,
  subtask_count: task.subtask_count ? parseInt(task.subtask_count.toString(), 10) : 0,
  type: task.type,
  event_type: task.event_type,
  location: task.location,
  is_all_day: task.is_all_day,
  meet_link: task.meet_link ?? null,
  guests: task.guests ?? null,
  user_space_role: task.user_space_role,
  org_name: (task as any).org_name,
  space_name: (task as any).space_name,
  context: task.context ?? [],
});

export const signTaskContextAttachments = async (dto: OrgTaskDTO | null): Promise<OrgTaskDTO | null> => {
  if (!dto) return null;
  if (dto.context && Array.isArray(dto.context)) {
    for (const item of dto.context) {
      if (item.type === "file" && item.s3Key) {
        try {
          const command = new GetObjectCommand({
            Bucket: config.awsS3BucketName,
            Key: item.s3Key,
          });
          item.url = await getSignedUrl(getS3Client(), command, { expiresIn: 3600 });
        } catch (err) {
          console.error("Failed to sign S3 attachment key:", item.s3Key, err);
        }
      }
    }
  }
  return dto;
};

export const signTasksContextAttachments = async (dtos: OrgTaskDTO[]): Promise<OrgTaskDTO[]> => {
  await Promise.all(dtos.map((dto) => signTaskContextAttachments(dto)));
  return dtos;
};

const validateDateOrder = (startDate?: Date | null, dueDate?: Date | null): void => {
  if (startDate && dueDate && dueDate < startDate) {
    throw new ApiError(400, "due_date must be on or after start_date");
  }
};

const validateSubtaskDates = async (
  parentTaskId: string,
  startDate?: Date | null,
  dueDate?: Date | null,
  client?: any
): Promise<{ start_date: Date | null; due_date: Date | null }> => {
  if (startDate === undefined && dueDate === undefined) return { start_date: null, due_date: null };
  if (startDate === null && dueDate === null) return { start_date: null, due_date: null };

  const parentTask = await orgTaskRepository.findById(parentTaskId, client);
  if (!parentTask) {
    throw new ApiError(404, "Parent task not found");
  }

  if (!parentTask.start_date || !parentTask.due_date) {
    throw new ApiError(
      400,
      "Parent task must be scheduled (have start and due dates) before scheduling subtasks"
    );
  }

  const pStart = new Date(parentTask.start_date);
  const pDue = new Date(parentTask.due_date);

  const subStart = startDate ? new Date(startDate) : null;

  const isSameDay = (d1: Date, d2: Date) =>
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate();

  if (subStart && isSameDay(subStart, pStart)) {
    return {
      start_date: pStart,
      due_date: pDue,
    };
  }

  if (startDate) {
    const sStart = new Date(startDate);
    if (sStart < pStart || sStart > pDue) {
      throw new ApiError(
        400,
        "Subtask dates are out of bounds of the parent task"
      );
    }
  }

  if (dueDate) {
    const sDue = new Date(dueDate);
    if (sDue < pStart || sDue > pDue) {
      throw new ApiError(
        400,
        "Subtask dates are out of bounds of the parent task"
      );
    }
  }

  return {
    start_date: startDate ? new Date(startDate) : null,
    due_date: dueDate ? new Date(dueDate) : null,
  };
};

const validateParentDatesForSubtasks = async (
  parentTaskId: string,
  newStartDate: Date | null | undefined,
  newDueDate: Date | null | undefined,
  client?: any
): Promise<void> => {
  const subtasks = await orgTaskRepository.findSubtasks(parentTaskId, client);
  const scheduledSubtasks = subtasks.filter((s) => s.start_date || s.due_date);
  if (scheduledSubtasks.length === 0) return;

  if (!newStartDate || !newDueDate) {
    throw new ApiError(
      400,
      "Cannot unschedule parent task while it has scheduled subtasks"
    );
  }

  const pStart = new Date(newStartDate);
  const pDue = new Date(newDueDate);

  for (const sub of scheduledSubtasks) {
    if (sub.start_date) {
      const sStart = new Date(sub.start_date);
      if (sStart < pStart || sStart > pDue) {
        throw new ApiError(
          400,
          `Subtask "${sub.title}" dates would fall out of bounds of the parent task's new dates`
        );
      }
    }
    if (sub.due_date) {
      const sDue = new Date(sub.due_date);
      if (sDue < pStart || sDue > pDue) {
        throw new ApiError(
          400,
          `Subtask "${sub.title}" dates would fall out of bounds of the parent task's new dates`
        );
      }
    }
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
  return signTasksContextAttachments(tasks.map((task) => toDTO(task)));
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

  return signTaskContextAttachments({
    ...toDTO(task),
    dependencies,
    blocked_by_count: dependencies.filter((dep) => dep.status !== TaskStatus.DONE).length,
    subtask_count: subtasks.length,
    parent_task_title: parentTaskTitle,
  });
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

  if (input.parent_task_id) {
    const adjusted = await validateSubtaskDates(input.parent_task_id, input.start_date ?? null, input.due_date ?? null);
    input.start_date = adjusted.start_date;
    input.due_date = adjusted.due_date;
  }

  // Separate assignee_ids from the DB columns
  const { assignee_ids, story_points, time_estimate, create_meet_link, ...taskData } = input;

  // Auto assign the task to the creator who is creating it
  const creatorId = input.created_by;
  const finalAssigneeIds = assignee_ids ? [...assignee_ids] : [];
  if (creatorId && !finalAssigneeIds.includes(creatorId)) {
    finalAssigneeIds.push(creatorId);
  }

  // Auto-generate Google Meet space if requested
  if (create_meet_link) {
    try {
      const meetLink = await createGoogleMeetSpace(input.created_by);
      (taskData as any).meet_link = meetLink;
    } catch (meetErr) {
      log.error({ err: meetErr, userId: input.created_by }, "Failed to auto-create Google Meet space on task creation");
    }
  }

  const task = await orgTaskRepository.executeInTransaction(async (client) => {
    const created = await orgTaskRepository.create(taskData as Partial<Task>, client);

    // Insert assignees if provided
    if (finalAssigneeIds.length > 0) {
      for (const userId of finalAssigneeIds) {
        await taskAssigneeRepository.assign(created.id, userId, client);
      }

      // Trigger task_assigned outbox job
      const senderRes = await client.query('SELECT name, email FROM public.users WHERE id = $1', [input.created_by]);
      const senderName = senderRes.rows[0]?.name || senderRes.rows[0]?.email || 'Someone';

      await client.query(
        `INSERT INTO public.notification_outbox (org_id, space_id, sender_id, event_type, entity_type, entity_id, payload)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          context.orgId,
          context.spaceId,
          input.created_by,
          'task_assigned',
          'task',
          created.id,
          JSON.stringify({
            recipient_ids: assignee_ids ?? [], // Keep original assignee_ids here to avoid echoing notification to creator
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

    if (created.start_date && created.due_date) {
      await client.query(
        `INSERT INTO public.task_slots (task_id, user_id, start_date, due_date, is_all_day)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT DO NOTHING`,
        [created.id, input.created_by, created.start_date, created.due_date, created.is_all_day ?? false]
      );
    }

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
      is_all_day: task.is_all_day ?? false,
      location: task.location ?? null,
      status: task.status,
      google_event_id: task.google_event_id,
      meet_link: task.meet_link ?? null,
      source: 'tasks',
      type: task.type,
    }).catch(err => log.error({ err }, 'Org task create sync failed'));
  }

  const signed = await signTaskContextAttachments(toDTO(task));
  if (!signed) {
    throw new ApiError(500, "Failed to sign task attachments");
  }
  return signed;
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

  if (existingTask.parent_task_id) {
    const finalStart = input.start_date !== undefined ? input.start_date : existingTask.start_date;
    const finalDue = input.due_date !== undefined ? input.due_date : existingTask.due_date;
    const adjusted = await validateSubtaskDates(existingTask.parent_task_id, finalStart, finalDue);
    input.start_date = adjusted.start_date ?? undefined;
    input.due_date = adjusted.due_date ?? undefined;
  } else {
    const finalStart = input.start_date !== undefined ? input.start_date : existingTask.start_date;
    const finalDue = input.due_date !== undefined ? input.due_date : existingTask.due_date;
    await validateParentDatesForSubtasks(taskId, finalStart, finalDue);
  }

  // Auto-generate Google Meet space if requested on update
  if (input.create_meet_link && !existingTask.meet_link) {
    try {
      const meetLink = await createGoogleMeetSpace(userId);
      input.meet_link = meetLink;
    } catch (meetErr) {
      log.error({ err: meetErr, userId }, "Failed to auto-create Google Meet space on task update");
    }
  }

  const result = await orgTaskRepository.executeInTransaction(async (client) => {
    const { create_meet_link, ...updates } = input;
    const updated = await orgTaskRepository.update(taskId, updates as Partial<Task>, client);
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

      if (input.status === TaskStatus.DONE) {
        await deleteCompletedTaskSlots(client, taskId);
        const subtasks = await orgTaskRepository.findSubtasks(taskId, client);
        for (const subtask of subtasks) {
          if (subtask.status !== TaskStatus.DONE) {
            await orgTaskRepository.updateStatus(subtask.id, TaskStatus.DONE, client);
            await logSpaceActivity(
              context,
              userId,
              LogEntityType.TASK,
              subtask.id,
              LogActionType.STATUS_CHANGED,
              { status: subtask.status },
              { status: TaskStatus.DONE },
              client,
            );
          }
        }
      }

      // Trigger task_status_changed outbox job
      const assigneesRes = await client.query('SELECT user_id FROM public.task_assignees WHERE task_id = $1', [taskId]);
      const assigneeIds = assigneesRes.rows.map((r: any) => r.user_id as string);

      if (assigneeIds.length > 0) {
        const senderRes = await client.query('SELECT name, email FROM public.users WHERE id = $1', [userId]);
        const senderName = senderRes.rows[0]?.name || senderRes.rows[0]?.email || 'Someone';

        await client.query(
          `INSERT INTO public.notification_outbox (org_id, space_id, sender_id, event_type, entity_type, entity_id, payload)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
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

    if (updated.start_date && updated.due_date) {
      const slotRes = await client.query(
        `SELECT id FROM public.task_slots WHERE task_id = $1`,
        [taskId]
      );
      if (slotRes.rows.length > 0) {
        await client.query(
          `UPDATE public.task_slots 
           SET start_date = $1, due_date = $2, is_all_day = $3, updated_at = NOW() 
           WHERE task_id = $4`,
          [updated.start_date, updated.due_date, updated.is_all_day ?? false, taskId]
        );
      } else {
        await client.query(
          `INSERT INTO public.task_slots (task_id, user_id, start_date, due_date, is_all_day)
           VALUES ($1, $2, $3, $4, $5)`,
          [taskId, userId, updated.start_date, updated.due_date, updated.is_all_day ?? false]
        );
      }
    } else {
      await client.query(
        `DELETE FROM public.task_slots WHERE task_id = $1`,
        [taskId]
      );
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
      is_all_day: result.is_all_day ?? false,
      location: result.location ?? null,
      status: result.status,
      google_event_id: result.google_event_id,
      meet_link: result.meet_link ?? null,
      source: 'tasks',
      type: result.type,
    }).catch(err => log.error({ err }, 'Org task update sync failed'));
  }

  return result ? signTaskContextAttachments(toDTO(result)) : null;
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

    if (status === TaskStatus.DONE) {
      await deleteCompletedTaskSlots(client, taskId);
      const subtasks = await orgTaskRepository.findSubtasks(taskId, client);
      for (const subtask of subtasks) {
        if (subtask.status !== TaskStatus.DONE) {
          await orgTaskRepository.updateStatus(subtask.id, TaskStatus.DONE, client);
          await logSpaceActivity(
            context,
            userId,
            LogEntityType.TASK,
            subtask.id,
            LogActionType.STATUS_CHANGED,
            { status: subtask.status },
            { status: TaskStatus.DONE },
            client,
          );
        }
      }
    }

    // Trigger task_status_changed outbox job
    const assigneesRes = await client.query('SELECT user_id FROM public.task_assignees WHERE task_id = $1', [taskId]);
    const assigneeIds = assigneesRes.rows.map((r: any) => r.user_id as string);

    if (assigneeIds.length > 0) {
      const senderRes = await client.query('SELECT name, email FROM public.users WHERE id = $1', [userId]);
      const senderName = senderRes.rows[0]?.name || senderRes.rows[0]?.email || 'Someone';

      await client.query(
        `INSERT INTO public.notification_outbox (org_id, space_id, sender_id, event_type, entity_type, entity_id, payload)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
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
      deleteCalendarEvent(userId, existing.google_event_id, existing.type)
        .catch(err => log.error({ err }, 'Org task delete calendar event failed'));
    }

    await orgTaskRepository.softDelete(taskId, client);
    await client.query(`DELETE FROM public.task_slots WHERE task_id = $1`, [taskId]);
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
    const taskRes = await client.query('SELECT title FROM public.tasks WHERE id = $1', [taskId]);
    const task = taskRes.rows[0];
    if (task) {
      const senderRes = await client.query('SELECT name, email FROM public.users WHERE id = $1', [userId]);
      const senderName = senderRes.rows[0]?.name || senderRes.rows[0]?.email || 'Someone';

      await client.query(
        `INSERT INTO public.notification_outbox (org_id, space_id, sender_id, event_type, entity_type, entity_id, payload)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
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

// ─── Slot Deletion Preference Helper ───
export const deleteCompletedTaskSlots = async (client: any, taskId: string): Promise<void> => {
  await client.query(
    `DELETE FROM public.task_slots 
     WHERE task_id = $1 
       AND user_id IN (
         SELECT user_id FROM public.user_app_preferences WHERE delete_slots_on_complete = TRUE
       )`,
    [taskId]
  );
};

// ─── Personal Checklist Service Methods ───

export interface PersonalChecklist {
  id: string;
  task_id: string;
  user_id: string;
  title: string;
  is_completed: boolean;
  created_at: Date;
  updated_at: Date;
}

export const getChecklistsByTask = async (
  taskId: string,
  userId: string
): Promise<PersonalChecklist[]> => {
  const result = await pool.query(
    `
      SELECT * FROM public.personal_checklists
      WHERE task_id = $1 AND user_id = $2
      ORDER BY created_at ASC
    `,
    [taskId, userId]
  );
  return result.rows;
};

export const createChecklist = async (
  taskId: string,
  userId: string,
  title: string
): Promise<PersonalChecklist> => {
  const result = await pool.query(
    `
      INSERT INTO public.personal_checklists (task_id, user_id, title)
      VALUES ($1, $2, $3)
      RETURNING *
    `,
    [taskId, userId, title]
  );
  return result.rows[0];
};

export const updateChecklist = async (
  checklistId: string,
  userId: string,
  updates: { title?: string; is_completed?: boolean }
): Promise<PersonalChecklist | null> => {
  const fields: string[] = [];
  const params: any[] = [checklistId, userId];

  if (updates.title !== undefined) {
    params.push(updates.title);
    fields.push(`title = $${params.length}`);
  }

  if (updates.is_completed !== undefined) {
    params.push(updates.is_completed);
    fields.push(`is_completed = $${params.length}`);
  }

  if (fields.length === 0) return null;

  params.push(new Date());
  fields.push(`updated_at = $${params.length}`);

  const query = `
    UPDATE public.personal_checklists
    SET ${fields.join(", ")}
    WHERE id = $1 AND user_id = $2
    RETURNING *
  `;

  const result = await pool.query(query, params);
  return result.rows.length > 0 ? result.rows[0] : null;
};

export const deleteChecklist = async (
  checklistId: string,
  userId: string
): Promise<boolean> => {
  const result = await pool.query(
    `
      DELETE FROM public.personal_checklists
      WHERE id = $1 AND user_id = $2
      RETURNING id
    `,
    [checklistId, userId]
  );
  return result.rows.length > 0;
};

// ─── Task Slot Service Methods ───

export interface TaskSlot {
  id: string;
  task_id: string;
  checklist_id: string | null;
  user_id: string;
  start_date: Date;
  due_date: Date;
  is_all_day: boolean;
  status: string;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
  task_title?: string;
  task_type?: string;
  task_status?: string;
  task_priority?: string;
}

export const getSlotsBySpace = async (
  spaceId: string,
  userId: string,
  spaceRole: string
): Promise<TaskSlot[]> => {
  let query = `
    SELECT 
      ts.*, 
      t.title as task_title, 
      t.type as task_type, 
      t.status as task_status, 
      t.priority as task_priority,
      pc.title as checklist_title,
      u.name as user_name,
      u.email as user_email
    FROM public.task_slots ts
    INNER JOIN public.tasks t ON t.id = ts.task_id
    INNER JOIN public.users u ON u.id = ts.user_id
    LEFT JOIN public.personal_checklists pc ON pc.id = ts.checklist_id
    WHERE t.space_id = $1 AND t.deleted_at IS NULL
  `;
  const params: any[] = [spaceId];

  // If role is member, restrict to only their slots
  if (spaceRole !== "admin" && spaceRole !== "manager") {
    params.push(userId);
    query += ` AND ts.user_id = $2`;
  }

  query += ` ORDER BY ts.start_date ASC`;

  const result = await pool.query(query, params);
  return result.rows;
};

export const createSlot = async (
  taskId: string,
  userId: string,
  input: { start_date: Date; due_date: Date; is_all_day?: boolean; checklist_id?: string | null; notes?: string }
): Promise<TaskSlot> => {
  const initialTask = await orgTaskRepository.findById(taskId);
  if (!initialTask) {
    throw new ApiError(404, "Task not found");
  }
  if (initialTask.parent_task_id) {
    const adjusted = await validateSubtaskDates(initialTask.parent_task_id, input.start_date, input.due_date);
    if (adjusted.start_date) input.start_date = adjusted.start_date;
    if (adjusted.due_date) input.due_date = adjusted.due_date;
  }

  await pool.query(
    `UPDATE public.tasks 
     SET start_date = $1, due_date = $2, is_all_day = $3, updated_at = NOW() 
     WHERE id = $4`,
    [input.start_date, input.due_date, input.is_all_day ?? false, taskId]
  );

  const result = await pool.query(
    `
      INSERT INTO public.task_slots (task_id, user_id, start_date, due_date, is_all_day, checklist_id, notes)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `,
    [
      taskId,
      userId,
      input.start_date,
      input.due_date,
      input.is_all_day ?? false,
      input.checklist_id ?? null,
      input.notes ?? null
    ]
  );

  // Sync to Google Calendar/Tasks
  const task = await orgTaskRepository.findById(taskId);
  if (task && task.start_date) {
    syncTaskToCalendar(userId, {
      id: task.id,
      title: task.title,
      description: task.description,
      start_date: task.start_date,
      due_date: task.due_date,
      is_all_day: task.is_all_day,
      location: task.location,
      status: task.status,
      google_event_id: task.google_event_id,
      meet_link: task.meet_link,
      source: 'tasks',
      type: task.type,
    }).catch(err => log.error({ err }, 'Google sync failed after slot creation'));
  }

  return result.rows[0];
};

export const updateSlot = async (
  slotId: string,
  userId: string,
  spaceRole: string,
  updates: { start_date?: Date; due_date?: Date; is_all_day?: boolean; notes?: string; status?: string }
): Promise<TaskSlot | null> => {
  const existingSlotRes = await pool.query(
    `SELECT task_id, start_date, due_date FROM public.task_slots WHERE id = $1`,
    [slotId]
  );
  const existingSlot = existingSlotRes.rows[0];
  if (!existingSlot) {
    return null;
  }

  const initialTask = await orgTaskRepository.findById(existingSlot.task_id);
  if (initialTask && initialTask.parent_task_id) {
    const finalStart = updates.start_date !== undefined ? updates.start_date : new Date(existingSlot.start_date);
    const finalDue = updates.due_date !== undefined ? updates.due_date : new Date(existingSlot.due_date);
    const adjusted = await validateSubtaskDates(initialTask.parent_task_id, finalStart, finalDue);
    updates.start_date = adjusted.start_date ?? undefined;
    updates.due_date = adjusted.due_date ?? undefined;
  }
  const fields: string[] = [];
  const params: any[] = [slotId];

  if (updates.start_date !== undefined) {
    params.push(updates.start_date);
    fields.push(`start_date = $${params.length}`);
  }
  if (updates.due_date !== undefined) {
    params.push(updates.due_date);
    fields.push(`due_date = $${params.length}`);
  }
  if (updates.is_all_day !== undefined) {
    params.push(updates.is_all_day);
    fields.push(`is_all_day = $${params.length}`);
  }
  if (updates.notes !== undefined) {
    params.push(updates.notes);
    fields.push(`notes = $${params.length}`);
  }
  if (updates.status !== undefined) {
    params.push(updates.status);
    fields.push(`status = $${params.length}`);
  }

  if (fields.length === 0) return null;

  params.push(new Date());
  fields.push(`updated_at = $${params.length}`);

  let query = `UPDATE public.task_slots SET ${fields.join(", ")} WHERE id = $1`;

  // Members can only update their own slots
  if (spaceRole !== "admin" && spaceRole !== "manager") {
    params.push(userId);
    query += ` AND user_id = $${params.length}`;
  }

  query += ` RETURNING *`;

  const result = await pool.query(query, params);
  const updatedSlot = result.rows.length > 0 ? result.rows[0] : null;

  if (updatedSlot) {
    await pool.query(
      `UPDATE public.tasks 
       SET start_date = $1, due_date = $2, is_all_day = $3, updated_at = NOW() 
       WHERE id = $4`,
      [updatedSlot.start_date, updatedSlot.due_date, updatedSlot.is_all_day, updatedSlot.task_id]
    );

    // Sync to Google Calendar/Tasks
    const task = await orgTaskRepository.findById(updatedSlot.task_id);
    if (task) {
      syncTaskToCalendar(userId, {
        id: task.id,
        title: task.title,
        description: task.description,
        start_date: task.start_date,
        due_date: task.due_date,
        is_all_day: task.is_all_day,
        location: task.location,
        status: task.status,
        google_event_id: task.google_event_id,
        meet_link: task.meet_link,
        source: 'tasks',
        type: task.type,
      }).catch(err => log.error({ err }, 'Google sync failed after slot update'));
    }
  }

  return updatedSlot;
};

export const deleteSlot = async (
  slotId: string,
  userId: string,
  spaceRole: string
): Promise<boolean> => {
  const slotRes = await pool.query(
    `SELECT task_id FROM public.task_slots WHERE id = $1`,
    [slotId]
  );
  const taskId = slotRes.rows[0]?.task_id;

  let query = `DELETE FROM public.task_slots WHERE id = $1`;
  const params: any[] = [slotId];

  if (spaceRole !== "admin" && spaceRole !== "manager") {
    params.push(userId);
    query += ` AND user_id = $2`;
  }
  query += ` RETURNING id`;

  const result = await pool.query(query, params);
  const deleted = result.rows.length > 0;

  if (deleted && taskId) {
    const task = await orgTaskRepository.findById(taskId);
    await pool.query(
      `UPDATE public.tasks 
       SET start_date = NULL, due_date = NULL, updated_at = NOW() 
       WHERE id = $1`,
      [taskId]
    );

    if (task) {
      // Sync with start_date = null to remove from Google
      syncTaskToCalendar(userId, {
        id: task.id,
        title: task.title,
        description: task.description,
        start_date: null,
        due_date: null,
        is_all_day: task.is_all_day,
        location: task.location,
        status: task.status,
        google_event_id: task.google_event_id,
        meet_link: task.meet_link,
        source: 'tasks',
        type: task.type,
      }).catch(err => log.error({ err }, 'Google sync failed after slot deletion'));
    }
  }

  return deleted;
};

