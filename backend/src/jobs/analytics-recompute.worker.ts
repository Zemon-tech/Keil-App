import pool from "../config/pg";
import { recomputeTasksCompletedDaily } from "../services/analytics.service";
import { createServiceLogger } from "../lib/logger";

const log = createServiceLogger("analytics-recompute-worker");

/**
 * Background worker that recomputes analytics pipelines on a fixed interval.
 *
 * v1: only one pipeline (tasks_completed_daily), recomputed for every space
 * on every tick. This is intentionally the simplest possible version — no
 * dirty-tracking, no per-pipeline config yet. Once there are multiple
 * pipelines or the space count gets large, swap the "for every space" loop
 * for a dirty-set/queue so only spaces with new activity get recomputed.
 */
export class AnalyticsRecomputeWorkerService {
  private intervalId: NodeJS.Timeout | null = null;
  private readonly CHECK_INTERVAL = 60 * 1000; // every 60 seconds

  public start() {
    if (this.intervalId) return;

    log.info("Analytics recompute worker started");
    this.intervalId = setInterval(() => this.recomputeAll(), this.CHECK_INTERVAL);

    // Run once shortly after boot so dashboards aren't empty on first load.
    setTimeout(() => this.recomputeAll(), 5000);
  }

  public stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      log.info("Analytics recompute worker stopped");
    }
  }

  private async recomputeAll() {
    try {
      const { rows: spaces } = await pool.query(
        `SELECT id AS space_id, org_id FROM public.spaces WHERE deleted_at IS NULL`
      );

      for (const space of spaces) {
        try {
          await recomputeTasksCompletedDaily(space.org_id, space.space_id);
        } catch (err) {
          log.error({ err, spaceId: space.space_id }, "Failed to recompute analytics for space");
        }
      }
    } catch (err) {
      log.error({ err }, "Analytics recompute tick failed");
    }
  }
}

export const analyticsRecomputeWorkerService = new AnalyticsRecomputeWorkerService();
