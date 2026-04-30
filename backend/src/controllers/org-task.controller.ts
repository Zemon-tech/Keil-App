import { Request, Response } from "express";
import { catchAsync } from "../utils/catchAsync";
import { ApiError } from "../utils/ApiError";
import { ApiResponse } from "../utils/ApiResponse";
import * as orgTaskService from "../services/org-task.service";
import { createComment, getThreadedComments } from "../services/comment.service";
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

const getTaskContext = (req: Request): orgTaskService.OrgTaskContext => {
  const orgId = asString(req.params.orgId);
  const spaceId = asString(req.params.spaceId);
  const workspaceId = (req as any).space?.compatibility_workspace_id as string | undefined;

  if (!workspaceId) {
    throw new ApiError(500, "Compatibility workspace is missing for this space");
  }

  return { orgId, spaceId, workspaceId };
};

const assertTaskInSpace = async (req: Request, taskId: string) => {
  const task = await orgTaskService.getTaskById(taskId);
  if (!task || task.org_id !== asString(req.params.orgId) || task.space_id !== asString(req.params.spaceId)) {
    throw new ApiError(404, "Task not found");
  }
  return task;
};

export const createTask = catchAsync(async (req: Request, res: Response) => {
  const context = getTaskContext(req);
  const userId = (req as any).user?.id as string;
  const { title, status, priority, start_date, due_date, parent_task_id, description, objective, success_criteria } =
    req.body;

  if (!title || typeof title !== "string" || title.trim() === "") {
    throw new ApiError(400, "Title is required");
  }
  if (status && !validateStatus(status)) throw new ApiError(400, "Invalid status");
  if (priority && !validatePriority(priority)) throw new ApiError(400, "Invalid priority");

  if (parent_task_id) {
    const parentTask = await orgTaskService.getTaskById(parent_task_id);
    if (!parentTask || parentTask.org_id !== context.orgId || parentTask.space_id !== context.spaceId) {
      throw new ApiError(400, "Parent task not found or belongs to a different space");
    }
    if (parentTask.parent_task_id) {
      throw new ApiError(400, "Subtasks cannot have their own subtasks");
    }
  }

  const task = await orgTaskService.createTask(context, {
    workspace_id: context.workspaceId,
    org_id: context.orgId,
    space_id: context.spaceId,
    created_by: userId,
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

  res.status(201).json(new ApiResponse(201, task, "Task created successfully"));
});

export const getTasks = catchAsync(async (req: Request, res: Response) => {
  const { status, priority, assignee_id, due_date_start, due_date_end, sort_by, sort_order, limit, offset, parent_task_id } =
    req.query;

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
  if (assignee_id) options.filters!.assigneeId = assignee_id as string;
  if (due_date_start) options.filters!.dueDateStart = parseOptionalDate(due_date_start, "due_date_start") as Date;
  if (due_date_end) options.filters!.dueDateEnd = parseOptionalDate(due_date_end, "due_date_end") as Date;
  if (parent_task_id !== undefined) {
    options.filters!.parentTaskId = parent_task_id === "null" ? null : (parent_task_id as string);
  }
  if (sort_by) {
    const field = sort_by === "due_date" ? "due_date" : sort_by === "priority" ? "priority" : "created_at";
    const order = sort_order === "asc" || sort_order === "ASC" ? "ASC" : "DESC";
    options.sort = { field, order };
  }

  const tasks = await orgTaskService.getTasksBySpace(asString(req.params.orgId), asString(req.params.spaceId), options);
  res.status(200).json(new ApiResponse(200, tasks, "Tasks retrieved successfully"));
});

export const getTaskById = catchAsync(async (req: Request, res: Response) => {
  const task = await assertTaskInSpace(req, asString(req.params.id));
  res.status(200).json(new ApiResponse(200, task, "Task retrieved successfully"));
});

export const updateTask = catchAsync(async (req: Request, res: Response) => {
  const context = getTaskContext(req);
  const userId = (req as any).user?.id as string;
  await assertTaskInSpace(req, asString(req.params.id));

  const updates: any = {};
  const allowedFields = ["title", "description", "objective", "success_criteria", "status", "priority"];
  allowedFields.forEach((field) => {
    if (req.body[field] !== undefined) {
      updates[field] = field === "title" ? req.body[field]?.trim() : req.body[field];
    }
  });
  if (updates.status && !validateStatus(updates.status)) throw new ApiError(400, "Invalid status");
  if (updates.priority && !validatePriority(updates.priority)) throw new ApiError(400, "Invalid priority");
  if (req.body.start_date !== undefined) updates.start_date = parseOptionalDate(req.body.start_date, "start_date");
  if (req.body.due_date !== undefined) updates.due_date = parseOptionalDate(req.body.due_date, "due_date");

  const updated = await orgTaskService.updateTask(context, asString(req.params.id), userId, updates);
  if (!updated) throw new ApiError(404, "Task not found");

  res.status(200).json(new ApiResponse(200, updated, "Task updated successfully"));
});

export const changeTaskStatus = catchAsync(async (req: Request, res: Response) => {
  const context = getTaskContext(req);
  const userId = (req as any).user?.id as string;
  const { status } = req.body;
  if (!validateStatus(status)) throw new ApiError(400, "Invalid status");
  await assertTaskInSpace(req, asString(req.params.id));

  const updated = await orgTaskService.changeTaskStatus(context, asString(req.params.id), userId, status);
  if (!updated) throw new ApiError(404, "Task not found");

  res.status(200).json(new ApiResponse(200, updated, "Task status updated successfully"));
});

export const deleteTask = catchAsync(async (req: Request, res: Response) => {
  const context = getTaskContext(req);
  const userId = (req as any).user?.id as string;
  await assertTaskInSpace(req, asString(req.params.id));
  await orgTaskService.deleteTask(context, asString(req.params.id), userId);

  res.status(200).json(new ApiResponse(200, {}, "Task deleted successfully"));
});

export const assignUserToTask = catchAsync(async (req: Request, res: Response) => {
  const context = getTaskContext(req);
  const userId = (req as any).user?.id as string;
  const assigneeUserId = req.body.user_id as string;
  if (!assigneeUserId) throw new ApiError(400, "user_id is required");
  await assertTaskInSpace(req, asString(req.params.id));

  await orgTaskService.assignUser(context, asString(req.params.id), assigneeUserId, userId);
  res.status(201).json(new ApiResponse(201, null, "User assigned to task"));
});

export const removeUserFromTask = catchAsync(async (req: Request, res: Response) => {
  const context = getTaskContext(req);
  const userId = (req as any).user?.id as string;
  await assertTaskInSpace(req, asString(req.params.id));
  await orgTaskService.unassignUser(context, asString(req.params.id), asString(req.params.userId), userId);

  res.status(200).json(new ApiResponse(200, null, "User removed from task"));
});

export const addDependency = catchAsync(async (req: Request, res: Response) => {
  const context = getTaskContext(req);
  const userId = (req as any).user?.id as string;
  const dependsOnTaskId = req.body.depends_on_task_id as string;
  if (!dependsOnTaskId) throw new ApiError(400, "depends_on_task_id is required");
  if (dependsOnTaskId === asString(req.params.id)) throw new ApiError(400, "A task cannot depend on itself");

  await assertTaskInSpace(req, asString(req.params.id));
  await assertTaskInSpace(req, dependsOnTaskId);
  await orgTaskService.addDependency(context, asString(req.params.id), dependsOnTaskId, userId);

  res.status(201).json(new ApiResponse(201, null, "Dependency added"));
});

export const removeDependency = catchAsync(async (req: Request, res: Response) => {
  const context = getTaskContext(req);
  const userId = (req as any).user?.id as string;
  await assertTaskInSpace(req, asString(req.params.id));
  await orgTaskService.removeDependency(context, asString(req.params.id), asString(req.params.blockedByTaskId), userId);

  res.status(200).json(new ApiResponse(200, null, "Dependency removed"));
});

export const getSubtasks = catchAsync(async (req: Request, res: Response) => {
  await assertTaskInSpace(req, asString(req.params.id));
  const subtasks = await orgTaskService.getSubtasks(asString(req.params.id));
  const visibleSubtasks = subtasks.filter(
    (task) => task.org_id === asString(req.params.orgId) && task.space_id === asString(req.params.spaceId),
  );

  res.status(200).json(new ApiResponse(200, visibleSubtasks, "Subtasks retrieved successfully"));
});

export const getTaskComments = catchAsync(async (req: Request, res: Response) => {
  await assertTaskInSpace(req, asString(req.params.id));
  const comments = await getThreadedComments(asString(req.params.id));
  res.status(200).json(new ApiResponse(200, comments, "Comments retrieved successfully"));
});

export const addTaskComment = catchAsync(async (req: Request, res: Response) => {
  const context = getTaskContext(req);
  const userId = (req as any).user?.id as string;
  const { content, parent_comment_id } = req.body;
  if (!content || typeof content !== "string" || content.trim() === "") {
    throw new ApiError(400, "Content is required and cannot be empty");
  }

  await assertTaskInSpace(req, asString(req.params.id));
  const comment = await createComment(
    {
      task_id: asString(req.params.id),
      user_id: userId,
      content: content.trim(),
      parent_comment_id: parent_comment_id || undefined,
    },
    {
      workspace_id: context.workspaceId,
      org_id: context.orgId,
      space_id: context.spaceId,
    },
  );

  res.status(201).json(new ApiResponse(201, comment, "Comment added successfully"));
});
