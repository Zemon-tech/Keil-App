import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '../.env') });

import { query } from './config/pg';

async function main() {
  console.log('Fetching Notion integrations...');
  try {
    const integrationsRes = await query(
      "SELECT user_id, access_token FROM public.user_integrations WHERE provider = 'notion' LIMIT 1"
    );
    if (integrationsRes.rows.length === 0) {
      console.log('No Notion integrations found in database.');
      return;
    }
    const { user_id, access_token } = integrationsRes.rows[0];
    console.log(`Using integration for user: ${user_id}`);

    const pagesRes = await query(
      "SELECT id, title, notion_page_id FROM public.motion_pages WHERE notion_page_id IS NOT NULL ORDER BY created_at DESC LIMIT 5"
    );
    if (pagesRes.rows.length === 0) {
      console.log('No linked pages found.');
      return;
    }

    for (const page of pagesRes.rows) {
      console.log(`\n--------------------------------------------`);
      console.log(`Fetching blocks for Notion Page: "${page.title}" (${page.notion_page_id})...`);

      const headers = {
        Authorization: `Bearer ${access_token}`,
        'Notion-Version': '2026-03-11',
        'Content-Type': 'application/json',
      };

      const response = await fetch(
        `https://api.notion.com/v1/blocks/${page.notion_page_id}/children?page_size=100`,
        { headers }
      );
      if (!response.ok) {
        console.error(`Notion API error: ${response.status}`, await response.text());
        continue;
      }

      const data = await response.json() as any;
      console.log(`Retrieved ${data.results.length} top-level blocks.`);
      const types = data.results.map((b: any) => b.type);
      console.log('Block Types:', types);
      for (const block of data.results) {
        if (block.type === 'toggle' || block.type.startsWith('heading_')) {
          console.log(`  - Block ID: ${block.id}, Type: ${block.type}, Has Children: ${block.has_children}, Content:`, JSON.stringify(block[block.type]));
        }
      }
    }
  } catch (err: any) {
    console.error('Error in main:', err);
  }
}

main().then(() => process.exit(0));
