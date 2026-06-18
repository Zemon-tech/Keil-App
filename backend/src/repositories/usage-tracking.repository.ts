import { PoolClient } from "pg";
import { BaseRepository } from "./base.repository";
import { UsageTracking } from "../types/billing";

export class UsageTrackingRepository extends BaseRepository<UsageTracking> {
  constructor() {
    super("usage_tracking");
  }

  /**
   * Find usage record for a user (each user has at most one row).
   */
  async findByUserId(userId: string, client?: PoolClient): Promise<UsageTracking | null> {
    const executor = client || this.pool;
    const result = await executor.query(
      `SELECT * FROM public.usage_tracking WHERE user_id = $1 LIMIT 1`,
      [userId]
    );
    return result.rows.length > 0 ? (result.rows[0] as UsageTracking) : null;
  }

  /**
   * Get or create usage record for a user. Ensures a row always exists.
   */
  async getOrCreate(userId: string, client?: PoolClient): Promise<UsageTracking> {
    const executor = client || this.pool;
    const result = await executor.query(
      `INSERT INTO public.usage_tracking (user_id)
       VALUES ($1)
       ON CONFLICT (user_id) DO UPDATE SET user_id = EXCLUDED.user_id
       RETURNING *`,
      [userId]
    );
    return result.rows[0] as UsageTracking;
  }

  /**
   * Increment AI chat count. Automatically resets counters if the time window has passed.
   * Returns the updated usage row with current counts.
   */
  async incrementAiChat(userId: string, client?: PoolClient): Promise<UsageTracking> {
    const executor = client || this.pool;

    // Upsert + reset windows atomically
    const result = await executor.query(
      `INSERT INTO public.usage_tracking (user_id, ai_chats_today, ai_chats_this_hour, ai_hour_window, ai_day_window)
       VALUES ($1, 1, 1, NOW(), CURRENT_DATE)
       ON CONFLICT (user_id) DO UPDATE SET
         -- Reset daily counter if day changed
         ai_chats_today = CASE
           WHEN usage_tracking.ai_day_window < CURRENT_DATE THEN 1
           ELSE usage_tracking.ai_chats_today + 1
         END,
         ai_day_window = CASE
           WHEN usage_tracking.ai_day_window < CURRENT_DATE THEN CURRENT_DATE
           ELSE usage_tracking.ai_day_window
         END,
         -- Reset hourly counter if hour window passed (1 hour sliding)
         ai_chats_this_hour = CASE
           WHEN usage_tracking.ai_hour_window < NOW() - INTERVAL '1 hour' THEN 1
           ELSE usage_tracking.ai_chats_this_hour + 1
         END,
         ai_hour_window = CASE
           WHEN usage_tracking.ai_hour_window < NOW() - INTERVAL '1 hour' THEN NOW()
           ELSE usage_tracking.ai_hour_window
         END,
         updated_at = NOW()
       RETURNING *`,
      [userId]
    );
    return result.rows[0] as UsageTracking;
  }

  /**
   * Increment recording count. Resets monthly counter if month changed.
   */
  async incrementRecording(userId: string, client?: PoolClient): Promise<UsageTracking> {
    const executor = client || this.pool;

    const result = await executor.query(
      `INSERT INTO public.usage_tracking (user_id, recordings_this_month, recording_month)
       VALUES ($1, 1, DATE_TRUNC('month', CURRENT_DATE)::DATE)
       ON CONFLICT (user_id) DO UPDATE SET
         recordings_this_month = CASE
           WHEN usage_tracking.recording_month < DATE_TRUNC('month', CURRENT_DATE)::DATE THEN 1
           ELSE usage_tracking.recordings_this_month + 1
         END,
         recording_month = CASE
           WHEN usage_tracking.recording_month < DATE_TRUNC('month', CURRENT_DATE)::DATE
             THEN DATE_TRUNC('month', CURRENT_DATE)::DATE
           ELSE usage_tracking.recording_month
         END,
         updated_at = NOW()
       RETURNING *`,
      [userId]
    );
    return result.rows[0] as UsageTracking;
  }

  /**
   * Get current usage with auto-reset logic applied (read-only, does not write).
   * Returns effective counts considering window boundaries.
   */
  async getEffectiveUsage(userId: string, client?: PoolClient): Promise<{
    ai_chats_today: number;
    ai_chats_this_hour: number;
    recordings_this_month: number;
  }> {
    const executor = client || this.pool;

    const result = await executor.query(
      `SELECT
         CASE WHEN ai_day_window < CURRENT_DATE THEN 0 ELSE ai_chats_today END as ai_chats_today,
         CASE WHEN ai_hour_window < NOW() - INTERVAL '1 hour' THEN 0 ELSE ai_chats_this_hour END as ai_chats_this_hour,
         CASE WHEN recording_month < DATE_TRUNC('month', CURRENT_DATE)::DATE THEN 0 ELSE recordings_this_month END as recordings_this_month
       FROM public.usage_tracking
       WHERE user_id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return { ai_chats_today: 0, ai_chats_this_hour: 0, recordings_this_month: 0 };
    }

    return {
      ai_chats_today: parseInt(result.rows[0].ai_chats_today, 10),
      ai_chats_this_hour: parseInt(result.rows[0].ai_chats_this_hour, 10),
      recordings_this_month: parseInt(result.rows[0].recordings_this_month, 10),
    };
  }
}
