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

/**
 * Renew Google Calendar watch channels that are expiring soon.
 *
 * Uses a randomised expiry window (18–30 hours before expiry) to prevent
 * thundering-herd renewal storms when many users connected at the same time.
 *
 * Called every 12 hours from index.ts.
 */
export async function renewExpiringWatchChannels(): Promise<void> {
  console.log('[gcal-renewal] Checking for expiring watch channels...');

  const result = await pool.query(`
    SELECT user_id
    FROM public.user_integrations
    WHERE provider = 'google_calendar'
      AND watch_status = 'active'::public.gcal_watch_status
      AND watch_expires_at IS NOT NULL
      AND watch_expires_at < NOW() + INTERVAL '18 hours' + (random() * INTERVAL '12 hours')
  `);

  if (result.rows.length === 0) {
    console.log('[gcal-renewal] No expiring watch channels found.');
    return;
  }

  console.log(`[gcal-renewal] Found ${result.rows.length} expiring channel(s) — renewing.`);

  for (const row of result.rows) {
    try {
      await registerWatch(row.user_id);
      console.log(`[gcal-renewal] Renewed watch channel for user ${row.user_id}.`);
    } catch (err: any) {
      // Per-user failure isolation — log and continue with remaining users
      console.error(`[gcal-renewal] Failed to renew watch channel for user ${row.user_id}:`, err.message);
    }
  }

  console.log('[gcal-renewal] Watch channel renewal run complete.');
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
  console.log('[gcal-renewal] Checking for degraded watch channels to heal...');

  const result = await pool.query(`
    SELECT user_id
    FROM public.user_integrations
    WHERE provider = 'google_calendar'
      AND watch_status = 'degraded'::public.gcal_watch_status
  `);

  if (result.rows.length === 0) {
    console.log('[gcal-renewal] No degraded watch channels found.');
    return;
  }

  console.log(`[gcal-renewal] Found ${result.rows.length} degraded integration(s) — attempting recovery.`);

  for (const row of result.rows) {
    try {
      console.log(`[gcal-renewal] Self-healing degraded integration for user ${row.user_id}.`);
      await registerWatch(row.user_id);
      console.log(`[gcal-renewal] Successfully recovered watch channel for user ${row.user_id}.`);
    } catch (err: any) {
      // Per-user failure isolation — log and continue
      console.error(`[gcal-renewal] Self-healing failed for user ${row.user_id}:`, err.message);
    }
  }

  console.log('[gcal-renewal] Degraded channel healing run complete.');
}
