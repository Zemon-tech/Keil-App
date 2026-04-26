-- Migration: 006_relax_event_type_constraint.sql
-- Description: Changes event_type from ENUM to TEXT to allow custom types from the UI.

ALTER TABLE public.tasks 
ALTER COLUMN event_type TYPE TEXT;

-- We don't drop the enum type 'event_type' as it might be used elsewhere, 
-- but the column 'event_type' in 'tasks' no longer enforces it.
