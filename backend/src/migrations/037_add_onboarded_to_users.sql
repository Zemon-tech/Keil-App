-- =============================================================================
-- MIGRATION 037: Add Onboarded Field to Users
-- Description: Adds a boolean flag to track whether users completed onboarding.
-- =============================================================================

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS onboarded BOOLEAN NOT NULL DEFAULT FALSE;
