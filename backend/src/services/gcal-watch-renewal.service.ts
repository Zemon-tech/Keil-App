/**
 * gcal-watch-renewal.service.ts
 *
 * Background cron functions for maintaining Google Calendar watch channels.
 * These are called every 12 hours from the app startup (index.ts).
 *
 * Functions:
 * - renewExpiringWatchChannels(): renew active channels expiring within ~24 hours
 * - healDegradedWatchChannels(): retry registration for degraded integrations
 *
 * Both functions are per-user fault-isolated — a failure for one user never
 * prevents processing of remaining users.
 */

import pool from '../config/pg';
import { registerWatch } from './google-calendar.service';
import { createServiceLogger } from '../lib/logger';

const log = createServiceLogger('gcal-renewal');

/**
 * Renew Google Calendar watch channels that are expiring soon.
 *
 * Uses a randomised expiry window (18–30 hours before expiry) to prevent
 * thundering-herd renewal storms when many users connected at the same time.
 *
 * Called every 12 hours from index.ts.
 */
export async function renewExpiringWatchChannels(): Promise<void> {
  log.info("Checking for expiring watch channels...");

  const result = await pool.query(`
    SELECT user_id
    FROM public.user_integrations
    WHERE provider = 'google_calendar'
      AND watch_status = 'active'::public.gcal_watch_status
      AND watch_expires_at IS NOT NULL
      AND watch_expires_at < NOW() + INTERVAL '18 hours' + (random() * INTERVAL '12 hours')
  `);

  if (result.rows.length === 0) {
    log.info("No expiring watch channels found");
    return;
  }

  log.info({ count: result.rows.length }, "Found expiring channel(s) — renewing");

  for (const row of result.rows) {
    try {
      await registerWatch(row.user_id);
      log.info({ userId: row.user_id }, "Renewed watch channel");
    } catch (err: unknown) {
      // Per-user failure isolation — log and continue with remaining users
      log.error({ err, userId: row.user_id }, "Failed to renew watch channel");
    }
  }

  log.info("Watch channel renewal run complete");
}

/**
 * Attempt to recover degraded Google Calendar integrations.
 *
 * Users with watch_status = 'degraded' had a failed watch registration or
 * renewal. This function retries registerWatch() for each degraded user,
 * allowing the system to self-heal without user intervention.
 *
 * Called every 12 hours from index.ts (same interval as renewExpiringWatchChannels).
 */
export async function healDegradedWatchChannels(): Promise<void> {
  log.info("Checking for degraded or stale pending watch channels to heal...");

  const result = await pool.query(`
    SELECT user_id
    FROM public.user_integrations
    WHERE provider = 'google_calendar'
      AND (
        watch_status = 'degraded'::public.gcal_watch_status
        OR (watch_status = 'pending'::public.gcal_watch_status AND updated_at < NOW() - INTERVAL '10 minutes')
      )
  `);

  if (result.rows.length === 0) {
    log.info("No degraded or stale pending watch channels found");
    return;
  }

  log.info({ count: result.rows.length }, "Found degraded/stale integration(s) — attempting recovery");

  for (const row of result.rows) {
    try {
      log.info({ userId: row.user_id }, "Self-healing degraded/stale integration");
      await registerWatch(row.user_id);
      log.info({ userId: row.user_id }, "Successfully recovered watch channel");
    } catch (err: unknown) {
      // Per-user failure isolation — log and continue
      log.error({ err, userId: row.user_id }, "Self-healing failed");
    }
  }

  log.info("Degraded/stale channel healing run complete");
}

/**
 * Clean up webhook receipts older than 48 hours to prevent unbounded table growth.
 */
export async function cleanupWebhookReceipts(): Promise<void> {
  log.info("Cleaning up old Google Calendar webhook receipts...");
  const result = await pool.query(
    `DELETE FROM public.gcal_webhook_receipts WHERE received_at < NOW() - INTERVAL '48 hours'`
  );
  log.info({ deletedCount: result.rowCount }, 'Cleaned up old webhook receipts');
}
