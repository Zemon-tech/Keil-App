import { Request, Response } from "express";
import { catchAsync } from "../utils/catchAsync";
import { ApiResponse } from "../utils/ApiResponse";

export const getDashboardInfo = catchAsync(async (req: Request, res: Response) => {
    // TODO: Implement rule-based buckets
    res.status(200).json(new ApiResponse(200, {}, "Dashboard data retrieved successfully"));
});

export const getActivityFeed = catchAsync(async (req: Request, res: Response) => {
    // TODO: Implement paginated feed
    res.status(200).json(new ApiResponse(200, [], "Activity feed retrieved successfully"));
});
