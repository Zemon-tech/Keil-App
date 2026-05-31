-- =============================================================================
-- Migration: 023_motion_updates_index.sql
-- Description: Adds an index to motion_page_updates on created_at to 
--              support high-performance activity log retention queries.
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_motion_page_updates_created 
    ON public.motion_page_updates (created_at);

-- Documented SQL query to delete updates older than 90 days efficiently:
-- DELETE FROM public.motion_page_updates WHERE created_at < NOW() - INTERVAL '90 days';
