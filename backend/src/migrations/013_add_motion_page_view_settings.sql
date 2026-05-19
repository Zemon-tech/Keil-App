-- Migration: 013_add_motion_page_view_settings.sql
-- Description: Adds small_text and full_width settings to motion_pages

ALTER TABLE public.motion_pages
ADD COLUMN IF NOT EXISTS small_text BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS full_width BOOLEAN NOT NULL DEFAULT FALSE;
