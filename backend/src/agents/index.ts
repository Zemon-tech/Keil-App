import { Mastra } from "@mastra/core";
import { Agent } from "@mastra/core/agent";
import { createTool } from "@mastra/core/tools";
import { RequestContext } from "@mastra/core/request-context";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { z } from "zod";
import { config } from "../config";

// ─── Model factory ────────────────────────────────────────────────────────────

let _model: ReturnType<ReturnType<typeof createOpenAICompatible>> | null = null;

export function getModel() {
  if (!_model) {
    const openrouter = createOpenAICompatible({
      name: "openrouter",
      baseURL: config.openRouterBaseUrl,
      apiKey: config.openRouterApiKey,
    });
    _model = openrouter(config.openRouterModel);
  }
  return _model;
}

// ─── Import specialist agents after exporting getModel (avoids circular dep) ──

import { taskAgent } from "./task.agent";
import { chatAgent } from "./chat.agent";
import { motionAgent } from "./motion.agent";

// ─── Delegation tools for the supervisor ─────────────────────────────────────

const delegateToTaskAgent = createTool({
  id: "task_agent",
  description: `Delegate to the Task Agent for any task-related operations:
  listing, viewing, creating, updating, or deleting personal or org/space tasks.
  Also use for filtering tasks by status, priority, or assignee.`,
  inputSchema: z.object({
    query: z.string().describe("The full task-related request from the user"),
  }),
  execute: async (inputData, context) => {
    const result = await taskAgent.generate(
      [{ role: "user", content: inputData.query }],
      { requestContext: context?.requestContext }
    );
    return { response: await result.text };
  },
});

const delegateToChatAgent = createTool({
  id: "chat_agent",
  description: `Delegate to the Chat Agent for any messaging operations:
  checking for unread messages, listing channels, or reading messages from a channel.`,
  inputSchema: z.object({
    query: z.string().describe("The full messaging-related request from the user"),
  }),
  execute: async (inputData, context) => {
    const result = await chatAgent.generate(
      [{ role: "user", content: inputData.query }],
      { requestContext: context?.requestContext }
    );
    return { response: await result.text };
  },
});

const delegateToMotionAgent = createTool({
  id: "motion_agent",
  description: `Delegate to the Motion Agent for notes/pages operations:
  searching for notes by keyword, or retrieving the content of a specific page.`,
  inputSchema: z.object({
    query: z.string().describe("The full notes-related request from the user"),
  }),
  execute: async (inputData, context) => {
    const result = await motionAgent.generate(
      [{ role: "user", content: inputData.query }],
      { requestContext: context?.requestContext }
    );
    return { response: await result.text };
  },
});

// ─── Supervisor ───────────────────────────────────────────────────────────────

export const supervisor = new Agent({
  id: "keilhq-ai",
  name: "keilhq-ai",
  instructions: `You are KeilHQ AI, a concise and helpful work assistant inside a productivity app.

ANSWER DIRECTLY (no delegation needed):
- General questions, writing help, brainstorming, analysis, summaries, planning
- Drafting emails/messages, explaining concepts
- Any request that does not require accessing the user's actual app data

DELEGATE to the appropriate specialist:
- Tasks (list, view, create, edit, delete, filter) → task_agent
- Messaging (check unread, list channels, read messages) → chat_agent
- Notes/pages (search, read content) → motion_agent

Pass the user's full request verbatim to the specialist — do not paraphrase it.
Never mention internal agent names (task_agent, chat_agent, motion_agent) to the user.
Keep responses clear, concise, and professional.`,
  model: getModel(),
  tools: {
    task_agent: delegateToTaskAgent,
    chat_agent: delegateToChatAgent,
    motion_agent: delegateToMotionAgent,
  },
});

// ─── Mastra instance ──────────────────────────────────────────────────────────

export const mastra = new Mastra({
  agents: { supervisor, taskAgent, chatAgent, motionAgent },
});

// ─── RequestContext helper ────────────────────────────────────────────────────

export function buildRequestContext(params: {
  userId: string;
  orgId?: string;
  spaceId?: string;
}): RequestContext {
  const rc = new RequestContext();
  rc.set("userId", params.userId);
  if (params.orgId) rc.set("orgId", params.orgId);
  if (params.spaceId) rc.set("spaceId", params.spaceId);
  return rc;
}