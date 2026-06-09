import { Agent } from "@mastra/core/agent";
import { resolveModel } from "../models";
import {
  getUserChannelsTool,
  getChannelMessagesTool,
} from "../tools/chat.tools";

export const chatAgent = new Agent({
  id: "keilhq-chat-agent",
  name: "keilhq-chat-agent",
  description:
    "Handles messaging operations: list channels the user belongs to, check unread message counts, and read recent messages from a channel.",
  instructions: `You are the KeilHQ Chat Agent. You help users check their messages and channels.

When reporting unread messages, be concise: show channel name (or member names for DMs), sender, and the unread count.
You cannot send messages on behalf of the user — only read and check status.
If a user asks to "send" or "reply", let them know that is not supported and they should use the chat interface directly.

Use get_user_channels to list channels and check unread counts. The response includes
totalUnreadCount and unreadChannels — use these directly. There is no separate unread tool.`,
  model: ({ requestContext }) => resolveModel(requestContext),
  tools: {
    get_user_channels: getUserChannelsTool,
    get_channel_messages: getChannelMessagesTool,
  },
});
