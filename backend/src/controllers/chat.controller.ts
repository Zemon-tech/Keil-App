import { Request, Response } from "express";
import { chatService } from "../services/chat.service";
import pool from "../config/pg";
import { broadcastNewChannel, getIO } from "../socket";

// Utility to wrap async functions for error handling
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

    // Verify target_user_id is in the same workspace
    const checkTarget = await pool.query('SELECT 1 FROM workspace_members WHERE workspace_id = $1 AND user_id = $2', [workspaceId, target_user_id]);
    if (checkTarget.rowCount === 0) {
        return res.status(400).json({ success: false, error: { message: "Target user is not in the same workspace" } });
    }

    // Check if channel already exists
    let channelId = await chatService.findDirectChannel(userId, target_user_id, workspaceId);

    if (!channelId) {
        // Create new
        channelId = await chatService.createChannel(workspaceId, 'direct', null, [userId, target_user_id]);
        const channel = await chatService.getChannelById(channelId, userId);
        broadcastNewChannel([userId, target_user_id], channel);
        return res.status(201).json({ success: true, data: { channel } });
    }

    const channel = await chatService.getChannelById(channelId, userId);

    res.status(200).json({
        success: true,
        data: { channel }
    });
});

export const createGroupChannel = asyncHandler(async (req: any, res: Response) => {
    const { name, member_ids, privacy = 'public' } = req.body;
    const userId = req.user.id;
    const workspaceId = req.workspaceId;

    if (!name || name.length > 50) {
        return res.status(400).json({ success: false, error: { message: "Name is required and must be under 50 characters" } });
    }

    if (!member_ids || !Array.isArray(member_ids)) {
        return res.status(400).json({ success: false, error: { message: "member_ids must be an array" } });
    }

    const validPrivacy = ['public', 'private', 'secret'];
    if (!validPrivacy.includes(privacy)) {
        return res.status(400).json({ success: false, error: { message: `privacy must be one of: ${validPrivacy.join(', ')}` } });
    }

    // Verify user is a member of the workspace (any role can create a channel)
    const memberCheck = await pool.query('SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2', [workspaceId, userId]);
    if (memberCheck.rowCount === 0) {
        return res.status(403).json({ success: false, error: { message: "You must be a member of this workspace to create a channel" } });
    }

    // Ensure creator is in the members list
    const allMembers = new Set([...member_ids, userId]);

    const channelId = await chatService.createChannel(
        workspaceId, 'group', name, Array.from(allMembers), userId,
        privacy as 'public' | 'private' | 'secret'
    );
    const channel = await chatService.getChannelById(channelId, userId);

    broadcastNewChannel(Array.from(allMembers), channel);

    res.status(201).json({
        success: true,
        data: { channel }
    });
});

export const getUserChannels = asyncHandler(async (req: any, res: Response) => {
    const userId = req.user.id;
    const workspaceId = req.workspaceId;

    if (!workspaceId) {
        return res.status(400).json({ success: false, error: { message: "Workspace ID required" } });
    }

    const channels = await chatService.getUserChannels(userId, workspaceId);

    res.status(200).json({
        success: true,
        data: { channels }
    });
});

export const getChannelMessages = asyncHandler(async (req: any, res: Response) => {
    const { id } = req.params;
    const { limit, before_id } = req.query;
    const userId = req.user.id;

    // Use our checkChannelAccess
    const hasAccess = await chatService.checkChannelAccess(userId, id);
    if (!hasAccess) {
        return res.status(403).json({ success: false, error: { message: "403 Forbidden" } });
    }

    const parsedLimit = limit ? Math.min(parseInt(limit as string, 10), 100) : 50;

    const messages = await chatService.getChannelMessages(id, userId, parsedLimit, before_id as string);

    res.status(200).json({
        success: true,
        data: { messages }
    });
});

export const markChannelAsRead = asyncHandler(async (req: any, res: Response) => {
    const { id } = req.params;
    const userId = req.user.id;

    await chatService.markAsRead(id, userId);

    res.status(200).json({
        success: true,
        message: "Channel marked as read"
    });
});

export const addChannelMembers = asyncHandler(async (req: any, res: Response) => {
    const { id } = req.params;
    const { member_ids } = req.body;
    const userId = req.user.id;

    if (!member_ids || !Array.isArray(member_ids) || member_ids.length === 0) {
        return res.status(400).json({ success: false, error: { message: "member_ids must be a non-empty array" } });
    }

    // Verify creator is admin of this group
    const roleCheck = await pool.query('SELECT role, type FROM channel_members cm JOIN channels c ON c.id = cm.channel_id WHERE cm.channel_id = $1 AND cm.user_id = $2', [id, userId]);
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
    
    // Notify existing members to refresh their member lists
    const io = getIO();
    if (io) io.to(`channel:${id}`).emit("channel_updated", { channel_id: id });

    res.status(200).json({
        success: true,
        data: { channel }
    });
});

export const removeChannelMember = asyncHandler(async (req: any, res: Response) => {
    const { id, userId: targetUserId } = req.params;
    const userId = req.user.id;

    // Verify creator is admin of this group, or the user is leaving voluntarily
    if (targetUserId !== userId) {
        const roleCheck = await pool.query('SELECT role, type FROM channel_members cm JOIN channels c ON c.id = cm.channel_id WHERE cm.channel_id = $1 AND cm.user_id = $2', [id, userId]);
        const row = roleCheck.rows[0];
        if (!row || row.type !== 'group') {
            return res.status(400).json({ success: false, error: { message: "Invalid channel or not a group" } });
        }
        if (row.role !== 'admin') {
            return res.status(403).json({ success: false, error: { message: "Only group admins can remove other members" } });
        }
    }

    await chatService.removeMember(id, targetUserId);

    // Force the removed user to refresh and lose the channel
    const io = getIO();
    if (io) {
        io.to(`user:${targetUserId}`).emit("channel_removed", { channel_id: id });
        
        // Notify existing members to refresh their member lists
        io.to(`channel:${id}`).emit("channel_updated", { channel_id: id });
    }

});

export const editMessage = asyncHandler(async (req: any, res: Response) => {
    const { id, messageId } = req.params;
    const { content } = req.body;
    const userId = req.user.id;

    if (!content) return res.status(400).json({ success: false, error: { message: "Content is required" } });

    const updated = await chatService.editMessage(messageId, content, userId);
    if (!updated) return res.status(403).json({ success: false, error: { message: "Cannot edit this message" } });

    getIO()?.to(`channel:${id}`).emit("message_edited", { channel_id: id, message: updated });

    res.status(200).json({ success: true, data: { message: updated } });
});

export const deleteMessage = asyncHandler(async (req: any, res: Response) => {
    const { id, messageId } = req.params;
    const userId = req.user.id;

    const deleted = await chatService.deleteMessage(messageId, userId);
    if (!deleted) return res.status(403).json({ success: false, error: { message: "Cannot delete this message" } });

    getIO()?.to(`channel:${id}`).emit("message_deleted", { channel_id: id, message_id: messageId });

    res.status(200).json({ success: true, message: "Message deleted" });
});

export const pinMessage = asyncHandler(async (req: any, res: Response) => {
    const { id, messageId } = req.params;
    const { is_pinned } = req.body;
    
    // Assuming any member can pin
    const pinned = await chatService.pinMessage(messageId, is_pinned);
    
    getIO()?.to(`channel:${id}`).emit("message_pinned", { channel_id: id, message: pinned });

    res.status(200).json({ success: true, data: { message: pinned } });
});

export const toggleReaction = asyncHandler(async (req: any, res: Response) => {
    const { id, messageId } = req.params;
    const { emoji } = req.body;
    const userId = req.user.id;

    if (!emoji) return res.status(400).json({ success: false, error: { message: "Emoji is required" } });

    const updated = await chatService.toggleReaction(messageId, emoji, userId);
    
    getIO()?.to(`channel:${id}`).emit("message_reaction", { channel_id: id, message_id: messageId, reactions: updated.reactions });

    res.status(200).json({ success: true, data: { reactions: updated.reactions } });
});

export const getThreadMessages = asyncHandler(async (req: any, res: Response) => {
    const { messageId } = req.params;
    const messages = await chatService.getThreadMessages(messageId);
    res.status(200).json({ success: true, data: { messages } });
});

export const createTaskFromMessage = asyncHandler(async (req: any, res: Response) => {
    const { id, messageId } = req.params;
    const userId = req.user.id;
    const workspaceId = req.workspaceId;

    const updated = await chatService.createTaskFromMessage(messageId, workspaceId, userId);
    
    getIO()?.to(`channel:${id}`).emit("message_task_created", { channel_id: id, message_id: messageId, task_id: updated.task_id });

    res.status(200).json({ success: true, data: { task_id: updated.task_id } });
});

export const joinChannel = asyncHandler(async (req: any, res: Response) => {
    const { id } = req.params;
    const userId = req.user.id;

    await chatService.joinChannel(userId, id);

    res.status(200).json({
        success: true,
        message: "Joined channel successfully"
    });
});

export const checkChannelAccessMiddleware = asyncHandler(async (req: any, res: Response, next: any) => {
    const channelId = req.params.id;
    const userId = req.user.id;

    if (!channelId) return next();

    const hasAccess = await chatService.checkChannelAccess(userId, channelId);
    if (!hasAccess) {
        return res.status(403).json({ success: false, error: { message: "403 Forbidden" } });
    }
    next();
});

