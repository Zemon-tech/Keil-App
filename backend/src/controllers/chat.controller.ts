import { Request, Response } from "express";
import { chatService } from "../services/chat.service";
import pool from "../config/pg";
import { broadcastNewChannel, io } from "../socket";

// Wraps async route handlers — passes errors to Express error middleware
const asyncHandler = (fn: Function) => (req: Request, res: Response, next: any) =>
    Promise.resolve(fn(req, res, next)).catch(next);

export const createDirectChannel = asyncHandler(async (req: any, res: Response) => {
    const { target_user_id } = req.body;
    const userId = req.user.id;
    const workspaceId = req.workspaceId;

    if (!target_user_id) {
        return res.status(400).json({ success: false, error: { message: "target_user_id is required" } });
    }

    if (target_user_id === userId) {
        return res.status(400).json({ success: false, error: { message: "Cannot create a direct channel with yourself" } });
    }

    // Verify target user belongs to the same workspace
    const checkTarget = await pool.query(
        'SELECT 1 FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
        [workspaceId, target_user_id]
    );
    if (checkTarget.rowCount === 0) {
        return res.status(400).json({ success: false, error: { message: "Target user is not in the same workspace" } });
    }

    // Return existing channel if one already exists between these two users
    const existingChannelId = await chatService.findDirectChannel(userId, target_user_id, workspaceId);
    if (existingChannelId) {
        const channel = await chatService.getChannelById(existingChannelId, userId);
        return res.status(200).json({ success: true, data: { channel } });
    }

    // Create new direct channel — exactly 2 members, no role distinction
    const channelId = await chatService.createChannel(workspaceId, 'direct', null, [userId, target_user_id]);
    const channel = await chatService.getChannelById(channelId, userId);

    broadcastNewChannel([userId, target_user_id], channel);

    return res.status(201).json({ success: true, data: { channel } });
});

export const createGroupChannel = asyncHandler(async (req: any, res: Response) => {
    const { name, member_ids } = req.body;
    const userId = req.user.id;
    const workspaceId = req.workspaceId;

    if (!name || name.trim().length === 0 || name.length > 50) {
        return res.status(400).json({ success: false, error: { message: "Name is required and must be under 50 characters" } });
    }

    if (!member_ids || !Array.isArray(member_ids)) {
        return res.status(400).json({ success: false, error: { message: "member_ids must be an array" } });
    }

    // Only workspace admins or owners can create group channels
    const roleCheck = await pool.query(
        'SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
        [workspaceId, userId]
    );
    const role = roleCheck.rows[0]?.role;
    if (role !== 'admin' && role !== 'owner') {
        return res.status(403).json({ success: false, error: { message: "Only admins or owners can create group channels" } });
    }

    // Ensure creator is always included; use Set to deduplicate
    const allMembers = Array.from(new Set([...member_ids, userId]));

    const channelId = await chatService.createChannel(workspaceId, 'group', name, allMembers, userId);
    const channel = await chatService.getChannelById(channelId, userId);

    broadcastNewChannel(allMembers, channel);

    return res.status(201).json({ success: true, data: { channel } });
});

export const getUserChannels = asyncHandler(async (req: any, res: Response) => {
    const userId = req.user.id;
    const workspaceId = req.workspaceId;

    if (!workspaceId) {
        return res.status(400).json({ success: false, error: { message: "Workspace ID required" } });
    }

    const channels = await chatService.getUserChannels(userId, workspaceId);

    return res.status(200).json({ success: true, data: { channels } });
});

export const getChannelMessages = asyncHandler(async (req: any, res: Response) => {
    const { id } = req.params;
    const { limit, before_id } = req.query;
    const userId = req.user.id;

    // Verify the requesting user is a member of this channel
    const memberCheck = await pool.query(
        'SELECT 1 FROM channel_members WHERE channel_id = $1 AND user_id = $2',
        [id, userId]
    );
    if (memberCheck.rowCount === 0) {
        return res.status(403).json({ success: false, error: { message: "Not a member of this channel" } });
    }

    const parsedLimit = limit ? Math.min(parseInt(limit as string, 10), 100) : 50;
    const messages = await chatService.getChannelMessages(id, parsedLimit, before_id as string);

    return res.status(200).json({ success: true, data: { messages } });
});

export const markChannelAsRead = asyncHandler(async (req: any, res: Response) => {
    const { id } = req.params;
    const userId = req.user.id;

    await chatService.markAsRead(id, userId);

    return res.status(200).json({ success: true, message: "Channel marked as read" });
});

export const addChannelMembers = asyncHandler(async (req: any, res: Response) => {
    const { id } = req.params;
    const { member_ids } = req.body;
    const userId = req.user.id;

    if (!member_ids || !Array.isArray(member_ids) || member_ids.length === 0) {
        return res.status(400).json({ success: false, error: { message: "member_ids must be a non-empty array" } });
    }

    // Only group admins can add members
    const roleCheck = await pool.query(
        `SELECT cm.role, c.type
         FROM channel_members cm
         JOIN channels c ON c.id = cm.channel_id
         WHERE cm.channel_id = $1 AND cm.user_id = $2`,
        [id, userId]
    );
    const row = roleCheck.rows[0];
    if (!row || row.type !== 'group') {
        return res.status(400).json({ success: false, error: { message: "Invalid channel or not a group" } });
    }
    if (row.role !== 'admin') {
        return res.status(403).json({ success: false, error: { message: "Only group admins can add members" } });
    }

    await chatService.addMembers(id, member_ids);
    const channel = await chatService.getChannelById(id, userId);

    // Notify newly added members to refresh their channel list
    broadcastNewChannel(member_ids, channel);
    // Notify existing members to refresh the member list
    io.to(`channel:${id}`).emit("channel_updated", { channel_id: id });

    return res.status(200).json({ success: true, data: { channel } });
});

export const removeChannelMember = asyncHandler(async (req: any, res: Response) => {
    const { id, userId: targetUserId } = req.params;
    const userId = req.user.id;

    // A user can always remove themselves; removing others requires group admin
    if (targetUserId !== userId) {
        const roleCheck = await pool.query(
            `SELECT cm.role, c.type
             FROM channel_members cm
             JOIN channels c ON c.id = cm.channel_id
             WHERE cm.channel_id = $1 AND cm.user_id = $2`,
            [id, userId]
        );
        const row = roleCheck.rows[0];
        if (!row || row.type !== 'group') {
            return res.status(400).json({ success: false, error: { message: "Invalid channel or not a group" } });
        }
        if (row.role !== 'admin') {
            return res.status(403).json({ success: false, error: { message: "Only group admins can remove other members" } });
        }
    }

    await chatService.removeMember(id, targetUserId);

    // Tell the removed user to drop this channel from their list
    io.to(`user:${targetUserId}`).emit("channel_removed", { channel_id: id });
    // Notify remaining members to refresh the member list
    io.to(`channel:${id}`).emit("channel_updated", { channel_id: id });

    return res.status(200).json({ success: true, message: "Member removed successfully" });
});
