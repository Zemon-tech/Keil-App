import { Response, NextFunction } from "express";
import * as organisationService from "../services/organisation.service";
import { ApiResponse } from "../utils/ApiResponse";
import { ApiError } from "../utils/ApiError";

/**
 * @desc    Get current authenticated user profile
 * @route   GET /api/users/me
 * @access  Private
 */
export const getMe = async (req: any, res: Response, next: NextFunction) => {
    try {
        const user = req.user;

        if (!user || !user.id) {
            throw new ApiError(401, "Unauthorized access");
        }

        // Find user's organisations
        const organisations = await organisationService.getUserOrganisations(user.id);
        const personalOrg = organisations.find(o => o.is_personal) || null;

        return res.status(200).json(
            new ApiResponse(
                200,
                {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    created_at: user.created_at,
                    // Keep workspace key for backward compatibility (maps to personal org)
                    workspace: personalOrg
                        ? { id: personalOrg.id, name: personalOrg.name, role: personalOrg.role }
                        : null
                },
                "User profile retrieved successfully"
            )
        );
    } catch (error) {
        next(error);
    }
};
