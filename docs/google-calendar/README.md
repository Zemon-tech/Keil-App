# Google Calendar Integration

## Overview

This feature enables **full two-way sync** between KeilHQ tasks and Google Calendar.

- **KeilHQ → Google Calendar**: When a user schedules, updates, or deletes a task/event in KeilHQ, the change is automatically pushed to their connected Google Calendar.
- **Google Calendar → KeilHQ**: When a user creates, modifies, or deletes an event directly in Google Calendar (from any device or app), the change is automatically reflected in their KeilHQ workspace (General space).

The sync is **best-effort and non-blocking** — Google sync never prevents a task update from succeeding.

## Table of Contents

| Document | Description |
| --- | --- |
| [Architecture](./architecture.md) | OAuth flow, sync trigger design, webhook pipeline, and key decisions |
| [Frontend Guide](./frontend.md) | Hook usage, Connectors UI, and redirect handling |
| [Backend Guide](./backend.md) | Service logic, endpoints, schema, and token management |
| [Environment Variables](./environment.md) | Required configuration and Google Cloud setup |

## Quick Start

### 1. Google Cloud setup

1. Open your existing Google Cloud project.
2. Go to **APIs & Services → Enable APIs** and enable the **Google Calendar API**.
3. Go to **APIs & Services → Credentials → OAuth 2.0 Client IDs**.
4. Add your callback URI as an authorized redirect URI:
   - Development: `http://localhost:5000/api/v1/integrations/google/callback`
   - Production: `https://your-backend.com/api/v1/integrations/google/callback`

### 2. Run the migrations

Run both migrations against your database:

```bash
node run-migration.js
```

This applies:
- `008_google_calendar_integration.sql` — `user_integrations` table + `google_event_id` columns
- `011_gcal_two_way_sync.sql` — watch channel columns, `ical_uid`, unique constraints, webhook receipts table

### 3. Configure environment variables

Add to `backend/.env`:

```env
GOOGLE_CLIENT_ID=<your-google-client-id>
GOOGLE_CLIENT_SECRET=<your-google-client-secret>
GOOGLE_REDIRECT_URI=http://localhost:5000/api/v1/integrations/google/callback
GOOGLE_OAUTH_STATE_SECRET=<random-32-byte-hex-string>
FRONTEND_URL=http://localhost:5173
BACKEND_URL=https://your-public-backend-url.com
```

> **Important:** `BACKEND_URL` must be a publicly accessible URL. Google cannot reach `localhost`. Use [ngrok](https://ngrok.com) for local development.

### 4. Connect Google Calendar

1. Start the backend and frontend.
2. Open **Settings → Connectors**.
3. Click **Connect** next to Google Calendar.
4. Complete the Google consent screen.
5. You are redirected back to `/tasks` with a success toast.
6. The backend automatically registers a push notification watch channel with Google.

### 5. Test outbound sync (KeilHQ → Google)

1. Open the Tasks page in the General workspace.
2. Create or drag a task onto the calendar to schedule it.
3. Open Google Calendar — the event should appear within seconds.

### 6. Test inbound sync (Google → KeilHQ)

1. Open Google Calendar and create a new event on a future date.
2. Within a few seconds, the event should appear as a task in the General workspace in KeilHQ.

> **Note:** Only events with a future start date are synced. Past events are ignored.

## Tech Stack

| Layer | Technology | Purpose |
| --- | --- | --- |
| OAuth Provider | Google OAuth 2.0 | Per-user calendar access grant |
| Calendar API | Google Calendar API v3 | Create, update, delete, watch calendar events |
| Push Notifications | Google Calendar Push Notifications | Real-time change delivery via webhooks |
| Backend Library | `googleapis` (npm) | Official Google API client for Node.js |
| Token Storage | PostgreSQL (`user_integrations`) | Persist refresh tokens and watch channel state per user |
| CSRF Protection | HMAC-SHA256 signed state param | Prevent OAuth state forgery |
| Real-time UI Update | Socket.io (`gcal_tasks_updated` event) | Trigger frontend task refresh on inbound sync |
| Frontend State | TanStack React Query | Cache and invalidate connection status and task lists |
| Tunnel (dev only) | ngrok | Expose local backend to Google's webhook delivery |
