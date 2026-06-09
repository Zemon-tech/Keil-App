import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import pool from "../../config/pg";
import * as orgTaskService from "../../services/org-task.service";
import { TaskStatus } from "../../types/enums";
import { ActivityEvent } from "../types/activity";
import { emitActivity } from "../lib/activity-stream";


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

// ─── Tool: get_unscheduled_tasks ──────────────────────────────────────────────

export const getUnscheduledTasksTool = createTool({
  id: "get_unscheduled_tasks",
  description: "Get all backlog or todo tasks that do not have start_date or due_date scheduled. Returns both personal tasks and organization tasks assigned to the user.",
  inputSchema: z.object({
    limit: z.number().int().min(1).max(50).optional().default(20),
  }),
  execute: async (inputData, context) => {
    const userId = context?.requestContext?.get("userId") as string;
    if (!userId) return { error: "Not authenticated." };

    await emitActivity(context, {
      agentLabel: "Scheduler",
      action: "Fetching your unscheduled tasks",
      status: "running",
    });

    const contextOrgId   = context?.requestContext?.get("orgId")   as string;
    const contextSpaceId = context?.requestContext?.get("spaceId") as string;
    const resolved = await resolveOrgSpace(userId, contextOrgId, contextSpaceId);
    if (!resolved) return { error: "Personal organisation or workspace not found." };
    const { orgId, spaceId } = resolved;

    const result = await pool.query(
      `SELECT DISTINCT t.id, t.title, t.status, t.priority, t.type, t.org_id, t.space_id,
              o.name as org_name, s.name as space_name
       FROM public.tasks t
       LEFT JOIN public.organisations o ON o.id = t.org_id
       LEFT JOIN public.spaces s ON s.id = t.space_id
       WHERE t.deleted_at IS NULL
         AND t.start_date IS NULL
         AND t.status IN ('backlog', 'todo')
         AND (
           (t.org_id = $2 AND t.space_id = $3)
           OR t.id IN (SELECT task_id FROM public.task_assignees WHERE user_id = $1)
         )
       ORDER BY 
         CASE t.priority
           WHEN 'urgent' THEN 1
           WHEN 'high' THEN 2
           WHEN 'medium' THEN 3
           WHEN 'low' THEN 4
           ELSE 5
         END ASC,
         t.created_at ASC
       LIMIT $4`,
      [userId, orgId, spaceId, inputData.limit ?? 20]
    );

    const tasks = result.rows;

    await emitActivity(context, {
      agentLabel: "Scheduler",
      action: "Fetching your unscheduled tasks",
      status: "complete",
    });

    return {
      activity: {
        agent: 'keilhq-scheduler-agent',
        agentLabel: 'Scheduler',
        tool: 'get_unscheduled_tasks',
        icon: 'inbox',
        action: 'Fetching your unscheduled tasks',
        details: `Found ${tasks.length} task(s) without a scheduled time`,
        status: 'complete',
        timestamp: new Date().toISOString(),
      },
      tasks,
      count: tasks.length
    };
  },
});

// ─── Tool: auto_schedule_tasks ────────────────────────────────────────────────

export const autoScheduleTasksTool = createTool({
  id: "auto_schedule_tasks",
  description: "Automatically schedules a list of unscheduled tasks in free slots on the calendar within a specified date range. Scheduled from 9 AM to 10 PM, back-to-back.",
  inputSchema: z.object({
    taskIds: z.array(z.string().uuid()).min(1).describe(
      'UUIDs of the tasks to schedule. Always pass the IDs returned from get_unscheduled_tasks.'
    ),
    startDate: z.string().describe('ISO 8601 start of the scheduling window'),
    endDate: z.string().describe('ISO 8601 end of the scheduling window'),
    workingHoursStart: z.number().int().min(0).max(23).optional().default(9),
    workingHoursEnd: z.number().int().min(0).max(23).optional().default(22),
    excludeWeekends: z.boolean().optional().default(true),
    taskDurationMinutes: z.number().int().min(15).max(480).optional().default(60),
  }),
  execute: async (inputData, context) => {
    const userId = context?.requestContext?.get("userId") as string;
    if (!userId) return { error: "Not authenticated." };

    const contextOrgId   = context?.requestContext?.get("orgId")   as string;
    const contextSpaceId = context?.requestContext?.get("spaceId") as string;
    const resolved = await resolveOrgSpace(userId, contextOrgId, contextSpaceId);
    if (!resolved) return { error: "Personal organisation or workspace not found." };
    const { orgId, spaceId } = resolved;

    const startWindow = new Date(inputData.startDate);
    const endWindow = new Date(inputData.endDate);
    
    if (isNaN(startWindow.getTime()) || isNaN(endWindow.getTime())) {
      return { error: "Invalid date format for startDate or endDate." };
    }

    await emitActivity(context, {
      agentLabel: "Scheduler",
      action: "Loading calendar events",
      status: "running",
    });

    // 1. Fetch existing scheduled tasks/events in range to check for conflicts
    const queryParams: any[] = [userId, startWindow, endWindow, inputData.taskIds];

    const conflictResult = await pool.query(
      `SELECT DISTINCT t.id, t.title, t.start_date, t.due_date, t.is_all_day
       FROM public.tasks t
       WHERE t.deleted_at IS NULL
         AND t.start_date IS NOT NULL
         AND t.due_date IS NOT NULL
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
         AND NOT (t.id = ANY($4::uuid[]))`,
      queryParams
    );

    const busyIntervals = conflictResult.rows.map((row: any) => {
      const start = new Date(row.start_date);
      const end = new Date(row.due_date);
      if (row.is_all_day) {
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
      }
      return { start, end, title: row.title };
    });

    await emitActivity(context, {
      agentLabel: "Scheduler",
      action: "Loading tasks backlog",
      status: "running",
    });

    // 2. Fetch tasks to schedule
    const tasksResult = await pool.query(
      `SELECT t.id, t.title, t.priority, t.status, t.org_id, t.space_id
       FROM public.tasks t
       WHERE t.deleted_at IS NULL
         AND t.id = ANY($2::uuid[])
         AND (
           t.created_by = $1
           OR t.id IN (SELECT task_id FROM public.task_assignees WHERE user_id = $1)
           OR t.space_id IN (SELECT space_id FROM public.space_members WHERE user_id = $1)
         )`,
      [userId, inputData.taskIds]
    );

    // Retain the requested taskIds sorting
    const tasksToSchedule = inputData.taskIds
      .map((id: string) => tasksResult.rows.find((t: any) => t.id === id))
      .filter(Boolean);

    if (tasksToSchedule.length === 0) {
      return { scheduledCount: 0, scheduledTasks: [], message: "No tasks found that require scheduling." };
    }

    await emitActivity(context, {
      agentLabel: "Scheduler",
      action: "Finding free slots on calendar",
      status: "running",
    });

    // 3. Perform slot finding algorithm
    const scheduledTasks: any[] = [];
    const workingStart = inputData.workingHoursStart ?? 9;
    const workingEnd = inputData.workingHoursEnd ?? 22;
    const excludeWeekends = inputData.excludeWeekends ?? true;
    const durationMs = (inputData.taskDurationMinutes ?? 60) * 60 * 1000;

    let dayPointer = new Date(startWindow);
    dayPointer.setHours(0, 0, 0, 0);

    let currentTaskIndex = 0;

    while (dayPointer <= endWindow && currentTaskIndex < tasksToSchedule.length) {
      const dayOfWeek = dayPointer.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

      if (excludeWeekends && isWeekend) {
        dayPointer.setDate(dayPointer.getDate() + 1);
        continue;
      }

      const dayStart = new Date(dayPointer);
      dayStart.setHours(workingStart, 0, 0, 0);

      const dayEnd = new Date(dayPointer);
      dayEnd.setHours(workingEnd, 0, 0, 0);

      const now = new Date();
      if (dayStart < now) {
        if (now >= dayEnd) {
          dayPointer.setDate(dayPointer.getDate() + 1);
          continue;
        }
        dayStart.setTime(now.getTime());
        // Clean round to the next 30 minutes
        const mins = dayStart.getMinutes();
        if (mins > 0 && mins <= 30) {
          dayStart.setMinutes(30, 0, 0);
        } else if (mins > 30) {
          dayStart.setHours(dayStart.getHours() + 1, 0, 0, 0);
        } else {
          dayStart.setMinutes(0, 0, 0);
        }
      }

      let slotStart = new Date(dayStart);

      while (
        slotStart.getTime() + durationMs <= dayEnd.getTime() &&
        currentTaskIndex < tasksToSchedule.length
      ) {
        const slotEnd = new Date(slotStart.getTime() + durationMs);

        // Check conflict
        const hasConflict = busyIntervals.some((busy: any) => {
          return busy.start < slotEnd && busy.end > slotStart;
        });

        if (!hasConflict) {
          const task = tasksToSchedule[currentTaskIndex];
          
          busyIntervals.push({ start: new Date(slotStart), end: new Date(slotEnd), title: task.title });
          
          scheduledTasks.push({
            task,
            start_date: new Date(slotStart),
            due_date: new Date(slotEnd),
          });

          currentTaskIndex++;
          slotStart.setTime(slotEnd.getTime()); // Schedule back-to-back
        } else {
          // Increment by 30 mins to search next potential slot
          slotStart.setTime(slotStart.getTime() + 30 * 60 * 1000);
        }
      }

      dayPointer.setDate(dayPointer.getDate() + 1);
    }

    // 4. Update the database for all successfully scheduled tasks
    await emitActivity(context, {
      agentLabel: "Scheduler",
      action: "Saving scheduled tasks",
      status: "running",
    });

    const results = [];
    for (const item of scheduledTasks) {
      try {
        const itemOrgId = item.task.org_id || orgId;
        const itemSpaceId = item.task.space_id || spaceId;

        const updated = await orgTaskService.updateTask(
          { orgId: itemOrgId, spaceId: itemSpaceId },
          item.task.id,
          userId,
          {
            start_date: item.start_date,
            due_date: item.due_date,
            status: item.task.status === TaskStatus.BACKLOG ? TaskStatus.TODO : undefined, // Promote BACKLOG tasks to TODO
          }
        );
        if (updated) {
          results.push({
            id: updated.id,
            title: updated.title,
            start_date: updated.start_date,
            due_date: updated.due_date,
            status: updated.status,
          });
        }
      } catch (e: any) {
        results.push({
          id: item.task.id,
          title: item.task.title,
          error: e.message || "Failed to update task dates",
        });
      }
    }

    const scheduledCount = results.filter(r => !r.error).length;
    const unscheduledCount = tasksToSchedule.length - scheduledCount;

    await emitActivity(context, {
      agentLabel: "Scheduler",
      action: "Scheduling tasks into free time slots",
      status: "complete",
    });

    return {
      activity: {
        agent: 'keilhq-scheduler-agent',
        agentLabel: 'Scheduler',
        tool: 'auto_schedule_tasks',
        icon: 'clock',
        action: 'Scheduling tasks into free time slots',
        details: `Scheduled ${scheduledCount} task(s). ${unscheduledCount} could not be placed.`,
        status: 'complete',
        timestamp: new Date().toISOString(),
      },
      scheduledCount,
      scheduledTasks: results,
      unscheduledTasks: tasksToSchedule.slice(scheduledCount).map((t: any) => ({ id: t.id, title: t.title, priority: t.priority })),
      message: `Successfully scheduled ${scheduledCount} tasks. ${unscheduledCount} tasks remain unscheduled due to full calendar space.`,
    };
  },
});
