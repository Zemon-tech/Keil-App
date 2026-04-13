-- 006_chat_dependencies.sql

-- Add columns to messages for new features
ALTER TABLE public.messages
    ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES public.messages(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS pinned_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS task_id UUID,
    ADD COLUMN IF NOT EXISTS is_edited BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS reactions JSONB DEFAULT '{}'::jsonb;

-- Create an index to quickly load thread replies
CREATE INDEX IF NOT EXISTS idx_messages_parent_id ON public.messages(parent_id);
