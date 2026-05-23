-- =============================================================================
-- Migration: 017_rename_personal_orgs.sql
-- Description: Updates the handle_new_user trigger to name new personal orgs 
--              using the "First Name Workspace" format.
--              Also backfills all existing personal organizations to this new format.
-- =============================================================================

-- 1. Upgrade trigger function handle_new_user to use First Name Workspace format
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
    v_org_id UUID;
    v_space_id UUID;
    v_full_name TEXT;
    v_first_name TEXT;
    v_org_name TEXT;
BEGIN
    -- 1. Insert into public.users
    INSERT INTO public.users (id, email, name)
    VALUES (
        new.id,
        new.email,
        COALESCE(
            new.raw_user_meta_data->>'full_name',
            new.raw_user_meta_data->>'name'
        )
    )
    ON CONFLICT (id) DO NOTHING;

    -- 2. Derive personal organisation name using "First Name Workspace" format
    v_full_name := COALESCE(
        new.raw_user_meta_data->>'full_name',
        new.raw_user_meta_data->>'name',
        split_part(new.email, '@', 1)
    );
    v_first_name := split_part(v_full_name, ' ', 1);
    v_org_name := v_first_name || ' Workspace';

    -- 3. Create the personal organisation (is_personal = TRUE)
    INSERT INTO public.organisations (name, owner_user_id, is_personal)
    VALUES (v_org_name, new.id, TRUE)
    RETURNING id INTO v_org_id;

    -- 4. Create organisation membership as 'owner'
    INSERT INTO public.organisation_members (org_id, user_id, role)
    VALUES (v_org_id, new.id, 'owner');

    -- 5. Create the Private space (is_private = TRUE, is_default = TRUE)
    INSERT INTO public.spaces (org_id, name, visibility, created_by, is_default, is_private)
    VALUES (v_org_id, 'Private', 'private', new.id, TRUE, TRUE)
    RETURNING id INTO v_space_id;

    -- 6. Create space membership in the Private space as 'admin'
    INSERT INTO public.space_members (org_id, space_id, user_id, role)
    VALUES (v_org_id, v_space_id, new.id, 'admin');

    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Backfill existing personal organizations to match the "First Name Workspace" naming scheme
UPDATE public.organisations o
SET name = split_part(COALESCE(u.name, split_part(u.email, '@', 1)), ' ', 1) || ' Workspace'
FROM public.users u
WHERE o.owner_user_id = u.id 
  AND o.is_personal = TRUE 
  AND o.deleted_at IS NULL;
