-- =============================================================================
-- Migration: 008_google_calendar_integration.sql
-- Description: Adds user_integrations table for storing OAuth tokens per user
--              per provider, and adds google_event_id to tasks and personal_tasks
--              for linking app tasks to Google Calendar events.
-- =============================================================================

-- =============================================================================
-- SECTION 1: USER INTEGRATIONS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.user_integrations (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    provider        TEXT        NOT NULL,
    access_token    TEXT,
    refresh_token   TEXT        NOT NULL,
    token_expiry    TIMESTAMPTZ,
    calendar_id     TEXT        NOT NULL DEFAULT 'primary',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT user_integrations_unique_user_provider UNIQUE (user_id, provider)
);

COMMENT ON TABLE public.user_integrations IS
    'Stores OAuth tokens for third-party integrations (e.g. google_calendar) per user.';
COMMENT ON COLUMN public.user_integrations.provider IS
    'Integration provider identifier, e.g. ''google_calendar''.';
COMMENT ON COLUMN public.user_integrations.refresh_token IS
    'Long-lived refresh token. Used to obtain new access tokens without user re-auth.';
COMMENT ON COLUMN public.user_integrations.calendar_id IS
    'Google Calendar ID to sync to. Defaults to ''primary''.';

CREATE INDEX IF NOT EXISTS idx_user_integrations_user_id
    ON public.user_integrations(user_id);

CREATE INDEX IF NOT EXISTS idx_user_integrations_user_provider
    ON public.user_integrations(user_id, provider);

-- Auto-update updated_at on row changes
DROP TRIGGER IF EXISTS user_integrations_set_updated_at ON public.user_integrations;
CREATE TRIGGER user_integrations_set_updated_at
    BEFORE UPDATE ON public.user_integrations
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();


-- =============================================================================
-- SECTION 2: ADD google_event_id TO TASKS
-- =============================================================================

ALTER TABLE public.tasks
    ADD COLUMN IF NOT EXISTS google_event_id TEXT;

COMMENT ON COLUMN public.tasks.google_event_id IS
    'Google Calendar event ID linked to this task. NULL if not synced.';


-- =============================================================================
-- SECTION 3: ADD google_event_id TO PERSONAL_TASKS
-- =============================================================================

ALTER TABLE public.personal_tasks
    ADD COLUMN IF NOT EXISTS google_event_id TEXT;

COMMENT ON COLUMN public.personal_tasks.google_event_id IS
    'Google Calendar event ID linked to this personal task. NULL if not synced.';
