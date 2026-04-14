import { ApiError } from './ApiError';

/**
 * Validator 1 — Task date presence check.
 * Called on the task object AFTER start_date has been defaulted to NOW() if null.
 * Throws user-facing 400 if due_date is null.
 */
export function validateTaskHasDates(
  start: Date | string | null | undefined,
  due: Date | string | null | undefined
): void {
  if (!due) throw new ApiError(400, 'This task has no due date. Please set a due date before scheduling it on the calendar.');
  if (!start) throw new ApiError(400, 'start_date is missing. This should have been defaulted — check the service layer.');
  const startMs = new Date(start).getTime();
  const dueMs = new Date(due).getTime();
  if (isNaN(startMs)) throw new ApiError(400, 'Invalid start_date format on task');
  if (isNaN(dueMs)) throw new ApiError(400, 'Invalid due_date format on task');
  if (dueMs < startMs) throw new ApiError(400, 'Task due_date must be on or after start_date');
}

/**
 * Validator 2 — Timeblock range check.
 * Called on the incoming request body (scheduled_start / scheduled_end), not on the task.
 * Also enforces the 15-minute minimum duration rule.
 */
export function validateTimeblockRange(
  scheduledStart: string | undefined,
  scheduledEnd: string | undefined
): void {
  if (!scheduledStart) throw new ApiError(400, 'scheduled_start is required');
  if (!scheduledEnd) throw new ApiError(400, 'scheduled_end is required');
  const startMs = new Date(scheduledStart).getTime();
  const endMs = new Date(scheduledEnd).getTime();
  if (isNaN(startMs)) throw new ApiError(400, 'Invalid scheduled_start format');
  if (isNaN(endMs)) throw new ApiError(400, 'Invalid scheduled_end format');
  if (endMs <= startMs) throw new ApiError(400, 'scheduled_end must be after scheduled_start');
  if (endMs - startMs < 15 * 60 * 1000) throw new ApiError(400, 'Timeblock must be at least 15 minutes long');
}
