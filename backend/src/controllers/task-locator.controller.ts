import { Request, Response } from "express";
import { catchAsync } from "../utils/catchAsync";
import { ApiError } from "../utils/ApiError";
import { ApiResponse } from "../utils/ApiResponse";
import { orgTaskRepository, organisationRepository } from "../repositories";

/**
 * GET /api/v1/tasks/:taskId/locate
 *
 * Looks up which org + space a task belongs to.
 * Only returns a result if the authenticated user is a fully-accepted member
 * of the organisation that owns the task.
 *
 * Used by the frontend to silently switch workspace context when a user opens
 * a shared task link from a different workspace.
 */
export const locateTask = catchAsync(async (req: Request, res: Response) => {
  const taskId = req.params.taskId as string;
  const userId = (req as any).user?.id as string;

  if (!taskId) {
    throw new ApiError(400, "taskId is required");
  }

  // Fetch the raw task row (not scoped to any org/space — global lookup by PK)
  const task = await orgTaskRepository.findById(taskId);

  if (!task || !task.org_id || !task.space_id) {
    throw new ApiError(404, "Task not found");
  }

  // Security gate: only expose the workspace info if the requesting user is
  // a member of that organisation (pending/invited users are excluded because
  // getMemberRole only returns rows from accepted organisation_members).
  const memberRole = await organisationRepository.getMemberRole(task.org_id, userId);

  if (!memberRole) {
    // User is not a member of the org that owns this task — treat as not found
    // to avoid leaking workspace information.
    throw new ApiError(404, "Task not found");
  }

  res.status(200).json(
    new ApiResponse(200, { orgId: task.org_id, spaceId: task.space_id }, "Task located")
  );
});
