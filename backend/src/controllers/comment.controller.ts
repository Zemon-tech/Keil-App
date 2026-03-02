import { Request, Response } from "express";
import { catchAsync } from "../utils/catchAsync";
import { ApiResponse } from "../utils/ApiResponse";

export const getTaskComments = catchAsync(async (req: Request, res: Response) => {
    // TODO: Implement (paginated)
    res.status(200).json(new ApiResponse(200, [], "Comments retrieved successfully"));
});

export const addComment = catchAsync(async (req: Request, res: Response) => {
    // TODO: Implement (with optional parentCommentId)
    res.status(201).json(new ApiResponse(201, {}, "Comment added successfully"));
});

export const deleteComment = catchAsync(async (req: Request, res: Response) => {
    // TODO: Implement (cascade delete)
    res.status(200).json(new ApiResponse(200, {}, "Comment deleted successfully"));
});
