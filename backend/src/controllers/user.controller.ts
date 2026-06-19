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
                    onboarded: user.onboarded,
                },
                "User profile retrieved successfully"
            )
        );
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Complete user onboarding and mark in database
 * @route   PATCH /api/users/onboard
 * @access  Private
 */
export const completeOnboarding = async (req: any, res: Response, next: NextFunction) => {
    try {
        const userId = req.user?.id;

        if (!userId) {
            throw new ApiError(401, "Unauthorized access");
        }

        await pool.query("UPDATE public.users SET onboarded = true WHERE id = $1", [userId]);

        return res.status(200).json(
            new ApiResponse(200, { onboarded: true }, "Onboarding marked as completed successfully")
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

/**
 * @desc    Get active sessions for the current user
 * @route   GET /api/users/sessions
 * @access  Private
 */
export const getUserSessions = async (req: any, res: Response, next: NextFunction) => {
    try {
        const userId = req.user?.id;
        const currentBrowserId = req.headers["x-browser-id"] as string;

        if (!userId) {
            throw new ApiError(401, "Unauthorized access");
        }

        const query = `
            SELECT id, browser_id, user_agent, platform, login_at, last_seen
            FROM public.user_sessions
            WHERE user_id = $1 AND is_revoked = false
            ORDER BY (browser_id = $2) DESC, last_seen DESC
        `;
        const result = await pool.query(query, [userId, currentBrowserId || ""]);

        const sessions = result.rows.map(row => ({
            id: row.id,
            loginAt: row.login_at,
            lastSeen: row.last_seen,
            userAgent: row.user_agent,
            platform: row.platform,
            isCurrent: row.browser_id === currentBrowserId
        }));

        return res.status(200).json(
            new ApiResponse(200, sessions, "User sessions retrieved successfully")
        );
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Revoke a specific session
 * @route   DELETE /api/users/sessions/:id
 * @access  Private
 */
export const revokeUserSession = async (req: any, res: Response, next: NextFunction) => {
    try {
        const userId = req.user?.id;
        const sessionId = req.params.id;

        if (!userId) {
            throw new ApiError(401, "Unauthorized access");
        }

        const query = `
            UPDATE public.user_sessions
            SET is_revoked = true
            WHERE id = $1 AND user_id = $2
            RETURNING id
        `;
        const result = await pool.query(query, [sessionId, userId]);

        if (result.rows.length === 0) {
            throw new ApiError(404, "Session not found");
        }

        return res.status(200).json(
            new ApiResponse(200, { id: sessionId }, "Session revoked successfully")
        );
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Revoke all sessions for the current user
 * @route   DELETE /api/users/sessions
 * @access  Private
 */
export const revokeAllUserSessions = async (req: any, res: Response, next: NextFunction) => {
    try {
        const userId = req.user?.id;

        if (!userId) {
            throw new ApiError(401, "Unauthorized access");
        }

        const query = `
            UPDATE public.user_sessions
            SET is_revoked = true
            WHERE user_id = $1
        `;
        await pool.query(query, [userId]);

        return res.status(200).json(
            new ApiResponse(200, null, "All sessions revoked successfully")
        );
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Revoke current browser session
 * @route   DELETE /api/users/sessions/current
 * @access  Private
 */
export const revokeCurrentSession = async (req: any, res: Response, next: NextFunction) => {
    try {
        const userId = req.user?.id;
        const browserId = req.headers["x-browser-id"] as string;

        if (!userId) {
            throw new ApiError(401, "Unauthorized access");
        }

        if (!browserId) {
            throw new ApiError(400, "Browser ID header missing");
        }

        const query = `
            UPDATE public.user_sessions
            SET is_revoked = true
            WHERE user_id = $1 AND browser_id = $2
            RETURNING id
        `;
        const result = await pool.query(query, [userId, browserId]);

        return res.status(200).json(
            new ApiResponse(200, { id: result.rows[0]?.id || null }, "Current session revoked successfully")
        );
    } catch (error) {
        next(error);
    }
};

