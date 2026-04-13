-- backend/src/migrations/005_channel_privacy.sql
-- Adds privacy column to channels for public / private / secret channel types.

ALTER TABLE channels
  ADD COLUMN IF NOT EXISTS privacy VARCHAR(20) NOT NULL DEFAULT 'public'
    CHECK (privacy IN ('public', 'private', 'secret'));

-- Back-fill any existing group channels as public (direct channels stay public too)
UPDATE channels SET privacy = 'public' WHERE privacy IS NULL;

COMMENT ON COLUMN channels.privacy IS
  'public = visible/joinable by all workspace members; '
  'private = invite-only, shown in directory; '
  'secret = hidden from directory, no message history for new members';
