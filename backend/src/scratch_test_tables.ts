import { notionBlocksToTiptap, tiptapToNotionBlocks } from './services/notion.service';

const mockTableBlockTree = [
  {
    id: 'table-1',
    type: 'table',
    has_children: true,
    table: {
      table_width: 2,
      has_column_header: true,
      has_row_header: false
    },
    children: [
      {
        id: 'row-1',
        type: 'table_row',
        table_row: {
          cells: [
            [{ type: 'text', text: { content: 'Header A' } }],
            [{ type: 'text', text: { content: 'Header B' } }]
          ]
        }
      },
      {
        id: 'row-2',
        type: 'table_row',
        table_row: {
          cells: [
            [{ type: 'text', text: { content: 'Value A1' } }],
            [{ type: 'text', text: { content: 'Value B1' } }]
          ]
        }
      }
    ]
  }
];

// Notion -> Tiptap
const tiptapResult = notionBlocksToTiptap(mockTableBlockTree);
console.log('Notion -> Tiptap Result:');
console.log(JSON.stringify(tiptapResult, null, 2));

// Tiptap -> Notion
const notionBlocksResult = tiptapToNotionBlocks(tiptapResult.content);
console.log('\nTiptap -> Notion Result:');
console.log(JSON.stringify(notionBlocksResult, null, 2));
