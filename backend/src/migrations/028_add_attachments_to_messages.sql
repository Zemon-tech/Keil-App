-- Migration: 028_add_attachments_to_messages.sql
-- Description: Add attachments column to public.messages to support secure chat file sharing

ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT NULL;
