import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Block, Page } from '../types/block';

interface BlockStore {
  // State
  blocks: Map<string, Block>;
  pages: Record<string, Page>;
  selectedBlockId: string | null;
  focusedBlockId: string | null;

  // Actions
  addBlock: (block: Block) => void;
  updateBlock: (id: string, updates: Partial<Block>) => void;
  deleteBlock: (id: string) => void;
  reorderBlocks: (pageId: string, newOrder: string[]) => void;
  setSelectedBlock: (id: string | null) => void;
  setFocusedBlock: (id: string | null) => void;
  initPage: (pageId: string) => void;
  addBlockToPage: (pageId: string, blockId: string, afterBlockId?: string) => void;
  removeBlockFromPage: (pageId: string, blockId: string) => void;
}

export const useBlockStore = create<BlockStore>()(
  persist(
    (set) => ({
      blocks: new Map(),
      pages: {},
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
        newBlocks.set(id, { ...block, ...updates, updatedAt: Date.now() });
        return { blocks: newBlocks };
      }),

      deleteBlock: (id) => set((state) => {
        const newBlocks = new Map(state.blocks);
        newBlocks.delete(id);
        return { blocks: newBlocks };
      }),

      reorderBlocks: (pageId, newOrder) => set((state) => {
        const page = state.pages[pageId];
        if (!page) return state;
        return { 
          pages: { 
            ...state.pages, 
            [pageId]: { ...page, blocks: newOrder, updatedAt: Date.now() } 
          } 
        };
      }),

      setSelectedBlock: (id) => set({ selectedBlockId: id }),

      setFocusedBlock: (id) => set({ focusedBlockId: id }),

      initPage: (pageId) => set((state) => {
        if (state.pages[pageId]) return state; // Already exists
        
        const initialBlockId = `block-${Date.now()}`;
        const newBlocks = new Map(state.blocks);
        newBlocks.set(initialBlockId, {
          id: initialBlockId,
          type: 'text',
          content: '',
          properties: {},
          metadata: { version: 1 },
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });

        return {
          blocks: newBlocks,
          pages: {
            ...state.pages,
            [pageId]: {
              id: pageId,
              title: 'Untitled',
              blocks: [initialBlockId],
              createdAt: Date.now(),
              updatedAt: Date.now(),
            }
          }
        };
      }),

      addBlockToPage: (pageId, blockId, afterBlockId) => set((state) => {
        const page = state.pages[pageId];
        if (!page) return state;
        
        const newBlocksArray = [...page.blocks];
        if (afterBlockId) {
          const index = newBlocksArray.indexOf(afterBlockId);
          if (index !== -1) {
            newBlocksArray.splice(index + 1, 0, blockId);
          } else {
            newBlocksArray.push(blockId);
          }
        } else {
          newBlocksArray.push(blockId);
        }
        
        return {
          pages: {
            ...state.pages,
            [pageId]: { ...page, blocks: newBlocksArray, updatedAt: Date.now() }
          }
        };
      }),

      removeBlockFromPage: (pageId, blockId) => set((state) => {
        const page = state.pages[pageId];
        if (!page) return state;
        
        return {
          pages: {
            ...state.pages,
            [pageId]: { 
              ...page, 
              blocks: page.blocks.filter(id => id !== blockId), 
              updatedAt: Date.now() 
            }
          }
        };
      }),
    }),
    {
      name: 'block-storage',
      storage: createJSONStorage(() => localStorage, {
        reviver: (_key, value: any) => {
          if (value !== null && typeof value === 'object' && value.dataType === 'Map') {
            return new Map(value.value);
          }
          return value;
        },
        replacer: (_key, value) => {
          if (value instanceof Map) {
            return {
              dataType: 'Map',
              value: Array.from(value.entries()),
            };
          }
          return value;
        },
      }),
    }
  )
);
