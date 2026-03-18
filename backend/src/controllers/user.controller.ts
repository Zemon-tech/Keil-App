import { Response, NextFunction } from "express";
import * as workspaceService from "../services/workspace.service";
import { ApiResponse } from "../utils/ApiResponse";
import { ApiError } from "../utils/ApiError";

/**
 * @desc    Get current authenticated user profile and their workspace
 * @route   GET /api/users/me
 * @access  Private
 */
export const getMe = async (req: any, res: Response, next: NextFunction) => {
    try {
        const user = req.user;
        
        // 1. Validate user existence
        if (!user || !user.id) {
            throw new ApiError(401, "Unauthorized access");
        }

        // 2. Find user's workspace
        let workspace = await workspaceService.getUserWorkspace(user.id);

        // 3. If no workspace found, auto-create one
        if (!workspace) {
            const workspaceName = user.name ? `${user.name}'s Workspace` : "My Workspace";
            workspace = await workspaceService.createWorkspace({
                name: workspaceName,
                owner_id: user.id
            });
        }

        // 4. Fetch the user's role in the workspace
        const members = await workspaceService.getWorkspaceMembers(workspace.id);
        const currentMember = members.find(m => m.user_id === user.id);
        const userRole = currentMember ? currentMember.role : "owner"; // Default fallback to owner if new

        // 5. Structure exactly matching the API Contract from Phase-0
        return res.status(200).json(
            new ApiResponse(
                200, 
                {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    created_at: user.created_at,
                    workspace: {
                        id: workspace.id,
                        name: workspace.name,
                        role: userRole
                    }
                }, 
                "User profile retrieved successfully"
            )
        );
    } catch (error) {
        // Any error in creation passes down properly
        next(error);
    }
};
