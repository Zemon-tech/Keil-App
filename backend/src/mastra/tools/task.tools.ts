import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import pool from "../../config/pg";
import * as orgTaskService from "../../services/org-task.service";
import { TaskStatus, TaskPriority } from "../../types/enums";

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
  .describe("Optional filter: only include tasks with this status. Omit to return tasks of ALL statuses.");

const priorityEnum = z
  .enum([TaskPriority.LOW, TaskPriority.MEDIUM, TaskPriority.HIGH, TaskPriority.URGENT])
  .optional()
  .describe("Optional filter: only include tasks with this priority. Omit to return tasks of ALL priorities.");

// ─── Personal org/space resolver ──────────────────────────────────────────────

async function getPersonalOrgSpace(userId: string): Promise<{ orgId: string; spaceId: string } | null> {
  const result = await pool.query(
    `SELECT o.id as org_id, s.id as space_id
     FROM public.organisations o
     INNER JOIN public.spaces s ON s.org_id = o.id AND s.is_private = TRUE AND s.deleted_at IS NULL
     WHERE o.owner_user_id = $1 AND o.is_personal = TRUE AND o.deleted_at IS NULL
     LIMIT 1`,
    [userId]
  );
  if (result.rows.length === 0) return null;
  return { orgId: result.rows[0].org_id, spaceId: result.rows[0].space_id };
}

// ─── Tool: search_tasks ───────────────────────────────────────────────────────

export const searchTasksTool = createTool({
  id: "search_tasks",
  description: "Search for tasks by keyword fuzzy matching. Searches across title, description, objectives, and success criteria in both personal and org tasks. Returns matching task summaries.",
  inputSchema: z.object({
    query: z.string().min(1).describe("The fuzzy keyword search query (e.g. 'AWS')"),
    limit: z.number().int().min(1).max(20).optional().default(5),
  }),
  execute: async (inputData, context) => {
    const userId = context?.requestContext?.get("userId") as string;
    if (!userId) return { error: "Not authenticated." };

    const searchPattern = `%${inputData.query.replace(/%/g, "\\%").replace(/_/g, "\\_")}%`;

    const result = await pool.query(
      `SELECT DISTINCT t.id, t.title, t.status, t.priority, t.due_date, t.start_date, t.type,
              t.org_id, t.space_id, o.name as org_name, s.name as space_name,
              CASE
                WHEN t.title ILIKE $2 THEN 1
                WHEN t.title ILIKE $3 THEN 2
                ELSE 3
              END as relevance
       FROM public.tasks t
       LEFT JOIN public.organisations o ON o.id = t.org_id
       LEFT JOIN public.spaces s ON s.id = t.space_id
       WHERE t.deleted_at IS NULL
         AND (
           t.title ILIKE $3
           OR t.description ILIKE $3
           OR t.objective ILIKE $3
           OR t.success_criteria ILIKE $3
         )
         AND (
           t.created_by = $1
           OR t.id IN (SELECT task_id FROM public.task_assignees WHERE user_id = $1)
           OR t.space_id IN (SELECT space_id FROM public.space_members WHERE user_id = $1)
         )
       ORDER BY relevance ASC, t.updated_at DESC
       LIMIT $4`,
      [userId, inputData.query, searchPattern, inputData.limit ?? 5]
    );

    const summaryTasks = result.rows.map((t: any) => ({
      id: t.id,
      title: t.title,
      status: t.status,
      priority: t.priority,
      start_date: t.start_date,
      due_date: t.due_date,
      type: t.type,
      org_name: t.org_name,
      space_name: t.space_name,
      org_id: t.org_id,
      space_id: t.space_id,
    }));

    return {
      activity: {
        agent: "keilhq-task-agent",
        action: `Searching tasks for "${inputData.query}"`,
        details: `Found ${summaryTasks.length} matching task(s)`,
        tool: "search_tasks"
      },
      tasks: summaryTasks,
      count: summaryTasks.length
    };
  },
});

// ─── Tool: get_personal_tasks ─────────────────────────────────────────────────

export const getPersonalTasksTool = createTool({
  id: "get_personal_tasks",
  description: "List the current user's personal tasks (tasks in their personal org's private space). Returns summarized payloads. Only pass status or priority if the user explicitly asks to filter.",
  inputSchema: z.object({
    status: statusEnum,
    priority: priorityEnum,
    limit: z.number().int().min(1).max(50).optional().default(10),
  }),
  execute: async (inputData, context) => {
    const userId = context?.requestContext?.get("userId") as string;
    if (!userId) return { error: "Not authenticated." };

    const personal = await getPersonalOrgSpace(userId);
    if (!personal) return { error: "Personal organisation not found." };

    const tasks = await orgTaskService.getTasksBySpace(personal.orgId, personal.spaceId, {
      filters: {
        status: inputData.status as TaskStatus | undefined,
        priority: inputData.priority as TaskPriority | undefined,
      },
      pagination: { limit: inputData.limit ?? 10, offset: 0 },
    });

    const summaryTasks = tasks.map((t: any) => ({
      id: t.id,
      title: t.title,
      status: t.status,
      priority: t.priority,
      start_date: t.start_date,
      due_date: t.due_date,
      type: t.type,
      org_id: t.org_id,
      space_id: t.space_id,
    }));

    return {
      activity: {
        agent: "keilhq-task-agent",
        action: "Listing personal tasks",
        details: `Fetched ${summaryTasks.length} task(s) from personal backlog/todo`,
        tool: "get_personal_tasks"
      },
      tasks: summaryTasks,
      count: summaryTasks.length
    };
  },
});

// ─── Tool: get_personal_task ──────────────────────────────────────────────────

export const getPersonalTaskTool = createTool({
  id: "get_personal_task",
  description: "Get a single personal task by its ID.",
  inputSchema: z.object({
    taskId: z.string().uuid().describe("The task's UUID"),
  }),
  execute: async (inputData, context) => {
    const userId = context?.requestContext?.get("userId") as string;
    if (!userId) return { error: "Not authenticated." };

    const personal = await getPersonalOrgSpace(userId);
    if (!personal) return { error: "Personal organisation not found." };

    const task = await orgTaskService.getTaskById(inputData.taskId);
    if (!task) return { error: "Task not found." };
    // Verify it belongs to the user's personal space
    if (task.org_id !== personal.orgId || task.space_id !== personal.spaceId) {
      return { error: "Task not found or you do not own it." };
    }

    return {
      activity: {
        agent: "keilhq-task-agent",
        action: `Reading personal task "${task.title}"`,
        details: `Fetched full details for personal task`,
        tool: "get_personal_task"
      },
      task
    };
  },
});

// ─── Tool: create_personal_task ───────────────────────────────────────────────

export const createPersonalTaskTool = createTool({
  id: "create_personal_task",
  description: "Create a new personal task or event for the current user.",
  inputSchema: z.object({
    title: z.string().min(1).describe("Task title"),
    description: z.string().optional(),
    priority: priorityEnum,
    status: statusEnum,
    type: z.enum(["task", "event"]).optional().default("task"),
    event_type: z.enum(["meeting", "call", "personal", "reminder", "other"]).optional(),
    location: z.string().optional(),
    is_all_day: z.boolean().optional(),
    meet_link: z.string().optional(),
    start_date: z.string().optional().describe("ISO 8601 date, e.g. 2025-06-01"),
    due_date: z.string().optional().describe("ISO 8601 date, e.g. 2025-06-15"),
  }),
  execute: async (inputData, context) => {
    const userId = context?.requestContext?.get("userId") as string;
    if (!userId) return { error: "Not authenticated." };

    const personal = await getPersonalOrgSpace(userId);
    if (!personal) return { error: "Personal organisation not found." };

    const task = await orgTaskService.createTask(
      { orgId: personal.orgId, spaceId: personal.spaceId },
      {
        org_id: personal.orgId,
        space_id: personal.spaceId,
        title: inputData.title,
        description: inputData.description ?? null,
        priority: inputData.priority as TaskPriority | undefined,
        status: inputData.status as TaskStatus | undefined,
        type: inputData.type as "task" | "event" | undefined,
        event_type: inputData.event_type,
        location: inputData.location ?? null,
        is_all_day: inputData.is_all_day ?? false,
        meet_link: inputData.meet_link ?? null,
        start_date: inputData.start_date ? new Date(inputData.start_date) : null,
        due_date: inputData.due_date ? new Date(inputData.due_date) : null,
        assignee_ids: [userId],
        created_by: userId,
      }
    );

    return {
      activity: {
        agent: "keilhq-task-agent",
        action: `Creating personal task/event "${inputData.title}"`,
        details: `Task ID: ${task.id}. Status: ${task.status}`,
        tool: "create_personal_task"
      },
      task,
      message: `Personal task/event "${task.title}" created.`
    };
  },
});

// ─── Tool: update_personal_task ───────────────────────────────────────────────

export const updatePersonalTaskTool = createTool({
  id: "update_personal_task",
  description: "Update an existing personal task or event.",
  inputSchema: z.object({
    taskId: z.string().uuid(),
    title: z.string().optional(),
    description: z.string().nullable().optional(),
    priority: priorityEnum,
    status: statusEnum,
    type: z.enum(["task", "event"]).optional(),
    event_type: z.enum(["meeting", "call", "personal", "reminder", "other"]).optional(),
    location: z.string().nullable().optional(),
    is_all_day: z.boolean().optional(),
    meet_link: z.string().nullable().optional(),
    start_date: z.string().nullable().optional(),
    due_date: z.string().nullable().optional(),
  }),
  execute: async (inputData, context) => {
    const userId = context?.requestContext?.get("userId") as string;
    if (!userId) return { error: "Not authenticated." };

    const personal = await getPersonalOrgSpace(userId);
    if (!personal) return { error: "Personal organisation not found." };

    // Verify the task belongs to the personal space
    const existing = await orgTaskService.getTaskById(inputData.taskId);
    if (!existing || existing.org_id !== personal.orgId || existing.space_id !== personal.spaceId) {
      return { error: "Task not found or you do not own it." };
    }

    const { taskId, ...rest } = inputData;
    const updated = await orgTaskService.updateTask(
      { orgId: personal.orgId, spaceId: personal.spaceId },
      taskId,
      userId,
      {
        title: rest.title,
        description: rest.description,
        priority: rest.priority as TaskPriority | undefined,
        status: rest.status as TaskStatus | undefined,
        type: rest.type as "task" | "event" | undefined,
        event_type: rest.event_type,
        location: rest.location,
        is_all_day: rest.is_all_day,
        meet_link: rest.meet_link,
        start_date: rest.start_date !== undefined
          ? rest.start_date ? new Date(rest.start_date) : null
          : undefined,
        due_date: rest.due_date !== undefined
          ? rest.due_date ? new Date(rest.due_date) : null
          : undefined,
      }
    );

    if (!updated) return { error: "Task not found." };
    const changedFields = Object.keys(rest).filter(k => (rest as any)[k] !== undefined);
    return {
      activity: {
        agent: "keilhq-task-agent",
        action: `Updating personal task "${updated.title}"`,
        details: `Updated fields: ${changedFields.join(", ")}`,
        tool: "update_personal_task"
      },
      task: updated,
      message: `Task/event "${updated.title}" updated.`
    };
  },
});

// ─── Tool: delete_personal_task ───────────────────────────────────────────────

export const deletePersonalTaskTool = createTool({
  id: "delete_personal_task",
  description: "Delete a personal task.",
  inputSchema: z.object({
    taskId: z.string().uuid(),
  }),
  execute: async (inputData, context) => {
    const userId = context?.requestContext?.get("userId") as string;
    if (!userId) return { error: "Not authenticated." };

    const personal = await getPersonalOrgSpace(userId);
    if (!personal) return { error: "Personal organisation not found." };

    // Verify the task belongs to the personal space
    const existing = await orgTaskService.getTaskById(inputData.taskId);
    if (!existing || existing.org_id !== personal.orgId || existing.space_id !== personal.spaceId) {
      return { error: "Task not found or you do not own it." };
    }

    await orgTaskService.deleteTask({ orgId: personal.orgId, spaceId: personal.spaceId }, inputData.taskId, userId);
    return {
      activity: {
        agent: "keilhq-task-agent",
        action: `Deleting personal task "${existing.title}"`,
        details: `Successfully deleted task ID: ${inputData.taskId}`,
        tool: "delete_personal_task"
      },
      message: "Personal task deleted successfully."
    };
  },
});

// ─── Tool: get_my_organisations ───────────────────────────────────────────────

export const getMyOrganisationsTool = createTool({
  id: "get_my_organisations",
  description: "List all organisations the current user is a member of, including their role in each.",
  inputSchema: z.object({}),
  execute: async (_inputData, context) => {
    const userId = context?.requestContext?.get("userId") as string;
    if (!userId) return { error: "Not authenticated." };

    const result = await pool.query(
      `SELECT o.id, o.name, o.slug, om.role
       FROM public.organisations o
       INNER JOIN public.organisation_members om ON om.org_id = o.id
       WHERE om.user_id = $1 AND o.deleted_at IS NULL
       ORDER BY o.name`,
      [userId]
    );

    return {
      activity: {
        agent: "keilhq-task-agent",
        action: "Listing your organisations",
        details: `Found ${result.rows.length} organisation(s)`,
        tool: "get_my_organisations"
      },
      organisations: result.rows,
      count: result.rows.length
    };
  },
});

// ─── Tool: get_my_spaces ──────────────────────────────────────────────────────

export const getMySpacesTool = createTool({
  id: "get_my_spaces",
  description: "List all spaces the current user belongs to within a given organisation.",
  inputSchema: z.object({
    orgId: z.string().uuid().describe("The organisation ID to list spaces for"),
  }),
  execute: async (inputData, context) => {
    const userId = context?.requestContext?.get("userId") as string;
    if (!userId) return { error: "Not authenticated." };

    const result = await pool.query(
      `SELECT s.id, s.name, s.slug, sm.role
       FROM public.spaces s
       INNER JOIN public.space_members sm ON sm.space_id = s.id
       WHERE sm.user_id = $1 AND s.org_id = $2 AND s.deleted_at IS NULL
       ORDER BY s.name`,
      [userId, inputData.orgId]
    );

    return {
      activity: {
        agent: "keilhq-task-agent",
        action: "Listing spaces in organisation",
        details: `Found ${result.rows.length} space(s)`,
        tool: "get_my_spaces"
      },
      spaces: result.rows,
      count: result.rows.length
    };
  },
});

// ─── Tool: get_my_assigned_tasks ──────────────────────────────────────────────

export const getMyAssignedTasksTool = createTool({
  id: "get_my_assigned_tasks",
  description: "List all org tasks assigned to the current user across ALL organisations and spaces. Returns summarized payloads.",
  inputSchema: z.object({
    status: statusEnum,
    priority: priorityEnum,
    limit: z.number().int().min(1).max(100).optional().default(30),
  }),
  execute: async (inputData, context) => {
    const userId = context?.requestContext?.get("userId") as string;
    if (!userId) return { error: "Not authenticated." };

    const params: any[] = [userId];
    let query = `
      SELECT t.id, t.title, t.status, t.priority,
             t.start_date, t.due_date, t.created_at, t.type,
             o.name as org_name, s.name as space_name,
             t.org_id, t.space_id
      FROM public.tasks t
      INNER JOIN public.task_assignees ta ON ta.task_id = t.id AND ta.user_id = $1
      LEFT JOIN public.organisations o ON o.id = t.org_id
      LEFT JOIN public.spaces s ON s.id = t.space_id
      WHERE t.deleted_at IS NULL
    `;

    if (inputData.status) {
      params.push(inputData.status);
      query += ` AND t.status = $${params.length}`;
    }
    if (inputData.priority) {
      params.push(inputData.priority);
      query += ` AND t.priority = $${params.length}`;
    }

    query += ` ORDER BY t.due_date ASC NULLS LAST, t.priority DESC`;
    params.push(inputData.limit ?? 30);
    query += ` LIMIT $${params.length}`;

    const result = await pool.query(query, params);

    const summaryTasks = result.rows.map((t: any) => ({
      id: t.id,
      title: t.title,
      status: t.status,
      priority: t.priority,
      start_date: t.start_date,
      due_date: t.due_date,
      type: t.type,
      org_name: t.org_name,
      space_name: t.space_name,
      org_id: t.org_id,
      space_id: t.space_id,
    }));

    return {
      activity: {
        agent: "keilhq-task-agent",
        action: "Listing your assigned tasks",
        details: `Fetched ${summaryTasks.length} task(s) assigned to you across organisations`,
        tool: "get_my_assigned_tasks"
      },
      tasks: summaryTasks,
      count: summaryTasks.length
    };
  },
});

// ─── Tool: get_org_tasks ──────────────────────────────────────────────────────

export const getOrgTasksTool = createTool({
  id: "get_org_tasks",
  description: "List tasks in the current organisation space. Optionally filter by status, priority, or assignee. Returns summarized payloads.",
  inputSchema: z.object({
    status: statusEnum,
    priority: priorityEnum,
    assigneeId: z.string().uuid().optional().describe("Filter by assignee user ID"),
    limit: z.number().int().min(1).max(50).optional().default(20),
  }),
  execute: async (inputData, context) => {
    const userId  = context?.requestContext?.get("userId")  as string;
    const orgId   = context?.requestContext?.get("orgId")   as string;
    const spaceId = context?.requestContext?.get("spaceId") as string;

    if (!userId || !orgId || !spaceId) return { error: "Missing org or space context." };

    const role = await getSpaceRole(userId, orgId, spaceId);
    if (!role) return { error: "You are not a member of this space." };

    const tasks = await orgTaskService.getTasksBySpace(orgId, spaceId, {
      filters: {
        status: inputData.status as TaskStatus | undefined,
        priority: inputData.priority as TaskPriority | undefined,
        assigneeId: inputData.assigneeId,
      },
      pagination: { limit: inputData.limit ?? 20, offset: 0 },
    });

    const summaryTasks = tasks.map((t: any) => ({
      id: t.id,
      title: t.title,
      status: t.status,
      priority: t.priority,
      start_date: t.start_date,
      due_date: t.due_date,
      type: t.type,
      org_id: t.org_id,
      space_id: t.space_id,
    }));

    return {
      activity: {
        agent: "keilhq-task-agent",
        action: "Listing organisation tasks",
        details: `Fetched ${summaryTasks.length} task(s) in this space`,
        tool: "get_org_tasks"
      },
      tasks: summaryTasks,
      count: summaryTasks.length
    };
  },
});

// ─── Tool: get_org_task ───────────────────────────────────────────────────────

export const getOrgTaskTool = createTool({
  id: "get_org_task",
  description: "Get a single org task by ID, including assignees and dependencies.",
  inputSchema: z.object({
    taskId: z.string().uuid(),
  }),
  execute: async (inputData, context) => {
    const userId  = context?.requestContext?.get("userId")  as string;
    const orgId   = context?.requestContext?.get("orgId")   as string;
    const spaceId = context?.requestContext?.get("spaceId") as string;

    if (!userId || !orgId || !spaceId) return { error: "Missing org or space context." };

    const role = await getSpaceRole(userId, orgId, spaceId);
    if (!role) return { error: "You are not a member of this space." };

    const task = await orgTaskService.getTaskById(inputData.taskId);
    if (!task) return { error: "Task not found." };

    return {
      activity: {
        agent: "keilhq-task-agent",
        action: `Reading task "${task.title}"`,
        details: `Fetched full details including assignees and dependencies`,
        tool: "get_org_task"
      },
      task
    };
  },
});

// ─── Tool: create_org_task ────────────────────────────────────────────────────

export const createOrgTaskTool = createTool({
  id: "create_org_task",
  description: "Create a new task or event in the current organisation space.",
  inputSchema: z.object({
    title: z.string().min(1),
    description: z.string().optional(),
    priority: priorityEnum,
    status: statusEnum,
    type: z.enum(["task", "event"]).optional().default("task"),
    event_type: z.enum(["meeting", "call", "personal", "reminder", "other"]).optional(),
    location: z.string().optional(),
    is_all_day: z.boolean().optional(),
    meet_link: z.string().optional(),
    start_date: z.string().optional(),
    due_date: z.string().optional(),
    assignee_ids: z.array(z.string().uuid()).optional(),
  }),
  execute: async (inputData, context) => {
    const userId  = context?.requestContext?.get("userId")  as string;
    const orgId   = context?.requestContext?.get("orgId")   as string;
    const spaceId = context?.requestContext?.get("spaceId") as string;

    if (!userId || !orgId || !spaceId) return { error: "Missing org or space context." };

    const role = await getSpaceRole(userId, orgId, spaceId);
    if (!role) return { error: "You are not a member of this space." };

    if (role === "member" && inputData.assignee_ids?.length) {
      const onlySelf = inputData.assignee_ids.length === 1 && inputData.assignee_ids[0] === userId;
      if (!onlySelf) return { error: "Members can only assign tasks to themselves." };
    }

    const task = await orgTaskService.createTask(
      { orgId, spaceId },
      {
        org_id: orgId,
        space_id: spaceId,
        title: inputData.title,
        description: inputData.description ?? null,
        priority: inputData.priority as TaskPriority | undefined,
        status: inputData.status as TaskStatus | undefined,
        type: inputData.type as "task" | "event" | undefined,
        event_type: inputData.event_type,
        location: inputData.location ?? null,
        is_all_day: inputData.is_all_day ?? false,
        meet_link: inputData.meet_link ?? null,
        start_date: inputData.start_date ? new Date(inputData.start_date) : null,
        due_date: inputData.due_date ? new Date(inputData.due_date) : null,
        assignee_ids: inputData.assignee_ids,
        created_by: userId,
      }
    );

    return {
      activity: {
        agent: "keilhq-task-agent",
        action: `Creating organisation task/event "${inputData.title}"`,
        details: `Task ID: ${task.id}. Priority: ${task.priority}`,
        tool: "create_org_task"
      },
      task,
      message: `Org task/event "${task.title}" created.`
    };
  },
});

// ─── Tool: update_org_task ────────────────────────────────────────────────────

export const updateOrgTaskTool = createTool({
  id: "update_org_task",
  description: "Update an existing task or event in the current organisation space.",
  inputSchema: z.object({
    taskId: z.string().uuid(),
    title: z.string().optional(),
    description: z.string().nullable().optional(),
    priority: priorityEnum,
    status: statusEnum,
    type: z.enum(["task", "event"]).optional(),
    event_type: z.enum(["meeting", "call", "personal", "reminder", "other"]).optional(),
    location: z.string().nullable().optional(),
    is_all_day: z.boolean().optional(),
    meet_link: z.string().nullable().optional(),
    start_date: z.string().nullable().optional(),
    due_date: z.string().nullable().optional(),
  }),
  execute: async (inputData, context) => {
    const userId  = context?.requestContext?.get("userId")  as string;
    const orgId   = context?.requestContext?.get("orgId")   as string;
    const spaceId = context?.requestContext?.get("spaceId") as string;

    if (!userId || !orgId || !spaceId) return { error: "Missing org or space context." };

    const role = await getSpaceRole(userId, orgId, spaceId);
    if (!role) return { error: "You are not a member of this space." };

    if (role === "member") {
      const assigned = await isAssignedToTask(inputData.taskId, userId);
      if (!assigned) return { error: "You can only update tasks assigned to you." };
    }

    const { taskId, ...rest } = inputData;
    const updated = await orgTaskService.updateTask(
      { orgId, spaceId },
      taskId,
      userId,
      {
        title: rest.title,
        description: rest.description,
        priority: rest.priority as TaskPriority | undefined,
        status: rest.status as TaskStatus | undefined,
        type: rest.type as "task" | "event" | undefined,
        event_type: rest.event_type,
        location: rest.location,
        is_all_day: rest.is_all_day,
        meet_link: rest.meet_link,
        start_date: rest.start_date !== undefined
          ? rest.start_date ? new Date(rest.start_date) : null
          : undefined,
        due_date: rest.due_date !== undefined
          ? rest.due_date ? new Date(rest.due_date) : null
          : undefined,
      }
    );

    if (!updated) return { error: "Task not found." };
    const changedFields = Object.keys(rest).filter(k => (rest as any)[k] !== undefined);
    return {
      activity: {
        agent: "keilhq-task-agent",
        action: `Updating organisation task "${updated.title}"`,
        details: `Updated fields: ${changedFields.join(", ")}`,
        tool: "update_org_task"
      },
      task: updated,
      message: `Task/event "${updated.title}" updated.`
    };
  },
});

// ─── Tool: delete_org_task ────────────────────────────────────────────────────

export const deleteOrgTaskTool = createTool({
  id: "delete_org_task",
  description: "Delete a task from the current organisation space.",
  inputSchema: z.object({
    taskId: z.string().uuid(),
  }),
  execute: async (inputData, context) => {
    const userId  = context?.requestContext?.get("userId")  as string;
    const orgId   = context?.requestContext?.get("orgId")   as string;
    const spaceId = context?.requestContext?.get("spaceId") as string;

    if (!userId || !orgId || !spaceId) return { error: "Missing org or space context." };

    const role = await getSpaceRole(userId, orgId, spaceId);
    if (!role) return { error: "You are not a member of this space." };

    const existing = await orgTaskService.getTaskById(inputData.taskId);
    if (!existing) return { error: "Task not found." };

    if (role === "member") {
      const assigned = await isAssignedToTask(inputData.taskId, userId);
      if (!assigned) return { error: "You can only delete tasks assigned to you." };
    }

    await orgTaskService.deleteTask({ orgId, spaceId }, inputData.taskId, userId);
    return {
      activity: {
        agent: "keilhq-task-agent",
        action: `Deleting organisation task "${existing.title}"`,
        details: `Successfully deleted task ID: ${inputData.taskId}`,
        tool: "delete_org_task"
      },
      message: "Org task deleted successfully."
    };
  },
});

// ─── Tool: get_calendar_events ────────────────────────────────────────────────

export const getCalendarEventsTool = createTool({
  id: "get_calendar_events",
  description: "Get the user's calendar schedule / events for a specified date range. Useful for checking what meetings, calls, or events are scheduled.",
  inputSchema: z.object({
    startDate: z.string().describe("ISO 8601 date-time string (e.g. '2026-06-04T00:00:00Z') specifying start of range"),
    endDate: z.string().describe("ISO 8601 date-time string (e.g. '2026-06-08T00:00:00Z') specifying end of range"),
    limit: z.number().int().min(1).max(100).optional().default(50),
  }),
  execute: async (inputData, context) => {
    const userId = context?.requestContext?.get("userId") as string;
    if (!userId) return { error: "Not authenticated." };

    const start = new Date(inputData.startDate);
    const end = new Date(inputData.endDate);

    const result = await pool.query(
      `SELECT DISTINCT t.id, t.title, t.status, t.priority,
              t.start_date, t.due_date, t.type, t.event_type, t.location, t.meet_link, t.is_all_day,
              o.name as org_name, s.name as space_name, t.org_id, t.space_id
       FROM public.tasks t
       LEFT JOIN public.organisations o ON o.id = t.org_id
       LEFT JOIN public.spaces s ON s.id = t.space_id
       WHERE t.deleted_at IS NULL
         AND t.start_date IS NOT NULL
         AND (
           (t.start_date >= $2 AND t.start_date <= $3)
           OR (t.due_date >= $2 AND t.due_date <= $3)
           OR (t.start_date <= $2 AND t.due_date >= $3)
         )
         AND (
           t.created_by = $1
           OR t.id IN (SELECT task_id FROM public.task_assignees WHERE user_id = $1)
           OR t.space_id IN (SELECT space_id FROM public.space_members WHERE user_id = $1)
         )
       ORDER BY t.start_date ASC
       LIMIT $4`,
      [userId, start, end, inputData.limit ?? 50]
    );

    return {
      activity: {
        agent: "keilhq-task-agent",
        action: "Reading calendar events",
        details: `Found ${result.rows.length} scheduled event(s) in range`,
        tool: "get_calendar_events"
      },
      events: result.rows,
      count: result.rows.length,
      range: { start: inputData.startDate, end: inputData.endDate }
    };
  },
});
