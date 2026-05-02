import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { JSONContent } from '@tiptap/core';

export type MotionPageId = string;

export interface MotionPageRecord {
  id: MotionPageId;
  parentId?: MotionPageId;
  title: string;
  icon?: string;
  coverImage?: string;
  content: JSONContent;
  createdAt: number;
  updatedAt: number;
  isDeleted?: boolean;
}

interface MotionStore {
  pages: MotionPageRecord[];
  sidebarOpen: boolean;
  
  // Actions
  addPage: (partial?: Partial<MotionPageRecord>) => MotionPageRecord;
  updatePage: (id: MotionPageId, updates: Partial<MotionPageRecord>) => void;
  deletePage: (id: MotionPageId) => void;
  restorePage: (id: MotionPageId) => void;
  permanentlyDeletePage: (id: MotionPageId) => void;
  setSidebarOpen: (open: boolean) => void;
  
  // Helpers (as selectors)
  getPageById: (id: MotionPageId) => MotionPageRecord | undefined;
  getRootPages: () => MotionPageRecord[];
  getSubpages: (parentId: MotionPageId) => MotionPageRecord[];
  getTrashPages: () => MotionPageRecord[];
}

const getEmptyDoc = (): JSONContent => ({
  type: 'doc',
  content: [{ type: 'paragraph' }],
});

const createId = (): MotionPageId => 
  `mp_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;

export const useMotionStore = create<MotionStore>()(
  persist(
    (set, get) => ({
      pages: [],
      sidebarOpen: true,

      addPage: (partial) => {
        const now = Date.now();
        const newPage: MotionPageRecord = {
          id: createId(),
          title: 'Untitled',
          content: getEmptyDoc(),
          createdAt: now,
          updatedAt: now,
          ...partial,
        };
        set((state) => ({ pages: [newPage, ...state.pages] }));
        return newPage;
      },

      updatePage: (id, updates) => {
        set((state) => ({
          pages: state.pages.map((p) => 
            p.id === id ? { ...p, ...updates, updatedAt: Date.now() } : p
          ),
        }));
      },

      deletePage: (id) => {
        set((state) => ({
          pages: state.pages.map((p) => 
            p.id === id ? { ...p, isDeleted: true, updatedAt: Date.now() } : p
          ),
        }));
      },

      restorePage: (id) => {
        set((state) => ({
          pages: state.pages.map((p) => 
            p.id === id ? { ...p, isDeleted: false, updatedAt: Date.now() } : p
          ),
        }));
      },

      permanentlyDeletePage: (id) => {
        set((state) => ({
          pages: state.pages.filter((p) => p.id !== id),
        }));
      },

      setSidebarOpen: (open) => set({ sidebarOpen: open }),

      getPageById: (id) => get().pages.find((p) => p.id === id),
      
      getRootPages: () => get().pages.filter((p) => !p.parentId && !p.isDeleted),
      
      getSubpages: (parentId) => get().pages.filter((p) => p.parentId === parentId && !p.isDeleted),
      
      getTrashPages: () => get().pages.filter((p) => p.isDeleted),
    }),
    {
      name: 'motion-storage',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
