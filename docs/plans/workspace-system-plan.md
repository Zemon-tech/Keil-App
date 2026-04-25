# Workspace System Plan

## Objective

Define the long-term workspace model for KeilHQ so the product can support:

- solo users who need a private place to work
- teams who need shared operational spaces
- future selective sharing of tasks, dashboards, files, and other resources
- future integrations like Google Calendar, Slack, Notion, GitHub, Figma, and others

This document is the canonical plan for how KeilHQ should think about workspace boundaries, permissions, ownership, and scoping across the product.

The goal is not to copy Notion pages. The goal is to adopt the right boundary model for a work operating system that can grow toward ClickUp, Jira, Asana, Slack, and Zoho-style collaboration.

---

## Core Decision

KeilHQ will use the following hierarchy:

1. `Workspace`
   - top-level account or tenant boundary
   - contains users, settings, policies, integrations, billing, and spaces
2. `Space`
   - primary work boundary inside a workspace
   - supports two real types:
     - `personal`
     - `team`
3. `Shared`
   - not a first-class space type in phase 1
   - later becomes a permission-driven view over selectively shared resources

This is the most scalable model for the product.

---

## Why This Model

### Why `workspace` should remain the top-level boundary

A workspace should represent the full account or organization.

It is the correct place for:

- membership in the company or account
- billing and plan limits
- SSO and security policy later
- audit and compliance controls later
- installation of shared integrations
- global search, reporting, and administration

If `workspace` is also used as the actual working boundary for personal and team collaboration, the model becomes hard to scale and hard to reason about.

### Why `space` should be the real work boundary

A space is where work happens.

That means tasks, channels, dashboards, schedules, files, and future modules should all belong to a space.

This gives us:

- private work for individuals
- shared collaboration for teams
- clear switching between contexts
- a clean path to future per-resource sharing

### Why `shared` should come later

Shared access is important, but it should be built as an object-level permission layer, not as a core container from day 1.

Examples:

- share one task with a contractor
- share one dashboard with a client
- share one file bundle with an agency

Those are all resource-sharing problems, not container-design problems.

For phase 1, we should get the account model and space model right first.

---

## Product Principles

The workspace system should follow these rules:

1. Every user has a private place to work.
2. Teams can collaborate in shared spaces without exposing everything to everyone.
3. Every work object belongs to exactly one clear space.
4. Permissions are simple at first and can expand later.
5. Integrations should connect at the right level:
   - workspace level when admin-managed
   - space level when team-scoped
   - user level when personal
6. Shared access to specific resources should be added later without breaking the model.

---

## What This Means For Users

### Solo user

A solo user should experience:

- one workspace
- one personal space created automatically
- private tasks, schedule, notes, and dashboards by default
- the ability to add team spaces later if they invite collaborators

### Small team

A team should experience:

- one workspace for the company
- one personal space for each member
- one or more team spaces for departments, projects, functions, or clients
- clean switching between personal and shared work

### Future external collaborator

Later, an outside person should be able to access only the specific resources shared with them, without becoming a full workspace member unless explicitly invited that way.

---

## Space Types

## Personal Space

Purpose:

- private planning
- personal tasks
- private notes or resources
- individual focus work

Rules:

- exactly one personal space per user per workspace
- private by default
- owned by one user
- should not be joinable by other members in phase 1
- later may allow selective sharing of specific resources that live inside it

Examples:

- founder's planning space
- engineer's personal backlog
- manager's draft notes and follow-ups

## Team Space

Purpose:

- shared execution
- shared communication
- team dashboards
- project coordination

Rules:

- can have many per workspace
- membership-based access
- supports visibility modes:
  - `private`
  - `closed`
  - `open`
- can contain shared tasks, channels, schedules, dashboards, assets, and future modules

Examples:

- Engineering
- Marketing
- Operations
- Client Delivery
- Product Launch 2026

---

## Visibility Modes For Team Spaces

### Private

- only members can see the space
- only members can access its resources
- good for leadership, finance, HR, legal, or sensitive projects

### Closed

- everyone in the workspace can see that the space exists
- only approved members can join and access its resources
- good for most teams

### Open

- any workspace member can find and join the space
- useful for broad knowledge-sharing and low-friction collaboration

Note:

This is different from resource-level sharing. This only controls access to the space itself.

---

## Shared Access Later

`Shared` should become a product view, not a first-class container in phase 1.

Later, the product can introduce:

- `resource_shares`
- `share_links`
- guest access
- public or semi-public dashboards
- client-facing or contractor-facing views

The sidebar can later include a `Shared` section that shows:

- resources shared with me
- resources I shared with others

But phase 1 should not turn `shared` into a new container type.

---

## Scope Of A Space

Every major work object should belong to a space.

Phase 1 should cover at minimum:

- tasks
- task comments
- chat channels
- dashboards and dashboard queries

Phase 2 should expand to:

- schedules and calendar views
- forms and work requests
- project containers
- goals and OKRs
- files and assets

Phase 3 and beyond can include:

- docs and knowledge
- automations
- AI agents
- external sharing

---

## Current Repository State

This plan is based on the current codebase.

### Frontend today

The frontend already implies a broader product than the backend currently supports.

Current notable surfaces:

- auth and protected routing
- workspace switcher UI
- dashboard
- tasks
- task detail, comments, activity, dependencies, schedule, timeline
- chat dialog and chat management
- notification surfaces
- AI assistant UI
- settings sections for connectors, API, members, and enterprise

Key files:

- `frontend/src/contexts/AuthContext.tsx`
- `frontend/src/contexts/WorkspaceContext.tsx`
- `frontend/src/components/AppSidebar.tsx`
- `frontend/src/components/Dashboard.tsx`
- `frontend/src/components/TasksPage.tsx`
- `frontend/src/components/ChatDialog.tsx`
- `frontend/src/components/SettingsDialog.tsx`
- `frontend/src/hooks/api/useWorkspace.ts`
- `frontend/src/hooks/api/useTasks.ts`
- `frontend/src/hooks/api/useChat.ts`

Important limitation:

The frontend currently allows selecting different workspaces in UI state, but the backend does not reliably honor that selection for all core operations.

### Backend today

The backend currently implements:

- workspace CRUD basics
- user bootstrap
- tasks
- comments
- activity
- chat
- socket authentication and channel rooms

Key files:

- `backend/src/middlewares/auth.middleware.ts`
- `backend/src/controllers/workspace.controller.ts`
- `backend/src/controllers/user.controller.ts`
- `backend/src/controllers/task.controller.ts`
- `backend/src/controllers/chat.controller.ts`
- `backend/src/services/workspace.service.ts`
- `backend/src/services/task.service.ts`
- `backend/src/services/chat.service.ts`
- `backend/src/migrations/001_initial_schema.sql`
- `backend/src/migrations/004_chat_schema.sql`

Important limitations:

- the schema currently enforces one workspace owner per user
- the schema currently enforces one workspace membership per user
- auth middleware derives a single `req.workspaceId` by fetching the first membership
- tasks and chat are effectively scoped to that single derived workspace

This means the current backend is still operating under a single-workspace mental model.

---

## Problems This Plan Must Solve

1. A user cannot be limited to one workspace membership forever.
2. A user must always have a personal working area.
3. Teams need collaborative spaces without exposing all work to everyone.
4. The currently selected workspace and space must be explicit in backend authorization, not inferred from first membership.
5. All major product modules must be space-aware.
6. Future integrations must be installable at the right level.
7. Future selective sharing must be possible without redesigning everything again.

---

## Canonical Domain Model

## Workspace

Represents the full company or account boundary.

Suggested responsibilities:

- members
- global admin settings
- integration installation registry
- billing and plan controls later
- security settings later
- global audit later

### Workspace membership

Suggested initial roles:

- `owner`
- `admin`
- `member`

These roles control account-level administration, not day-to-day work inside spaces.

## Space

Represents the actual work boundary.

Suggested fields:

- `id`
- `workspace_id`
- `type` = `personal | team`
- `name`
- `slug` or internal identifier
- `visibility` = `private | closed | open`
- `owner_user_id` nullable for team spaces if needed
- `created_by`
- `created_at`
- `updated_at`
- `deleted_at` optional if soft delete is adopted

### Space membership

Suggested initial roles:

- `owner`
- `admin`
- `member`

These roles control collaboration inside the space.

### Space rule for personal spaces

There must be only one personal space per user per workspace.

This should be enforced at the application level and ideally at the database level as well.

---

## Resource Ownership Model

All work objects should be owned by a space.

### Tasks

Tasks should gain:

- `workspace_id`
- `space_id`

Even if `workspace_id` can be derived through `space_id`, keeping both can simplify indexing and authorization if done carefully.

Tasks should inherit baseline access from the space they belong to.

### Channels

Channels should gain:

- `space_id`

This allows:

- personal channels in personal spaces
- team channels in team spaces
- future restricted channels inside a team space

### Dashboard queries

Dashboards should be scoped by:

- current workspace
- current active space
- optional "all spaces" later

### Future modules

Future modules should follow the same rule:

- if it is work, it belongs to a space

That includes:

- projects
- goals
- forms
- assets
- docs
- automations

---

## Permissions Model

### Phase 1 permissions

Keep permissions intentionally simple.

#### Workspace-level

- owner
- admin
- member

#### Space-level

- owner
- admin
- member

### What permissions should control

#### Workspace-level controls

- invite or remove workspace members
- manage global workspace settings
- manage workspace-wide integrations
- manage billing and security later
- create team spaces if the product allows all members or only admins to do so

#### Space-level controls

- manage members inside the space
- manage resources inside the space
- rename or archive the space
- manage local workflows and settings later

### Not in phase 1

Do not introduce an overly complex role system yet.

Avoid role sets like:

- manager
- editor
- viewer
- analyst
- operator

unless those roles are truly required by current product behavior.

Those can be added later once a capability matrix actually exists.

---

## Active Context Model

This is one of the most important implementation rules.

The app must stop relying on "first workspace membership" as the current context.

Instead:

- the frontend should know:
  - active workspace
  - active space
- the backend should receive and validate:
  - active workspace id
  - active space id when relevant

### Why this matters

Without explicit context:

- task list results will be wrong
- chat channels will bleed across spaces
- dashboard widgets will be inconsistent
- switching in UI will be misleading

### Required behavior

Every space-aware API request must execute against a validated active context.

Possible approaches:

- request header
- query parameter for reads
- body parameter for writes
- middleware that resolves and validates active context based on explicit client input

The exact transport can be decided during implementation, but the principle is fixed:

`current context must be explicit`

---

## Frontend Impact

### Workspace context must evolve into account plus space context

The current frontend context should be refactored so it can hold:

- current workspace
- list of accessible workspaces
- current personal space or team space
- list of spaces inside the current workspace

### Sidebar structure should evolve to

- current workspace switcher
- personal space
- team spaces
- future shared section
- key navigation inside active space:
  - home
  - tasks
  - chat
  - schedule
  - dashboards

### Settings should be split conceptually

#### Account settings

- user profile
- personal preferences
- personal integrations later

#### Workspace settings

- members
- integrations
- API
- enterprise controls

#### Space settings

- space name
- visibility
- space membership
- local defaults later

The existing `SettingsDialog.tsx` already hints at account and workspace grouping. This plan should formalize it.

### Task UI impact

Task pages must become space-aware:

- list tasks from active space
- create tasks in active space
- load detail only if task belongs to active space or authorized broader scope later

### Chat UI impact

Chat pages must become space-aware:

- show channels for active space
- create channels in active space
- later support personal and team channel distinctions clearly

---

## Backend Impact

### Database schema must be redesigned around spaces

Minimum changes:

1. remove current constraints that prevent multiple memberships where needed
2. add `spaces`
3. add `space_members`
4. add `space_id` to core resource tables
5. update authorization logic to validate both workspace and space context

### Auth middleware must change

Current behavior:

- verify Supabase token
- fetch user row
- attach one `req.workspaceId` from first membership

Required behavior:

- verify Supabase token
- attach user
- stop deciding current workspace implicitly
- let downstream middleware validate explicit workspace and space context

### Workspace controller layer must evolve

It should handle:

- listing workspaces the user belongs to
- creating a workspace
- retrieving workspace details
- managing workspace members
- listing spaces inside a workspace

### Space controller layer must be added

It should handle:

- create personal space when needed
- create team space
- list spaces within workspace
- get space details
- update space settings
- archive or delete space if supported
- manage space membership

### Resource controllers must become space-aware

Task, chat, dashboard, and later modules must all validate:

- user is in workspace
- user is allowed in space
- resource belongs to active space

---

## Database Design Guidance

This section is intentionally high signal and repo-specific.

### Existing tables that should remain conceptually

- `users`
- `workspaces`
- `workspace_members`
- `tasks`
- `comments`
- `activity_logs`
- `channels`
- `channel_members`
- `messages`

### New core tables

#### `spaces`

Purpose:

- define personal and team work boundaries

#### `space_members`

Purpose:

- store team-space membership
- optionally allow support for delegated or special access in the future

### Existing tables that need new foreign keys

#### `tasks`

Add:

- `space_id`

#### `channels`

Add:

- `space_id`

#### `activity_logs`

Eventually add:

- `space_id` where useful for efficient activity feeds

### Optional but recommended later

- `user_workspace_preferences`
- `user_space_preferences`

Use cases:

- last visited workspace
- last visited space
- favorite spaces
- pinned spaces

---

## Suggested Rollout Phases

## Phase 1: Foundation

Goal:

Create the correct account and space model.

Must include:

- keep workspace as top-level boundary
- add spaces
- personal and team space types
- visibility settings for team spaces
- explicit active context model

Do not include yet:

- external sharing
- public links
- guests
- deep automation

## Phase 2: Core Product Modules Become Space-Aware

Goal:

Move existing work modules into the new model.

Must include:

- tasks scoped to spaces
- chat scoped to spaces
- dashboard queries scoped to spaces
- settings and navigation updated to reflect active space

## Phase 3: Team Operations

Goal:

Make team collaboration feel complete.

Must include:

- member management by workspace and space
- creation and switching of spaces
- role checks
- visibility modes
- notifications that respect workspace and space boundaries

## Phase 4: Integrations

Goal:

Connect outside systems safely.

Must include:

- workspace-level integration installation
- personal integration settings where needed
- team-space integration targeting where needed
- sync rules that know which space imported data belongs to

Examples:

- Google Calendar events can map to personal or team space schedules
- Slack channels or alerts can route into a specific team space
- GitHub activity can map into engineering spaces

## Phase 5: Shared Resource Layer

Goal:

Enable selective collaboration beyond full membership.

Must include later:

- resource sharing tables
- guest access model
- share links if needed
- `Shared` sidebar section

---

## Integration Strategy Guidance

This workspace model must be compatible with integrations from day 1.

### Workspace-level integrations

Good examples:

- Slack workspace connection
- Google Workspace admin-level setup
- Notion workspace integration
- GitHub organization installation

Why:

These are organizational integrations and usually require admin authorization.

### User-level integrations

Good examples:

- personal Google Calendar
- personal Slack preferences
- personal email account connection

Why:

These affect only one user's experience or availability.

### Space-targeted integration behavior

Even if the integration is installed at workspace level, the resulting sync or automation often needs a space target.

Examples:

- send delivery alerts to Operations space
- sync product incidents into Engineering space
- create calendar-driven tasks inside Client Delivery space

This is why the space model is essential for long-term integration success.

---

## AI and Workspace Context

AI features must respect workspace and space boundaries.

### In personal spaces, AI should help with

- personal planning
- private summaries
- focus recommendations
- private task rewriting and prioritization

### In team spaces, AI should help with

- team summaries
- status reports
- blocker detection
- meeting follow-ups
- work coordination

### Important rule

AI must never freely summarize or surface information across spaces the user cannot access.

This is both a security requirement and a product trust requirement.

---

## Non-Goals For Phase 1

The following are explicitly not part of phase 1:

- full Notion-style page hierarchy
- complex guest collaboration
- public links
- cross-workspace federated organizations
- enterprise-grade policy engines
- object-level ACL for every resource
- marketplace plugin platform

These can come later once the account and space model is stable.

---

## Risks And Failure Modes

### Risk 1: Workspace and space are mixed together in implementation

If implementation continues to use `workspace` as both tenant and collaboration boundary, the model will remain confusing and fragile.

Mitigation:

- keep names and responsibilities strict
- document them clearly in code and APIs

### Risk 2: Current UI switching remains cosmetic

If frontend state changes but backend context remains implicit, users will see the wrong data.

Mitigation:

- make active context explicit in all core APIs

### Risk 3: Integrations attach to the wrong level

If integrations are attached only to users or only to workspaces, the product will struggle to route work cleanly.

Mitigation:

- define install level and target level separately

### Risk 4: Role system becomes too complex too early

If too many roles are introduced before capabilities exist, implementation becomes brittle.

Mitigation:

- start small
- expand only when a real permission matrix exists

---

## Implementation Rules

Anyone implementing this plan should follow these rules:

1. Do not introduce `shared` as a real space type in phase 1.
2. Do not infer current context from first membership.
3. Do not keep tasks and chat only workspace-scoped.
4. Do not overcomplicate roles before needed.
5. Every new work module must decide:
   - what workspace it belongs to
   - what space it belongs to
   - who can access it
6. Integrations must declare:
   - who installs them
   - at what level they are configured
   - which spaces they affect

---

## Recommended Repo Work Breakdown

This is the preferred implementation order for this repository.

### Step 1

Document and lock the domain model.

Deliverables:

- this plan
- follow-up architecture notes if needed

### Step 2

Refactor backend auth and context handling.

Files likely affected:

- `backend/src/middlewares/auth.middleware.ts`
- route-level or new context middleware

### Step 3

Introduce `spaces` and related schema updates.

Files likely affected:

- new migration after `004_chat_schema.sql`
- `backend/src/types/entities.ts`
- `backend/src/types/enums.ts`
- repositories and services

### Step 4

Make tasks and chat space-aware.

Files likely affected:

- task controllers, services, repositories
- chat controllers, services
- socket room logic

### Step 5

Update frontend context and navigation.

Files likely affected:

- `frontend/src/contexts/WorkspaceContext.tsx`
- `frontend/src/components/AppSidebar.tsx`
- `frontend/src/components/Layout.tsx`
- workspace-related hooks and dialogs

### Step 6

Update dashboard, tasks, and chat queries to use active space.

Files likely affected:

- `frontend/src/hooks/api/useDashboard.ts`
- `frontend/src/hooks/api/useTasks.ts`
- `frontend/src/hooks/api/useChat.ts`
- related screens

### Step 7

Add workspace settings and space settings UX.

Files likely affected:

- `frontend/src/components/SettingsDialog.tsx`
- new workspace or space management components

### Step 8

Plan and implement resource sharing later as a separate phase.

---

## Success Criteria

This plan is successful when:

- a user can belong to one workspace and multiple spaces inside it
- every user gets one personal space
- team spaces can be created and managed
- tasks and chat are properly scoped to a space
- switching between spaces changes the actual data returned by the backend
- dashboard results respect active space context
- integrations can be designed cleanly against workspace and space boundaries
- the future `Shared` layer can be added without redesigning the foundation

---

## Final Summary

KeilHQ should be built on:

- `workspace` as the account boundary
- `space` as the real work boundary
- `personal` and `team` as the two phase-1 space types
- `shared` as a later object-level access layer

This is the clearest and most scalable model for a work operating system that wants to support:

- personal productivity
- team collaboration
- AI-assisted execution
- multi-tool integrations
- future external sharing

This model should guide every future implementation decision involving tasks, chat, dashboards, calendars, integrations, AI, and permissions.
