import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import pool from "../../config/pg";
import * as orgChatService from "../../services/org-chat.service";
import { ActivityEvent } from "../types/activity";
import { emitActivity } from "../lib/activity-stream";


// ─── Helper: verify channel membership ───────────────────────────────────────

async function isChannelMember(
  channelId: string,
  userId: string
): Promise<boolean> {
  const result = await pool.query(
    `SELECT 1 FROM public.channel_members
     WHERE channel_id = $1 AND user_id = $2 LIMIT 1`,
    [channelId, userId]
  );
  return (result.rowCount ?? 0) > 0;
}

// ─── Tool: get_user_channels ──────────────────────────────────────────────────

export const getUserChannelsTool = createTool({
  id: "get_user_channels",
  description:
    "List all channels the current user is a member of in this space, including unread message counts.",
  inputSchema: z.object({}),
  execute: async (_inputData, context) => {
    const userId = context?.requestContext?.get("userId") as string;
    const orgId = context?.requestContext?.get("orgId") as string;
    const spaceId = context?.requestContext?.get("spaceId") as string;

    if (!userId || !orgId || !spaceId)
      return { error: "Missing org or space context." };

    await emitActivity(context, {
      agentLabel: "Chat",
      action: "Checking your channels",
      status: "running",
    });

    const channels = await orgChatService.getUserChannels(
      userId,
      orgId,
      spaceId
    );
    const totalUnread = channels.reduce((sum: number, c: any) => sum + (c.unread_count ?? 0), 0);
    const unreadChannels = channels.filter((c: any) => (c.unread_count ?? 0) > 0);

    const activity: ActivityEvent = {
      agent: 'keilhq-chat-agent',
      agentLabel: 'Chat',
      tool: 'get_user_channels',
      icon: 'message-square',
      action: 'Checking your channels',
      details: `Found ${channels.length} channel(s) — ${totalUnread} unread message(s)`,
      status: 'complete',
      timestamp: new Date().toISOString(),
    };

    await emitActivity(context, {
      agentLabel: "Chat",
      action: "Checking your channels",
      status: "complete",
    });

    return {
      activity,
      channels,
      count: channels.length,
      totalUnreadCount: totalUnread,
      unreadChannels: unreadChannels.map((c: any) => ({
        channelId: c.id,
        channelName: c.name,
        type: c.type,
        unreadCount: c.unread_count,
        members: c.members,
      })),
    };
  },
});

// ─── Tool: get_channel_messages ───────────────────────────────────────────────

export const getChannelMessagesTool = createTool({
  id: "get_channel_messages",
  description:
    "Get recent messages from a specific channel. The user must be a member of the channel.",
  inputSchema: z.object({
    channelId: z.string().uuid().describe("The channel's UUID"),
    limit: z
      .number()
      .int()
      .min(1)
      .max(50)
      .optional()
      .default(20)
      .describe("Number of recent messages to fetch"),
  }),
  execute: async (inputData, context) => {
    const userId = context?.requestContext?.get("userId") as string;
    if (!userId) return { error: "Not authenticated." };

    await emitActivity(context, {
      agentLabel: "Chat",
      action: "Reading channel messages",
      status: "running",
    });

    const member = await isChannelMember(inputData.channelId, userId);
    if (!member)
      return { error: "You are not a member of this channel." };

    const messages = await orgChatService.getChannelMessages(
      inputData.channelId,
      inputData.limit
    );

    const activity: ActivityEvent = {
      agent: 'keilhq-chat-agent',
      agentLabel: 'Chat',
      tool: 'get_channel_messages',
      icon: 'message-circle',
      action: 'Reading channel messages',
      details: `Fetched ${messages.length} recent message(s)`,
      status: 'complete',
      timestamp: new Date().toISOString(),
    };

    await emitActivity(context, {
      agentLabel: "Chat",
      action: "Reading channel messages",
      status: "complete",
    });

    return {
      activity,
      messages,
      count: messages.length
    };
  },
});
