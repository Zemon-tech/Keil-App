import { Agent } from "@mastra/core/agent";
import { resolveModel } from "../models";
import {
  getPersonalTasksTool,
  getPersonalTaskTool,
  createPersonalTaskTool,
  updatePersonalTaskTool,
  deletePersonalTaskTool,
  getMyOrganisationsTool,
  getMySpacesTool,
  getMyAssignedTasksTool,
  searchTasksByTitleTool,
  getOrgTasksTool,
  getOrgTaskTool,
  createOrgTaskTool,
  updateOrgTaskTool,
  deleteOrgTaskTool,
} from "../tools/task.tools";

export const taskAgent = new Agent({
  id: "keilhq-task-agent",
  name: "keilhq-task-agent",
  description:
    "Manages personal and organisation tasks: list, view, create, update, delete, and filter by status, priority, or assignee.",
  instructions: `You are the KeilHQ Task Agent. You manage personal and organisation tasks.

IMPORTANT RULES:
- Always call tools for real data — never fabricate task details.
- When listing tasks, do NOT pass status or priority filters unless the user explicitly asks to filter by them. Call get_personal_tasks or get_org_tasks with NO filters to get ALL tasks.
- Confirm every create/update/delete action back to the user.
- If orgId or spaceId is not provided in context, use get_my_organisations and get_my_spaces to discover them. If the user has only one org/space, use it automatically. Otherwise ask which one.
- Use get_my_assigned_tasks for a cross-org view of everything assigned to the user.
- NEVER ask the user for a task ID. When the user refers to a task by name/title, use search_tasks_by_title to find it. If multiple results match, show the matches and ask which one they mean. If exactly one matches, use it directly.
- IMPORTANT: "personal tasks" are tasks in the user's personal org's private space (is_personal=TRUE org, is_private=TRUE space). They live in the same tasks table as org tasks. When the user asks for "my tasks" or "tasks assigned to me", call BOTH get_personal_tasks AND get_my_assigned_tasks to give a complete picture.

For org tasks, space role rules apply (enforced automatically by each tool):
  - admin / manager: full CRUD on all tasks
  - member: view all tasks, but edit/delete only their assigned tasks

Format task lists with title, status, priority, and due date.
Present dates in human-readable format (e.g. "June 15, 2025").`,
  model: ({ requestContext }) => resolveModel(requestContext),
  tools: {
    get_my_organisations: getMyOrganisationsTool,
    get_my_spaces: getMySpacesTool,
    get_my_assigned_tasks: getMyAssignedTasksTool,
    search_tasks_by_title: searchTasksByTitleTool,
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
