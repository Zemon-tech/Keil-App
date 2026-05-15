-- =============================================================================
-- Migration: 009_drop_workspace_not_null.sql
-- Description: Removes the NOT NULL constraint on workspace_id for tasks and
--              activity_logs so that org-native rows (created directly via the
--              org/space API without a legacy workspace) can be inserted.
--
--              Existing rows are untouched — legacy workspace tasks keep their
--              workspace_id values. Only new org-native rows will have NULL.
-- =============================================================================

ALTER TABLE public.tasks
    ALTER COLUMN workspace_id DROP NOT NULL;

ALTER TABLE public.activity_logs
    ALTER COLUMN workspace_id DROP NOT NULL;
