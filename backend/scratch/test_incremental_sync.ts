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

  console.log('--- FETCHING GCAL EVENT ---');
  try {
    const event = await calendar.events.get({
      calendarId: 'primary',
      eventId: EVENT_ID,
    });
    console.log('GCal Event properties:');
    console.log('  Updated:', event.data.updated);
    console.log('  Start:', JSON.stringify(event.data.start));
    console.log('  End:', JSON.stringify(event.data.end));
    console.log('  Summary:', event.data.summary);
    console.log('  ExtendedProperties:', JSON.stringify(event.data.extendedProperties));
  } catch (err: any) {
    console.error('Failed to get GCal event:', err.message);
  }

  console.log('\n--- FETCHING DB TASK BEFORE SYNC ---');
  const taskResBefore = await pool.query('SELECT id, title, start_date, due_date, updated_at FROM public.tasks WHERE google_event_id = $1', [EVENT_ID]);
  console.log('DB Task Before:', JSON.stringify(taskResBefore.rows[0], null, 2));

  console.log('\n--- RUNNING INCREMENTAL SYNC ---');
  try {
    await doIncrementalSync(USER_ID);
    console.log('Incremental sync finished successfully.');
  } catch (err: any) {
    console.error('Incremental sync failed:', err);
  }

  console.log('\n--- FETCHING DB TASK AFTER SYNC ---');
  const taskResAfter = await pool.query('SELECT id, title, start_date, due_date, updated_at FROM public.tasks WHERE google_event_id = $1', [EVENT_ID]);
  console.log('DB Task After:', JSON.stringify(taskResAfter.rows[0], null, 2));

  await pool.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
