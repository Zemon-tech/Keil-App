-- =============================================================================
-- Migration: 031_add_guests_to_tasks.sql
-- Description: Adds guests column to tasks and personal_tasks tables.
-- SAFETY: All changes are additive (ADD COLUMN IF NOT EXISTS) and safe.
-- =============================================================================

ALTER TABLE public.tasks
    ADD COLUMN IF NOT EXISTS guests TEXT[];

ALTER TABLE public.personal_tasks
    ADD COLUMN IF NOT EXISTS guests TEXT[];

COMMENT ON COLUMN public.tasks.guests IS
    'Array of custom guest email addresses invited to the meet/event.';

COMMENT ON COLUMN public.personal_tasks.guests IS
    'Array of custom guest email addresses invited to the meet/event.';
