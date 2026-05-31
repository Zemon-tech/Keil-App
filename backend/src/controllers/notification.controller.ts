import { Request, Response } from "express";
import { catchAsync } from "../utils/catchAsync";
import { ApiResponse } from "../utils/ApiResponse";
import { ApiError } from "../utils/ApiError";
import pool from "../config/pg";
import { userNotificationPreferenceRepository } from "../repositories";

/**
 * Fetch paginated list of notifications for the logged-in recipient
 */
export const getNotifications = catchAsync(async (req: Request, res: Response) => {
    const userId = (req as any).user?.id as string;
    if (!userId) throw new ApiError(401, "Unauthorized");

    const limit = parseInt(req.query.limit as string, 10) || 20;
    const offset = parseInt(req.query.offset as string, 10) || 0;
    const unreadOnly = req.query.unread_only === 'true';

    let query = `
        SELECT n.*, 
               u.name as sender_name, 
               u.email as sender_email
        FROM public.notifications n
        LEFT JOIN public.users u ON n.sender_id = u.id
        WHERE n.recipient_id = $1
    `;
    const params: any[] = [userId];
    let paramIndex = 2;

    if (unreadOnly) {
        query += ` AND n.read_at IS NULL`;
    }

    query += ` ORDER BY n.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);
    
    res.status(200).json(new ApiResponse(200, result.rows, "Notifications retrieved successfully"));
});

/**
 * Get count of unread notifications
 */
export const getUnreadCount = catchAsync(async (req: Request, res: Response) => {
    const userId = (req as any).user?.id as string;
    if (!userId) throw new ApiError(401, "Unauthorized");

    const query = `SELECT COUNT(*)::int as count FROM public.notifications WHERE recipient_id = $1 AND read_at IS NULL`;
    const result = await pool.query(query, [userId]);
    const count = result.rows[0]?.count || 0;

    res.status(200).json(new ApiResponse(200, { count }, "Unread count retrieved successfully"));
});

/**
 * Mark specific notification as read
 */
export const markAsRead = catchAsync(async (req: Request, res: Response) => {
    const userId = (req as any).user?.id as string;
    if (!userId) throw new ApiError(401, "Unauthorized");

    const { id } = req.params;

    const result = await pool.query(
        `UPDATE public.notifications 
         SET read_at = NOW() 
         WHERE id = $1 AND recipient_id = $2 
         RETURNING *`,
        [id, userId]
    );

    if (result.rows.length === 0) {
        throw new ApiError(404, "Notification not found or access denied");
    }

    res.status(200).json(new ApiResponse(200, result.rows[0], "Notification marked as read"));
});

/**
 * Mark all recipient's notifications as read
 */
export const markAllAsRead = catchAsync(async (req: Request, res: Response) => {
    const userId = (req as any).user?.id as string;
    if (!userId) throw new ApiError(401, "Unauthorized");

    await pool.query(
        `UPDATE public.notifications SET read_at = NOW() WHERE recipient_id = $1 AND read_at IS NULL`,
        [userId]
    );

    res.status(200).json(new ApiResponse(200, null, "All notifications marked as read"));
});

/**
 * Clear recipient notifications feed (soft delete / hide all)
 */
export const clearAllNotifications = catchAsync(async (req: Request, res: Response) => {
    const userId = (req as any).user?.id as string;
    if (!userId) throw new ApiError(401, "Unauthorized");

    await pool.query(`DELETE FROM public.notifications WHERE recipient_id = $1`, [userId]);

    res.status(200).json(new ApiResponse(200, null, "All notifications cleared"));
});

/**
 * Fetch user notification preferences
 */
export const getNotificationPreferences = catchAsync(async (req: Request, res: Response) => {
    const userId = (req as any).user?.id as string;
    if (!userId) throw new ApiError(401, "Unauthorized");

    const prefs = await userNotificationPreferenceRepository.findByUserId(userId);

    res.status(200).json(new ApiResponse(200, prefs, "Notification preferences retrieved successfully"));
});

/**
 * Update user notification preferences
 */
export const updateNotificationPreferences = catchAsync(async (req: Request, res: Response) => {
    const userId = (req as any).user?.id as string;
    if (!userId) throw new ApiError(401, "Unauthorized");

    const {
        notify_task_assigned,
        notify_message,
        notify_motion_shared,
        notify_status_changed,
        notify_membership_updated,
        notify_comment_mention
    } = req.body;

    const prefs = await userNotificationPreferenceRepository.update(userId, {
        notify_task_assigned,
        notify_message,
        notify_motion_shared,
        notify_status_changed,
        notify_membership_updated,
        notify_comment_mention
    });

    res.status(200).json(new ApiResponse(200, prefs, "Notification preferences updated successfully"));
});
