import { Request, Response } from "express";
import { io, broadcastNewChannel } from "../socket";
import { catchAsync } from "../utils/catchAsync";
import { ApiError } from "../utils/ApiError";
import * as orgChatService from "../services/org-chat.service";
import pool from "../config/pg";

const asString = (value: string | string[] | undefined): string =>
  Array.isArray(value) ? value[0] : (value ?? "");

const getChatContext = (req: Request) => {
  const orgId = asString(req.params.orgId);
  const spaceId = asString(req.params.spaceId);
  const workspaceId = (req as any).space?.compatibility_workspace_id as string | undefined;
  if (!workspaceId) {
    throw new ApiError(500, "Compatibility workspace is missing for this space");
  }
  return { orgId, spaceId, workspaceId };
};

export const createDirectChannel = catchAsync(async (req: Request, res: Response) => {
  const { target_user_id } = req.body;
  const userId = (req as any).user?.id as string;
  const context = getChatContext(req);

  if (!target_user_id) throw new ApiError(400, "target_user_id is required");
  if (target_user_id === userId) throw new ApiError(400, "Cannot create a direct channel with yourself");

  const memberCheck = await pool.query(
    `
      SELECT 1
      FROM public.space_members
      WHERE org_id = $1
        AND space_id = $2
        AND user_id = $3
      LIMIT 1
    `,
    [context.orgId, context.spaceId, target_user_id],
  );
  if (memberCheck.rowCount === 0) {
    throw new ApiError(400, "Target user is not in the same space");
  }

  const existingChannelId = await orgChatService.findDirectChannel(
    userId,
    target_user_id,
    context.orgId,
    context.spaceId,
  );
  if (existingChannelId) {
    const channel = await orgChatService.getChannelById(existingChannelId, userId);
    res.status(200).json({ success: true, data: { channel } });
    return;
  }

  const channelId = await orgChatService.createChannel(
    context.workspaceId,
    context.orgId,
    context.spaceId,
    "direct",
    null,
    [userId, target_user_id],
  );
  const channel = await orgChatService.getChannelById(channelId, userId);
  broadcastNewChannel([userId, target_user_id], channel);

  res.status(201).json({ success: true, data: { channel } });
});

export const createGroupChannel = catchAsync(async (req: Request, res: Response) => {
  const { name, member_ids } = req.body;
  const userId = (req as any).user?.id as string;
  const context = getChatContext(req);

  if (!name || name.trim().length === 0 || name.length > 50) {
    throw new ApiError(400, "Name is required and must be under 50 characters");
  }
  if (!member_ids || !Array.isArray(member_ids)) {
    throw new ApiError(400, "member_ids must be an array");
  }

  const allMembers = Array.from(new Set<string>([...member_ids, userId]));
  const channelId = await orgChatService.createChannel(
    context.workspaceId,
    context.orgId,
    context.spaceId,
    "group",
    name,
    allMembers,
    userId,
  );
  const channel = await orgChatService.getChannelById(channelId, userId);
  broadcastNewChannel(allMembers, channel);

  res.status(201).json({ success: true, data: { channel } });
});

export const getUserChannels = catchAsync(async (req: Request, res: Response) => {
  const userId = (req as any).user?.id as string;
  const { orgId, spaceId } = getChatContext(req);
  const channels = await orgChatService.getUserChannels(userId, orgId, spaceId);
  res.status(200).json({ success: true, data: { channels } });
});

export const getChannelMessages = catchAsync(async (req: Request, res: Response) => {
  const userId = (req as any).user?.id as string;
  const id = asString(req.params.id);
  const { limit, before_id } = req.query;

  const memberCheck = await pool.query(
    "SELECT 1 FROM public.channel_members WHERE channel_id = $1 AND user_id = $2",
    [id, userId],
  );
  if (memberCheck.rowCount === 0) throw new ApiError(403, "Not a member of this channel");

  const parsedLimit = limit ? Math.min(parseInt(limit as string, 10), 100) : 50;
  const messages = await orgChatService.getChannelMessages(id, parsedLimit, before_id as string | undefined);
  res.status(200).json({ success: true, data: { messages } });
});

export const markChannelAsRead = catchAsync(async (req: Request, res: Response) => {
  const userId = (req as any).user?.id as string;
  await orgChatService.markAsRead(asString(req.params.id), userId);
  res.status(200).json({ success: true, message: "Channel marked as read" });
});

export const addChannelMembers = catchAsync(async (req: Request, res: Response) => {
  const userId = (req as any).user?.id as string;
  const { member_ids } = req.body;
  const { orgId, spaceId } = getChatContext(req);

  if (!member_ids || !Array.isArray(member_ids) || member_ids.length === 0) {
    throw new ApiError(400, "member_ids must be a non-empty array");
  }

  const roleCheck = await pool.query(
    `
      SELECT cm.role, c.type
      FROM public.channel_members cm
      JOIN public.channels c ON c.id = cm.channel_id
      WHERE cm.channel_id = $1 AND cm.user_id = $2
    `,
    [asString(req.params.id), userId],
  );
  const row = roleCheck.rows[0];
  if (!row || row.type !== "group") throw new ApiError(400, "Invalid channel or not a group");
  if (row.role !== "admin") throw new ApiError(403, "Only group admins can add members");

  await orgChatService.addMembers(orgId, spaceId, asString(req.params.id), member_ids);
  const channel = await orgChatService.getChannelById(asString(req.params.id), userId);
  broadcastNewChannel(member_ids, channel);
  io.to(`channel:${asString(req.params.id)}`).emit("channel_updated", { channel_id: asString(req.params.id) });

  res.status(200).json({ success: true, data: { channel } });
});

export const removeChannelMember = catchAsync(async (req: Request, res: Response) => {
  const userId = (req as any).user?.id as string;
  const targetUserId = asString(req.params.userId);

  if (targetUserId !== userId) {
    const roleCheck = await pool.query(
      `
        SELECT cm.role, c.type
        FROM public.channel_members cm
        JOIN public.channels c ON c.id = cm.channel_id
        WHERE cm.channel_id = $1 AND cm.user_id = $2
      `,
      [asString(req.params.id), userId],
    );
    const row = roleCheck.rows[0];
    if (!row || row.type !== "group") throw new ApiError(400, "Invalid channel or not a group");
    if (row.role !== "admin") throw new ApiError(403, "Only group admins can remove other members");
  }

  await orgChatService.removeMember(asString(req.params.id), targetUserId);
  io.to(`user:${targetUserId}`).emit("channel_removed", { channel_id: asString(req.params.id) });
  io.to(`channel:${asString(req.params.id)}`).emit("channel_updated", { channel_id: asString(req.params.id) });

  res.status(200).json({ success: true, message: "Member removed successfully" });
});
