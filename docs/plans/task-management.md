# ClarityOS Task Module — Windsurf Engineering Prompt

## Overview

You are working on **ClarityOS**, a premium task management SaaS product targeting both individual users and small-to-medium teams. Think Linear meets ClickUp — structured, objective-driven, and fast. The product is built with **React + TypeScript + ShadCN/UI + Tailwind CSS**. 

**Current phase: Frontend only. The backend API contract exists (routes + controller skeletons) but controllers are not implemented. Do NOT touch backend files yet. All work is frontend-only, using mock data via `useState`.**

---

## What This App Is

ClarityOS is not a simple to-do app. Every task is *objective-driven*, meaning each task carries:
- **Why it exists** (Objective)
- **What done looks like** (Success Criteria)
- **Who owns it** (Owner + Assignees)
- **What's blocking it** (Dependencies)
- **What needs to happen inside it** (Subtasks)
- **Everything needed to do the work** (Context panel — docs, links, files)

This distinction is core to the product identity. It is closer to a "work operating system" than a task tracker.

---

## Current Tech Stack

- **Framework**: React + TypeScript (Vite)
- **UI Library**: ShadCN/UI — ALL components must use ShadCN. Do not introduce new UI libraries.
- **Styling**: Tailwind CSS utility classes only. Do not add custom CSS files or CSS variables. Do not change fonts.
- **State**: `useState` + mock data (no backend calls yet)
- **Calendar**: FullCalendar (already installed)
- **Gantt**: frappe-gantt (already installed)
- **Icons**: Lucide React

---

## Current File Structure (Frontend)

```
frontend/src/
├── pages/
│   └── TasksPage.tsx          ← Main orchestrator, two-pane layout
├── components/tasks/
│   ├── TaskListPane.tsx        ← Left pane: work queue grouped by project
│   ├── TaskDetailPane.tsx      ← Right pane: full task detail view
│   ├── TaskSchedulePane.tsx    ← Calendar view (FullCalendar)
│   └── TaskTimelinePane.tsx    ← Gantt view (frappe-gantt)
├── types/
│   └── task.ts                 ← Task TypeScript type
└── data/
    └── mockTasks.ts            ← Mock task data
```

---

## Current Task Type

```typescript
interface Task {
  id: string;
  projectId: string;
  projectTitle: string;
  title: string;
  description?: string;
  owner: string;
  objective?: string;
  successCriteria?: string;
  status: 'Backlog' | 'In Progress' | 'Blocked' | 'Done';
  priority: 'Low' | 'Medium' | 'High' | 'Critical';
  dueDateISO?: string;
  plannedStartISO?: string;
  plannedEndISO?: string;
  dependencies: Dependency[];
  subtasks: Subtask[];
  context: ContextItem[];
  comments: Comment[];
}
```

---

## UI Problems to Fix (Priority Order)

These are specific, targeted changes. Do not redesign the entire app. Preserve the existing dark theme, color scheme, and overall layout structure. Fix these issues precisely.

### 1. LIST PANE — Reduce Padding & Improve Density

**Problem**: Task cards in the list have too much padding, making the list feel sparse and non-professional.

**Fix**:
- Reduce card padding from `p-4` to `px-3 py-2`
- Remove the card border/shadow — use a subtle `hover:bg-accent/50` row highlight instead
- Task title: `text-sm font-medium`
- Meta row (owner + date): `text-[11px] text-muted-foreground` — put owner and date on the SAME line as the title, on the right side, not below it
- Status badge: replace filled pill badges with a small `w-2 h-2 rounded-full` colored dot inline before the title
  - In Progress → `bg-blue-500`
  - Blocked → `bg-red-500`
  - Done → `bg-green-500`
  - Backlog → `bg-zinc-500`
- Priority flag icon (Lucide `Flag`): show only for High/Critical tasks, `w-3 h-3`, right-aligned, muted color
- Group headers (e.g. "CLARITYOS LAUNCH"): `text-[10px] uppercase tracking-widest font-semibold text-zinc-500 px-3 pt-3 pb-1`

### 2. DETAIL PANE — Reduce Top Hero Padding

**Problem**: The task title + description header area at the top of the detail pane has too much vertical space, pushing content below the fold.

**Fix**:
- Reduce top padding of the header section to `pt-4 pb-3 px-5`
- Title: `text-lg font-semibold leading-snug`
- Description subtitle: `text-sm text-muted-foreground mt-0.5`
- Chips row (status, priority, owner, due date): `flex items-center gap-1.5 mt-2 flex-wrap`
- Each chip: use ShadCN `Badge` with `variant="outline"` and `text-xs px-2 py-0` — keep them small

### 3. DETAIL PANE — Section Label Style

**Problem**: Section headers like "Subtasks", "Dependencies", "Context panel" are styled like regular bold text, blending into content.

**Fix**: All section labels should use this exact pattern:
```tsx
<span className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground">
  Section Name
</span>
```
Pair with a count badge inline where relevant (e.g., subtasks: `2/4 complete`).

### 4. DETAIL PANE — Objective / Success Criteria Blocks

**Problem**: These two blocks are inside separate bordered Cards, which creates visual noise on a dark background.

**Fix**:
- Remove the Card wrappers
- Use a `grid grid-cols-2 gap-px bg-border` container — the `gap-px` with `bg-border` creates a clean hairline divider between them
- Each cell: `bg-background p-4`
- Label: `text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5`
- Content text: `text-sm leading-relaxed`

### 5. SUBTASKS — Tighter Rows

**Problem**: Subtask checkboxes have too much spacing between rows.

**Fix**:
- Container: `space-y-0` (remove gap entirely)
- Each row: `flex items-center gap-2.5 px-2 py-1.5 rounded hover:bg-accent/40 cursor-pointer`
- Checkbox: ShadCN `Checkbox` with `className="w-3.5 h-3.5"`
- Completed subtask text: `line-through text-muted-foreground`
- "Add subtask" button: `text-xs text-muted-foreground hover:text-foreground` — ghost style, no border

### 6. DEPENDENCIES — Compact Cards

**Problem**: Dependency items inside the detail pane are too tall.

**Fix**:
- Each dependency row: `flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent/40`
- Task ID label (e.g. TSK_03): `text-[10px] font-mono text-muted-foreground`
- Status badge: keep as badge but use `text-[10px] px-1.5 py-0 h-4`

### 7. CONTEXT PANEL — Card Grid

**Problem**: Context item cards (Module spec, Figma export, API contract) are too tall with too much padding.

**Fix**:
- Grid: `grid grid-cols-3 gap-2`
- Each card: `flex items-center gap-2 p-2 rounded-md border border-border hover:bg-accent/40 cursor-pointer`
- Icon: `w-4 h-4 text-muted-foreground shrink-0`
- Title: `text-xs font-medium truncate`
- Type label (DOC, LINK): `text-[10px] text-muted-foreground uppercase`

### 8. CREATE TASK MODAL — Add Tabs

**Problem**: The create task form dumps all fields at once, which is overwhelming.

**Fix**: Split into 3 tabs using ShadCN `Tabs`:
- **Basics** tab: Project, Title, Description, Owner, Status, Priority
- **Strategy** tab: Objective textarea, Success Criteria textarea
- **Schedule** tab: Due date, Planned start, Planned end

Modal structure:
- `DialogContent` with `className="max-w-2xl p-0 gap-0"`
- Header section: `px-5 pt-5 pb-4 border-b`
- Tabs content: `px-5 pt-3 pb-4 min-h-[220px]`
- Footer: `px-5 py-3 border-t flex justify-end gap-2`
- All inputs use ShadCN `Input` and `Textarea` with `text-sm`
- Labels: `text-xs font-medium text-muted-foreground mb-1`

### 9. COMMENTS SECTION — Compact Thread Style

**Problem**: Comment blocks are card-style and boxy.

**Fix**:
- Remove card wrappers from individual comments
- Use a simple list: author name `text-xs font-semibold` + timestamp `text-[10px] text-muted-foreground` on one line
- Comment body: `text-sm text-foreground mt-0.5`
- Separator between comments: a single `<Separator />` from ShadCN
- "Add comment" input: inline at the bottom, `Input` with `placeholder="Add a comment..."` and a `Button` with `size="sm"` next to it

---

## Features to Add (Frontend Only, Mock Data)

These are new features to be built with mock data and local state. No API calls.

### Feature 1: Inline Status Change (Right-click or Click on Status Dot)

When the user clicks the status dot on a task in the list, show a ShadCN `Popover` with 4 status options. Selecting one updates the task status in local state immediately.

```tsx
const STATUS_OPTIONS = ['Backlog', 'In Progress', 'Blocked', 'Done'];
// Each option shows the colored dot + label
// On select: setTasks(prev => prev.map(t => t.id === id ? {...t, status} : t))
```

### Feature 2: Keyboard Shortcut — Create Task

When the user presses `C` (not inside an input), open the Create Task modal. Use a simple `useEffect` with a `keydown` listener. Check `event.target.tagName !== 'INPUT'` and `!== 'TEXTAREA'` before triggering.

### Feature 3: Multi-select + Bulk Status Change

- Add a checkbox on the far left of each list row, visible only on hover (except when in multi-select mode)
- When any checkbox is checked, enter "multi-select mode"
- Show a floating action bar at the bottom of the list pane: `"X tasks selected"` + `"Change status"` dropdown + `"Clear"` button
- Use ShadCN `Select` for the status dropdown
- On confirm: update all selected task statuses in local state

### Feature 4: Filter Bar Upgrade

The current filter only shows "All". Expand it:
- Add filter chips for: `All`, `Mine`, `In Progress`, `Blocked`, `High Priority`
- "Mine" filters by a hardcoded `currentUser = "Shivang"` for now
- Use ShadCN `ToggleGroup` component for the filter chips
- Active filter chip: `variant="default"`, inactive: `variant="outline"` — `text-xs h-7`

### Feature 5: Empty State for Detail Pane

When no task is selected, the right pane currently shows "No task selected" with a generic icon. Upgrade it:
- Keep the centered layout
- Add a keyboard shortcut hint: `Press C to create a new task`
- Style the hint as a `kbd` tag: `<kbd className="px-1.5 py-0.5 text-xs rounded border border-border bg-muted font-mono">C</kbd>`

### Feature 6: Task Completion Confirmation

When a user clicks "Mark done" on a task:
- Show a ShadCN `Toast` (use `useToast` hook): `"✓ Task marked as done"`
- Update task status to `Done` in local state
- In the list, visually dim the done task: `opacity-60`

---

## Data Model Additions (TypeScript Only — No Backend)

Add these fields to the `Task` type. Add corresponding mock data. No backend changes.

```typescript
interface Task {
  // ... existing fields

  // New fields
  assignees: string[];              // ["Shivang", "Aisha"] — multiple people
  labels: string[];                 // ["design", "frontend", "bug"]
  storyPoints?: number;             // 1, 2, 3, 5, 8, 13
  parentTaskId?: string;            // for subtask nesting (future use)
  
  // Extend ContextItem
  // type: 'doc' | 'link' | 'figma' | 'github' | 'notion'
}

// Also add to Subtask type:
interface Subtask {
  id: string;
  title: string;
  done: boolean;
  assignee?: string;    // new
  dueDate?: string;     // new
}
```

Update mock data to include realistic values for these fields across all existing tasks.

---

## Component Behavior Rules

These are behavioral rules that must be consistent across all components:

1. **No full page reloads** — all state changes are local, instant, optimistic
2. **Hover states on all interactive elements** — every clickable thing must have a `hover:` Tailwind class
3. **No layout shift** — when selecting a task, the list pane must not reflow or shift
4. **Truncation** — all task titles in the list must truncate with `truncate` class, never wrap to two lines
5. **Transitions** — use `transition-colors duration-150` on hover states, nothing else
6. **Focus states** — all interactive elements must have visible focus rings (ShadCN handles this automatically, do not override)
7. **Empty arrays** — if `subtasks`, `dependencies`, or `context` arrays are empty, show a minimal empty state message like `"No subtasks yet"` in `text-xs text-muted-foreground italic`

---

## What NOT to Change

- Do not change the overall two-pane layout structure
- Do not change the dark color theme or background colors
- Do not add new fonts or change typography families
- Do not add custom CSS files or modify `globals.css`
- Do not install new npm packages (use what's already installed)
- Do not touch any backend files (`backend/src/**`)
- Do not add animations beyond simple Tailwind `transition-colors`
- Do not change the sidebar navigation

---

## Success Criteria for This Work

When complete, the app should:

1. Feel as dense and fast as **Linear** — list items are compact, information-rich rows, not boxy cards
2. The detail pane should show all task information without requiring any scrolling for standard tasks
3. The Create Task modal should feel guided and not overwhelming
4. A user should be able to change a task's status in under 2 clicks
5. Multi-selecting and bulk-updating tasks should be possible
6. The filter bar should allow quick switching between personal queue and team views
7. All ShadCN component usage should be consistent — same `size`, same `variant` patterns throughout
8. Zero layout bugs — no overflow, no content clipping, no horizontal scroll

---

## Implementation Order

Work in this exact sequence to avoid merge conflicts and cascading issues:

1. **Type updates** — `task.ts` + `mockTasks.ts` first (everything else depends on data shape)
2. **List pane UI** — `TaskListPane.tsx` (density, status dots, group headers, filter bar)
3. **Detail pane UI** — `TaskDetailPane.tsx` (header, objective/criteria grid, subtasks, dependencies, context, comments)
4. **Create task modal** — upgrade to tabbed layout
5. **Inline status change** — popover on status dot
6. **Multi-select** — checkboxes + floating action bar
7. **Keyboard shortcut** — `C` to create
8. **Empty state upgrade** — keyboard hint in right pane
9. **Toast on mark done** — final polish

---

*This prompt covers the complete scope of the current frontend improvement sprint. Backend implementation (Supabase/PostgreSQL integration, React Query data fetching, real-time comments) is a separate sprint and should not be started until all items above are complete and reviewed.*