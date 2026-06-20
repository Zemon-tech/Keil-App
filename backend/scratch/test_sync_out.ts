import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '../.env') });

import { syncTaskToCalendar } from '../src/services/google-calendar.service';
import pool from '../src/config/pg';

async function main() {
  const userId = '7a5d8a10-c57e-4c70-b275-985a192a48b9'; // Active context user ID

  // Get valid org and space
  const orgSpaceRes = await pool.query(
    `SELECT o.id as org_id, s.id as space_id
     FROM public.organisations o
     INNER JOIN public.spaces s ON s.org_id = o.id AND s.deleted_at IS NULL
     WHERE o.owner_user_id = $1
       AND o.deleted_at IS NULL
     ORDER BY o.created_at ASC, s.created_at ASC
     LIMIT 1`,
    [userId]
  );
  if (orgSpaceRes.rows.length === 0) {
    console.error('No valid org/space found for user');
    return;
  }
  const { org_id, space_id } = orgSpaceRes.rows[0];
  console.log(`Found valid Org: ${org_id}, Space: ${space_id}`);

  console.log('Inserting a test task...');
  const taskRes = await pool.query(
    `INSERT INTO public.tasks
       (org_id, space_id, title, start_date, due_date, status, priority, created_by, type)
     VALUES ($1, $2, 'Test Task Sync Outbound', NOW(), NOW() + INTERVAL '1 hour', 'todo', 'medium', $3, 'task')
     RETURNING *`,
    [org_id, space_id, userId]
  );
  const task = taskRes.rows[0];
  console.log('Inserted task ID:', task.id);

  console.log('Syncing task to Google...');
  try {
    await syncTaskToCalendar(userId, {
      id: task.id,
      title: task.title,
      description: task.description,
      start_date: task.start_date,
      due_date: task.due_date,
      is_all_day: task.is_all_day,
      location: task.location,
      status: task.status,
      google_event_id: task.google_event_id,
      meet_link: task.meet_link,
      source: 'tasks',
      type: task.type,
    });
    console.log('Sync complete!');

    // Wait 2 seconds for fire-and-forget sync to finish
    await new Promise(resolve => setTimeout(resolve, 2000));

    const finalRes = await pool.query('SELECT * FROM public.tasks WHERE id = $1', [task.id]);
    console.log('Final task in DB:', finalRes.rows[0]);
  } catch (err) {
    console.error('Error syncing:', err);
  }
}

main().then(() => pool.end());
