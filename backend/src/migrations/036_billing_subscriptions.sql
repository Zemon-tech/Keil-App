-- =============================================================================
-- MIGRATION 036: Billing & Subscriptions (Dodo Payments)
-- Description: Adds user-level subscriptions, org-level subscriptions,
--              usage tracking, and webhook event log for Dodo Payments integration.
-- =============================================================================

-- =============================================================================
-- SECTION 1: ENUMS
-- =============================================================================

CREATE TYPE subscription_status AS ENUM (
    'trialing',
    'active',
    'past_due',
    'cancelled',
    'expired',
    'locked'
);

CREATE TYPE subscription_plan AS ENUM (
    'pro_trial',
    'pro_paid',
    'teams',
    'enterprise'
);


-- =============================================================================
-- SECTION 2: USER SUBSCRIPTIONS (Pro Trial / Pro Paid)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.user_subscriptions (
    id                      UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                 UUID            NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,

    -- Dodo Payments references
    dodo_customer_id        TEXT,
    dodo_subscription_id    TEXT,
    dodo_product_id         TEXT,

    -- Plan state
    plan                    subscription_plan   NOT NULL DEFAULT 'pro_trial',
    status                  subscription_status NOT NULL DEFAULT 'trialing',

    -- Trial tracking
    trial_starts_at         TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    trial_ends_at           TIMESTAMPTZ     NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),

    -- Billing period (populated after first payment)
    current_period_start    TIMESTAMPTZ,
    current_period_end      TIMESTAMPTZ,

    -- Metadata
    cancelled_at            TIMESTAMPTZ,
    locked_at               TIMESTAMPTZ,
    created_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.user_subscriptions IS
    'User-level subscription state. One row per user. Tracks Pro Trial / Pro Paid plans via Dodo Payments.';

CREATE INDEX IF NOT EXISTS idx_user_subscriptions_status
    ON public.user_subscriptions(status);

CREATE INDEX IF NOT EXISTS idx_user_subscriptions_trial_ends
    ON public.user_subscriptions(trial_ends_at)
    WHERE status = 'trialing';

CREATE INDEX IF NOT EXISTS idx_user_subscriptions_dodo_customer
    ON public.user_subscriptions(dodo_customer_id)
    WHERE dodo_customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_user_subscriptions_dodo_subscription
    ON public.user_subscriptions(dodo_subscription_id)
    WHERE dodo_subscription_id IS NOT NULL;


-- =============================================================================
-- SECTION 3: ORG SUBSCRIPTIONS (Teams / Enterprise)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.org_subscriptions (
    id                      UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id                  UUID            NOT NULL UNIQUE REFERENCES public.organisations(id) ON DELETE CASCADE,

    -- Dodo Payments references
    dodo_customer_id        TEXT,
    dodo_subscription_id    TEXT,
    dodo_product_id         TEXT,

    -- Plan state
    plan                    subscription_plan   NOT NULL DEFAULT 'teams',
    status                  subscription_status NOT NULL DEFAULT 'active',

    -- Seat management
    seats_purchased         INT             NOT NULL DEFAULT 1,
    seats_used              INT             NOT NULL DEFAULT 1,

    -- Billing period
    current_period_start    TIMESTAMPTZ,
    current_period_end      TIMESTAMPTZ,

    -- Metadata
    cancelled_at            TIMESTAMPTZ,
    created_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.org_subscriptions IS
    'Org-level subscription state. One row per org with a Teams/Enterprise plan. Tracks seat count and billing via Dodo Payments.';

CREATE INDEX IF NOT EXISTS idx_org_subscriptions_status
    ON public.org_subscriptions(status);

CREATE INDEX IF NOT EXISTS idx_org_subscriptions_dodo_customer
    ON public.org_subscriptions(dodo_customer_id)
    WHERE dodo_customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_org_subscriptions_dodo_subscription
    ON public.org_subscriptions(dodo_subscription_id)
    WHERE dodo_subscription_id IS NOT NULL;


-- =============================================================================
-- SECTION 4: USAGE TRACKING
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.usage_tracking (
    id                      UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                 UUID            NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,

    -- AI chat usage
    ai_chats_today          INT             NOT NULL DEFAULT 0,
    ai_chats_this_hour      INT             NOT NULL DEFAULT 0,
    ai_hour_window          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    ai_day_window           DATE            NOT NULL DEFAULT CURRENT_DATE,

    -- Meeting recordings (monthly)
    recordings_this_month   INT             NOT NULL DEFAULT 0,
    recording_month         DATE            NOT NULL DEFAULT DATE_TRUNC('month', CURRENT_DATE)::DATE,

    updated_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.usage_tracking IS
    'Per-user usage counters for rate limiting. Auto-resets on window boundaries.';

CREATE INDEX IF NOT EXISTS idx_usage_tracking_user_id
    ON public.usage_tracking(user_id);


-- =============================================================================
-- SECTION 5: DODO WEBHOOK EVENT LOG (Idempotency)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.dodo_webhook_events (
    id                  UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id            TEXT            NOT NULL UNIQUE,
    event_type          TEXT            NOT NULL,
    payload             JSONB           NOT NULL DEFAULT '{}',
    processed_at        TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.dodo_webhook_events IS
    'Stores processed Dodo Payments webhook events for idempotency. Prevents duplicate processing on webhook retries.';

CREATE INDEX IF NOT EXISTS idx_dodo_webhook_events_type
    ON public.dodo_webhook_events(event_type);

CREATE INDEX IF NOT EXISTS idx_dodo_webhook_events_processed
    ON public.dodo_webhook_events(processed_at);

-- =============================================================================
-- SECTION 6: AUTO-PROVISION SUBSCRIPTION ON USER CREATION
-- =============================================================================

-- Trigger function: when a new user row is inserted, create their trial subscription
CREATE OR REPLACE FUNCTION public.handle_new_user_subscription()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.user_subscriptions (user_id, plan, status, trial_starts_at, trial_ends_at)
    VALUES (NEW.id, 'pro_trial', 'trialing', NOW(), NOW() + INTERVAL '30 days')
    ON CONFLICT (user_id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger: fires after INSERT on public.users
CREATE TRIGGER on_user_created_provision_subscription
    AFTER INSERT ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user_subscription();

-- =============================================================================
-- SECTION 7: GRANDFATHERING — Create trial subscriptions for existing users
-- =============================================================================

INSERT INTO public.user_subscriptions (user_id, plan, status, trial_starts_at, trial_ends_at)
SELECT
    u.id,
    'pro_trial',
    'trialing',
    NOW(),
    NOW() + INTERVAL '30 days'
FROM public.users u
WHERE NOT EXISTS (
    SELECT 1 FROM public.user_subscriptions us WHERE us.user_id = u.id
);
