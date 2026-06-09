import { Response, NextFunction } from "express";
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

        return res.status(200).json(
            new ApiResponse(
                200,
                {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    created_at: user.created_at,
                    avatar_url: user.avatar_url,
                },
                "User profile retrieved successfully"
            )
        );
    } catch (error) {
        next(error);
    }
};
