import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '../.env') });

import pool from '../src/config/pg';

async function main() {
  console.log('Querying database user_integrations...');
  const res = await pool.query('SELECT * FROM public.user_integrations');
  console.log('Integrations:', JSON.stringify(res.rows, null, 2));

  console.log('Querying last 5 tasks with google_event_id...');
  const tasksRes = await pool.query('SELECT id, title, google_event_id, updated_at, start_date, due_date, deleted_at FROM public.tasks WHERE google_event_id IS NOT NULL ORDER BY updated_at DESC LIMIT 5');
  console.log('Tasks:', JSON.stringify(tasksRes.rows, null, 2));

  await pool.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
