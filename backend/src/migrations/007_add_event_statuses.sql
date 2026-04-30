-- Migration: 007_add_event_statuses.sql
-- Description: Adds event-specific statuses to the task_status enum and migrates existing events.

-- 1. Add new values to task_status enum
-- PostgreSQL requires ADD VALUE to be run outside a transaction block if used in a function,
-- but standard ALTER TYPE ADD VALUE is safe here.
ALTER TYPE public.task_status ADD VALUE IF NOT EXISTS 'confirmed';
ALTER TYPE public.task_status ADD VALUE IF NOT EXISTS 'tentative';
ALTER TYPE public.task_status ADD VALUE IF NOT EXISTS 'cancelled';
ALTER TYPE public.task_status ADD VALUE IF NOT EXISTS 'completed';

-- 2. Migrate existing events
-- Any existing events with task statuses should be converted.
UPDATE public.tasks 
SET status = 'confirmed' 
WHERE type = 'event' AND status IN ('backlog', 'todo', 'in-progress');

UPDATE public.tasks 
SET status = 'completed' 
WHERE type = 'event' AND status = 'done';
