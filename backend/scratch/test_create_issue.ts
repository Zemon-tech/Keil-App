import "dotenv/config";
import pool from "../src/config/pg";
import * as githubService from "../src/services/github.service";
import * as orgTaskService from "../src/services/org-task.service";

async function main() {
  try {
    // 1. Find the user who has connected GitHub
    const resUsers = await pool.query(`
      SELECT user_id, provider, created_at 
      FROM public.user_integrations 
      WHERE provider = 'github';
    `);
    console.log("Connected GitHub Users:", resUsers.rows);

    if (resUsers.rows.length === 0) {
      console.log("No users have connected GitHub yet!");
      process.exit(0);
    }

    const userId = resUsers.rows[0].user_id;
    const taskId = 'b5918652-3419-4798-9e62-62b94fec02d6';
    const repo = 'Zemon-tech/Keil-App';

    console.log(`Running test for userId=${userId}, taskId=${taskId}, repo=${repo}`);

    // Fetch the task details
    const task = await orgTaskService.getTaskById(taskId);
    if (!task) {
      console.error("Task not found!");
      process.exit(1);
    }
    console.log("Task details fetched:", { title: task.title, description: task.description });

    // Format body
    let body = "";
    if (task.description) {
      body += `## Description\n${task.description}\n\n`;
    }
    if (task.objective) {
      body += `## Objectives\n${task.objective}\n\n`;
    }
    if (task.success_criteria) {
      body += `## Success Criteria\n${task.success_criteria}\n\n`;
    }
    body += `\n---\n*Created from KeilHQ Task: [${task.title}](http://localhost:5173/tasks/${taskId})*`;

    // Attempt issue creation on GitHub
    console.log("Calling githubService.createIssue...");
    const result = await githubService.createIssue(userId, repo, task.title, body);
    console.log("GitHub Issue created successfully:", result);

    // Link task
    console.log("Calling githubService.linkTaskToGitHubIssue...");
    await githubService.linkTaskToGitHubIssue(taskId, false, result.html_url, result.number, repo);
    console.log("Task linked successfully!");

  } catch (err: any) {
    console.error("CRITICAL ERROR ENCOUNTERED:", err);
  } finally {
    process.exit(0);
  }
}

main();
