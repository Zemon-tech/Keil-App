-- =============================================================================
-- Migration: 025_add_github_fields.sql
-- Description: Adds github_issue_url, github_issue_number, and github_repo to
--              tasks and personal_tasks tables for linking tasks to GitHub issues.
-- =============================================================================

-- =============================================================================
-- SECTION 1: ALTER TASKS TABLE
-- =============================================================================

ALTER TABLE public.tasks
    ADD COLUMN IF NOT EXISTS github_issue_url TEXT,
    ADD COLUMN IF NOT EXISTS github_issue_number INTEGER,
    ADD COLUMN IF NOT EXISTS github_repo TEXT;

COMMENT ON COLUMN public.tasks.github_issue_url IS
    'URL of the linked GitHub issue. NULL if not linked.';
COMMENT ON COLUMN public.tasks.github_issue_number IS
    'Number of the linked GitHub issue. NULL if not linked.';
COMMENT ON COLUMN public.tasks.github_repo IS
    'Full repository name of the linked GitHub issue (e.g. ''owner/repo'').';

-- =============================================================================
-- SECTION 2: ALTER PERSONAL_TASKS TABLE
-- =============================================================================

ALTER TABLE public.personal_tasks
    ADD COLUMN IF NOT EXISTS github_issue_url TEXT,
    ADD COLUMN IF NOT EXISTS github_issue_number INTEGER,
    ADD COLUMN IF NOT EXISTS github_repo TEXT;

COMMENT ON COLUMN public.personal_tasks.github_issue_url IS
    'URL of the linked GitHub issue. NULL if not linked.';
COMMENT ON COLUMN public.personal_tasks.github_issue_number IS
    'Number of the linked GitHub issue. NULL if not linked.';
COMMENT ON COLUMN public.personal_tasks.github_repo IS
    'Full repository name of the linked GitHub issue (e.g. ''owner/repo'').';
