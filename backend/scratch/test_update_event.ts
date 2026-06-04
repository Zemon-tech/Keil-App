import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '../.env') });

import pool from '../src/config/pg';
import { getAuthorizedClient, doIncrementalSync } from '../src/services/google-calendar.service';
import { google } from 'googleapis';

const USER_ID = '73e1ca23-b579-4328-a50e-3950a7334c74';
const EVENT_ID = '7aeu2774k0t416mdetulqcii4g';

async function main() {
  const authClient = await getAuthorizedClient(USER_ID);
  if (!authClient) {
    console.error('No auth client found for user');
    return;
  }

  const calendar = google.calendar({ version: 'v3', auth: authClient });

  console.log('--- UPDATING GCAL EVENT TIME ---');
  try {
    const patchResponse = await calendar.events.patch({
      calendarId: 'primary',
      eventId: EVENT_ID,
      requestBody: {
        start: {
          dateTime: '2026-06-04T06:30:00+05:30',
          timeZone: 'Asia/Kolkata',
        },
        end: {
          dateTime: '2026-06-04T08:30:00+05:30',
          timeZone: 'Asia/Kolkata',
        },
      },
    });
    console.log('GCal Event updated successfully.');
    console.log('  Updated time:', patchResponse.data.updated);
    console.log('  New Start:', JSON.stringify(patchResponse.data.start));
    console.log('  New End:', JSON.stringify(patchResponse.data.end));
  } catch (err: any) {
    console.error('Failed to patch GCal event:', err.message);
    return;
  }

  console.log('\n--- FETCHING DB TASK BEFORE SYNC ---');
  const taskResBefore = await pool.query('SELECT id, title, start_date, due_date, updated_at FROM public.tasks WHERE google_event_id = $1', [EVENT_ID]);
  console.log('DB Task Before:', JSON.stringify(taskResBefore.rows[0], null, 2));

  console.log('\n--- RUNNING INCREMENTAL SYNC ---');
  try {
    await doIncrementalSync(USER_ID);
    console.log('Incremental sync finished.');
  } catch (err: any) {
    console.error('Incremental sync failed:', err);
  }

  console.log('\n--- FETCHING DB TASK AFTER SYNC ---');
  const taskResAfter = await pool.query('SELECT id, title, start_date, due_date, updated_at FROM public.tasks WHERE google_event_id = $1', [EVENT_ID]);
  console.log('DB Task After:', JSON.stringify(taskResAfter.rows[0], null, 2));

  console.log('\n--- WAITING FOR LOG FLUSH ---');
  await new Promise(resolve => setTimeout(resolve, 3000));

  await pool.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
