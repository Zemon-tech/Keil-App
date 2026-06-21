# KeilHQ — Complete Product & Feature Reference

> Built from source code. Every feature listed here is implemented and visible in the UI.

---

## How the App Is Structured

```
User Account
├── Personal Mode (is_personal org, always present)
└── Organisation(s)
    └── Space(s)             ← scoped context for all work
        ├── Dashboard        ← AI command center
        ├── Tasks & Events   ← task board + calendar view
        ├── Motion           ← block-based document editor
        ├── Chat             ← real-time messaging
        └── Notifications    ← cross-feature alert feed
```

Everything in the app — tasks, chat messages, pages, events — belongs to a specific **Org → Space** pair. The active org + space is always shown in the sidebar and drives every API call.

---

## Pages & Routes

| Route | What renders |
|---|---|
| `/` | Dashboard (AI HeroSection + DashboardPanel) |
| `/tasks` | Tasks page (task list + calendar view) |
| `/tasks/:id` | Deep-link to a specific task (opens TaskDetailPane) |
| `/events/:id` | Deep-link to a specific event (opens EventDetailPane) |
| `/motion` | Motion home (page gallery) |
| `/motion/:id` | Motion page editor |

---

## 1. Application Shell

### Sidebar (`AppSidebar`)

The sidebar is the persistent navigation layer present on all pages.

**Sections:**
- **Logo + Space Switcher** — Clicking the top avatar/logo opens the org switcher dropdown. Shows all your organisations and their spaces in a nested submenu. Active org/space has a checkmark.
- **Navigation Items** — 4 items:
  - Dashboard → `/`
  - Tasks → `/tasks`
  - Motion → `/motion`
  - Notifications → opens `NotificationDialog`
- **Notification Badge** — Red unread count badge on the Notifications icon. Real-time via Socket.io.
- **Search Input** — Inline search bar inside the sidebar for quick lookup.
- **Meeting Minimized Pill** — If you minimise an active recording session, a pill appears in the sidebar showing elapsed time and a restore button.
- **User Footer** — Bottom avatar area. Clicking opens a dropdown with:
  - Profile / Account settings (opens Settings → Account tab)
  - Org settings (opens Settings → Org General tab)
  - Theme toggle (Light / Dark / System)
  - Sign Out

**Org Management Dialog** (triggered from sidebar footer):
- **Create** tab — type a name → creates org + auto-creates a "General" space
- **Join** tab — paste invitation token → joins existing org and joins WebSocket room immediately

**Keyboard Shortcuts (from sidebar context):**
- `⌘G` / `Ctrl+G` — Go to Dashboard
- `⌘Q` / `Ctrl+Q` — Go to Tasks
- `⌘P` / `Ctrl+P` — Go to Motion
- `⌘J` / `Ctrl+J` — Toggle Chat sidebar drawer
- `⌘⇧C` / `Ctrl+Shift+C` — Open Chat full dialog
- `⌘L` / `Ctrl+L` — Toggle Notifications
- `⌘M` / `Ctrl+M` — Open / restore Meeting Studio
- `⌘⇧X` / `Ctrl+Shift+X` — Open Create Task dialog
- `⌘,` / `Ctrl+,` — Open Settings
- `⌘/` / `Ctrl+/` — Open Shortcuts reference
- `⌘D` / `Ctrl+D` — Toggle Light/Dark theme
- `⌘⌥N` / `Ctrl+Alt+N` — Create new Motion page

---

## 2. Dashboard (`/`)

The Dashboard is an AI-first command centre. It is divided into two zones: the HeroSection (AI prompt + history) and the DashboardPanel (workspace snapshot widget).

### 2a. Dashboard Panel (Workspace Snapshot)

A fixed-size card with a 3D wheel picker on the left and stats on the right.

**Wheel Picker** — Scrollable 3D carousel that cycles through 6 cards:
1. **Current Focus Card** — Shows the #1 priority task for today. Task title, status badge, due date. Clicking navigates to the task.
2. **Immediate Blockers Card** — List of tasks marked as urgent/blocked that need attention now.
3. **Needs Reply Card** — Chat messages and task comments that have been sent to you and haven't been replied to.
4. **Next Event Card** — The next upcoming calendar event for the active space. Shows event title, start time, and a Google Meet link if one was generated.
5. **Quick Capture Card** — One-tap task creation from the dashboard. Opens create dialog.
6. **Up Next Card** — Today's task queue in order of priority.

**Stats Row (right side):**
- Urgent count (red) — tasks flagged urgent or blocked
- Replies count (blue) — messages/comments awaiting your reply
- Queued count (green) — tasks scheduled for today

**Clock & Date** — Live clock (updates every 30 seconds). Respects 12h/24h time format preference. "Live" green pill indicator.

### 2b. HeroSection (AI Command Centre)

The chat input area. Sends messages to the **Supervisor AI Agent** which routes to sub-agents.

**AI Agents available:**
- `keilhq-task-agent` — Task Manager: create/update/delete/search/list tasks across workspaces
- `keilhq-chat-agent` — Chat: read channels and send messages
- `keilhq-motion-agent` — Notes: create/read/update/search Motion pages
- `keilhq-scheduler-agent` — Scheduler: read calendar events, find free slots, auto-schedule unscheduled tasks
- `keilhq-github-agent` — GitHub: list issues/PRs, get issue details, list contributors, create GitHub issue from a KeilHQ task

**AI Tools the agents can invoke:**
- `list_tasks`, `get_task`, `create_task`, `update_task`, `delete_task`, `search_tasks`
- `resolve_workspace` — resolves org/space from natural language
- `get_calendar_events`, `get_unscheduled_tasks`, `auto_schedule_tasks`
- `get_user_channels`, `get_channel_messages`
- `list_motion_pages`, `search_motion_pages`, `get_motion_page`, `create_motion_page`, `update_motion_page`
- `web_search_exa` — live web search
- `list_github_issues`, `get_github_issue`, `list_github_prs`, `list_github_contributors`, `create_github_issue_from_task`

**Chain of Thought Display** — While the AI is thinking, each tool call is shown as a real-time step with:
  - An icon matching the tool type (search, task, calendar, file, etc.)
  - A human-readable label ("Creating task \"Fix login bug\"")
  - A result description ("Created task successfully (ID: xyz)")
  - Expandable raw result content

**Message UI:**
- AI messages: rendered markdown with `<Message>` component
- Like / Dislike / Copy actions on each AI message
- Shimmer loading skeleton while streaming
- Long messages are truncated with a "Show more" toggle

**History Sidebar** — Slide-in panel from the right showing all past conversation sessions with the AI. Click any session to restore the full conversation. Each session shows a title, timestamp, and short excerpt.

**Conversation Controls:**
- New conversation button (pen icon) — clears current session, starts fresh
- History button — opens/closes the history sidebar panel
- File/image attachments — paperclip icon uploads files to S3 and attaches them to the message
- Send button

**Prompt Input:**
- Multiline text input
- `/` slash commands trigger a quick-action command menu for setting priority or date
- Pressing Enter (no Shift) sends the message

---

## 3. Tasks (`/tasks`)

### 3a. Task List (Default View)

Tasks are organised into sections. Each section is a collapsible group header.

**Sections available (configurable in Settings → Tasks):**
1. **Needs Attention** (🔥) — Urgent, overdue, or blocked tasks
2. **My Focus** (🎯) — Tasks explicitly flagged for focus
3. **Current Sprint** (🚀) — Tasks in the active sprint
4. **Sprint Done** (✅) — Completed tasks in current sprint
5. **Unscheduled** — Tasks with no due date
6. **Upcoming Work** (📅) — Tasks with a future due date
7. **Recently Completed** — Tasks completed in the last 7 days

**Task Row fields shown inline:**
- Status icon (dot color: grey=todo, blue=in-progress, purple=in-review, green=done, red=blocked, dark=backlog)
- Title
- Priority flag (grey=low, yellow=medium, orange=high, red=urgent)
- Assignee avatar(s)
- Due date badge
- Type badge (task vs event)
- Story points badge (if set)

**Filters Bar:**
- Status filter (multi-select: todo, in-progress, in-review, done, blocked, backlog)
- Priority filter (multi-select: urgent, high, medium, low)
- Assignment filter (assigned to me / created by me / watching / unassigned)
- Sprint filter (current / next / backlog)
- Search (debounced keyword search across titles)
- "Reset Filters" button when any filter is active

**View Switcher:** Toggle between List view and Calendar view (top-right).

**Create Task Button:** Top-right "Create" button opens `CreateTaskDialog`.

**GitHub AI assistant button** — floating button on tasks page that opens Dashboard AI with GitHub context pre-loaded.

### 3b. Calendar View

Full monthly/weekly calendar showing tasks and events as colour-coded chips.

**Event Types and Colours:**
- Task: blue chip
- Event: green chip (teal for confirmed, yellow for tentative)
- Meeting: distinct event type colour
- Focus / Reminder / Deadline — each with their own colour from CSS event variables

**Calendar interactions:**
- Click a day to open Create Task dialog with that date pre-filled
- Click an event/task chip to open its detail pane
- Drag to select a date range to create multi-day events
- Calendar shows Google Calendar synced events alongside KeilHQ tasks

**Event Detail Pane (Calendar):** Clicking a calendar chip opens `EventDetailPane` on the right side:
  - Overview tab (same as task overview)
  - Activity tab (comments, mentions)

### 3c. Create Task / Event Dialog

A resizable dialog (minimize/maximize button). Has two modes: Create and Edit.

**Dialog Header:**
- Org picker dropdown (switch org inline)
- Space picker dropdown (switch space inline)
- Type picker ("New task" / "New event")
- Maximize/restore window toggle
- Close button

**Type = Task fields:**
- Title (autofocus, smart parsing active — see below)
- Description editor (Tiptap-based, supports `@mentions` of members, tasks, pages)
- Status pill → popover with: todo, in-progress, in-review, done, blocked, backlog
- Priority pill → popover with: Low, Medium, High, Urgent
- Start date / End date picker (calendar with drag-to-select range)
- Assignees (multi-select, searchable avatar picker)
- Story points input
- Time estimate input (in minutes)
- Context section — attach Motion pages or other tasks as reference links
- File attachments (paperclip)
- "Create More" toggle — keeps dialog open after creation
- Parent task badge (shown when creating a subtask)

**Type = Event extra fields:**
- Location input (MapPin icon)
- "Schedule Google Meet" toggle — auto-generates a Google Meet video link (requires Google Calendar connected)
- Agenda details textarea
- Event type selector (meeting / workshop / etc.)
- Guests — add external emails as guests

**Smart Title Parsing (fires on every keystroke):**
- Detects keywords `meeting / call / sync / lunch / coffee / event / workshop` → auto-switches type to Event
- Detects `!urgent`, `high`, `!low` → sets priority automatically
- Detects `today`, `tomorrow`, `monday` → sets due date automatically
- Detects `@username` format → adds assignee automatically

**`/` Command Menu:**
- Triggered by typing `/` in the title field
- Options: Set Urgent Priority, Due Today, Convert to Event

**Objective & Success Criteria Parsing:**
- If the description contains `## Objective` or `## Success Criteria` headings, they are extracted and stored separately on the task record.

### 3d. Task Detail Pane (`TaskDetailPane`)

Opens to the right of the task list when you click a task row.

**Header strip:**
- Task title (editable inline or via edit dialog)
- Status selector (dropdown)
- Priority selector (flag icon)
- Edit button → opens `CreateTaskDialog` in edit mode
- Delete button → confirms and deletes
- Close button
- Breadcrumb trail (parent task → child task) with clickable navigation

**4 Tabs:**

**① Overview Tab:**
- Description (Tiptap editor, renders markdown)
- Assignees — avatar chips + "Add assignee" popover with member search
- Guests — external email addresses
- Start date / Due date inline editable fields
- Priority badge (editable)
- Status badge (editable)
- Story points
- Time estimate
- Event type
- Location (events only)
- Google Meet link (events only)
- Progress bar (based on subtask completion)
- Subtasks — nested list with their own status/priority chips. Click a subtask to navigate into it (breadcrumb trail updates). "Add subtask" button opens CreateTaskDialog with parent pre-filled.
- Checklists — named checklist groups with per-item completion toggles. Add multiple checklists, add items to each, check them off.
- Context Links — attached Motion pages or related tasks shown as clickable reference chips. Clicking navigates to that page/task.

**② Activity Tab:**
- Comment editor with `@mention` support for members, tasks, and pages
- Mention suggestions pop up as a floating picker as you type `@`
- Posted comments show author avatar, timestamp, content
- Notifications are sent to mentioned members in real-time

**③ Dependencies Tab:**
- Add tasks that must be completed before this one (blockers)
- Add tasks that this one blocks (downstream)
- Displayed as a linked task list with status chips

**④ History Tab:**
- Full audit log of every field change (status change, assignee added, priority update, etc.)
- Shows actor, timestamp, field name, from value → to value

---

## 4. Motion — Document Editor (`/motion` and `/motion/:id`)

Motion is KeilHQ's block-based document system, similar to Notion.

### 4a. Motion Home (`/motion`)

Gallery view of all pages in the active space.

**Four sections:**
1. **Recently Visited** — Pages you opened recently, pulled from localStorage, max 6 shown as cards
2. **Pages** (or "Private Pages") — All pages you created in this space with no parent
3. **Shared with this space** — Pages from other spaces that have been shared into your current space
4. **Notion Imported** — Pages that were imported from Notion (have a `notion_page_id`)

**Page Cards** — 120×108px cards. Each shows:
- Cover image thumbnail (top 52px)
- Page icon (emoji or Lucide icon, overlapping cover)
- Page title (truncated)
- Relative time since last edit
- Hover scale animation on both cover and icon

**Create Button** — "New Page" card with dashed border. Creates a blank page and immediately navigates to the editor.

**Motion Sidebar** — Collapsible 288px sidebar showing the full page tree for the space.

### 4b. Motion Sidebar (`MotionSidebar`)

The tree-nav on the left side of any Motion page.

**Sections in sidebar:**
- All pages for the active space, organised in a nested tree (parent/child hierarchy)
- "New Page" button at the bottom
- Trash / deleted pages section
- Recently opened pages (tracks history)
- Pages shared to this space from other spaces

**Per-page item:**
- Hover shows action buttons: new sub-page, more options (rename, delete)
- Collapse/expand if the page has sub-pages
- Active page is highlighted

### 4c. Motion Page Editor (`/motion/:id`)

The full block editor experience.

**Cover:**
- Optional cover image spanning full width
- Cover can be: solid colour, gradient, or any image (gallery, URL, Unsplash, or uploaded file)
- "Reposition" mode — drag the cover image up/down while in reposition mode, click "Save position" or click outside to commit
- Remove cover button

**Cover Picker tabs:**
- Gallery — preset images from Hudson River School, Patterns, Rijksmuseum, Metropolitan Museum of Art collections
- Upload — upload your own image from disk
- Link — paste any image URL
- Unsplash — search and pick from Unsplash (if configured)

**Page Icon:**
- Optional emoji or Lucide icon shown above/beside the title
- Click to open icon picker
- Icon Picker tabs:
  - Emoji — full emoji grid with search
  - Icons — Lucide icon grid with search
  - Upload — custom image icon
- "Random" button in emoji tab

**Page Title:** Large H1 input. Click to edit inline.

**Block Editor (Tiptap / SimpleEditor):**

This is a rich text editor supporting:
- Paragraph text
- Headings (H1, H2, H3)
- Bullet lists, numbered lists
- Todo / checkbox lists
- Blockquotes
- Code blocks (syntax highlighted)
- Dividers / horizontal rules
- Images (upload or URL)
- Tables
- Inline code
- Bold, italic, underline, strikethrough, highlight
- Links
- `@mentions` of space members (creates a mention link)
- `/` slash command palette for inserting any block type

**Real-time Collaboration:**
- Changes broadcast via Socket.io to all users viewing the same page
- Cursor positions / presence not shown but content syncs instantly

**Auto-save:**
- Content debounced 2 seconds after last keystroke, then auto-saved
- Save status indicator in top-right: "Saved" / "Saving…"
- Local draft recovery: if you close without saving, a draft is stored in localStorage. On next open, a toast offers to restore it.

**Top Action Bar:**
- Sidebar toggle (Menu icon)
- Breadcrumb trail (parent page → current page)
- Last edited by + timestamp
- Share button → opens MotionSharePanel
- More options dropdown:
  - Lock page (disables editing by non-admins)
  - Copy content to clipboard
  - Export to Notion → dialog with two modes:
    - Create new Notion page (enter parent Notion page ID)
    - Append to existing Notion page (enter target Notion page ID)
  - Sync from Notion (pull latest content from linked Notion page)
  - Unlink from Notion (removes the `notion_page_id` link)
  - Delete page (soft delete → page goes to Trash)
  - Restore page (from Trash)

**Right Drawer (triggered by toolbar):**
- **Updates tab** — real-time activity feed for this page (who edited, comments)
- **Analytics tab** — page view count, unique viewers over time (`useRecordPageView` tracks each visit)

**Read-Only mode:**
- Page is read-only for members below Manager role
- Shared pages have granular permission: `view_all`, `view_managers`, `edit_all`, `edit_managers`, `edit_admins`

**Page Sharing (`MotionSharePanel`):**
- Share a page into one or more other spaces
- Permission options: view only, view (managers+), edit (all), edit (managers+), edit (admins only)
- Remove a space from sharing list
- Sharing creates a cross-space reference — the page appears under "Shared with this space" in the target space

**Notion Integration on Page:**
- "Sync from Notion" — fetches the latest content from the linked Notion page and overwrites local content
- "Export to Notion" — pushes current content to Notion (create or append mode)
- "Unlink from Notion" — removes the Notion link without deleting content

---

## 5. Chat

### 5a. Chat Drawer (Sidebar mode)

Triggered by `⌘J` or clicking the Chat icon. Slides in from the right at 400px width.

**Channel List view (when no channel selected):**
- Shows all channels the user is a member of
- New Chat button → opens `NewChatDialog`
- Expand button → opens full-screen Chat Dialog

**Active Channel Header:**
- Back arrow → returns to channel list
- Channel name + member count (for groups) or "Direct Message" label
- For group channels: Group Settings button
- For DM channels: Maximize button to go full-screen

**Message View:**
- Scrollable message history
- Message input at the bottom
- Real-time messages via Socket.io
- Emoji reactions (if in the message view)

### 5b. Chat Dialog (Full-screen mode)

Triggered by `⌘⇧C` or clicking Maximize in the drawer.

**Same functionality as the drawer but in a full-screen dialog.**

### 5c. Channel Types

- **Direct Messages (DM)** — 1-on-1 between two members
- **Group Channels** — Named channels with multiple members

### 5d. New Chat Dialog (`NewChatDialog`)

- Search members by name/email
- Select one member → creates DM
- Select multiple → creates group channel with a name

### 5e. Group Settings Dialog (`GroupSettingsDialog`)

For group channels only:
- View and manage members
- Add new members
- Remove members
- Rename channel
- Leave channel / Delete channel

### 5f. Message View (`MessageView`)

Inside a channel:
- Full message history (paginated / infinite scroll)
- Each message shows: author avatar, name, timestamp, content
- **Emoji Picker** — click emoji icon to add reaction or insert emoji in message
- Message input: supports multiline, Enter to send
- Notification trigger: sending a message in a channel fires a `someone_messaged` notification to all other members

### 5g. EmojiPicker

A full emoji grid picker component used in chat and also for Motion page icons:
- Categorised emoji grid (Smileys, Animals, Food, etc.)
- Search input
- Click to insert

---

## 6. Meetings Studio (`MeetingDialog`)

Accessible via `⌘M`. A floating draggable dialog that persists across page navigation.

### States the dialog can be in:
- **Idle** — ready to start a new recording
- **Recording** — actively capturing microphone audio
- **Paused** — recording paused (audio capture stops)
- **Transcribing** — audio uploaded, AI is generating transcript
- **Completed** — transcript ready to view
- **Error** — transcription failed
- **Historical Review** — viewing a past recording loaded by ID

### Recording (New Session)
- "Start Recording" button — requests microphone permission via `getUserMedia`
- Live timer shows elapsed duration (HH:MM:SS)
- Mute/Unmute microphone toggle
- Pause / Resume toggle
- 5 **Audio Visualiser Styles** (selectable from dropdown, persisted to localStorage):
  - **Bar** — vertical frequency bars
  - **Aura** — circular glow
  - **Grid** — dot matrix
  - **Wave** — sine wave
  - **Radial** — radial frequency rings

- "Stop & Transcribe" button — stops recording, uploads audio file to S3, triggers AI transcription job
- "Discard" button — stops recording, does not upload, throws away the audio

### Transcription Settings (before stopping)
- **STT Provider** selector:
  - **Sarvam** — supports 23 Indian languages, auto language detection
  - **ElevenLabs** — premium quality English transcription

### Completed State — Transcript View
- Full transcript text (monologue format)
- **Diarized Transcript** — speaker-separated segments, each entry shows:
  - Speaker ID label ("Speaker 0", "Speaker 1", etc.)
  - Timestamp (MM:SS)
  - Utterance text
- **Speaker Filter** — click speaker chips to filter transcript to only show selected speakers
- **Language Detected** label (e.g., "en", "hi")

### Audio Playback (Completed)
- Play / Pause audio player
- Seek bar (click to jump to position)
- Skip back 10s / Skip forward 10s buttons
- Playback speed selector: 0.5×, 0.75×, 1×, 1.25×, 1.5×, 2×
- Mute / Unmute volume toggle
- Current time / Total duration display

### Historical Review Mode
- Opens a past recording by ID (passed via `useMeetingStore`)
- Loads all data from the database (transcript, diarized transcript, audio URL, status, language)
- Same playback and speaker filter UI as completed live session
- Delete recording button → permanently removes recording + audio
- Re-transcribe button → triggers a new transcription job on existing audio
- Cancel transcription button → cancels a pending/in-progress job

### Minimized State
- Dialog minimizes to a small pill in the sidebar
- Shows elapsed time and recording status
- Click pill → restores full dialog (`restoreDialog`)
- Keyboard shortcut `⌘M` also restores

### WebSocket Integration
- `meeting_update` Socket.io event fired when backend transcription job completes
- On `processing` → toast: "Meeting Sync Started"
- On `completed` → toast: "Meeting Captured Successfully" with "Open Review" action button
- On `failed` → toast: "Meeting Sync Failed"

---

## 7. Notifications

### Notification Dialog

Full-screen dialog triggered by the Bell icon in the sidebar or `⌘L`.

**Left sidebar (category filters):**
- All
- Tasks (task_assigned, task_status_changed, comment_created)
- Mentions (mention_in_comment)
- Chat (someone_messaged)
- System (membership_updates)

Each category shows a count badge. Clicking filters the main feed.

**Header actions:**
- Mark all read (double check icon)
- Clear all (trash icon)
- Close (X)

**Notification Item:**
- Sender avatar (with type icon badge overlay)
- Notification title (bold if unread, normal if read)
- Unread dot (small blue circle next to title)
- Description (contextual: e.g., "John commented on 'Fix login bug'")
- Callout box — for comments and chat messages, shows a quoted snippet of the message text
- Type badge (Tasks / Mentions / Chat / System / Motion)
- Relative timestamp
- Clicking navigates directly to the relevant task, chat channel, or page

**Auto-mark as read:** All notifications are marked read as soon as the dialog opens.

### Notification Types

| Event Type | Trigger | Where it goes |
|---|---|---|
| `task_assigned` | Task assigned to you | Opens task detail |
| `task_status_changed` | Status of your task changed | Opens task detail |
| `comment_created` | Comment posted on task you're involved with | Opens task detail Activity tab |
| `mention_in_comment` | Someone `@mentioned` you in a comment | Opens task detail Activity tab |
| `someone_messaged` | New message in a channel you're in | Opens chat channel |
| `motion_shared` | A Motion page shared with your space | Opens Motion page |
| `membership_updates` | Added/removed from org or space | No navigation |

### Notification Preferences (Settings → Notifications tab)

Each notification type has an individual toggle:
- Task Assignments — on/off
- Comment Mentions — on/off
- Chat Messages — on/off
- Task Status Changes — on/off
- Motion Sharing — on/off
- Membership Updates — on/off

Changes are saved to the server immediately (optimistic update with rollback on error).

### Real-time Delivery

Notifications are pushed via Socket.io. The sidebar Bell icon badge count updates live as new notifications arrive without page refresh.

---

## 8. Settings Dialog

Opened via sidebar user footer, `⌘,`, or anywhere `useSettingsStore` triggers it.

Two-column layout: left nav sidebar + right content area.

### Account Section (tabs for the logged-in user)

**① Account tab**
- Display name (editable)
- Email address (read-only)
- Profile photo upload (replaces avatar)
- Change password section
- Delete account (danger zone)

**② Preferences tab**
- **Appearance** — Theme picker: Light / Dark / System (visual cards with sun/moon/monitor icons)
- **Chat view** — Default to sidebar drawer or full dialog
- **Time format** — 12-hour or 24-hour (fires a `time_format_changed` event picked up by the Dashboard clock)
- **Calendar detail view** — Sidebar pane or dialog popup when clicking a calendar event
- **Calendar day headers** — Toggle to hide the weekday header row in calendar

**③ Personalization tab**
- Custom display name / persona
- Avatar/icon customization

**④ Assistant tab**
- AI Assistant on/off toggle
- Auto-complete on/off toggle (suggests completions as you type)
- Context Awareness on/off toggle (allows AI to read your current page context)

**⑤ Shortcuts tab**
Complete keyboard shortcut reference (see Sidebar section above for the full list). Green dot = implemented, grey = coming soon.

**⑥ Tasks tab (task behaviour preferences)**
- **Auto-assign to me** — new tasks you create get assigned to you automatically
- **Due date reminders** — receive notification before a task is due
- **Show completed tasks** — keep completed tasks visible in list view
- **Show Clarity sections by default** — show Objective + Success Criteria fields by default in create dialog

- **Default Visible Sections** — checkboxes for each task section (Needs Attention, My Focus, Current Sprint, Sprint Done, Unscheduled, Upcoming Work, Recently Completed). Up/down arrows to reorder. Saved to localStorage, picked up by the Tasks page.

- **Default Task Filters** — pre-select filter chips that activate by default on the tasks page:
  - Status: todo / in-progress / in-review / done / blocked / backlog
  - Priority: urgent / high / medium / low
  - Assignment: Assigned to Me / Created by Me / Watching / Unassigned
  - Sprint: Current Sprint / Next Sprint / Backlog

**⑦ Notifications tab** — Per-type toggle switches (see Notifications section above).

**⑧ Connectors tab** — Integration management (see Integrations section below).

**⑨ Sessions tab**
- List of active login sessions (device, browser, IP, last seen)
- Revoke any session

**⑩ Billing & Usage tab**
- Current plan
- Usage metrics
- Upgrade / manage subscription (via DodoPayments)

### Workspace Section (tabs for the active Organisation)

**① General tab (`org-general`)**
- Organisation name (editable)
- Organisation logo/avatar (uploadable)
- Invite token display — copy the invite token to share with others so they can join via sidebar Join flow

**② Members tab (`org-members`)**
- List of all members in the org
- Each member: avatar, name, email, role (Owner / Admin / Member)
- Role change dropdown (owner can change others' roles)
- Remove member button

**③ Spaces tab (`org-spaces`)**
- List of all spaces in the org
- Create new space button
- Per space: name, privacy (public/private), member count
- Delete space button (dangerous)

**④ API tab**
- API key display + copy button
- Regenerate API key
- Usage instructions for calling the KeilHQ REST API from external tools

**⑤ Enterprise tab**
- Enterprise-tier feature toggles (SAML SSO, audit log export, advanced RBAC, etc.)

---

## 9. Integrations (Connectors Tab in Settings)

### Active / OAuth Integrations

**Google Suite (single OAuth flow — Google Calendar OAuth unlocks all)**

| Service | What it enables |
|---|---|
| Google Calendar | 2-way sync — tasks with dates become Google Calendar events; GCal events appear in KeilHQ calendar view. "Sync Now" button for manual trigger. |
| Google Mail | Email contacts and task imports from Gmail |
| Google Meet | Auto-generate Meet links on event creation (toggle in CreateTaskDialog) |
| Google Drive | Browse and reference Drive files from chats and tasks |
| Google Docs | Link and preview Docs inline |
| Google Sheets | Link spreadsheet data into task context |
| Google Slides | Embed presentations into events |

**GitHub (OAuth)**
- Connect a GitHub account
- Enables AI agent to: list issues, list PRs, get issue details, list contributors
- `create_github_issue_from_task` — AI can push a KeilHQ task as a GitHub issue
- Status: Connected/Disconnected shown with green dot

**Notion (OAuth or Manual API token)**
- Two connection methods:
  - OAuth button (standard Notion login)
  - Manual token — paste your Notion integration token + workspace ID
- Enables: Import Notion pages into Motion, export Motion pages to Notion, sync content bidirectionally

### Planned / Static Integrations (shown as "coming soon" UI cards)

| Service | Planned purpose |
|---|---|
| Linear | Sync project issues and engineering tasks |
| Jira | Connect Jira boards for enterprise teams |
| Slack | Send notifications and feed updates to Slack channels |
| ChronicleHQ | Create premium presentations using AI |

---

## 10. Onboarding

`OnboardingWizard` — shown to new users before they have an org/space.

Steps:
1. **Welcome** — display name input
2. **Plan selection** — Free / Pro / Enterprise cards
3. **Create first Organisation** — name input, auto-creates a "General" space
4. **Invite team** — paste emails to invite initial members

On completion → navigates to Dashboard with first org+space active.

---

## 11. RBAC — Role Permissions

Roles exist at two levels: Organisation level and Space level.

**Organisation roles:** Owner, Admin, Member

**Space roles:** admin, manager, member

**What roles control:**
- `canEditTask` — manager or admin
- `canAssignTask` — manager or admin
- `canCreateTask` — manager or admin
- Motion page read-only — member role forces read-only on pages not created by them
- Motion page permissions respect `share_permission` for cross-space shared pages

---

## 12. Real-time Infrastructure

All real-time features run on Socket.io.

**Socket events used:**
- `join_org_rooms` — emitted on org join or page load to subscribe to org-scoped events
- `meeting_update` — backend fires when transcription job state changes
- `org_member_joined` — fires when another user joins your org (toast appears)
- Motion page changes — content changes broadcast to all users viewing the same page
- Chat messages — new messages broadcast to all channel members
- Notifications — new notification events pushed to connected user sessions

---

## 13. Feature Cross-Links (Inter-feature Connections)

| From | To | How |
|---|---|---|
| Dashboard AI | Tasks | AI creates/updates/searches tasks on your behalf |
| Dashboard AI | Motion pages | AI reads, creates, and updates pages |
| Dashboard AI | Chat | AI reads channels and can send messages |
| Dashboard AI | Calendar | AI reads events and auto-schedules tasks into free slots |
| Dashboard AI | GitHub | AI lists issues/PRs, creates GitHub issue from KeilHQ task |
| Dashboard AI | Web | AI can search the web via Exa and return results |
| Dashboard Panel | Tasks | "Urgent" count links to tasks page filtered by urgent |
| Dashboard Panel | Events | "Next Event" card links to event detail |
| Dashboard Panel | Chat | "Needs Reply" card links to chat channel |
| Task Activity tab | Members | `@mention` in a comment sends a `mention_in_comment` notification |
| Task Activity tab | Motion | `@mention` a page in a comment creates a context link |
| Task Context section | Motion | Attach Motion pages to a task as reference material |
| Task Context section | GitHub | Attach GitHub issue URL as context |
| Motion page share | Spaces | Sharing a page fires a `motion_shared` notification to target space members |
| Motion page editor | Notion | Export/sync pages with Notion bidirectionally |
| Events | Google Calendar | 2-way sync — creates GCal event, pulls GCal events into KeilHQ |
| Events | Google Meet | Auto-generates Meet link on event with toggle |
| Meetings Studio | Motion | Transcripts can be saved to a Motion page (Notebook button) |
| Meetings Studio | Backend | Audio uploaded to S3, transcription via Sarvam AI or ElevenLabs |
| Chat | Notifications | Every message fires a `someone_messaged` notification to channel members |
| Notifications | Tasks/Chat/Motion | Clicking any notification navigates directly to the source item |
| Settings → Tasks | Task sections | Visible sections + order persisted and rendered in tasks list |
| Settings → Preferences | Dashboard | Time format preference controls Dashboard clock display |
| Settings → Notifications | Notification Context | Per-type toggles filter which events generate notifications |
| Connectors → GitHub | Dashboard AI | GitHub agent becomes available once GitHub is connected |
| Connectors → Notion | Motion | Notion import/export only works when Notion connector is active |

---

## 14. UI Component Inventory

Components that appear across multiple pages:

| Component | Where used |
|---|---|
| `PromptInput` | Dashboard HeroSection, AI assistant panels |
| `Message`, `Conversation`, `ChainOfThought` | Dashboard AI conversation view |
| `Shimmer` | Loading state in AI message stream |
| `WheelPicker` | Dashboard Panel (3D card carousel) |
| `CreateTaskDialog` | Tasks page toolbar, Dashboard Panel QuickCapture, Task detail Edit button |
| `TaskDetailPane` | Tasks page right panel |
| `EventDetailPane` | Calendar view right panel |
| `ActivityTab` | Task detail, Event detail |
| `DependenciesTab` | Task detail |
| `HistoryTab` | Task detail |
| `OverviewTab` | Task detail, Event detail |
| `MotionSidebar` | Motion Home, Motion Page Editor |
| `SimpleEditor` (Tiptap) | Motion Page Editor, Task Description |
| `TaskDescriptionEditor` | CreateTaskDialog, OverviewTab |
| `BulletListEditor` | Task description sub-editor |
| `TaskContextSection` | CreateTaskDialog, OverviewTab |
| `MotionSharePanel` | Motion Page top bar |
| `ChatDrawer` | All pages (slides in from right) |
| `MessageView` | ChatDrawer, ChatDialog |
| `ChannelList` | ChatDrawer |
| `GroupSettingsDialog` | ChatDrawer group channels |
| `NewChatDialog` | ChatDrawer |
| `EmojiPicker` | Chat input, Motion icon picker |
| `NotificationDialog` | Sidebar Bell icon |
| `MeetingDialog` | Global (in Layout, persists across navigation) |
| `SettingsDialog` | Sidebar footer, keyboard shortcut |
| `AppSidebar` | All authenticated pages |
| `HeroSection` | Dashboard |
| `HistorySidebar` | Dashboard (AI conversation history) |
| `DashboardPanel` | Dashboard |
| `OrgManageDialog` | Sidebar footer |
| `OrgSpaceSubmenu` | Sidebar org switcher dropdown |

---

## 15. Demo Video Recommended Flow

1. **Onboarding** — Sign up, create org, invite teammate (30s)
2. **Dashboard** — Show the panel (urgent/replies/queued), ask AI to "create a task called Fix login bug due tomorrow, urgent" — watch chain-of-thought execute live (45s)
3. **Tasks** — Show the task appeared in Needs Attention. Click to open TaskDetailPane. Show all 4 tabs (Overview/Activity/Dependencies/History). Add a comment with `@mention`. (60s)
4. **Calendar** — Switch to calendar view. Show the task. Toggle to create an event, enable Google Meet link, show it appears on Google Calendar. (30s)
5. **Motion** — Navigate to Motion. Create a new page, add a cover, pick an icon, write content using slash commands. Show share to another space. (45s)
6. **Chat** — Open chat drawer (`⌘J`). Show DM and group channel. Send a message. (20s)
7. **Meetings Studio** — Open (`⌘M`). Start a recording, show visualizer styles, stop and transcribe. Show speaker-diarized transcript. (60s)
8. **Notifications** — Click bell. Show categories, click a notification, navigate to task. (15s)
9. **Settings → Connectors** — Show Google Calendar connected (green), GitHub connected, Notion section. (20s)
10. **AI round-trip** — Go back to Dashboard. Ask "search GitHub for open issues in our repo". Watch GitHub agent list issues. Ask AI to "schedule my unscheduled tasks for next week". Watch scheduler agent auto-fill the calendar. (60s)
