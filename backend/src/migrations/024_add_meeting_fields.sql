-- =============================================================================
-- Migration: 024_add_meeting_fields.sql
-- Description: Adds location and Google Meet link support to tasks and personal tasks.
-- SAFETY: All changes are additive (ADD COLUMN IF NOT EXISTS) and safe.
-- =============================================================================

-- 1. Add location column to personal_tasks (tasks table already has it)
ALTER TABLE public.personal_tasks
    ADD COLUMN IF NOT EXISTS location TEXT;

COMMENT ON COLUMN public.personal_tasks.location IS
    'Physical location or virtual meeting URL for personal events.';

-- 2. Add meet_link column to both tasks and personal_tasks for direct conference link support
ALTER TABLE public.tasks
    ADD COLUMN IF NOT EXISTS meet_link TEXT;

ALTER TABLE public.personal_tasks
    ADD COLUMN IF NOT EXISTS meet_link TEXT;

COMMENT ON COLUMN public.tasks.meet_link IS
    'Direct Google Meet conference URL generated or extracted from Google Calendar.';

COMMENT ON COLUMN public.personal_tasks.meet_link IS
    'Direct Google Meet conference URL generated or extracted from Google Calendar.';

-- 3. Create indices for querying/matching by meet_link if necessary
CREATE INDEX IF NOT EXISTS idx_tasks_meet_link
    ON public.tasks(meet_link)
    WHERE meet_link IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_personal_tasks_meet_link
    ON public.personal_tasks(meet_link)
    WHERE meet_link IS NOT NULL;
