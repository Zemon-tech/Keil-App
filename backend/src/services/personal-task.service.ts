import { ApiError } from "../utils/ApiError";
import { personalTaskRepository } from "../repositories";
import { PersonalTask } from "../types/entities";
import { TaskPriority, TaskStatus } from "../types/enums";
import { TaskQueryOptions } from "../types/repository";

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
});

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
  return tasks.map(toDTO);
};

export const getPersonalTaskById = async (
  taskId: string,
  ownerUserId: string,
): Promise<PersonalTaskDTO | null> => {
  const task = await personalTaskRepository.findById(taskId);
  if (!task || task.owner_user_id !== ownerUserId) {
    return null;
  }
  return toDTO(task);
};

export const createPersonalTask = async (
  input: CreatePersonalTaskInput,
): Promise<PersonalTaskDTO> => {
  validateDateOrder(input.start_date ?? null, input.due_date ?? null);

  const task = await personalTaskRepository.create(input);
  return toDTO(task);
};

export const updatePersonalTask = async (
  taskId: string,
  ownerUserId: string,
  input: UpdatePersonalTaskInput,
): Promise<PersonalTaskDTO | null> => {
  const existingTask = await personalTaskRepository.findById(taskId);
  if (!existingTask || existingTask.owner_user_id !== ownerUserId) {
    return null;
  }

  const finalStart = input.start_date !== undefined ? input.start_date : existingTask.start_date;
  const finalDue = input.due_date !== undefined ? input.due_date : existingTask.due_date;
  validateDateOrder(finalStart ?? null, finalDue ?? null);

  const updated = await personalTaskRepository.update(taskId, input);
  return updated ? toDTO(updated) : null;
};

export const deletePersonalTask = async (taskId: string, ownerUserId: string): Promise<boolean> => {
  const existingTask = await personalTaskRepository.findById(taskId);
  if (!existingTask || existingTask.owner_user_id !== ownerUserId) {
    return false;
  }

  await personalTaskRepository.softDelete(taskId);
  return true;
};
