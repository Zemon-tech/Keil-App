import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import pool from "../../config/pg";
import * as orgTaskService from "../../services/org-task.service";
import { TaskStatus, TaskPriority } from "../../types/enums";
import { ActivityEvent } from "../types/activity";
import { emitActivity } from "../lib/activity-stream";


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

async function resolveOrgSpace(
  userId: string,
  orgId?: string | null,
  spaceId?: string | null
): Promise<{ orgId: string; spaceId: string } | null> {
  if (orgId && spaceId) {
    return { orgId, spaceId };
  }
  if (orgId) {
    const spaceRes = await pool.query(
      `SELECT id FROM public.spaces WHERE org_id = $1 AND deleted_at IS NULL ORDER BY created_at ASC LIMIT 1`,
      [orgId]
    );
    if (spaceRes.rows.length > 0) {
      return { orgId, spaceId: spaceRes.rows[0].id };
    }
  }
  const personal = await getPersonalOrgSpace(userId);
  if (personal) {
    return personal;
  }
  const fallbackRes = await pool.query(
    `SELECT sm.org_id, sm.space_id
     FROM public.space_members sm
     INNER JOIN public.spaces s ON s.id = sm.space_id AND s.deleted_at IS NULL
     INNER JOIN public.organisations o ON o.id = sm.org_id AND o.deleted_at IS NULL
     WHERE sm.user_id = $1
     ORDER BY sm.created_at ASC
     LIMIT 1`,
    [userId]
  );
  if (fallbackRes.rows.length > 0) {
    return { orgId: fallbackRes.rows[0].org_id, spaceId: fallbackRes.rows[0].space_id };
  }
  return null;
}

// ─── Tool: list_tasks ─────────────────────────────────────────────────────────

export const listTasksTool = createTool({
  id: 'list_tasks',
  description: "List tasks by scope. Use 'personal' for the user's private tasks, 'assigned' for tasks assigned to them across all orgs, and 'space' for tasks in the current org space.",
  inputSchema: z.object({
    scope: z.enum(['personal', 'assigned', 'space']),
    status: z.enum(['backlog', 'todo', 'in_progress', 'done', 'cancelled']).optional(),
    priority: z.enum(['urgent', 'high', 'medium', 'low']).optional(),
    limit: z.number().int().min(1).max(50).optional().default(20),
  }),
  execute: async (inputData, context) => {
    const userId = context?.requestContext?.get("userId") as string;
    if (!userId) return { error: "Not authenticated." };

    await emitActivity(context, {
      agentLabel: "Task Manager",
      action: "Listing tasks",
      status: "running",
    });

    let tasks: any[] = [];

    if (inputData.scope === 'personal') {
      const personal = await getPersonalOrgSpace(userId);
      if (!personal) return { error: "Personal organisation not found." };
      tasks = await orgTaskService.getTasksBySpace(personal.orgId, personal.spaceId, {
        filters: {
          status: inputData.status as TaskStatus | undefined,
          priority: inputData.priority as TaskPriority | undefined,
        },
        pagination: { limit: inputData.limit ?? 20, offset: 0 },
      });
    } else if (inputData.scope === 'assigned') {
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
      params.push(inputData.limit ?? 20);
      query += ` LIMIT $${params.length}`;

      const result = await pool.query(query, params);
      tasks = result.rows;
    } else if (inputData.scope === 'space') {
      await emitActivity(context, {
        agentLabel: "Task Manager",
        action: "Resolving workspace context",
        status: "running",
      });
      const contextOrgId   = context?.requestContext?.get("orgId")   as string;
      const contextSpaceId = context?.requestContext?.get("spaceId") as string;
      const resolved = await resolveOrgSpace(userId, contextOrgId, contextSpaceId);
      if (!resolved) return { error: "Missing org or space context." };
      const { orgId, spaceId } = resolved;

      const role = await getSpaceRole(userId, orgId, spaceId);
      if (!role) return { error: "You are not a member of this space." };

      tasks = await orgTaskService.getTasksBySpace(orgId, spaceId, {
        filters: {
          status: inputData.status as TaskStatus | undefined,
          priority: inputData.priority as TaskPriority | undefined,
        },
        pagination: { limit: inputData.limit ?? 20, offset: 0 },
      });
    }

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
      org_name: t.org_name,
      space_name: t.space_name,
    }));

    await emitActivity(context, {
      agentLabel: "Task Manager",
      action: `Listing your ${inputData.scope} tasks`,
      status: "complete",
    });

    return {
      activity: {
        agent: 'keilhq-task-agent',
        agentLabel: 'Task Manager',
        tool: 'list_tasks',
        icon: 'list',
        action: `Listing your ${inputData.scope} tasks`,
        details: `Fetched ${summaryTasks.length} task(s)`,
        status: 'complete',
        timestamp: new Date().toISOString(),
      },
      tasks: summaryTasks,
      count: summaryTasks.length,
      scope: inputData.scope,
    };
  }
});

// ─── Tool: get_task ──────────────────────────────────────────────────────────

export const getTaskTool = createTool({
  id: 'get_task',
  description: 'Fetch full details of a single task by UUID including description, objectives, success criteria, and assignees.',
  inputSchema: z.object({
    taskId: z.string().uuid(),
  }),
  execute: async (inputData, context) => {
    const userId = context?.requestContext?.get("userId") as string;
    if (!userId) return { error: "Not authenticated." };

    await emitActivity(context, {
      agentLabel: "Task Manager",
      action: "Reading task details",
      status: "running",
    });

    const task = await orgTaskService.getTaskById(inputData.taskId);
    if (!task) return { error: "Task not found." };

    const personal = await getPersonalOrgSpace(userId);
    const isPersonalTask = personal && task.org_id === personal.orgId && task.space_id === personal.spaceId;

    if (!isPersonalTask) {
      const role = await getSpaceRole(userId, task.org_id as string, task.space_id as string);
      if (!role) return { error: "You do not have access to this task." };
    }

    await emitActivity(context, {
      agentLabel: "Task Manager",
      action: "Reading task details",
      status: "complete",
    });

    return {
      activity: {
        agent: 'keilhq-task-agent',
        agentLabel: 'Task Manager',
        tool: 'get_task',
        icon: 'file-text',
        action: 'Reading task details',
        details: `Fetched full details for "${task.title}"`,
        status: 'complete',
        timestamp: new Date().toISOString(),
      },
      task,
    };
  }
});

// ─── Tool: create_task ────────────────────────────────────────────────────────

export const createTaskTool = createTool({
  id: 'create_task',
  description: 'Create a new task or calendar event. Automatically creates in the org space if orgId and spaceId are in context, otherwise creates as a personal task.',
  inputSchema: z.object({
    title: z.string().min(1),
    description: z.string().optional(),
    priority: z.enum(['urgent', 'high', 'medium', 'low']).optional().default('medium'),
    status: z.enum(['backlog', 'todo', 'in_progress']).optional().default('todo'),
    type: z.enum(['task', 'event']).optional().default('task'),
    start_date: z.string().optional(),
    due_date: z.string().optional(),
    assignee_ids: z.array(z.string().uuid()).optional(),
    event_type: z.string().optional(),
    location: z.string().optional(),
    is_all_day: z.boolean().optional(),
    meet_link: z.string().optional(),
  }),
  execute: async (inputData, context) => {
    const userId = context?.requestContext?.get("userId") as string;
    if (!userId) return { error: "Not authenticated." };

    await emitActivity(context, {
      agentLabel: "Task Manager",
      action: `Creating task "${inputData.title}"`,
      status: "running",
    });

    const contextOrgId = context?.requestContext?.get("orgId") as string;
    const contextSpaceId = context?.requestContext?.get("spaceId") as string;
    const personal = await getPersonalOrgSpace(userId);

    let targetOrgId = personal?.orgId;
    let targetSpaceId = personal?.spaceId;
    let isPersonal = true;

    if (contextOrgId && contextSpaceId && personal && (contextOrgId !== personal.orgId || contextSpaceId !== personal.spaceId)) {
      targetOrgId = contextOrgId;
      targetSpaceId = contextSpaceId;
      isPersonal = false;
    }

    if (!targetOrgId || !targetSpaceId) {
      return { error: "Workspace space not resolved." };
    }

    if (!isPersonal) {
      const role = await getSpaceRole(userId, targetOrgId, targetSpaceId);
      if (!role) return { error: "You are not a member of this space." };
      if (role === "member" && inputData.assignee_ids?.length) {
        const onlySelf = inputData.assignee_ids.length === 1 && inputData.assignee_ids[0] === userId;
        if (!onlySelf) return { error: "Members can only assign tasks to themselves." };
      }
    }

    const payload = {
      org_id: targetOrgId,
      space_id: targetSpaceId,
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
      assignee_ids: isPersonal ? [userId] : inputData.assignee_ids,
      created_by: userId,
    };

    const task = await orgTaskService.createTask({ orgId: targetOrgId, spaceId: targetSpaceId }, payload);

    await emitActivity(context, {
      agentLabel: "Task Manager",
      action: `Creating task "${inputData.title}"`,
      status: "complete",
    });

    return {
      activity: {
        agent: 'keilhq-task-agent',
        agentLabel: 'Task Manager',
        tool: 'create_task',
        icon: 'plus-circle',
        action: `Creating ${inputData.type === 'event' ? 'event' : 'task'} "${inputData.title}"`,
        details: `Created "${task.title}" — ${task.status}, ${task.priority} priority`,
        status: 'complete',
        timestamp: new Date().toISOString(),
      },
      task,
    };
  }
});

// ─── Tool: update_task ────────────────────────────────────────────────────────

export const updateTaskTool = createTool({
  id: 'update_task',
  description: 'Update any fields on an existing task or event by its UUID.',
  inputSchema: z.object({
    taskId: z.string().uuid(),
    title: z.string().optional(),
    description: z.string().optional(),
    priority: z.enum(['urgent', 'high', 'medium', 'low']).optional(),
    status: z.enum(['backlog', 'todo', 'in_progress', 'done', 'cancelled']).optional(),
    start_date: z.string().optional(),
    due_date: z.string().optional(),
    assignee_ids: z.array(z.string().uuid()).optional(),
    location: z.string().optional(),
    meet_link: z.string().optional(),
    is_all_day: z.boolean().optional(),
  }),
  execute: async (inputData, context) => {
    const userId = context?.requestContext?.get("userId") as string;
    if (!userId) return { error: "Not authenticated." };

    await emitActivity(context, {
      agentLabel: "Task Manager",
      action: "Updating task details",
      status: "running",
    });

    const task = await orgTaskService.getTaskById(inputData.taskId);
    if (!task) return { error: "Task not found." };

    const personal = await getPersonalOrgSpace(userId);
    const isPersonalTask = personal && task.org_id === personal.orgId && task.space_id === personal.spaceId;

    if (!isPersonalTask) {
      const role = await getSpaceRole(userId, task.org_id as string, task.space_id as string);
      if (!role) return { error: "You are not a member of this space." };
      if (role === "member") {
        const assigned = await isAssignedToTask(inputData.taskId, userId);
        if (!assigned) return { error: "You can only update tasks assigned to you." };
      }
    }

    const { taskId, ...rest } = inputData;
    const payload: any = {
      title: rest.title,
      description: rest.description,
      priority: rest.priority as TaskPriority | undefined,
      status: rest.status as TaskStatus | undefined,
      location: rest.location,
      is_all_day: rest.is_all_day,
      meet_link: rest.meet_link,
      assignee_ids: rest.assignee_ids,
      start_date: rest.start_date !== undefined
        ? rest.start_date ? new Date(rest.start_date) : null
        : undefined,
      due_date: rest.due_date !== undefined
        ? rest.due_date ? new Date(rest.due_date) : null
        : undefined,
    };

    const updated = await orgTaskService.updateTask(
      { orgId: task.org_id as string, spaceId: task.space_id as string },
      taskId,
      userId,
      payload
    );

    if (!updated) return { error: "Task not found." };

    const updatedFields = Object.keys(rest)
      .filter(k => (rest as any)[k] !== undefined)
      .join(', ');

    await emitActivity(context, {
      agentLabel: "Task Manager",
      action: `Updating task "${task.title}"`,
      status: "complete",
    });

    return {
      activity: {
        agent: 'keilhq-task-agent',
        agentLabel: 'Task Manager',
        tool: 'update_task',
        icon: 'edit',
        action: `Updating task "${task.title}"`,
        details: `Updated: ${updatedFields}`,
        status: 'complete',
        timestamp: new Date().toISOString(),
      },
      task: updated,
    };
  }
});

// ─── Tool: delete_task ────────────────────────────────────────────────────────

export const deleteTaskTool = createTool({
  id: 'delete_task',
  description: 'Soft-delete a task or event by UUID.',
  inputSchema: z.object({
    taskId: z.string().uuid(),
  }),
  execute: async (inputData, context) => {
    const userId = context?.requestContext?.get("userId") as string;
    if (!userId) return { error: "Not authenticated." };

    await emitActivity(context, {
      agentLabel: "Task Manager",
      action: "Deleting task",
      status: "running",
    });

    const task = await orgTaskService.getTaskById(inputData.taskId);
    if (!task) return { error: "Task not found." };

    const personal = await getPersonalOrgSpace(userId);
    const isPersonalTask = personal && task.org_id === personal.orgId && task.space_id === personal.spaceId;

    if (!isPersonalTask) {
      const role = await getSpaceRole(userId, task.org_id as string, task.space_id as string);
      if (!role) return { error: "You are not a member of this space." };
      if (role === "member") {
        const assigned = await isAssignedToTask(inputData.taskId, userId);
        if (!assigned) return { error: "You can only delete tasks assigned to you." };
      }
    }

    await orgTaskService.deleteTask({ orgId: task.org_id as string, spaceId: task.space_id as string }, inputData.taskId, userId);

    await emitActivity(context, {
      agentLabel: "Task Manager",
      action: "Deleting task",
      status: "complete",
    });

    return {
      activity: {
        agent: 'keilhq-task-agent',
        agentLabel: 'Task Manager',
        tool: 'delete_task',
        icon: 'trash',
        action: 'Deleting task',
        details: `Deleted task "${task.title}"`,
        status: 'complete',
        timestamp: new Date().toISOString(),
      },
      message: `Deleted task "${task.title}" successfully.`,
    };
  }
});

// ─── Tool: resolve_workspace ──────────────────────────────────────────────────

export const resolveWorkspaceTool = createTool({
  id: 'resolve_workspace',
  description: "Find the user's organisations and their spaces in a single call. Use this only when orgId or spaceId is missing from context and cannot be inferred.",
  inputSchema: z.object({
    orgNameHint: z.string().optional().describe('Optional partial org name to filter results'),
  }),
  execute: async (inputData, context) => {
    const userId = context?.requestContext?.get("userId") as string;
    if (!userId) return { error: "Not authenticated." };

    await emitActivity(context, {
      agentLabel: "Task Manager",
      action: "Looking up your workspace",
      status: "running",
    });

    const orgsResult = await pool.query(
      `SELECT o.id, o.name, om.role
       FROM public.organisations o
       INNER JOIN public.organisation_members om ON om.org_id = o.id
       WHERE om.user_id = $1 AND o.deleted_at IS NULL
       ORDER BY o.name`,
      [userId]
    );

    const workspaces = [];
    for (const org of orgsResult.rows) {
      if (inputData.orgNameHint && !org.name.toLowerCase().includes(inputData.orgNameHint.toLowerCase())) {
        continue;
      }
      const spacesResult = await pool.query(
        `SELECT s.id, s.name, sm.role
         FROM public.spaces s
         INNER JOIN public.space_members sm ON sm.space_id = s.id
         WHERE sm.user_id = $1 AND s.org_id = $2 AND s.deleted_at IS NULL
         ORDER BY s.name`,
        [userId, org.id]
      );
      workspaces.push({
        orgId: org.id,
        orgName: org.name,
        role: org.role,
        spaces: spacesResult.rows.map((s: any) => ({
          spaceId: s.id,
          spaceName: s.name,
          role: s.role,
        })),
      });
    }

    await emitActivity(context, {
      agentLabel: "Task Manager",
      action: "Looking up your workspace",
      status: "complete",
    });

    return {
      activity: {
        agent: 'keilhq-task-agent',
        agentLabel: 'Task Manager',
        tool: 'resolve_workspace',
        icon: 'building',
        action: 'Looking up your workspace',
        details: `Found ${workspaces.length} organisation(s)`,
        status: 'complete',
        timestamp: new Date().toISOString(),
      },
      workspaces,
    };
  }
});

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

    await emitActivity(context, {
      agentLabel: "Task Manager",
      action: `Searching tasks for "${inputData.query}"`,
      status: "running",
    });

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

    await emitActivity(context, {
      agentLabel: "Task Manager",
      action: `Searching tasks for "${inputData.query}"`,
      status: "complete",
    });

    return {
      activity: {
        agent: 'keilhq-task-agent',
        agentLabel: 'Task Manager',
        tool: 'search_tasks',
        icon: 'search',
        action: `Searching tasks for "${inputData.query}"`,
        details: `Found ${summaryTasks.length} matching task(s)`,
        status: 'complete',
        timestamp: new Date().toISOString(),
      },
      tasks: summaryTasks,
      count: summaryTasks.length
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

    await emitActivity(context, {
      agentLabel: "Task Manager",
      action: "Reading your calendar",
      status: "running",
    });

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

    await emitActivity(context, {
      agentLabel: "Task Manager",
      action: "Reading your calendar",
      status: "complete",
    });

    return {
      activity: {
        agent: 'keilhq-task-agent',
        agentLabel: 'Task Manager',
        tool: 'get_calendar_events',
        icon: 'calendar',
        action: 'Reading your calendar',
        details: `Found ${result.rows.length} event(s) in the requested range`,
        status: 'complete',
        timestamp: new Date().toISOString(),
      },
      events: result.rows,
      count: result.rows.length,
      range: { start: inputData.startDate, end: inputData.endDate }
    };
  },
});