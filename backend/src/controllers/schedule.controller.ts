import { Request, Response } from 'express';
import { catchAsync } from '../utils/catchAsync';
import { ApiResponse } from '../utils/ApiResponse';
import { ApiError } from '../utils/ApiError';
import * as scheduleService from '../services/schedule.service';

/**
 * GET /calendar
 */
export const getCalendarTasks = catchAsync(async (req: Request, res: Response) => {
  const { start_range, end_range, user_id } = req.query;
  const workspaceId = (req as any).workspaceId as string;
  const userId = (req as any).user?.id as string;

  if (!start_range || !end_range) {
    throw new ApiError(400, 'start_range and end_range are required parameters');
  }

  const startRangeStr = start_range as string;
  const endRangeStr = end_range as string;
  
  if (isNaN(new Date(startRangeStr).getTime()) || isNaN(new Date(endRangeStr).getTime())) {
    throw new ApiError(400, 'Valid parseable dates are required for start_range and end_range');
  }

  const targetUserId = user_id ? (user_id as string) : undefined;

  const data = await scheduleService.getCalendarTasks(
    userId,
    workspaceId,
    startRangeStr,
    endRangeStr,
    targetUserId
  );

  res.status(200).json(new ApiResponse(200, data, 'Calendar tasks retrieved successfully'));
});

/**
 * GET /unscheduled
 */
export const getUnscheduledTasks = catchAsync(async (req: Request, res: Response) => {
  const workspaceId = (req as any).workspaceId as string;
  const userId = (req as any).user?.id as string;

  let limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
  if (isNaN(limit) || limit < 1) limit = 50;
  if (limit > 100) limit = 100;

  let offset = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;
  if (isNaN(offset) || offset < 0) offset = 0;

  const search = req.query.search ? (req.query.search as string) : undefined;

  const data = await scheduleService.getUnscheduledTasks(
    userId,
    workspaceId,
    limit,
    offset,
    search
  );

  res.status(200).json(new ApiResponse(200, data, 'Unscheduled tasks retrieved successfully'));
});

/**
 * PUT /tasks/:taskId/timeblock
 */
export const updateTaskTimeblock = catchAsync(async (req: Request, res: Response) => {
  const taskId = req.params.taskId as string;
  const { scheduled_start, scheduled_end } = req.body;
  const workspaceId = (req as any).workspaceId as string;
  const userId = (req as any).user?.id as string;

  const data = await scheduleService.updateTaskTimeblock(
    taskId,
    userId,
    workspaceId,
    scheduled_start,
    scheduled_end
  );

  res.status(200).json(new ApiResponse(200, data, 'Task timeblock updated successfully'));
});

/**
 * DELETE /tasks/:taskId/timeblock
 */
export const deleteTaskTimeblock = catchAsync(async (req: Request, res: Response) => {
  const taskId = req.params.taskId as string;
  const workspaceId = (req as any).workspaceId as string;
  const userId = (req as any).user?.id as string;

  await scheduleService.deleteTaskTimeblock(taskId, userId, workspaceId);

  res.status(200).json(new ApiResponse(200, null, 'Task timeblock removed successfully'));
});

/**
 * GET /gantt
 */
export const getGanttTasks = catchAsync(async (req: Request, res: Response) => {
  const { scope, project_id } = req.query;
  const workspaceId = (req as any).workspaceId as string;
  const userId = (req as any).user?.id as string;

  if (scope !== 'workspace' && scope !== 'user') {
    throw new ApiError(400, "Scope must be either 'workspace' or 'user'");
  }

  const projectId = project_id ? (project_id as string) : undefined;

  const data = await scheduleService.getGanttTasks(workspaceId, scope, userId, projectId);

  res.status(200).json(new ApiResponse(200, data, 'Gantt tasks retrieved successfully'));
});

/**
 * PATCH /tasks/:id/deadline
 */
export const updateTaskDeadline = catchAsync(async (req: Request, res: Response) => {
  const id = req.params.id as string; // It's passed as :id per spec
  const { start_date, due_date } = req.body;
  const workspaceId = (req as any).workspaceId as string;
  const userId = (req as any).user?.id as string;

  if (!start_date || !due_date) {
    throw new ApiError(400, 'start_date and due_date are required');
  }

  const data = await scheduleService.updateTaskDeadline(
    id,
    userId,
    workspaceId,
    start_date,
    due_date
  );

  res.status(200).json(new ApiResponse(200, data, 'Task deadline timeline synced successfully'));
});
