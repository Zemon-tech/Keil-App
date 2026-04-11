-- =============================================================================
-- ClarityOS — MVP v0.5 Module 6 Chat Schema
-- Migration: 004_chat_schema.sql
-- Database: Supabase PostgreSQL
-- Description: Creates tables, RLS policies, and triggers for Real-time Chat
-- =============================================================================

-- =============================================================================
-- SECTION 1: CHANNELS
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.channels (
    id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id    UUID            NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    name            VARCHAR(50),
    type            VARCHAR(20)     NOT NULL CHECK (type IN ('direct', 'group')),
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    last_message_at TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.channels IS 'Stores direct and group chat channels per workspace.';

CREATE INDEX IF NOT EXISTS idx_channels_workspace_id ON public.channels(workspace_id);

-- =============================================================================
-- SECTION 2: CHANNEL MEMBERS
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.channel_members (
    channel_id      UUID            NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
    user_id         UUID            NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    role            VARCHAR(20)     NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
    joined_at       TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    last_read_at    TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT channel_members_pkey PRIMARY KEY (channel_id, user_id)
);

COMMENT ON TABLE public.channel_members IS 'Tracks user membership, role, and unread state within chat channels.';

CREATE INDEX IF NOT EXISTS idx_channel_members_user_id ON public.channel_members(user_id);
CREATE INDEX IF NOT EXISTS idx_channel_members_channel_id ON public.channel_members(channel_id);

-- =============================================================================
-- SECTION 3: MESSAGES
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.messages (
    id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id      UUID            NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
    sender_id       UUID            NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    content         TEXT            NOT NULL,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.messages IS 'Stores text messages sent in channels.';

CREATE INDEX IF NOT EXISTS idx_messages_channel_id ON public.messages(channel_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON public.messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages(created_at DESC);

-- =============================================================================
-- SECTION 4: ROW LEVEL SECURITY (RLS)
-- =============================================================================

ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channel_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Channels: users can only see channels they are a member of
CREATE POLICY "Users can view channels they belong to"
    ON public.channels
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.channel_members cm
            WHERE cm.channel_id = id
            AND cm.user_id = auth.uid()
        )
    );

-- Channel Members: users can only see members of channels they belong to
CREATE POLICY "Users can view members of their channels"
    ON public.channel_members
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.channel_members cm_viewer
            WHERE cm_viewer.channel_id = channel_id
            AND cm_viewer.user_id = auth.uid()
        )
    );

-- Messages: users can only read messages in channels they belong to
CREATE POLICY "Users can view messages of their channels"
    ON public.messages
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.channel_members cm
            WHERE cm.channel_id = channel_id
            AND cm.user_id = auth.uid()
        )
    );

-- Messages: users can only insert messages into channels they belong to
CREATE POLICY "Users can send messages to their channels"
    ON public.messages
    FOR INSERT
    WITH CHECK (
        sender_id = auth.uid() AND
        EXISTS (
            SELECT 1 FROM public.channel_members cm
            WHERE cm.channel_id = channel_id
            AND cm.user_id = auth.uid()
        )
    );

-- =============================================================================
-- SECTION 5: TRIGGERS
-- =============================================================================

-- Auto-update channels.last_message_at when a new message is inserted
CREATE OR REPLACE FUNCTION public.update_channel_last_message_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE public.channels
    SET last_message_at = NEW.created_at
    WHERE id = NEW.channel_id;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_channel_last_message_at ON public.messages;
CREATE TRIGGER trg_update_channel_last_message_at
    AFTER INSERT ON public.messages
    FOR EACH ROW
    EXECUTE FUNCTION public.update_channel_last_message_at();
