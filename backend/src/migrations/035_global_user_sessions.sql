-- Migration: 035_global_user_sessions.sql
-- Description: Create user_sessions table to track user devices/browsers and handle remote revocation.

CREATE TABLE IF NOT EXISTS public.user_sessions (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    browser_id  TEXT        NOT NULL,
    user_agent  TEXT,
    platform    TEXT,
    login_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_revoked  BOOLEAN     NOT NULL DEFAULT FALSE,
    
    CONSTRAINT user_sessions_user_browser_unique UNIQUE (user_id, browser_id)
);

-- Index for querying user sessions
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON public.user_sessions(user_id);
