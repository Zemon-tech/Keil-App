import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '../.env') });

import { getAuthorizedClient } from '../src/services/google-calendar.service';
import { google } from 'googleapis';
import pool from '../src/config/pg';

async function main() {
  const userId = '7a5d8a10-c57e-4c70-b275-985a192a48b9'; // Active context user ID
  const authClient = await getAuthorizedClient(userId);

  if (!authClient) {
    console.error('Failed to get authorized client');
    return;
  }

  // Check token info (scopes)
  try {
    const tokenInfo = await authClient.getTokenInfo(authClient.credentials.access_token!);
    console.log('Token Scopes:', tokenInfo.scopes);
  } catch (err: any) {
    console.error('Error getting token info:', err.message);
  }

  const calendar = google.calendar({ version: 'v3', auth: authClient });
  const tasksClient = google.tasks({ version: 'v1', auth: authClient });

  const ids = ['qfm6thmk2imb1jnv4j87b2lbjs', 'vnnpcv1qpgb22pd65qbjine10g'];

  for (const id of ids) {
    console.log(`\n--- Inspecting ID: ${id} ---`);

    // Try as Calendar Event
    try {
      const event = await calendar.events.get({
        calendarId: 'primary',
        eventId: id,
      });
      console.log(`SUCCESS [Calendar Event]: Title = "${event.data.summary}"`);
    } catch (err: any) {
      console.log(`FAILED [Calendar Event]: ${err.message}`);
    }

    // Try as Google Task
    try {
      const task = await tasksClient.tasks.get({
        tasklist: '@default',
        task: id,
      });
      console.log(`SUCCESS [Google Task]: Title = "${task.data.title}", status = "${task.data.status}"`);
    } catch (err: any) {
      console.log(`FAILED [Google Task]: ${err.message}`);
    }
  }
}

main().then(() => pool.end());
