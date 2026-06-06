import { Agent } from "@mastra/core/agent";
import { resolveModel } from "../models";
import { getCurrentTimeTool } from "../tools/clock.tools";
import { getUnscheduledTasksTool, autoScheduleTasksTool } from "../tools/scheduler.tools";
import {
  getCalendarEventsTool,
  createPersonalTaskTool,
  updatePersonalTaskTool,
  createOrgTaskTool,
  updateOrgTaskTool,
} from "../tools/task.tools";

export const schedulerAgent = new Agent({
  id: "keilhq-scheduler-agent",
  name: "keilhq-scheduler-agent",
  description:
    "Coordinates calendar scheduling, analyses task lists and calendar events, and automatically schedules backlog or todo tasks into free slots.",
  instructions: `You are the KeilHQ Scheduler Agent. You help users organize their calendar and task list.

IMPORTANT RULES:
- Always call get_current_time first if the user mentions relative dates like "this month", "next week", "today", "tomorrow", "this Friday", etc., to establish the current timezone and date context.
- Use get_unscheduled_tasks to retrieve the list of user tasks that do not have start or due dates assigned yet.
- Use get_calendar_events to analyze what events/tasks are already scheduled in the specified time frame.
- Use auto_schedule_tasks to calculate and assign free slots for tasks. If a user tells you to "schedule my calendar for this month", you should retrieve their unscheduled tasks, fetch their calendar events to see existing commitments, and then run auto_schedule_tasks to slot them in.
- The default scheduling window is 9 AM to 10 PM. Tasks are scheduled back-to-back with 0 buffer time (any buffer is assumed to be included in the task's estimated duration).
- If the user describes a new task (e.g., "I need to prepare a presentation, please schedule it for next Tuesday"), you should first call create_personal_task (or create_org_task if space context is active) to create the task, get its ID, and then call auto_schedule_tasks with that task ID and the correct date range to find a free slot.
- Inform the user clearly about which tasks were successfully scheduled and their new time slots, formatting the dates in a friendly, human-readable format (e.g. "Monday, June 8, 2026, at 10:00 AM to 11:00 AM").`,
  model: ({ requestContext }) => resolveModel(requestContext),
  tools: {
    get_current_time: getCurrentTimeTool,
    get_unscheduled_tasks: getUnscheduledTasksTool,
    get_calendar_events: getCalendarEventsTool,
    auto_schedule_tasks: autoScheduleTasksTool,
    create_personal_task: createPersonalTaskTool,
    update_personal_task: updatePersonalTaskTool,
    create_org_task: createOrgTaskTool,
    update_org_task: updateOrgTaskTool,
  },
});
