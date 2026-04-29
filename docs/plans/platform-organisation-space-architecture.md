# Platform, Organisation, and Space Architecture Spec

## Status

Proposed implementation spec for the next app boundary refactor.

This spec supersedes the older workspace-only model in `docs/plans/workspace-system-plan.md` for future implementation work. The old plan treated personal work as a workspace-owned personal space. The new decision is different: personal work is platform/user-owned and has no organisation context.

## Goal

Refactor Keil from the current single-workspace model into a three-boundary product model:

1. `Platform`
2. `Organisation`
3. `Space`

The platform owns global user identity and personal tasks. Organisations own tenant data, members, billing, and permissions. Spaces are private-by-default collaboration boundaries inside an organisation.

## Current Repo State

The current implementation is built around `workspace`.

Backend:

- `backend/src/migrations/001_initial_schema.sql` defines `workspaces`, `workspace_members`, `tasks.workspace_id`, and `activity_logs.workspace_id`.
- `backend/src/migrations/001_initial_schema.sql` enforces one owned workspace per user with `UNIQUE(owner_id)`.
- `backend/src/migrations/001_initial_schema.sql` enforces one workspace membership per user with `UNIQUE(user_id)` on `workspace_members`.
- `backend/src/migrations/004_chat_schema.sql` scopes `channels` by `workspace_id`.
- `backend/src/middlewares/auth.middleware.ts` authenticates the user and then attaches one implicit `req.workspaceId` from the first workspace membership.
- `backend/src/controllers/task.controller.ts`, `backend/src/services/task.service.ts`, and `backend/src/repositories/task.repository.ts` scope tasks by `workspaceId`.
- `backend/src/controllers/chat.controller.ts` and `backend/src/services/chat.service.ts` scope channels by `workspaceId`.
- `backend/src/controllers/activity.controller.ts` and `backend/src/services/dashboard.service.ts` use `req.workspaceId` for dashboard and activity.

Frontend:

- `frontend/src/contexts/WorkspaceContext.tsx` stores `workspaceId`, `workspaceName`, and `workspaceRole`.
- `frontend/src/hooks/api/useWorkspace.ts` calls `v1/workspaces`.
- `frontend/src/hooks/api/useTasks.ts` calls `v1/tasks` without explicit organisation or space context.
- `frontend/src/hooks/api/useChat.ts` keys chat data by workspace id.
- `frontend/src/hooks/api/useDashboard.ts` keys dashboard data by workspace id.

Primary gap:

The current app has no platform-level personal task model, no organisation abstraction, no spaces, and no explicit active org/space authorization context.

## Target Boundary Model

## Platform

Platform is the outermost shell.

Responsibilities:

- Global user identity.
- Authentication profile.
- Personal tasks.
- User-level preferences.
- User-level integrations later.

Rules:

- A user can create an account without joining any organisation.
- A user with no organisations must still be able to use personal tasks.
- Platform personal data must not be visible to organisation admins.
- Platform personal data must not be deleted when a user leaves an organisation.

## Organisation

Organisation is the primary tenancy boundary.

Responsibilities:

- Members.
- Billing later.
- Organisation roles and permissions.
- Organisation-owned business data.
- Organisation audit logs.
- Organisation-level integrations later.

Rules:

- `org_id` is the primary partition key for organisation-owned data.
- A user can belong to multiple organisations later.
- Current implementation can ship multi-org support later, but the schema and API should not preserve the current one-workspace-per-user constraint.
- Organisation-owned data must never be returned only because a user is authenticated. The backend must validate organisation membership.

## Space

Space is the team or functional unit inside an organisation.

Examples:

- Design
- Development
- Marketing
- Finance
- Operations

Responsibilities:

- Visibility boundary for org work.
- Space-local task lists.
- Space-local chat channels.
- Space-local dashboards and activity feeds.
- Space membership and space roles.

Rules:

- Spaces are private by default.
- A user only sees spaces they belong to.
- Members can be explicitly invited across spaces.
- Organisation tasks must always belong to exactly one space.
- Chat channels must always belong to exactly one space.
- Users can only be assigned to a task if they are members of that task's space.
- Clients and external guests are out of scope for this implementation phase.

## Personal Work Model

Personal work is not an organisation space in the database.

Product language may use `Personal Space`, but backend storage should use platform-level personal tables.

Canonical rule:

```text
Personal Space = UI surface
personal_tasks = platform-level data
spaces = organisation-level collaboration boundaries only
```

Personal tasks:

- Have `owner_user_id`.
- Do not have `org_id`.
- Do not have `space_id`.
- Are visible only to the owning user.
- Are not visible to organisation owners or admins.
- Continue to exist if the user leaves every organisation.

Current-org work view:

- The current release should show assigned organisation tasks from the selected/current organisation.
- Do not aggregate assigned tasks across all organisations yet.
- A later `My Work` surface may combine personal tasks and assigned org tasks, but it must keep source and permission context explicit.

## Canonical Data Model

New or renamed tables:

```text
users
personal_tasks
organisations
organisation_members
spaces
space_members
org_tasks
org_task_assignees
org_task_dependencies
org_comments
org_activity_logs
channels
channel_members
messages
```

Minimum fields:

```text
personal_tasks
- id
- owner_user_id
- parent_task_id nullable, if personal subtasks are supported
- title
- description
- objective
- success_criteria
- status
- priority
- start_date
- due_date
- created_at
- updated_at
- deleted_at
```

```text
organisations
- id
- name
- owner_user_id
- created_at
- updated_at
- deleted_at
```

```text
organisation_members
- id
- org_id
- user_id
- role: owner | admin | member
- created_at
```

```text
spaces
- id
- org_id
- name
- visibility: private
- created_by
- created_at
- updated_at
- deleted_at
```

```text
space_members
- id
- org_id
- space_id
- user_id
- role: owner | admin | member
- created_at
```

```text
org_tasks
- id
- org_id
- space_id
- parent_task_id nullable
- title
- description
- objective
- success_criteria
- status
- priority
- start_date
- due_date
- created_by
- created_at
- updated_at
- deleted_at
```

```text
org_task_assignees
- id
- task_id
- user_id
- assigned_at
```

Chat tables should keep their existing role but become organisation and space scoped:

```text
channels
- id
- org_id
- space_id
- name
- type: direct | group
- created_at
- last_message_at
```

## Required Constraints

Database constraints:

- `organisation_members` must allow one user to belong to multiple organisations.
- `organisation_members` should be unique on `(org_id, user_id)`.
- `spaces` must have `org_id`.
- `space_members` must be unique on `(space_id, user_id)`.
- `space_members.org_id` must match `spaces.org_id`.
- `org_tasks` must have both `org_id` and `space_id`.
- `org_tasks.space_id` must belong to the same `org_id`.
- `org_task_assignees.user_id` must reference a user who is a member of the task's space.
- `personal_tasks` must not have `org_id` or `space_id`.
- Organisation-owned child records should cascade or be soft-deleted consistently with the parent organisation data.

Application constraints:

- Auth middleware must only authenticate and attach `req.user`.
- Auth middleware must not attach a first workspace/org as the current context.
- Organisation context must be explicit on organisation-owned APIs.
- Space context must be explicit on space-owned APIs.
- A user must pass both organisation membership and space membership checks before reading or mutating space-owned resources.
- Personal task APIs must validate `owner_user_id = req.user.id`.
- Organisation admins must not have any backend path to read personal tasks.

## API Context Model

Use explicit context.

Recommended approach:

```text
GET /api/v1/orgs/:orgId/spaces/:spaceId/tasks
POST /api/v1/orgs/:orgId/spaces/:spaceId/tasks
GET /api/v1/orgs/:orgId/spaces/:spaceId/chat/channels
GET /api/v1/orgs/:orgId/spaces/:spaceId/dashboard
GET /api/v1/personal/tasks
POST /api/v1/personal/tasks
```

Avoid hidden context for writes. If a mutation creates or edits organisation-owned data, `orgId` and `spaceId` must be in the route or body and must be validated server-side.

Middleware split:

```text
protect
- verifies Supabase token
- loads public.users row
- attaches req.user

requireOrgMember
- validates req.user is a member of :orgId
- attaches req.orgContext

requireSpaceMember
- validates :spaceId belongs to :orgId
- validates req.user is a member of :spaceId
- attaches req.spaceContext
```

## Backend Implementation Work

1. Rename or introduce organisation concepts.

Do not keep extending `workspace` semantics for new work. Either migrate names from `workspace` to `organisation`, or introduce new org modules and deprecate workspace routes.

Files likely affected:

- `backend/src/migrations/*`
- `backend/src/types/entities.ts`
- `backend/src/types/enums.ts`
- `backend/src/controllers/workspace.controller.ts`
- `backend/src/services/workspace.service.ts`
- `backend/src/repositories/workspace.repository.ts`
- `backend/src/routes/workspace.routes.ts`

2. Add personal task module.

Required backend pieces:

- `personal_tasks` migration.
- Personal task entity and DTO.
- Repository, service, controller, and routes.
- Validation equivalent to current task date/status/priority rules.
- Tests for access isolation.

3. Add spaces.

Required backend pieces:

- `spaces` and `space_members` migration.
- Space repository, service, controller, and routes.
- Default space creation when an organisation is created.
- Explicit member invite/add flow for spaces.

4. Refactor org tasks.

Current `tasks.workspace_id` must become organisation and space scoped.

Required changes:

- Add `org_id` and `space_id`.
- Rename table to `org_tasks` or keep `tasks` only if the codebase explicitly distinguishes personal tasks elsewhere. Preferred: use `org_tasks` for clarity.
- Validate parent tasks are in the same `org_id` and `space_id`.
- Validate dependencies are in the same `org_id` and `space_id`.
- Validate assignees are members of the task's space.
- Move dashboard queries from workspace scope to org+space scope.
- Move activity logs from workspace scope to org+space scope for org data.

5. Refactor chat.

Current chat is workspace scoped.

Required changes:

- Add `org_id` and `space_id` to channels.
- Validate direct and group channel members are members of the same space.
- Fetch channel lists by current `orgId` and `spaceId`.
- Keep socket rooms channel-based, but server authorization must validate channel membership and channel space context.

6. Refactor activity and dashboard.

Required changes:

- Organisation activity logs must include `org_id`.
- Space activity logs should include `space_id` where the event belongs to a space.
- Dashboard reads should be scoped to selected org and selected space.
- Personal task activity, if implemented, must not be written to organisation audit logs.

## Frontend Implementation Work

1. Replace workspace context.

Current `WorkspaceContext` should evolve into an app context that can represent:

- personal mode
- active organisation
- active space
- organisation list
- visible spaces for the active organisation

Recommended context shape:

```text
mode: personal | organisation
activeOrgId: string | null
activeSpaceId: string | null
organisations: Organisation[]
spaces: Space[]
setMode(...)
setActiveOrganisation(...)
setActiveSpace(...)
```

2. Update API hooks.

Required changes:

- Replace `useWorkspace` with organisation/space hooks.
- Add `usePersonalTasks`.
- Make `useTasks` require active org and active space for org tasks.
- Make `useDashboard` require active org and active space.
- Make `useChatChannels` require active org and active space.
- Include org/space identifiers in TanStack Query keys.

3. Update navigation.

Required behavior:

- A user with no organisations lands in personal mode.
- Personal mode is usable without organisation membership.
- The org switcher appears only when the user has organisations.
- Space navigation appears only inside organisation mode.
- Space lists only include spaces the user belongs to.

4. Update task screens.

Required behavior:

- Personal mode creates and lists `personal_tasks`.
- Organisation mode creates and lists `org_tasks` for active org and active space.
- Task detail must know whether the task source is personal or organisation.
- Assignment UI should only show members of the active space.

5. Update chat screens.

Required behavior:

- Chat only appears inside organisation space context.
- Channels are fetched for active org and active space.
- Channel member selection only includes active space members.

## Migration Plan

Phase 1: Schema foundation

- Add `organisations`, `organisation_members`, `spaces`, `space_members`, and `personal_tasks`.
- Remove or bypass constraints that prevent multi-org membership.
- Create a default organisation and default space for existing workspace data.
- Backfill existing workspace tasks into the default organisation and default space.
- Backfill existing channels into the default organisation and default space.

Phase 2: Auth and context

- Change `protect` so it stops attaching implicit `workspaceId`.
- Add `requireOrgMember` and `requireSpaceMember`.
- Convert task, chat, dashboard, and activity routes to explicit org/space context.

Phase 3: Product surfaces

- Add personal task APIs and frontend personal mode.
- Replace workspace context with platform/org/space context.
- Update sidebar, task pages, dashboard, chat, settings, and member selectors.

Phase 4: Cleanup

- Deprecate workspace names in routes, DTOs, services, and UI.
- Remove old one-workspace assumptions.
- Update docs and tests.

## Non-Goals

Not part of this implementation phase:

- Client workspaces.
- External guests.
- Public links.
- Cross-org task aggregation.
- Personal task collaboration.
- Complex custom roles.
- Object-level sharing.
- Billing implementation.
- Enterprise policy engine.

## Acceptance Criteria

Platform and personal tasks:

- A newly registered user with no organisations can use the app in personal mode.
- A user can create, list, update, complete, and delete personal tasks without `org_id`.
- Personal tasks are visible only to their owner.
- Organisation owners and admins cannot access another user's personal tasks.
- Leaving or being removed from an organisation does not delete or orphan personal tasks.

Organisation:

- A user account can exist independently of organisation membership.
- A user can belong to multiple organisations at the data model level.
- Organisation-owned data includes `org_id`.
- API access to organisation-owned data validates organisation membership.
- The backend no longer derives current organisation from the first membership row.

Space:

- Each organisation can contain multiple spaces.
- Spaces are private by default.
- A user only sees spaces where they are a member.
- Space-owned APIs validate both `org_id` and `space_id`.
- Chat channels always belong to a space.
- Organisation tasks always belong to a space.

Tasks:

- Personal tasks and organisation tasks are stored separately or otherwise impossible to confuse by ownership.
- Organisation task creation requires active org and active space context.
- Organisation task assignment only allows users who are members of the task's space.
- Parent tasks and dependencies cannot cross spaces.
- Dashboard queries return tasks only from the active organisation and active space.

Chat:

- Channel lists are scoped to active organisation and active space.
- Direct and group channels can only include active space members.
- Sending a message verifies channel membership.
- Socket behavior does not leak channel events to non-members.

Frontend:

- The old workspace-only context is replaced or wrapped by a platform/org/space context.
- Personal mode works without an organisation.
- Organisation mode requires selected org and selected space.
- Query keys include enough context to prevent cache mixing across personal/org/space surfaces.
- UI does not imply a space switch unless backend requests actually use the selected space.

## Architecture Invariants

These rules should stay true after every future feature:

- User identity is platform-level.
- Personal tasks are user-owned and organisation-independent.
- Organisation is the primary tenancy boundary for business data.
- Space is the visibility boundary inside an organisation.
- Organisation data is never fetched from implicit user membership alone.
- Space-owned data is never fetched without validating space membership.
- Personal data is never visible to organisation admins.
- If a feature creates work inside an organisation, it must decide which space owns that work.

## Open Questions For Later

- Whether personal tasks eventually support collaborators.
- Whether `My Work` should later aggregate assigned tasks across all organisations.
- Whether org-level channels are needed later; current decision is channels live inside spaces only.
- Whether space visibility should expand beyond private to include closed or open modes later.
- Whether task-level sharing is needed after the core org/space model is stable.
