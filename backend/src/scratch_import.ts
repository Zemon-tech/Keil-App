import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '../.env') });

import { query } from './config/pg';
import { getNotionPageBlockTree, notionBlocksToTiptap } from './services/notion.service';

async function main() {
  try {
    const integrationsRes = await query(
      "SELECT user_id, access_token FROM public.user_integrations WHERE provider = 'notion' LIMIT 1"
    );
    if (integrationsRes.rows.length === 0) {
      console.log('No Notion integrations found.');
      return;
    }
    const { user_id } = integrationsRes.rows[0];

    const pagesRes = await query(
      "SELECT notion_page_id, title FROM public.motion_pages WHERE notion_page_id IS NOT NULL ORDER BY created_at DESC LIMIT 1"
    );
    if (pagesRes.rows.length === 0) {
      console.log('No linked pages found.');
      return;
    }
    const { notion_page_id, title } = pagesRes.rows[0];
    console.log(`Testing import of page: "${title}" (${notion_page_id})`);

    const blockTree = await getNotionPageBlockTree(user_id, notion_page_id);
    console.log(`Block tree retrieved. Root blocks count: ${blockTree.length}`);

    const tiptapContent = notionBlocksToTiptap(blockTree);
    console.log('\nGenerated Tiptap Content:');
    console.log(JSON.stringify(tiptapContent, null, 2));

  } catch (err: any) {
    console.error('Error during import:', err);
  }
}

main().then(() => process.exit(0));
