-- Migration: 005_add_events_support.sql
-- Description: Adds support for Events by extending the tasks table.

-- 1. Create event_type enum
CREATE TYPE event_type AS ENUM (
    'meeting',
    'call',
    'personal',
    'reminder',
    'other'
);

-- 2. Add columns to tasks table
ALTER TABLE public.tasks 
ADD COLUMN type TEXT NOT NULL DEFAULT 'task',
ADD COLUMN event_type event_type,
ADD COLUMN location TEXT,
ADD COLUMN is_all_day BOOLEAN NOT NULL DEFAULT false;

-- 3. Add constraint to ensure event_type is set for events
ALTER TABLE public.tasks
ADD CONSTRAINT task_event_type_check CHECK (
    (type = 'task') OR (type = 'event' AND event_type IS NOT NULL)
);

COMMENT ON COLUMN public.tasks.type IS 'Discriminator: task | event';
COMMENT ON COLUMN public.tasks.event_type IS 'Sub-type for events (meeting, call, etc.)';
COMMENT ON COLUMN public.tasks.location IS 'Zoom link or physical address for events';
COMMENT ON COLUMN public.tasks.is_all_day IS 'Whether the event spans the entire day';
