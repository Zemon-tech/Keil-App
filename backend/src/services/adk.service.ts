import {
  LlmAgent,
  Runner,
  InMemorySessionService,
  FunctionTool,
  Gemini,
} from "@google/adk";
import { type Content, type Schema, Type } from "@google/genai";
import pool from "../config/pg";
import { config } from "../config";
import { ApiError } from "../utils/ApiError";
import { personalTaskRepository } from "../repositories";
import { TaskStatus, TaskPriority } from "../types/enums";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AdkChatReply {
  /** The agent's final text response. */
  content: string;
  /**
   * Return this to the client on every response.
   * Client must send it back as `sessionId` on the next turn to continue
   * the conversation.
   */
  sessionId: string;
}

// ─── Session service ──────────────────────────────────────────────────────────
const sessionService = new InMemorySessionService();

// ─── Tool: get_my_personal_tasks ─────────────────────────────────────────────

const personalTasksParams: Schema = {
  type: Type.OBJECT,
  properties: {
    status: {
      type: Type.STRING,
      enum: Object.values(TaskStatus),
      description: "Filter tasks by status. Optional.",
      nullable: true,
    },
    priority: {
      type: Type.STRING,
      enum: Object.values(TaskPriority),
      description: "Filter tasks by priority. Optional.",
      nullable: true,
    },
    limit: {
      type: Type.NUMBER,
      description: "Max number of tasks to return. Defaults to 10.",
      nullable: true,
    },
  },
  required: [],
};

const getMyPersonalTasksTool = new FunctionTool({
  name: "get_my_personal_tasks",
  description:
    "Fetch the current user's personal tasks. Use this when the user asks about their tasks, todos, or what they need to do.",
  parameters: personalTasksParams,
  // When parameters is a Schema, ADK types input as `unknown` — cast it inside.
  execute: async (input: unknown, toolContext?: { userId: string }) => {
    const params = input as { status?: string; priority?: string; limit?: number };
    const userId = toolContext?.userId;
    if (!userId) return { error: "No user context available." };

    const tasks = await personalTaskRepository.findByOwner(userId, {
      filters: {
        ...(params.status && { status: params.status as TaskStatus }),
        ...(params.priority && { priority: params.priority as TaskPriority }),
        parentTaskId: null,
      },
      pagination: { limit: params.limit ?? 10, offset: 0 },
    });

    if (tasks.length === 0) {
      return { result: "No tasks found matching those filters." };
    }

    return {
      result: tasks.map((t) => ({
        id: t.id,
        title: t.title,
        status: t.status,
        priority: t.priority,
        due_date: t.due_date ?? null,
      })),
    };
  },
});

// ─── Tool: get_my_org_tasks ───────────────────────────────────────────────────

const orgTasksParams: Schema = {
  type: Type.OBJECT,
  properties: {
    status: {
      type: Type.STRING,
      enum: Object.values(TaskStatus),
      description: "Filter tasks by status. Optional.",
      nullable: true,
    },
    priority: {
      type: Type.STRING,
      enum: Object.values(TaskPriority),
      description: "Filter tasks by priority. Optional.",
      nullable: true,
    },
    limit: {
      type: Type.NUMBER,
      description: "Max number of tasks to return. Defaults to 10.",
      nullable: true,
    },
  },
  required: [],
};

const getMyOrgTasksTool = new FunctionTool({
  name: "get_my_org_tasks",
  description:
    "Fetch tasks assigned to the current user inside their organisations and spaces. Use this when asking about team tasks, assigned work, or sprint items.",
  parameters: orgTasksParams,
  execute: async (input: unknown, toolContext?: { userId: string }) => {
    const params = input as { status?: string; priority?: string; limit?: number };
    const userId = toolContext?.userId;
    if (!userId) return { error: "No user context available." };

    const limit = params.limit ?? 10;
    let query = `
      SELECT
        t.id, t.title, t.status, t.priority, t.due_date,
        o.name AS org_name,
        s.name AS space_name
      FROM public.tasks t
      JOIN public.task_assignees ta ON ta.task_id = t.id
      JOIN public.spaces s          ON s.id = t.space_id
      JOIN public.organisations o   ON o.id = t.org_id
      WHERE ta.user_id = $1
        AND t.deleted_at IS NULL
    `;
    const queryParams: Array<string | number> = [userId];
    let idx = 2;

    if (params.status) {
      query += ` AND t.status = $${idx}`;
      queryParams.push(params.status);
      idx++;
    }
    if (params.priority) {
      query += ` AND t.priority = $${idx}`;
      queryParams.push(params.priority);
      idx++;
    }

    query += ` ORDER BY t.due_date ASC NULLS LAST, t.created_at DESC LIMIT $${idx}`;
    queryParams.push(limit);

    const result = await pool.query(query, queryParams);

    if (result.rows.length === 0) {
      return { result: "No assigned org tasks found matching those filters." };
    }

    return {
      result: result.rows.map((t) => ({
        id: t.id,
        title: t.title,
        status: t.status,
        priority: t.priority,
        due_date: t.due_date ?? null,
        org: t.org_name,
        space: t.space_name,
      })),
    };
  },
});

// ─── Tool: summarise_my_workload ──────────────────────────────────────────────
// No parameters — ADK types `input` as `string` when parameters is undefined.
// We don't use it, so it's typed as `_input: string` and ignored.

const summariseWorkloadTool = new FunctionTool({
  name: "summarise_my_workload",
  description:
    "Return a count breakdown of tasks by status for the current user (personal + org). Use this when the user asks for a summary, overview, or dashboard of their work.",
  execute: async (_input: string, toolContext?: { userId: string }) => {
    const userId = toolContext?.userId;
    if (!userId) return { error: "No user context available." };

    const [personal, org] = await Promise.all([
      pool.query(
        `SELECT status, COUNT(*) AS count
         FROM public.personal_tasks
         WHERE owner_user_id = $1 AND deleted_at IS NULL
         GROUP BY status`,
        [userId]
      ),
      pool.query(
        `SELECT t.status, COUNT(*) AS count
         FROM public.tasks t
         JOIN public.task_assignees ta ON ta.task_id = t.id
         WHERE ta.user_id = $1 AND t.deleted_at IS NULL
         GROUP BY t.status`,
        [userId]
      ),
    ]);

    const toMap = (rows: { status: string; count: string }[]) =>
      rows.reduce(
        (acc, r) => ({ ...acc, [r.status]: parseInt(r.count, 10) }),
        {} as Record<string, number>
      );

    return {
      result: {
        personal_tasks: toMap(personal.rows),
        org_tasks: toMap(org.rows),
      },
    };
  },
});

// ─── Tool: create_personal_task ───────────────────────────────────────────────

const createTaskParams: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: "Short descriptive title for the task.",
    },
    description: {
      type: Type.STRING,
      description: "Longer description or notes. Optional.",
      nullable: true,
    },
    priority: {
      type: Type.STRING,
      enum: Object.values(TaskPriority),
      description: "Task priority. Defaults to medium.",
      nullable: true,
    },
    due_date: {
      type: Type.STRING,
      description: "Due date in ISO 8601 format (e.g. 2025-06-15). Optional.",
      nullable: true,
    },
  },
  required: ["title"],
};

const createPersonalTaskTool = new FunctionTool({
  name: "create_personal_task",
  description:
    "Create a new personal task for the current user. Use this when the user explicitly asks to add, create, or schedule a task or reminder.",
  parameters: createTaskParams,
  execute: async (input: unknown, toolContext?: { userId: string }) => {
    const params = input as {
      title: string;
      description?: string;
      priority?: TaskPriority;
      due_date?: string;
    };
    const userId = toolContext?.userId;
    if (!userId) return { error: "No user context available." };

    const result = await pool.query(
      `INSERT INTO public.personal_tasks
         (owner_user_id, title, description, priority, status, due_date)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, title, status, priority, due_date`,
      [
        userId,
        params.title,
        params.description ?? null,
        params.priority ?? TaskPriority.MEDIUM,
        TaskStatus.TODO,
        params.due_date ? new Date(params.due_date) : null,
      ]
    );

    return { result: result.rows[0] };
  },
});

// ─── Tool: get_my_orgs_and_spaces ────────────────────────────────────────────

const getMyOrgsAndSpacesTool = new FunctionTool({
  name: "get_my_orgs_and_spaces",
  description:
    "List all organisations and their spaces the current user belongs to. Use this when the user asks about their teams, organisations, or workspaces.",
  execute: async (_input: string, toolContext?: { userId: string }) => {
    const userId = toolContext?.userId;
    if (!userId) return { error: "No user context available." };

    const result = await pool.query(
      `SELECT
         o.id    AS org_id,
         o.name  AS org_name,
         s.id    AS space_id,
         s.name  AS space_name,
         om.role AS role
       FROM public.organisation_members om
       JOIN public.organisations o ON o.id = om.org_id
       JOIN public.spaces s        ON s.org_id = o.id AND s.deleted_at IS NULL
       WHERE om.user_id = $1
         AND o.deleted_at IS NULL
       ORDER BY o.created_at ASC, s.created_at ASC`,
      [userId]
    );

    if (result.rows.length === 0) {
      return { result: "You are not a member of any organisation yet." };
    }

    const orgs: Record<
      string,
      { name: string; role: string; spaces: { id: string; name: string }[] }
    > = {};
    for (const row of result.rows) {
      if (!orgs[row.org_id]) {
        orgs[row.org_id] = { name: row.org_name, role: row.role, spaces: [] };
      }
      orgs[row.org_id].spaces.push({ id: row.space_id, name: row.space_name });
    }

    return {
      result: Object.entries(orgs).map(([id, o]) => ({ id, ...o })),
    };
  },
});

// ─── Agent + Runner (singletons) ─────────────────────────────────────────────

let _agent: LlmAgent | null = null;
let _runner: Runner | null = null;

function getAgent(): LlmAgent {
  if (_agent) return _agent;

  if (!config.googleAdkApiKey) {
    throw new ApiError(500, "GOOGLE_ADK_API_KEY is not configured");
  }

  const model = new Gemini({
    model: config.googleAdkModel,
    apiKey: config.googleAdkApiKey,
  });

  _agent = new LlmAgent({
    name: "keilhq_assistant",
    model,
    description:
      "KeilHQ AI — a smart work assistant for tasks, teams, and projects.",
    instruction: `You are KeilHQ AI, a concise and practical work assistant embedded in a productivity app.
You have access to the user's personal tasks, org tasks, and workspace structure via tools.
Always be direct. When asked about tasks or workload, call the relevant tool to fetch real data — never make up task details.
When creating a task, confirm the details back to the user after creation.
Format lists clearly. Keep responses short unless the user asks for detail.`,
    tools: [
      getMyPersonalTasksTool,
      getMyOrgTasksTool,
      summariseWorkloadTool,
      createPersonalTaskTool,
      getMyOrgsAndSpacesTool,
    ],
  });

  return _agent;
}

function getRunner(): Runner {
  if (_runner) return _runner;

  _runner = new Runner({
    appName: "keilhq",
    agent: getAgent(),
    sessionService,
  });

  return _runner;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toContent(text: string): Content {
  return { role: "user", parts: [{ text }] };
}

/**
 * Drain the runner's async-generator and return the last text chunk
 * produced by the agent. Function-call / function-response events are skipped.
 */
async function collectFinalText(
  stream: AsyncGenerator<{ content?: Content }, void, undefined>
): Promise<string> {
  let finalText = "";

  for await (const event of stream) {
    if (event.content?.parts) {
      const textParts = event.content.parts
        .filter((p: { text?: string }) => typeof p.text === "string")
        .map((p: { text?: string }) => p.text as string);

      if (textParts.length > 0) {
        finalText = textParts.join("");
      }
    }
  }

  if (!finalText) {
    throw new ApiError(500, "ADK agent returned no text response");
  }

  return finalText;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Run the ADK agent for a given user message.
 *
 * @param userId    - Authenticated user's UUID. The tools read this from
 *                    `toolContext.userId` to scope DB queries to that user.
 * @param message   - The user's latest message.
 * @param sessionId - Pass the sessionId from the previous response to continue
 *                    a multi-turn conversation. Omit on the first turn.
 */
export const runAdkAgent = async (
  userId: string,
  message: string,
  sessionId?: string
): Promise<AdkChatReply> => {
  if (!config.googleAdkApiKey) {
    throw new ApiError(500, "GOOGLE_ADK_API_KEY is not configured");
  }

  if (!message.trim()) {
    throw new ApiError(400, "Message cannot be empty");
  }

  const runner = getRunner();
  const newMessage = toContent(message);

  // On first turn, create a session so we have an ID to return to the client.
  // On subsequent turns, reuse the existing session.
  const resolvedSessionId =
    sessionId ??
    (
      await sessionService.createSession({ appName: "keilhq", userId })
    ).id;

  const stream = runner.runAsync({
    userId,
    sessionId: resolvedSessionId,
    newMessage,
  }) as AsyncGenerator<{ content?: Content }, void, undefined>;

  const content = await collectFinalText(stream);

  return { content, sessionId: resolvedSessionId };
};