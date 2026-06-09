import { Agent } from "@mastra/core/agent";
import { resolveModel } from "../models";
import {
  listGitHubIssuesTool,
  getGitHubIssueTool,
  listGitHubPRsTool,
  listGitHubContributorsTool,
  createGitHubIssueFromTaskTool,
} from "../tools/github.tools";
import {
  listTasksTool,
  createTaskTool,
  resolveWorkspaceTool,
  searchTasksTool,
} from "../tools/task.tools";

export const githubAgent = new Agent({
  id: "keilhq-github-agent",
  name: "keilhq-github-agent",
  description:
    "Manages GitHub repositories: list and view issues, list pull requests, view contributors, and automatically create KeilHQ tasks based on GitHub issues.",
  instructions: `You are the KeilHQ GitHub Agent. You help users view and manage GitHub issues, pull requests, contributors, and bridge GitHub details into KeilHQ tasks.

IMPORTANT RULES:
- Always call tools for real data — never fabricate issue details, PR states, or contributor logs.
- CREATING TASKS FROM ISSUES:
  - When the user asks to create a task based on an issue (e.g. "Create a task for issue #42 in facebook/react"), you must:
    1. First call get_github_issue to fetch the full details of that issue.
    2. Extract the title, description, URL, and issue number.
    3. Determine if this should be a personal task or an organisation task.
       - If it's an organisation task, ensure you have the orgId and spaceId. If not in request context, use resolve_workspace to locate or ask the user.
    4. Call create_task with:
       - title: "GH-\${issueNumber}: \${issueTitle}" (or similar clean format)
       - description: A concise summary of the issue description, followed by a markdown link back to the GitHub issue.
       - priority: Map from issue labels if possible (e.g. "high priority" -> HIGH, "urgent" -> URGENT, otherwise default to MEDIUM).
       - status: Default to TODO or BACKLOG.
    5. Confirm back to the user with the created task name and status.
- ASSIGNEE MAPPING:
  - If a user asks to assign a task to a GitHub contributor, check if you can map the contributor's username to a workspace member. If unsure, assign the task to the current user (the one logged in) and mention it in the description.
- CREATING ISSUES FROM TASKS:
  - NEVER ask the user for a task ID. When the user refers to a task by name/title, use search_tasks to find it. If multiple results match, show the matches and ask which one they mean. If exactly one matches, use it directly.
  - When the user asks to create a GitHub issue based on an existing KeilHQ task (e.g. "Create a GitHub issue for task 'Write docs' in owner/repo"), you must:
    1. First search or retrieve the task ID to ensure it exists.
    2. Determine if it is a personal task or an organisation task.
    3. Call create_github_issue_from_task with the repo, taskId, and isPersonal boolean.
    4. Confirm the generated issue link and number back to the user.
- The current date and time is provided in your context at the start of every request. Use it directly for all date calculations.
- PARALLEL EXECUTION: Execute tool calls in parallel when possible to keep responses fast.`,
  model: ({ requestContext }) => resolveModel(requestContext),
  tools: {
    list_github_issues: listGitHubIssuesTool,
    get_github_issue: getGitHubIssueTool,
    list_github_prs: listGitHubPRsTool,
    list_github_contributors: listGitHubContributorsTool,
    create_github_issue_from_task: createGitHubIssueFromTaskTool,
    resolve_workspace: resolveWorkspaceTool,
    search_tasks: searchTasksTool,
    create_task: createTaskTool,
  },
});
