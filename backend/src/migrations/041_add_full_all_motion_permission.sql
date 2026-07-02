-- =============================================================================
-- Migration: 041_add_full_all_motion_permission.sql
-- Description: Extends the motion_permission enum with 'full_all' value to
--              support the "Full access" sharing option (edit + reshare ability).
-- =============================================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum
        WHERE enumtypid = 'public.motion_permission'::regtype
          AND enumlabel = 'full_all'
    ) THEN
        ALTER TYPE public.motion_permission ADD VALUE 'full_all';
    END IF;
END;
$$;

-- =============================================================================
-- END OF MIGRATION 041
-- =============================================================================
