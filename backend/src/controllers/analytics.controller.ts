import { Request, Response } from "express";
import { catchAsync } from "../utils/catchAsync";
import { ApiResponse } from "../utils/ApiResponse";
import { getMetricDaily, METRIC_TASKS_COMPLETED_DAILY } from "../services/analytics.service";

const asString = (value: string | string[] | undefined): string =>
  Array.isArray(value) ? value[0] : (value ?? "");

/**
 * GET /api/v1/orgs/:orgId/spaces/:spaceId/analytics/tasks-completed-daily
 *
 * Reads pre-computed results from analytics_metric_daily. Does NOT touch
 * activity_logs — the recompute worker already did that work.
 */
export const getTasksCompletedDaily = catchAsync(async (req: Request, res: Response) => {
  const orgId = asString(req.params.orgId);
  const spaceId = asString(req.params.spaceId);
  const rawDays = req.query.days as string | undefined;
  const days = rawDays ? Math.min(Math.max(parseInt(rawDays, 10) || 30, 1), 365) : 30;

  const data = await getMetricDaily(orgId, spaceId, METRIC_TASKS_COMPLETED_DAILY, days);

  res.status(200).json(new ApiResponse(200, data, "Tasks completed (daily) retrieved successfully"));
});
