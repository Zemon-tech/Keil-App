import { Agent } from "@mastra/core/agent";
import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import pool from "../config/pg";
import * as orgChatService from "../services/org-chat.service";
import { getModel } from "./index";

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

// ─── Tools ────────────────────────────────────────────────────────────────────

export const getUserChannelsTool = createTool({
  id: "get_user_channels",
  description:
    "List all channels the current user is a member of in this space, including unread message counts.",
  inputSchema: z.object({}),
  execute: async ({ }, options) => {
    const userId = options?.requestContext?.get("userId") as string;
    const orgId = options?.requestContext?.get("orgId") as string;
    const spaceId = options?.requestContext?.get("spaceId") as string;

    if (!userId || !orgId || !spaceId)
      return { error: "Missing org or space context." };

    const channels = await orgChatService.getUserChannels(
      userId,
      orgId,
      spaceId
    );
    return { channels, count: channels.length };
  },
});

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
  execute: async ({ context: input }, options) => {
    const userId = options?.requestContext?.get("userId") as string;
    if (!userId) return { error: "Not authenticated." };

    const member = await isChannelMember(input.channelId, userId);
    if (!member)
      return {
        error: "You are not a member of this channel.",
      };

    const messages = await orgChatService.getChannelMessages(
      input.channelId,
      input.limit
    );
    return { messages, count: messages.length };
  },
});

export const checkUnreadMessagesTool = createTool({
  id: "check_unread_messages",
  description:
    "Check whether the current user has any unread messages across all their channels in this space.",
  inputSchema: z.object({}),
  execute: async ({ }, options) => {
    const userId = options?.requestContext?.get("userId") as string;
    const orgId = options?.requestContext?.get("orgId") as string;
    const spaceId = options?.requestContext?.get("spaceId") as string;

    if (!userId || !orgId || !spaceId)
      return { error: "Missing org or space context." };

    // getUserChannels already returns unread_count per channel
    const channels = await orgChatService.getUserChannels(
      userId,
      orgId,
      spaceId
    );
    const unreadChannels = channels.filter((c) => c.unread_count > 0);
    const totalUnread = unreadChannels.reduce(
      (sum, c) => sum + c.unread_count,
      0
    );

    return {
      hasUnread: unreadChannels.length > 0,
      totalUnreadCount: totalUnread,
      unreadChannels: unreadChannels.map((c) => ({
        channelId: c.id,
        channelName: c.name,
        type: c.type,
        unreadCount: c.unread_count,
        members: c.members,
      })),
    };
  },
});

// ─── Chat Agent ───────────────────────────────────────────────────────────────

export const chatAgent = new Agent({
  id: "keilhq-chat-agent",
  name: "keilhq-chat-agent",
  instructions: `You are the KeilHQ Chat Agent. You help users check their messages and channels.

When reporting unread messages, be concise: show channel name (or member names for DMs), sender, and the unread count.
You cannot send messages on behalf of the user — only read and check status.
If a user asks to "send" or "reply", let them know that is not supported and they should use the chat interface directly.`,
  model: getModel(),
  tools: {
    get_user_channels: getUserChannelsTool,
    get_channel_messages: getChannelMessagesTool,
    check_unread_messages: checkUnreadMessagesTool,
  },
});