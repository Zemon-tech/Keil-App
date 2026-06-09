-- Add column if not exists
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS avatar_url TEXT DEFAULT NULL;

-- 1. Update handle_new_user to capture Google / OAuth avatar signup info
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
    v_org_id UUID;
    v_space_id UUID;
    v_full_name TEXT;
    v_org_name TEXT;
BEGIN
    -- Insert into public.users with raw OAuth avatar URL if available
    INSERT INTO public.users (id, email, name, avatar_url)
    VALUES (
        new.id,
        new.email,
        COALESCE(
            new.raw_user_meta_data->>'full_name',
            new.raw_user_meta_data->>'name',
            split_part(new.email, '@', 1)
        ),
        COALESCE(
            new.raw_user_meta_data->>'avatar_url',
            new.raw_user_meta_data->>'picture'
        )
    )
    ON CONFLICT (id) DO UPDATE 
    SET avatar_url = COALESCE(public.users.avatar_url, EXCLUDED.avatar_url);

    -- Create default notification preferences
    INSERT INTO public.user_notification_preferences (user_id)
    VALUES (new.id)
    ON CONFLICT (user_id) DO NOTHING;

    -- Create default app preferences
    INSERT INTO public.user_app_preferences (user_id)
    VALUES (new.id)
    ON CONFLICT (user_id) DO NOTHING;

    v_full_name := COALESCE(
        new.raw_user_meta_data->>'full_name',
        new.raw_user_meta_data->>'name',
        split_part(new.email, '@', 1)
    );
    v_org_name := v_full_name || '''s space';

    -- Create personal organisation
    INSERT INTO public.organisations (name, owner_user_id, is_personal)
    VALUES (v_org_name, new.id, TRUE)
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_org_id;

    IF v_org_id IS NOT NULL THEN
        -- Create organisation membership as owner
        INSERT INTO public.organisation_members (org_id, user_id, role)
        VALUES (v_org_id, new.id, 'owner')
        ON CONFLICT DO NOTHING;

        -- Create Private space
        INSERT INTO public.spaces (org_id, name, visibility, created_by, is_default, is_private)
        VALUES (v_org_id, 'Private', 'private', new.id, TRUE, TRUE)
        RETURNING id INTO v_space_id;

        -- Create space membership as admin
        INSERT INTO public.space_members (org_id, space_id, user_id, role)
        VALUES (v_org_id, v_space_id, new.id, 'admin')
        ON CONFLICT DO NOTHING;
    END IF;

    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Create handle_update_user and after update trigger to sync user metadata updates (avatar_url, full_name)
CREATE OR REPLACE FUNCTION public.handle_update_user()
RETURNS trigger AS $$
BEGIN
  UPDATE public.users
  SET 
    name = COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', name),
    avatar_url = COALESCE(
        new.raw_user_meta_data->>'avatar_url',
        new.raw_user_meta_data->>'picture'
    )
  WHERE id = new.id;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;

CREATE TRIGGER on_auth_user_updated
  AFTER UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_update_user();
