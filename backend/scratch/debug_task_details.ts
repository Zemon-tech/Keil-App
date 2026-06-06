import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '../.env') });

import pool from '../src/config/pg';

const EVENT_ID = '7aeu2774k0t416mdetulqcii4g';

async function main() {
  console.log('Querying task details for EVENT_ID:', EVENT_ID);
  const taskRes = await pool.query('SELECT * FROM public.tasks WHERE google_event_id = $1', [EVENT_ID]);
  console.log('Task Details:', JSON.stringify(taskRes.rows, null, 2));

  if (taskRes.rows.length > 0) {
    const taskId = taskRes.rows[0].id;
    console.log('\nQuerying task assignees for task_id:', taskId);
    const assigneesRes = await pool.query('SELECT * FROM public.task_assignees WHERE task_id = $1', [taskId]);
    console.log('Assignees:', JSON.stringify(assigneesRes.rows, null, 2));
  }

  await pool.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
