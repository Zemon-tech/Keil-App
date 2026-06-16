import { notionBlocksToTiptap } from './services/notion.service';

const mockBlockTree = [
  {
    id: 'block-1',
    type: 'toggle',
    has_children: true,
    toggle: {
      rich_text: [{ type: 'text', text: { content: 'This is a standard toggle' } }]
    },
    children: [
      {
        id: 'block-1-child-1',
        type: 'unsupported_type_or_empty',
        unsupported_type_or_empty: {}
      }
    ]
  },
  {
    id: 'block-2',
    type: 'heading_1',
    has_children: true,
    heading_1: {
      rich_text: [{ type: 'text', text: { content: 'This is a toggle heading 1' } }],
      is_toggleable: true
    },
    children: [] // No children
  }
];

const result = notionBlocksToTiptap(mockBlockTree);
console.log('Resulting Tiptap JSON:');
console.log(JSON.stringify(result, null, 2));
