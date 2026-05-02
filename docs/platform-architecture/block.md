# Motion: Block-Based Architecture Implementation Guide

## Table of Contents
1. [Understanding Block-Based Architecture](#understanding-block-based-architecture)
2. [Block-Based vs Non-Block-Based Comparison](#block-based-vs-non-block-based-comparison)
3. [Benefits of Block-Based Architecture](#benefits-of-block-based-architecture)
4. [Technology Stack](#technology-stack)
5. [Installation & Setup](#installation--setup)
6. [Core Implementation](#core-implementation)
7. [API Integration with Anthropic](#api-integration-with-anthropic)
8. [Best Practices](#best-practices)

---

## Understanding Block-Based Architecture

### What is a Block?
A **block** is a self-contained, reusable unit of content that can be:
- **Independent**: Each block functions independently
- **Composable**: Multiple blocks combine to form a complete document/page
- **Flexible**: Blocks can be reordered, edited, deleted, and nested
- **Persistent**: Each block has its own state and properties

### Block-Based Architecture Meaning
A block-based architecture breaks down complex documents or interfaces into smaller, manageable components. Instead of treating an entire page as one monolithic entity, it's composed of multiple independent blocks that can be manipulated individually.

**Real-world analogy**: Think of it like LEGO blocks - each piece is independent, but together they create something larger. You can remove one block, swap it with another, or rearrange them without affecting the entire structure.

### Notion's Block Model (Reference)
Notion uses blocks as the fundamental unit of content:
- **Text Block**: Paragraphs, headings
- **Media Block**: Images, videos, embeds
- **Database Block**: Tables, galleries, timelines
- **Interactive Block**: Toggles, callouts, code snippets

Your Motion app will implement a similar philosophy.

---

## Block-Based vs Non-Block-Based Comparison

### Non-Block-Based Approach (Traditional)
```
┌─────────────────────────────────────┐
│         Entire Page/Document        │
│  (Single monolithic component)      │
│                                     │
│  - Update entire component on       │
│    any change                       │
│  - Difficult to manage complexity   │
│  - Limited reusability              │
│  - Harder to maintain               │
└─────────────────────────────────────┘
```

**Problems:**
- Complex state management
- Difficult to isolate changes
- Poor scalability
- Hard to implement collaborative editing
- Limited drag-and-drop functionality

### Block-Based Approach (Modern)
```
┌─────────────────────────────────────┐
│  ┌─────────────┐  ┌──────────────┐ │
│  │ Text Block  │  │ Image Block  │ │
│  └─────────────┘  └──────────────┘ │
│  ┌─────────────┐  ┌──────────────┐ │
│  │ List Block  │  │  Code Block  │ │
│  └─────────────┘  └──────────────┘ │
│  ┌─────────────┐  ┌──────────────┐ │
│  │ Table Block │  │ Embed Block  │ │
│  └─────────────┘  └──────────────┘ │
└─────────────────────────────────────┘
```

**Advantages:**
- Modular and reusable
- Easy to maintain and update
- Better performance (update only affected blocks)
- Simplified state management
- Support for collaborative editing
- Intuitive UI/UX with drag-and-drop
- Extensible architecture

### Detailed Comparison Table

| Feature | Non-Block-Based | Block-Based |
|---------|-----------------|------------|
| **Modularity** | Low - monolithic | High - granular components |
| **Reusability** | Limited | Excellent |
| **Performance** | Slower re-renders | Faster incremental updates |
| **State Management** | Complex, global state | Isolated, local state |
| **Scalability** | Difficult | Easy |
| **Drag & Drop** | Hard to implement | Native support |
| **Collaboration** | Challenging | Well-suited |
| **Extensibility** | Limited | Highly extensible |
| **Learning Curve** | Moderate | Steeper but worth it |
| **Development Time** | Shorter initially | Longer initially, faster maintenance |

---

## Benefits of Block-Based Architecture

### 1. **Modularity & Code Organization**
- Each block is an independent module
- Clear separation of concerns
- Easier to locate and fix bugs
- Simplified testing

### 2. **Performance Optimization**
```javascript
// Only the affected block re-renders
const updateBlock = (blockId, content) => {
  setState(prev => ({
    ...prev,
    blocks: prev.blocks.map(block => 
      block.id === blockId ? { ...block, content } : block
    )
  }))
}
```

### 3. **Extensibility**
- Add new block types without modifying existing code
- Plugin architecture support
- Custom block creation

### 4. **Collaborative Editing**
- Track changes at block level
- Real-time synchronization
- Conflict resolution per block

### 5. **User Experience**
- Intuitive drag-and-drop interface
- Faster interactions
- Better visual feedback
- Mobile-responsive design

### 6. **Content Portability**
- Export/import blocks easily
- Share snippets
- Reuse across documents

---

## Technology Stack

### Frontend Stack (Recommended)
```
├── React 18+
│   ├── For UI components and state management
│   └── Hooks for block lifecycle management
├── TypeScript
│   └── Type safety for block definitions
├── React DnD or Dnd-kit
│   └── Drag-and-drop functionality
├── Redux Toolkit or Zustand
│   └── State management for blocks
├── TailwindCSS
│   └── Styling
└── React Query
    └── Server state management
```

### Backend Stack (Recommended)
```
├── Node.js + Express/Next.js
│   └── API server
├── MongoDB/PostgreSQL
│   └── Database for block storage
├── Prisma or TypeORM
│   └── ORM for database operations
├── Socket.io
│   └── Real-time collaboration
└── Redis
    └── Caching and real-time updates
```

### AI Integration
```
├── Anthropic Claude API
│   ├── Content generation
│   ├── Smart suggestions
│   └── Block enhancement
└── OpenAI API (Optional)
    └── Alternative AI features
```

---

## Installation & Setup

### Step 1: Project Initialization

```bash
# Create a new React project with TypeScript
npx create-react-app motion --template typescript
cd motion

# Or use Vite for faster development
npm create vite@latest motion -- --template react-ts
cd motion
npm install
```

### Step 2: Install Core Dependencies

#### A. State Management
```bash
npm install zustand
# or
npm install @reduxjs/toolkit react-redux
```

**Why Zustand?** Simpler than Redux, easier to understand, smaller bundle size.

#### B. Drag & Drop
```bash
npm install dnd-kit @dnd-kit/core @dnd-kit/utilities @dnd-kit/sortable @dnd-kit/modifiers
npm install react-beautiful-dnd
```

**dnd-kit** is more modern and performant than react-beautiful-dnd.

#### C. Styling & UI
```bash
npm install tailwindcss postcss autoprefixer
npx tailwindcss init -p

npm install @headlessui/react @heroicons/react
npm install clsx classnames
```

#### D. Rich Text Editor (for Text Blocks)
```bash
npm install slate slate-react slate-history
# or for a simpler option
npm install draft-js react-draft-wysiwyg
# or modern lightweight option
npm install tiptap @tiptap/react @tiptap/starter-kit
```

#### E. Utilities
```bash
npm install lodash uuid axios
npm install -D @types/lodash @types/uuid
```

#### F. Database & ORM (Backend)
```bash
npm install prisma @prisma/client
npm install express cors dotenv

npm install -D typescript ts-node @types/express @types/node
```

#### G. API Documentation
```bash
npm install swagger-jsdoc swagger-ui-express
```

### Step 3: Install Anthropic Claude API

```bash
npm install @anthropic-ai/sdk
```

**Or if using Python backend:**
```bash
pip install anthropic
```

### Step 4: Set Up Environment Variables

Create `.env.local`:
```env
# Anthropic API
REACT_APP_ANTHROPIC_API_KEY=your_api_key_here

# Backend
NEXT_PUBLIC_API_URL=http://localhost:3001
DATABASE_URL=postgresql://user:password@localhost:5432/motion
REDIS_URL=redis://localhost:6379
```

**Get API Key**: Visit https://console.anthropic.com to get your Claude API key.

### Step 5: Project Structure

```
motion/
├── src/
│   ├── components/
│   │   ├── Block/
│   │   │   ├── TextBlock.tsx
│   │   │   ├── ImageBlock.tsx
│   │   │   ├── CodeBlock.tsx
│   │   │   ├── ListBlock.tsx
│   │   │   └── BlockContainer.tsx
│   │   ├── BlockEditor/
│   │   │   ├── BlockToolbar.tsx
│   │   │   ├── BlockMenu.tsx
│   │   │   └── BlockProperties.tsx
│   │   └── Editor.tsx
│   ├── hooks/
│   │   ├── useBlocks.ts
│   │   ├── useBlockState.ts
│   │   └── useAI.ts
│   ├── store/
│   │   ├── blockStore.ts
│   │   ├── editorStore.ts
│   │   └── aiStore.ts
│   ├── types/
│   │   ├── block.ts
│   │   └── editor.ts
│   ├── services/
│   │   ├── blockService.ts
│   │   ├── apiService.ts
│   │   └── aiService.ts
│   ├── utils/
│   │   ├── blockHelpers.ts
│   │   └── validators.ts
│   ├── App.tsx
│   └── index.css
├── public/
├── .env.local
├── tailwind.config.js
├── tsconfig.json
└── package.json
```

---

## Core Implementation

### 1. Type Definitions

**src/types/block.ts**:
```typescript
// Block type definitions
export type BlockType = 
  | 'text' 
  | 'heading' 
  | 'image' 
  | 'code' 
  | 'list' 
  | 'table' 
  | 'quote' 
  | 'toggle'
  | 'embed'
  | 'divider';

export interface Block {
  id: string;
  type: BlockType;
  content: any;
  properties: BlockProperties;
  parent?: string;
  children?: string[];
  metadata: BlockMetadata;
  createdAt: Date;
  updatedAt: Date;
}

export interface BlockProperties {
  color?: string;
  backgroundColor?: string;
  alignment?: 'left' | 'center' | 'right';
  isFocused?: boolean;
  isSelected?: boolean;
  level?: number; // for headings and indentation
}

export interface BlockMetadata {
  version: number;
  lastEditedBy?: string;
  deleted?: boolean;
}

export interface Page {
  id: string;
  title: string;
  blocks: string[]; // array of block IDs
  createdAt: Date;
  updatedAt: Date;
}
```

### 2. State Management with Zustand

**src/store/blockStore.ts**:
```typescript
import create from 'zustand';
import { Block, Page } from '../types/block';

interface BlockStore {
  // State
  blocks: Map<string, Block>;
  currentPage: Page | null;
  selectedBlockId: string | null;
  focusedBlockId: string | null;

  // Actions
  addBlock: (block: Block) => void;
  updateBlock: (id: string, updates: Partial<Block>) => void;
  deleteBlock: (id: string) => void;
  reorderBlocks: (pageId: string, newOrder: string[]) => void;
  setSelectedBlock: (id: string | null) => void;
  setFocusedBlock: (id: string | null) => void;
  loadPage: (page: Page, blocks: Block[]) => void;
  getBlocksByPageId: (pageId: string) => Block[];
}

export const useBlockStore = create<BlockStore>((set, get) => ({
  blocks: new Map(),
  currentPage: null,
  selectedBlockId: null,
  focusedBlockId: null,

  addBlock: (block) => set((state) => {
    const newBlocks = new Map(state.blocks);
    newBlocks.set(block.id, block);
    return { blocks: newBlocks };
  }),

  updateBlock: (id, updates) => set((state) => {
    const block = state.blocks.get(id);
    if (!block) return state;
    
    const newBlocks = new Map(state.blocks);
    newBlocks.set(id, { ...block, ...updates, updatedAt: new Date() });
    return { blocks: newBlocks };
  }),

  deleteBlock: (id) => set((state) => {
    const newBlocks = new Map(state.blocks);
    newBlocks.delete(id);
    return { blocks: newBlocks };
  }),

  reorderBlocks: (pageId, newOrder) => set((state) => {
    if (state.currentPage?.id !== pageId) return state;
    return { 
      currentPage: { 
        ...state.currentPage, 
        blocks: newOrder 
      } 
    };
  }),

  setSelectedBlock: (id) => set({ selectedBlockId: id }),

  setFocusedBlock: (id) => set({ focusedBlockId: id }),

  loadPage: (page, blocks) => set(() => {
    const blockMap = new Map<string, Block>();
    blocks.forEach(block => blockMap.set(block.id, block));
    return { 
      currentPage: page, 
      blocks: blockMap 
    };
  }),

  getBlocksByPageId: (pageId) => {
    const state = get();
    if (state.currentPage?.id !== pageId) return [];
    return state.currentPage.blocks
      .map(id => state.blocks.get(id))
      .filter((block): block is Block => block !== undefined);
  },
}));
```

### 3. Block Component Architecture

**src/components/Block/Block.tsx**:
```typescript
import React, { FC } from 'react';
import { Block as BlockType } from '../../types/block';
import TextBlock from './TextBlock';
import ImageBlock from './ImageBlock';
import CodeBlock from './CodeBlock';
import ListBlock from './ListBlock';
import { useBlockStore } from '../../store/blockStore';

interface BlockProps {
  blockId: string;
  index: number;
}

const Block: FC<BlockProps> = ({ blockId, index }) => {
  const blocks = useBlockStore(state => state.blocks);
  const selectedBlockId = useBlockStore(state => state.selectedBlockId);
  const setSelectedBlock = useBlockStore(state => state.setSelectedBlock);
  
  const block = blocks.get(blockId);

  if (!block) return null;

  const isSelected = selectedBlockId === blockId;

  const handleBlockClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedBlock(blockId);
  };

  return (
    <div
      className={`relative group mb-2 ${
        isSelected ? 'bg-blue-50 border-l-4 border-blue-500' : ''
      }`}
      onClick={handleBlockClick}
      draggable={true}
      data-block-id={blockId}
    >
      {/* Block Drag Handle */}
      <div className="absolute -left-8 top-0 hidden group-hover:flex items-center justify-center h-6 w-6 cursor-grab">
        <span className="text-gray-400 text-lg">⋮⋮</span>
      </div>

      {/* Block Content */}
      <div className="pl-4 pr-4 py-2">
        {block.type === 'text' && <TextBlock block={block} />}
        {block.type === 'heading' && <TextBlock block={block} isHeading />}
        {block.type === 'image' && <ImageBlock block={block} />}
        {block.type === 'code' && <CodeBlock block={block} />}
        {block.type === 'list' && <ListBlock block={block} />}
      </div>

      {/* Block Toolbar (appears on hover) */}
      {isSelected && <BlockToolbar blockId={blockId} />}
    </div>
  );
};

export default Block;
```

### 4. Block Toolbar Component

**src/components/BlockEditor/BlockToolbar.tsx**:
```typescript
import React, { FC } from 'react';
import { useBlockStore } from '../../store/blockStore';
import { Block } from '../../types/block';

interface BlockToolbarProps {
  blockId: string;
}

const BlockToolbar: FC<BlockToolbarProps> = ({ blockId }) => {
  const blocks = useBlockStore(state => state.blocks);
  const updateBlock = useBlockStore(state => state.updateBlock);
  const deleteBlock = useBlockStore(state => state.deleteBlock);
  
  const block = blocks.get(blockId);

  if (!block) return null;

  const handleDelete = () => {
    deleteBlock(blockId);
  };

  const handleDuplicate = () => {
    const newBlock: Block = {
      ...block,
      id: `block-${Date.now()}`,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    useBlockStore.setState(state => {
      const newBlocks = new Map(state.blocks);
      newBlocks.set(newBlock.id, newBlock);
      return { blocks: newBlocks };
    });
  };

  const handleColorChange = (color: string) => {
    updateBlock(blockId, { 
      properties: { ...block.properties, color } 
    });
  };

  return (
    <div className="absolute top-0 right-0 hidden group-hover:flex gap-2 bg-white rounded shadow p-2">
      <button
        onClick={handleDuplicate}
        className="px-2 py-1 hover:bg-gray-100 rounded text-sm"
        title="Duplicate"
      >
        📋
      </button>
      <button
        onClick={handleDelete}
        className="px-2 py-1 hover:bg-red-100 rounded text-sm text-red-600"
        title="Delete"
      >
        🗑️
      </button>
      <button
        onClick={() => handleColorChange('bg-yellow-100')}
        className="px-2 py-1 hover:bg-gray-100 rounded text-sm"
        title="Highlight"
      >
        🎨
      </button>
    </div>
  );
};

export default BlockToolbar;
```

### 5. Text Block Implementation

**src/components/Block/TextBlock.tsx**:
```typescript
import React, { FC, useRef, useEffect } from 'react';
import { Block } from '../../types/block';
import { useBlockStore } from '../../store/blockStore';
import { ContentEditable } from './ContentEditable';

interface TextBlockProps {
  block: Block;
  isHeading?: boolean;
}

const TextBlock: FC<TextBlockProps> = ({ block, isHeading = false }) => {
  const updateBlock = useBlockStore(state => state.updateBlock);
  const focusedBlockId = useBlockStore(state => state.focusedBlockId);
  const setFocusedBlock = useBlockStore(state => state.setFocusedBlock);

  const handleChange = (content: string) => {
    updateBlock(block.id, { content });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      // Insert new block below
      const newBlockId = `block-${Date.now()}`;
      useBlockStore.setState(state => {
        const newBlocks = new Map(state.blocks);
        newBlocks.set(newBlockId, {
          id: newBlockId,
          type: 'text',
          content: '',
          properties: {},
          metadata: { version: 1 },
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        return { blocks: newBlocks };
      });
      setFocusedBlock(newBlockId);
    }
  };

  return (
    <div
      className={`outline-none ${
        isHeading ? 'text-2xl font-bold' : 'text-base'
      } ${block.properties?.backgroundColor || ''}`}
      contentEditable
      suppressContentEditableWarning
      onInput={(e) => handleChange(e.currentTarget.textContent || '')}
      onKeyDown={handleKeyDown}
      onFocus={() => setFocusedBlock(block.id)}
      onBlur={() => setFocusedBlock(null)}
    >
      {block.content}
    </div>
  );
};

export default TextBlock;
```

---

## API Integration with Anthropic

### 1. AI Service Setup

**src/services/aiService.ts**:
```typescript
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  apiKey: process.env.REACT_APP_ANTHROPIC_API_KEY,
  dangerouslyAllowBrowser: true, // Only for development!
});

interface AIBlockEnhancementRequest {
  blockId: string;
  blockType: string;
  content: string;
  action: 'enhance' | 'summarize' | 'expand' | 'improve';
}

export const enhanceBlockWithAI = async (
  request: AIBlockEnhancementRequest
) => {
  const prompts: Record<string, string> = {
    enhance: `Improve the following ${request.blockType} content to be more clear and professional: "${request.content}"`,
    summarize: `Create a brief summary of: "${request.content}"`,
    expand: `Expand on the following point with more details: "${request.content}"`,
    improve: `Improve grammar and clarity: "${request.content}"`,
  };

  const prompt = prompts[request.action] || prompts.enhance;

  try {
    const message = await client.messages.create({
      model: 'claude-opus-4-1',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const responseText = message.content
      .filter(block => block.type === 'text')
      .map(block => (block as any).text)
      .join('');

    return {
      success: true,
      enhanced: responseText,
      blockId: request.blockId,
    };
  } catch (error) {
    console.error('AI enhancement error:', error);
    return {
      success: false,
      error: 'Failed to enhance content with AI',
      blockId: request.blockId,
    };
  }
};

// Generate block suggestions based on context
export const generateBlockSuggestions = async (
  currentBlockContent: string,
  blockType: string
): Promise<string[]> => {
  try {
    const message = await client.messages.create({
      model: 'claude-opus-4-1',
      max_tokens: 512,
      messages: [
        {
          role: 'user',
          content: `Based on this ${blockType} content: "${currentBlockContent}", suggest 3 related points or follow-up blocks. Return as a numbered list.`,
        },
      ],
    });

    const text = message.content
      .filter(block => block.type === 'text')
      .map(block => (block as any).text)
      .join('');

    return text.split('\n').filter(line => line.trim());
  } catch (error) {
    console.error('Suggestion generation error:', error);
    return [];
  }
};

// Generate content for a new block based on context
export const generateBlockContent = async (
  blockType: string,
  context: string
): Promise<string> => {
  try {
    const message = await client.messages.create({
      model: 'claude-opus-4-1',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: `Generate relevant ${blockType} content for the following context: "${context}". Be concise and directly relevant.`,
        },
      ],
    });

    return message.content
      .filter(block => block.type === 'text')
      .map(block => (block as any).text)
      .join('');
  } catch (error) {
    console.error('Content generation error:', error);
    return '';
  }
};
```

### 2. AI-Enhanced Block Component

**src/components/Block/AIEnhancedBlock.tsx**:
```typescript
import React, { FC, useState } from 'react';
import { Block } from '../../types/block';
import { enhanceBlockWithAI } from '../../services/aiService';
import { useBlockStore } from '../../store/blockStore';

interface AIEnhancedBlockProps {
  block: Block;
}

const AIEnhancedBlock: FC<AIEnhancedBlockProps> = ({ block }) => {
  const [isLoading, setIsLoading] = useState(false);
  const updateBlock = useBlockStore(state => state.updateBlock);

  const handleEnhance = async (action: 'enhance' | 'summarize' | 'expand' | 'improve') => {
    setIsLoading(true);
    try {
      const result = await enhanceBlockWithAI({
        blockId: block.id,
        blockType: block.type,
        content: block.content,
        action,
      });

      if (result.success) {
        updateBlock(block.id, { content: result.enhanced });
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="group">
      {/* AI Action Buttons */}
      <div className="hidden group-hover:flex gap-2 mb-2">
        <button
          onClick={() => handleEnhance('enhance')}
          disabled={isLoading}
          className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
        >
          ✨ Enhance
        </button>
        <button
          onClick={() => handleEnhance('summarize')}
          disabled={isLoading}
          className="px-3 py-1 text-sm bg-purple-500 text-white rounded hover:bg-purple-600 disabled:opacity-50"
        >
          📝 Summarize
        </button>
        <button
          onClick={() => handleEnhance('expand')}
          disabled={isLoading}
          className="px-3 py-1 text-sm bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
        >
          📖 Expand
        </button>
      </div>
      {isLoading && <div className="text-sm text-gray-500">Processing...</div>}
    </div>
  );
};

export default AIEnhancedBlock;
```

### 3. Drag & Drop Integration

**src/hooks/useDragDrop.ts**:
```typescript
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';

export const useDragDropSetup = () => {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      distance: 8,
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  return {
    sensors,
    collisionDetection: closestCenter,
    strategy: verticalListSortingStrategy,
  };
};
```

**src/components/Editor/SortableBlockList.tsx**:
```typescript
import React, { FC } from 'react';
import { DndContext, DragEndEvent } from '@dnd-kit/core';
import { SortableContext } from '@dnd-kit/sortable';
import { useBlockStore } from '../../store/blockStore';
import Block from '../Block/Block';
import { useDragDropSetup } from '../../hooks/useDragDrop';

interface SortableBlockListProps {
  blockIds: string[];
  pageId: string;
}

const SortableBlockList: FC<SortableBlockListProps> = ({ blockIds, pageId }) => {
  const reorderBlocks = useBlockStore(state => state.reorderBlocks);
  const { sensors, collisionDetection, strategy } = useDragDropSetup();

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = blockIds.indexOf(active.id as string);
      const newIndex = blockIds.indexOf(over.id as string);
      const newOrder = arrayMove(blockIds, oldIndex, newIndex);
      reorderBlocks(pageId, newOrder);
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={blockIds} strategy={strategy}>
        {blockIds.map((blockId, index) => (
          <Block key={blockId} blockId={blockId} index={index} />
        ))}
      </SortableContext>
    </DndContext>
  );
};

export default SortableBlockList;
```

---

## Best Practices

### 1. Block Lifecycle Management
```typescript
// Use proper cleanup
useEffect(() => {
  // Component mounted
  setFocusedBlock(blockId);

  return () => {
    // Component unmounted - cleanup
    setFocusedBlock(null);
  };
}, [blockId]);
```

### 2. Performance Optimization
```typescript
// Memoize block components to prevent unnecessary re-renders
export default React.memo(Block, (prevProps, nextProps) => {
  return prevProps.blockId === nextProps.blockId && 
         prevProps.index === nextProps.index;
});
```

### 3. Error Handling
```typescript
// Always wrap AI calls in try-catch
try {
  const result = await enhanceBlockWithAI(request);
} catch (error) {
  console.error('AI operation failed:', error);
  showErrorToast('Failed to enhance block');
}
```

### 4. API Rate Limiting
```typescript
// Implement debouncing for AI operations
import { debounce } from 'lodash';

const debouncedEnhance = debounce(enhanceBlockWithAI, 1000);
```

### 5. Persistence
```typescript
// Save blocks to localStorage or backend
useEffect(() => {
  const timer = setTimeout(() => {
    localStorage.setItem('motion-blocks', JSON.stringify(Array.from(blocks)));
  }, 1000); // Auto-save after 1 second of inactivity

  return () => clearTimeout(timer);
}, [blocks]);
```

### 6. Accessibility
```typescript
// Ensure proper ARIA labels and keyboard navigation
<div
  role="button"
  tabIndex={0}
  onKeyDown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      handleAction();
    }
  }}
>
  Block Content
</div>
```

---

## API Documentation

### Anthropic Claude API Configuration

**Documentation**: https://docs.claude.com/en/api/overview

**Key endpoints used in Motion**:
- `POST /messages` - Core API for text generation and enhancement

**Rate Limits** (as of 2024):
- Standard: 50 requests per minute
- Batch: Use batch API for high-volume operations

**Cost Estimation**:
- Input: $3 per 1M tokens
- Output: $15 per 1M tokens
- Monitor usage at: https://console.anthropic.com

### Recommended Models

```javascript
// Fastest - Good for real-time features
model: 'claude-haiku-3-5'

// Best Balance - Recommended for Motion
model: 'claude-sonnet-4-20250514'

// Most Capable - For complex tasks
model: 'claude-opus-4-1'
```

---

## Deployment Checklist

- [ ] Remove `dangerouslyAllowBrowser: true` from production
- [ ] Set up backend API server for AI operations
- [ ] Configure environment variables on hosting platform
- [ ] Set up database migrations
- [ ] Implement rate limiting
- [ ] Add error tracking (Sentry)
- [ ] Set up monitoring and logging
- [ ] Test block persistence and recovery
- [ ] Verify drag-and-drop on mobile
- [ ] Load test with multiple blocks

---

## Troubleshooting

### AI requests timing out
- Increase `max_tokens` only if necessary
- Implement request timeouts
- Use streaming for long operations

### Blocks not reordering
- Check that block IDs are unique
- Verify dnd-kit provider is wrapping blocks
- Clear browser cache

### Performance degradation
- Profile with React DevTools
- Implement virtualization for large documents
- Use React.memo for block components
- Optimize state selectors with Zustand

---

## Next Steps

1. Implement the block types you need
2. Add database persistence layer
3. Implement collaborative editing with Socket.io
4. Add more AI features (templates, smart suggestions)
5. Create mobile-responsive UI
6. Set up user authentication
7. Add export/import functionality
8. Build plugin system for custom blocks

---

## Resources

- **Notion Block Documentation**: https://developers.notion.com/reference/block
- **Anthropic API Docs**: https://docs.claude.com
- **dnd-kit Documentation**: https://dnd-kit.com
- **Zustand Documentation**: https://github.com/pmndrs/zustand
- **TailwindCSS**: https://tailwindcss.com
- **React Best Practices**: https://react.dev

---

**Happy Coding! 🚀**
