# Architecture

## Overview

The integration uses a **per-user OAuth 2.0** model. Each user independently connects their own Google account. The backend stores their refresh token and uses it to push calendar events on their behalf whenever they schedule a task.

## OAuth Connection Flow

```text
+-------------------------- Frontend ----------------------------+
|                                                                |
|  Settings → Connectors → "Connect" button                      |
|            |                                                   |
|            | GET /api/v1/integrations/google/connect           |
|            v                                                   |
|       Backend generates OAuth URL with signed state param      |
|            |                                                   |
|            | returns { url }                                   |
|            v                                                   |
|  window.location.href = url  (full page redirect)              |
+------------|---------------------------------------------------+
             |
             v
+----------------------- Google OAuth ---------------------------+
|                                                                |
|  User sees consent screen: "Allow access to Google Calendar"  |
|            |                                                   |
|            | user approves                                     |
|            v                                                   |
|  Google redirects to GOOGLE_REDIRECT_URI with ?code=&state=   |
+------------|---------------------------------------------------+
             |
             v
+--------------------------- Backend ----------------------------+
|                                                                |
|  GET /api/v1/integrations/google/callback                      |
|            |                                                   |
|            | verify HMAC state signature (CSRF check)          |
|            | decode userId from state payload                  |
|            | exchange code for access_token + refresh_token    |
|            | upsert into public.user_integrations              |
|            |                                                   |
|            | redirect to FRONTEND_URL/tasks?gcal=connected     |
+------------|---------------------------------------------------+
             |
             v
+-------------------------- Frontend ----------------------------+
|                                                                |
|  TasksPage useEffect detects ?gcal=connected                   |
|  Shows success toast, cleans URL param                         |
|  Invalidates googleStatus query → Connectors tab updates       |
+----------------------------------------------------------------+
```

## Task Sync Flow

```text
+-------------------------- Frontend ----------------------------+
|                                                                |
|  User drags task onto calendar                                 |
|            |                                                   |
|            | handleTaskSchedule(taskId, startISO, endISO)      |
|            | → handleUpdateTask(id, { start_date, due_date })  |
|            | → PATCH /api/v1/tasks/:id  (or /personal/tasks)   |
+------------|---------------------------------------------------+
             |
             v
+--------------------------- Backend ----------------------------+
|                                                                |
|  task.service.ts / personal-task.service.ts                    |
|            |                                                   |
|            | 1. Update task in PostgreSQL (awaited)            |
|            | 2. Return updated task to frontend (HTTP response) |
|            |                                                   |
|            | 3. Fire-and-forget:                               |
|            |    syncTaskToCalendar(userId, task)               |
|            |      |                                            |
|            |      | load user_integrations row                 |
|            |      | build OAuth2 client, refresh token if needed|
|            |      | build Google event body                    |
|            |      |                                            |
|            |      | if google_event_id exists → events.update  |
|            |      | else → events.insert                       |
|            |             write returned event.id back to task  |
+----------------------------------------------------------------+
```

## Sync Decision Logic

```text
syncTaskToCalendar(userId, task)
│
├── task.start_date is null?
│   ├── task.google_event_id exists? → deleteCalendarEvent + clear ID
│   └── return (nothing to sync)
│
├── getAuthorizedClient(userId) returns null?
│   └── return (user not connected — silent skip)
│
├── task.google_event_id exists?
│   └── calendar.events.update(...)
│
└── no google_event_id
    └── calendar.events.insert(...)
        └── write returned event.id → UPDATE tasks SET google_event_id = ...
```

## Key Design Decisions

### 1. Fire-and-forget sync

Google sync is called without `await` and errors are caught and logged. This means:
- Task updates always succeed even if Google is down or the token is revoked.
- The HTTP response returns before the sync completes.
- Sync failures are visible in server logs but not surfaced to the user.

**Why:** Calendar sync is a convenience feature. A Google outage or revoked token must never prevent a user from managing their tasks.

### 2. Separate OAuth grant from Google login

Users who sign in with Google via Supabase still need to explicitly connect Google Calendar. Supabase consumes the login tokens internally and does not expose them to the backend. The Calendar integration requires a separate OAuth grant with the `calendar.events` scope.

**Why:** Google treats login identity and calendar write access as distinct permissions. This is by design and cannot be bypassed.

### 3. HMAC-signed state parameter

The OAuth state parameter is a base64-encoded JSON payload (`{ userId, ts }`) signed with `GOOGLE_OAUTH_STATE_SECRET` using HMAC-SHA256. The callback verifies the signature before trusting the `userId`.

**Why:** Prevents CSRF attacks where a malicious site tricks a user's browser into completing an OAuth flow that links the attacker's Google account to the victim's app account.

### 4. `google_event_id` stored on the task row

After creating a Google Calendar event, the returned `event.id` is written back to `tasks.google_event_id` (or `personal_tasks.google_event_id`). This is the permanent link between the app task and the Google event.

**Why:** Required for update and delete operations. Without it, every sync would create a duplicate event.

### 5. Token refresh handled transparently

`getAuthorizedClient` checks if the stored access token expires within 5 minutes. If so, it calls `oauth2Client.refreshAccessToken()` and saves the new token to the DB before returning the client. If refresh fails (token revoked), it returns `null` and sync is silently skipped.

**Why:** Access tokens expire after 1 hour. Transparent refresh means sync works indefinitely without user re-authentication.

### 6. Same Google Cloud project as login

The same `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` used for Supabase Google login are reused. Only two additional steps are needed: enable the Calendar API and add the callback redirect URI.

## Security Boundaries

| Boundary | Mechanism |
| --- | --- |
| OAuth CSRF protection | HMAC-SHA256 signed state parameter |
| Refresh token storage | Stored in `public.user_integrations`, protected by Postgres RLS and app-level auth |
| Token confidentiality | Refresh token is useless without `GOOGLE_CLIENT_SECRET`, which stays in `.env` |
| Callback endpoint | Public route — protected by state signature verification, not JWT |
| All other integration endpoints | Protected by `protect` middleware (Supabase JWT) |
| Sync errors | Caught and logged server-side, never exposed to the client |

## Future: Two-Way Sync

The current architecture is designed to support two-way sync without structural changes:

- `google_event_id` on task rows is the key needed to match incoming Google push notifications back to app tasks.
- Adding two-way sync requires: registering a Google push notification channel per user, a new public webhook endpoint, and a conflict resolution strategy.
