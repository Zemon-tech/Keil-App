-- =============================================================================
-- Migration: 021_user_app_preferences.sql
-- Description: Creates the user_app_preferences table for storing user-level
--              application settings such as STT provider choice.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.user_app_preferences (
    user_id             UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
    stt_provider        TEXT NOT NULL DEFAULT 'sarvam',  -- 'sarvam' | 'elevenlabs'
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_user_app_preferences_user_id ON public.user_app_preferences(user_id);

-- Add provider column to meeting_recordings to track which provider was used
ALTER TABLE public.meeting_recordings
    ADD COLUMN IF NOT EXISTS stt_provider TEXT NOT NULL DEFAULT 'sarvam';

-- Backfill existing users with default preferences
INSERT INTO public.user_app_preferences (user_id)
SELECT id FROM public.users
ON CONFLICT (user_id) DO NOTHING;

-- Update handle_new_user trigger to also create default app preferences
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
    -- Insert into public.users
    INSERT INTO public.users (id, email, name)
    VALUES (
        new.id,
        new.email,
        COALESCE(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1))
    )
    ON CONFLICT (id) DO NOTHING;

    -- Create default notification preferences
    INSERT INTO public.user_notification_preferences (user_id)
    VALUES (new.id)
    ON CONFLICT (user_id) DO NOTHING;

    -- Create default app preferences
    INSERT INTO public.user_app_preferences (user_id)
    VALUES (new.id)
    ON CONFLICT (user_id) DO NOTHING;

    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
