-- =============================================================================
-- Migration: 003_add_soft_delete.sql
-- Description: Adds soft delete support by adding deleted_at columns to
--              tasks, comments, and workspaces tables.
-- =============================================================================

-- Add deleted_at column to tasks table
ALTER TABLE public.tasks
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

COMMENT ON COLUMN public.tasks.deleted_at IS
    'Soft delete timestamp. NULL means active, non-NULL means deleted.';

-- Add deleted_at column to comments table
ALTER TABLE public.comments
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

COMMENT ON COLUMN public.comments.deleted_at IS
    'Soft delete timestamp. NULL means active, non-NULL means deleted.';

-- Add deleted_at column to workspaces table
ALTER TABLE public.workspaces
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

COMMENT ON COLUMN public.workspaces.deleted_at IS
    'Soft delete timestamp. NULL means active, non-NULL means deleted.';

-- Create indexes on deleted_at for performance
-- These indexes help with queries that filter by deleted_at IS NULL
CREATE INDEX IF NOT EXISTS idx_tasks_deleted_at
    ON public.tasks(deleted_at)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_comments_deleted_at
    ON public.comments(deleted_at)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_workspaces_deleted_at
    ON public.workspaces(deleted_at)
    WHERE deleted_at IS NULL;

-- =============================================================================
-- END OF MIGRATION 003
-- =============================================================================
