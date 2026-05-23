# Architecture

## Overview

The integration uses a **per-user OAuth 2.0** model. Each user independently connects their own Google account. The backend stores their refresh token and uses it to push calendar events on their behalf whenever they schedule a task, and to receive push notifications when they make changes in Google Calendar.

---

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
|            |                                                   |
|            | [fire-and-forget] registerWatch(userId)           |
|            |   → register push notification channel with Google|
|            |   → run doFullSync() to get initial syncToken     |
|            |   → save watch channel metadata to DB             |
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

---

## Outbound Sync Flow (KeilHQ → Google Calendar)

```text
+-------------------------- Frontend ----------------------------+
|                                                                |
|  User creates/updates/deletes a task in the workspace          |
|            |                                                   |
|            | PATCH /api/v1/orgs/:orgId/spaces/:spaceId/tasks   |
+------------|---------------------------------------------------+
             |
             v
+--------------------------- Backend ----------------------------+
|                                                                |
|  org-task.service.ts / personal-task.service.ts                |
|            |                                                   |
|            | 1. Update task in PostgreSQL (awaited)            |
|            | 2. Return updated task to frontend (HTTP response) |
|            |                                                   |
|            | 3. Fire-and-forget:                               |
|            |    syncTaskToCalendar(userId, task)               |
|            |      |                                            |
|            |      | load user_integrations row                 |
|            |      | build OAuth2 client, refresh token if needed|
|            |      | build Google event body with:              |
|            |      |   extendedProperties.private.source='keilhq'|
|            |      |   (loop prevention tag)                    |
|            |      |                                            |
|            |      | if google_event_id exists → events.update  |
|            |      | else → events.insert                       |
|            |             write returned event.id back to task  |
+----------------------------------------------------------------+
```

---

## Inbound Sync Flow (Google Calendar → KeilHQ)

```text
+----------------------- Google Calendar ------------------------+
|                                                                |
|  User creates/modifies/deletes an event                        |
|            |                                                   |
|            | Google sends POST to registered webhook URL       |
+------------|---------------------------------------------------+
             |
             v
+--------------------------- Backend ----------------------------+
|                                                                |
|  POST /api/v1/integrations/google/webhook  (public)            |
|            |                                                   |
|            | 1. Respond 200 immediately                        |
|            | 2. If X-Goog-Resource-State = 'sync' → return     |
|            |    (Google's verification ping)                   |
|            | 3. Look up user by X-Goog-Channel-ID              |
|            | 4. Validate X-Goog-Resource-ID matches stored ID  |
|            | 5. Insert into gcal_webhook_receipts (dedup)      |
|            | 6. Check 10-second debounce on last_sync_at       |
|            |    If debounced → schedule delayed sync (12s)     |
|            | 7. process.nextTick → doIncrementalSync(userId)   |
|            |                                                   |
|  doIncrementalSync(userId)                                     |
|            |                                                   |
|            | 1. Acquire PostgreSQL advisory lock (per-user)    |
|            | 2. Check watch_status = 'active'                  |
|            | 3. calendar.events.list(syncToken)                |
|            |    → 410 Gone: clear token + doFullSync()         |
|            |    → 401/403: set watch_status = 'revoked'        |
|            | 4. For each changed event:                        |
|            |    processIncomingGoogleEvent(userId, event)      |
|            | 5. Save new syncToken                             |
|            | 6. Release advisory lock                          |
|            |                                                   |
|  processIncomingGoogleEvent(userId, event)                     |
|            |                                                   |
|            | 1. Skip if source = 'keilhq' (loop prevention)   |
|            | 2. Skip if start_date is in the past              |
|            | 3. Skip if start_date > today + 30 days           |
|            | 4. Find matching task by google_event_id/ical_uid |
|            |                                                   |
|            | If cancelled → soft-delete matching task          |
|            | If no match → create org task in General space    |
|            |   status: todo, priority: medium                  |
|            | If match + Google newer → update task             |
|            |   (skipGoogleSync=true to prevent echo)           |
|            |                                                   |
|            | 5. Emit 'gcal_tasks_updated' via Socket.io        |
+------------|---------------------------------------------------+
             |
             v
+-------------------------- Frontend ----------------------------+
|                                                                |
|  useTaskOverdueAutoRefresh listens for 'gcal_tasks_updated'    |
|  → invalidateQueries for org tasks and personal tasks          |
|  → UI re-fetches and shows updated tasks                       |
+----------------------------------------------------------------+
```

---

## Watch Channel Lifecycle (State Machine)

```text
OAuth callback
     │
     ▼
  pending ──── registerWatch() success ────► active
     │                                          │
     └──── registerWatch() failure ──► degraded │
                                          │     │
                                          │     │ 401/403 from Google
                                          │     ▼
                                          │   revoked
                                          │     │
                                          │     └── user reconnects ──► pending
                                          │
                                          └── healDegradedWatchChannels() ──► active
```

| Status | Meaning |
| --- | --- |
| `pending` | OAuth tokens saved, watch not yet registered |
| `active` | Watch registered, syncToken stored, inbound sync running |
| `degraded` | Watch registration or renewal failed; recovery cron will retry |
| `revoked` | User revoked OAuth access (401/403) or manually disconnected |

---

## Sync Loop Prevention

Two-pronged guard prevents infinite echo loops:

1. **`extendedProperties` tagging**: Every event pushed from KeilHQ to Google includes `extendedProperties.private.source = 'keilhq'`. The inbound processor checks this tag and skips the event immediately.

2. **`skipGoogleSync` flag**: When `processIncomingGoogleEvent` updates a task, it passes `{ skipGoogleSync: true }` to the service layer. This suppresses the outbound `syncTaskToCalendar()` call that would otherwise echo the change back to Google.

---

## Key Design Decisions

### 1. Fire-and-forget sync (outbound)

Google sync is called without `await` and errors are caught and logged. Task updates always succeed even if Google is down or the token is revoked.

### 2. Fire-and-forget watch registration

`registerWatch()` is called after the OAuth redirect is sent. Watch registration failure never prevents a successful Google Calendar connection. The user's 1-way sync continues working even if watch registration fails.

### 3. Inbound events go to the user's default org workspace

Events created in Google Calendar are created as org tasks in the user's default organisation (the one auto-created on signup) and its General space. This matches where the user's other tasks live.

### 4. Past events are blocked

Events with a start date in the past are silently skipped, matching KeilHQ's create dialog behavior:
- All-day events: blocked if before today
- Timed events: blocked if even one minute in the past

### 5. 30-day sync window

Only events within the next 30 days are synced. This prevents quota exhaustion from historical or recurring event explosion.

### 6. PostgreSQL advisory locks for concurrency

`pg_try_advisory_lock(hashtext(userId))` on a dedicated pool connection prevents concurrent incremental sync runs for the same user. The lock is always released in a `finally` block.

### 7. Debounce with delayed fallback

Google sends multiple rapid webhooks for a single change. A 10-second debounce prevents sync spam. When a webhook is debounced, a delayed sync is scheduled 12 seconds later so no change is lost.

### 8. Webhook replay protection

Each webhook notification has a unique `X-Goog-Message-Number`. This is stored in `gcal_webhook_receipts` with a unique constraint. Duplicate notifications are rejected atomically.

### 9. HMAC-signed state parameter

The OAuth state parameter is a base64-encoded JSON payload signed with HMAC-SHA256. Prevents CSRF attacks where a malicious site tricks a user into linking the attacker's Google account.

### 10. Token refresh handled transparently

`getAuthorizedClient` checks if the access token expires within 5 minutes and refreshes it automatically. If refresh fails (token revoked), it returns `null` and sync is silently skipped.

---

## Security Boundaries

| Boundary | Mechanism |
| --- | --- |
| OAuth CSRF protection | HMAC-SHA256 signed state parameter |
| Webhook spoofing | Validate `X-Goog-Channel-ID` + `X-Goog-Resource-ID` pair |
| Webhook replay attacks | `gcal_webhook_receipts` unique constraint on message number |
| Refresh token storage | Stored in `public.user_integrations`, protected by app-level auth |
| Token confidentiality | Refresh token is useless without `GOOGLE_CLIENT_SECRET` |
| Callback endpoint | Public route — protected by state signature verification, not JWT |
| Webhook endpoint | Public route — protected by channel/resource ID validation |
| All other integration endpoints | Protected by `protect` middleware (Supabase JWT) |
| Sync errors | Caught and logged server-side, never exposed to the client |
