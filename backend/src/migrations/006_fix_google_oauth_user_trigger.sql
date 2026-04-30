-- =============================================================================
-- Migration: 006_fix_google_oauth_user_trigger.sql
-- Description: Upgrades the handle_new_user trigger to correctly extract the
--              user's display name from Google OAuth metadata.
--
-- Google OAuth stores the user's name in raw_user_meta_data under the key
-- 'full_name' OR 'name'. The email is always available at the top level.
-- This migration makes the trigger use COALESCE to handle both key names,
-- ensuring both email/password sign-ups and Google OAuth sign-ups populate
-- the public.users table correctly.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (id, email, name)
  VALUES (
    new.id,
    new.email,
    -- Try 'full_name' first (set by email sign-up), then fall back to 'name'
    -- (set by Google OAuth and other social providers)
    COALESCE(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name'
    )
  )
  ON CONFLICT (id) DO NOTHING;
  -- ON CONFLICT DO NOTHING prevents a crash if the trigger fires twice
  -- (e.g. during an identity link scenario)

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
