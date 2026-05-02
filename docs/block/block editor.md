# Block-Based Editor Architecture for Notion Clone
## TipTap + ProseMirror Implementation Guide

---

## Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [Core Concepts](#core-concepts)
3. [Technology Stack](#technology-stack)
4. [Project Structure](#project-structure)
5. [Installation & Setup](#installation--setup)
6. [Core Implementation](#core-implementation)
7. [Block Types](#block-types)
8. [Keyboard Shortcuts & UX](#keyboard-shortcuts--ux)
9. [Persistence](#persistence)
10. [Troubleshooting](#troubleshooting)

---

## Architecture Overview

### Why TipTap + ProseMirror?
- **Single Editor Instance**: One TipTap editor per page, not multiple isolated editors
- **Document as Block Structure**: The entire page is a ProseMirror document made of block nodes
- **Robust Selection & Undo**: Built-in support for text selection, undo/redo, copy/paste
- **Native Drag-and-Drop**: Manipulate nodes directly via ProseMirror transactions
- **Scalable**: Easy to add new block types as extensions

### What This is NOT
❌ Multiple contentEditable divs in a React list  
❌ Heavy Redux store with `pages[pageId].blocks: string[]`  
❌ DOM manipulation hacks around the editor  
❌ Wrapper components outside ProseMirror  

### What This IS
✅ One TipTap editor instance wrapping the entire page content  
✅ Block nodes (paragraph, heading, list, table, toggle, subpage) stored as `JSONContent`  
✅ Each block has a stable UUID attribute for reference  
✅ Selection, undo/redo, and drag-and-drop all work natively  
✅ Simple, lightweight, scalable  

---

## Core Concepts

### Block Node Structure
Each block in the document has:
- **id** (UUID): Stable identifier for references, syncing, comments
- **type**: paragraph, heading, bulleted_list, toggle_list, table, subpage
- **content**: Text or nested nodes
- **attrs**: Color, background, level (for headings)

**Example JSON structure:**
```json
{
  "type": "doc",
  "content": [
    {
      "type": "paragraph",
      "attrs": { "id": "block-uuid-1" },
      "content": [{ "type": "text", "text": "Hello world" }]
    },
    {
      "type": "heading",
      "attrs": { "id": "block-uuid-2", "level": 1 },
      "content": [{ "type": "text", "text": "My Title" }]
    },
    {
      "type": "bullet_list",
      "attrs": { "id": "block-uuid-3" },
      "content": [
        {
          "type": "list_item",
          "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "Item 1" }] }]
        }
      ]
    }
  ]
}
```

### Page Data Model
Replace your old block-list system:

**OLD (Don't use):**
```typescript
pages[pageId] = {
  blocks: string[] // ["block-1", "block-2", ...]
}
blocks: Map<blockId, Block> // Separate storage
```

**NEW (Use this):**
```typescript
pages[pageId] = {
  content: JSONContent // TipTap JSON document
  title: string
  lastModified: Date
}

// Optional: Store block-level metadata separately if needed
blockMetadata[blockId] = {
  color?: string
  backgroundColor?: string
  isCollapsed?: boolean // for toggles/subpages
}
```

### Notion UX Invariants (Must-Have)
These rules ensure the editor always feels "right":

1. **Always keep one empty paragraph at the end**
   - User deletes everything? Still have one empty paragraph.
   - Never reach an invalid "empty document" state.

2. **Enter creates a new block**
   - In a paragraph: Insert new paragraph below
   - In a heading: Insert new paragraph below (not another heading)
   - In a list: Insert new list item

3. **Backspace on empty block removes it**
   - But never remove the last paragraph
   - Never leave the document invalid

4. **Title + Enter moves to first block**
   - Editor has a separate title field (outside ProseMirror)
   - Pressing Enter in title focuses first editor block

5. **Tab to indent, Shift+Tab to outdent**
   - Works for lists, toggles, and other nestable blocks

---

## Technology Stack

```
Frontend:
├── React 18+
├── TypeScript
├── TipTap (@tiptap/react, @tiptap/starter-kit)
├── ProseMirror (via TipTap)
├── dnd-kit (for DnD if you want to wrap TipTap handles)
├── Zustand (state for page list, focus, undo/redo)
├── TailwindCSS
└── UUID (for block IDs)

Backend:
├── Node.js + Express (or Next.js)
├── TypeScript
├── Prisma + PostgreSQL
└── WebSockets (Socket.io for real-time collab later)
```

### Key Dependencies
```json
{
  "dependencies": {
    "react": "^18.2.0",
    "typescript": "^5.0.0",
    "@tiptap/react": "^2.1.0",
    "@tiptap/starter-kit": "^2.1.0",
    "@tiptap/extension-table": "^2.1.0",
    "@tiptap/extension-collaboration": "^2.1.0",
    "zustand": "^4.4.0",
    "uuid": "^9.0.0",
    "dnd-kit": "^6.0.0",
    "@dnd-kit/sortable": "^7.0.0",
    "tailwindcss": "^3.3.0"
  }
}
```

---

## Project Structure

```
src/
├── components/
│   ├── Editor/
│   │   ├── PageEditor.tsx          # Main editor wrapper
│   │   ├── BlockEditor.tsx         # TipTap editor instance
│   │   ├── MenuBar.tsx             # Formatting toolbar
│   │   └── SlashMenu.tsx           # Block insertion menu
│   └── Page/
│       ├── PageTitle.tsx           # Title field (outside editor)
│       └── PageView.tsx            # Full page layout
│
├── hooks/
│   ├── usePageEditor.ts            # Editor state & actions
│   ├── useDragDrop.ts              # DnD setup
│   └── useKeyboardShortcuts.ts     # Custom shortcuts
│
├── store/
│   ├── pageStore.ts                # Zustand store for pages
│   └── editorStore.ts              # Editor UI state (focus, etc.)
│
├── types/
│   ├── page.ts                     # Page, Block, JSONContent types
│   └── editor.ts                   # Editor-related types
│
├── utils/
│   ├── blockHelpers.ts             # Block ID extraction, traversal
│   ├── prosemirrorHelpers.ts       # Transaction builders
│   └── constants.ts                # Keyboard codes, block types
│
└── extensions/
    ├── BlockIdExtension.ts         # Adds ID to all block nodes
    ├── BlockMenuExtension.ts       # Slash menu
    ├── CustomTable.ts              # Table with block IDs
    └── Toggle.ts                   # Toggle/collapsible extension
```

---

## Installation & Setup

### Step 1: Initialize Project
```bash
# Create React + TypeScript project
npm create vite@latest antigravity -- --template react-ts
cd antigravity
npm install

# Or with Create React App
npx create-react-app antigravity --template typescript
cd antigravity
```

### Step 2: Install Core Dependencies
```bash
# TipTap & ProseMirror
npm install @tiptap/react @tiptap/starter-kit @tiptap/extension-table @tiptap/pm

# State Management
npm install zustand

# Utilities
npm install uuid
npm install -D @types/uuid

# Styling
npm install tailwindcss postcss autoprefixer
npx tailwindcss init -p

# Optional: DnD for enhanced UX
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

### Step 3: Set Up TailwindCSS
Edit `tailwind.config.js`:
```javascript
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {},
  },
  plugins: [],
};
```

### Step 4: Create Basic App Structure
```typescript
// src/types/page.ts
import { JSONContent } from '@tiptap/react';

export interface Page {
  id: string;
  title: string;
  content: JSONContent;
  lastModified: Date;
  parentId?: string; // for subpages
  order?: number;
}

export type BlockType = 
  | 'paragraph' 
  | 'heading'
  | 'bullet_list'
  | 'ordered_list'
  | 'toggle_list'
  | 'table'
  | 'code_block'
  | 'blockquote'
  | 'horizontal_rule';
```

---

## Core Implementation

### 1. Zustand Store for Pages

**src/store/pageStore.ts**:
```typescript
import { create } from 'zustand';
import { JSONContent } from '@tiptap/react';
import { Page } from '../types/page';
import { v4 as uuidv4 } from 'uuid';

interface PageStore {
  pages: Map<string, Page>;
  currentPageId: string | null;
  
  // Actions
  createPage: (title: string, parentId?: string) => string;
  updatePage: (pageId: string, content: JSONContent) => void;
  deletePage: (pageId: string) => void;
  setCurrentPage: (pageId: string) => void;
  getPage: (pageId: string) => Page | null;
}

export const usePageStore = create<PageStore>((set, get) => ({
  pages: new Map(),
  currentPageId: null,

  createPage: (title, parentId) => {
    const pageId = uuidv4();
    const newPage: Page = {
      id: pageId,
      title,
      content: {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            attrs: { id: uuidv4() },
            content: [],
          },
        ],
      },
      lastModified: new Date(),
      parentId,
    };

    set(state => ({
      pages: new Map(state.pages).set(pageId, newPage),
    }));

    return pageId;
  },

  updatePage: (pageId, content) => {
    set(state => {
      const page = state.pages.get(pageId);
      if (!page) return state;
      
      return {
        pages: new Map(state.pages).set(pageId, {
          ...page,
          content,
          lastModified: new Date(),
        }),
      };
    });
  },

  deletePage: (pageId) => {
    set(state => {
      const newPages = new Map(state.pages);
      newPages.delete(pageId);
      return {
        pages: newPages,
        currentPageId: state.currentPageId === pageId ? null : state.currentPageId,
      };
    });
  },

  setCurrentPage: (pageId) => {
    set({ currentPageId: pageId });
  },

  getPage: (pageId) => {
    return get().pages.get(pageId) || null;
  },
}));
```

### 2. Custom Extension: Block ID

**src/extensions/BlockIdExtension.ts**:
```typescript
import { Extension } from '@tiptap/core';
import { v4 as uuidv4 } from 'uuid';

export const BlockIdExtension = Extension.create({
  name: 'blockId',

  addGlobalAttributes() {
    return [
      {
        types: [
          'paragraph',
          'heading',
          'bullet_list',
          'ordered_list',
          'blockquote',
          'code_block',
          'table',
        ],
        attributes: {
          id: {
            default: null,
            parseHTML: element => element.getAttribute('data-id'),
            renderHTML: attributes => {
              return {
                'data-id': attributes.id || uuidv4(),
              };
            },
          },
        },
      },
    ];
  },

  addKeyboardShortcuts() {
    return {
      // Ensure new blocks get IDs
      Enter: ({ editor }) => {
        const { state, view } = editor;
        const { $from } = state.selection;
        const node = $from.node();

        if (!node.attrs.id) {
          editor.commands.updateAttributes(node.type.name, {
            id: uuidv4(),
          });
        }

        return false; // Let default Enter behavior continue
      },
    };
  },
});
```

### 3. Main Editor Component

**src/components/Editor/BlockEditor.tsx**:
```typescript
import React, { useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableHeader from '@tiptap/extension-table-header';
import TableCell from '@tiptap/extension-table-cell';
import { BlockIdExtension } from '../../extensions/BlockIdExtension';
import { usePageStore } from '../../store/pageStore';
import MenuBar from './MenuBar';
import './BlockEditor.css';

interface BlockEditorProps {
  pageId: string;
}

const BlockEditor: React.FC<BlockEditorProps> = ({ pageId }) => {
  const { getPage, updatePage } = usePageStore();
  const page = getPage(pageId);

  const editor = useEditor({
    extensions: [
      StarterKit,
      BlockIdExtension,
      Table.configure({
        resizable: true,
      }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content: page?.content,
    onUpdate: ({ editor }) => {
      const json = editor.getJSON();
      updatePage(pageId, json);
    },
    editorProps: {
      attributes: {
        class:
          'prose dark:prose-invert prose-sm sm:prose-base lg:prose-lg xl:prose-2xl focus:outline-none max-w-none',
      },
    },
  });

  if (!editor) return null;

  return (
    <div className="w-full">
      <MenuBar editor={editor} />
      <EditorContent editor={editor} className="mt-4" />
    </div>
  );
};

export default BlockEditor;
```

### 4. Formatting Toolbar

**src/components/Editor/MenuBar.tsx**:
```typescript
import React from 'react';
import { Editor } from '@tiptap/react';

interface MenuBarProps {
  editor: Editor;
}

const MenuBar: React.FC<MenuBarProps> = ({ editor }) => {
  if (!editor) return null;

  const buttonClass =
    'px-3 py-2 rounded text-sm font-medium transition-colors ' +
    'hover:bg-gray-200 dark:hover:bg-gray-700 ' +
    'data-[active]:bg-gray-300 dark:data-[active]:bg-gray-600';

  return (
    <div className="flex flex-wrap gap-2 p-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
      {/* Text Formatting */}
      <button
        onClick={() => editor.chain().focus().toggleBold().run()}
        disabled={!editor.can().chain().focus().toggleBold().run()}
        className={buttonClass}
        data-active={editor.isActive('bold')}
      >
        Bold
      </button>

      <button
        onClick={() => editor.chain().focus().toggleItalic().run()}
        disabled={!editor.can().chain().focus().toggleItalic().run()}
        className={buttonClass}
        data-active={editor.isActive('italic')}
      >
        Italic
      </button>

      <button
        onClick={() => editor.chain().focus().toggleStrike().run()}
        disabled={!editor.can().chain().focus().toggleStrike().run()}
        className={buttonClass}
        data-active={editor.isActive('strike')}
      >
        Strike
      </button>

      <button
        onClick={() => editor.chain().focus().toggleCode().run()}
        disabled={!editor.can().chain().focus().toggleCode().run()}
        className={buttonClass}
        data-active={editor.isActive('code')}
      >
        Code
      </button>

      <div className="w-px bg-gray-300 dark:bg-gray-600"></div>

      {/* Block Types */}
      <button
        onClick={() => editor.chain().focus().setParagraph().run()}
        className={buttonClass}
        data-active={editor.isActive('paragraph')}
      >
        Paragraph
      </button>

      <button
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        className={buttonClass}
        data-active={editor.isActive('heading', { level: 1 })}
      >
        H1
      </button>

      <button
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        className={buttonClass}
        data-active={editor.isActive('heading', { level: 2 })}
      >
        H2
      </button>

      <button
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        className={buttonClass}
        data-active={editor.isActive('heading', { level: 3 })}
      >
        H3
      </button>

      <div className="w-px bg-gray-300 dark:bg-gray-600"></div>

      {/* Lists */}
      <button
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        className={buttonClass}
        data-active={editor.isActive('bulletList')}
      >
        Bullet List
      </button>

      <button
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        className={buttonClass}
        data-active={editor.isActive('orderedList')}
      >
        Ordered List
      </button>

      <button
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        className={buttonClass}
        data-active={editor.isActive('codeBlock')}
      >
        Code Block
      </button>

      <div className="w-px bg-gray-300 dark:bg-gray-600"></div>

      {/* Tables */}
      <button
        onClick={() =>
          editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
        }
        className={buttonClass}
      >
        Insert Table
      </button>

      {/* Undo/Redo */}
      <div className="w-px bg-gray-300 dark:bg-gray-600"></div>

      <button
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!editor.can().chain().focus().undo().run()}
        className={buttonClass}
      >
        Undo
      </button>

      <button
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!editor.can().chain().focus().redo().run()}
        className={buttonClass}
      >
        Redo
      </button>
    </div>
  );
};

export default MenuBar;
```

### 5. Full Page Editor

**src/components/Page/PageEditor.tsx**:
```typescript
import React, { useState } from 'react';
import { usePageStore } from '../../store/pageStore';
import BlockEditor from '../Editor/BlockEditor';

interface PageEditorProps {
  pageId: string;
}

const PageEditor: React.FC<PageEditorProps> = ({ pageId }) => {
  const { getPage } = usePageStore();
  const page = getPage(pageId);
  const [title, setTitle] = useState(page?.title || 'Untitled');

  if (!page) {
    return <div>Page not found</div>;
  }

  return (
    <div className="w-full max-w-4xl mx-auto py-8 px-4">
      {/* Page Title */}
      <input
        type="text"
        value={title}
        onChange={e => setTitle(e.target.value)}
        className="w-full text-4xl font-bold mb-8 border-none outline-none bg-transparent"
        placeholder="Untitled"
      />

      {/* Editor */}
      <BlockEditor pageId={pageId} />
    </div>
  );
};

export default PageEditor;
```

---

## Block Types

### Currently Supported (MVP)
1. **Paragraph** - Plain text
2. **Heading** - Levels 1-3
3. **Bullet List** - Unordered lists
4. **Ordered List** - Numbered lists
5. **Table** - Basic tables with rows/cols
6. **Code Block** - Syntax highlighting
7. **Blockquote** - Quoted text
8. **Horizontal Rule** - Visual separator

### Planned (Phase 2)
- Toggle List (collapsible content)
- Subpage (nested pages)
- Later: Image, Video, Database, Embed

---

## Keyboard Shortcuts & UX

### Default (Built into StarterKit)
| Shortcut | Action |
|----------|--------|
| `Ctrl/Cmd + B` | Bold |
| `Ctrl/Cmd + I` | Italic |
| `Ctrl/Cmd + K` | Code |
| `Ctrl/Cmd + Z` | Undo |
| `Ctrl/Cmd + Shift + Z` | Redo |
| `Enter` | New block |
| `Backspace` (empty) | Delete block |
| `Shift + Enter` | Soft break |
| `Tab` | Indent (in lists) |
| `Shift + Tab` | Outdent (in lists) |

### Custom Shortcuts to Add
You can extend in `BlockEditor.tsx`:

```typescript
// In the editor configuration
addKeyboardShortcuts() {
  return {
    // Slash menu trigger
    '/': ({ editor }) => {
      // Trigger block menu
      return false;
    },
    
    // Markdown shortcuts
    '# ': ({ editor }) => {
      return editor.commands.setHeading({ level: 1 });
    },
    '## ': ({ editor }) => {
      return editor.commands.setHeading({ level: 2 });
    },
    '- ': ({ editor }) => {
      return editor.commands.toggleBulletList();
    },
  };
}
```

---

## Persistence

### Option 1: localStorage (for MVP)
```typescript
// Save on every update
useEffect(() => {
  const timer = setTimeout(() => {
    localStorage.setItem('pages', JSON.stringify(Array.from(pages.entries())));
  }, 1000); // Auto-save after 1s inactivity

  return () => clearTimeout(timer);
}, [pages]);

// Load on mount
useEffect(() => {
  const saved = localStorage.getItem('pages');
  if (saved) {
    setPages(new Map(JSON.parse(saved)));
  }
}, []);
```

### Option 2: Backend API (for production)
```typescript
// In pageStore.ts
const updatePage = async (pageId: string, content: JSONContent) => {
  // Optimistic update
  set(state => ({
    pages: new Map(state.pages).set(pageId, {
      ...state.pages.get(pageId)!,
      content,
      lastModified: new Date(),
    }),
  }));

  // Then sync to backend
  try {
    await fetch(`/api/pages/${pageId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    });
  } catch (error) {
    console.error('Failed to save page:', error);
    // Revert or show error toast
  }
};
```

---

## Utilities: Extract Block IDs

**src/utils/blockHelpers.ts**:
```typescript
import { JSONContent } from '@tiptap/react';

/**
 * Get all block IDs from a document in order
 */
export const getBlockIds = (content: JSONContent): string[] => {
  const ids: string[] = [];

  const traverse = (node: JSONContent) => {
    if (node.attrs?.id) {
      ids.push(node.attrs.id);
    }
    if (node.content && Array.isArray(node.content)) {
      node.content.forEach(traverse);
    }
  };

  if (content.content) {
    content.content.forEach(traverse);
  }

  return ids;
};

/**
 * Get a block by ID
 */
export const getBlockById = (content: JSONContent, blockId: string): JSONContent | null => {
  let found: JSONContent | null = null;

  const traverse = (node: JSONContent) => {
    if (node.attrs?.id === blockId) {
      found = node;
      return;
    }
    if (node.content && Array.isArray(node.content)) {
      for (const child of node.content) {
        traverse(child);
        if (found) return;
      }
    }
  };

  if (content.content) {
    for (const node of content.content) {
      traverse(node);
      if (found) return found;
    }
  }

  return found;
};
```

---

## Example App Integration

**src/App.tsx**:
```typescript
import React, { useEffect } from 'react';
import { usePageStore } from './store/pageStore';
import PageEditor from './components/Page/PageEditor';

function App() {
  const { createPage, currentPageId, setCurrentPage } = usePageStore();

  useEffect(() => {
    // Create a demo page if none exists
    if (!currentPageId) {
      const pageId = createPage('Welcome to Notion Clone');
      setCurrentPage(pageId);
    }
  }, []);

  if (!currentPageId) {
    return <div>Loading...</div>;
  }

  return <PageEditor pageId={currentPageId} />;
}

export default App;
```

---

## Common Patterns

### 1. Add a New Block Type Extension

```typescript
import { Node } from '@tiptap/core';

export const CustomBlock = Node.create({
  name: 'customBlock',
  group: 'block',
  content: 'paragraph+',
  
  addAttributes() {
    return {
      id: {
        default: null,
      },
      customProp: {
        default: 'value',
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="custom"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', { 'data-type': 'custom', ...HTMLAttributes }, 0];
  },
});
```

### 2. ProseMirror Plugin for Document Normalization

Ensures an empty paragraph always exists at the end:

```typescript
import { Plugin } from '@tiptap/pm/state';

export const EnforceFinalParagraph = () => {
  return new Plugin({
    appendTransaction: (transactions, oldState, newState) => {
      const { doc } = newState;
      const lastNode = doc.lastChild;

      // If last node is not an empty paragraph, add one
      if (!lastNode || lastNode.type.name !== 'paragraph' || lastNode.content.size > 0) {
        const tr = newState.tr;
        tr.insert(doc.content.size, newState.schema.nodes.paragraph.create());
        return tr;
      }

      return null;
    },
  });
};
```

---

## Troubleshooting

### Issue: Block IDs not persisting
**Solution**: Ensure `BlockIdExtension` is in the extensions array before `StarterKit`, and check that `renderHTML` includes `data-id` attribute.

### Issue: Undo/Redo not working
**Solution**: `StarterKit` includes History extension. If not working, explicitly add:
```typescript
import History from '@tiptap/extension-history';
// ...
extensions: [History, ...otherExtensions]
```

### Issue: Performance degradation with large documents
**Solution**: 
- Use virtualization library for rendering (future)
- Implement pagination or lazy-load blocks
- Profile with React DevTools Profiler

### Issue: Selection jumping around
**Solution**: Ensure all block nodes have unique IDs. Don't use array indices as IDs.

---

## Next Steps

1. ✅ Set up TipTap editor with paragraph, heading, lists
2. ✅ Implement block IDs and document normalization
3. ⬜ Add table support with proper schema
4. ⬜ Implement toggle/collapsible blocks
5. ⬜ Add subpage linking
6. ⬜ Implement drag-and-drop reorder (ProseMirror native or dnd-kit wrapper)
7. ⬜ Add slash menu (`/`) for block creation
8. ⬜ Backend API integration for persistence
9. ⬜ Real-time collaboration with Socket.io + Y.js
10. ⬜ Rich feature set (image, video, database, etc.)

---

## References

- [TipTap Documentation](https://tiptap.dev)
- [ProseMirror Guide](https://prosemirror.net/docs/guide)
- [ProseMirror Reference](https://prosemirror.net/docs/ref)
- [Notion API Reference](https://developers.notion.com/reference/block)
- [Zustand GitHub](https://github.com/pmndrs/zustand)
- [dnd-kit Documentation](https://dnd-kit.com)

---

**Good luck building your Notion clone! 🚀**