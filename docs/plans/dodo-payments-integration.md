# Dodo Payments Integration — Architecture & Implementation Plan

> **Goal:** Integrate Dodo Payments into KeilHQ for subscription billing with a hybrid model (user-level Pro, org-level Teams), in-app checkout, webhook-driven provisioning, soft-warning + hard-limit enforcement, and Dodo Customer Portal for subscription management.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Billing Model](#2-billing-model)
3. [Database Schema](#3-database-schema)
4. [Backend Architecture](#4-backend-architecture)
5. [Frontend Architecture](#5-frontend-architecture)
6. [Checkout Flow](#6-checkout-flow)
7. [Webhook Handling](#7-webhook-handling)
8. [Plan Enforcement (Limits & Gating)](#8-plan-enforcement)
9. [Trial & Expiry Logic](#9-trial--expiry-logic)
10. [Data Export on Lockout](#10-data-export-on-lockout)
11. [Security Considerations](#11-security-considerations)
12. [Implementation Buckets](#12-implementation-buckets)
13. [Environment Variables](#13-environment-variables)
14. [API Endpoints](#14-api-endpoints)

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           KeilHQ Frontend                               │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────────┐   │
│  │ Billing Page │  │ Plan Limits  │  │ Dodo Customer Portal Link  │   │
│  │ (Checkout)   │  │ (Soft Warn)  │  │ (Manage Subscription)      │   │
│  └──────┬───────┘  └──────┬───────┘  └────────────────────────────┘   │
└─────────┼──────────────────┼──────────────────────────────────────────┘
          │                  │
          ▼                  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           KeilHQ Backend (Express)                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌───────────┐ │
│  │ /billing     │  │ /webhook     │  │ Enforcement  │  │ Limits    │ │
│  │ routes       │  │ /dodo        │  │ Middleware   │  │ Service   │ │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └─────┬─────┘ │
│         │                  │                  │                │       │
│         ▼                  ▼                  ▼                ▼       │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │              PostgreSQL (Supabase)                               │  │
│  │  user_subscriptions │ org_subscriptions │ usage_tracking        │  │
│  └─────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
          │                  ▲
          ▼                  │
┌──────────────────┐  ┌─────────────────┐
│  Dodo Payments   │  │  Dodo Webhooks  │
│  Checkout API    │  │  (POST to us)   │
└──────────────────┘  └─────────────────┘
```

---

## 2. Billing Model

### Hybrid Subscription Architecture

| Plan | Billing Entity | Scope | Price | Dodo Product |
|------|---------------|-------|-------|--------------|
| Pro Trial | User account | User's personal usage across all orgs | $0 / 30 days | `DODO_PRODUCT_PRO` |
| Pro Paid | User account | Same as trial, upgraded limits | $25/mo | `DODO_PRODUCT_PRO` |
| Teams | Organisation | Org-level team features, per-seat | $50/user/mo | `DODO_PRODUCT_TEAMS` |
| Enterprise | Organisation | Custom (sales-led) | Contact Sales | N/A |

### Key Rules

1. **Every new user starts as Pro Trial** (30 days, automatic on signup)
2. **Pro subscription is per-user** — covers AI limits, recordings, privacy guarantees regardless of which org they're working in
3. **Teams subscription is per-org** — the org owner purchases seats. Unlocks SSO, audit logs, centralized billing for that specific org
4. **A user can have Pro + be in a Teams org** — they get the higher of their personal limits or the org's team features
5. **Seats are manually managed** — org owner must buy seats before inviting (invite blocked if no available seats)
6. **After trial expires without payment → lockout** (read-only, can export data)
7. **Existing users grandfathered as Pro Trial** (30 days from rollout date)

---

## 3. Database Schema

### New Tables

```sql
-- =============================================================================
-- SUBSCRIPTION: USER-LEVEL (Pro Trial / Pro Paid)
-- =============================================================================

CREATE TYPE subscription_status AS ENUM (
    'trialing',      -- Active trial period
    'active',        -- Paid and active
    'past_due',      -- Payment failed, grace period
    'cancelled',     -- User cancelled, access until period end
    'expired',       -- Trial ended without payment
    'locked'         -- Hard lockout (no payment after grace)
);

CREATE TABLE public.user_subscriptions (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID        NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
    
    -- Dodo Payments references
    dodo_customer_id    TEXT,                -- Dodo customer ID
    dodo_subscription_id TEXT,               -- Dodo subscription ID (null during trial)
    dodo_product_id     TEXT,                -- Product ID from Dodo
    
    -- Plan state
    plan                TEXT        NOT NULL DEFAULT 'pro_trial',  -- 'pro_trial' | 'pro_paid'
    status              subscription_status NOT NULL DEFAULT 'trialing',
    
    -- Trial tracking
    trial_starts_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    trial_ends_at       TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
    
    -- Billing period (populated after first payment)
    current_period_start TIMESTAMPTZ,
    current_period_end   TIMESTAMPTZ,
    
    -- Metadata
    cancelled_at        TIMESTAMPTZ,
    locked_at           TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_user_subscriptions_status ON public.user_subscriptions(status);
CREATE INDEX idx_user_subscriptions_trial_ends ON public.user_subscriptions(trial_ends_at)
    WHERE status = 'trialing';
```

```sql
-- =============================================================================
-- SUBSCRIPTION: ORG-LEVEL (Teams)
-- =============================================================================

CREATE TABLE public.org_subscriptions (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id              UUID        NOT NULL UNIQUE REFERENCES public.organisations(id) ON DELETE CASCADE,
    
    -- Dodo Payments references
    dodo_customer_id    TEXT,                -- Dodo customer ID (org owner's)
    dodo_subscription_id TEXT,               -- Dodo subscription ID
    dodo_product_id     TEXT,                -- Teams product ID
    
    -- Plan state
    plan                TEXT        NOT NULL DEFAULT 'teams',  -- 'teams' | 'enterprise'
    status              subscription_status NOT NULL DEFAULT 'active',
    
    -- Seat management
    seats_purchased     INT         NOT NULL DEFAULT 1,   -- How many seats bought
    seats_used          INT         NOT NULL DEFAULT 1,   -- Current org member count
    
    -- Billing period
    current_period_start TIMESTAMPTZ,
    current_period_end   TIMESTAMPTZ,
    
    -- Metadata
    cancelled_at        TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_org_subscriptions_status ON public.org_subscriptions(status);
CREATE INDEX idx_org_subscriptions_org_id ON public.org_subscriptions(org_id);
```

```sql
-- =============================================================================
-- USAGE TRACKING (for soft-warning & hard-limit enforcement)
-- =============================================================================

CREATE TABLE public.usage_tracking (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    
    -- AI chat usage
    ai_chats_today      INT     NOT NULL DEFAULT 0,
    ai_chats_this_hour  INT     NOT NULL DEFAULT 0,
    ai_hour_window      TIMESTAMPTZ NOT NULL DEFAULT NOW(),  -- Start of current hour window
    ai_day_window       DATE    NOT NULL DEFAULT CURRENT_DATE,
    
    -- Meeting recordings (monthly)
    recordings_this_month INT   NOT NULL DEFAULT 0,
    recording_month       DATE  NOT NULL DEFAULT DATE_TRUNC('month', CURRENT_DATE)::DATE,
    
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT usage_tracking_user_unique UNIQUE (user_id)
);

CREATE INDEX idx_usage_tracking_user_id ON public.usage_tracking(user_id);
```

```sql
-- =============================================================================
-- WEBHOOK EVENT LOG (idempotency & audit)
-- =============================================================================

CREATE TABLE public.dodo_webhook_events (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id        TEXT        NOT NULL UNIQUE,  -- Dodo event ID for idempotency
    event_type      TEXT        NOT NULL,
    payload         JSONB       NOT NULL,
    processed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT dodo_webhook_events_unique_event UNIQUE (event_id)
);

CREATE INDEX idx_dodo_webhook_events_type ON public.dodo_webhook_events(event_type);
```

---

## 4. Backend Architecture

### New Files Structure

```
backend/src/
├── config/
│   └── index.ts                    ← Add Dodo env vars
├── routes/
│   ├── billing.routes.ts           ← NEW: Checkout, portal, plan info
│   └── webhook-dodo.routes.ts      ← NEW: Dodo webhook receiver (no auth)
├── controllers/
│   ├── billing.controller.ts       ← NEW: Checkout session creation, portal URL
│   └── webhook-dodo.controller.ts  ← NEW: Webhook handler
├── services/
│   ├── billing.service.ts          ← NEW: Core billing logic
│   ├── subscription.service.ts     ← NEW: Plan resolution, status checks
│   └── usage.service.ts            ← NEW: Usage tracking & limit checks
├── middlewares/
│   ├── subscription.middleware.ts  ← NEW: Plan enforcement (soft warn + hard block)
│   └── seat-guard.middleware.ts    ← NEW: Block invite if no seats available
├── repositories/
│   ├── user-subscription.repository.ts   ← NEW
│   ├── org-subscription.repository.ts    ← NEW
│   └── usage-tracking.repository.ts      ← NEW
├── types/
│   └── billing.ts                  ← NEW: TypeScript types for billing
└── jobs/
    └── trial-expiry.job.ts         ← NEW: Cron job to expire trials & lock accounts
```

### Middleware Chain (Updated)

```
Request → auth.middleware (JWT) → subscription.middleware (plan check) → route handler
```

The `subscription.middleware` will:
1. Read the user's subscription status from cache/DB
2. If `status === 'locked'` → return 403 with lockout message
3. If `status === 'expired'` → return 403 with "subscribe to continue" 
4. If approaching limits → attach `x-plan-warning` header (frontend reads this)
5. Otherwise → pass through

---

## 5. Frontend Architecture

### New Files Structure

```
frontend/src/
├── components/
│   └── billing/
│       ├── BillingPage.tsx             ← Main billing/settings page
│       ├── PlanCard.tsx                ← Individual plan display
│       ├── CurrentPlanBanner.tsx       ← Shows current plan + status in sidebar/header
│       ├── UsageIndicator.tsx          ← Progress bars for AI chats, recordings
│       ├── SeatManager.tsx             ← Teams: buy/manage seats
│       ├── LockoutOverlay.tsx          ← Full-screen overlay when locked out
│       └── UpgradePrompt.tsx           ← Soft-warning modal/banner
├── hooks/
│   └── api/
│       ├── useBilling.ts              ← React Query hooks for billing endpoints
│       └── useUsage.ts                ← Usage tracking hooks
├── contexts/
│   └── SubscriptionContext.tsx        ← Global subscription state
└── types/
    └── billing.ts                     ← Shared billing types
```

### Route Addition (App.tsx)

```tsx
<Route path="/billing" element={<BillingPage />} />
```

### Subscription Context

The `SubscriptionContext` will be loaded once on app boot (after auth) and provide:
- `plan`: 'pro_trial' | 'pro_paid' | 'teams' | 'enterprise'
- `status`: subscription status
- `limits`: resolved limits for the current user
- `usage`: current usage counters
- `trialDaysRemaining`: number (if on trial)
- `isLocked`: boolean
- `portalUrl`: link to Dodo Customer Portal

---

## 6. Checkout Flow

### In-App Checkout (No Landing Page)

```
User logs in → navigates to /billing → selects plan → backend creates checkout session → redirects to Dodo hosted checkout → Dodo redirects back to /billing?success=true → webhook confirms → DB updated
```

### Sequence Diagram

```
User (Frontend)              Backend                    Dodo Payments
     │                         │                            │
     │── GET /billing ────────▶│                            │
     │◀── current plan + usage─│                            │
     │                         │                            │
     │── POST /billing/checkout─▶│                          │
     │   { plan: 'pro_paid' }  │                            │
     │                         │── POST /subscriptions ────▶│
     │                         │◀── { checkout_url } ───────│
     │◀── { checkout_url } ────│                            │
     │                         │                            │
     │── redirect to Dodo ─────────────────────────────────▶│
     │                         │                            │
     │◀── redirect back to /billing?success=true ───────────│
     │                         │                            │
     │                         │◀── webhook: subscription.active ──│
     │                         │── update user_subscriptions│
     │                         │                            │
     │── GET /billing (poll) ──▶│                           │
     │◀── plan: 'pro_paid', status: 'active' ──────────────│
```

### Teams Checkout (Org Owner)

```
Org Owner → /billing → "Upgrade Org to Teams" → selects seats → checkout session with quantity → Dodo hosted checkout → webhook → org_subscriptions created
```

---

## 7. Webhook Handling

### Endpoint

```
POST /api/webhooks/dodo-payments  (NO auth middleware — uses webhook signature verification)
```

### Webhook Signature Verification

Using `dodopayments` SDK's built-in webhook verification with the `DODO_PAYMENTS_WEBHOOK_KEY`.

### Events to Handle

| Dodo Event | Action |
|---|---|
| `subscription.active` | Set user/org subscription status → `active`, populate period dates |
| `subscription.on_trial` | Confirm trial started (initial provision) |
| `subscription.renewed` | Update `current_period_start/end`, keep status `active` |
| `subscription.past_due` | Set status → `past_due`, trigger soft-warning email |
| `subscription.cancelled` | Set status → `cancelled`, record `cancelled_at` |
| `subscription.expired` | Set status → `expired` (trial ended without payment) |
| `subscription.failed` | Log payment failure, alert user |
| `payment.succeeded` | Log successful payment for audit |
| `payment.failed` | Log failure, notify user |

### Idempotency

Every webhook event is stored in `dodo_webhook_events` with a unique `event_id`. Before processing, we check if the event was already handled. This prevents duplicate provisioning.

### Webhook Handler Pseudocode

```typescript
// webhook-dodo.controller.ts
export const handleDodoWebhook = async (req: Request, res: Response) => {
    // 1. Verify webhook signature
    const isValid = verifyWebhookSignature(req.body, req.headers, WEBHOOK_KEY);
    if (!isValid) return res.status(401).send();
    
    // 2. Idempotency check
    const eventId = req.body.event_id;
    const exists = await webhookRepo.findByEventId(eventId);
    if (exists) return res.status(200).send(); // Already processed
    
    // 3. Route by event type
    switch (req.body.event_type) {
        case 'subscription.active':
            await handleSubscriptionActive(req.body);
            break;
        case 'subscription.cancelled':
            await handleSubscriptionCancelled(req.body);
            break;
        // ... etc
    }
    
    // 4. Store event for idempotency
    await webhookRepo.create({ event_id: eventId, event_type, payload: req.body });
    
    res.status(200).send();
};
```

---

## 8. Plan Enforcement

### Limits by Plan

| Resource | Pro Trial | Pro Paid | Teams | Enterprise |
|---|---|---|---|---|
| AI Chats / day | 25 | 100 | 100 | Unlimited |
| AI Chats / hour | No limit | 20 | 20 | Unlimited |
| Meeting Recordings / month | 3 | Unlimited | Unlimited | Unlimited |
| Transcription Diarization | No | Yes | Yes | Yes |
| Data used for model training | Yes | No | No | No |
| SSO | No | No | Yes | Yes |
| Audit Logs | No | No | Yes | Yes |
| Centralized Seat Billing | No | No | Yes | Yes |

### Enforcement Strategy: Two-Layer

**Layer 1: Subscription Middleware (global)**
- Runs on ALL authenticated routes (after `protect` middleware)
- Checks subscription status: `locked` / `expired` → 403
- Lightweight: reads from in-memory cache (Redis-like pattern with pg + TTL)

**Layer 2: Usage Service (per-feature)**
- Called by specific route handlers (AI chat, meeting recording)
- Checks rate limits against `usage_tracking` table
- Returns: `{ allowed: boolean, warning: boolean, remaining: number }`

### Soft Warning Flow

```
User approaches limit (80% used)
  → Backend attaches header: x-plan-warning: ai_chats_daily_80
  → Frontend reads header, shows toast/banner: "You've used 80 of 100 AI chats today"
  
User hits limit (100% used)
  → Backend returns 429 with body: { code: 'LIMIT_REACHED', resource: 'ai_chats_daily', limit: 100 }
  → Frontend shows upgrade prompt modal
```

### Hard Lockout Flow (Trial Expired)

```
Trial ends → cron job sets status = 'expired'
  → 7-day grace period with daily email reminders
  → After grace → status = 'locked'
  → All API calls return 403 { code: 'ACCOUNT_LOCKED', export_url: '/api/billing/export' }
  → Frontend shows LockoutOverlay with "Export Data" + "Subscribe" buttons
```

---

## 9. Trial & Expiry Logic

### Timeline

```
Day 0:  User signs up → user_subscriptions row created (status: 'trialing', trial_ends_at: +30d)
Day 25: Email: "5 days left on your trial"
Day 28: Email: "2 days left" + in-app banner
Day 30: Trial expires → status: 'expired' → app shows "Subscribe to continue"
Day 37: Grace period ends → status: 'locked' → read-only + export only
```

### Cron Job: `trial-expiry.job.ts`

Runs every hour:
1. Find all users where `status = 'trialing'` AND `trial_ends_at < NOW()`
2. Set `status = 'expired'`
3. Find all users where `status = 'expired'` AND `trial_ends_at + 7 days < NOW()`
4. Set `status = 'locked'`, `locked_at = NOW()`

### Grandfathering Existing Users

On deployment:
- Run a one-time migration that creates `user_subscriptions` for every existing user
- `plan = 'pro_trial'`, `status = 'trialing'`, `trial_ends_at = deployment_date + 30 days`
- Notify all existing users via email about the trial period

---

## 10. Data Export on Lockout

When a user is locked out, they can still:
- Access `GET /api/billing/export` → generates a ZIP containing:
  - All their tasks (JSON/CSV)
  - All their Motion pages (Markdown)
  - All their calendar events (ICS)
  - All their chat messages (JSON)
- This endpoint remains accessible even when `status = 'locked'`
- Export is scoped to the user's own data only (personal org + tasks assigned to them)

---

## 11. Security Considerations

1. **Webhook Signature Verification** — Every Dodo webhook is verified using HMAC signature before processing. Reject unsigned/invalid requests.

2. **No Payment Data in Our DB** — We never store credit card numbers or sensitive payment info. Dodo handles PCI compliance. We only store Dodo IDs and subscription metadata.

3. **Webhook Endpoint is Public (No Auth)** — The `/api/webhooks/dodo-payments` route must NOT have the `protect` middleware. It's authenticated via webhook signature only.

4. **Idempotent Processing** — All webhook handlers are idempotent. Duplicate events are safely ignored via `dodo_webhook_events` table.

5. **Rate Limiting on Billing Endpoints** — Apply stricter rate limits on checkout creation (e.g., 5 requests/minute per user) to prevent abuse.

6. **Seat Validation on Invite** — Before adding a member to a Teams org, validate `seats_used < seats_purchased`. This is enforced server-side in the invite/join flow.

7. **Subscription Cache Invalidation** — When a webhook updates subscription status, immediately invalidate any cached subscription data for that user/org.

8. **Export Endpoint Security** — The data export endpoint requires valid authentication (user must prove identity) even though the account is locked. The JWT verification still works; only feature access is blocked.

---

## 12. Implementation Buckets

### Bucket 1: Database Schema & Core Models (1-2 days)
- [ ] Create migration: subscription enums, `user_subscriptions`, `org_subscriptions`, `usage_tracking`, `dodo_webhook_events`
- [ ] Create TypeScript types (`types/billing.ts`)
- [ ] Create repositories (user-subscription, org-subscription, usage-tracking)
- [ ] Create subscription service (plan resolution, status checks)
- [ ] Grandfathering migration for existing users
- **Checkpoint:** Schema in DB, repositories tested with basic CRUD

### Bucket 2: Dodo Payments SDK & Webhook Handler (1-2 days)
- [ ] Install `dodopayments` npm package
- [ ] Add Dodo env vars to `config/index.ts`
- [ ] Create webhook route (no auth, signature verification)
- [ ] Implement webhook controller with all event handlers
- [ ] Implement idempotency layer
- [ ] Register webhook URL in Dodo console
- **Checkpoint:** Webhooks receiving and processing test events from Dodo

### Bucket 3: Checkout Flow & Billing API (1-2 days)
- [ ] Create billing routes (`/api/v1/billing/*`)
- [ ] `POST /billing/checkout` — create Dodo checkout session (Pro or Teams)
- [ ] `GET /billing/plan` — return current user plan + status + usage
- [ ] `GET /billing/portal` — return Dodo Customer Portal URL
- [ ] `GET /billing/org/:orgId/plan` — return org Teams subscription status
- [ ] Wire up billing routes in `v1.routes.ts`
- **Checkpoint:** Can create a checkout session, redirect to Dodo, and return

### Bucket 4: Plan Enforcement Middleware & Usage Tracking (2-3 days)
- [ ] Create `subscription.middleware.ts` (global lockout check)
- [ ] Create `usage.service.ts` (per-feature limit checks)
- [ ] Integrate usage checks into AI chat routes
- [ ] Integrate usage checks into meeting recording routes
- [ ] Add `x-plan-warning` header logic
- [ ] Create `seat-guard.middleware.ts` for org invite/join flow
- [ ] Add seat validation to `joinOrganisation` and `addMember` flows
- **Checkpoint:** AI chats blocked at limit, invites blocked without seats

### Bucket 5: Trial Expiry Job & Lockout (1 day)
- [ ] Create `trial-expiry.job.ts` cron (runs hourly)
- [ ] Implement trial → expired → locked state transitions
- [ ] Implement grace period logic (7 days)
- [ ] Wire cron into server startup (use `setInterval` or external cron)
- **Checkpoint:** Trial expires correctly, user gets locked after grace period

### Bucket 6: Frontend — Billing Page & Subscription Context (2-3 days)
- [ ] Create `SubscriptionContext` (loads plan on app boot)
- [ ] Create billing API hooks (`useBilling.ts`, `useUsage.ts`)
- [ ] Build `BillingPage` with plan cards, checkout buttons
- [ ] Build `CurrentPlanBanner` for sidebar/header
- [ ] Build `UsageIndicator` (AI chats remaining, recordings used)
- [ ] Build `SeatManager` for Teams orgs
- [ ] Add `/billing` route to App.tsx
- **Checkpoint:** User can see their plan, usage, and initiate checkout

### Bucket 7: Frontend — Lockout & Warnings (1-2 days)
- [ ] Build `LockoutOverlay` (blocks entire app when locked)
- [ ] Build `UpgradePrompt` modal (shown when limit hit)
- [ ] Build soft-warning toast/banner (reads `x-plan-warning` header)
- [ ] Wire subscription context into AI chat component (show remaining)
- [ ] Build trial countdown banner (shows days remaining)
- **Checkpoint:** Full UX flow — warnings, limits, lockout all working

### Bucket 8: Data Export & Polish (1-2 days)
- [ ] Create `GET /api/billing/export` endpoint
- [ ] Implement ZIP generation (tasks JSON, pages MD, events ICS, chat JSON)
- [ ] Allow export even when locked (auth-only, no subscription check)
- [ ] Build export button in LockoutOverlay
- [ ] End-to-end testing of full flow
- [ ] Error handling, edge cases, retry logic
- **Checkpoint:** Complete integration, production-ready

---

**Total Estimated Effort: 10-17 days**

---

## 13. Environment Variables

Add to `backend/.env`:

```env
# ── Dodo Payments ─────────────────────────────────────────────────────────────
DODO_PAYMENTS_API_KEY=            # Secret API key from Dodo console
DODO_PAYMENTS_WEBHOOK_KEY=        # Webhook signing secret from Dodo console
DODO_PAYMENTS_ENVIRONMENT=test_mode  # 'test_mode' or 'live_mode'
DODO_PAYMENTS_RETURN_URL=https://app.keilhq.in/billing?success=true

# Product IDs (from Dodo Payments console)
DODO_PRODUCT_PRO=pdt_...          # Pro plan product ID
DODO_PRODUCT_TEAMS=pdt_...        # Teams plan product ID
```

Add to `backend/src/config/index.ts`:

```typescript
// ── Dodo Payments ────────────────────────────────────────────────────────────
dodoPaymentsApiKey: process.env.DODO_PAYMENTS_API_KEY || "",
dodoPaymentsWebhookKey: process.env.DODO_PAYMENTS_WEBHOOK_KEY || "",
dodoPaymentsEnvironment: process.env.DODO_PAYMENTS_ENVIRONMENT || "test_mode",
dodoPaymentsReturnUrl: process.env.DODO_PAYMENTS_RETURN_URL || "",
dodoProductPro: process.env.DODO_PRODUCT_PRO || "",
dodoProductTeams: process.env.DODO_PRODUCT_TEAMS || "",
```

---

## 14. API Endpoints

### Billing Routes (all require auth via `protect` middleware)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/billing/plan` | Get current user's plan, status, usage, trial info |
| `POST` | `/api/v1/billing/checkout` | Create Dodo checkout session → returns `checkout_url` |
| `GET` | `/api/v1/billing/portal` | Get Dodo Customer Portal URL for subscription management |
| `GET` | `/api/v1/billing/org/:orgId/plan` | Get org's Teams subscription status & seats |
| `POST` | `/api/v1/billing/org/:orgId/checkout` | Create Teams checkout for org (owner only) |
| `POST` | `/api/v1/billing/org/:orgId/seats` | Update seat count for Teams org (redirects to Dodo portal) |
| `GET` | `/api/v1/billing/export` | Generate & download data export ZIP (works when locked) |

### Webhook Route (NO auth — signature verified internally)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/webhooks/dodo-payments` | Receives all Dodo webhook events |

### Request/Response Examples

**POST /api/v1/billing/checkout**
```json
// Request
{
    "plan": "pro_paid",          // or "teams"
    "org_id": "uuid",            // required if plan === "teams"
    "seats": 5                   // required if plan === "teams"
}

// Response
{
    "success": true,
    "checkout_url": "https://checkout.dodopayments.com/session/..."
}
```

**GET /api/v1/billing/plan**
```json
// Response
{
    "success": true,
    "data": {
        "plan": "pro_trial",
        "status": "trialing",
        "trial_ends_at": "2026-07-18T00:00:00Z",
        "trial_days_remaining": 25,
        "usage": {
            "ai_chats_today": 12,
            "ai_chats_daily_limit": 25,
            "ai_chats_this_hour": 3,
            "ai_chats_hourly_limit": null,
            "recordings_this_month": 1,
            "recordings_monthly_limit": 3
        },
        "portal_url": null
    }
}
```

---

## Decisions Log

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | Hybrid billing (user + org) | Pro is personal; Teams is org-specific with per-seat pricing |
| 2 | In-app checkout only | No landing page dependency; user authenticates first |
| 3 | Dodo Customer Portal for management | Avoid building custom invoice/cancel/card-update UI |
| 4 | Soft warning → hard limit | UX-friendly: toast at 80%, block at 100% |
| 5 | 7-day grace after trial | Gives users time to decide without losing data |
| 6 | Manual seat management | Org owner explicitly buys seats before inviting |
| 7 | Data export on lockout | Users never lose their data; builds trust |
| 8 | Webhook idempotency table | Prevents double-provisioning on retry |
| 9 | Existing users → Pro Trial | Fair rollout; gives everyone 30 days |
| 10 | No free tier after trial | Clean monetization: pay or export & leave |

---

## Open Questions / Future Considerations

- **Annual billing discount** — Add later as a separate Dodo product variant?
- **Team plan → org creation limit** — Should Teams unlock creating more orgs, or keep unlimited?
- **Usage analytics dashboard** — Admin view of usage patterns across the platform?
- **Dunning emails** — Build custom or rely on Dodo's built-in dunning?
- **Refund handling** — Dodo webhook for refunds → revert plan?
