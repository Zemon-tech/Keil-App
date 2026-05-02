# Visual Architecture Guide

## 1. Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         User Types                              │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                      TipTap Editor                              │
│  - Handles all text input                                       │
│  - Manages selection                                            │
│  - Provides formatting toolbar                                  │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼ onUpdate({ editor })
┌─────────────────────────────────────────────────────────────────┐
│                   Get JSON from Editor                          │
│  const json = editor.getJSON()                                 │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼ updatePageContent(pageId, json)
┌─────────────────────────────────────────────────────────────────┐
│                      Zustand Store                              │
│  - Update page content                                          │
│  - Trigger save to localStorage/backend                         │
└────────────────────────────┬────────────────────────────────────┘
                             │
                    ┌────────┴────────┐
                    ▼                 ▼
        ┌─────────────────┐  ┌──────────────────┐
        │   localStorage  │  │  Backend API     │
        │ (Phase 1)       │  │ (Phase 3)        │
        └─────────────────┘  └──────────────────┘
```

---

## 2. Document Structure

```
Document (JSONContent)
│
├── paragraph { id: uuid-1 }
│   └── text: "Hello world"
│
├── heading { id: uuid-2, level: 1 }
│   └── text: "My Title"
│
├── bulletList { id: uuid-3 }
│   ├── listItem { id: uuid-4 }
│   │   └── paragraph { id: uuid-5 }
│   │       └── text: "Item 1"
│   └── listItem { id: uuid-6 }
│       └── paragraph { id: uuid-7 }
│           └── text: "Item 2"
│
├── table { id: uuid-8 }
│   ├── tableRow
│   │   ├── tableHeader
│   │   │   └── paragraph
│   │   │       └── text: "Col 1"
│   │   └── tableCell
│   │       └── paragraph
│   │           └── text: "Data 1"
│   └── ...
│
└── paragraph { id: uuid-9, empty }
    └── (placeholder, always present)
```

**Key:** Every block has a `data-id` attribute for reference and tracking.

---

## 3. Component Hierarchy

```
App
│
├── PageList (Sidebar)
│   ├── Create Page Button
│   └── Page Items (clickable)
│       └── Delete Button
│
└── PageEditor (Main Content)
    │
    ├── PageTitle (Input)
    │   └── onChange: updatePageTitle()
    │
    └── BlockEditor (TipTap)
        │
        ├── MenuBar (Toolbar)
        │   ├── Bold, Italic, Strike, Code buttons
        │   ├── Paragraph, H1, H2, H3 buttons
        │   ├── BulletList, OrderedList, CodeBlock buttons
        │   ├── Table button
        │   └── Undo, Redo buttons
        │
        └── EditorContent
            └── ProseMirror Document
                └── Block Nodes (with IDs)
```

---

## 4. State Management Flow

```
┌──────────────────────────┐
│     Zustand Stores       │
├──────────────────────────┤
│                          │
│  pageStore:              │
│  ├── pages: Map          │
│  ├── currentPageId       │
│  ├── createPage()        │
│  ├── updatePageContent() │
│  ├── deletePage()        │
│  └── getPage()           │
│                          │
│  editorStore:            │
│  ├── focusedBlockId      │
│  ├── selectedBlockIds    │
│  ├── isDirty             │
│  └── update methods      │
│                          │
└──────────────────────────┘
         ▲
         │ usePageStore()
         │ useEditorStore()
         │
┌────────┴──────────────────┐
│   React Components        │
├───────────────────────────┤
│ - App.tsx                 │
│ - PageEditor.tsx          │
│ - PageList.tsx            │
│ - BlockEditor.tsx         │
│ - MenuBar.tsx             │
└───────────────────────────┘
```

---

## 5. Block Type Hierarchy

```
TipTap Node Types
│
├── Text Nodes
│   ├── Paragraph { id }
│   ├── Heading { id, level }
│   ├── Blockquote { id }
│   └── CodeBlock { id }
│
├── List Nodes
│   ├── BulletList { id }
│   │   └── ListItem
│   │       └── Paragraph
│   ├── OrderedList { id }
│   │   └── ListItem
│   │       └── Paragraph
│   │
│   (Phase 2)
│   ├── ToggleList { id, isCollapsed }
│   │   └── ListItem
│   │       └── Paragraph
│   │
│   (Phase 2+)
│   └── ToggleList { id, title }
│       └── Nested content
│
├── Table Nodes
│   └── Table { id }
│       ├── TableRow
│       │   ├── TableHeader { content }
│       │   ├── TableCell { content }
│       │   └── TableCell { content }
│       └── TableRow
│           └── ...
│
├── Divider
│   └── HorizontalRule { id }
│
└── (Phase 2+)
    ├── Subpage { id, pageId }
    ├── Image { id, src }
    ├── Video { id, url }
    ├── Embed { id, url }
    ├── DatabaseBlock { id, databaseId }
    └── ...
```

---

## 6. Extension Architecture

```
TipTap Editor
│
├── StarterKit (Built-in)
│   ├── Bold, Italic, Strike, Code (marks)
│   ├── Paragraph, Heading, Blockquote, CodeBlock
│   ├── BulletList, OrderedList
│   └── History (Undo/Redo)
│
├── BlockIdExtension (Custom)
│   └── Adds `id: "uuid"` to all block nodes
│
├── EnforceFinalBlockExtension (Custom)
│   └── Ensures document always ends with empty paragraph
│
├── Table Extension (Built-in)
│   ├── Table, TableRow, TableHeader, TableCell
│   └── Resizable support
│
└── Phase 2+ Additions
    ├── ToggleExtension
    ├── SubpageExtension
    ├── SlashMenuExtension
    ├── ImageExtension
    ├── EmbedExtension
    └── ...
```

---

## 7. Key UX Invariants

```
User Action                  Expected Behavior
═══════════════════════════════════════════════════════════════

Type text                    → Content appears immediately

Press Enter                  → New block created below
  (in paragraph)              (also a paragraph)

Press Backspace              → Block deleted if empty
  (on empty block)            (but document never fully empty)

Press Ctrl/Cmd + Z           → Last action undone
                              (native ProseMirror history)

Highlight text               → Text selected
                              (native ProseMirror selection)

Ctrl/Cmd + C, Ctrl/Cmd + V   → Block/text copied & pasted
                              (native browser clipboard)

Select heading               → Toggle via toolbar or Ctrl/Cmd + Shift + (1-3)
                              (formatting applied)

Drag block handle            → Block moves to new position
  (Phase 2)                   (document reordered)

Type "/"                      → Block menu appears
  (Phase 2)                   (search & insert blocks)
```

---

## 8. Page Lifecycle

```
User Opens App
│
├─ localStorage.getItem('pages')
│  │
│  ├─ Has data? → Parse & load into Zustand
│  └─ No data? → Create default page
│
│
User Views Page
│
├─ Get page from store
├─ Pass content to TipTap
├─ Editor renders blocks
└─ Listen for changes


User Types / Edits
│
├─ TipTap detects change
├─ onUpdate fires
├─ Get JSON: editor.getJSON()
├─ Call: updatePageContent(pageId, json)
├─ Zustand store updates
├─ localStorage.setItem() (auto-save)
└─ UI re-renders if needed


User Switches Page
│
├─ setCurrentPage(newPageId)
├─ PageEditor unmounts
├─ PageEditor mounts with new pageId
├─ Get new page from store
├─ TipTap editor loads new content
└─ UI updates


User Creates Page
│
├─ Click "New Page"
├─ createPage('New Page')
├─ Generate uuid
├─ Create page with empty document
├─ Add to Zustand store
├─ localStorage updated
├─ setCurrentPage(newPageId)
└─ Editor loads it


User Deletes Page
│
├─ Click delete
├─ deletePage(pageId)
├─ Remove from Map
├─ localStorage updated
├─ If was current, switch to another
└─ UI updates
```

---

## 9. Code Execution Flow (Block Creation)

```
User Types in Editor
│
▼
TipTap onUpdate callback
│
▼
const json = editor.getJSON()
│
│  // Now json contains entire document with block IDs:
│  // {
│  //   type: 'doc',
│  //   content: [
│  //     { type: 'paragraph', attrs: { id: 'uuid-1' }, ... },
│  //     { type: 'paragraph', attrs: { id: 'uuid-2' }, ... },
│  //     ...
│  //   ]
│  // }
│
▼
updatePageContent(pageId, json)
│
▼
Zustand store.set({ pages: new Map().set(pageId, {...page, content: json}) })
│
▼
get().savePagesToStorage()
│
▼
localStorage.setItem('notion-clone-pages', JSON.stringify([...pages]))
│
▼
Data persisted ✅
```

---

## 10. Type System Flow

```
Page Type
│
├── id: string (UUID)
├── title: string
├── content: JSONContent ← TipTap's type
│   │
│   ├── type: 'doc'
│   └── content: JSONContent[]
│       │
│       ├── Block Node
│       │   ├── type: BlockType (paragraph, heading, etc.)
│       │   ├── attrs?: { id: string, ... }
│       │   └── content?: JSONContent[]
│       │
│       └── Block Node
│           └── ...
│
├── lastModified: Date
├── parentId?: string (for subpages, Phase 2)
└── order?: number
```

---

## 11. Block ID Extraction Pattern

```
JSONContent (Page)
│
└─ traverse all nodes
   │
   ├─ Found paragraph with id "uuid-1"
   ├─ Found heading with id "uuid-2"
   ├─ Found bulletList with id "uuid-3"
   │  │
   │  └─ Contains listItem
   │     └─ Contains paragraph with id "uuid-4"
   │
   └─ Found table with id "uuid-5"
      │
      └─ Contains tableRow
         │
         ├─ tableHeader with id "uuid-6"
         └─ tableCell with id "uuid-7"

Result: blockIds = ["uuid-1", "uuid-2", "uuid-3", "uuid-4", "uuid-5", "uuid-6", "uuid-7"]
```

---

## 12. Extension Lifecycle

```
App Mounts
│
├─ useEditor() hook called
│
├─ Extensions array processed
│   ├─ StarterKit loaded
│   ├─ BlockIdExtension loaded
│   │  └─ addGlobalAttributes() → adds id to all block types
│   ├─ EnforceFinalBlockExtension loaded
│   │  └─ addProseMirrorPlugins() → watches document changes
│   └─ Table extension loaded
│
├─ ProseMirror schema created
│
├─ Document initialized from content prop
│
├─ Editor ready for input ✅
│
│
User Edits
│
├─ Text input detected
├─ ProseMirror plugins run
│  ├─ BlockIdExtension: ensure IDs exist
│  └─ EnforceFinalBlockExtension: ensure empty paragraph at end
├─ Document updated
└─ onUpdate callback fires


App Unmounts
│
└─ Editor cleaned up ✅
```

---

## 13. Storage Strategy (Phase Progression)

```
Phase 1: localStorage
┌─────────────────────────────────────────┐
│ Browser Storage (Dev/Offline)           │
│                                         │
│ Key: 'notion-clone-pages'               │
│ Value: [                                │
│   ["pageId-1", Page { ... }],           │
│   ["pageId-2", Page { ... }],           │
│   ...                                   │
│ ]                                       │
└─────────────────────────────────────────┘


Phase 3: Backend API
┌─────────────────────────────────────────┐
│ Client Zustand Store                    │
├─────────────────────────────────────────┤
│ updatePageContent(id, json)             │
│  ├─ Optimistic update (instant UI)      │
│  ├─ Fetch PUT /api/pages/{id}           │
│  └─ Sync with server                    │
└─────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────┐
│ Backend (Node.js/Next.js)               │
├─────────────────────────────────────────┤
│ PUT /api/pages/{id}                     │
│  └─ Save to Database                    │
└─────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────┐
│ Database (PostgreSQL)                   │
├─────────────────────────────────────────┤
│ pages table:                            │
│  ├─ id: UUID                            │
│  ├─ title: string                       │
│  ├─ content: JSONB (full document)      │
│  └─ lastModified: timestamp             │
└─────────────────────────────────────────┘
```

---

## 14. Error Handling Flow

```
User Action
│
├─ Try operation
│
├─ Success
│  └─ Update Zustand
│     └─ Save to storage
│        └─ UI updates ✅
│
└─ Error
   └─ Log error
      └─ Show toast/notification
         └─ Optionally rollback UI
            └─ User can retry ⚠️
```

---

## 15. Performance Considerations

```
Single Editor Instance
│
├─ Smaller DOM tree
├─ Fewer event listeners
├─ Better ProseMirror optimization
├─ Scales to 1000+ blocks
│
└─ Memory efficient ✅


Zustand Store (Optimized)
│
├─ Only notify components that access changed data
├─ Selective subscriptions
├─ No unnecessary re-renders
│
└─ Fast updates ✅


localStorage (Phase 1)
│
├─ Synchronous writes (OK for MVP)
├─ Entire document at once (OK <1MB)
│
└─ Good enough for Phase 1 ✅
   (Backend async saves Phase 3)
```

---

**Visual architecture complete! Reference these diagrams while implementing.** 🎨