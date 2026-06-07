-- Migration: 025_set_spaces_created_by_on_delete.sql
-- Description: Drop existing spaces_created_by_fkey and recreate it with ON DELETE SET NULL.

ALTER TABLE public.spaces
    DROP CONSTRAINT IF EXISTS spaces_created_by_fkey;

ALTER TABLE public.spaces
    ADD CONSTRAINT spaces_created_by_fkey
    FOREIGN KEY (created_by)
    REFERENCES public.users(id)
    ON DELETE SET NULL;
