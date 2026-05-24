-- =============================================================================
-- Migration: 017_motion_analytics.sql
-- Description: Creates motion_page_updates, motion_page_views, and
--              motion_page_view_permissions tables for Updates & Analytics.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.motion_page_updates (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    page_id         UUID        NOT NULL REFERENCES public.motion_pages(id) ON DELETE CASCADE,
    user_id         UUID        REFERENCES public.users(id) ON DELETE SET NULL,
    action_type     TEXT        NOT NULL, -- 'edit', 'rename', 'icon', 'cover', 'create'
    description     TEXT,
    before_title    TEXT,
    before_content  JSONB,
    deleted_content JSONB, -- JSON array of strings
    added_content   JSONB, -- JSON array of strings
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_motion_page_updates_page
    ON public.motion_page_updates(page_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_motion_page_updates_session
    ON public.motion_page_updates(page_id, user_id, action_type, updated_at DESC);


CREATE TABLE IF NOT EXISTS public.motion_page_views (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    page_id         UUID        NOT NULL REFERENCES public.motion_pages(id) ON DELETE CASCADE,
    user_id         UUID        REFERENCES public.users(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_motion_page_views_page_date
    ON public.motion_page_views(page_id, created_at DESC);


CREATE TABLE IF NOT EXISTS public.motion_page_view_permissions (
    page_id             UUID        NOT NULL REFERENCES public.motion_pages(id) ON DELETE CASCADE,
    user_id             UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    allow_view_history  BOOLEAN     NOT NULL DEFAULT FALSE,
    PRIMARY KEY (page_id, user_id)
);
