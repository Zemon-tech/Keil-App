-- backend/src/migrations/004_chat_schema.sql

-- 1. Create channels table
CREATE TABLE IF NOT EXISTS channels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL CHECK (type IN ('direct', 'group')),
    name VARCHAR(50), -- Nullable for standard direct messages
    last_message_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create channel_members table
CREATE TABLE IF NOT EXISTS channel_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) DEFAULT 'member' CHECK (role IN ('admin', 'member')),
    last_read_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(channel_id, user_id)
);

-- 3. Create messages table
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Enable RLS
ALTER TABLE channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE channel_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- 5. Channels Policies
-- A user can see a channel if they are a member of it.
CREATE POLICY "Users can view channels they belong to"
ON channels
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM channel_members
        WHERE channel_members.channel_id = channels.id
        AND channel_members.user_id = auth.uid()
    )
);

-- 6. Channel Members Policies
-- A user can see members of any channel they belong to
CREATE POLICY "Users can view members of their channels"
ON channel_members
FOR SELECT
USING (
    channel_id IN (
        SELECT channel_id FROM channel_members AS cm 
        WHERE cm.user_id = auth.uid()
    )
);

-- 7. Messages Policies
-- A user can see messages if they belong to the channel
CREATE POLICY "Messages are viewable by channel members"
ON messages
FOR SELECT
USING (
    channel_id IN (
        SELECT channel_id FROM channel_members 
        WHERE user_id = auth.uid()
    )
);

-- A user can insert a message if they belong to the channel and are the sender
CREATE POLICY "Messages are insertable by channel members"
ON messages
FOR INSERT
WITH CHECK (
    sender_id = auth.uid() AND
    channel_id IN (
        SELECT channel_id FROM channel_members 
        WHERE user_id = auth.uid()
    )
);

-- 8. Triggers for automations
-- Function to bump the channels.last_message_at timestamp
CREATE OR REPLACE FUNCTION update_channel_last_message_at()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE channels
    SET last_message_at = NEW.created_at
    WHERE id = NEW.channel_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to execute the function on new message insert
DROP TRIGGER IF EXISTS trg_update_channel_last_message_at ON messages;
CREATE TRIGGER trg_update_channel_last_message_at
AFTER INSERT ON messages
FOR EACH ROW
EXECUTE FUNCTION update_channel_last_message_at();
