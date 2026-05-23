-- =============================================================================
-- Migration: 015_personal_organisation.sql
-- Description: Adds is_personal column to organisations and is_private to spaces.
--              Enforces one personal organisation per user.
--              Updates signup trigger function to auto-create personal org and space.
--              Backfills existing users with a personal organisation, private space,
--              migrated personal tasks, and task assignees.
-- =============================================================================

-- 1. Add is_personal column to public.organisations
ALTER TABLE public.organisations
    ADD COLUMN IF NOT EXISTS is_personal BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Add is_private column to public.spaces
ALTER TABLE public.spaces
    ADD COLUMN IF NOT EXISTS is_private BOOLEAN NOT NULL DEFAULT FALSE;

-- 3. Enforce exactly one active personal organisation per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_organisations_one_personal_per_user
    ON public.organisations(owner_user_id)
    WHERE is_personal = TRUE AND deleted_at IS NULL;

-- 4. Replace handle_new_user trigger function to auto-create personal org and Private space
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
    v_org_id UUID;
    v_space_id UUID;
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

    -- 2. Derive personal organisation name
    v_org_name := COALESCE(
        new.raw_user_meta_data->>'full_name',
        new.raw_user_meta_data->>'name',
        split_part(new.email, '@', 1)
    ) || '''s Org';

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

-- 5. Backfill existing users with a personal organisation, private space, and migrate existing personal tasks
DO $$
DECLARE
    v_user record;
    v_org_id UUID;
    v_space_id UUID;
    v_org_name TEXT;
BEGIN
    FOR v_user IN SELECT id, email, name FROM public.users LOOP
        -- Check if a personal organisation already exists for the user
        SELECT id INTO v_org_id 
        FROM public.organisations 
        WHERE owner_user_id = v_user.id AND is_personal = TRUE AND deleted_at IS NULL
        LIMIT 1;

        IF v_org_id IS NULL THEN
            -- Derive personal organisation name
            v_org_name := COALESCE(v_user.name, split_part(v_user.email, '@', 1)) || '''s Org';

            -- Create the personal organisation
            INSERT INTO public.organisations (name, owner_user_id, is_personal)
            VALUES (v_org_name, v_user.id, TRUE)
            RETURNING id INTO v_org_id;

            -- Create organisation membership as 'owner'
            INSERT INTO public.organisation_members (org_id, user_id, role)
            VALUES (v_org_id, v_user.id, 'owner')
            ON CONFLICT (org_id, user_id) DO NOTHING;

            -- Create the Private space (is_private = TRUE, is_default = TRUE)
            INSERT INTO public.spaces (org_id, name, visibility, created_by, is_default, is_private)
            VALUES (v_org_id, 'Private', 'private', v_user.id, TRUE, TRUE)
            RETURNING id INTO v_space_id;

            -- Create space membership in the Private space as 'admin'
            INSERT INTO public.space_members (org_id, space_id, user_id, role)
            VALUES (v_org_id, v_space_id, v_user.id, 'admin')
            ON CONFLICT (space_id, user_id) DO NOTHING;

            -- Backfill personal tasks into the unified public.tasks table
            INSERT INTO public.tasks (
                id, org_id, space_id, parent_task_id, type, title, description,
                objective, success_criteria, status, priority, start_date, due_date,
                created_by, created_at, updated_at, deleted_at
            )
            SELECT
                pt.id,
                v_org_id,
                v_space_id,
                pt.parent_task_id,
                'task',
                pt.title,
                pt.description,
                pt.objective,
                pt.success_criteria,
                pt.status,
                pt.priority,
                pt.start_date,
                pt.due_date,
                pt.owner_user_id,
                pt.created_at,
                pt.updated_at,
                pt.deleted_at
            FROM public.personal_tasks pt
            WHERE pt.owner_user_id = v_user.id
            ON CONFLICT (id) DO NOTHING;

            -- Backfill assignees so migrated tasks appear under user assignments
            INSERT INTO public.task_assignees (task_id, user_id)
            SELECT pt.id, pt.owner_user_id
            FROM public.personal_tasks pt
            WHERE pt.owner_user_id = v_user.id
            ON CONFLICT (task_id, user_id) DO NOTHING;
            
        END IF;
    END LOOP;
END;
$$;
