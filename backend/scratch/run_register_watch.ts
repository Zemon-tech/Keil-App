import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '../.env') });

import pool from '../src/config/pg';
import { registerWatch } from '../src/services/google-calendar.service';

const USER_ID = '73e1ca23-b579-4328-a50e-3950a7334c74';

async function main() {
  console.log('Running registerWatch for user:', USER_ID);
  try {
    await registerWatch(USER_ID);
    console.log('registerWatch finished.');
  } catch (err: any) {
    console.error('registerWatch threw error:', err);
  }

  // Fetch integration status from DB
  const res = await pool.query('SELECT * FROM public.user_integrations WHERE user_id = $1', [USER_ID]);
  console.log('Updated user integration:', JSON.stringify(res.rows[0], null, 2));

  await pool.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
