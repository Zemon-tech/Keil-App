# Quick Start Guide - Notion Clone with TipTap

## What Changed?

### ❌ OLD Approach (From block.md)
- Multiple contentEditable divs in a React list
- Heavy Redux/Zustand with `pages[pageId].blocks: string[]`
- Separate block storage: `blocks: Map<blockId, Block>`
- AI integration mixed into core logic
- Over 1100 lines of bloated documentation
- Not scalable, difficult to maintain

### ✅ NEW Approach (This Implementation)
- **Single TipTap editor instance per page**
- **ProseMirror document as block structure**
- **Pages store `content: JSONContent` directly**
- **Block IDs via TipTap node attributes**
- **Lean, focused, ~400 lines of core code**
- **Scalable, maintainable, battle-tested**

---

## Architecture at a Glance

```
Page Model:
{
  id: "uuid",
  title: "My Page",
  content: JSONContent {  // ← Single TipTap document
    type: "doc",
    content: [
      { type: "paragraph", attrs: { id: "block-1" }, content: [...] },
      { type: "heading", attrs: { id: "block-2", level: 1 }, content: [...] },
      { type: "bulletList", attrs: { id: "block-3" }, content: [...] }
    ]
  }
}
```

**No more:**
- `pages[id].blocks: string[]`
- `blocks: Map<id, Block>`
- Array index hacks
- Selection issues
- Undo/redo problems

---

## Files You Need

### **1. block-based-editor.md** (Architecture Guide)
- Deep dive into TipTap + ProseMirror
- Core concepts and why this approach works
- Block types, keyboard shortcuts
- Utilities and patterns
- ~350 lines, comprehensive

### **2. implementation-code.md** (Copy-Paste Ready)
- Complete, production-ready code
- All 9 major components
- Zustand stores, extensions, utilities
- CSS styling included
- ~500 lines, ready to use

### **3. This File** (You're reading it!)
- Quick summary and setup steps

---

## 5-Minute Setup

### Step 1: Create Project
```bash
npm create vite@latest antigravity -- --template react-ts
cd antigravity
npm install
```

### Step 2: Install Dependencies
```bash
npm install @tiptap/react @tiptap/starter-kit @tiptap/extension-table zustand uuid
npm install tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

### Step 3: Copy Files
Use `implementation-code.md` to:
1. Create `src/types/page.ts` + `src/types/editor.ts`
2. Create `src/store/pageStore.ts` + `src/store/editorStore.ts`
3. Create `src/extensions/BlockIdExtension.ts` + `EnforceFinalBlockExtension.ts`
4. Create `src/utils/blockHelpers.ts`
5. Create `src/components/Editor/BlockEditor.tsx` + `MenuBar.tsx`
6. Create `src/components/Page/PageEditor.tsx` + `PageList.tsx`
7. Create `src/App.tsx`
8. Copy CSS to `src/components/Editor/BlockEditor.css`

### Step 4: Run
```bash
npm run dev
```

**That's it!** You have a working Notion clone.

---

## What You Get

✅ **Out of the box:**
- Rich text editing (bold, italic, code, etc.)
- Block types: paragraph, heading (1-3), lists, code block, blockquote, table, HR
- Drag-and-drop reorder (via ProseMirror native)
- Undo/redo (native support)
- Copy/paste (native support)
- localStorage persistence
- Page creation/deletion
- Page sidebar

❌ **Not yet (Phase 2+):**
- Toggle/collapsible blocks
- Subpage linking
- Slash menu (`/` for block creation)
- Image/video/embed
- Database blocks
- Real-time collaboration
- Backend sync

---

## Understanding the Code

### TipTap Editor Setup (BlockEditor.tsx)
```typescript
const editor = useEditor({
  extensions: [
    StarterKit,              // Paragraph, heading, list, code, blockquote, etc.
    BlockIdExtension,        // Adds id: "uuid" to each block
    EnforceFinalBlockExtension, // Always keep empty paragraph at end
    Table,                   // Table support
    // ... other extensions
  ],
  content: page?.content,  // Load from JSONContent
  onUpdate: ({ editor }) => {
    const json = editor.getJSON();
    updatePageContent(pageId, json); // Save back to store
  }
});
```

### Block ID Extension (BlockIdExtension.ts)
Automatically adds `id` attribute to all block nodes:
```typescript
{
  type: "paragraph",
  attrs: { id: "550e8400-e29b-41d4-a716-446655440000" },
  content: [{ type: "text", text: "Hello" }]
}
```

### Zustand Store (pageStore.ts)
Manages all pages:
```typescript
const { createPage, updatePageContent, getPage, setCurrentPage } = usePageStore();

// Create page
const pageId = createPage('New Page');

// Update content
updatePageContent(pageId, jsonContent);

// Load page
const page = getPage(pageId);
```

---

## Key Differences from Old Block.md

| Feature | Old | New |
|---------|-----|-----|
| **Editor Count** | Many (one per block) | One per page |
| **Block Storage** | `Map<blockId, Block>` | `JSONContent` in page |
| **Selection** | DIY (broken) | ProseMirror native |
| **Undo/Redo** | DIY (unreliable) | ProseMirror native |
| **Copy/Paste** | DIY (unreliable) | ProseMirror native |
| **AI Integration** | Built-in (bloat) | None (keep it simple) |
| **Code Size** | 1100+ lines | ~400 lines |
| **Maintainability** | Hard | Easy |
| **Scalability** | Poor | Excellent |

---

## Common Tasks

### Add New Block Type
1. Add to `BlockType` in `src/types/page.ts`
2. Create TipTap extension if needed
3. Add button to `MenuBar.tsx`
4. Add CSS styling

Example (toggle block - Phase 2):
```typescript
// Create src/extensions/ToggleExtension.ts
const ToggleExtension = Node.create({
  name: 'toggle',
  group: 'block',
  content: 'paragraph+',
  // ... implementation
});

// Add to BlockEditor.tsx extensions array
// Add button to MenuBar.tsx
```

### Persist to Backend
Replace localStorage with API calls:
```typescript
// In pageStore.ts updatePageContent
updatePageContent: async (pageId, content) => {
  // Optimistic update
  set(state => { /* ... */ });
  
  // Then sync to backend
  await fetch(`/api/pages/${pageId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  });
}
```

### Extract Block Information
```typescript
import { getBlockIds, getBlockById, getBlockText } from '../utils/blockHelpers';

const blockIds = getBlockIds(page.content);
const block = getBlockById(page.content, blockId);
const text = getBlockText(block);
```

---

## Troubleshooting

### Editor not loading
- Check that `content` prop is valid `JSONContent`
- Use `ensureBlockIds()` to fix missing IDs
- Check browser console for errors

### Blocks not saving
- Verify `onUpdate` callback is firing
- Check Zustand store is updating
- Check localStorage is enabled
- Look for network errors if using API

### Undo/Redo not working
- `StarterKit` includes `History` extension
- Make sure it's in extensions array
- Check that `onUpdate` is not creating new objects unnecessarily

### Selection jumping
- Ensure all blocks have unique IDs
- Don't use array indices as IDs
- Check `BlockIdExtension` is applied

---

## Performance Tips

1. **Use React.memo** for block components (future)
2. **Implement virtualization** for 1000+ blocks
3. **Debounce saves** (already done in store)
4. **Profile with React DevTools**
5. **Use Zustand selectors** for fine-grained updates

---

## Next Development Phases

### Phase 1 ✅ (Now)
- Paragraph, heading, lists, code, table
- Undo/redo, copy/paste
- Basic UI

### Phase 2 (Week 2)
- Toggle blocks
- Subpage linking
- Slash menu (`/`)
- Block selection & multi-select

### Phase 3 (Week 3)
- Backend API
- Database persistence
- User authentication

### Phase 4 (Week 4+)
- Real-time collaboration
- Comments & mentions
- Advanced block types
- Databases (tables, galleries, timelines)
- Embeds (YouTube, maps, etc.)

---

## Resources

- **TipTap Docs**: https://tiptap.dev
- **ProseMirror**: https://prosemirror.net
- **Zustand**: https://github.com/pmndrs/zustand
- **Notion Blocks API**: https://developers.notion.com/reference/block

---

## Questions?

Refer to:
1. **block-based-editor.md** - Architecture & concepts
2. **implementation-code.md** - Copy-paste code
3. TipTap docs - Extending functionality
4. ProseMirror docs - Advanced document manipulation

---

**Happy coding! 🚀**

Feel free to ask clarifying questions as you implement. This architecture is solid and will scale with your app.