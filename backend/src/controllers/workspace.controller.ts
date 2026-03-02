import { Request, Response } from "express";
import { catchAsync } from "../utils/catchAsync";
import { ApiResponse } from "../utils/ApiResponse";

export const createWorkspace = catchAsync(async (req: Request, res: Response) => {
    // TODO: Implement
    res.status(201).json(new ApiResponse(201, {}, "Workspace created successfully"));
});

export const getWorkspace = catchAsync(async (req: Request, res: Response) => {
    // TODO: Implement
    res.status(200).json(new ApiResponse(200, {}, "Workspace retrieved successfully"));
});

export const getWorkspaceMembers = catchAsync(async (req: Request, res: Response) => {
    // TODO: Implement
    res.status(200).json(new ApiResponse(200, [], "Workspace members retrieved successfully"));
});

export const addWorkspaceMember = catchAsync(async (req: Request, res: Response) => {
    // TODO: Implement
    res.status(201).json(new ApiResponse(201, {}, "Member added to workspace"));
});

export const updateWorkspaceMemberRole = catchAsync(async (req: Request, res: Response) => {
    // TODO: Implement
    res.status(200).json(new ApiResponse(200, {}, "Member role updated successfully"));
});

export const removeWorkspaceMember = catchAsync(async (req: Request, res: Response) => {
    // TODO: Implement
    res.status(200).json(new ApiResponse(200, {}, "Member removed from workspace"));
});
