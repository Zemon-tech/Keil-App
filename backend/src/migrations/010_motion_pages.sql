-- =============================================================================
-- Migration: 010_motion_pages.sql
-- Description: Creates motion_pages and motion_page_shares tables for the
--              Motion (Notion-like notes) feature. Pages are scoped to
--              org+space using the same composite FK pattern as tasks.
-- =============================================================================


-- =============================================================================
-- SECTION 1: ENUMS
-- =============================================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_type
        WHERE typname = 'motion_share_type'
          AND typnamespace = 'public'::regnamespace
    ) THEN
        CREATE TYPE public.motion_share_type AS ENUM ('public_link', 'space');
    END IF;
END;
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_type
        WHERE typname = 'motion_permission'
          AND typnamespace = 'public'::regnamespace
    ) THEN
        CREATE TYPE public.motion_permission AS ENUM ('view', 'edit');
    END IF;
END;
$$;


-- =============================================================================
-- SECTION 2: MOTION PAGES
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.motion_pages (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID        NOT NULL,
    space_id        UUID        NOT NULL,
    created_by      UUID        NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,

    -- Self-referencing FK for page hierarchy.
    -- ON DELETE CASCADE: deleting a parent hard-deletes all subpages recursively.
    -- This only fires on hard delete (row removal). Soft delete (deleted_at) does NOT cascade.
    parent_id       UUID        REFERENCES public.motion_pages(id) ON DELETE CASCADE,

    title           TEXT        NOT NULL DEFAULT 'Untitled',

    -- Tiptap JSONContent stored as JSONB for efficient partial reads and indexing
    content         JSONB       NOT NULL DEFAULT '{"type":"doc","content":[{"type":"paragraph"}]}',

    icon            TEXT,
    cover_image     TEXT,

    -- Fractional indexing: float8 allows inserting between any two positions
    -- without rewriting sibling positions. Default 0 for new pages (prepended).
    position        FLOAT8      NOT NULL DEFAULT 0,

    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Soft delete (trash). NULL = active. Non-NULL = in trash.
    deleted_at      TIMESTAMPTZ,

    -- Composite FK to spaces(id, org_id) — same pattern as tasks.
    -- Enforces that a page's space and org are consistent.
    CONSTRAINT motion_pages_space_org_fk
        FOREIGN KEY (space_id, org_id)
        REFERENCES public.spaces(id, org_id)
        ON DELETE CASCADE,

    -- Enforce: parent page must be in the same org+space.
    -- This is enforced at the application layer (service) since SQL cannot
    -- express a conditional composite FK on a self-referencing table cleanly.
    -- The DB-level cascade on parent_id handles hard-delete propagation.

    CONSTRAINT motion_pages_org_fk
        FOREIGN KEY (org_id)
        REFERENCES public.organisations(id)
        ON DELETE CASCADE
);

-- Reconcile partial tables from failed migration attempts
ALTER TABLE public.motion_pages
    ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid(),
    ADD COLUMN IF NOT EXISTS org_id UUID,
    ADD COLUMN IF NOT EXISTS space_id UUID,
    ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.users(id) ON DELETE RESTRICT,
    ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES public.motion_pages(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS title TEXT NOT NULL DEFAULT 'Untitled',
    ADD COLUMN IF NOT EXISTS content JSONB NOT NULL DEFAULT '{"type":"doc","content":[{"type":"paragraph"}]}',
    ADD COLUMN IF NOT EXISTS icon TEXT,
    ADD COLUMN IF NOT EXISTS cover_image TEXT,
    ADD COLUMN IF NOT EXISTS position FLOAT8 NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

COMMENT ON TABLE public.motion_pages IS
    'Notion-like pages scoped to an org+space. Supports hierarchy via parent_id.';
COMMENT ON COLUMN public.motion_pages.content IS
    'Tiptap JSONContent stored as JSONB. Default is an empty paragraph doc.';
COMMENT ON COLUMN public.motion_pages.position IS
    'Fractional index for ordering siblings. Allows insert-between without rewriting all positions.';
COMMENT ON COLUMN public.motion_pages.deleted_at IS
    'Soft delete (trash). NULL = active. Set = in trash. Hard delete removes the row entirely.';

-- Primary query: list all active pages in a space, ordered for sidebar tree
CREATE INDEX IF NOT EXISTS idx_motion_pages_org_space
    ON public.motion_pages(org_id, space_id);

-- Tree traversal: find children of a given parent
CREATE INDEX IF NOT EXISTS idx_motion_pages_parent_id
    ON public.motion_pages(parent_id);

-- Soft-delete filter: partial index for active pages only
CREATE INDEX IF NOT EXISTS idx_motion_pages_active
    ON public.motion_pages(org_id, space_id, position ASC)
    WHERE deleted_at IS NULL;

-- Trash queries
CREATE INDEX IF NOT EXISTS idx_motion_pages_deleted
    ON public.motion_pages(org_id, space_id, deleted_at DESC)
    WHERE deleted_at IS NOT NULL;

-- Auto-update updated_at on every row change
DROP TRIGGER IF EXISTS motion_pages_set_updated_at ON public.motion_pages;
CREATE TRIGGER motion_pages_set_updated_at
    BEFORE UPDATE ON public.motion_pages
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();


-- =============================================================================
-- SECTION 3: MOTION PAGE SHARES
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.motion_page_shares (
    id              UUID                    PRIMARY KEY DEFAULT gen_random_uuid(),
    page_id         UUID                    NOT NULL REFERENCES public.motion_pages(id) ON DELETE CASCADE,

    share_type      public.motion_share_type NOT NULL,

    -- For share_type = 'space': the target org+space that can access this page.
    -- For share_type = 'public_link': both are NULL.
    target_org_id   UUID                    REFERENCES public.organisations(id) ON DELETE CASCADE,
    target_space_id UUID                    REFERENCES public.spaces(id) ON DELETE CASCADE,

    -- For share_type = 'public_link': a cryptographically random 64-char hex token.
    -- For share_type = 'space': NULL.
    share_token     TEXT                    UNIQUE,

    permission      public.motion_permission NOT NULL DEFAULT 'view',

    created_by      UUID                    NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    created_at      TIMESTAMPTZ             NOT NULL DEFAULT NOW(),

    -- Optional expiry for time-limited shares. NULL = never expires.
    expires_at      TIMESTAMPTZ,

    -- Enforce: public_link shares must have a token; space shares must have target org+space
    CONSTRAINT motion_page_shares_public_link_check CHECK (
        (share_type = 'public_link' AND share_token IS NOT NULL AND target_org_id IS NULL AND target_space_id IS NULL)
        OR
        (share_type = 'space' AND share_token IS NULL AND target_org_id IS NOT NULL AND target_space_id IS NOT NULL)
    )
);

-- Reconcile partial tables from failed migration attempts
ALTER TABLE public.motion_page_shares
    ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid(),
    ADD COLUMN IF NOT EXISTS page_id UUID REFERENCES public.motion_pages(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS share_type public.motion_share_type,
    ADD COLUMN IF NOT EXISTS target_org_id UUID REFERENCES public.organisations(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS target_space_id UUID REFERENCES public.spaces(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS share_token TEXT,
    ADD COLUMN IF NOT EXISTS permission public.motion_permission NOT NULL DEFAULT 'view',
    ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.users(id) ON DELETE RESTRICT,
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

COMMENT ON TABLE public.motion_page_shares IS
    'Share grants for motion pages. Supports public link shares and cross-space shares.';
COMMENT ON COLUMN public.motion_page_shares.share_token IS
    'Random 64-char hex token for public link shares. NULL for space shares.';
COMMENT ON COLUMN public.motion_page_shares.expires_at IS
    'Optional expiry timestamp. NULL means the share never expires.';

-- Prevent duplicate space shares for the same page+target combination.
-- Uses a partial unique index (only applies to space-type shares) since
-- UNIQUE NULLS NOT DISTINCT requires PG15 and partial indexes are more portable.
CREATE UNIQUE INDEX IF NOT EXISTS idx_motion_page_shares_unique_space
    ON public.motion_page_shares(page_id, target_org_id, target_space_id)
    WHERE share_type = 'space';

-- Fast public link resolution (the hot path for public page views)
CREATE INDEX IF NOT EXISTS idx_motion_page_shares_token
    ON public.motion_page_shares(share_token)
    WHERE share_token IS NOT NULL;

-- Cross-space share lookup: "what pages are shared into this space?"
CREATE INDEX IF NOT EXISTS idx_motion_page_shares_target_space
    ON public.motion_page_shares(target_org_id, target_space_id)
    WHERE share_type = 'space';

-- All shares for a given page (used in the share management UI)
CREATE INDEX IF NOT EXISTS idx_motion_page_shares_page_id
    ON public.motion_page_shares(page_id);


-- =============================================================================
-- END OF MIGRATION 010
-- =============================================================================
