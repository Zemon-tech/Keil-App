-- Migration: 020_meeting_recordings_idx.sql
-- Description: Add targeted B-Tree indexes on meeting_recordings to optimize RLS policy performance, listing services, and DESC sorting.

CREATE INDEX IF NOT EXISTS idx_meeting_recordings_user_id 
ON public.meeting_recordings(user_id);

CREATE INDEX IF NOT EXISTS idx_meeting_recordings_meeting_id 
ON public.meeting_recordings(meeting_id);

CREATE INDEX IF NOT EXISTS idx_meeting_recordings_created_at_desc 
ON public.meeting_recordings(created_at DESC);
