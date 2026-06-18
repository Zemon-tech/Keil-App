# KeilHQ Pricing

> KeilHQ supports users of every scale — from first prompt to enterprise rollout.

---

## Plans at a Glance

| | **Pro (Free Trial)** | **Pro (Paid)** | **Teams** | **Enterprise** |
|---|---|---|---|---|
| **Price** | $0 / 30 days | $25/mo ~~$50~~ | $50/user/mo ~~$75~~ | Contact Sales |
| **Discount** | — | 50% intro discount | 33% team discount | Custom contracts |
| **Who it's for** | Individuals evaluating KeilHQ | Power users & professionals | Growing squads needing SSO & shared billing | Large-scale orgs with custom compliance needs |
| **Dodo Product ID** | `NEXT_PUBLIC_DODO_PRODUCT_PRO` | `NEXT_PUBLIC_DODO_PRODUCT_PRO` | `NEXT_PUBLIC_DODO_PRODUCT_TEAMS` | n/a — talk to sales |

---

## Plan Details

### Pro — Individual

**Trial (Month 1)** — $0 for 30 days

- 25 AI chats per day
- Unlimited tasks, motion pages, and channels
- ⚠️ Trial data will be used to train future models

**Paid (Month 2+)** — $25/mo (intro price, normally $50)

- Everything in Free Trial
- **20 AI chats / hr** & **100 AI chats / day**
- 24×7 specialized support
- First access to new beta releases & features
- ✅ Fully secure data — no model training

**Checkout:** Handled via Dodo Payments checkout session. Trial period is set to `30` days on the product in the Dodo console (and passed explicitly as `trial_period_days: 30` in the POST body as a fallback).

---

### Teams — Collaboration

**$50 / user / mo** (normally $75 — 33% team discount)

Everything in Pro (Paid), plus:

- Centralized billing & seat management
- Single Sign-On (SSO) support
- Detailed audit & activity logs
- Advanced workspace admin controls
- 99.9% Uptime SLA Guarantee

**Checkout:** Handled via Dodo Payments checkout session with Teams product ID.

---

### Enterprise — Custom Scale

**Contact Sales** — custom contracts

Everything in Teams, plus:

- Option to host database on-premise
- Priority support with dedicated agents
- Unlimited AI chats & usage throughout
- Custom SLAs, compliance, & legal contracts
- Dedicated Customer Success Manager

**Checkout:** Directed to `/enterprise` page (sales-led, no self-serve checkout).

---

## Full Feature Comparison

### AI Capabilities & Data Security

| Feature | Pro Trial | Pro Paid | Teams | Enterprise |
|---|---|---|---|---|
| Daily AI Chat Limit | 25 / day | 100 / day | 100 / day | Unlimited |
| Hourly AI Chat Limit | — | 20 / hour | 20 / hour | Unlimited |
| AI Context Ingestion | Standard | Advanced | Advanced | Custom context limits |
| Data Privacy / Model Training | ⚠️ Used for model training | ✅ Secure (no training) | ✅ Secure (no training) | ✅ On-premise isolated databases |

### Core Workspace Features

| Feature | Pro Trial | Pro Paid | Teams | Enterprise |
|---|---|---|---|---|
| Smart Dashboard Task Ranking | ✅ | ✅ | ✅ | ✅ |
| Task Management (Kanban & Gantt) | ✅ | ✅ | ✅ | ✅ |
| Dependency Blocking Logic | ✅ | ✅ | ✅ | ✅ |
| Motion Docs & Block Editor | ✅ | ✅ | ✅ | ✅ |
| Real-time Collaborative Editing | ✅ | ✅ | ✅ | ✅ |
| Team Chat & Socket Channels | ✅ | ✅ | ✅ | ✅ |
| Smart Notifications & Preferences | ✅ | ✅ | ✅ | ✅ |
| Audio Meeting Recorder | Limited (3/month) | ✅ | ✅ | ✅ |
| Transcription Speaker Diarization | — | ✅ | ✅ | ✅ |

### Collaboration & Administration

| Feature | Pro Trial | Pro Paid | Teams | Enterprise |
|---|---|---|---|---|
| Centralized Seat Billing | — | — | ✅ | ✅ |
| Workspace Administrator Control Panel | — | — | ✅ | ✅ |
| SSO / SAML Security Integration | — | — | ✅ | ✅ |
| Detailed Activity Logs & Audit Exports | — | — | ✅ | ✅ |

### Deployment & Hosting

| Feature | Pro Trial | Pro Paid | Teams | Enterprise |
|---|---|---|---|---|
| Cloud Serverless Deployment | ✅ | ✅ | ✅ | ✅ |
| On-Premise Isolated Database Option | — | — | — | ✅ |
| Service Level Uptime SLA | — | — | 99.9% Guarantee | Custom SLA contracts |

### Support & Custom Contracts

| Feature | Pro Trial | Pro Paid | Teams | Enterprise |
|---|---|---|---|---|
| Support Channels | Community only | 24×7 Specialized | 24×7 Specialized | Priority 24/7 Response SLA |
| Dedicated Customer Success Manager | — | — | — | ✅ |
| Custom Legal Terms & Agreements | — | — | — | ✅ |

---

## Payment Integration — Dodo Payments

### Architecture

```
Landing Page (keil-land)
  └── app/pricing/page.tsx          — Plan selection UI with checkout buttons
  └── app/api/checkout/route.ts     — Checkout route handler (@dodopayments/nextjs)
  └── app/api/webhook/dodo-payments/route.ts  — Webhook handler for subscription events
```

### Checkout Flow

1. User clicks a plan button (Pro Trial / Pro Paid / Teams)
2. Frontend POSTs to `/api/checkout` with:
   - `product_cart`: `[{ product_id, quantity: 1 }]`
   - `customer`: `{ email, name }` (if Supabase session is active)
   - `trial_period_days: 30` (for Pro Trial plan)
3. Server handler creates a Dodo Payments checkout session
4. Response contains `checkout_url` → browser redirects user to hosted checkout
5. After payment, Dodo redirects to `DODO_PAYMENTS_RETURN_URL`

### Environment Variables

```env
# .env.local

# Dodo Payments
DODO_PAYMENTS_API_KEY=your_api_key_here
DODO_PAYMENTS_WEBHOOK_KEY=your_webhook_secret_here
DODO_PAYMENTS_ENVIRONMENT=test_mode        # or live_mode
DODO_PAYMENTS_RETURN_URL=https://yourdomain.com/checkout/success

# Supabase (for user session on checkout)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# Product IDs (from Dodo Payments console)
NEXT_PUBLIC_DODO_PRODUCT_PRO=pdt_...        # Pro plan product ID
NEXT_PUBLIC_DODO_PRODUCT_TEAMS=pdt_...      # Teams plan product ID
```

### Webhook Events Handled

| Event | Purpose |
|---|---|
| `onPaymentSucceeded` | Receipt emails / subscription activation |
| `onPaymentFailed` | Failure logging |
| `onSubscriptionActive` | Provision plan features |
| `onSubscriptionCancelled` | Revoke plan access |

> Webhook URL to register in Dodo console: `https://yourdomain.com/api/webhook/dodo-payments`

---

## Pricing Philosophy

> *"The right KeilHQ plan depends less on how many prompts someone sends and more on how much recurring work the team wants to move into agent-assisted execution."*

- **Pro Trial** — Evaluate KeilHQ in your day-to-day for 30 days free. Experience automated context, tasks, and motion docs before committing.
- **Pro & Teams** — Upgrading unlocks data privacy (no model training), higher rate limits, and centralized team controls.
- **Enterprise** — For organizations requiring air-gapped on-premise execution, dedicated engineers, and custom legal/compliance structures.

### Research This Is Grounded In

| Study | Finding |
|---|---|
| Stanford HAI: AI Index 2025 | Business AI adoption accelerated in 2024 while inference costs fell sharply, making agentic workflows practical for more teams. |
| McKinsey: The State of AI 2025 | Most organizations use AI somewhere, but the value gap comes from redesigning workflows rather than only adding chat tools. |
| Microsoft + LinkedIn: Work Trend Index 2024 | Knowledge workers are adopting AI quickly, often before companies have a clear plan, training model, or governance layer. |
| NIST: AI Risk Management Framework | Trustworthy AI depends on validity, reliability, security, transparency, privacy, and accountability across the full lifecycle. |