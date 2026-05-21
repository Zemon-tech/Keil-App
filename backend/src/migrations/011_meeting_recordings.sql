-- Migration: 011_meeting_recordings.sql
-- Description: Create meeting_recordings table and configure row level security

CREATE TABLE IF NOT EXISTS public.meeting_recordings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  meeting_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE,
  audio_s3_key TEXT NOT NULL,
  audio_duration_seconds INT,
  sarvam_job_id TEXT,
  transcription_status TEXT NOT NULL DEFAULT 'pending', -- pending | processing | completed | failed
  transcript_text TEXT,
  transcript_diarized JSONB,
  language_detected TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS: users can only see their own recordings
ALTER TABLE public.meeting_recordings ENABLE ROW LEVEL SECURITY;

-- Policy to allow users to perform all operations on their own recordings
CREATE POLICY "Users see own recordings" ON public.meeting_recordings
  FOR ALL USING (auth.uid() = user_id);
