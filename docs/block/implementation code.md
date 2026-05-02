# Implementation Code Examples - Notion Clone Block Editor

Complete, production-ready code snippets you can copy directly into your `antigravity` project.

---

## 1. Type Definitions

**src/types/page.ts**:
```typescript
import { JSONContent } from '@tiptap/react';

export interface Page {
  id: string;
  title: string;
  content: JSONContent;
  lastModified: Date;
  parentId?: string; // for nested pages
  order?: number;
  icon?: string; // emoji or icon name
  cover?: string; // cover image URL (for future)
}

export interface Block {
  id: string;
  type: BlockType;
  content?: string;
  attrs?: Record<string, any>;
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
  | 'horizontal_rule'
  | 'subpage';

export interface BlockMetadata {
  blockId: string;
  color?: string;
  backgroundColor?: string;
  isCollapsed?: boolean;
}
```

**src/types/editor.ts**:
```typescript
export interface EditorState {
  focusedBlockId: string | null;
  selectedBlockIds: string[];
  isDirty: boolean;
}

export interface MenuPosition {
  x: number;
  y: number;
  visible: boolean;
}
```

---

## 2. Zustand Store

**src/store/pageStore.ts**:
```typescript
import { create } from 'zustand';
import { JSONContent } from '@tiptap/react';
import { Page } from '../types/page';
import { v4 as uuidv4 } from 'uuid';

interface PageStoreState {
  pages: Map<string, Page>;
  currentPageId: string | null;
}

interface PageStoreActions {
  createPage: (title: string, parentId?: string) => string;
  updatePageTitle: (pageId: string, title: string) => void;
  updatePageContent: (pageId: string, content: JSONContent) => void;
  deletePage: (pageId: string) => void;
  setCurrentPage: (pageId: string | null) => void;
  getPage: (pageId: string) => Page | null;
  getAllPages: () => Page[];
  getSubpages: (pageId: string) => Page[];
  loadPagesFromStorage: () => void;
  savePagesToStorage: () => void;
}

type PageStore = PageStoreState & PageStoreActions;

const STORAGE_KEY = 'notion-clone-pages';

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
      order: 0,
    };

    set(state => {
      const newPages = new Map(state.pages);
      newPages.set(pageId, newPage);
      return { pages: newPages };
    });

    get().savePagesToStorage();
    return pageId;
  },

  updatePageTitle: (pageId, title) => {
    set(state => {
      const page = state.pages.get(pageId);
      if (!page) return state;

      const newPages = new Map(state.pages);
      newPages.set(pageId, {
        ...page,
        title,
        lastModified: new Date(),
      });

      return { pages: newPages };
    });

    get().savePagesToStorage();
  },

  updatePageContent: (pageId, content) => {
    set(state => {
      const page = state.pages.get(pageId);
      if (!page) return state;

      const newPages = new Map(state.pages);
      newPages.set(pageId, {
        ...page,
        content,
        lastModified: new Date(),
      });

      return { pages: newPages };
    });

    get().savePagesToStorage();
  },

  deletePage: (pageId) => {
    set(state => {
      const newPages = new Map(state.pages);
      newPages.delete(pageId);

      // Delete subpages
      for (const [id, page] of newPages.entries()) {
        if (page.parentId === pageId) {
          newPages.delete(id);
        }
      }

      return {
        pages: newPages,
        currentPageId: state.currentPageId === pageId ? null : state.currentPageId,
      };
    });

    get().savePagesToStorage();
  },

  setCurrentPage: (pageId) => {
    set({ currentPageId: pageId });
  },

  getPage: (pageId) => {
    return get().pages.get(pageId) || null;
  },

  getAllPages: () => {
    return Array.from(get().pages.values());
  },

  getSubpages: (parentId) => {
    return Array.from(get().pages.values()).filter(p => p.parentId === parentId);
  },

  loadPagesFromStorage: () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        const pagesMap = new Map(parsed);
        set({ pages: pagesMap });
      }
    } catch (error) {
      console.error('Failed to load pages from storage:', error);
    }
  },

  savePagesToStorage: () => {
    try {
      const pages = get().pages;
      const serialized = Array.from(pages.entries());
      localStorage.setItem(STORAGE_KEY, JSON.stringify(serialized));
    } catch (error) {
      console.error('Failed to save pages to storage:', error);
    }
  },
}));
```

**src/store/editorStore.ts**:
```typescript
import { create } from 'zustand';
import { EditorState } from '../types/editor';

interface EditorStoreState extends EditorState {}

interface EditorStoreActions {
  setFocusedBlock: (blockId: string | null) => void;
  setSelectedBlocks: (blockIds: string[]) => void;
  addSelectedBlock: (blockId: string) => void;
  removeSelectedBlock: (blockId: string) => void;
  clearSelectedBlocks: () => void;
  setDirty: (isDirty: boolean) => void;
}

type EditorStore = EditorStoreState & EditorStoreActions;

export const useEditorStore = create<EditorStore>(set => ({
  focusedBlockId: null,
  selectedBlockIds: [],
  isDirty: false,

  setFocusedBlock: (blockId) => set({ focusedBlockId: blockId }),

  setSelectedBlocks: (blockIds) => set({ selectedBlockIds: blockIds }),

  addSelectedBlock: (blockId) => {
    set(state => {
      if (!state.selectedBlockIds.includes(blockId)) {
        return { selectedBlockIds: [...state.selectedBlockIds, blockId] };
      }
      return state;
    });
  },

  removeSelectedBlock: (blockId) => {
    set(state => ({
      selectedBlockIds: state.selectedBlockIds.filter(id => id !== blockId),
    }));
  },

  clearSelectedBlocks: () => set({ selectedBlockIds: [] }),

  setDirty: (isDirty) => set({ isDirty }),
}));
```

---

## 3. Extensions

**src/extensions/BlockIdExtension.ts**:
```typescript
import { Extension } from '@tiptap/core';
import { v4 as uuidv4 } from 'uuid';

declare global {
  namespace TiptapExtension {
    interface Commands<ReturnType> {
      blockId: {
        setBlockId: (id: string) => ReturnType;
      };
    }
  }
}

export const BlockIdExtension = Extension.create({
  name: 'blockId',

  addGlobalAttributes() {
    return [
      {
        types: [
          'paragraph',
          'heading',
          'bulletList',
          'orderedList',
          'blockquote',
          'codeBlock',
          'table',
          'image',
          'horizontalRule',
        ],
        attributes: {
          id: {
            default: null,
            parseHTML: element => element.getAttribute('data-id'),
            renderHTML: attributes => ({
              'data-id': attributes.id || uuidv4(),
            }),
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      setBlockId:
        (id: string) =>
        ({ commands }) => {
          return commands.updateAttributes(this.name, { id });
        },
    };
  },

  addKeyboardShortcuts() {
    return {
      // Ensure new paragraphs get IDs on creation
      Enter: ({ editor }) => {
        return false; // Let default behavior happen
      },
    };
  },
});
```

**src/extensions/EnforceFinalBlockExtension.ts**:
```typescript
import { Extension } from '@tiptap/core';
import { Plugin } from '@tiptap/pm/state';
import { v4 as uuidv4 } from 'uuid';

export const EnforceFinalBlockExtension = Extension.create({
  name: 'enforceFinalBlock',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        appendTransaction: (transactions, oldState, newState) => {
          const { doc } = newState;
          const docSize = doc.content.size;

          // Check if the last node is a paragraph with content
          let needsNewParagraph = false;

          if (docSize === 0) {
            needsNewParagraph = true;
          } else {
            const lastNode = doc.lastChild;
            if (!lastNode || lastNode.type.name !== 'paragraph') {
              needsNewParagraph = true;
            } else if (lastNode.content.size > 0) {
              // Paragraph has content, might need another empty one
              needsNewParagraph = true;
            }
          }

          if (needsNewParagraph) {
            const tr = newState.tr;
            const paragraph = newState.schema.nodes.paragraph.create(
              { id: uuidv4() },
              []
            );
            tr.insert(docSize, paragraph);
            return tr;
          }

          return null;
        },
      }),
    ];
  },
});
```

---

## 4. Block Helper Utilities

**src/utils/blockHelpers.ts**:
```typescript
import { JSONContent } from '@tiptap/react';
import { v4 as uuidv4 } from 'uuid';

/**
 * Extract all block IDs from a document in order
 */
export const getBlockIds = (content: JSONContent | undefined): string[] => {
  const ids: string[] = [];

  const traverse = (node: JSONContent | undefined): void => {
    if (!node) return;
    if (node.attrs?.id) {
      ids.push(node.attrs.id);
    }
    if (node.content && Array.isArray(node.content)) {
      node.content.forEach(traverse);
    }
  };

  if (content?.content && Array.isArray(content.content)) {
    content.content.forEach(traverse);
  }

  return ids;
};

/**
 * Find a block node by ID
 */
export const getBlockById = (
  content: JSONContent | undefined,
  blockId: string
): JSONContent | null => {
  let found: JSONContent | null = null;

  const traverse = (node: JSONContent | undefined): void => {
    if (!node) return;
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

  if (content?.content && Array.isArray(content.content)) {
    for (const node of content.content) {
      traverse(node);
      if (found) return found;
    }
  }

  return found;
};

/**
 * Ensure all blocks have unique IDs
 */
export const ensureBlockIds = (content: JSONContent | undefined): JSONContent => {
  if (!content) {
    return {
      type: 'doc',
      content: [{ type: 'paragraph', attrs: { id: uuidv4() }, content: [] }],
    };
  }

  const process = (node: JSONContent): JSONContent => {
    const processedNode = { ...node };

    // Add ID if missing
    if (
      ['paragraph', 'heading', 'bulletList', 'orderedList', 'blockquote', 'codeBlock'].includes(
        node.type || ''
      )
    ) {
      if (!processedNode.attrs?.id) {
        processedNode.attrs = { ...processedNode.attrs, id: uuidv4() };
      }
    }

    // Recursively process children
    if (node.content && Array.isArray(node.content)) {
      processedNode.content = node.content.map(process);
    }

    return processedNode;
  };

  return process(content);
};

/**
 * Get text content of a block
 */
export const getBlockText = (block: JSONContent | undefined): string => {
  if (!block) return '';

  let text = '';

  const traverse = (node: JSONContent | undefined): void => {
    if (!node) return;

    if (node.type === 'text' && node.text) {
      text += node.text;
    }

    if (node.content && Array.isArray(node.content)) {
      node.content.forEach(traverse);
    }
  };

  traverse(block);
  return text;
};

/**
 * Count total blocks in a document
 */
export const countBlocks = (content: JSONContent | undefined): number => {
  if (!content?.content || !Array.isArray(content.content)) {
    return 0;
  }

  return content.content.filter(
    node => node.type && ['paragraph', 'heading', 'blockquote', 'codeBlock'].includes(node.type)
  ).length;
};
```

---

## 5. Components

**src/components/Editor/BlockEditor.tsx**:
```typescript
import React, { useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableHeader from '@tiptap/extension-table-header';
import TableCell from '@tiptap/extension-table-cell';
import { BlockIdExtension } from '../../extensions/BlockIdExtension';
import { EnforceFinalBlockExtension } from '../../extensions/EnforceFinalBlockExtension';
import { usePageStore } from '../../store/pageStore';
import { ensureBlockIds } from '../../utils/blockHelpers';
import MenuBar from './MenuBar';
import './BlockEditor.css';

interface BlockEditorProps {
  pageId: string;
}

const BlockEditor: React.FC<BlockEditorProps> = ({ pageId }) => {
  const { getPage, updatePageContent } = usePageStore();
  const page = getPage(pageId);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        history: {
          depth: 100,
        },
      }),
      BlockIdExtension,
      EnforceFinalBlockExtension,
      Table.configure({
        resizable: true,
      }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content: page?.content ? ensureBlockIds(page.content) : undefined,
    onUpdate: ({ editor }) => {
      const json = editor.getJSON();
      updatePageContent(pageId, json);
    },
    editorProps: {
      attributes: {
        class:
          'prose dark:prose-invert prose-sm sm:prose-base focus:outline-none max-w-none',
      },
    },
  });

  if (!editor) {
    return <div className="text-gray-500">Loading editor...</div>;
  }

  return (
    <div className="w-full">
      <MenuBar editor={editor} />
      <div className="mt-4 px-4">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
};

export default BlockEditor;
```

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
    'px-2 py-1 rounded text-sm transition-colors whitespace-nowrap ' +
    'hover:bg-gray-200 dark:hover:bg-gray-700 ' +
    'enabled:hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed ' +
    'data-[active="true"]:bg-blue-200 dark:data-[active="true"]:bg-blue-900';

  return (
    <div className="flex flex-wrap gap-1 p-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 sticky top-0 z-10">
      {/* Text Formatting */}
      <div className="flex gap-1 border-r border-gray-300 dark:border-gray-600 pr-2">
        <button
          onClick={() => editor.chain().focus().toggleBold().run()}
          disabled={!editor.can().chain().focus().toggleBold().run()}
          className={buttonClass}
          data-active={editor.isActive('bold')}
          title="Bold (Ctrl+B)"
        >
          <strong>B</strong>
        </button>

        <button
          onClick={() => editor.chain().focus().toggleItalic().run()}
          disabled={!editor.can().chain().focus().toggleItalic().run()}
          className={buttonClass}
          data-active={editor.isActive('italic')}
          title="Italic (Ctrl+I)"
        >
          <em>I</em>
        </button>

        <button
          onClick={() => editor.chain().focus().toggleStrike().run()}
          disabled={!editor.can().chain().focus().toggleStrike().run()}
          className={buttonClass}
          data-active={editor.isActive('strike')}
          title="Strikethrough"
        >
          <s>S</s>
        </button>

        <button
          onClick={() => editor.chain().focus().toggleCode().run()}
          disabled={!editor.can().chain().focus().toggleCode().run()}
          className={buttonClass}
          data-active={editor.isActive('code')}
          title="Code (Ctrl+K)"
        >
          {'<>'}
        </button>
      </div>

      {/* Block Types */}
      <div className="flex gap-1 border-r border-gray-300 dark:border-gray-600 pr-2">
        <button
          onClick={() => editor.chain().focus().setParagraph().run()}
          className={buttonClass}
          data-active={editor.isActive('paragraph')}
          title="Paragraph"
        >
          ¶
        </button>

        {[1, 2, 3].map(level => (
          <button
            key={level}
            onClick={() => editor.chain().focus().toggleHeading({ level }).run()}
            className={buttonClass}
            data-active={editor.isActive('heading', { level })}
            title={`Heading ${level}`}
          >
            H{level}
          </button>
        ))}
      </div>

      {/* Lists */}
      <div className="flex gap-1 border-r border-gray-300 dark:border-gray-600 pr-2">
        <button
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={buttonClass}
          data-active={editor.isActive('bulletList')}
          title="Bullet List"
        >
          • List
        </button>

        <button
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={buttonClass}
          data-active={editor.isActive('orderedList')}
          title="Ordered List"
        >
          1. List
        </button>

        <button
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          className={buttonClass}
          data-active={editor.isActive('codeBlock')}
          title="Code Block"
        >
          Code
        </button>
      </div>

      {/* Tables */}
      <div className="flex gap-1 border-r border-gray-300 dark:border-gray-600 pr-2">
        <button
          onClick={() =>
            editor
              .chain()
              .focus()
              .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
              .run()
          }
          className={buttonClass}
          title="Insert Table"
        >
          Table
        </button>
      </div>

      {/* Other */}
      <div className="flex gap-1 border-r border-gray-300 dark:border-gray-600 pr-2">
        <button
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className={buttonClass}
          data-active={editor.isActive('blockquote')}
          title="Blockquote"
        >
          "
        </button>

        <button
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          className={buttonClass}
          title="Horizontal Rule"
        >
          —
        </button>
      </div>

      {/* Undo/Redo */}
      <div className="flex gap-1">
        <button
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().chain().focus().undo().run()}
          className={buttonClass}
          title="Undo (Ctrl+Z)"
        >
          ↶
        </button>

        <button
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().chain().focus().redo().run()}
          className={buttonClass}
          title="Redo (Ctrl+Shift+Z)"
        >
          ↷
        </button>
      </div>
    </div>
  );
};

export default MenuBar;
```

**src/components/Page/PageEditor.tsx**:
```typescript
import React, { useState, useEffect } from 'react';
import { usePageStore } from '../../store/pageStore';
import BlockEditor from '../Editor/BlockEditor';

interface PageEditorProps {
  pageId: string;
}

const PageEditor: React.FC<PageEditorProps> = ({ pageId }) => {
  const { getPage, updatePageTitle } = usePageStore();
  const page = getPage(pageId);
  const [title, setTitle] = useState('');

  useEffect(() => {
    if (page) {
      setTitle(page.title);
    }
  }, [page]);

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTitle = e.target.value;
    setTitle(newTitle);
    updatePageTitle(pageId, newTitle);
  };

  if (!page) {
    return <div className="text-center mt-8 text-gray-500">Page not found</div>;
  }

  return (
    <div className="w-full max-w-4xl mx-auto py-8 px-4">
      {/* Page Title */}
      <input
        type="text"
        value={title}
        onChange={handleTitleChange}
        placeholder="Untitled"
        className="w-full text-5xl font-bold mb-8 border-none outline-none bg-transparent placeholder-gray-300"
        spellCheck="false"
      />

      {/* Editor */}
      <BlockEditor pageId={pageId} />
    </div>
  );
};

export default PageEditor;
```

**src/components/Page/PageList.tsx**:
```typescript
import React from 'react';
import { usePageStore } from '../../store/pageStore';

interface PageListProps {
  onPageSelect: (pageId: string) => void;
  selectedPageId?: string;
}

const PageList: React.FC<PageListProps> = ({ onPageSelect, selectedPageId }) => {
  const { getAllPages, createPage, deletePage } = usePageStore();
  const pages = getAllPages().filter(p => !p.parentId); // Top-level only

  return (
    <div className="w-full max-w-sm border-r border-gray-200 dark:border-gray-700 p-4">
      <h2 className="text-lg font-bold mb-4">Pages</h2>

      <button
        onClick={() => {
          const newPageId = createPage('New Page');
          onPageSelect(newPageId);
        }}
        className="w-full mb-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
      >
        + New Page
      </button>

      <div className="space-y-2">
        {pages.map(page => (
          <div
            key={page.id}
            className={`p-2 rounded cursor-pointer transition-colors ${
              selectedPageId === page.id
                ? 'bg-blue-100 dark:bg-blue-900'
                : 'hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            <div className="flex justify-between items-center">
              <button
                onClick={() => onPageSelect(page.id)}
                className="flex-1 text-left font-medium truncate"
              >
                {page.title || 'Untitled'}
              </button>
              <button
                onClick={() => deletePage(page.id)}
                className="text-red-500 hover:text-red-700 text-sm"
              >
                ×
              </button>
            </div>
            <p className="text-xs text-gray-500">
              {new Date(page.lastModified).toLocaleDateString()}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PageList;
```

---

## 6. Main App Component

**src/App.tsx**:
```typescript
import React, { useEffect, useState } from 'react';
import { usePageStore } from './store/pageStore';
import PageList from './components/Page/PageList';
import PageEditor from './components/Page/PageEditor';

function App() {
  const { createPage, currentPageId, setCurrentPage, loadPagesFromStorage } = usePageStore();
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    // Load from localStorage on mount
    loadPagesFromStorage();
    setInitialized(true);

    // Create a default page if none exists
    const { pages } = usePageStore.getState();
    if (pages.size === 0) {
      const pageId = createPage('Welcome to Notion Clone');
      setCurrentPage(pageId);
    } else if (!currentPageId) {
      const firstPage = Array.from(pages.values())[0];
      setCurrentPage(firstPage.id);
    }
  }, []);

  if (!initialized) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  return (
    <div className="flex h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      {/* Sidebar */}
      <PageList
        onPageSelect={setCurrentPage}
        selectedPageId={currentPageId || undefined}
      />

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        {currentPageId ? (
          <PageEditor pageId={currentPageId} />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500">
            Select or create a page to start
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
```

---

## 7. CSS Styling

**src/components/Editor/BlockEditor.css**:
```css
/* Prose styling */
.ProseMirror {
  outline: none;
}

.ProseMirror p {
  margin: 1em 0;
  line-height: 1.6;
}

.ProseMirror h1,
.ProseMirror h2,
.ProseMirror h3 {
  margin: 1.5em 0 0.5em 0;
  font-weight: 600;
  line-height: 1.4;
}

.ProseMirror h1 {
  font-size: 2em;
}

.ProseMirror h2 {
  font-size: 1.5em;
}

.ProseMirror h3 {
  font-size: 1.25em;
}

.ProseMirror ul,
.ProseMirror ol {
  padding-left: 2em;
  margin: 1em 0;
}

.ProseMirror ul li,
.ProseMirror ol li {
  margin: 0.25em 0;
}

.ProseMirror code {
  background-color: #f3f4f6;
  color: #d946ef;
  padding: 0.2em 0.4em;
  border-radius: 0.25em;
  font-family: monospace;
  font-size: 0.9em;
}

.ProseMirror pre {
  background: #1f2937;
  color: #f3f4f6;
  padding: 1em;
  border-radius: 0.5em;
  overflow-x: auto;
  margin: 1em 0;
}

.ProseMirror pre code {
  background: none;
  color: inherit;
  padding: 0;
  font-size: 1em;
}

.ProseMirror blockquote {
  border-left: 4px solid #d1d5db;
  padding-left: 1em;
  margin: 1em 0;
  color: #6b7280;
  font-style: italic;
}

.ProseMirror table {
  border-collapse: collapse;
  margin: 1em 0;
  width: 100%;
  border: 1px solid #d1d5db;
}

.ProseMirror table td,
.ProseMirror table th {
  border: 1px solid #d1d5db;
  padding: 0.5em;
  min-width: 2em;
}

.ProseMirror table th {
  background: #f3f4f6;
  font-weight: 600;
}

.ProseMirror hr {
  border: none;
  border-top: 1px solid #d1d5db;
  margin: 2em 0;
}

/* Block focus indicator */
.ProseMirror [data-id] {
  position: relative;
}

.ProseMirror [data-id]:hover {
  background-color: rgba(59, 130, 246, 0.05);
}
```

---

## 8. Installing & Running

**package.json** (key dependencies):
```json
{
  "name": "antigravity",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "lint": "eslint src"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "@tiptap/react": "^2.1.0",
    "@tiptap/starter-kit": "^2.1.0",
    "@tiptap/extension-table": "^2.1.0",
    "@tiptap/extension-table-row": "^2.1.0",
    "@tiptap/extension-table-header": "^2.1.0",
    "@tiptap/extension-table-cell": "^2.1.0",
    "zustand": "^4.4.0",
    "uuid": "^9.0.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "@types/node": "^20.0.0",
    "@types/uuid": "^9.0.0",
    "typescript": "^5.0.0",
    "vite": "^5.0.0",
    "autoprefixer": "^10.4.0",
    "postcss": "^8.4.0",
    "tailwindcss": "^3.3.0"
  }
}
```

**Installation**:
```bash
npm install
npm run dev
```

---

## 9. Next Steps Checklist

- [ ] Copy all files to your project
- [ ] Run `npm install`
- [ ] Start dev server with `npm run dev`
- [ ] Test basic paragraph, heading, list creation
- [ ] Test drag-and-drop (basic)
- [ ] Add toggle/collapsible blocks (Phase 2)
- [ ] Add subpage linking (Phase 2)
- [ ] Backend persistence (Phase 3)
- [ ] Real-time collaboration (Phase 4+)

---

**You're ready to go! Happy coding! 🚀**