import { Request, Response } from "express";
import { catchAsync } from "../utils/catchAsync";
import { ApiError } from "../utils/ApiError";
import { ApiResponse } from "../utils/ApiResponse";
import * as personalTaskService from "../services/personal-task.service";
import { TaskPriority, TaskStatus } from "../types/enums";
import { TaskQueryOptions } from "../types/repository";

const validateStatus = (status: unknown): status is TaskStatus =>
  typeof status === "string" && Object.values(TaskStatus).includes(status as TaskStatus);

const validatePriority = (priority: unknown): priority is TaskPriority =>
  typeof priority === "string" && Object.values(TaskPriority).includes(priority as TaskPriority);

const parseOptionalDate = (value: unknown, fieldName: string): Date | null | undefined => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const parsed = new Date(value as string);
  if (Number.isNaN(parsed.getTime())) {
    throw new ApiError(400, `Invalid ${fieldName} format`);
  }
  return parsed;
};

const asString = (value: string | string[] | undefined): string =>
  Array.isArray(value) ? value[0] : (value ?? "");

export const getPersonalTasks = catchAsync(async (req: Request, res: Response) => {
  const userId = (req as any).user?.id as string;
  const { status, priority, limit, offset, parent_task_id } = req.query;

  const options: TaskQueryOptions = {
    pagination: {
      limit: limit ? parseInt(limit as string, 10) : 20,
      offset: offset ? parseInt(offset as string, 10) : 0,
    },
    filters: {},
  };

  if (status) {
    if (!validateStatus(status)) throw new ApiError(400, "Invalid status");
    options.filters!.status = status;
  }

  if (priority) {
    if (!validatePriority(priority)) throw new ApiError(400, "Invalid priority");
    options.filters!.priority = priority;
  }

  if (parent_task_id !== undefined) {
    options.filters!.parentTaskId = parent_task_id === "null" ? null : (parent_task_id as string);
  }

  const tasks = await personalTaskService.getPersonalTasks(userId, options);
  res.status(200).json(new ApiResponse(200, tasks, "Personal tasks retrieved successfully"));
});

export const createPersonalTask = catchAsync(async (req: Request, res: Response) => {
  const userId = (req as any).user?.id as string;
  const { title, status, priority, start_date, due_date, parent_task_id, description, objective, success_criteria } =
    req.body;

  if (!title || typeof title !== "string" || title.trim() === "") {
    throw new ApiError(400, "Title is required");
  }

  if (status && !validateStatus(status)) throw new ApiError(400, "Invalid status");
  if (priority && !validatePriority(priority)) throw new ApiError(400, "Invalid priority");

  const task = await personalTaskService.createPersonalTask({
    owner_user_id: userId,
    parent_task_id,
    title: title.trim(),
    description,
    objective,
    success_criteria,
    status,
    priority,
    start_date: parseOptionalDate(start_date, "start_date"),
    due_date: parseOptionalDate(due_date, "due_date"),
  });

  res.status(201).json(new ApiResponse(201, task, "Personal task created successfully"));
});

export const getPersonalTaskById = catchAsync(async (req: Request, res: Response) => {
  const userId = (req as any).user?.id as string;
  const task = await personalTaskService.getPersonalTaskById(asString(req.params.id), userId);
  if (!task) throw new ApiError(404, "Personal task not found");

  res.status(200).json(new ApiResponse(200, task, "Personal task retrieved successfully"));
});

export const updatePersonalTask = catchAsync(async (req: Request, res: Response) => {
  const userId = (req as any).user?.id as string;
  const { status, priority, start_date, due_date, ...rest } = req.body;

  if (status !== undefined && !validateStatus(status)) throw new ApiError(400, "Invalid status");
  if (priority !== undefined && !validatePriority(priority)) throw new ApiError(400, "Invalid priority");

  const task = await personalTaskService.updatePersonalTask(asString(req.params.id), userId, {
    ...rest,
    status,
    priority,
    start_date: parseOptionalDate(start_date, "start_date"),
    due_date: parseOptionalDate(due_date, "due_date"),
  });

  if (!task) throw new ApiError(404, "Personal task not found");

  res.status(200).json(new ApiResponse(200, task, "Personal task updated successfully"));
});

export const deletePersonalTask = catchAsync(async (req: Request, res: Response) => {
  const userId = (req as any).user?.id as string;
  const deleted = await personalTaskService.deletePersonalTask(asString(req.params.id), userId);
  if (!deleted) throw new ApiError(404, "Personal task not found");

  res.status(200).json(new ApiResponse(200, {}, "Personal task deleted successfully"));
});

export const changePersonalTaskStatus = catchAsync(async (req: Request, res: Response) => {
  const userId = (req as any).user?.id as string;
  const { status } = req.body;
  if (!validateStatus(status)) throw new ApiError(400, "Invalid status");

  const task = await personalTaskService.updatePersonalTask(asString(req.params.id), userId, { status });
  if (!task) throw new ApiError(404, "Personal task not found");

  res.status(200).json(new ApiResponse(200, task, "Personal task status updated successfully"));
});
