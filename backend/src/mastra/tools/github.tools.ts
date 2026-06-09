import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import * as githubService from "../../services/github.service";
import * as orgTaskService from "../../services/org-task.service";
import * as personalTaskService from "../../services/personal-task.service";
import { config } from "../../config";
import { ActivityEvent } from "../types/activity";
import { emitActivity } from "../lib/activity-stream";


// Tool helper: parse repo from input, ensuring it's valid format
const repoSchema = z.string().describe("The GitHub repository in the format 'owner/repo' (e.g. 'facebook/react')");

export const listGitHubIssuesTool = createTool({
  id: "list_github_issues",
  description: "List issues in a given GitHub repository. Filters out PRs. Returns issue summaries.",
  inputSchema: z.object({
    repo: repoSchema,
    state: z.enum(["open", "closed", "all"]).optional().default("open").describe("State of the issues to return"),
  }),
  execute: async (inputData, context) => {
    const userId = context?.requestContext?.get("userId") as string;
    if (!userId) return { error: "Not authenticated." };

    await emitActivity(context, {
      agentLabel: "GitHub",
      action: "Listing issues",
      status: "running",
    });

    try {
      const issues = await githubService.listIssues(userId, inputData.repo, inputData.state);
      const summary = issues.map(issue => ({
        number: issue.number,
        title: issue.title,
        state: issue.state,
        html_url: issue.html_url,
        creator: issue.user?.login,
        comments_count: issue.comments,
        created_at: issue.created_at,
        body_preview: issue.body ? (issue.body.slice(0, 150) + (issue.body.length > 150 ? "..." : "")) : "",
      }));

      const activity: ActivityEvent = {
        agent: 'keilhq-github-agent',
        agentLabel: 'GitHub',
        tool: 'list_github_issues',
        icon: 'github',
        action: `Listing issues in ${inputData.repo}`,
        details: `Found ${summary.length} open issue(s)`,
        status: 'complete',
        timestamp: new Date().toISOString(),
      };

      await emitActivity(context, {
        agentLabel: "GitHub",
        action: `Listing issues in ${inputData.repo}`,
        status: "complete",
      });

      return { activity, issues: summary, count: summary.length };
    } catch (err: any) {
      return { error: err.message || "Failed to list GitHub issues" };
    }
  },
});

export const getGitHubIssueTool = createTool({
  id: "get_github_issue",
  description: "Get detailed information about a single GitHub issue by its number.",
  inputSchema: z.object({
    repo: repoSchema,
    issueNumber: z.number().int().describe("The issue number (e.g. 42)"),
  }),
  execute: async (inputData, context) => {
    const userId = context?.requestContext?.get("userId") as string;
    if (!userId) return { error: "Not authenticated." };

    await emitActivity(context, {
      agentLabel: "GitHub",
      action: "Fetching issue",
      status: "running",
    });

    try {
      const issue = await githubService.getIssue(userId, inputData.repo, inputData.issueNumber);

      const activity: ActivityEvent = {
        agent: 'keilhq-github-agent',
        agentLabel: 'GitHub',
        tool: 'get_github_issue',
        icon: 'github',
        action: `Reading issue #${inputData.issueNumber} in ${inputData.repo}`,
        details: `Fetched issue: "${issue.title}"`,
        status: 'complete',
        timestamp: new Date().toISOString(),
      };

      await emitActivity(context, {
        agentLabel: "GitHub",
        action: `Reading issue #${inputData.issueNumber} in ${inputData.repo}`,
        status: "complete",
      });

      return {
        activity,
        issue: {
          number: issue.number,
          title: issue.title,
          body: issue.body,
          state: issue.state,
          html_url: issue.html_url,
          creator: issue.user?.login,
          comments_count: issue.comments,
          created_at: issue.created_at,
          updated_at: issue.updated_at,
        }
      };
    } catch (err: any) {
      return { error: err.message || "Failed to get GitHub issue" };
    }
  },
});

export const listGitHubPRsTool = createTool({
  id: "list_github_prs",
  description: "List pull requests in a given GitHub repository.",
  inputSchema: z.object({
    repo: repoSchema,
    state: z.enum(["open", "closed", "all"]).optional().default("open").describe("State of the pull requests to return"),
  }),
  execute: async (inputData, context) => {
    const userId = context?.requestContext?.get("userId") as string;
    if (!userId) return { error: "Not authenticated." };

    await emitActivity(context, {
      agentLabel: "GitHub",
      action: "Listing pull requests",
      status: "running",
    });

    try {
      const prs = await githubService.listPullRequests(userId, inputData.repo, inputData.state);
      const summary = prs.map(pr => ({
        number: pr.number,
        title: pr.title,
        state: pr.state,
        html_url: pr.html_url,
        creator: pr.user?.login,
        created_at: pr.created_at,
        body_preview: pr.body ? (pr.body.slice(0, 150) + (pr.body.length > 150 ? "..." : "")) : "",
      }));

      const activity: ActivityEvent = {
        agent: 'keilhq-github-agent',
        agentLabel: 'GitHub',
        tool: 'list_github_prs',
        icon: 'git-pull-request',
        action: `Listing pull requests in ${inputData.repo}`,
        details: `Found ${summary.length} PR(s)`,
        status: 'complete',
        timestamp: new Date().toISOString(),
      };

      await emitActivity(context, {
        agentLabel: "GitHub",
        action: `Listing pull requests in ${inputData.repo}`,
        status: "complete",
      });

      return { activity, prs: summary, count: summary.length };
    } catch (err: any) {
      return { error: err.message || "Failed to list GitHub pull requests" };
    }
  },
});

export const listGitHubContributorsTool = createTool({
  id: "list_github_contributors",
  description: "List contributors for a given GitHub repository with their contribution counts.",
  inputSchema: z.object({
    repo: repoSchema,
  }),
  execute: async (inputData, context) => {
    const userId = context?.requestContext?.get("userId") as string;
    if (!userId) return { error: "Not authenticated." };

    await emitActivity(context, {
      agentLabel: "GitHub",
      action: "Looking up contributors",
      status: "running",
    });

    try {
      const contributors = await githubService.listContributors(userId, inputData.repo);

      const activity: ActivityEvent = {
        agent: 'keilhq-github-agent',
        agentLabel: 'GitHub',
        tool: 'list_github_contributors',
        icon: 'users',
        action: `Looking up contributors in ${inputData.repo}`,
        details: `Found ${contributors.length} contributor(s)`,
        status: 'complete',
        timestamp: new Date().toISOString(),
      };

      await emitActivity(context, {
        agentLabel: "GitHub",
        action: `Looking up contributors in ${inputData.repo}`,
        status: "complete",
      });

      return { activity, contributors, count: contributors.length };
    } catch (err: any) {
      return { error: err.message || "Failed to list GitHub contributors" };
    }
  },
});

export const createGitHubIssueFromTaskTool = createTool({
  id: "create_github_issue_from_task",
  description: "Create a GitHub issue in the specified repository using context from a KeilHQ task.",
  inputSchema: z.object({
    repo: repoSchema,
    taskId: z.string().uuid().describe("The UUID of the KeilHQ task to convert to a GitHub issue"),
    isPersonal: z.boolean().optional().default(false).describe("Whether the target task is a personal task"),
  }),
  execute: async (inputData, context) => {
    const userId = context?.requestContext?.get("userId") as string;
    if (!userId) return { error: "Not authenticated." };

    await emitActivity(context, {
      agentLabel: "GitHub",
      action: "Fetching task details",
      status: "running",
    });

    try {
      // 1. Fetch the task details (automatically detecting if personal or org task)
      let taskTitle = "";
      let taskDescription = "";
      let taskObjective = "";
      let taskSuccessCriteria = "";
      let isPersonal = false;

      // First try to find in org tasks (public.tasks)
      const orgTask = await orgTaskService.getTaskById(inputData.taskId);
      if (orgTask) {
        taskTitle = orgTask.title;
        taskDescription = orgTask.description || "";
        taskObjective = orgTask.objective || "";
        taskSuccessCriteria = orgTask.success_criteria || "";
        isPersonal = false;
      } else {
        // If not found, try to find in personal tasks (public.personal_tasks)
        const personalTask = await personalTaskService.getPersonalTaskById(inputData.taskId, userId);
        if (!personalTask) {
          return { error: `Task not found with ID ${inputData.taskId}` };
        }
        taskTitle = personalTask.title;
        taskDescription = personalTask.description || "";
        taskObjective = personalTask.objective || "";
        taskSuccessCriteria = personalTask.success_criteria || "";
        isPersonal = true;
      }

      // 2. Format the body using markdown template
      let body = "";
      if (taskDescription) {
        body += `## Description\n${taskDescription}\n\n`;
      }
      if (taskObjective) {
        body += `## Objectives\n${taskObjective}\n\n`;
      }
      if (taskSuccessCriteria) {
        body += `## Success Criteria\n${taskSuccessCriteria}\n\n`;
      }
      body += `\n---\n*Created from KeilHQ Task: [${taskTitle}](${config.frontendUrl}/tasks/${inputData.taskId})*`;

      // 3. Create the issue on GitHub
      await emitActivity(context, {
        agentLabel: "GitHub",
        action: "Creating issue on GitHub",
        status: "running",
      });

      const result = await githubService.createIssue(userId, inputData.repo, taskTitle, body);

      // 4. Link the task to the GitHub issue
      await githubService.linkTaskToGitHubIssue(
        inputData.taskId,
        isPersonal,
        result.html_url,
        result.number,
        inputData.repo
      );

      const activity: ActivityEvent = {
        agent: 'keilhq-github-agent',
        agentLabel: 'GitHub',
        tool: 'create_github_issue_from_task',
        icon: 'git-branch',
        action: 'Creating GitHub issue from task',
        details: `Created issue #${result.number} in ${inputData.repo}`,
        status: 'complete',
        timestamp: new Date().toISOString(),
      };

      await emitActivity(context, {
        agentLabel: "GitHub",
        action: "Creating GitHub issue from task",
        status: "complete",
      });

      return {
        activity,
        success: true,
        issueNumber: result.number,
        issueUrl: result.html_url,
        message: `Successfully created GitHub issue #${result.number} and linked it to the task.`
      };
    } catch (err: any) {
      return { error: err.message || "Failed to create GitHub issue from task" };
    }
  },
});
