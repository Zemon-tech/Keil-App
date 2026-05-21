-- =============================================================================
-- Migration: 016_add_cover_position.sql
-- Description: Adds cover_position column to motion_pages for image repositioning.
--              Stores a vertical position percentage (0–100, default 50 = center).
-- =============================================================================

ALTER TABLE public.motion_pages
  ADD COLUMN IF NOT EXISTS cover_position INTEGER NOT NULL DEFAULT 50;

COMMENT ON COLUMN public.motion_pages.cover_position IS
  'Vertical position of the cover image as a percentage (0 = top, 100 = bottom, 50 = center).';
