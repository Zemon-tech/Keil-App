-- backend/src/migrations/007_channel_privacy_extended.sql

-- For safety, if they haven't made privacy an ENUM yet, we can do it, but to avoid type casting issues,
-- we'll just add the new properties.

ALTER TABLE channels
  ADD COLUMN IF NOT EXISTS is_listed BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS allow_history_for_new_members BOOLEAN DEFAULT TRUE;

UPDATE channels SET 
    is_listed = (privacy != 'secret'), 
    allow_history_for_new_members = (privacy != 'secret')
WHERE privacy IS NOT NULL;
