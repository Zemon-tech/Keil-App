# Implementation Plan: Motion (Notion Clone)

Transforming the current static "Motion" components into a dynamic, production-grade workspace application.

## 1. Backend Foundation (Node.js/Express + PostgreSQL)

### Database Schema Expansion
We need a `motion_pages` table to store the hierarchical structure and content.

```sql
CREATE TABLE motion_pages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID REFERENCES workspaces(id),
  user_id UUID REFERENCES users(id),
  parent_id UUID REFERENCES motion_pages(id) ON DELETE CASCADE,
  title TEXT DEFAULT 'Untitled',
  content JSONB DEFAULT '[]', -- Tiptap JSON format
  icon TEXT, -- Emoji or URL
  cover_image TEXT,
  slug TEXT UNIQUE,
  is_published BOOLEAN DEFAULT false,
  is_archived BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_motion_pages_workspace ON motion_pages(workspace_id);
CREATE INDEX idx_motion_pages_parent ON motion_pages(parent_id);
CREATE INDEX idx_motion_pages_slug ON motion_pages(slug);
```

### API Endpoints (`/api/v1/motion`)
- `GET /pages`: Retrieve hierarchical list of pages for the sidebar.
- `GET /pages/:id`: Fetch specific page content.
- `POST /pages`: Create a new page (optionally under a `parent_id`).
- `PATCH /pages/:id`: Update title, content, or metadata.
- `DELETE /pages/:id`: Archive or delete a page.
- `GET /public/:slug`: Public access for shared pages.

## 2. Frontend Architecture (React + Vite + Tiptap)

### Tiptap Editor Integration
The core of "Motion" will be a highly customized Tiptap editor.

- **Extensions**:
  - `StarterKit` (standard formatting)
  - `Typography`, `Placeholder` ("Type '/' for commands...")
  - `TaskItem`, `TaskList` (for plans/to-dos)
  - `Table`, `TableRow`, `TableCell`, `TableHeader`
  - `CodeBlockLowlight` (for syntax highlighting)
  - **Custom Extensions**:
    - `MermaidNode`: Custom node to render Mermaid diagrams.
    - `SlashCommand`: Custom extension for the "/" menu.

### Dynamic Navigation
- Refactor `MotionSidebar.tsx` to fetch pages from the backend.
- Implement recursive nesting: a page can have sub-pages.
- Drag-and-drop for reordering pages in the sidebar (using `dnd-kit` or `react-beautiful-dnd`).

### Shared Public Pages
- Create a dedicated `PublicMotionPage.tsx` route that allows viewing content via slug without authentication (if `is_published` is true).

## 3. UI/UX & Aesthetics
- **Breadcrumbs**: Navigate through parent pages.
- **Floating Toolbar**: Appears when text is selected.
- **Slash Menu**: Beautiful, keyboard-navigable menu for adding blocks.
- **Cover Images & Icons**: Notion-style header customization.

## 4. Phase-wise Roadmap

### Phase 1: CRUD & Basic Editor
- Setup backend table and basic API.
- Integrate Tiptap with `StarterKit` and `Placeholder`.
- Implement page creation and title syncing.

### Phase 2: Hierarchy & Sidebar
- Build the recursive sidebar fetching.
- Add "Add sub-page" functionality.
- Implement basic breadcrumbs.

### Phase 3: Advanced Blocks
- Add Tables, Task Lists, and Code Blocks.
- Implement the Slash Command menu.
- Add Mermaid diagram support.

### Phase 4: Sharing & Slugs
- Implement slug generation and public routes.
- Add "Publish" toggle in the UI.

### Phase 5: Polish & Real-time
- Add glassmorphism effects and smooth transitions.
- (Optional) Socket.io integration for "User is typing..." and live updates.
