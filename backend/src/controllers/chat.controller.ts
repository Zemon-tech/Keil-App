import { Request, Response } from "express";
import { ChatService } from "../services/chat.service";

export const createDirectChannel = async (req: Request, res: Response): Promise<void> => {
    try {
        const { target_user_id } = req.body;
        const userId = (req as any).user.id;
        const workspaceId = (req as any).workspaceId;

        if (!target_user_id) {
            res.status(400).json({ success: false, error: { message: "target_user_id is required" } });
            return;
        }

        if (target_user_id === userId) {
            res.status(400).json({ success: false, error: { message: "Cannot create a direct channel with yourself" } });
            return;
        }

        const existingChannelId = await ChatService.getDirectChannel(workspaceId, userId, target_user_id);
        if (existingChannelId) {
            const channel = await ChatService.getChannelById(existingChannelId);
            res.status(200).json({ success: true, data: { channel } });
            return;
        }

        const channel = await ChatService.createDirectChannel(workspaceId, userId, target_user_id);

        const { io } = await import("../index");
        io.to("user:" + target_user_id).emit('channel_added', channel);
        io.to("user:" + userId).emit('channel_added', channel);

        res.status(201).json({ success: true, data: { channel } });
    } catch (error: any) {
        res.status(500).json({ success: false, error: { message: error.message } });
    }
};

export const createGroupChannel = async (req: Request, res: Response): Promise<void> => {
    try {
        const { name, member_ids } = req.body;
        const userId = (req as any).user.id;
        const workspaceId = (req as any).workspaceId;

        if (!name || name.length > 50) {
            res.status(400).json({ success: false, error: { message: "Name must be provided and under 50 chars" } });
            return;
        }

        if (!member_ids || !Array.isArray(member_ids) || member_ids.length === 0) {
             res.status(400).json({ success: false, error: { message: "member_ids array is required" } });
             return;
        }

        const userRole = await ChatService.fetchUserWorkspaceRole(workspaceId, userId);
        if (userRole !== 'admin' && userRole !== 'owner') {
             res.status(403).json({ success: false, error: { message: "Only admin or owner can create group channels" } });
             return;
        }

        const finalMembers = [...new Set([...member_ids, userId])];
        const channel = await ChatService.createGroupChannel(workspaceId, name, finalMembers);

        const { io } = await import("../index");
        finalMembers.forEach(mem => {
             io.to("user:" + mem).emit('channel_added', channel);
        });

        res.status(201).json({ success: true, data: { channel } });
    } catch (error: any) {
        res.status(500).json({ success: false, error: { message: error.message } });
    }
}

export const getChannels = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = (req as any).user.id;
        const workspaceId = (req as any).workspaceId;

        const channels = await ChatService.getUserChannels(workspaceId, userId);
        res.status(200).json({ success: true, data: { channels } });
    } catch (error: any) {
        res.status(500).json({ success: false, error: { message: error.message } });
    }
};

export const getChannelMessages = async (req: Request, res: Response): Promise<void> => {
    try {
        const channelId = req.params.id as string;
        const userId = (req as any).user.id as string;
        const workspaceId = (req as any).workspaceId as string;
        const limitStr = req.query.limit?.toString() as string;
        const beforeId = req.query.before_id?.toString();

        let limit = parseInt(limitStr) || 50;
        if (limit > 100) limit = 100;
        if (limit <= 0) limit = 50;

        const messages = await ChatService.getChannelMessages(workspaceId, userId, channelId, limit, beforeId);
        res.status(200).json({ success: true, data: { messages } });
    } catch (error: any) {
        res.status(500).json({ success: false, error: { message: error.message } });
    }
};

export const markAsRead = async (req: Request, res: Response): Promise<void> => {
     try {
         const channelId = req.params.id as string;
         const userId = (req as any).user.id as string;
         const workspaceId = (req as any).workspaceId as string;

         await ChatService.markAsRead(workspaceId, userId, channelId);
         res.status(200).json({ success: true, message: "Channel marked as read" });
     } catch (error: any) {
         res.status(500).json({ success: false, error: { message: error.message } });
     }
}
