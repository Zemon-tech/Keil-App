import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '../.env') });

import { query } from './config/pg';

async function main() {
  console.log('Fetching pages containing details/toggles in content...');
  try {
    const res = await query(
      "SELECT id, title, notion_page_id, content, created_at FROM public.motion_pages WHERE content::text LIKE '%details%' ORDER BY created_at DESC LIMIT 5"
    );
    console.log(`Found ${res.rows.length} pages:`);
    for (const row of res.rows) {
      console.log(`\nPage ID: ${row.id}`);
      console.log(`Title: ${row.title}`);
      console.log(`Notion Page ID: ${row.notion_page_id}`);
      console.log(`Content JSON Structure (Stringified):`);
      console.log(JSON.stringify(row.content, null, 2));
    }
  } catch (err: any) {
    console.error('Error fetching pages:', err);
  }
}

main().then(() => process.exit(0));

