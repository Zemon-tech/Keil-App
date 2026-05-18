-- =============================================================================
-- Migration: 011_gcal_two_way_sync.sql
-- Description: Extends the Google Calendar integration schema to support
--              full 2-way sync via push notifications (webhooks).
--              Adds watch channel lifecycle tracking, stable iCalUID columns,
--              DB-level uniqueness constraints, and webhook replay protection.
--
-- SAFETY: All changes are additive (ADD COLUMN IF NOT EXISTS, CREATE IF NOT EXISTS).
--         Existing rows, columns, and constraints from migrations 001-010 are
--         untouched. Existing connected users continue working without reconnect.
-- =============================================================================

-- =============================================================================
-- SECTION 1: WATCH STATUS ENUM
-- =============================================================================

-- Tracks the lifecycle state of a user's Google Calendar watch channel.
-- pending  → OAuth tokens saved, watch not yet registered
-- active   → watch registered + initial full sync completed (syncToken stored)
-- degraded → watch registration or renewal failed; recovery cron will retry
-- revoked  → user revoked OAuth access (401/403) or manually disconnected
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_type
        WHERE typname = 'gcal_watch_status'
          AND typnamespace = 'public'::regnamespace
    ) THEN
        CREATE TYPE public.gcal_watch_status AS ENUM ('pending', 'active', 'degraded', 'revoked');
    END IF;
END;
$$;


-- =============================================================================
-- SECTION 2: NEW COLUMNS ON user_integrations
-- =============================================================================

ALTER TABLE public.user_integrations
    ADD COLUMN IF NOT EXISTS watch_status             public.gcal_watch_status DEFAULT 'pending',
    ADD COLUMN IF NOT EXISTS watch_channel_id         TEXT,
    ADD COLUMN IF NOT EXISTS watch_resource_id        TEXT,
    ADD COLUMN IF NOT EXISTS watch_expires_at         TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS gcal_sync_token          TEXT,
    ADD COLUMN IF NOT EXISTS last_sync_at             TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS sync_in_progress         BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS last_sync_error          TEXT,
    ADD COLUMN IF NOT EXISTS last_successful_sync_at  TIMESTAMPTZ;

COMMENT ON COLUMN public.user_integrations.watch_status IS
    'Lifecycle state of the Google Calendar watch channel (pending/active/degraded/revoked).';
COMMENT ON COLUMN public.user_integrations.watch_channel_id IS
    'UUID generated during watch registration. Used to identify which user a webhook notification belongs to.';
COMMENT ON COLUMN public.user_integrations.watch_resource_id IS
    'Returned by Google on events.watch(). Required to stop/unsubscribe the watch channel.';
COMMENT ON COLUMN public.user_integrations.watch_expires_at IS
    'Expiration timestamp of the current watch channel (max 7-day TTL). Must be renewed before expiry.';
COMMENT ON COLUMN public.user_integrations.gcal_sync_token IS
    'Incremental sync state token from Google Calendar API. Used to fetch only changed events.';
COMMENT ON COLUMN public.user_integrations.last_sync_at IS
    'Timestamp of the last webhook-triggered sync attempt. Used for 10-second debounce.';
COMMENT ON COLUMN public.user_integrations.sync_in_progress IS
    'Operational flag indicating an active background sync is running for this user.';
COMMENT ON COLUMN public.user_integrations.last_sync_error IS
    'Error message from the most recent failed sync operation. NULL when last sync succeeded.';
COMMENT ON COLUMN public.user_integrations.last_successful_sync_at IS
    'Timestamp of the last fully completed incremental sync. Used for health monitoring.';

-- Fast lookup by channel_id on every incoming webhook notification
CREATE INDEX IF NOT EXISTS idx_user_integrations_channel_id
    ON public.user_integrations(watch_channel_id)
    WHERE watch_channel_id IS NOT NULL;


-- =============================================================================
-- SECTION 3: STABLE iCalUID COLUMNS
-- =============================================================================

-- iCalUID is stable across calendar moves, ownership transfers, and copy/paste.
-- More reliable than google_event_id for matching events that have been moved.

ALTER TABLE public.personal_tasks
    ADD COLUMN IF NOT EXISTS ical_uid TEXT;

ALTER TABLE public.tasks
    ADD COLUMN IF NOT EXISTS ical_uid TEXT;

COMMENT ON COLUMN public.personal_tasks.ical_uid IS
    'Google Calendar iCalUID — stable across event moves and calendar transfers.';
COMMENT ON COLUMN public.tasks.ical_uid IS
    'Google Calendar iCalUID — stable across event moves and calendar transfers.';

CREATE INDEX IF NOT EXISTS idx_personal_tasks_ical_uid
    ON public.personal_tasks(ical_uid)
    WHERE ical_uid IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_ical_uid
    ON public.tasks(ical_uid)
    WHERE ical_uid IS NOT NULL;


-- =============================================================================
-- SECTION 4: DB-LEVEL UNIQUENESS CONSTRAINTS
-- =============================================================================

-- Prevent duplicate personal tasks for the same Google event under concurrent
-- webhook deliveries or retry storms.
-- NOTE: Only add if no duplicates exist. If this fails, run the precheck query:
--   SELECT owner_user_id, google_event_id, COUNT(*)
--   FROM public.personal_tasks
--   WHERE google_event_id IS NOT NULL
--   GROUP BY 1, 2 HAVING COUNT(*) > 1;
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'uq_personal_tasks_user_google_event'
          AND conrelid = 'public.personal_tasks'::regclass
    ) THEN
        ALTER TABLE public.personal_tasks
            ADD CONSTRAINT uq_personal_tasks_user_google_event
            UNIQUE (owner_user_id, google_event_id);
    END IF;
END;
$$;

-- NOTE: public.tasks uses 'created_by' as the user reference column (NOT 'user_id').
-- This was confirmed from the schema in migration 001_initial_schema.sql.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'uq_tasks_user_google_event'
          AND conrelid = 'public.tasks'::regclass
    ) THEN
        ALTER TABLE public.tasks
            ADD CONSTRAINT uq_tasks_user_google_event
            UNIQUE (created_by, google_event_id);
    END IF;
END;
$$;


-- =============================================================================
-- SECTION 5: WEBHOOK REPLAY PROTECTION TABLE
-- =============================================================================

-- Tracks unique webhook message numbers to prevent replay attacks and
-- duplicate processing of the same Google notification.
-- The UNIQUE constraint on (channel_id, resource_id, message_number) ensures
-- that inserting a duplicate receipt fails with a 23505 error, which the
-- webhook handler catches and treats as an idempotent discard.
CREATE TABLE IF NOT EXISTS public.gcal_webhook_receipts (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id      TEXT        NOT NULL,
    resource_id     TEXT        NOT NULL,
    message_number  BIGINT      NOT NULL,
    received_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_gcal_webhook_receipt UNIQUE (channel_id, resource_id, message_number)
);

COMMENT ON TABLE public.gcal_webhook_receipts IS
    'Tracks processed Google Calendar webhook message numbers to prevent replay attacks and duplicate sync triggers.';
COMMENT ON COLUMN public.gcal_webhook_receipts.channel_id IS
    'X-Goog-Channel-ID header value from the webhook notification.';
COMMENT ON COLUMN public.gcal_webhook_receipts.resource_id IS
    'X-Goog-Resource-ID header value from the webhook notification.';
COMMENT ON COLUMN public.gcal_webhook_receipts.message_number IS
    'X-Goog-Message-Number header value. Monotonically increasing per channel.';

-- Index for fast duplicate checks on webhook arrival
CREATE INDEX IF NOT EXISTS idx_gcal_webhook_receipts_channel_message
    ON public.gcal_webhook_receipts(channel_id, message_number);


-- =============================================================================
-- END OF MIGRATION 011
-- =============================================================================
