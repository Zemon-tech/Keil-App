import { ApiError } from "../utils/ApiError";
import { personalTaskRepository } from "../repositories";
import { PersonalTask } from "../types/entities";
import { TaskPriority, TaskStatus } from "../types/enums";
import { TaskQueryOptions } from "../types/repository";
import { syncTaskToCalendar, deleteCalendarEvent } from "./google-calendar.service";
import { createServiceLogger } from "../lib/logger";
import { getS3Client } from "../lib/s3";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { config } from "../config";

const log = createServiceLogger("gcal");

export interface PersonalTaskDTO {
  id: string;
  owner_user_id: string;
  parent_task_id: string | null;
  title: string;
  description: string | null;
  objective: string | null;
  success_criteria: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  start_date: string | null;
  due_date: string | null;
  created_at: string;
  updated_at: string;
  location?: string | null;
  meet_link?: string | null;
  context?: any[] | null;
}

export interface CreatePersonalTaskInput {
  owner_user_id: string;
  parent_task_id?: string | null;
  title: string;
  description?: string | null;
  objective?: string | null;
  success_criteria?: string | null;
  status?: TaskStatus;
  priority?: TaskPriority;
  start_date?: Date | null;
  due_date?: Date | null;
  location?: string | null;
  meet_link?: string | null;
  context?: any[] | null;
}

export interface UpdatePersonalTaskInput {
  title?: string;
  description?: string | null;
  objective?: string | null;
  success_criteria?: string | null;
  status?: TaskStatus;
  priority?: TaskPriority;
  start_date?: Date | null;
  due_date?: Date | null;
  location?: string | null;
  meet_link?: string | null;
  context?: any[] | null;
}

const toDTO = (task: PersonalTask): PersonalTaskDTO => ({
  id: task.id,
  owner_user_id: task.owner_user_id,
  parent_task_id: task.parent_task_id,
  title: task.title,
  description: task.description,
  objective: task.objective,
  success_criteria: task.success_criteria,
  status: task.status,
  priority: task.priority,
  start_date: task.start_date ? task.start_date.toISOString() : null,
  due_date: task.due_date ? task.due_date.toISOString() : null,
  created_at: task.created_at.toISOString(),
  updated_at: task.updated_at.toISOString(),
  location: task.location,
  meet_link: task.meet_link ?? null,
  context: task.context ?? [],
});

export const signPersonalTaskContextAttachments = async (dto: PersonalTaskDTO | null): Promise<PersonalTaskDTO | null> => {
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
          console.error("Failed to sign S3 attachment key for personal task:", item.s3Key, err);
        }
      }
    }
  }
  return dto;
};

export const signPersonalTasksContextAttachments = async (dtos: PersonalTaskDTO[]): Promise<PersonalTaskDTO[]> => {
  await Promise.all(dtos.map((dto) => signPersonalTaskContextAttachments(dto)));
  return dtos;
};

const validateDateOrder = (startDate?: Date | null, dueDate?: Date | null): void => {
  if (startDate && dueDate && dueDate < startDate) {
    throw new ApiError(400, "due_date must be on or after start_date");
  }
};

export const getPersonalTasks = async (
  ownerUserId: string,
  options: TaskQueryOptions = {},
): Promise<PersonalTaskDTO[]> => {
  const tasks = await personalTaskRepository.findByOwner(ownerUserId, options);
  return signPersonalTasksContextAttachments(tasks.map(toDTO));
};

export const getPersonalTaskById = async (
  taskId: string,
  ownerUserId: string,
): Promise<PersonalTaskDTO | null> => {
  const task = await personalTaskRepository.findById(taskId);
  if (!task || task.owner_user_id !== ownerUserId) {
    return null;
  }
  return signPersonalTaskContextAttachments(toDTO(task));
};

export const createPersonalTask = async (
  input: CreatePersonalTaskInput,
): Promise<PersonalTaskDTO> => {
  validateDateOrder(input.start_date ?? null, input.due_date ?? null);

  const task = await personalTaskRepository.create(input);

  // Fire-and-forget Google Calendar sync on create — never blocks the response
  if (task.start_date) {
    syncTaskToCalendar(input.owner_user_id, {
      id: task.id,
      title: task.title,
      description: task.description,
      start_date: task.start_date,
      due_date: task.due_date,
      is_all_day: false,
      location: task.location ?? null,
      status: task.status,
      google_event_id: task.google_event_id,
      meet_link: task.meet_link ?? null,
      source: 'personal_tasks',
    }).catch(err => log.error({ err }, 'Personal task create sync failed'));
  }

  return signPersonalTaskContextAttachments(toDTO(task)) as Promise<PersonalTaskDTO>;
};

export const updatePersonalTask = async (
  taskId: string,
  ownerUserId: string,
  input: UpdatePersonalTaskInput,
  options?: { skipGoogleSync?: boolean },
): Promise<PersonalTaskDTO | null> => {
  const existingTask = await personalTaskRepository.findById(taskId);
  if (!existingTask || existingTask.owner_user_id !== ownerUserId) {
    return null;
  }

  const finalStart = input.start_date !== undefined ? input.start_date : existingTask.start_date;
  const finalDue = input.due_date !== undefined ? input.due_date : existingTask.due_date;
  validateDateOrder(finalStart ?? null, finalDue ?? null);

  const updated = await personalTaskRepository.update(taskId, input);
  if (!updated) return null;

  // Fire-and-forget Google Calendar sync — never blocks the task update
  // Guard: skip if this update originated from an inbound Google event (prevents echo loop)
  if (!options?.skipGoogleSync) {
    syncTaskToCalendar(ownerUserId, {
      id: updated.id,
      title: updated.title,
      description: updated.description,
      start_date: updated.start_date,
      due_date: updated.due_date,
      is_all_day: false, // personal tasks don't have is_all_day
      location: updated.location ?? null,
      status: updated.status,
      google_event_id: updated.google_event_id,
      meet_link: updated.meet_link ?? null,
      source: 'personal_tasks',
    }).catch(err => log.error({ err }, 'Personal task sync failed'));
  }

  return signPersonalTaskContextAttachments(toDTO(updated));
};

export const deletePersonalTask = async (taskId: string, ownerUserId: string): Promise<boolean> => {
  const existingTask = await personalTaskRepository.findById(taskId);
  if (!existingTask || existingTask.owner_user_id !== ownerUserId) {
    return false;
  }

  // Fire-and-forget Google Calendar event deletion
  if (existingTask.google_event_id) {
    deleteCalendarEvent(ownerUserId, existingTask.google_event_id)
      .catch(err => log.error({ err }, 'Delete personal task calendar event failed'));
  }

  await personalTaskRepository.softDelete(taskId);
  return true;
};
