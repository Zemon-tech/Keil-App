-- Migration: 014_rbac_roles.sql
-- Description: Add manager to member_role enum, migrate space owner->admin, add is_default to spaces

-- 1. Add 'manager' to member_role enum
ALTER TYPE public.member_role ADD VALUE IF NOT EXISTS 'manager';

-- 2. Migrate space owner -> admin in space_members (space-level owner is abolished)
UPDATE public.space_members SET role = 'admin' WHERE role = 'owner';

-- 3. Add is_default boolean column to spaces
ALTER TABLE public.spaces ADD COLUMN IF NOT EXISTS is_default BOOLEAN NOT NULL DEFAULT FALSE;

-- Mark the oldest active space per org as default
UPDATE public.spaces s
SET is_default = TRUE
FROM (
  SELECT DISTINCT ON (org_id) id
  FROM public.spaces
  WHERE deleted_at IS NULL
  ORDER BY org_id, created_at ASC
) first_space
WHERE s.id = first_space.id;

-- Enforce one default per org with a partial unique index
CREATE UNIQUE INDEX IF NOT EXISTS idx_spaces_one_default_per_org
  ON public.spaces(org_id)
  WHERE is_default = TRUE AND deleted_at IS NULL;
