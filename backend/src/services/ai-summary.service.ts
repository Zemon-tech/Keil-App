/**
 * AI Summary Service
 *
 * Handles generation, persistence, rate limiting, debouncing, and
 * real-time delivery of task activity summaries.
 *
 * Architecture:
 * - Direct generateText() call via OpenRouter (no Mastra agent)
 * - One persisted summary per task (shared across all assignees)
 * - Auto-triggered on comment creation with 3s debounce
 * - Socket.IO push to assigned users on update
 */

import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { generateText } from "ai";
import pool from "../config/pg";
import { config } from "../config";
import { createServiceLogger } from "../lib/logger";
import {
  buildFullSummaryPrompt,
  buildIncrementalSummaryPrompt,
  type SummaryTaskContext,
  type SummaryComment,
} from "./ai-summary.prompts";

const log = createServiceLogger("ai-summary");

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TaskSummaryDTO {
  task_id: string;
  summary_text: string;
  comment_count: number;
  model_used: string;
  generated_at: string;
}

interface SummaryRow {
  task_id: string;
  summary_text: string;
  comment_count: number;
  model_used: string;
  generated_at: Date;
  generation_count_today: number;
  last_rate_limit_reset: Date;
}

// ─── Debounce & Concurrency Guards ───────────────────────────────────────────

/** Debounce timers keyed by taskId — prevents rapid-fire regeneration */
const debounceTimers = new Map<string, NodeJS.Timeout>();

/** Set of taskIds currently being generated — prevents concurrent generation */
const inFlightGenerations = new Set<string>();

/** Debounce delay in ms */
const DEBOUNCE_DELAY_MS = 3000;

// ─── Model Setup ─────────────────────────────────────────────────────────────

function getSummaryModel() {
  if (!config.openRouterApiKey) {
    throw new Error("OPENROUTER_API_KEY is not configured — AI summaries unavailable");
  }

  const provider = createOpenAICompatible({
    name: "openrouter-summary",
    apiKey: config.openRouterApiKey,
    baseURL: config.openRouterBaseUrl,
    headers: {
      "HTTP-Referer": config.frontendUrl || "http://localhost:5173",
      "X-Title": "KeilHQ-Summary",
    },
  });

  return provider(config.aiSummaryModel);
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Retrieves the cached summary for a task (if one exists).
 */
export async function getTaskSummary(taskId: string): Promise<TaskSummaryDTO | null> {
  const result = await pool.query<SummaryRow>(
    `SELECT task_id, summary_text, comment_count, model_used, generated_at
     FROM public.task_ai_summaries
     WHERE task_id = $1`,
    [taskId]
  );

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return {
    task_id: row.task_id,
    summary_text: row.summary_text,
    comment_count: row.comment_count,
    model_used: row.model_used,
    generated_at: row.generated_at.toISOString(),
  };
}

/**
 * Schedules summary generation with debouncing.
 * Called after a comment is created — delays 3s to batch rapid comments.
 * Fire-and-forget: errors are logged, never thrown to caller.
 */
export function scheduleSummaryGeneration(taskId: string): void {
  // Clear any existing timer for this task
  const existing = debounceTimers.get(taskId);
  if (existing) {
    clearTimeout(existing);
  }

  const timer = setTimeout(async () => {
    debounceTimers.delete(taskId);
    try {
      await generateTaskSummary(taskId);
    } catch (err) {
      log.error({ err, taskId }, "Scheduled summary generation failed");
    }
  }, DEBOUNCE_DELAY_MS);

  debounceTimers.set(taskId, timer);
}

/**
 * Generates (or regenerates) the summary for a task.
 * Handles rate limiting, concurrency guards, LLM call, persistence, and socket emission.
 *
 * @returns Object indicating outcome
 * @throws Never — all errors are caught and logged. Returns status object.
 */
export async function generateTaskSummary(
  taskId: string
): Promise<{ status: "generated" | "rate_limited" | "in_progress" | "no_comments" | "error"; message?: string }> {
  // ── Concurrency guard ─────────────────────────────────────────────────────
  if (inFlightGenerations.has(taskId)) {
    log.debug({ taskId }, "Summary generation already in-flight, skipping");
    return { status: "in_progress", message: "Summary is already being generated for this task." };
  }

  inFlightGenerations.add(taskId);
  const startTime = Date.now();

  try {
    // ── Fetch task context ────────────────────────────────────────────────────
    const taskResult = await pool.query(
      `SELECT id, title, status, priority, description, objective
       FROM public.tasks
       WHERE id = $1 AND deleted_at IS NULL`,
      [taskId]
    );

    if (taskResult.rows.length === 0) {
      log.warn({ taskId }, "Task not found or deleted, skipping summary");
      return { status: "error", message: "Task not found" };
    }

    const task = taskResult.rows[0];

    // ── Fetch comments (with author names) ───────────────────────────────────
    const totalCountResult = await pool.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM public.comments WHERE task_id = $1 AND deleted_at IS NULL`,
      [taskId]
    );
    const totalCommentCount = parseInt(totalCountResult.rows[0].count, 10);

    if (totalCommentCount === 0) {
      log.debug({ taskId }, "No comments on task, skipping summary generation");
      return { status: "no_comments" };
    }

    const commentsResult = await pool.query(
      `SELECT
        c.id,
        c.content,
        c.parent_comment_id,
        c.created_at,
        u.name AS author_name,
        u.email AS author_email,
        pc.user_id AS parent_user_id,
        pu.name AS parent_author_name,
        pu.email AS parent_author_email
      FROM public.comments c
      JOIN public.users u ON u.id = c.user_id
      LEFT JOIN public.comments pc ON pc.id = c.parent_comment_id
      LEFT JOIN public.users pu ON pu.id = pc.user_id
      WHERE c.task_id = $1 AND c.deleted_at IS NULL
      ORDER BY c.created_at ASC
      LIMIT $2`,
      [taskId, config.aiSummaryMaxComments]
    );

    const comments: SummaryComment[] = commentsResult.rows.map((row: any) => ({
      author_name: row.author_name || row.author_email || "Unknown",
      content: row.content,
      is_reply: !!row.parent_comment_id,
      parent_author_name: row.parent_author_name || row.parent_author_email || null,
    }));

    // ── Rate limit check ─────────────────────────────────────────────────────
    const existingResult = await pool.query<SummaryRow>(
      `SELECT * FROM public.task_ai_summaries WHERE task_id = $1`,
      [taskId]
    );

    const existing = existingResult.rows[0] || null;
    const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

    let currentDayCount = 0;
    if (existing) {
      const lastReset = existing.last_rate_limit_reset instanceof Date
        ? existing.last_rate_limit_reset.toISOString().split("T")[0]
        : String(existing.last_rate_limit_reset);

      if (lastReset === today) {
        currentDayCount = existing.generation_count_today;
      }
      // If lastReset !== today, count resets to 0
    }

    if (currentDayCount >= config.aiSummaryRateLimit) {
      log.info({ taskId, currentDayCount }, "Summary rate limit reached for today");
      return { status: "rate_limited", message: "Daily summary generation limit (100) reached for this task. Try again tomorrow." };
    }

    // ── Build prompt ─────────────────────────────────────────────────────────
    const taskContext: SummaryTaskContext = {
      title: task.title,
      status: task.status,
      priority: task.priority,
      description: task.description,
      objective: task.objective,
    };

    let prompt: string;
    const isIncremental = existing && existing.comment_count < totalCommentCount;

    if (isIncremental) {
      // Only send comments newer than what was last summarised
      const newComments = comments.slice(existing.comment_count);
      if (newComments.length === 0) {
        log.debug({ taskId }, "No new comments since last summary, skipping");
        return { status: "generated" };
      }
      prompt = buildIncrementalSummaryPrompt(taskContext, existing.summary_text, newComments);
    } else {
      prompt = buildFullSummaryPrompt(taskContext, comments, totalCommentCount);
    }

    // ── Call LLM ─────────────────────────────────────────────────────────────
    log.info({ taskId, isIncremental, commentCount: totalCommentCount }, "Generating AI summary");

    let llmResult: string;
    try {
      const response = await generateText({
        model: getSummaryModel(),
        prompt,
        maxOutputTokens: 300,
        temperature: 0.3,
      });
      llmResult = response.text.trim();
    } catch (llmErr: any) {
      log.error({ err: llmErr, taskId }, "LLM call failed for summary generation");

      // Retry once after 5s
      await new Promise((resolve) => setTimeout(resolve, 5000));
      try {
        const retryResponse = await generateText({
          model: getSummaryModel(),
          prompt,
          maxOutputTokens: 300,
          temperature: 0.3,
        });
        llmResult = retryResponse.text.trim();
        log.info({ taskId }, "LLM retry succeeded");
      } catch (retryErr) {
        log.error({ err: retryErr, taskId }, "LLM retry also failed");
        return { status: "error", message: "AI service unavailable. Will retry on next comment." };
      }
    }

    // ── Validate response ────────────────────────────────────────────────────
    if (!llmResult || llmResult.length < 20) {
      log.warn({ taskId, response: llmResult }, "LLM returned too-short response, discarding");
      return { status: "error", message: "AI returned an invalid response" };
    }

    if (llmResult.length > 2000) {
      llmResult = llmResult.substring(0, 2000);
    }

    // Handle incremental [NO_UPDATE] response
    let finalSummary: string;
    if (isIncremental && llmResult === "[NO_UPDATE]") {
      log.debug({ taskId }, "Incremental summary returned [NO_UPDATE], keeping existing");
      // Still update the comment_count so we don't re-process the same comments
      await pool.query(
        `UPDATE public.task_ai_summaries
         SET comment_count = $2, generated_at = NOW(),
             generation_count_today = CASE WHEN last_rate_limit_reset = CURRENT_DATE THEN generation_count_today + 1 ELSE 1 END,
             last_rate_limit_reset = CURRENT_DATE
         WHERE task_id = $1`,
        [taskId, totalCommentCount]
      );
      return { status: "generated" };
    } else if (isIncremental && existing) {
      finalSummary = existing.summary_text + " " + llmResult;
    } else {
      finalSummary = llmResult;
    }

    // ── Persist ──────────────────────────────────────────────────────────────
    const modelUsed = config.aiSummaryModel;
    const newCount = currentDayCount + 1;

    await pool.query(
      `INSERT INTO public.task_ai_summaries (task_id, summary_text, comment_count, model_used, generated_at, generation_count_today, last_rate_limit_reset)
       VALUES ($1, $2, $3, $4, NOW(), $5, CURRENT_DATE)
       ON CONFLICT (task_id)
       DO UPDATE SET
         summary_text = EXCLUDED.summary_text,
         comment_count = EXCLUDED.comment_count,
         model_used = EXCLUDED.model_used,
         generated_at = NOW(),
         generation_count_today = CASE
           WHEN public.task_ai_summaries.last_rate_limit_reset = CURRENT_DATE
           THEN public.task_ai_summaries.generation_count_today + 1
           ELSE 1
         END,
         last_rate_limit_reset = CURRENT_DATE`,
      [taskId, finalSummary, totalCommentCount, modelUsed, newCount]
    );

    // ── Emit socket event ────────────────────────────────────────────────────
    try {
      await emitSummaryUpdate(taskId, finalSummary, totalCommentCount);
    } catch (socketErr) {
      log.warn({ err: socketErr, taskId }, "Failed to emit summary socket event");
    }

    const elapsed = Date.now() - startTime;
    log.info({ taskId, elapsed, commentCount: totalCommentCount, isIncremental }, "Summary generated successfully");

    return { status: "generated" };
  } catch (err) {
    log.error({ err, taskId }, "Unexpected error in generateTaskSummary");
    return { status: "error", message: "An unexpected error occurred" };
  } finally {
    inFlightGenerations.delete(taskId);
  }
}

/**
 * Checks if a generation is currently in-flight for the given task.
 */
export function isGenerationInFlight(taskId: string): boolean {
  return inFlightGenerations.has(taskId);
}

// ─── Socket Emission ──────────────────────────────────────────────────────────

/**
 * Emits `task_summary_updated` to all users assigned to the task.
 * Uses lazy import to avoid circular dependency with socket.ts.
 */
async function emitSummaryUpdate(taskId: string, summaryText: string, commentCount: number): Promise<void> {
  // Lazy import to avoid circular dependency
  let io: any;
  try {
    const socketModule = require("../socket");
    io = socketModule.io;
  } catch {
    log.debug({ taskId }, "Socket.IO not available, skipping emit");
    return;
  }

  if (!io) {
    log.debug({ taskId }, "Socket.IO instance not initialized, skipping emit");
    return;
  }

  // Get all assigned user IDs for this task
  const assigneesResult = await pool.query<{ user_id: string }>(
    `SELECT user_id FROM public.task_assignees WHERE task_id = $1`,
    [taskId]
  );

  // Also include the task creator
  const creatorResult = await pool.query<{ created_by: string }>(
    `SELECT created_by FROM public.tasks WHERE id = $1`,
    [taskId]
  );

  const recipientIds = new Set<string>();
  assigneesResult.rows.forEach((row) => recipientIds.add(row.user_id));
  if (creatorResult.rows[0]?.created_by) {
    recipientIds.add(creatorResult.rows[0].created_by);
  }

  const payload = {
    taskId,
    summary: summaryText,
    commentCount,
    generatedAt: new Date().toISOString(),
  };

  recipientIds.forEach((userId) => {
    io.to(`user:${userId}`).emit("task_summary_updated", payload);
  });

  log.debug({ taskId, recipientCount: recipientIds.size }, "Emitted task_summary_updated");
}
