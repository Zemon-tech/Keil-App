import { Request, Response } from "express";
import { catchAsync } from "../utils/catchAsync";
import { ApiError } from "../utils/ApiError";
import { ApiResponse } from "../utils/ApiResponse";
import { orgTaskRepository } from "../repositories";

// ─── In-memory rate limiter ───────────────────────────────────────────────────
// Simple sliding-window rate limiter: max 30 requests per minute per IP.
// No external dependency required.

const rateLimitWindow = 60_000; // 1 minute in ms
const rateLimitMax = 30; // max requests per window

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    // Start a fresh window
    rateLimitMap.set(ip, { count: 1, resetAt: now + rateLimitWindow });
    return false;
  }

  entry.count += 1;
  if (entry.count > rateLimitMax) {
    return true;
  }

  return false;
}

// Prune stale entries periodically to prevent memory leak
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimitMap.entries()) {
    if (now > entry.resetAt) rateLimitMap.delete(ip);
  }
}, 5 * 60_000); // every 5 minutes

// ─── Helper ───────────────────────────────────────────────────────────────────

const toISO = (value: Date | string | null | undefined): string | null => {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
};

// ─── Public Task Endpoint ─────────────────────────────────────────────────────

/**
 * GET /api/v1/public/tasks/:taskId
 *
 * Unauthenticated read-only endpoint. Returns a sanitised view of a task
 * by its UUID. No auth required — task IDs are non-guessable UUIDs.
 *
 * Returns only display-safe fields:
 *  - No email addresses
 *  - No org_id / space_id / workspace internal fields
 *  - No billing or system data
 */
export const getPublicTask = catchAsync(async (req: Request, res: Response) => {
  // ── Rate limiting ──────────────────────────────────────────────────────────
  const ip =
    (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
    req.socket?.remoteAddress ||
    "unknown";

  if (isRateLimited(ip)) {
    res.status(429).json({
      success: false,
      message: "Too many requests. Please try again later.",
    });
    return;
  }

  // ── Fetch task ─────────────────────────────────────────────────────────────
  const taskId = req.params.taskId as string;

  if (!taskId) {
    throw new ApiError(400, "taskId is required");
  }

  // findWithAssignees returns the full task row + aggregated assignees
  const rawTask = await orgTaskRepository.findWithAssignees(taskId);

  if (!rawTask) {
    throw new ApiError(404, "Task not found");
  }

  // ── Fetch subtasks (only for top-level tasks) ─────────────────────────────
  let subtasks: Array<{ id: string; title: string; status: string }> = [];
  if (!rawTask.parent_task_id) {
    const rawSubtasks = await orgTaskRepository.findSubtasks(taskId);
    subtasks = rawSubtasks.map((s) => ({
      id: s.id,
      title: s.title,
      status: s.status,
    }));
  }

  // ── Fetch parent task title (for breadcrumb context) ──────────────────────
  let parent_task_title: string | null = null;
  if (rawTask.parent_task_id) {
    const parentTask = await orgTaskRepository.findById(rawTask.parent_task_id);
    if (parentTask) parent_task_title = parentTask.title;
  }

  // ── Build sanitised public response ───────────────────────────────────────
  // Assignees: name and id only — no email, no timestamps
  const publicAssignees = (rawTask.assignees ?? []).map((a) => ({
    id: a.id,
    name: a.name,
  }));

  const publicTask = {
    id: rawTask.id,
    title: rawTask.title,
    // type / event_type / location / is_all_day come from the raw DB row
    type: (rawTask as any).type as "task" | "event" | undefined,
    event_type: (rawTask as any).event_type as string | null | undefined,
    location: (rawTask as any).location as string | null | undefined,
    is_all_day: (rawTask as any).is_all_day as boolean | undefined,
    status: rawTask.status,
    priority: rawTask.priority,
    start_date: toISO(rawTask.start_date),
    due_date: toISO(rawTask.due_date),
    description: rawTask.description,
    objective: rawTask.objective,
    success_criteria: rawTask.success_criteria,
    parent_task_id: rawTask.parent_task_id,
    parent_task_title,
    subtask_count: subtasks.length,
    subtasks,
    assignees: publicAssignees,
  };

  res.status(200).json(new ApiResponse(200, publicTask, "Task retrieved successfully"));
});
