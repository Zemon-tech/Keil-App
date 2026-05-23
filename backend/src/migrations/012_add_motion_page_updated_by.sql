-- Migration: 012_add_motion_page_updated_by.sql
-- Description: Adds updated_by to motion_pages to track who made the last change

ALTER TABLE public.motion_pages
ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES public.users(id) ON DELETE RESTRICT;

-- Populate existing rows with created_by
UPDATE public.motion_pages
SET updated_by = created_by
WHERE updated_by IS NULL;

-- Make it NOT NULL
ALTER TABLE public.motion_pages
ALTER COLUMN updated_by SET NOT NULL;
