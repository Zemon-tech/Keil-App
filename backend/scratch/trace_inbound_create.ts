import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '../.env') });

import pool from '../src/config/pg';
import { getAuthorizedClient, doFullSync } from '../src/services/google-calendar.service';
import { integrationRepository, personalTaskRepository } from '../src/repositories';
import { google, calendar_v3 } from 'googleapis';
import { TaskStatus, TaskPriority } from '../src/types/enums';

const USER_ID = '73e1ca23-b579-4328-a50e-3950a7334c74';

async function getUserDefaultOrgSpace(userId: string) {
  const result = await pool.query(
    `SELECT o.id as org_id, s.id as space_id
     FROM public.organisations o
     INNER JOIN public.spaces s ON s.org_id = o.id AND s.deleted_at IS NULL
     WHERE o.owner_user_id = $1
       AND o.deleted_at IS NULL
     ORDER BY o.created_at ASC, s.created_at ASC
     LIMIT 1`,
    [userId]
  );
  if (result.rows.length === 0) return null;
  return { orgId: result.rows[0].org_id, spaceId: result.rows[0].space_id };
}

async function findTaskByGoogleEventIdOrIcalUidOrTaskId(
  googleEventId: string,
  icalUid?: string | null,
  taskId?: string | null
) {
  const result = await pool.query(
    `SELECT * FROM (
      (SELECT id, title, updated_at, start_date, due_date, owner_user_id, NULL::uuid AS created_by, location, meet_link, false AS is_all_day, 'personal_tasks' AS source
       FROM public.personal_tasks
       WHERE deleted_at IS NULL
         AND (google_event_id = $1 OR (ical_uid IS NOT NULL AND ical_uid = $2) OR id = $3)
       LIMIT 1)
       UNION ALL
       (SELECT id, title, updated_at, start_date, due_date, NULL::uuid AS owner_user_id, created_by, location, meet_link, is_all_day, 'tasks' AS source
        FROM public.tasks
        WHERE deleted_at IS NULL
          AND (google_event_id = $1 OR (ical_uid IS NOT NULL AND ical_uid = $2) OR id = $3)
        LIMIT 1)
     ) sub
     ORDER BY (CASE WHEN sub.source = 'personal_tasks' THEN 0 ELSE 1 END)
     LIMIT 1`,
    [googleEventId, icalUid ?? null, taskId ?? null]
  );
  if (result.rows.length === 0) return null;
  return result.rows[0];
}

async function traceProcessIncomingGoogleEvent(
  userId: string,
  event: calendar_v3.Schema$Event
) {
  console.log('Starting traceProcessIncomingGoogleEvent...');
  const source = event.extendedProperties?.private?.['source'];
  const privateTaskId = event.extendedProperties?.private?.['taskId'];

  const googleEventId = event.id;
  const icalUid = event.iCalUID ?? null;
  console.log('Event attributes:');
  console.log('  googleEventId:', googleEventId);
  console.log('  icalUid:', icalUid);
  console.log('  source:', source);
  console.log('  privateTaskId:', privateTaskId);

  if (!googleEventId) {
    console.log('Skipping event: googleEventId is null or undefined');
    return;
  }

  const matchingTask = await findTaskByGoogleEventIdOrIcalUidOrTaskId(googleEventId, icalUid, privateTaskId);
  console.log('Matching Task found:', matchingTask ? JSON.stringify(matchingTask) : 'null');

  if (source === 'keilhq' && !matchingTask) {
    console.log('Skipping event: loop prevention (originated from KeilHQ but no matching task found)');
    return;
  }

  if (event.status !== 'cancelled') {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const oneYearFromNow = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);

    const isAllDay = !!event.start?.date;
    const startRaw = isAllDay ? event.start?.date : event.start?.dateTime;
    console.log('Start time:');
    console.log('  isAllDay:', isAllDay);
    console.log('  startRaw:', startRaw);
    if (!startRaw) {
      console.log('Skipping event: no start date');
      return;
    }
    const startDate = new Date(startRaw);
    console.log('  startDate:', startDate);
    console.log('  thirtyDaysAgo:', thirtyDaysAgo);
    console.log('  oneYearFromNow:', oneYearFromNow);

    if (startDate < thirtyDaysAgo) {
      console.log('Skipping event: too far in the past');
      return;
    }
    if (startDate > oneYearFromNow) {
      console.log('Skipping event: outside sync window');
      return;
    }
  }

  if (event.status === 'cancelled') {
    console.log('Event is cancelled, soft-deleting');
    return;
  }

  const isAllDay = !!event.start?.date;
  const startDate = isAllDay
    ? new Date(event.start!.date!)
    : new Date(event.start!.dateTime!);
  const dueDate = isAllDay
    ? new Date(new Date(event.end!.date!).getTime() - 24 * 60 * 60 * 1000)
    : new Date(event.end!.dateTime!);

  if (!matchingTask) {
    console.log('No matching task: creating new task');
    try {
      const resolvedOrgSpace = await getUserDefaultOrgSpace(userId);
      console.log('Default Org/Space resolved:', resolvedOrgSpace);

      if (resolvedOrgSpace) {
        console.log('Attempting to insert org task...');
        const taskRes = await pool.query(
          `INSERT INTO public.tasks
             (org_id, space_id, title, start_date, due_date,
              google_event_id, ical_uid, status, priority, created_by, type, event_type, location, meet_link, is_all_day)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'event', 'meeting', $11, $12, $13)
           RETURNING id`,
          [
            resolvedOrgSpace.orgId,
            resolvedOrgSpace.spaceId,
            event.summary || 'Untitled Google Event',
            startDate,
            dueDate,
            googleEventId,
            icalUid,
            TaskStatus.TODO,
            TaskPriority.MEDIUM,
            userId,
            event.location || null,
            event.hangoutLink || null,
            isAllDay,
          ]
        );
        const newTaskId = taskRes.rows[0].id;
        console.log('Created org task with id:', newTaskId);
        
        await pool.query(
          `INSERT INTO public.task_assignees (task_id, user_id)
           VALUES ($1, $2)
           ON CONFLICT DO NOTHING`,
          [newTaskId, userId]
        );
        console.log('Assigned task to user.');
      } else {
        console.log('No default org space, creating personal task...');
        const newPTask = await personalTaskRepository.create({
          owner_user_id: userId,
          title: event.summary || 'Untitled Google Event',
          start_date: startDate,
          due_date: dueDate,
          google_event_id: googleEventId,
          ical_uid: icalUid,
          status: TaskStatus.TODO,
          priority: TaskPriority.MEDIUM,
          location: event.location || null,
          meet_link: event.hangoutLink || null,
        });
        console.log('Created personal task:', JSON.stringify(newPTask));
      }
    } catch (err: any) {
      console.error('Error during task creation:', err);
    }
  } else {
    console.log('Matching task exists, checking for update...');
  }
}

async function main() {
  const authClient = await getAuthorizedClient(USER_ID);
  if (!authClient) {
    console.error('No auth client found for user');
    return;
  }

  const calendar = google.calendar({ version: 'v3', auth: authClient });

  const summary = `Event Created in GCal programmatically`;
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
    console.log('Created event. ID:', eventId);

    // Call traceProcessIncomingGoogleEvent directly with this event object
    await traceProcessIncomingGoogleEvent(USER_ID, insertResponse.data);

  } catch (err: any) {
    console.error('Error in main trace:', err.message);
  } finally {
    if (eventId) {
      console.log('Cleaning up event...');
      try {
        await calendar.events.delete({
          calendarId: 'primary',
          eventId,
        });
        console.log('Cleanup complete.');
      } catch (e: any) {
        console.warn('Cleanup failed:', e.message);
      }
    }
  }

  await pool.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
