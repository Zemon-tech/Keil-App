-- =============================================================================
-- Migration: 019_make_notifications_workspace_nullable.sql
-- Description: Drop NOT NULL constraint on workspace_id for public.notifications
--              and public.notification_outbox tables since org-scoped tasks
--              and spaces can be created without a legacy workspace.
-- =============================================================================

ALTER TABLE public.notifications
    ALTER COLUMN workspace_id DROP NOT NULL;

ALTER TABLE public.notification_outbox
    ALTER COLUMN workspace_id DROP NOT NULL;
