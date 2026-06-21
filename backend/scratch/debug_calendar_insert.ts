import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '../.env') });

import { getAuthorizedClient } from '../src/services/google-calendar.service';
import { google } from 'googleapis';
import pool from '../src/config/pg';

async function main() {
  const userId = '7a5d8a10-c57e-4c70-b275-985a192a48b9'; // Active context user ID
  console.log('Fetching authorized client for user...', userId);
  
  const authClient = await getAuthorizedClient(userId);
  if (!authClient) {
    console.error('No authorized client found for user');
    return;
  }
  console.log('Auth client obtained successfully');

  const calendar = google.calendar({ version: 'v3', auth: authClient });

  console.log('Attempting to list events to check if read works...');
  try {
    const listRes = await calendar.events.list({
      calendarId: 'primary',
      maxResults: 1,
    });
    console.log('List events success! Found events count:', listRes.data.items?.length);
  } catch (err: any) {
    console.error('List events failed:', err.message);
  }

  console.log('Attempting to insert a test event...');
  try {
    const insertRes = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: {
        summary: 'Test Event from KeilHQ Debug Script',
        start: { dateTime: new Date().toISOString() },
        end: { dateTime: new Date(Date.now() + 60 * 60 * 1000).toISOString() },
      },
    });
    console.log('Insert event success! Event ID:', insertRes.data.id);
  } catch (err: any) {
    console.error('Insert event failed:', err.message);
  }
}

main()
  .catch(err => console.error('Unexpected main error:', err))
  .finally(() => {
    console.log('Closing database pool...');
    pool.end();
  });
