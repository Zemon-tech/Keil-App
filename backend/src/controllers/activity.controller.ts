import { Request, Response } from "express";
import { catchAsync } from "../utils/catchAsync";
import { ApiResponse } from "../utils/ApiResponse";
import { ApiError } from "../utils/ApiError";
import * as activityService from "../services/activity.service";
import * as dashboardService from "../services/dashboard.service";
import { LogEntityType } from "../types/enums";

export const getDashboardInfo = catchAsync(async (req: Request, res: Response) => {
    // TASK 1: Extract workspaceId from middleware
    const workspaceId = (req as any).workspaceId as string;
    if (!workspaceId) {
        throw new ApiError(404, "No workspace found for this user");
    }

    // TASK 2: Call dashboard service to get all 4 buckets
    const dashboardData = await dashboardService.getDashboardBuckets(workspaceId);

    // TASK 3: Return response with dashboard data
    res.status(200).json(new ApiResponse(200, dashboardData, "Dashboard data retrieved successfully"));
});

export const getActivityFeed = catchAsync(async (req: Request, res: Response) => {
    // TASK 1: Extract workspaceId from middleware
    const workspaceId = (req as any).workspaceId as string;
    if (!workspaceId) throw new ApiError(403, "Workspace not found for user");

    // TASK 2: Parse query params
    const rawLimit    = req.query.limit as string | undefined;
    const rawOffset   = req.query.offset as string | undefined;
    const entity_type = req.query.entity_type as string | undefined;
    const entity_id   = req.query.entity_id as string | undefined;

    const parsedLimit  = rawLimit  ? parseInt(rawLimit, 10)  : 20;
    const parsedOffset = rawOffset ? parseInt(rawOffset, 10) : 0;

    // TASK 3: Validate and clamp limit
    const limit = isNaN(parsedLimit) ? 20 : Math.min(Math.max(1, parsedLimit), 100);

    // TASK 4: Validate offset
    const offset = isNaN(parsedOffset) ? 0 : parsedOffset;
    if (offset < 0) {
        throw new ApiError(400, "offset must be a non-negative integer");
    }

    // TASK 5: Validate entity_type if provided
    if (entity_type !== undefined) {
        const validEntityTypes = Object.values(LogEntityType);
        if (!validEntityTypes.includes(entity_type as LogEntityType)) {
            throw new ApiError(400, `Invalid entity_type. Must be one of: ${validEntityTypes.join(", ")}`);
        }
    }

    // TASK 6: Validate entity_id if provided
    if (entity_id !== undefined) {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(entity_id)) {
            throw new ApiError(400, "Invalid entity_id format. Must be a valid UUID");
        }
    }

    // TASK 7: Call the correct service function
    let data;
    if (entity_id) {
        // Specific entity history — entity_type is required when entity_id is given
        data = await activityService.getEntityActivity(
            entity_type as LogEntityType,
            entity_id
        );
    } else {
        // General workspace activity feed with pagination
        data = await activityService.getActivityFeed(workspaceId, limit, offset);
    }

    // TASK 8: Return response
    res.status(200).json(new ApiResponse(200, data, "Activity feed retrieved successfully"));
});
