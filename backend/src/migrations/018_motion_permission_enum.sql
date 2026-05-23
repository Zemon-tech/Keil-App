-- =============================================================================
-- Migration: 018_motion_permission_enum.sql
-- Description: Extends the motion_permission enum with granular role-based
--              values for view/edit access control (view_all, view_managers,
--              view_admins, edit_all, edit_managers, edit_admins).
-- =============================================================================

-- PostgreSQL requires ALTER TYPE ... ADD VALUE for enum extensions.
-- These are idempotent: adding an existing value in PG 14+ raises an error,
-- so we guard each with a conditional check.

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum
        WHERE enumtypid = 'public.motion_permission'::regtype
          AND enumlabel = 'view_all'
    ) THEN
        ALTER TYPE public.motion_permission ADD VALUE 'view_all';
    END IF;
END;
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum
        WHERE enumtypid = 'public.motion_permission'::regtype
          AND enumlabel = 'view_managers'
    ) THEN
        ALTER TYPE public.motion_permission ADD VALUE 'view_managers';
    END IF;
END;
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum
        WHERE enumtypid = 'public.motion_permission'::regtype
          AND enumlabel = 'view_admins'
    ) THEN
        ALTER TYPE public.motion_permission ADD VALUE 'view_admins';
    END IF;
END;
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum
        WHERE enumtypid = 'public.motion_permission'::regtype
          AND enumlabel = 'edit_all'
    ) THEN
        ALTER TYPE public.motion_permission ADD VALUE 'edit_all';
    END IF;
END;
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum
        WHERE enumtypid = 'public.motion_permission'::regtype
          AND enumlabel = 'edit_managers'
    ) THEN
        ALTER TYPE public.motion_permission ADD VALUE 'edit_managers';
    END IF;
END;
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum
        WHERE enumtypid = 'public.motion_permission'::regtype
          AND enumlabel = 'edit_admins'
    ) THEN
        ALTER TYPE public.motion_permission ADD VALUE 'edit_admins';
    END IF;
END;
$$;

-- =============================================================================
-- END OF MIGRATION 018
-- =============================================================================
