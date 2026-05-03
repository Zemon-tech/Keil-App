import { Request, Response } from "express";
import { catchAsync } from "../utils/catchAsync";
import { ApiResponse } from "../utils/ApiResponse";
import { ApiError } from "../utils/ApiError";
import * as activityService from "../services/activity.service";
import * as dashboardService from "../services/dashboard.service";
import { LogEntityType } from "../types/enums";
import pool from "../config/pg";

// ── Helper: resolve the user's first workspace (legacy personal mode) ─────────
// Returns null when the user has no workspace — callers return empty data.
const resolveWorkspaceId = async (userId: string): Promise<string | null> => {
  const result = await pool.query(
    "SELECT workspace_id FROM public.workspace_members WHERE user_id = $1 LIMIT 1",
    [userId],
  );
  return result.rows.length > 0 ? (result.rows[0].workspace_id as string) : null;
};

export const getDashboardInfo = catchAsync(
  async (req: Request, res: Response) => {
    const userId = (req as any).user?.id as string;
    const workspaceId = await resolveWorkspaceId(userId);

    // No workspace → return empty dashboard buckets (new user, personal mode)
    if (!workspaceId) {
      return res.status(200).json(
        new ApiResponse(200, { immediate: [], today: [], blocked: [], backlog: [] }, "Dashboard data retrieved successfully"),
      );
    }

    const dashboardData = await dashboardService.getDashboardBuckets(workspaceId);
    res.status(200).json(new ApiResponse(200, dashboardData, "Dashboard data retrieved successfully"));
  },
);

export const getActivityFeed = catchAsync(
  async (req: Request, res: Response) => {
    const userId = (req as any).user?.id as string;
    const workspaceId = await resolveWorkspaceId(userId);

    if (!workspaceId) {
      return res.status(200).json(new ApiResponse(200, [], "Activity feed retrieved successfully"));
    }

    const rawLimit = req.query.limit as string | undefined;
    const rawOffset = req.query.offset as string | undefined;
    const entity_type = req.query.entity_type as string | undefined;
    const entity_id = req.query.entity_id as string | undefined;

    const parsedLimit = rawLimit ? parseInt(rawLimit, 10) : 20;
    const parsedOffset = rawOffset ? parseInt(rawOffset, 10) : 0;
    const limit = isNaN(parsedLimit) ? 20 : Math.min(Math.max(1, parsedLimit), 100);
    const offset = isNaN(parsedOffset) ? 0 : parsedOffset;

    if (offset < 0) throw new ApiError(400, "offset must be a non-negative integer");

    if (entity_type !== undefined) {
      const validEntityTypes = Object.values(LogEntityType);
      if (!validEntityTypes.includes(entity_type as LogEntityType)) {
        throw new ApiError(400, `Invalid entity_type. Must be one of: ${validEntityTypes.join(", ")}`);
      }
    }

    if (entity_id !== undefined) {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(entity_id)) {
        throw new ApiError(400, "Invalid entity_id format. Must be a valid UUID");
      }
    }

    if (entity_id && !entity_type) {
      throw new ApiError(400, "entity_type is required when entity_id is provided");
    }

    let data;
    if (entity_id) {
      if (entity_type === LogEntityType.TASK) {
        data = await activityService.getTaskActivity(workspaceId, entity_id);
      } else {
        data = await activityService.getEntityActivity(workspaceId, entity_type as LogEntityType, entity_id);
      }
    } else {
      data = await activityService.getActivityFeed(workspaceId, limit, offset);
    }

    res.status(200).json(new ApiResponse(200, data, "Activity feed retrieved successfully"));
  },
);
