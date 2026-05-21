-- =============================================================================
-- Migration: 012_drop_channels_workspace_not_null.sql
-- Description: Removes the NOT NULL constraint on workspace_id for the
--              channels table so that org-native spaces (created directly via
--              the org/space API without a legacy workspace) can create DMs
--              and group channels.
--
--              Existing rows are untouched — channels tied to legacy workspaces
--              keep their workspace_id values. Only org-native channels will
--              have NULL.
--
--              The channels table is now scoped by org_id + space_id (added in
--              005_platform_organisation_space_schema.sql). workspace_id is a
--              legacy compatibility field only.
-- =============================================================================

ALTER TABLE public.channels
    ALTER COLUMN workspace_id DROP NOT NULL;
