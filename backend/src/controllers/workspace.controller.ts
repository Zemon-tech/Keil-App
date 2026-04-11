import { Request, Response } from "express";
import { catchAsync } from "../utils/catchAsync";
import { ApiResponse } from "../utils/ApiResponse";
import { ApiError } from "../utils/ApiError";
import * as workspaceService from "../services/workspace.service";
import jwt from "jsonwebtoken";
import { MemberRole } from "../types/enums";

export const createWorkspace = catchAsync(async (req: Request, res: Response) => {
    const { name } = req.body;
    const userId = (req as any).user?.id;

    if (!name) throw new ApiError(400, "Workspace name is required");
    if (!userId) throw new ApiError(401, "Unauthorized");

    const workspace = await workspaceService.createWorkspace({ name, owner_id: userId });
    
    res.status(201).json(new ApiResponse(201, { workspace }, "Workspace created successfully"));
});

export const getUserWorkspaces = catchAsync(async (req: Request, res: Response) => {
    const userId = (req as any).user?.id;
    if (!userId) throw new ApiError(401, "Unauthorized");

    const workspaces = await workspaceService.getUserWorkspaces(userId);

    // Fetch the user's role for each workspace dynamically
    const formattedWorkspaces = await Promise.all(workspaces.map(async (ws) => {
        const members = await workspaceService.getWorkspaceMembers(ws.id);
        const currentMember = members.find(m => m.user_id === userId);
        return {
            ...ws,
            role: currentMember ? currentMember.role : "member"
        };
    }));

    res.status(200).json(new ApiResponse(200, { workspaces: formattedWorkspaces }, "Workspaces retrieved successfully"));
});

export const getWorkspace = catchAsync(async (req: Request, res: Response) => {
    const workspaceId = req.params.id;
    const workspace = await workspaceService.getWorkspaceById(workspaceId);
    if (!workspace) throw new ApiError(404, "Workspace not found");
    res.status(200).json(new ApiResponse(200, workspace, "Workspace retrieved successfully"));
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
    res.status(200).json(new ApiResponse(200, {}, "Member removed from workspace"));
});

export const createInviteLink = catchAsync(async (req: Request, res: Response) => {
    const workspaceId = req.params.id;
    const userId = (req as any).user?.id;
    
    if (!workspaceId) throw new ApiError(400, "Workspace ID is required");

    // Check if user is an admin or owner of the workspace
    const isMember = await workspaceService.isWorkspaceMember(workspaceId, userId);
    if (!isMember) {
        throw new ApiError(403, "You are not a member of this workspace");
    }

    const members = await workspaceService.getWorkspaceMembers(workspaceId);
    const currentUser = members.find(m => m.user_id === userId);
    if (currentUser?.role === MemberRole.MEMBER) {
        throw new ApiError(403, "Only admins and owners can generate invite links");
    }
    
    const token = jwt.sign({ workspaceId }, process.env.JWT_SECRET || 'fallback_secret', { expiresIn: '7d' });
    const inviteLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/invite/${token}`;

    res.status(200).json(new ApiResponse(200, { inviteLink, token }, "Invite link generated successfully"));
});

export const joinWorkspace = catchAsync(async (req: Request, res: Response) => {
    const { token } = req.body;
    const userId = (req as any).user?.id;

    if (!token) throw new ApiError(400, "Token is required");

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret') as { workspaceId: string };
        
        // Add member
        await workspaceService.addWorkspaceMember(decoded.workspaceId, userId, MemberRole.MEMBER, userId);
        
        res.status(200).json(new ApiResponse(200, { workspaceId: decoded.workspaceId }, "Joined workspace successfully"));
    } catch (e: any) {
        if (e.message.includes('already a member')) {
            throw new ApiError(400, "You are already a member of this workspace");
        }
        throw new ApiError(400, "Invalid or expired invite token");
    }
});
