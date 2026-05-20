import {
  LlmAgent,
  Runner,
  InMemorySessionService,
  type Tool,
} from "@google/adk";
import pool from "../config/pg";
import { config } from "../config";
import { ApiError } from "../utils/ApiError";
import { personalTaskRepository } from "../repositories";
import { TaskStatus, TaskPriority } from "../types/enums";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AdkChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface AdkChatReply {
  content: string;
  sessionId: string;
}

// ─── Session service (in-memory; swap for DB-backed in production) ────────────
const sessionService = new InMemorySessionService();

// ─── Tool: get_my_personal_tasks ─────────────────────────────────────────────
// Fetches the authenticated user's personal tasks, with optional filters.

const getMyPersonalTasksTool: Tool = {
  name: "get_my_personal_tasks",
  description:
    "Fetch the current user's personal tasks. Use this when the user asks about their tasks, todos, work items, or what they need to do.",
  parameters: {
    type: "object",
    properties: {
      status: {
        type: "string",
        enum: Object.values(TaskStatus),
        description: "Filter tasks by status. Optional.",
      },
      priority: {
        type: "string",
        enum: Object.values(TaskPriority),
        description: "Filter tasks by priority. Optional.",
      },
      limit: {
        type: "number",
        description: "Max number of tasks to return. Defaults to 10.",
      },
    },
    required: [],
  },
  execute: async (
    params: { status?: string; priority?: string; limit?: number },
    context: { userId: string }
  ) => {
    const tasks = await personalTaskRepository.findByOwner(context.userId, {
      filters: {
        ...(params.status && { status: params.status as TaskStatus }),
        ...(params.priority && { priority: params.priority as TaskPriority }),
        parentTaskId: null, // top-level only to keep the list clean
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
};

// ─── Tool: get_my_org_tasks ───────────────────────────────────────────────────
// Fetches tasks assigned to the user across all orgs and spaces they belong to.

const getMyOrgTasksTool: Tool = {
  name: "get_my_org_tasks",
  description:
    "Fetch tasks assigned to the current user inside their organisations and spaces. Use this when asking about team tasks, assigned work, or sprint items.",
  parameters: {
    type: "object",
    properties: {
      status: {
        type: "string",
        enum: Object.values(TaskStatus),
        description: "Filter tasks by status. Optional.",
      },
      priority: {
        type: "string",
        enum: Object.values(TaskPriority),
        description: "Filter tasks by priority. Optional.",
      },
      limit: {
        type: "number",
        description: "Max number of tasks to return. Defaults to 10.",
      },
    },
    required: [],
  },
  execute: async (
    params: { status?: string; priority?: string; limit?: number },
    context: { userId: string }
  ) => {
    const limit = params.limit ?? 10;

    let query = `
      SELECT
        t.id,
        t.title,
        t.status,
        t.priority,
        t.due_date,
        o.name AS org_name,
        s.name AS space_name
      FROM public.tasks t
      JOIN public.task_assignees ta ON ta.task_id = t.id
      JOIN public.spaces s ON s.id = t.space_id
      JOIN public.organisations o ON o.id = t.org_id
      WHERE ta.user_id = $1
        AND t.deleted_at IS NULL
    `;
    const queryParams: Array<string | number> = [context.userId];
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
};

// ─── Tool: summarise_my_workload ──────────────────────────────────────────────
// Gives a high-level count breakdown so the agent can answer "how am I doing?" queries.

const summariseWorkloadTool: Tool = {
  name: "summarise_my_workload",
  description:
    "Return a quick count of tasks by status for the current user (both personal and org tasks). Use this when the user asks for a summary, overview, or dashboard of their work.",
  parameters: {
    type: "object",
    properties: {},
    required: [],
  },
  execute: async (_params: Record<string, never>, context: { userId: string }) => {
    const [personal, org] = await Promise.all([
      pool.query(
        `
          SELECT status, COUNT(*) AS count
          FROM public.personal_tasks
          WHERE owner_user_id = $1 AND deleted_at IS NULL
          GROUP BY status
        `,
        [context.userId]
      ),
      pool.query(
        `
          SELECT t.status, COUNT(*) AS count
          FROM public.tasks t
          JOIN public.task_assignees ta ON ta.task_id = t.id
          WHERE ta.user_id = $1 AND t.deleted_at IS NULL
          GROUP BY t.status
        `,
        [context.userId]
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
};

// ─── Tool: create_personal_task ───────────────────────────────────────────────

const createPersonalTaskTool: Tool = {
  name: "create_personal_task",
  description:
    "Create a new personal task for the current user. Use this when the user explicitly asks to create, add, or schedule a task or reminder for themselves.",
  parameters: {
    type: "object",
    properties: {
      title: {
        type: "string",
        description: "Short descriptive title for the task.",
      },
      description: {
        type: "string",
        description: "Longer description or notes. Optional.",
      },
      priority: {
        type: "string",
        enum: Object.values(TaskPriority),
        description: "Task priority. Defaults to medium.",
      },
      due_date: {
        type: "string",
        description: "Due date in ISO 8601 format (e.g. 2025-06-15). Optional.",
      },
    },
    required: ["title"],
  },
  execute: async (
    params: {
      title: string;
      description?: string;
      priority?: TaskPriority;
      due_date?: string;
    },
    context: { userId: string }
  ) => {
    const result = await pool.query(
      `
        INSERT INTO public.personal_tasks
          (owner_user_id, title, description, priority, status, due_date)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, title, status, priority, due_date
      `,
      [
        context.userId,
        params.title,
        params.description ?? null,
        params.priority ?? TaskPriority.MEDIUM,
        TaskStatus.TODO,
        params.due_date ? new Date(params.due_date) : null,
      ]
    );

    return { result: result.rows[0] };
  },
};

// ─── Tool: get_my_orgs_and_spaces ────────────────────────────────────────────

const getMyOrgsAndSpacesTool: Tool = {
  name: "get_my_orgs_and_spaces",
  description:
    "List all organisations and their spaces that the current user is a member of. Use this when the user asks about their teams, organisations, or workspaces.",
  parameters: {
    type: "object",
    properties: {},
    required: [],
  },
  execute: async (_params: Record<string, never>, context: { userId: string }) => {
    const result = await pool.query(
      `
        SELECT
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
        ORDER BY o.created_at ASC, s.created_at ASC
      `,
      [context.userId]
    );

    if (result.rows.length === 0) {
      return { result: "You are not a member of any organisation yet." };
    }

    // Group spaces under their org
    const orgs: Record<string, { name: string; role: string; spaces: { id: string; name: string }[] }> = {};
    for (const row of result.rows) {
      if (!orgs[row.org_id]) {
        orgs[row.org_id] = { name: row.org_name, role: row.role, spaces: [] };
      }
      orgs[row.org_id].spaces.push({ id: row.space_id, name: row.space_name });
    }

    return { result: Object.entries(orgs).map(([id, o]) => ({ id, ...o })) };
  },
};

// ─── Agent factory ────────────────────────────────────────────────────────────
// We build the agent once and reuse it — it's stateless, state lives in sessionService.

let _agent: LlmAgent | null = null;

function getAgent(): LlmAgent {
  if (_agent) return _agent;

  if (!config.googleAdkApiKey) {
    throw new ApiError(500, "GOOGLE_ADK_API_KEY is not configured");
  }

  _agent = new LlmAgent({
    name: "keilhq_assistant",
    model: config.googleAdkModel,
    apiKey: config.googleAdkApiKey,
    description:
      "KeilHQ AI — a smart work assistant embedded in a productivity app for tasks, teams, and projects.",
    instruction: `You are KeilHQ AI, a concise and practical work assistant.
You have access to the user's personal tasks, org tasks, and workspace structure.
Always be direct. When asked about tasks or workload, use the available tools to fetch real data — never make up task details.
When creating tasks, confirm the details back to the user after creation.
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

// ─── Runner factory ───────────────────────────────────────────────────────────

let _runner: Runner | null = null;

function getRunner(): Runner {
  if (_runner) return _runner;
  _runner = new Runner({ agent: getAgent(), sessionService });
  return _runner;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Run the ADK agent with the user's message.
 *
 * @param userId     - The authenticated user's UUID (used for tool context + session isolation).
 * @param message    - The latest user message.
 * @param sessionId  - Optional: pass a persistent session ID for multi-turn conversations.
 *                     Omit on the first turn to auto-generate one.
 * @returns          - The agent's text reply and the session ID to send back to the client.
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

  // Create or resume a session scoped to this user
  const resolvedSessionId = sessionId ?? `${userId}-${Date.now()}`;

  const response = await runner.run({
    sessionId: resolvedSessionId,
    userId,
    message,
    // Inject userId into tool execution context so tools can query the DB for this user
    context: { userId },
  });

  return {
    content: response.text,
    sessionId: resolvedSessionId,
  };
};
