-- =============================================================================
-- Migration: 033_add_context_to_tasks.sql
-- Description: Adds context column (JSONB) to tasks and personal_tasks tables.
-- =============================================================================

ALTER TABLE public.tasks
    ADD COLUMN IF NOT EXISTS context JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.personal_tasks
    ADD COLUMN IF NOT EXISTS context JSONB NOT NULL DEFAULT '[]'::jsonb;
