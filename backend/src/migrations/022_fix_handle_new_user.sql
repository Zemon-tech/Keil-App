-- =============================================================================
-- Migration: 022_fix_handle_new_user.sql
-- Description: Restores the full handle_new_user() trigger that was accidentally
--              stripped down in migration 021. Re-adds personal organisation,
--              private space, and membership creation on signup.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
    v_org_id UUID;
    v_space_id UUID;
    v_full_name TEXT;
    v_org_name TEXT;
BEGIN
    -- 1. Insert into public.users
    INSERT INTO public.users (id, email, name)
    VALUES (
        new.id,
        new.email,
        COALESCE(
            new.raw_user_meta_data->>'full_name',
            new.raw_user_meta_data->>'name',
            split_part(new.email, '@', 1)
        )
    )
    ON CONFLICT (id) DO NOTHING;

    -- 2. Create default notification preferences
    INSERT INTO public.user_notification_preferences (user_id)
    VALUES (new.id)
    ON CONFLICT (user_id) DO NOTHING;

    -- 3. Create default app preferences
    INSERT INTO public.user_app_preferences (user_id)
    VALUES (new.id)
    ON CONFLICT (user_id) DO NOTHING;

    -- 4. Derive personal organisation name using "Full Name's space" format
    v_full_name := COALESCE(
        new.raw_user_meta_data->>'full_name',
        new.raw_user_meta_data->>'name',
        split_part(new.email, '@', 1)
    );
    v_org_name := v_full_name || '''s space';

    -- 5. Create the personal organisation (is_personal = TRUE)
    INSERT INTO public.organisations (name, owner_user_id, is_personal)
    VALUES (v_org_name, new.id, TRUE)
    RETURNING id INTO v_org_id;

    -- 6. Create organisation membership as 'owner'
    INSERT INTO public.organisation_members (org_id, user_id, role)
    VALUES (v_org_id, new.id, 'owner');

    -- 7. Create the Private space (is_private = TRUE, is_default = TRUE)
    INSERT INTO public.spaces (org_id, name, visibility, created_by, is_default, is_private)
    VALUES (v_org_id, 'Private', 'private', new.id, TRUE, TRUE)
    RETURNING id INTO v_space_id;

    -- 8. Create space membership in the Private space as 'admin'
    INSERT INTO public.space_members (org_id, space_id, user_id, role)
    VALUES (v_org_id, v_space_id, new.id, 'admin');

    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
