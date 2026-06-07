-- Migration: 026_set_organisations_owner_user_id_on_delete.sql
-- Description: Drop existing organisations_owner_user_id_fkey constraint and recreate it with ON DELETE CASCADE.

ALTER TABLE public.organisations
    DROP CONSTRAINT IF EXISTS organisations_owner_user_id_fkey;

ALTER TABLE public.organisations
    ADD CONSTRAINT organisations_owner_user_id_fkey
    FOREIGN KEY (owner_user_id)
    REFERENCES public.users(id)
    ON DELETE CASCADE;
