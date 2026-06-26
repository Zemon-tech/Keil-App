import { Request, Response } from "express";
import { catchAsync } from "../utils/catchAsync";
import { ApiError } from "../utils/ApiError";
import { ApiResponse } from "../utils/ApiResponse";
import * as orgTaskService from "../services/org-task.service";
import { doIncrementalSyncWithCooldown } from "../services/google-calendar.service";
import { createComment, getThreadedComments, hardDeleteComment } from "../services/comment.service";
import { getTaskSummary as getTaskSummaryFromService, generateTaskSummary, isGenerationInFlight } from "../services/ai-summary.service";
import { TaskPriority, TaskStatus } from "../types/enums";
import { TaskQueryOptions } from "../types/repository";
import { taskAssigneeRepository, orgTaskRepository } from "../repositories";

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

const isUuid = (value: unknown): value is string =>
  typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

const asString = (value: string | string[] | undefined): string =>
  Array.isArray(value) ? value[0] : (value ?? "");

const getTaskContext = (req: Request): orgTaskService.OrgTaskContext => {
  return {
    orgId: asString(req.params.orgId),
    spaceId: asString(req.params.spaceId),
  };
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
  const {
    title, status, priority, start_date, due_date, parent_task_id,
    description, objective, success_criteria,
    type, event_type, location, is_all_day, assignee_ids,
    story_points, time_estimate, meet_link,
    create_meet_link, guests, context: taskContext,
  } = req.body;

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
    type: type === "event" ? "event" : "task",
    event_type: event_type ?? null,
    location: location ?? null,
    is_all_day: typeof is_all_day === "boolean" ? is_all_day : true,
    assignee_ids: Array.isArray(assignee_ids) ? assignee_ids : undefined,
    story_points: story_points ?? null,
    time_estimate: time_estimate ?? null,
    meet_link: meet_link ?? null,
    create_meet_link,
    guests: Array.isArray(guests) ? guests : undefined,
    context: Array.isArray(taskContext) ? taskContext : undefined,
  });

  res.status(201).json(new ApiResponse(201, task, "Task created successfully"));
});

export const getTasks = catchAsync(async (req: Request, res: Response) => {
  const { status, priority, assignee_id, due_date_start, due_date_end, sort_by, sort_order, limit, offset, parent_task_id, mirror, org_filter, space_filter } =
    req.query;

  const options: TaskQueryOptions = {
    pagination: {
      limit: limit ? parseInt(limit as string, 10) : 20,
      offset: offset ? parseInt(offset as string, 10) : 0,
    },
    filters: {},
  };

  // Always populate userId filter so user_space_role is returned for every task query
  const reqUserId = (req as any).user?.id;
  if (reqUserId && isUuid(reqUserId)) {
    options.filters!.userId = reqUserId;
    
    // Background fire-and-forget polling sync for Google Calendar.
    // Extremely useful on localhost since watch webhooks cannot be delivered to localhost.
    doIncrementalSyncWithCooldown(reqUserId).catch(() => {});
  }

  const isPrivateSpace = (req as any).space?.is_private === true;
  if (mirror === "true" && isPrivateSpace) {
    options.filters!.mirror = true;
    if (org_filter && isUuid(org_filter)) options.filters!.orgFilter = org_filter as string;
    if (space_filter && isUuid(space_filter)) options.filters!.spaceFilter = space_filter as string;
  }

  if (status) {
    if (!validateStatus(status)) throw new ApiError(400, "Invalid status");
    options.filters!.status = status;
  }
  if (priority) {
    if (!validatePriority(priority)) throw new ApiError(400, "Invalid priority");
    options.filters!.priority = priority;
  }
  if (assignee_id) {
    const assigneeStr = assignee_id as string;
    if (assigneeStr !== "all" && assigneeStr !== "" && assigneeStr !== "undefined" && assigneeStr !== "null") {
      if (!isUuid(assigneeStr)) throw new ApiError(400, "Invalid assignee_id format");
      options.filters!.assigneeId = assigneeStr;
    }
  }
  if (due_date_start) options.filters!.dueDateStart = parseOptionalDate(due_date_start, "due_date_start") as Date;
  if (due_date_end) options.filters!.dueDateEnd = parseOptionalDate(due_date_end, "due_date_end") as Date;
  
  if (parent_task_id !== undefined && parent_task_id !== "undefined" && parent_task_id !== "null" && parent_task_id !== "") {
    if (!isUuid(parent_task_id as string)) throw new ApiError(400, "Invalid parentTaskId format");
    options.filters!.parentTaskId = parent_task_id as string;
  } else if (parent_task_id === "null") {
    options.filters!.parentTaskId = null;
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
  const allowedFields = [
    "title", "description", "objective", "success_criteria",
    "status", "priority", "type", "event_type", "location", "is_all_day", "meet_link",
    "create_meet_link", "guests", "context",
  ];
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

  const spaceRole = (req as any).space?.membership_role as string;
  const updated = await orgTaskService.changeTaskStatus(context, asString(req.params.id), userId, status, spaceRole as any);
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
      org_id: context.orgId,
      space_id: context.spaceId,
    },
  );

  res.status(201).json(new ApiResponse(201, comment, "Comment added successfully"));
});

export const deleteTaskComment = catchAsync(async (req: Request, res: Response) => {
  const context = getTaskContext(req);
  const userId = (req as any).user?.id as string;

  // Verify the task belongs to this org/space before allowing comment deletion
  await assertTaskInSpace(req, asString(req.params.id));

  const spaceRole = (req as any).space?.membership_role as string;
  await hardDeleteComment(asString(req.params.commentId), userId, {
    org_id: context.orgId,
    space_id: context.spaceId,
  }, spaceRole);

  res.status(200).json(new ApiResponse(200, {}, "Comment deleted successfully"));
});

export const createSubtask = catchAsync(async (req: Request, res: Response) => {
  const context = getTaskContext(req);
  const userId = (req as any).user?.id as string;
  const parent_task_id = asString(req.params.id);
  const {
    title, status, priority, start_date, due_date,
    description, objective, success_criteria,
    type, event_type, location, is_all_day, assignee_ids,
    story_points, time_estimate, meet_link,
    create_meet_link, guests, context: taskContext,
  } = req.body;

  if (!title || typeof title !== "string" || title.trim() === "") {
    throw new ApiError(400, "Title is required");
  }

  // Ensure parent task is a top-level task (cannot have subtask of subtask)
  const parentTask = await orgTaskRepository.findById(parent_task_id);
  if (!parentTask) {
    throw new ApiError(404, "Parent task not found");
  }
  if (parentTask.parent_task_id) {
    throw new ApiError(400, "Subtasks cannot have their own subtasks");
  }

  const task = await orgTaskService.createTask(context, {
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
    type: type === "event" ? "event" : "task",
    event_type: event_type ?? null,
    location: location ?? null,
    is_all_day: typeof is_all_day === "boolean" ? is_all_day : true,
    assignee_ids: Array.isArray(assignee_ids) ? assignee_ids : undefined,
    story_points: story_points ?? null,
    time_estimate: time_estimate ?? null,
    meet_link: meet_link ?? null,
    create_meet_link,
    guests: Array.isArray(guests) ? guests : undefined,
    context: Array.isArray(taskContext) ? taskContext : undefined,
  });

  res.status(201).json(new ApiResponse(201, task, "Subtask created successfully"));
});

export const getSlots = catchAsync(async (req: Request, res: Response) => {
  const context = getTaskContext(req);
  const userId = (req as any).user?.id as string;
  const spaceRole = (req as any).space?.membership_role as string;

  const slots = await orgTaskService.getSlotsBySpace(context.spaceId, userId, spaceRole);
  res.status(200).json(new ApiResponse(200, slots, "Calendar slots retrieved successfully"));
});

export const createSlot = catchAsync(async (req: Request, res: Response) => {
  const context = getTaskContext(req);
  const userId = (req as any).user?.id as string;
  const spaceRole = (req as any).space?.membership_role as string;
  const { task_id, start_date, due_date, is_all_day, checklist_id, notes } = req.body;

  if (!task_id || !isUuid(task_id)) {
    throw new ApiError(400, "Valid task_id is required");
  }
  if (!start_date || !due_date) {
    throw new ApiError(400, "start_date and due_date are required");
  }

  // Ensure task is in this space
  const task = await orgTaskRepository.findById(task_id);
  if (!task || task.org_id !== context.orgId || task.space_id !== context.spaceId) {
    throw new ApiError(404, "Task not found in this space");
  }

  // Members can only schedule tasks assigned to them (or created by them)
  if (spaceRole === "member") {
    const isAssigned = await taskAssigneeRepository.isAssigned(task_id, userId);
    if (!isAssigned && task.created_by !== userId) {
      throw new ApiError(403, "Members can only schedule tasks assigned to them");
    }
  }

  const slot = await orgTaskService.createSlot(task_id, userId, {
    start_date: new Date(start_date),
    due_date: new Date(due_date),
    is_all_day,
    checklist_id,
    notes,
  });

  res.status(201).json(new ApiResponse(201, slot, "Calendar slot created successfully"));
});

export const updateSlot = catchAsync(async (req: Request, res: Response) => {
  const userId = (req as any).user?.id as string;
  const spaceRole = (req as any).space?.membership_role as string;
  const slotId = asString(req.params.slotId);
  const { start_date, due_date, is_all_day, notes, status } = req.body;

  if (!slotId || !isUuid(slotId)) {
    throw new ApiError(400, "Valid slotId is required");
  }

  const slot = await orgTaskService.updateSlot(slotId, userId, spaceRole, {
    start_date: start_date ? new Date(start_date) : undefined,
    due_date: due_date ? new Date(due_date) : undefined,
    is_all_day,
    notes,
    status,
  });

  if (!slot) {
    throw new ApiError(404, "Calendar slot not found or not authorized to update");
  }

  res.status(200).json(new ApiResponse(200, slot, "Calendar slot updated successfully"));
});

export const deleteSlot = catchAsync(async (req: Request, res: Response) => {
  const userId = (req as any).user?.id as string;
  const spaceRole = (req as any).space?.membership_role as string;
  const slotId = asString(req.params.slotId);

  if (!slotId || !isUuid(slotId)) {
    throw new ApiError(400, "Valid slotId is required");
  }

  const deleted = await orgTaskService.deleteSlot(slotId, userId, spaceRole);
  if (!deleted) {
    throw new ApiError(404, "Calendar slot not found or not authorized to delete");
  }

  res.status(200).json(new ApiResponse(200, {}, "Calendar slot deleted successfully"));
});

export const getChecklists = catchAsync(async (req: Request, res: Response) => {
  const userId = (req as any).user?.id as string;
  const taskId = asString(req.params.id);

  if (!taskId || !isUuid(taskId)) {
    throw new ApiError(400, "Valid taskId is required");
  }

  await assertTaskInSpace(req, taskId);

  const checklists = await orgTaskService.getChecklistsByTask(taskId, userId);
  res.status(200).json(new ApiResponse(200, checklists, "Checklists retrieved successfully"));
});

export const createChecklist = catchAsync(async (req: Request, res: Response) => {
  const userId = (req as any).user?.id as string;
  const taskId = asString(req.params.id);
  const { title } = req.body;

  if (!taskId || !isUuid(taskId)) {
    throw new ApiError(400, "Valid taskId is required");
  }
  if (!title || typeof title !== "string" || title.trim() === "") {
    throw new ApiError(400, "Checklist title is required");
  }

  await assertTaskInSpace(req, taskId);

  const checklist = await orgTaskService.createChecklist(taskId, userId, title.trim());
  res.status(201).json(new ApiResponse(201, checklist, "Checklist item created successfully"));
});

export const updateChecklist = catchAsync(async (req: Request, res: Response) => {
  const userId = (req as any).user?.id as string;
  const taskId = asString(req.params.id);
  const checklistId = asString(req.params.checklistId);
  const { title, is_completed } = req.body;

  if (!checklistId || !isUuid(checklistId)) {
    throw new ApiError(400, "Valid checklistId is required");
  }

  await assertTaskInSpace(req, taskId);

  const checklist = await orgTaskService.updateChecklist(checklistId, userId, {
    title: title ? title.trim() : undefined,
    is_completed,
  });

  if (!checklist) {
    throw new ApiError(404, "Checklist item not found or not authorized to update");
  }

  res.status(200).json(new ApiResponse(200, checklist, "Checklist item updated successfully"));
});

export const deleteChecklist = catchAsync(async (req: Request, res: Response) => {
  const userId = (req as any).user?.id as string;
  const taskId = asString(req.params.id);
  const checklistId = asString(req.params.checklistId);

  if (!checklistId || !isUuid(checklistId)) {
    throw new ApiError(400, "Valid checklistId is required");
  }

  await assertTaskInSpace(req, taskId);

  const deleted = await orgTaskService.deleteChecklist(checklistId, userId);
  if (!deleted) {
    throw new ApiError(404, "Checklist item not found or not authorized to delete");
  }

  res.status(200).json(new ApiResponse(200, {}, "Checklist item deleted successfully"));
});


// ─── AI Summary Endpoints ─────────────────────────────────────────────────────

export const getTaskAiSummary = catchAsync(async (req: Request, res: Response) => {
  await assertTaskInSpace(req, asString(req.params.id));

  const summary = await getTaskSummaryFromService(asString(req.params.id));

  if (!summary) {
    res.status(204).send();
    return;
  }

  res.status(200).json(new ApiResponse(200, summary, "Summary retrieved successfully"));
});

export const regenerateTaskAiSummary = catchAsync(async (req: Request, res: Response) => {
  await assertTaskInSpace(req, asString(req.params.id));

  const taskId = asString(req.params.id);

  // Check if already generating
  if (isGenerationInFlight(taskId)) {
    res.status(409).json({
      success: false,
      code: "SUMMARY_IN_PROGRESS",
      message: "Summary is already being generated for this task.",
    });
    return;
  }

  // Fire generation asynchronously and return 202 immediately
  // The result will be pushed via socket
  generateTaskSummary(taskId).then((result) => {
    if (result.status === "rate_limited") {
      // Can't notify via HTTP anymore (already sent 202), but the socket won't fire either
      // The client should check via GET if unsure
    }
  }).catch(() => {
    // Errors logged inside the service
  });

  // Check rate limit synchronously to give immediate feedback if possible
  // (This is a lightweight pre-check — the actual enforcement is in the service)
  res.status(202).json(new ApiResponse(202, { taskId }, "Summary regeneration started"));
});
