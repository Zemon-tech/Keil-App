import pool from "../config/pg";
import { createServiceLogger } from "../lib/logger";

const log = createServiceLogger("analytics-service");

export const METRIC_TASKS_COMPLETED_DAILY = "tasks_completed_daily";

export interface MetricPoint {
  bucket_date: string; // YYYY-MM-DD
  value: number;
}

/**
 * Pipeline: "tasks_completed_daily"
 *
 * Question this answers: "how many tasks were marked done/completed, per day?"
 *
 * Reads from activity_logs (already the source of truth for every status
 * change — see api-and-schema.md) and writes the aggregated result into
 * analytics_metric_daily. The dashboard API never runs this query directly;
 * it only reads the table this function writes to.
 */
export async function recomputeTasksCompletedDaily(
  orgId: string,
  spaceId: string
): Promise<MetricPoint[]> {
  const { rows } = await pool.query(
    `
    SELECT
      DATE(created_at) AS bucket_date,
      COUNT(*)::int AS value
    FROM public.activity_logs
    WHERE org_id = $1
      AND space_id = $2
      AND entity_type = 'task'
      AND action_type = 'status_changed'
      AND new_value->>'status' IN ('done', 'completed')
    GROUP BY DATE(created_at)
    ORDER BY bucket_date
    `,
    [orgId, spaceId]
  );

  if (rows.length === 0) {
    log.debug({ orgId, spaceId }, "[recomputeTasksCompletedDaily] No completed tasks found, nothing to upsert");
    return [];
  }

  // Upsert every bucket in one round trip.
  const values: unknown[] = [];
  const placeholders: string[] = [];
  rows.forEach((r, i) => {
    const base = i * 5;
    placeholders.push(`($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5})`);
    values.push(orgId, spaceId, METRIC_TASKS_COMPLETED_DAILY, r.bucket_date, r.value);
  });

  await pool.query(
    `
    INSERT INTO public.analytics_metric_daily (org_id, space_id, metric_key, bucket_date, value)
    VALUES ${placeholders.join(", ")}
    ON CONFLICT (org_id, space_id, metric_key, bucket_date)
    DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
    `,
    values
  );

  log.info({ orgId, spaceId, buckets: rows.length }, "[recomputeTasksCompletedDaily] Upserted metric buckets");

  return rows.map((r) => ({
    bucket_date: r.bucket_date instanceof Date ? r.bucket_date.toISOString().slice(0, 10) : r.bucket_date,
    value: r.value,
  }));
}

/**
 * Reads the already-computed results for a pipeline. This is what the
 * dashboard API calls — it never touches activity_logs directly.
 */
export async function getMetricDaily(
  orgId: string,
  spaceId: string,
  metricKey: string,
  days = 30
): Promise<MetricPoint[]> {
  const { rows } = await pool.query(
    `
    SELECT bucket_date, value::float AS value
    FROM public.analytics_metric_daily
    WHERE org_id = $1
      AND space_id = $2
      AND metric_key = $3
      AND bucket_date >= CURRENT_DATE - ($4 || ' days')::interval
    ORDER BY bucket_date ASC
    `,
    [orgId, spaceId, metricKey, days]
  );

  return rows.map((r) => ({
    bucket_date: r.bucket_date instanceof Date ? r.bucket_date.toISOString().slice(0, 10) : r.bucket_date,
    value: r.value,
  }));
}
