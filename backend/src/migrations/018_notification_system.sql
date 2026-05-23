-- =============================================================================
-- Migration: 018_notification_system.sql
-- Description: Creates the Notifications, Notification Outbox, and 
--              Notification Preferences tables, triggers, and indices.
-- =============================================================================

-- Drop tables if they exist to prevent schema conflicts from partial/stale runs
DROP TABLE IF EXISTS public.notifications CASCADE;
DROP TABLE IF EXISTS public.notification_outbox CASCADE;
DROP TABLE IF EXISTS public.user_notification_preferences CASCADE;

-- 1. Create user notification preferences table
CREATE TABLE IF NOT EXISTS public.user_notification_preferences (
    user_id                     UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
    notify_task_assigned        BOOLEAN NOT NULL DEFAULT TRUE,
    notify_message              BOOLEAN NOT NULL DEFAULT TRUE,
    notify_motion_shared        BOOLEAN NOT NULL DEFAULT TRUE,
    notify_status_changed       BOOLEAN NOT NULL DEFAULT TRUE,
    notify_membership_updated   BOOLEAN NOT NULL DEFAULT TRUE,
    notify_comment_mention      BOOLEAN NOT NULL DEFAULT TRUE,
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Create actual system notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
    id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id  UUID         NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    org_id        UUID         REFERENCES public.organisations(id) ON DELETE CASCADE,
    space_id      UUID         REFERENCES public.spaces(id) ON DELETE CASCADE,
    recipient_id  UUID         NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    sender_id     UUID         REFERENCES public.users(id) ON DELETE SET NULL,
    
    event_type    TEXT         NOT NULL,
    entity_type   TEXT         NOT NULL,
    entity_id     UUID         NOT NULL,
    
    payload       JSONB        NOT NULL,
    read_at       TIMESTAMPTZ  DEFAULT NULL,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- 3. Create transactional outbox queue table
CREATE TABLE IF NOT EXISTS public.notification_outbox (
    id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id  UUID         NOT NULL,
    org_id        UUID,
    space_id      UUID,
    sender_id     UUID,
    
    event_type    TEXT         NOT NULL,
    entity_type   TEXT         NOT NULL,
    entity_id     UUID         NOT NULL,
    
    payload       JSONB        NOT NULL,
    status        TEXT         NOT NULL DEFAULT 'pending',
    attempts      INTEGER      NOT NULL DEFAULT 0,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- 4. Create performance optimized indexes
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_unread 
    ON public.notifications(recipient_id) WHERE read_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_recipient_created_at 
    ON public.notifications(recipient_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notification_outbox_status 
    ON public.notification_outbox(status);

-- 5. Backfill existing users with default notification preferences
INSERT INTO public.user_notification_preferences (user_id)
SELECT id FROM public.users
ON CONFLICT (user_id) DO NOTHING;

-- 6. Upgrade handle_new_user trigger to also write default preferences
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

    -- Create default notification preferences immediately
    INSERT INTO public.user_notification_preferences (user_id)
    VALUES (new.id)
    ON CONFLICT (user_id) DO NOTHING;

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
