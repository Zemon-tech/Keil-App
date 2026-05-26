import { Agent } from "@mastra/core/agent";
import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import pool from "../config/pg";
import * as personalTaskService from "../services/personal-task.service";
import * as orgTaskService from "../services/org-task.service";
import { TaskStatus, TaskPriority } from "../types/enums";
import { getModel } from "./index";

// ─── RBAC helpers ─────────────────────────────────────────────────────────────

async function getSpaceRole(
  userId: string,
  orgId: string,
  spaceId: string
): Promise<string | null> {
  const result = await pool.query(
    `SELECT role FROM public.space_members
     WHERE org_id = $1 AND space_id = $2 AND user_id = $3 LIMIT 1`,
    [orgId, spaceId, userId]
  );
  return result.rows[0]?.role ?? null;
}

async function isAssignedToTask(taskId: string, userId: string): Promise<boolean> {
  const result = await pool.query(
    `SELECT 1 FROM public.task_assignees WHERE task_id = $1 AND user_id = $2`,
    [taskId, userId]
  );
  return (result.rowCount ?? 0) > 0;
}

// ─── Shared zod helpers ───────────────────────────────────────────────────────

const statusEnum = z
  .enum([TaskStatus.BACKLOG, TaskStatus.TODO, TaskStatus.IN_PROGRESS,
         TaskStatus.DONE, TaskStatus.CANCELLED, TaskStatus.COMPLETED])
  .optional()
  .describe("Task status");

const priorityEnum = z
  .enum([TaskPriority.LOW, TaskPriority.MEDIUM, TaskPriority.HIGH, TaskPriority.URGENT])
  .optional()
  .describe("Task priority");

// ─── Tool 1: get_personal_tasks ───────────────────────────────────────────────

export const getPersonalTasksTool = createTool({
  id: "get_personal_tasks",
  description: "List the current user's personal tasks. Optionally filter by status, priority, or limit.",
  inputSchema: z.object({
    status: statusEnum,
    priority: priorityEnum,
    limit: z.number().int().min(1).max(50).optional().default(10),
  }),
  execute: async ({ context: input }, options) => {
    const userId = options?.requestContext?.get("userId") as string;
    if (!userId) return { error: "Not authenticated." };

    const tasks = await personalTaskService.getPersonalTasks(userId, {
      filters: {
        status: input.status as TaskStatus | undefined,
        priority: input.priority as TaskPriority | undefined,
      },
      pagination: { limit: input.limit ?? 10, offset: 0 },
    });

    return { tasks, count: tasks.length };
  },
});

// ─── Tool 2: get_personal_task ────────────────────────────────────────────────

export const getPersonalTaskTool = createTool({
  id: "get_personal_task",
  description: "Get a single personal task by its ID.",
  inputSchema: z.object({
    taskId: z.string().uuid().describe("The task's UUID"),
  }),
  execute: async ({ context: input }, options) => {
    const userId = options?.requestContext?.get("userId") as string;
    if (!userId) return { error: "Not authenticated." };

    const task = await personalTaskService.getPersonalTaskById(input.taskId, userId);
    if (!task) return { error: "Task not found or you do not own it." };

    return { task };
  },
});

// ─── Tool 3: create_personal_task ────────────────────────────────────────────

export const createPersonalTaskTool = createTool({
  id: "create_personal_task",
  description: "Create a new personal task for the current user.",
  inputSchema: z.object({
    title: z.string().min(1).describe("Task title"),
    description: z.string().optional(),
    priority: priorityEnum,
    status: statusEnum,
    start_date: z.string().optional().describe("ISO 8601 date, e.g. 2025-06-01"),
    due_date: z.string().optional().describe("ISO 8601 date, e.g. 2025-06-15"),
  }),
  execute: async ({ context: input }, options) => {
    const userId = options?.requestContext?.get("userId") as string;
    if (!userId) return { error: "Not authenticated." };

    const task = await personalTaskService.createPersonalTask({
      owner_user_id: userId,
      title: input.title,
      description: input.description ?? null,
      priority: input.priority as TaskPriority | undefined,
      status: input.status as TaskStatus | undefined,
      start_date: input.start_date ? new Date(input.start_date) : null,
      due_date: input.due_date ? new Date(input.due_date) : null,
    });

    return { task, message: `Personal task "${task.title}" created.` };
  },
});

// ─── Tool 4: update_personal_task ────────────────────────────────────────────

export const updatePersonalTaskTool = createTool({
  id: "update_personal_task",
  description: "Update an existing personal task.",
  inputSchema: z.object({
    taskId: z.string().uuid(),
    title: z.string().optional(),
    description: z.string().nullable().optional(),
    priority: priorityEnum,
    status: statusEnum,
    start_date: z.string().nullable().optional(),
    due_date: z.string().nullable().optional(),
  }),
  execute: async ({ context: input }, options) => {
    const userId = options?.requestContext?.get("userId") as string;
    if (!userId) return { error: "Not authenticated." };

    const { taskId, ...rest } = input;
    const updated = await personalTaskService.updatePersonalTask(taskId, userId, {
      title: rest.title,
      description: rest.description,
      priority: rest.priority as TaskPriority | undefined,
      status: rest.status as TaskStatus | undefined,
      start_date: rest.start_date !== undefined
        ? rest.start_date ? new Date(rest.start_date) : null
        : undefined,
      due_date: rest.due_date !== undefined
        ? rest.due_date ? new Date(rest.due_date) : null
        : undefined,
    });

    if (!updated) return { error: "Task not found or you do not own it." };
    return { task: updated, message: `Task "${updated.title}" updated.` };
  },
});

// ─── Tool 5: delete_personal_task ────────────────────────────────────────────

export const deletePersonalTaskTool = createTool({
  id: "delete_personal_task",
  description: "Permanently delete a personal task.",
  inputSchema: z.object({
    taskId: z.string().uuid(),
  }),
  execute: async ({ context: input }, options) => {
    const userId = options?.requestContext?.get("userId") as string;
    if (!userId) return { error: "Not authenticated." };

    const deleted = await personalTaskService.deletePersonalTask(input.taskId, userId);
    if (!deleted) return { error: "Task not found or you do not own it." };

    return { message: "Personal task deleted successfully." };
  },
});

// ─── Tool 6: get_org_tasks ────────────────────────────────────────────────────

export const getOrgTasksTool = createTool({
  id: "get_org_tasks",
  description: "List tasks in the current organisation space. Optionally filter by status, priority, or assignee.",
  inputSchema: z.object({
    status: statusEnum,
    priority: priorityEnum,
    assigneeId: z.string().uuid().optional().describe("Filter by assignee user ID"),
    limit: z.number().int().min(1).max(50).optional().default(20),
  }),
  execute: async ({ context: input }, options) => {
    const userId  = options?.requestContext?.get("userId")  as string;
    const orgId   = options?.requestContext?.get("orgId")   as string;
    const spaceId = options?.requestContext?.get("spaceId") as string;

    if (!userId || !orgId || !spaceId) return { error: "Missing org or space context." };

    const role = await getSpaceRole(userId, orgId, spaceId);
    if (!role) return { error: "You are not a member of this space." };

    const tasks = await orgTaskService.getTasksBySpace(orgId, spaceId, {
      filters: {
        status: input.status as TaskStatus | undefined,
        priority: input.priority as TaskPriority | undefined,
        assigneeId: input.assigneeId,
      },
      pagination: { limit: input.limit ?? 20, offset: 0 },
    });

    return { tasks, count: tasks.length };
  },
});

// ─── Tool 7: get_org_task ─────────────────────────────────────────────────────

export const getOrgTaskTool = createTool({
  id: "get_org_task",
  description: "Get a single org task by ID, including assignees and dependencies.",
  inputSchema: z.object({
    taskId: z.string().uuid(),
  }),
  execute: async ({ context: input }, options) => {
    const userId  = options?.requestContext?.get("userId")  as string;
    const orgId   = options?.requestContext?.get("orgId")   as string;
    const spaceId = options?.requestContext?.get("spaceId") as string;

    if (!userId || !orgId || !spaceId) return { error: "Missing org or space context." };

    const role = await getSpaceRole(userId, orgId, spaceId);
    if (!role) return { error: "You are not a member of this space." };

    const task = await orgTaskService.getTaskById(input.taskId);
    if (!task) return { error: "Task not found." };

    return { task };
  },
});

// ─── Tool 8: create_org_task ──────────────────────────────────────────────────

export const createOrgTaskTool = createTool({
  id: "create_org_task",
  description: "Create a new task in the current organisation space.",
  inputSchema: z.object({
    title: z.string().min(1),
    description: z.string().optional(),
    priority: priorityEnum,
    status: statusEnum,
    type: z.enum(["task", "event"]).optional().default("task"),
    start_date: z.string().optional(),
    due_date: z.string().optional(),
    assignee_ids: z.array(z.string().uuid()).optional(),
  }),
  execute: async ({ context: input }, options) => {
    const userId  = options?.requestContext?.get("userId")  as string;
    const orgId   = options?.requestContext?.get("orgId")   as string;
    const spaceId = options?.requestContext?.get("spaceId") as string;

    if (!userId || !orgId || !spaceId) return { error: "Missing org or space context." };

    const role = await getSpaceRole(userId, orgId, spaceId);
    if (!role) return { error: "You are not a member of this space." };

    if (role === "member" && input.assignee_ids?.length) {
      const onlySelf = input.assignee_ids.length === 1 && input.assignee_ids[0] === userId;
      if (!onlySelf) return { error: "Members can only assign tasks to themselves." };
    }

    const task = await orgTaskService.createTask(
      { orgId, spaceId },
      {
        org_id: orgId,
        space_id: spaceId,
        title: input.title,
        description: input.description ?? null,
        priority: input.priority as TaskPriority | undefined,
        status: input.status as TaskStatus | undefined,
        type: input.type as "task" | "event" | undefined,
        start_date: input.start_date ? new Date(input.start_date) : null,
        due_date: input.due_date ? new Date(input.due_date) : null,
        assignee_ids: input.assignee_ids,
        created_by: userId,
      }
    );

    return { task, message: `Org task "${task.title}" created.` };
  },
});

// ─── Tool 9: update_org_task ──────────────────────────────────────────────────

export const updateOrgTaskTool = createTool({
  id: "update_org_task",
  description: "Update an existing task in the current organisation space.",
  inputSchema: z.object({
    taskId: z.string().uuid(),
    title: z.string().optional(),
    description: z.string().nullable().optional(),
    priority: priorityEnum,
    status: statusEnum,
    start_date: z.string().nullable().optional(),
    due_date: z.string().nullable().optional(),
  }),
  execute: async ({ context: input }, options) => {
    const userId  = options?.requestContext?.get("userId")  as string;
    const orgId   = options?.requestContext?.get("orgId")   as string;
    const spaceId = options?.requestContext?.get("spaceId") as string;

    if (!userId || !orgId || !spaceId) return { error: "Missing org or space context." };

    const role = await getSpaceRole(userId, orgId, spaceId);
    if (!role) return { error: "You are not a member of this space." };

    if (role === "member") {
      const assigned = await isAssignedToTask(input.taskId, userId);
      if (!assigned) return { error: "You can only update tasks assigned to you." };
    }

    const { taskId, ...rest } = input;
    const updated = await orgTaskService.updateTask(
      { orgId, spaceId },
      taskId,
      userId,
      {
        title: rest.title,
        description: rest.description,
        priority: rest.priority as TaskPriority | undefined,
        status: rest.status as TaskStatus | undefined,
        start_date: rest.start_date !== undefined
          ? rest.start_date ? new Date(rest.start_date) : null
          : undefined,
        due_date: rest.due_date !== undefined
          ? rest.due_date ? new Date(rest.due_date) : null
          : undefined,
      }
    );

    if (!updated) return { error: "Task not found." };
    return { task: updated, message: `Task "${updated.title}" updated.` };
  },
});

// ─── Tool 10: delete_org_task ─────────────────────────────────────────────────

export const deleteOrgTaskTool = createTool({
  id: "delete_org_task",
  description: "Delete a task from the current organisation space.",
  inputSchema: z.object({
    taskId: z.string().uuid(),
  }),
  execute: async ({ context: input }, options) => {
    const userId  = options?.requestContext?.get("userId")  as string;
    const orgId   = options?.requestContext?.get("orgId")   as string;
    const spaceId = options?.requestContext?.get("spaceId") as string;

    if (!userId || !orgId || !spaceId) return { error: "Missing org or space context." };

    const role = await getSpaceRole(userId, orgId, spaceId);
    if (!role) return { error: "You are not a member of this space." };

    if (role === "member") {
      const assigned = await isAssignedToTask(input.taskId, userId);
      if (!assigned) return { error: "You can only delete tasks assigned to you." };
    }

    await orgTaskService.deleteTask({ orgId, spaceId }, input.taskId, userId);
    return { message: "Org task deleted successfully." };
  },
});

// ─── Task Agent ───────────────────────────────────────────────────────────────

export const taskAgent = new Agent({
  id: "keilhq-task-agent",
  name: "keilhq-task-agent",
  instructions: `You are the KeilHQ Task Agent. You manage personal and organisation tasks.

Always call tools for real data — never fabricate task details.
Confirm every create/update/delete action back to the user.
For org tasks, space role rules apply (enforced automatically by each tool):
  - admin / manager: full CRUD on all tasks
  - member: view all tasks, but edit/delete only their assigned tasks

Format task lists with title, status, priority, and due date.
Present dates in human-readable format (e.g. "June 15, 2025").`,
  model: getModel(),
  tools: {
    get_personal_tasks: getPersonalTasksTool,
    get_personal_task: getPersonalTaskTool,
    create_personal_task: createPersonalTaskTool,
    update_personal_task: updatePersonalTaskTool,
    delete_personal_task: deletePersonalTaskTool,
    get_org_tasks: getOrgTasksTool,
    get_org_task: getOrgTaskTool,
    create_org_task: createOrgTaskTool,
    update_org_task: updateOrgTaskTool,
    delete_org_task: deleteOrgTaskTool,
  },
});