import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '../.env') });

import pool from '../src/config/pg';
import { getAuthorizedClient, doIncrementalSync } from '../src/services/google-calendar.service';
import { google } from 'googleapis';

const USER_ID = '73e1ca23-b579-4328-a50e-3950a7334c74';

async function main() {
  const authClient = await getAuthorizedClient(USER_ID);
  if (!authClient) {
    console.error('No auth client found for user');
    return;
  }

  const calendar = google.calendar({ version: 'v3', auth: authClient });

  const randomSuffix = Math.floor(Math.random() * 10000);
  const summary = `Event Created in GCal ${randomSuffix}`;

  console.log('--- CREATING NEW GCAL EVENT ---');
  let eventId = '';
  try {
    const insertResponse = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: {
        summary,
        start: {
          dateTime: '2026-06-05T10:00:00+05:30',
          timeZone: 'Asia/Kolkata',
        },
        end: {
          dateTime: '2026-06-05T11:00:00+05:30',
          timeZone: 'Asia/Kolkata',
        },
      },
    });
    eventId = insertResponse.data.id || '';
    console.log('Created event on GCal:');
    console.log('  Event ID:', eventId);
    console.log('  Summary:', insertResponse.data.summary);
  } catch (err: any) {
    console.error('Failed to insert event on GCal:', err.message);
    return;
  }

  console.log('\n--- WAITING 3 SECONDS FOR GCAL CHANGELOG TO PROPAGATE ---');
  await new Promise(resolve => setTimeout(resolve, 3000));

  console.log('\n--- RUNNING INCREMENTAL SYNC ---');
  try {
    await doIncrementalSync(USER_ID);
    console.log('Incremental sync finished.');
  } catch (err: any) {
    console.error('Incremental sync failed:', err);
  }

  console.log('\n--- CHECKING IF TASK WAS CREATED IN DB ---');
  const taskRes = await pool.query('SELECT id, title, start_date, due_date, google_event_id, type FROM public.tasks WHERE google_event_id = $1', [eventId]);
  console.log('Org Tasks matched:', JSON.stringify(taskRes.rows, null, 2));

  const pTaskRes = await pool.query('SELECT id, title, start_date, due_date, google_event_id FROM public.personal_tasks WHERE google_event_id = $1', [eventId]);
  console.log('Personal Tasks matched:', JSON.stringify(pTaskRes.rows, null, 2));

  console.log('\n--- WAITING FOR LOG FLUSH ---');
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Cleanup: delete from Google Calendar to avoid cluttering user's calendar
  try {
    console.log('\n--- CLEANING UP GCAL EVENT ---');
    await calendar.events.delete({
      calendarId: 'primary',
      eventId,
    });
    console.log('Cleaned up GCal event.');
  } catch (err: any) {
    console.warn('Failed to clean up GCal event:', err.message);
  }

  await pool.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
