import { Request, Response } from "express";
import { catchAsync } from "../utils/catchAsync";
import { ApiResponse } from "../utils/ApiResponse";
import { ApiError } from "../utils/ApiError";
import * as workspaceService from "../services/workspace.service";

export const createWorkspace = catchAsync(async (req: Request, res: Response) => {
    // TODO: Implement
    res.status(201).json(new ApiResponse(201, {}, "Workspace created successfully"));
});

export const getWorkspace = catchAsync(async (req: Request, res: Response) => {
    // TODO: Implement
    res.status(200).json(new ApiResponse(200, {}, "Workspace retrieved successfully"));
});

export const getWorkspaceMembers = catchAsync(async (req: Request, res: Response) => {
    const workspaceId = req.params.id as string;
    const reqUserId = (req as any).user?.id as string;

    if (!workspaceId) throw new ApiError(400, "Workspace ID is required");
    if (!reqUserId) throw new ApiError(401, "Unauthorized");

    // Check if user is a member of the workspace
    const isMember = await workspaceService.isWorkspaceMember(workspaceId, reqUserId);
    if (!isMember) {
        throw new ApiError(403, "You are not a member of this workspace");
    }

    const members = await workspaceService.getWorkspaceMembers(workspaceId);
    res.status(200).json(new ApiResponse(200, members, "Workspace members retrieved successfully"));
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
