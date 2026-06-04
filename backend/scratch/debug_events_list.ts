import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '../.env') });

import pool from '../src/config/pg';
import { getAuthorizedClient } from '../src/services/google-calendar.service';
import { google } from 'googleapis';

const USER_ID = '73e1ca23-b579-4328-a50e-3950a7334c74';

async function main() {
  const authClient = await getAuthorizedClient(USER_ID);
  if (!authClient) {
    console.error('No auth client found for user');
    return;
  }

  const calendar = google.calendar({ version: 'v3', auth: authClient });

  const res = await pool.query('SELECT gcal_sync_token FROM public.user_integrations WHERE user_id = $1', [USER_ID]);
  const syncToken = res.rows[0]?.gcal_sync_token;
  console.log('Current syncToken in DB:', syncToken);

  const randomSuffix = Math.floor(Math.random() * 10000);
  const summary = `Debug Sync Event ${randomSuffix}`;

  console.log('--- CREATING NEW GCAL EVENT ---');
  const insertResponse = await calendar.events.insert({
    calendarId: 'primary',
    requestBody: {
      summary,
      start: {
        dateTime: '2026-06-05T12:00:00+05:30',
        timeZone: 'Asia/Kolkata',
      },
      end: {
        dateTime: '2026-06-05T13:00:00+05:30',
        timeZone: 'Asia/Kolkata',
      },
    },
  });
  const eventId = insertResponse.data.id || '';
  console.log('Created event ID:', eventId);

  console.log('--- WAITING 6 SECONDS FOR GCAL CHANGELOG ---');
  await new Promise(r => setTimeout(r, 6000));

  console.log('--- LISTING EVENTS INCREMENTALLY ---');
  const listResponse = await calendar.events.list({
    calendarId: 'primary',
    syncToken: syncToken,
  });

  console.log('List API responded.');
  console.log('  nextSyncToken:', listResponse.data.nextSyncToken);
  console.log('  Items returned:', listResponse.data.items?.length || 0);
  if (listResponse.data.items) {
    for (const item of listResponse.data.items) {
      console.log(`  - Event: id=${item.id}, summary=${item.summary}, status=${item.status}, updated=${item.updated}`);
    }
  }

  // Cleanup
  console.log('--- CLEANING UP ---');
  await calendar.events.delete({
    calendarId: 'primary',
    eventId,
  });
  console.log('Cleanup complete.');

  await pool.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
