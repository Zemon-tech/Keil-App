import { Response, NextFunction } from "express";
import * as organisationService from "../services/organisation.service";
import { ApiResponse } from "../utils/ApiResponse";
import { ApiError } from "../utils/ApiError";

/**
 * @desc    Get current authenticated user profile and their workspace (mapped to personal organisation for compatibility)
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

        // 2. Find user's organisations
        const organisations = await organisationService.getUserOrganisations(user.id);

        // 3. Find personal organisation, fallback to first organisation or a dummy one
        const personalOrg = organisations.find(o => o.is_personal) || organisations[0] || {
            id: "00000000-0000-0000-0000-000000000000",
            name: user.name ? `${user.name.split(" ")[0]} Workspace` : "Workspace",
            role: "owner"
        };

        // 4. Structure exactly matching the API Contract from Phase-0, mapping the organisation to the legacy workspace key
        return res.status(200).json(
            new ApiResponse(
                200,
                {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    created_at: user.created_at,
                    workspace: {
                        id: personalOrg.id,
                        name: personalOrg.name,
                        role: personalOrg.role
                    }
                },
                "User profile retrieved successfully"
            )
        );
    } catch (error) {
        // Any error in retrieval passes down properly
        next(error);
    }
};

