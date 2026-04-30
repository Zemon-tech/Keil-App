import { Client } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function run() {
  try {
    await client.connect();
    console.log('Connected to database');
    
    // 1. ALTER TYPE commands (Must be committed)
    await client.query(`
      ALTER TYPE public.task_status ADD VALUE IF NOT EXISTS 'confirmed';
      ALTER TYPE public.task_status ADD VALUE IF NOT EXISTS 'tentative';
      ALTER TYPE public.task_status ADD VALUE IF NOT EXISTS 'cancelled';
      ALTER TYPE public.task_status ADD VALUE IF NOT EXISTS 'completed';
    `);
    console.log('Successfully altered task_status enum');

    // pg client auto-commits by default outside of BEGIN/COMMIT blocks, 
    // but to be absolutely sure the enum values are ready for use in the same session, 
    // it's sometimes required to disconnect and reconnect, or just wait, or run them in separate queries.
    // The previous error was because we sent them all in one big string, which pg executes as a single block.
    
    // 2. UPDATE commands
    await client.query(`
      UPDATE public.tasks 
      SET status = 'confirmed' 
      WHERE type = 'event' AND status IN ('backlog', 'todo', 'in-progress');
    `);
    console.log('Migrated todo/in-progress events to confirmed');

    await client.query(`
      UPDATE public.tasks 
      SET status = 'completed' 
      WHERE type = 'event' AND status = 'done';
    `);
    console.log('Migrated done events to completed');
    
  } catch (err) {
    console.error('Error during database migration:', err);
  } finally {
    await client.end();
  }
}

run();
