-- Migration: 027_spaces_created_by_drop_not_null.sql
-- Description: Drop NOT NULL constraint on spaces.created_by column so ON DELETE SET NULL works.

ALTER TABLE public.spaces 
    ALTER COLUMN created_by DROP NOT NULL;
