# Platform, Organisation, and Space Refactor

> Source spec: `docs/plans/platform-organisation-space-architecture.md`
> Scope: implementation approved. Proceed phase-wise and stop on unresolved architecture decisions.

## Goal

Replace the current implicit workspace model with explicit platform, organisation, and space boundaries.

Current model:

```text
user -> one workspace -> tasks / chat / dashboard
```

Target model:

```text
platform user -> personal tasks
platform user -> organisations -> spaces -> org tasks / chat / dashboard
```

## Current Constraints

- Current backend derives `req.workspaceId` in `backend/src/middlewares/auth.middleware.ts`.
- Current database enforces one workspace owner per user and one workspace membership per user in `backend/src/migrations/001_initial_schema.sql`.
- Current tasks use `tasks.workspace_id`.
- Current chat uses `channels.workspace_id`.
- Current dashboard and activity read from implicit `req.workspaceId`.
- Current frontend state is `WorkspaceContext`, with `workspaceId` persisted in local storage.
- Current task, chat, dashboard, settings, and member-selection hooks assume workspace context.
- Existing task/chat/dashboard functionality must keep working during the migration.

## Non-Negotiable Architecture Rules

- Auth middleware authenticates user identity only. It must not choose the active organisation or space.
- Personal tasks are platform-owned and must not have `org_id` or `space_id`.
- Organisation data must have `org_id`.
- Space-owned data must have both `org_id` and `space_id`.
- Space APIs must validate organisation membership and space membership.
- Organisation task assignment is limited to users in the task's space.
- Chat channels live inside spaces only.
- Personal data is never visible to organisation owners or admins.
- No client/guest sharing, public links, billing, complex roles, or cross-org task aggregation in this refactor.

## Approval Gates

- [x] Confirm table strategy: introduce new organisation tables and keep old workspace tables temporarily for compatibility.
- [x] Confirm route strategy: add new `/api/v1/orgs/:orgId/spaces/:spaceId/...` routes and keep old workspace routes temporarily.
- [x] Confirm existing data strategy: create one default organisation and one default private space for every existing workspace.
- [x] Confirm product wording: frontend may say `Personal Space`, but backend stores it as `personal_tasks`.
- [x] Confirm implementation starts only after this todo is approved.

## Phase 0 - Baseline And Safety

### Tasks

- [x] Run backend build before changes.
- [x] Run frontend build before changes.
- [ ] Record current working task, dashboard, chat, comments, and invite flows.
- [x] Identify all references to `workspace`, `workspaceId`, `workspace_id`, and `useWorkspace`.
- [x] Decide whether old workspace endpoints stay temporarily as compatibility routes.

### Acceptance Criteria

- [x] Current baseline build status is known.
- [ ] Current behavior that must not regress is listed.
- [x] All workspace-dependent files are mapped before schema work starts.

### Notes

- Backend baseline build passes after dependency install.
- Frontend baseline build fails before refactor work because `frontend/src/components/SchedulePage.tsx` passes `Task` values where `TaskDTO` is required.
- Existing workspace routes stay as compatibility routes during backend and frontend migration.

## Phase 1 - Schema Foundation

### Tasks

- [x] Add migration for `organisations`.
- [x] Add migration for `organisation_members`.
- [x] Add migration for `spaces`.
- [x] Add migration for `space_members`.
- [x] Add migration for `personal_tasks`.
- [x] Add `org_id` and `space_id` to organisation-owned task data.
- [x] Add `org_id` and `space_id` to `channels`.
- [x] Update activity logs to support `org_id` and nullable `space_id` for org-owned activity.
- [x] Remove or replace constraints that enforce one workspace per user.
- [x] Backfill existing workspace data into default organisations and default spaces.

### Constraints

- Existing users, tasks, comments, dependencies, activity logs, channels, messages, and members must remain recoverable.
- `personal_tasks` must not reference organisations.
- Organisation membership must be unique by `(org_id, user_id)`.
- Space membership must be unique by `(space_id, user_id)`.
- Organisation tasks must not be insertable without a valid organisation and space.

### Acceptance Criteria

- [x] Existing workspace data has a deterministic migration path.
- [x] A user can belong to multiple organisations at the schema level.
- [x] An organisation can have multiple private spaces.
- [x] Personal tasks can exist for a user with no organisation.
- [x] Org task records cannot point to a space from another organisation.
- [x] Space member records cannot point to a user outside the organisation.

### Notes

- Implemented in `backend/src/migrations/005_platform_organisation_space_schema.sql`.
- The migration is additive and keeps existing workspace tables/routes usable.
- Compatibility triggers populate `org_id` and `space_id` from `workspace_id` for current task, chat, and activity writes.
- Database migration has not been applied in this session.

## Phase 2 - Backend Context And Modules

### Tasks

- [x] Refactor `protect` to attach only `req.user`.
- [x] Add `requireOrgMember` middleware.
- [x] Add `requireSpaceMember` middleware.
- [x] Add organisation repository, service, controller, and routes.
- [x] Add space repository, service, controller, and routes.
- [x] Add personal task repository, service, controller, and routes.
- [x] Convert org task routes to explicit org and space context.
- [x] Convert comments, assignees, dependencies, and subtasks to validate org and space context.
- [x] Convert dashboard routes to explicit org and space context.
- [x] Convert activity routes to explicit org and optional space context.
- [x] Convert chat routes and services to explicit org and space context.
- [x] Update socket authorization to validate channel membership and avoid cross-space leaks.

### Constraints

- Do not read organisation data from first membership.
- Do not allow task parent or dependency links across spaces.
- Do not allow assignees outside the task's space.
- Do not write personal task events into organisation audit logs.
- Keep response shapes stable where possible, but rename workspace fields to org fields in new APIs.

### Acceptance Criteria

- [ ] `GET /api/v1/personal/tasks` returns only the authenticated user's personal tasks.
- [ ] `POST /api/v1/personal/tasks` works for a user with no organisation.
- [ ] `GET /api/v1/orgs` returns only organisations the user belongs to.
- [ ] `GET /api/v1/orgs/:orgId/spaces` returns only spaces the user belongs to.
- [ ] `GET /api/v1/orgs/:orgId/spaces/:spaceId/tasks` rejects non-members.
- [ ] Org task create/update/delete/status flows work inside the selected space.
- [ ] Org task assignment rejects users outside the selected space.
- [ ] Dashboard only returns tasks from the active org and space.
- [ ] Chat channel lists only include channels from the active org and space.
- [ ] Socket message sending verifies channel membership before saving or broadcasting.

### Notes

- `protect` is now identity-only; legacy workspace routes use `attachWorkspaceContext` as a compatibility middleware.
- New additive backend routes now exist for:
- `GET /api/v1/orgs`
- `GET /api/v1/orgs/:orgId/spaces`
- `GET /api/v1/orgs/:orgId/spaces/:spaceId/members`
- `GET|POST|PATCH|DELETE /api/v1/personal/tasks`
- `GET|POST|PATCH|DELETE /api/v1/orgs/:orgId/spaces/:spaceId/tasks`
- `GET|POST /api/v1/orgs/:orgId/spaces/:spaceId/chat/channels`
- `GET /api/v1/orgs/:orgId/spaces/:spaceId/dashboard`
- `GET /api/v1/orgs/:orgId/spaces/:spaceId/activity`
- New org/space task and comment activity logs now write explicit `org_id` and `space_id`.
- Socket typing events now validate channel membership before broadcasting.
- Manual API verification for the new routes is still pending.

## Phase 3 - Frontend App Context

### Tasks

- [ ] Replace or wrap `WorkspaceContext` with platform/org/space app context.
- [ ] Add `mode: personal | organisation`.
- [ ] Add `activeOrgId`.
- [ ] Add `activeSpaceId`.
- [ ] Add organisation list query hook.
- [ ] Add visible spaces query hook.
- [ ] Add personal task hooks.
- [ ] Update local storage keys away from `keil_active_workspace`.
- [ ] Update query keys to include mode, org id, and space id where relevant.

### Constraints

- A user with no organisations must not be blocked by missing org context.
- Personal mode must not call org-only APIs.
- Organisation mode must not run task/chat/dashboard queries without both org and space.
- Query caches must not mix personal tasks, org tasks, spaces, or organisations.

### Acceptance Criteria

- [ ] New users land in personal mode.
- [ ] Personal task list loads without an organisation.
- [ ] Organisation switcher appears only when organisations exist.
- [ ] Space navigation appears only in organisation mode.
- [ ] Switching organisation clears or recalculates active space.
- [ ] Switching space changes task, dashboard, chat, and member data.

## Phase 4 - Frontend Product Surfaces

### Tasks

- [ ] Update sidebar to show personal mode, organisations, and spaces.
- [ ] Update dashboard to require active org and space.
- [ ] Update task page to support personal task mode and org task mode.
- [ ] Update task detail to track task source: personal or organisation.
- [ ] Update task create dialog to create the correct task type for current mode.
- [ ] Update assignee UI to show active space members only.
- [ ] Update chat UI to appear only inside organisation space mode.
- [ ] Update settings UI to separate account, organisation, and space settings.
- [ ] Update invite/join flows from workspace language to organisation/space language.

### Constraints

- Do not show chat in personal mode.
- Do not show space member controls in personal mode.
- Do not imply a space switch unless backend queries use the selected space.
- Keep existing task statuses, priorities, date validation, dependencies, comments, and dashboard behavior intact.

### Acceptance Criteria

- [ ] Personal mode supports create/list/update/delete/complete personal tasks.
- [ ] Organisation mode supports existing org task workflows inside active space.
- [ ] Chat opens only with active org and space.
- [ ] Member selectors only include active space members.
- [ ] Dashboard reflects active org and active space.
- [ ] Settings clearly separates account, organisation, and space concerns.

## Phase 5 - Compatibility Cleanup

### Tasks

- [ ] Remove or deprecate workspace routes after new routes are fully wired.
- [ ] Remove `req.workspaceId`.
- [ ] Remove workspace-only frontend hooks or replace exports with compatibility wrappers.
- [ ] Remove old local storage workspace keys after migration.
- [ ] Update docs that still describe workspace as the primary boundary.
- [ ] Update tests and manual QA scripts.

### Constraints

- Do not remove compatibility paths until all frontend call sites have moved.
- Do not delete old migrations; add new migrations.
- Keep old production data migration reversible or at least auditable.

### Acceptance Criteria

- [ ] No backend controller depends on `req.workspaceId`.
- [ ] No frontend production path imports `useWorkspace` for org/space context.
- [ ] No org-owned API can run without explicit org/space context where space-owned data is involved.
- [ ] Old workspace terminology is absent from user-facing product surfaces except migration notes.

## Phase 6 - Verification

### Required Checks

- [ ] Backend TypeScript build passes.
- [ ] Frontend TypeScript build passes.
- [ ] Lint passes where configured.
- [ ] Manual sign-up with no organisation lands in personal mode.
- [ ] Manual personal task CRUD works with no organisation.
- [ ] Manual organisation create/join flow works.
- [ ] Manual space create/member flow works.
- [ ] Manual org task CRUD works inside selected space.
- [ ] Manual assignee restriction rejects users outside the space.
- [ ] Manual chat works only inside selected space.
- [ ] Manual dashboard changes when active space changes.

## Files Expected To Change

Backend:

- `backend/src/migrations/*`
- `backend/src/middlewares/auth.middleware.ts`
- `backend/src/types/entities.ts`
- `backend/src/types/enums.ts`
- `backend/src/routes/v1.routes.ts`
- `backend/src/routes/workspace.routes.ts`
- `backend/src/controllers/workspace.controller.ts`
- `backend/src/services/workspace.service.ts`
- `backend/src/repositories/workspace.repository.ts`
- `backend/src/controllers/task.controller.ts`
- `backend/src/services/task.service.ts`
- `backend/src/repositories/task.repository.ts`
- `backend/src/controllers/chat.controller.ts`
- `backend/src/services/chat.service.ts`
- `backend/src/socket.ts`
- `backend/src/controllers/activity.controller.ts`
- `backend/src/services/dashboard.service.ts`
- New organisation, space, and personal-task modules.

Frontend:

- `frontend/src/contexts/WorkspaceContext.tsx`
- `frontend/src/hooks/api/useWorkspace.ts`
- `frontend/src/hooks/api/useTasks.ts`
- `frontend/src/hooks/api/useChat.ts`
- `frontend/src/hooks/api/useDashboard.ts`
- `frontend/src/hooks/api/useActivity.ts`
- `frontend/src/components/AppSidebar.tsx`
- `frontend/src/components/Layout.tsx`
- `frontend/src/components/TasksPage.tsx`
- `frontend/src/components/ChatDialog.tsx`
- `frontend/src/components/SettingsDialog.tsx`
- `frontend/src/components/workspace/*`
- Task detail/list/create components that read `workspace_id`.
- Chat dialogs that read workspace members.
- New organisation, space, and personal-task hooks/components.

## Stop Conditions

- Stop if schema migration cannot preserve existing workspace data.
- Stop if a route change would break current frontend behavior without a compatibility path.
- Stop if personal tasks become accessible from organisation-scoped APIs.
- Stop if task or chat data can be read without validating both org and space membership.
- Stop if implementation requires deciding client/guest sharing behavior.
