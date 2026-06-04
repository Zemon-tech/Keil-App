import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '../.env') });

import pool from '../src/config/pg';
import { getAuthorizedClient } from '../src/services/google-calendar.service';
import { integrationRepository } from '../src/repositories';
import { google } from 'googleapis';
import crypto from 'crypto';

const USER_ID = '73e1ca23-b579-4328-a50e-3950a7334c74';
const PROVIDER = 'google_calendar';
const GCAL_LOCK_NAMESPACE = 987654;
const syncLockKey = (userId: string) => `gcal-sync:${userId}`;

async function main() {
  console.log('Trace starting for user:', USER_ID);

  const authClient = await getAuthorizedClient(USER_ID);
  if (!authClient) {
    console.log('No authClient returned!');
    return;
  }
  console.log('Got authClient successfully.');

  const integration = await integrationRepository.findByUserAndProvider(USER_ID, PROVIDER);
  if (!integration) {
    console.log('No integration found!');
    return;
  }
  console.log('Got integration:', integration.id);

  const lockKey = syncLockKey(USER_ID);
  const lockClient = await pool.connect();
  let acquired = false;
  try {
    const lockRes = await lockClient.query(
      'SELECT pg_try_advisory_lock($1, hashtext($2))',
      [GCAL_LOCK_NAMESPACE, lockKey]
    );
    acquired = lockRes.rows[0].pg_try_advisory_lock;
    console.log('Advisory lock acquired status:', acquired);
    if (!acquired) {
      console.log('Skipping because advisory lock was not acquired.');
      return;
    }

    const channelId = crypto.randomUUID();
    const ttlMs = 7 * 24 * 60 * 60 * 1000;
    const expiresAt = new Date(Date.now() + ttlMs);

    const calendar = google.calendar({ version: 'v3', auth: authClient, timeout: 10000 } as any);

    let watchRegistered = false;
    let resourceId: string | null = null;

    try {
      console.log('Attempting calendar.events.watch...');
      const address = `http://localhost:5000/api/v1/integrations/google/webhook`; // from config
      console.log('Watch Address:', address);
      const watchResponse = await calendar.events.watch({
        calendarId: integration.calendar_id || 'primary',
        requestBody: {
          id: channelId,
          type: 'web_hook',
          address,
          expiration: String(Date.now() + ttlMs),
        },
      });
      resourceId = watchResponse.data.resourceId ?? null;
      watchRegistered = !!resourceId;
      console.log('Watch registered successfully. resourceId:', resourceId);
    } catch (watchErr: any) {
      console.log('events.watch failed (expected on localhost):', watchErr.message);
    }

    console.log('Running doFullSync step...');
    let initialSyncToken: string | undefined;
    try {
      // Inline full sync logic to trace
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const oneYearFromNow = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
      
      console.log('Calling events.list for full sync...');
      const response = await calendar.events.list({
        calendarId: integration.calendar_id || 'primary',
        singleEvents: true,
        timeMin: thirtyDaysAgo.toISOString(),
        timeMax: oneYearFromNow.toISOString(),
      });
      console.log('events.list responded with event count:', response.data.items?.length);
      initialSyncToken = response.data.nextSyncToken ?? undefined;
      console.log('Initial sync token:', initialSyncToken);
    } catch (syncErr: any) {
      console.log('Full sync step failed:', syncErr.message);
    }

    if (watchRegistered && resourceId) {
      console.log('Persisting active watch channel...');
      await integrationRepository.saveWatchChannel(USER_ID, PROVIDER, {
        channelId,
        resourceId,
        expiresAt,
        syncToken: initialSyncToken,
      });
    } else {
      console.log('Falling back to polling fallback: saving sync token...', initialSyncToken);
      await integrationRepository.saveSyncToken(USER_ID, PROVIDER, initialSyncToken ?? null);
      await pool.query(
        `UPDATE public.user_integrations
         SET watch_status = 'degraded'::public.gcal_watch_status
         WHERE user_id = $1`,
        [USER_ID]
      );
    }
    console.log('Integration update completed.');
  } finally {
    if (acquired) {
      await lockClient.query('SELECT pg_advisory_unlock($1, hashtext($2))', [GCAL_LOCK_NAMESPACE, lockKey]);
      console.log('Advisory lock unlocked.');
    }
    lockClient.release();
  }

  await pool.end();
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
