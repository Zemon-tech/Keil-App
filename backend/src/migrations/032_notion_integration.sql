-- =============================================================================
-- Migration: 032_notion_integration.sql
-- Description: Makes user_integrations.refresh_token nullable for integrations 
--              like Notion that use permanent tokens. Adds notion_page_id and
--              notion_last_synced_at to public.motion_pages.
-- =============================================================================

-- 1. Make refresh_token nullable
ALTER TABLE public.user_integrations ALTER COLUMN refresh_token DROP NOT NULL;

-- 2. Add Notion mapping fields to motion_pages
ALTER TABLE public.motion_pages
    ADD COLUMN IF NOT EXISTS notion_page_id TEXT,
    ADD COLUMN IF NOT EXISTS notion_last_synced_at TIMESTAMPTZ;

-- 3. Create index for notion_page_id
CREATE INDEX IF NOT EXISTS idx_motion_pages_notion_page_id
    ON public.motion_pages(notion_page_id)
    WHERE notion_page_id IS NOT NULL;
