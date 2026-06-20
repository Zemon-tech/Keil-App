import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '../.env') });

import pool from '../src/config/pg';

async function main() {
  console.log('Fetching integrations...');
  const integrationsRes = await pool.query('SELECT * FROM public.user_integrations');
  console.log('Integrations count:', integrationsRes.rows.length);
  for (const row of integrationsRes.rows) {
    console.log(`User: ${row.user_id}, Provider: ${row.provider}, watch_status: ${row.watch_status}`);
  }

  console.log('\nFetching tasks with google_event_id...');
  const tasksRes = await pool.query(
    'SELECT id, title, type, google_event_id, start_date, due_date, deleted_at FROM public.tasks WHERE google_event_id IS NOT NULL'
  );
  console.log('Tasks count:', tasksRes.rows.length);
  for (const row of tasksRes.rows) {
    console.log(`Task ID: ${row.id}, Title: ${row.title}, Type: ${row.type}, Event ID: ${row.google_event_id}`);
  }

  console.log('\nFetching personal_tasks with google_event_id...');
  const personalTasksRes = await pool.query(
    'SELECT id, title, google_event_id, start_date, due_date, deleted_at FROM public.personal_tasks WHERE google_event_id IS NOT NULL'
  );
  console.log('Personal Tasks count:', personalTasksRes.rows.length);
  for (const row of personalTasksRes.rows) {
    console.log(`Personal Task ID: ${row.id}, Title: ${row.title}, Event ID: ${row.google_event_id}`);
  }
}

main().then(() => pool.end());
