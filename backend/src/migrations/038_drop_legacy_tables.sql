-- =============================================================================
-- MIGRATION 038: Drop Legacy Workspace and Task Schedule Tables
-- Description: Drops public.workspaces, public.workspace_members, and
--              public.task_schedules tables, associated triggers/functions,
--              and removes workspace_id references from all other tables.
-- =============================================================================

-- 1. Drop workspace triggers on active tables
DROP TRIGGER IF EXISTS tasks_fill_org_space ON public.tasks CASCADE;
DROP TRIGGER IF EXISTS channels_fill_org_space ON public.channels CASCADE;
DROP TRIGGER IF EXISTS activity_logs_fill_org_space ON public.activity_logs CASCADE;

-- 2. Drop triggers on workspace tables
DROP TRIGGER IF EXISTS workspaces_add_owner_member ON public.workspaces CASCADE;
DROP TRIGGER IF EXISTS workspaces_sync_organisation ON public.workspaces CASCADE;
DROP TRIGGER IF EXISTS workspace_members_sync_org_space ON public.workspace_members CASCADE;

-- 3. Drop legacy functions
DROP FUNCTION IF EXISTS public.add_workspace_owner_as_member() CASCADE;
DROP FUNCTION IF EXISTS public.ensure_workspace_organisation(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.sync_workspace_insert_to_organisation() CASCADE;
DROP FUNCTION IF EXISTS public.sync_workspace_member_to_org_space() CASCADE;
DROP FUNCTION IF EXISTS public.fill_task_org_space_from_workspace() CASCADE;
DROP FUNCTION IF EXISTS public.fill_channel_org_space_from_workspace() CASCADE;
DROP FUNCTION IF EXISTS public.fill_activity_org_space_from_workspace() CASCADE;

-- 4. Drop columns referencing workspaces from active tables
ALTER TABLE public.organisations DROP COLUMN IF EXISTS source_workspace_id CASCADE;
ALTER TABLE public.spaces DROP COLUMN IF EXISTS workspace_id CASCADE, DROP COLUMN IF EXISTS source_workspace_id CASCADE;
ALTER TABLE public.tasks DROP COLUMN IF EXISTS workspace_id CASCADE;
ALTER TABLE public.activity_logs DROP COLUMN IF EXISTS workspace_id CASCADE;
ALTER TABLE public.channels DROP COLUMN IF EXISTS workspace_id CASCADE;
ALTER TABLE public.notifications DROP COLUMN IF EXISTS workspace_id CASCADE;
ALTER TABLE public.notification_outbox DROP COLUMN IF EXISTS workspace_id CASCADE;

-- 5. Drop legacy tables
DROP TABLE IF EXISTS public.workspace_members CASCADE;
DROP TABLE IF EXISTS public.workspaces CASCADE;
DROP TABLE IF EXISTS public.task_schedules CASCADE;
