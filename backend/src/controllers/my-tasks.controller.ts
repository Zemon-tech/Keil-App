import { Request, Response } from "express";
import { catchAsync } from "../utils/catchAsync";
import { ApiResponse } from "../utils/ApiResponse";
import * as myTasksService from "../services/my-tasks.service";
import { TaskStatus, TaskPriority } from "../types/enums";

const asString = (value: any): string | undefined => {
  if (!value) return undefined;
  return Array.isArray(value) ? (value[0] as string) : (value as string);
};

export const getMyTasks = catchAsync(async (req: Request, res: Response) => {
  const userId = (req as any).user?.id as string;
  const statusParam = asString(req.query.status);
  const priorityParam = asString(req.query.priority);
  const orgIdParam = asString(req.query.org_id);

  const filters: myTasksService.MyTasksFilters = {
    status: statusParam ? (statusParam as TaskStatus) : undefined,
    priority: priorityParam ? (priorityParam as TaskPriority) : undefined,
    org_id: orgIdParam ? orgIdParam : undefined,
  };

  const tasks = await myTasksService.getMyTasks(userId, filters);

  res
    .status(200)
    .json(new ApiResponse(200, { tasks }, "Tasks retrieved successfully"));
});
