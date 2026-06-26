-- =============================================================================
-- Migration: 040_task_ai_summaries.sql
-- Description: Creates the task_ai_summaries table for persisting AI-generated
--              activity summaries per task. One summary per task, auto-generated
--              when comments are posted, shared across all assigned users.
--
-- SAFETY: Idempotent — uses IF NOT EXISTS. Safe to re-run.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.task_ai_summaries (
    task_id                 UUID        PRIMARY KEY REFERENCES public.tasks(id) ON DELETE CASCADE,
    summary_text            TEXT        NOT NULL,
    comment_count           INTEGER     NOT NULL DEFAULT 0,
    model_used              TEXT        NOT NULL,
    generated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    generation_count_today  INTEGER     NOT NULL DEFAULT 1,
    last_rate_limit_reset   DATE        NOT NULL DEFAULT CURRENT_DATE
);

CREATE INDEX IF NOT EXISTS idx_task_ai_summaries_generated_at
    ON public.task_ai_summaries(generated_at);

COMMENT ON TABLE public.task_ai_summaries IS 'Persisted AI-generated activity summaries for tasks. One row per task, updated on each comment.';
COMMENT ON COLUMN public.task_ai_summaries.comment_count IS 'Snapshot of total comment count (including replies) at the time of generation.';
COMMENT ON COLUMN public.task_ai_summaries.generation_count_today IS 'Number of times the summary has been generated today. Resets daily. Max 100/day per task.';
COMMENT ON COLUMN public.task_ai_summaries.last_rate_limit_reset IS 'Date when generation_count_today was last reset. Used to detect day boundaries.';
