import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '../.env') });

import pool from './config/pg';

async function main() {
  try {
    const ids = ['8eae0e48-d65b-480c-870e-5c780a904b6f', '515a7a7f-b8ab-468c-bfe3-8fc30f8c935f'];
    for (const id of ids) {
      const channelRes = await pool.query("SELECT id, name, org_id, space_id FROM public.channels WHERE id = $1", [id]);
      if (channelRes.rows.length > 0) {
        console.log(`ID ${id} is a Channel:`, channelRes.rows[0]);
      }
    }
  } catch (err: any) {
    console.error('Error:', err);
  }
}

main().then(() => process.exit(0));
