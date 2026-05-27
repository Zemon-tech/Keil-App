import { Request, Response } from "express";
import { catchAsync } from "../utils/catchAsync";
import { ApiResponse } from "../utils/ApiResponse";

/**
 * Legacy dashboard endpoint — kept for backward compatibility.
 * The frontend now uses the org-scoped dashboard (GET /v1/orgs/:orgId/spaces/:spaceId/dashboard).
 * This endpoint always returns empty buckets.
 */
export const getDashboardInfo = catchAsync(
  async (req: Request, res: Response) => {
    return res.status(200).json(
      new ApiResponse(200, { immediate: [], today: [], blocked: [], backlog: [] }, "Dashboard data retrieved successfully"),
    );
  },
);

/**
 * Legacy activity feed endpoint — kept for backward compatibility.
 * The frontend now uses the org-scoped activity (GET /v1/orgs/:orgId/spaces/:spaceId/activity).
 * This endpoint always returns an empty array.
 */
export const getActivityFeed = catchAsync(
  async (req: Request, res: Response) => {
    return res.status(200).json(new ApiResponse(200, [], "Activity feed retrieved successfully"));
  },
);
