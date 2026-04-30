# Google Calendar Integration

## Overview

This feature enables users to sync their scheduled tasks to their personal Google Calendar. When a user drags a task onto the calendar (setting a `start_date` and `due_date`), the backend automatically pushes a corresponding event to their connected Google Calendar. Updates and deletions follow the same path.

The sync is **one-way** (app → Google Calendar) and **best-effort** — Google sync never blocks or fails a task update.

## Table of Contents

| Document | Description |
| --- | --- |
| [Architecture](./architecture.md) | OAuth flow, sync trigger design, and key decisions |
| [Frontend Guide](./frontend.md) | Hook usage, Connectors UI, and redirect handling |
| [Backend Guide](./backend.md) | Service logic, endpoints, schema, and token management |
| [Environment Variables](./environment.md) | Required configuration and Google Cloud setup |

## Quick Start

### 1. Google Cloud setup

1. Open your existing Google Cloud project (the one used for Google login).
2. Go to **APIs & Services → Enable APIs** and enable the **Google Calendar API**.
3. Go to **APIs & Services → Credentials → OAuth 2.0 Client IDs**.
4. Add `http://localhost:5000/api/v1/integrations/google/callback` as an authorized redirect URI.
5. Note your **Client ID** and **Client Secret** — these are the same credentials already used for Supabase Google login.

### 2. Run the migration

Run `backend/src/migrations/008_google_calendar_integration.sql` against your database. This adds:
- `public.user_integrations` table for storing OAuth tokens
- `google_event_id` column on `public.tasks` and `public.personal_tasks`

### 3. Install the backend dependency

```bash
cd backend
npm install googleapis
```

### 4. Configure environment variables

Add to `backend/.env`:

```env
GOOGLE_CLIENT_ID=<your-google-client-id>
GOOGLE_CLIENT_SECRET=<your-google-client-secret>
GOOGLE_REDIRECT_URI=http://localhost:5000/api/v1/integrations/google/callback
GOOGLE_OAUTH_STATE_SECRET=<random-32-byte-hex-string>
FRONTEND_URL=http://localhost:5173
```

Generate the state secret:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 5. Connect Google Calendar

1. Start the backend and frontend.
2. Open **Settings → Connectors**.
3. Click **Connect** next to Google Calendar.
4. Complete the Google consent screen.
5. You are redirected back to `/tasks` with a success toast.

### 6. Test the sync

1. Open the Tasks page.
2. Drag any task from the list onto the calendar to schedule it.
3. Open Google Calendar — the event should appear within a few seconds.

## Tech Stack

| Layer | Technology | Purpose |
| --- | --- | --- |
| OAuth Provider | Google OAuth 2.0 | Per-user calendar access grant |
| Calendar API | Google Calendar API v3 | Create, update, delete calendar events |
| Backend Library | `googleapis` (npm) | Official Google API client for Node.js |
| Token Storage | PostgreSQL (`user_integrations`) | Persist refresh tokens per user |
| CSRF Protection | HMAC-SHA256 signed state param | Prevent OAuth state forgery |
| Frontend State | TanStack React Query | Cache and invalidate connection status |
