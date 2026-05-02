# Motion: Lightweight Block-Based Architecture Plan

## Analysis of Existing Architecture Documentation
Based on the thorough review of the `docs/block` directory, the proposed architecture utilizing **TipTap + ProseMirror + Zustand** is exceptionally well-suited for the "Motion" workspace. 

### Why this architecture fits Motion (CVP & Scalability):
1. **Truly Lightweight:** By using a single TipTap instance for the entire page rather than rendering hundreds of individual React `contentEditable` components, the DOM remains shallow. The bundle size is minimal (~40KB gzipped), making it incredibly fast.
2. **Highly Scalable:** ProseMirror's native document model (`JSONContent`) handles 1000+ blocks seamlessly. It updates incrementally rather than re-rendering the entire list of blocks on every keystroke.
3. **CVP Ready (Commercially Viable Product):** The architecture is robust, highly maintainable, and performant enough for a commercial release. The decoupled nature (using Zustand independent of the UI) means the "Motion" editor is stable, highly embeddable, and avoids monolithic dependencies that would hinder commercial scaling.
4. **Notion-like UX Invariants Built-in:** Features like undo/redo, text selection across blocks, and keeping a final empty paragraph are handled natively or through simple extensions, avoiding complex and buggy manual state tracking.

---

## Step-by-Step Implementation Plan for Motion
*This plan outlines how to progressively integrate the lightweight architecture into the `MotionPage` without disrupting the existing application state.*

### Phase 1: Foundation & State Migration (The Core)
**Goal:** Establish the TipTap document structure and Zustand state management for Motion.
1. **Dependency Verification:** Ensure `@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/pm`, `zustand`, and `uuid` are installed.
2. **Type Definitions:** Implement `src/types/page.ts` and `editor.ts` to define the `JSONContent` page model.
3. **State Management Setup:** 
   - Create `usePageStore` (for page CRUD operations and TipTap JSON syncing) and `useEditorStore` (for UI state like focus).
   - *Crucial for Motion:* Map any existing Motion data structures to the new `JSONContent` format.
4. **Core Extensions:** Implement `BlockIdExtension` (to give every block a stable UUID) and `EnforceFinalBlockExtension` (to ensure the editor never reaches an uneditable empty state).

### Phase 2: Editor UI Integration (The Canvas)
**Goal:** Replace the current block rendering logic in `MotionPage.tsx` with the unified TipTap editor.
1. **Component Creation:** 
   - Build `BlockEditor.tsx` as the main TipTap wrapper.
   - Build `MenuBar.tsx` for text formatting (Bold, Italic, headings, lists).
2. **Styling Integration:** Apply Tailwind typography classes (`prose dark:prose-invert`) to ensure the Motion editor matches the premium aesthetic required.
3. **MotionPage Embed:** Update `MotionPage.tsx` to render the `BlockEditor` component, passing in the active `pageId` from the Motion workspace state.
4. **Local Data Persistence (Frontend MVP):** Hook up the `onUpdate` TipTap event to save the `JSONContent` locally via `localStorage`. The persistence logic should be cleanly abstracted into service functions so the backend team can easily swap it out for API calls when they are ready.

### Phase 3: Advanced Notion UX (The "Motion" Feel)
**Goal:** Elevate the editor from a basic rich-text canvas to a full block-based workspace.
1. **Slash Commands:** Implement a custom TipTap extension for the `/` menu to insert blocks easily.
2. **Drag and Drop:** Utilize native ProseMirror drag-and-drop, optionally adding a custom NodeView for a visible left-hand drag handle (⋮⋮).
3. **Advanced Blocks:** Add support for Notion-specific blocks planned for Motion:
   - Toggle Lists (collapsible sections).
   - Subpage links.
   - Code blocks with syntax highlighting.

### Phase 4: Frontend Production Readiness (Commercially Viable Product Finalization)
**Goal:** Ensure the Motion frontend meets the standards of a Commercially Viable Product—meaning it is highly scalable, resilient, and prepared for the backend team to integrate their endpoints.
1. **Backend Integration Handoff:** Ensure all data operations (save, load, sync) are cleanly abstracted in the Zustand store so the backend team can easily replace local operations with debounced API calls.
2. **Performance Auditing:** Ensure that navigating between different Motion pages unmounts and remounts the TipTap instance cleanly without memory leaks. A CVP must remain performant over long sessions.
3. **Collaboration Readiness:** The `JSONContent` structure and ProseMirror backend leave the door open to drop in `Y.js` for real-time multiplayer collaboration (a key feature for commercial productivity apps).
4. **Error Handling & Offline Support:** Implement robust error boundaries and offline indicators so users don't lose data if their connection drops, simulating resilience even before the backend is fully wired up.

---
*Note: This document serves as the strategic roadmap. No code changes have been made to the repository yet. When ready to proceed, we will begin with Phase 1.*
