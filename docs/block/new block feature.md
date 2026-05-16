# Motion App Block Architecture - Antigravity Implementation Guide
## Building a Notion-like Block System with Nested Toggles

---

## PHASE 1: CORE ARCHITECTURE SETUP

### Step 1.1: Define Your Data Model Structure

**What to do:**
- Create a **Block Type System** that defines all possible block types
- Each block needs a unique identifier (ID), type, content, and children array

**Data Structure Outline:**
```
Block Object:
├── id (unique identifier)
├── type (text, heading1-4, page, bulleted-list, numbered-list, to-do, toggle, code, quote, etc.)
├── content (the actual text/data)
├── properties (formatting, color, styles)
├── children[] (nested blocks)
├── isCollapsed (for toggles - true/false)
└── metadata (creation date, last edited, etc.)
```

**Why:** This structure allows infinite nesting and mimics Notion's hierarchical system.

---

## PHASE 2: UI LAYOUT & SPACING ARCHITECTURE

### Step 2.1: Design the Main Container Layout

**Structure to implement:**
```
┌─────────────────────────────────────┐
│    TOP BAR (Search, Icons)          │
├─────────────────┬───────────────────┤
│  LEFT SIDEBAR   │   EDITOR AREA     │
│  (Actions Menu) │   (Block Canvas)  │
│                 │                   │
│ • Turn into     │ ┌─────────────────┤
│ • Color         │ │ Block 1         │
│ • Copy link     │ │ Block 2         │
│ • Duplicate     │ │   └─ Child 1    │
│ • Move to       │ │   └─ Child 2    │
│ • Delete        │ │ Block 3         │
│ • Comment       │ └─────────────────┤
│ • Suggest edit  │                   │
│ • Ask AI        │                   │
└─────────────────┴───────────────────┘
```

**Spacing Guidelines:**
- **Left Sidebar:** 280px width, 16px padding
- **Editor Area:** Fluid, min-width 400px
- **Block Padding:** 12px left indent per nesting level
- **Inter-block Gap:** 4px vertical spacing
- **Icon Spacing:** 8px between icons in menus

### Step 2.2: Implement Block Rendering System

**Each block needs:**
- **Left Margin:** Increases by 12-16px per nesting level
- **Drag Handle:** 20px icon area to the left of content
- **Content Area:** Flex container for inline elements
- **Right Actions:** Context menu access (3-dot icon)

**Visual Hierarchy:**
- Heading 1: 28px font, bold, 16px margin-top
- Heading 2: 24px font, bold, 12px margin-top
- Heading 3: 20px font, semibold, 10px margin-top
- Heading 4: 18px font, semibold, 8px margin-top
- Text: 16px font, regular
- **All blocks:** 32px min-height for comfortable clicking

---

## PHASE 3: FEATURE IMPLEMENTATION

### Step 3.1: Text Block Implementation

**Features required:**
- Rich text editing (bold, italic, strikethrough)
- Inline formatting toolbar
- Placeholder text when empty
- Selection highlight state

**Implementation approach:**
1. Create a basic text input component
2. Add contentEditable attribute for in-place editing
3. Implement formatting shortcuts (Ctrl+B for bold, etc.)
4. Add cursor position tracking

---

### Step 3.2: Heading Blocks (H1-H4)

**Key differences from text:**
- Each heading level has different font size and weight
- They maintain the same editing behavior as text blocks
- Can be converted to other block types via "Turn into" action

**Implementation approach:**
1. Create separate components for each heading level
2. Use semantic HTML tags (h1-h4)
3. Apply consistent styling while maintaining hierarchy
4. Same contentEditable behavior as text blocks

---

### Step 3.3: List Blocks (Bulleted & Numbered)

**Bulleted List Requirements:**
- Display bullet point (•)
- Auto-indent on pressing Tab
- Auto-dedent on pressing Shift+Tab
- Pressing Enter creates new list item
- Pressing Backspace at start merges with previous

**Numbered List Requirements:**
- Same behavior as bulleted but with numbers (1, 2, 3...)
- Auto-renumber when items are added/removed
- Maintain numbering across nested levels

**Implementation approach:**
1. Create list container component
2. Each list item is a separate block with parent reference
3. Track list order for numbering
4. Implement keyboard handlers for Tab/Shift+Tab/Enter/Backspace

---

### Step 3.4: To-Do List Implementation

**Features:**
- Checkbox that's clickable
- Strike-through text when checked
- Visual state change (opacity/color)
- Track completion status in data model

**Implementation approach:**
1. Add checkbox input (type="checkbox") before content
2. Bind checkbox to completion state
3. Apply text-decoration: line-through when checked
4. Store isChecked property in block data

---

### Step 3.5: Toggle Block Implementation (CRITICAL - Nested Toggles)

**Toggle Block Structure:**
```
Toggle Block:
├── isToggled (true/false - expanded state)
├── content (the toggle label/title)
├── children[] (blocks inside toggle)
└── visual indicator (▶ when collapsed, ▼ when expanded)
```

**Visual Design:**
- **Collapsed state:** ▶ Toggle Label (triangle points right)
- **Expanded state:** ▼ Toggle Label (triangle points down)
- **Nested indication:** All children indented by 16px
- **Click target:** Entire toggle header is clickable

**Key behaviors:**
1. Click triangle or toggle text to expand/collapse
2. Animation: smooth 200ms height transition
3. When collapsed, children are display:none
4. Children maintain their own nesting structure

**Nested Toggle Implementation (Toggle 1 > Toggle 2 > Toggle 3):**
```
Toggle 1 (parent)
├─ [expanded content]
├─ Some text block
└─ Toggle 2 (child of Toggle 1)
    ├─ [expanded content]
    ├─ Some text block
    └─ Toggle 3 (child of Toggle 2)
        ├─ [expanded content]
        └─ Some text block
```

**Implementation approach:**
1. When creating a new block inside a toggle, set its parent ID to the toggle's ID
2. Use recursion to render child blocks
3. Each toggle maintains its own isToggled state
4. Clicking one toggle doesn't affect siblings or parent state

---

### Step 3.6: Code Block Implementation

**Features:**
- Syntax highlighting for multiple languages
- Language selector dropdown
- Pre-formatted text (monospace font)
- Copy code button
- No text formatting options

**Implementation approach:**
1. Use a code editor library (Monaco, CodeMirror, Highlight.js)
2. Create language selector
3. Wrap in `<pre><code>` tags
4. Disable rich text formatting tools

---

### Step 3.7: Quote Block Implementation

**Features:**
- Left border indicator (colored line)
- Italic styling
- Different background color
- Can contain multiple paragraphs

**Implementation approach:**
1. Add left border (4px, accent color)
2. Apply italic font-style
3. Add subtle background color (rgba)
4. Allow multi-line content

---

### Step 3.8: Callout Block Implementation

**Features:**
- Icon selector (info, warning, success, etc.)
- Colored background
- Colored left border
- Icon + text combined display

**Implementation approach:**
1. Create icon selector component
2. Map icon type to color scheme
3. Display icon + content side-by-side
4. Apply theme colors based on icon type

---

### Step 3.9: Block Equation Implementation

**Features:**
- LaTeX equation rendering
- Math notation support
- Display in readable format

**Implementation approach:**
1. Use KaTeX or MathJax library
2. Input LaTeX string
3. Render as formatted equation
4. Read-only display (or edit mode)

---

### Step 3.10: Synced Block Implementation

**Advanced Feature:**
- Creates a reference to another block
- Changes sync across references
- Visual indicator of sync status

**Implementation approach:**
1. Create sync mapping in data model
2. When synced block updates, update all references
3. Add visual indicator (sync icon)
4. Track sync relationships

---

## PHASE 4: LEFT SIDEBAR ACTIONS MENU

### Step 4.1: "Turn Into" Action

**Implementation:**
1. Display block type selector menu
2. Show all available block types
3. Convert current block to selected type
4. Preserve content when possible
5. Update block.type in data model

**Keyboard shortcut:** Cmd/Ctrl + /

---

### Step 4.2: "Color" Action

**Implementation:**
1. Show color picker (text, background, or both)
2. Apply CSS color classes
3. Store color choice in block.properties
4. Update UI to reflect selected color

**Color system:**
- Text colors (8 standard colors)
- Background colors (8 standard colors)
- Default: no color

---

### Step 4.3: "Copy Link to Block" Action

**Implementation:**
1. Generate block URL (domain.com/page#block-id)
2. Copy to clipboard
3. Show success feedback
4. Keyboard shortcut: Alt+Shift+L or Cmd+Shift+L

---

### Step 4.4: "Duplicate" Action

**Implementation:**
1. Deep copy the entire block (including children)
2. Generate new IDs for copied block and all children
3. Insert copy directly below original
4. Keyboard shortcut: Ctrl+D or Cmd+D

---

### Step 4.5: "Move To" Action

**Implementation:**
1. Show workspace/page selector
2. Update block's parent reference
3. Remove from current location
4. Insert into new location
5. Keyboard shortcut: Ctrl+Shift+P or Cmd+Shift+P

---

### Step 4.6: "Delete" Action

**Implementation:**
1. Show confirmation dialog
2. Delete block and all children from data model
3. Update parent's children array
4. Remove from DOM
5. Keyboard shortcut: Del or Backspace (context-dependent)

---

### Step 4.7: "Comment" Action

**Implementation:**
1. Open comment panel next to block
2. Allow multi-threaded comments
3. Show comment count badge
4. Store comments in separate data structure
5. Keyboard shortcut: Ctrl+Alt+M or Cmd+Shift+M

---

### Step 4.8: "Suggest Edits" Action

**Implementation:**
1. Track proposed changes (without applying)
2. Show diff view
3. Allow acceptance/rejection
4. Useful for collaborative editing
5. Keyboard shortcut: (custom)

---

### Step 4.9: "Ask AI" Action

**Implementation:**
1. Send block content to AI service
2. Show AI response in floating panel
3. Options: improve writing, summarize, etc.
4. Allow inserting AI response as new block
5. Keyboard shortcut: Ctrl+J or Cmd+J

---

## PHASE 5: BLOCK MANIPULATION FEATURES

### Step 5.1: Drag & Drop System

**Implementation:**
1. Add drag handle icon (⋮⋮) to left of each block
2. Use React DnD or native Drag & Drop API
3. Track drag start, drag over, drop positions
4. Calculate target nesting level based on drop position
5. Update parent relationships after drop
6. Support dropping into other blocks to nest them

**Visual feedback:**
- Highlight drop zone with border
- Show indent preview when dragging over blocks
- Cursor changes to grab/grabbing

---

### Step 5.2: Keyboard Navigation

**Implement these shortcuts:**
- **Arrow Up/Down:** Move cursor to previous/next block
- **Tab:** Indent block (increase nesting)
- **Shift+Tab:** Dedent block (decrease nesting)
- **Enter:** Create new block below
- **Ctrl+Enter:** Create new block inside (for toggles, etc.)
- **Ctrl+L:** Create new line within block
- **Ctrl+A:** Select all blocks
- **Backspace:** Delete block (if empty) or merge with previous

---

### Step 5.3: Context Menu Implementation

**Right-click menu should include:**
1. All actions from left sidebar
2. Quick copy/paste options
3. Duplicate shortcut
4. Delete shortcut
5. Move to submenu

**Implementation:**
1. Add onContextMenu event listener
2. Calculate menu position (don't go off-screen)
3. Show/hide based on click
4. Close on selection or outside click

---

## PHASE 6: SEARCH & FILTER FUNCTIONALITY

### Step 6.1: Block Search

**Features:**
- Search by block content
- Filter by block type
- Search by color/tag
- Show recent blocks

**Implementation:**
1. Create search index from all blocks
2. Use fuzzy matching for text search
3. Filter results in real-time
4. Show preview of matching content

---

## PHASE 7: RESPONSIVE & ACCESSIBILITY

### Step 7.1: Spacing Adjustments

**Desktop:**
- Full sidebar visible
- Block width 600-800px
- Generous spacing

**Tablet:**
- Sidebar can be toggled
- Block width adapts to screen
- Reduced padding on mobile

**Mobile:**
- Sidebar as overlay
- Full-width blocks
- Touch-friendly targets (48px minimum)

---

### Step 7.2: Accessibility Features

**Required:**
1. Semantic HTML (use appropriate tags)
2. ARIA labels for icons/buttons
3. Keyboard navigation support
4. Focus indicators
5. Color not as only indicator
6. Screen reader support

---

## PHASE 8: STATE MANAGEMENT & PERSISTENCE

### Step 8.1: State Structure

**Global state should track:**
```
state = {
  blocks: [],           // all blocks with hierarchical structure
  selectedBlockId: "",  // currently selected block
  focusedBlockId: "",   // block with keyboard focus
  editingBlockId: "",   // block in edit mode
  clipboardData: {},    // for cut/copy/paste
  history: [],          // undo/redo stack
  filters: {},          // active filters
  searchQuery: ""       // current search
}
```

**Implementation approach:**
1. Use Context API or state management library (Redux, Zustand)
2. Implement undo/redo with history stack
3. Debounce saving to database
4. Auto-save every 30 seconds or after major changes

---

### Step 8.2: Data Persistence

**Save structure:**
1. Save entire blocks tree to database
2. Include all metadata (timestamps, authors)
3. Version control for recovery
4. Implement conflict resolution for collaborative editing

---

## PHASE 9: ANIMATION & POLISH

### Step 9.1: Smooth Transitions

**Add animations for:**
- Toggle expand/collapse (200ms ease-out)
- Block insertion/deletion (150ms fade)
- Hover effects on interactive elements (100ms)
- Menu open/close (150ms)
- Color changes (200ms)

---

### Step 9.2: Loading States

**Implement for:**
- Block rendering
- AI requests
- Search operations
- Save operations

---

## IMPLEMENTATION CHECKLIST

### Core Components to Build:
- [ ] Block Container (base component)
- [ ] Text Block
- [ ] Heading Blocks (H1-H4)
- [ ] List Components (Bulleted, Numbered)
- [ ] To-Do Block
- [ ] Toggle Block (with nesting support)
- [ ] Code Block
- [ ] Quote Block
- [ ] Callout Block
- [ ] Equation Block
- [ ] Synced Block
- [ ] Left Sidebar Menu
- [ ] Action Menu Handler
- [ ] Block Renderer (recursive for nesting)

### Features to Implement:
- [ ] Rich text editing
- [ ] Block type conversion
- [ ] Drag & drop
- [ ] Keyboard shortcuts
- [ ] Context menu
- [ ] Color system
- [ ] Comments
- [ ] AI integration
- [ ] Search functionality
- [ ] Undo/redo
- [ ] Auto-save
- [ ] Copy link generation

---

## ANTIGRAVITY-SPECIFIC CONSIDERATIONS

### Component Structure in Antigravity:

1. **Page Component** - Main container
   - Handles overall layout
   - Manages global state
   - Routes between views

2. **Editor Component** - Main editing area
   - Renders block tree
   - Handles user input
   - Manages focus/selection

3. **Block Component** - Recursive component for each block
   - Renders block content
   - Handles block-specific interactions
   - Renders children recursively
   - Manages local state (collapsed/expanded)

4. **SidebarMenu Component** - Left actions panel
   - Shows actions based on selected block
   - Dispatches actions to global state

5. **ToolbarComponent** - Top toolbar with formatting options
   - Shows formatting options for text blocks
   - Hides for other block types

### State Flow in Antigravity:

```
User Interaction
    ↓
Capture in Block Component
    ↓
Dispatch Action to Global State
    ↓
Update Blocks Data Structure
    ↓
Trigger Re-render of affected components
    ↓
UI Updates with new state
    ↓
Save to Database (debounced)
```

### Key Integration Points:

1. **Block Selection** - Click on block → update selectedBlockId → sidebar shows actions
2. **Block Editing** - Double-click → editingBlockId set → enable contentEditable
3. **Toggle Interaction** - Click triangle → toggle isCollapsed → re-render children
4. **Nested Rendering** - Use recursion: if block has children, render Block component for each child
5. **Keyboard Shortcuts** - Global keyboard listener → dispatch appropriate actions

---

## PERFORMANCE OPTIMIZATION TIPS

1. **Virtualization** - Only render visible blocks (if document is very long)
2. **Memoization** - Memoize Block component to prevent unnecessary re-renders
3. **Debouncing** - Debounce save operations
4. **Lazy Loading** - Load block children on demand
5. **Code Splitting** - Load block type components on demand

---

## TESTING STRATEGY

- [ ] Unit tests for each block type
- [ ] Integration tests for drag & drop
- [ ] Integration tests for keyboard shortcuts
- [ ] E2E tests for complete workflows
- [ ] Performance tests for large documents
- [ ] Accessibility tests (axe, screen readers)

---

## NEXT STEPS AFTER IMPLEMENTATION

1. Add collaboration features (real-time sync, presence awareness)
2. Implement templates for common structures
3. Add database/table blocks
4. Add media blocks (images, videos, embeds)
5. Advanced AI features (generate, translate, etc.)
6. Custom block types for specific use cases
7. Integration with external services
8. Advanced styling and theming

---

This guide provides the foundational architecture and step-by-step implementation approach. Each section can be expanded based on your specific requirements and the Antigravity platform's capabilities.