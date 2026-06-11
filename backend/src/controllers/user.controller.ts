import { Response, NextFunction } from "express";
import { ApiResponse } from "../utils/ApiResponse";
import { ApiError } from "../utils/ApiError";
import pool from "../config/pg";

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

/**
 * @desc    Search registered users on the platform
 * @route   GET /api/users/search
 * @access  Private
 */
export const searchUsers = async (req: any, res: Response, next: NextFunction) => {
    try {
        const currentUserId = req.user?.id;
        const q = req.query.q as string;

        if (!currentUserId) {
            throw new ApiError(401, "Unauthorized access");
        }

        if (!q || q.trim().length < 2) {
            return res.status(200).json(
                new ApiResponse(200, [], "Search query is too short")
            );
        }

        const query = `
            SELECT id, name, email, avatar_url
            FROM public.users
            WHERE (email ILIKE $1 OR name ILIKE $1)
              AND id <> $2
            LIMIT 10
        `;
        const result = await pool.query(query, [`%${q.trim()}%`, currentUserId]);

        return res.status(200).json(
            new ApiResponse(200, result.rows, "Users retrieved successfully")
        );
    } catch (error) {
        next(error);
    }
};
