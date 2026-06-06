import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import pool from "../../config/pg";
import * as orgTaskService from "../../services/org-task.service";
import { TaskStatus } from "../../types/enums";

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

    const personal = await getPersonalOrgSpace(userId);
    if (!personal) return { error: "Personal organisation not found." };

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
      [userId, personal.orgId, personal.spaceId, inputData.limit ?? 20]
    );

    return { tasks: result.rows, count: result.rows.length };
  },
});

// ─── Tool: auto_schedule_tasks ────────────────────────────────────────────────

export const autoScheduleTasksTool = createTool({
  id: "auto_schedule_tasks",
  description: "Automatically schedules a list of unscheduled tasks (or all unscheduled tasks if taskIds is omitted) in free slots on the calendar within a specified date range. Scheduled from 9 AM to 10 PM, back-to-back.",
  inputSchema: z.object({
    startDate: z.string().describe("ISO 8601 date string for start of scheduling window (e.g. '2026-06-01' or '2026-06-01T00:00:00Z')"),
    endDate: z.string().describe("ISO 8601 date string for end of scheduling window (e.g. '2026-06-30' or '2026-06-30T23:59:59Z')"),
    workingHoursStart: z.number().int().min(0).max(23).optional().default(9).describe("Start hour of day to schedule (0-23)"),
    workingHoursEnd: z.number().int().min(0).max(23).optional().default(22).describe("End hour of day to schedule (0-23)"),
    excludeWeekends: z.boolean().optional().default(true).describe("Exclude Saturday and Sunday from scheduling"),
    taskDurationMinutes: z.number().int().min(15).max(480).optional().default(60).describe("Default duration for each task in minutes"),
    taskIds: z.array(z.string().uuid()).optional().describe("Optional list of specific task UUIDs to schedule. If omitted, schedules all pending unscheduled tasks."),
  }),
  execute: async (inputData, context) => {
    const userId = context?.requestContext?.get("userId") as string;
    if (!userId) return { error: "Not authenticated." };

    const personal = await getPersonalOrgSpace(userId);
    if (!personal) return { error: "Personal organisation not found." };

    const startWindow = new Date(inputData.startDate);
    const endWindow = new Date(inputData.endDate);
    
    if (isNaN(startWindow.getTime()) || isNaN(endWindow.getTime())) {
      return { error: "Invalid date format for startDate or endDate." };
    }

    // 1. Fetch existing scheduled tasks/events in range to check for conflicts
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
         )`,
      [userId, startWindow, endWindow]
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

    // 2. Fetch tasks to schedule
    let tasksToSchedule: any[] = [];
    if (inputData.taskIds && inputData.taskIds.length > 0) {
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
      tasksToSchedule = inputData.taskIds
        .map((id: string) => tasksResult.rows.find((t: any) => t.id === id))
        .filter(Boolean);
    } else {
      const tasksResult = await pool.query(
        `SELECT DISTINCT t.id, t.title, t.priority, t.status, t.org_id, t.space_id
         FROM public.tasks t
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
           t.created_at ASC`,
        [userId, personal.orgId, personal.spaceId]
      );
      tasksToSchedule = tasksResult.rows;
    }

    if (tasksToSchedule.length === 0) {
      return { scheduledCount: 0, scheduledTasks: [], message: "No tasks found that require scheduling." };
    }

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
    const results = [];
    for (const item of scheduledTasks) {
      try {
        const orgId = item.task.org_id || personal.orgId;
        const spaceId = item.task.space_id || personal.spaceId;

        const updated = await orgTaskService.updateTask(
          { orgId, spaceId },
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

    const unscheduledTasks = tasksToSchedule.slice(currentTaskIndex);

    return {
      scheduledCount: results.filter(r => !r.error).length,
      scheduledTasks: results,
      unscheduledTasks: unscheduledTasks.map(t => ({ id: t.id, title: t.title, priority: t.priority })),
      message: `Successfully scheduled ${results.filter(r => !r.error).length} tasks. ${unscheduledTasks.length} tasks remain unscheduled due to full calendar space.`,
    };
  },
});
