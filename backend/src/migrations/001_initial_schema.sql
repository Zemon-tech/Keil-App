-- =============================================================================
-- ClarityOS — MVP v0.5 Initial Schema
-- Migration: 001_initial_schema.sql
-- Database: Supabase PostgreSQL
-- Description: Creates all core tables for Workspaces, Tasks,
--              Assignees, Dependencies, Comments, and Activity Logs.
-- =============================================================================

-- =============================================================================
-- SECTION 1: ENUMS
-- =============================================================================

-- Task workflow status (matches MVP v0.5 spec exactly)
CREATE TYPE task_status AS ENUM (
    'backlog',
    'todo',
    'in-progress',
    'done'
);

-- Task urgency level
CREATE TYPE task_priority AS ENUM (
    'low',
    'medium',
    'high',
    'urgent'
);

-- Workspace member permission levels
-- owner  → workspace creator, cannot be removed, full control
-- admin  → can manage members, tasks, and settings
-- member → standard contributor
CREATE TYPE member_role AS ENUM (
    'owner',
    'admin',
    'member'
);

-- Entities that can be tracked in the activity log
-- Scoped to MVP v0.5 entities only
CREATE TYPE log_entity_type AS ENUM (
    'task',
    'comment',
    'workspace'
);

-- All auditable action types for the activity feed
CREATE TYPE log_action_type AS ENUM (
    'task_created',
    'task_deleted',
    'status_changed',
    'priority_changed',
    'assignment_added',
    'assignment_removed',
    'due_date_changed',
    'start_date_changed',
    'dependency_added',
    'dependency_removed',
    'comment_created',
    'comment_deleted',
    'objective_updated',
    'success_criteria_updated',
    'title_updated',
    'description_updated'
);


-- =============================================================================
-- SECTION 2: PUBLIC USERS TABLE
-- =============================================================================

-- Shadow / profile table that mirrors auth.users from Supabase.
-- Populated automatically on user sign-up via a Supabase Auth trigger.
-- All other tables reference this table's id (which equals auth.users.id).
CREATE TABLE IF NOT EXISTS public.users (
    id          UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email       TEXT        NOT NULL UNIQUE,
    name        TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.users IS
    'Public profile mirror of auth.users. Populated on first sign-in.';


-- =============================================================================
-- SECTION 3: WORKSPACES
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.workspaces (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT        NOT NULL,
    owner_id    UUID        NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Enforce: one workspace per user (they are the owner)
    CONSTRAINT workspaces_owner_unique UNIQUE (owner_id)
);

COMMENT ON TABLE public.workspaces IS
    'Each user may own exactly one workspace (enforced by UNIQUE on owner_id).';
COMMENT ON COLUMN public.workspaces.owner_id IS
    'The user who created and owns this workspace. Cannot be changed.';


-- =============================================================================
-- SECTION 4: WORKSPACE MEMBERS
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.workspace_members (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id    UUID        NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    user_id         UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    role            member_role NOT NULL DEFAULT 'member',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Enforce: a user can only be part of ONE workspace total (across all roles)
    CONSTRAINT workspace_members_unique_user UNIQUE (user_id)
);

COMMENT ON TABLE public.workspace_members IS
    'Join table linking users to workspaces with a role. The owner is also inserted here as ''owner''.';
COMMENT ON COLUMN public.workspace_members.role IS
    'owner | admin | member — controls permission level within the workspace.';

-- Useful for listing all workspaces a user belongs to
CREATE INDEX IF NOT EXISTS idx_workspace_members_user_id
    ON public.workspace_members(user_id);

CREATE INDEX IF NOT EXISTS idx_workspace_members_workspace_id
    ON public.workspace_members(workspace_id);


-- =============================================================================
-- SECTION 5: TASKS
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.tasks (
    id                  UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id        UUID            NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,

    -- Self-referencing FK for parent–child task hierarchy (subtasks)
    -- ON DELETE CASCADE: deleting a parent auto-deletes all child tasks
    parent_task_id      UUID            REFERENCES public.tasks(id) ON DELETE CASCADE,

    title               TEXT            NOT NULL,
    description         TEXT,

    -- Why this task exists and what done looks like (from the ClarityOS brief)
    objective           TEXT,
    success_criteria    TEXT,

    status              task_status     NOT NULL DEFAULT 'backlog',
    priority            task_priority   NOT NULL DEFAULT 'medium',

    start_date          TIMESTAMPTZ,
    due_date            TIMESTAMPTZ,

    created_by          UUID            NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,

    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    -- Strict date validation: due_date must be on or after start_date when both are provided
    CONSTRAINT task_date_order CHECK (
        due_date IS NULL OR start_date IS NULL OR due_date >= start_date
    )
);

COMMENT ON TABLE public.tasks IS
    'Core work unit. Supports flat tasks, parent-child hierarchies (subtasks), and full lifecycle tracking.';
COMMENT ON COLUMN public.tasks.parent_task_id IS
    'NULL for top-level tasks; set to parent task id for subtasks.';
COMMENT ON COLUMN public.tasks.objective IS
    'Why this task exists — the outcome it drives. From ClarityOS task model.';
COMMENT ON COLUMN public.tasks.success_criteria IS
    'What done looks like. Specific, measurable criteria for completion.';
COMMENT ON COLUMN public.tasks.created_by IS
    'The user who created this task. Cannot be deleted while tasks exist.';

-- Indexes for frequent filter/sort operations (per MVP v0.5 spec)
CREATE INDEX IF NOT EXISTS idx_tasks_workspace_id       ON public.tasks(workspace_id);
CREATE INDEX IF NOT EXISTS idx_tasks_parent_task_id     ON public.tasks(parent_task_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status             ON public.tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_priority           ON public.tasks(priority);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date           ON public.tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_created_at         ON public.tasks(created_at);
CREATE INDEX IF NOT EXISTS idx_tasks_created_by         ON public.tasks(created_by);

-- Composite index for the most common dashboard query: workspace + status + priority
CREATE INDEX IF NOT EXISTS idx_tasks_workspace_status_priority
    ON public.tasks(workspace_id, status, priority);


-- =============================================================================
-- SECTION 6: TASK ASSIGNEES
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.task_assignees (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id     UUID        NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    user_id     UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- A user can only be assigned to the same task once
    CONSTRAINT task_assignees_unique UNIQUE (task_id, user_id)
);

COMMENT ON TABLE public.task_assignees IS
    'Many-to-many: a task can have multiple assignees; a user can be assigned to many tasks.';

CREATE INDEX IF NOT EXISTS idx_task_assignees_task_id   ON public.task_assignees(task_id);
CREATE INDEX IF NOT EXISTS idx_task_assignees_user_id   ON public.task_assignees(user_id);


-- =============================================================================
-- SECTION 7: TASK DEPENDENCIES
-- =============================================================================

-- A dependency row means: task_id CANNOT be done until depends_on_task_id is done.
-- ON DELETE CASCADE on both sides ensures no orphan dependency records remain
-- when either task is deleted (satisfies the MVP auto-clean requirement).
CREATE TABLE IF NOT EXISTS public.task_dependencies (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id             UUID        NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    depends_on_task_id  UUID        NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Prevent duplicate dependency pairs
    CONSTRAINT task_dependencies_unique UNIQUE (task_id, depends_on_task_id),

    -- Prevent a task from depending on itself
    CONSTRAINT task_dependencies_no_self_ref CHECK (task_id <> depends_on_task_id)
);

COMMENT ON TABLE public.task_dependencies IS
    'Blocking dependencies between tasks. task_id is blocked until depends_on_task_id reaches ''done''.';
COMMENT ON COLUMN public.task_dependencies.task_id IS
    'The task that is blocked.';
COMMENT ON COLUMN public.task_dependencies.depends_on_task_id IS
    'The task that must be completed first.';

CREATE INDEX IF NOT EXISTS idx_task_dependencies_task_id
    ON public.task_dependencies(task_id);
CREATE INDEX IF NOT EXISTS idx_task_dependencies_depends_on
    ON public.task_dependencies(depends_on_task_id);


-- =============================================================================
-- SECTION 8: COMMENTS (THREADED)
-- =============================================================================

-- Self-referencing for nested reply threads.
-- Hard deleting a parent comment cascades and removes all its replies.
CREATE TABLE IF NOT EXISTS public.comments (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id             UUID        NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    user_id             UUID        NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    content             TEXT        NOT NULL,

    -- NULL = top-level comment; set = a reply to another comment (one level nesting in MVP)
    parent_comment_id   UUID        REFERENCES public.comments(id) ON DELETE CASCADE,

    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.comments IS
    'Threaded comments on tasks. parent_comment_id = NULL for top-level; set for replies. Cascade deletes clear all replies when parent is removed.';
COMMENT ON COLUMN public.comments.parent_comment_id IS
    'If set, this comment is a reply. ON DELETE CASCADE ensures replies are removed with the parent.';

CREATE INDEX IF NOT EXISTS idx_comments_task_id             ON public.comments(task_id);
CREATE INDEX IF NOT EXISTS idx_comments_parent_comment_id   ON public.comments(parent_comment_id);
CREATE INDEX IF NOT EXISTS idx_comments_user_id             ON public.comments(user_id);
-- For paginated feed ordered by time
CREATE INDEX IF NOT EXISTS idx_comments_task_created        ON public.comments(task_id, created_at DESC);


-- =============================================================================
-- SECTION 9: ACTIVITY LOGS
-- =============================================================================

-- Append-only audit trail. Never update or delete rows here.
-- old_value / new_value store JSON snapshots of the changed field only
-- (e.g., {"status": "todo"} → {"status": "in-progress"}).
CREATE TABLE IF NOT EXISTS public.activity_logs (
    id              UUID                PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id    UUID                NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    user_id         UUID                REFERENCES public.users(id) ON DELETE SET NULL, -- NULL if user deleted
    entity_type     log_entity_type     NOT NULL,
    entity_id       UUID                NOT NULL,   -- id of the affected task/comment/workspace
    action_type     log_action_type     NOT NULL,
    old_value       JSONB,                          -- snapshot before the change
    new_value       JSONB,                          -- snapshot after the change
    created_at      TIMESTAMPTZ         NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.activity_logs IS
    'Append-only audit trail for all tracked events in the workspace. Never mutate rows.';
COMMENT ON COLUMN public.activity_logs.entity_id IS
    'UUID of the affected entity (task, comment, or workspace). Not a FK to allow logging deleted entities.';
COMMENT ON COLUMN public.activity_logs.old_value IS
    'JSONB snapshot of the field value before the change. NULL for creation events.';
COMMENT ON COLUMN public.activity_logs.new_value IS
    'JSONB snapshot of the field value after the change. NULL for deletion events.';

-- Indexes for the paginated activity feed queries
CREATE INDEX IF NOT EXISTS idx_activity_logs_workspace_id   ON public.activity_logs(workspace_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_entity         ON public.activity_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id        ON public.activity_logs(user_id);
-- Primary sort order for the feed
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at     ON public.activity_logs(workspace_id, created_at DESC);


-- =============================================================================
-- SECTION 10: TRIGGERS
-- =============================================================================

-- ─── 10a. Auto-update updated_at on tasks ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

CREATE TRIGGER tasks_set_updated_at
    BEFORE UPDATE ON public.tasks
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();


-- ─── 10b. Auto-insert workspace owner as 'owner' member ──────────────────────
-- When a workspace is created, the owner is automatically added to
-- workspace_members with role 'owner' so all member queries stay consistent.
CREATE OR REPLACE FUNCTION public.add_workspace_owner_as_member()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO public.workspace_members (workspace_id, user_id, role)
    VALUES (NEW.id, NEW.owner_id, 'owner');
    RETURN NEW;
END;
$$;

CREATE TRIGGER workspaces_add_owner_member
    AFTER INSERT ON public.workspaces
    FOR EACH ROW
    EXECUTE FUNCTION public.add_workspace_owner_as_member();


-- =============================================================================
-- END OF MIGRATION 001
-- =============================================================================
