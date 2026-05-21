# Backend Guide

## File Structure

```text
backend/src/
├── config/
│   └── index.ts                              # Added: backendUrl (for webhook address)
├── controllers/
│   └── integration.controller.ts             # Updated: handleGoogleCallback (registerWatch),
│                                             #          disconnectGoogle (stopWatch),
│                                             #          handleGoogleWebhook (NEW)
├── migrations/
│   ├── 008_google_calendar_integration.sql   # Original: user_integrations + google_event_id
│   └── 011_gcal_two_way_sync.sql             # NEW: watch columns, ical_uid, receipts table
├── repositories/
│   └── integration.repository.ts             # Updated: +saveWatchChannel, +findByChannelId,
│                                             #          +saveSyncToken, +clearWatchChannel
├── routes/
│   └── integration.routes.ts                 # Updated: POST /google/webhook (public)
├── scripts/
│   └── reset-sync-at.js                      # Utility: reset debounce lock in DB
├── services/
│   ├── gcal-watch-renewal.service.ts         # NEW: renewal cron + self-healing
│   ├── google-calendar.service.ts            # Updated: +registerWatch, +stopWatch,
│                                             #          +doFullSync, +doIncrementalSync,
│                                             #          +processIncomingGoogleEvent,
│                                             #          syncTaskToCalendar (extendedProperties,
│                                             #          skipGoogleSync, timeout)
│   ├── org-task.service.ts                   # Updated: sync on create/update/delete
│   ├── personal-task.service.ts              # Updated: sync on create (was only update)
│   └── task.service.ts                       # Updated: skipGoogleSync option
└── types/
    └── entities.ts                           # Updated: UserIntegration (watch fields),
                                              #          PersonalTask + Task (ical_uid)
```

---

## Database Schema

### `public.user_integrations` — new columns (migration 011)

| Column | Type | Description |
| --- | --- | --- |
| `watch_status` | `gcal_watch_status` enum | Lifecycle state: `pending`, `active`, `degraded`, `revoked` |
| `watch_channel_id` | `TEXT` | UUID identifying the push notification channel |
| `watch_resource_id` | `TEXT` | Returned by Google on `events.watch()`. Required to stop the channel. |
| `watch_expires_at` | `TIMESTAMPTZ` | Channel expiry (max 7-day TTL). Renewed by cron. |
| `gcal_sync_token` | `TEXT` | Incremental sync token. Used to fetch only changed events. |
| `last_sync_at` | `TIMESTAMPTZ` | Timestamp of last webhook-triggered sync. Used for 10-second debounce. |
| `sync_in_progress` | `BOOLEAN` | Flag indicating an active background sync is running. |
| `last_sync_error` | `TEXT` | Error message from the most recent failed sync. |
| `last_successful_sync_at` | `TIMESTAMPTZ` | Timestamp of the last fully completed sync. |

### `public.tasks` and `public.personal_tasks` — new column (migration 011)

| Column | Type | Description |
| --- | --- | --- |
| `ical_uid` | `TEXT` | Google's stable iCalUID. Persists across calendar moves and ownership transfers. |

### `public.gcal_webhook_receipts` — new table (migration 011)

Tracks processed webhook message numbers to prevent replay attacks.

| Column | Type | Description |
| --- | --- | --- |
| `id` | `UUID` | Primary key |
| `channel_id` | `TEXT` | `X-Goog-Channel-ID` header value |
| `resource_id` | `TEXT` | `X-Goog-Resource-ID` header value |
| `message_number` | `BIGINT` | `X-Goog-Message-Number` header value |
| `received_at` | `TIMESTAMPTZ` | When the webhook was received |

Unique constraint: `(channel_id, resource_id, message_number)`

### New unique constraints (migration 011)

| Table | Constraint | Columns |
| --- | --- | --- |
| `public.personal_tasks` | `uq_personal_tasks_user_google_event` | `(owner_user_id, google_event_id)` |
| `public.tasks` | `uq_tasks_user_google_event` | `(created_by, google_event_id)` |

---

## API Endpoints

All endpoints are mounted under `/api/v1/integrations`.

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| `GET` | `/integrations/google/connect` | `protect` | Returns the Google OAuth consent URL |
| `GET` | `/integrations/google/callback` | Public | Handles Google redirect, saves tokens, fires registerWatch |
| `GET` | `/integrations/google/status` | `protect` | Returns connection status for the current user |
| `DELETE` | `/integrations/google` | `protect` | Disconnects Google Calendar, stops watch channel |
| `POST` | `/integrations/google/webhook` | **Public** | Receives Google Calendar push notifications |

### `POST /integrations/google/webhook`

Public endpoint — Google calls this when anything changes on a watched calendar.

**Headers used:**

| Header | Purpose |
| --- | --- |
| `X-Goog-Resource-State` | `sync` = verification ping; `exists` = change notification |
| `X-Goog-Channel-ID` | Identifies which watch channel (and therefore which user) |
| `X-Goog-Resource-ID` | Validated against stored value to prevent spoofing |
| `X-Goog-Message-Number` | Monotonically increasing per channel; used for deduplication |

Always responds `200 OK` immediately. All processing happens asynchronously.

---

## Service Logic

### `google-calendar.service.ts` — new functions

#### `registerWatch(userId)`

Called fire-and-forget after OAuth callback. Registers a Google Calendar push notification channel.

1. Acquires a PostgreSQL advisory lock (`pg_try_advisory_lock`) to prevent concurrent registrations
2. Stops any existing watch channel
3. Calls `calendar.events.watch()` with the `BACKEND_URL/api/v1/integrations/google/webhook` address
4. Runs `doFullSync()` to get the initial `syncToken`
5. Atomically saves channel metadata and sets `watch_status = 'active'`
6. On failure: sets `watch_status = 'degraded'`, logs error, does NOT throw

#### `stopWatch(userId)`

Called when a user disconnects Google Calendar. Stops the active watch channel and clears all channel metadata from the DB.

#### `doFullSync(userId, calendarId, authClient)`

Fetches all events in the 30-day window (`today → today + 30 days`) using `singleEvents: true`. Follows pagination. Calls `processIncomingGoogleEvent()` for each event. Returns the `nextSyncToken`.

#### `doIncrementalSync(userId)`

Called from the webhook handler via `process.nextTick`. Fetches only changed events using the stored `syncToken`.

- `410 Gone`: clears token and runs `doFullSync()` to recover
- `401/403`: sets `watch_status = 'revoked'`, clears watch fields
- Uses PostgreSQL advisory lock to prevent concurrent runs

#### `processIncomingGoogleEvent(userId, event)`

Applies a single incoming Google Calendar event to the KeilHQ task store.

| Condition | Action |
| --- | --- |
| `extendedProperties.private.source = 'keilhq'` | Skip (loop prevention) |
| Start date in the past | Skip |
| Start date > today + 30 days | Skip |
| `status = 'cancelled'` + matching task | Soft-delete the task |
| No matching task + future date | Create org task in user's General space (`status: todo`, `priority: medium`) |
| Matching task + Google is newer by >5s | Update task title/dates (`skipGoogleSync: true`) |
| Matching task + values identical | Skip (no-op) |

After any DB mutation, emits `gcal_tasks_updated` via Socket.io to trigger frontend refresh.

#### `syncTaskToCalendar(userId, task, options?)`

Updated with two new behaviors:

1. **`options.skipGoogleSync = true`**: Returns immediately without any API call. Used by `processIncomingGoogleEvent` to prevent echo loops.
2. **`extendedProperties` tagging**: Every event body now includes `extendedProperties.private.source = 'keilhq'` and `taskId`. This is the primary loop-prevention mechanism.

---

### `gcal-watch-renewal.service.ts` — new file

Two functions called every 12 hours from `index.ts`:

#### `renewExpiringWatchChannels()`

Queries for active channels expiring within `18–30 hours` (randomised jitter to prevent thundering herd). Calls `registerWatch()` for each.

#### `healDegradedWatchChannels()`

Queries for users with `watch_status = 'degraded'`. Attempts `registerWatch()` for each, providing self-healing without user intervention.

---

### `org-task.service.ts` — updated

Google Calendar sync is now wired to all three mutation operations:

| Operation | Sync action |
| --- | --- |
| `createTask` | `syncTaskToCalendar()` fire-and-forget (if `start_date` is set) |
| `updateTask` | `syncTaskToCalendar()` fire-and-forget (unless `skipGoogleSync: true`) |
| `deleteTask` | `deleteCalendarEvent()` fire-and-forget (if `google_event_id` is set) |

Previously, org tasks were never synced to Google Calendar. This was a pre-existing gap.

---

### `personal-task.service.ts` — updated

`createPersonalTask` now calls `syncTaskToCalendar()` fire-and-forget when `start_date` is set. Previously, personal tasks only synced on update.

---

## Integration Repository — new methods

| Method | Description |
| --- | --- |
| `saveWatchChannel(userId, provider, data)` | Persist watch channel metadata + set `watch_status = 'active'` |
| `findByChannelId(channelId)` | Look up integration by channel ID (called on every webhook) |
| `saveSyncToken(userId, provider, syncToken)` | Persist or clear the incremental sync token |
| `clearWatchChannel(userId, provider)` | Reset all watch fields to null/pending (on disconnect or revocation) |

---

## Cron Jobs

### Watch channel renewal (every 12 hours)

Wired in `backend/src/index.ts` via `setInterval`:

```ts
setInterval(async () => {
  await renewExpiringWatchChannels();
  await healDegradedWatchChannels();
}, 12 * 60 * 60 * 1000);
```

---

## Error Handling

| Scenario | Behaviour |
| --- | --- |
| User not connected | `getAuthorizedClient` returns `null` — sync silently skipped |
| Token refresh fails (revoked) | `getAuthorizedClient` returns `null` — sync silently skipped |
| Watch registration fails | `watch_status = 'degraded'` — recovery cron retries every 12 hours |
| `syncToken` expired (410) | Clear token + run `doFullSync()` to recover |
| OAuth revoked (401/403) | `watch_status = 'revoked'` — user must reconnect |
| Duplicate webhook (23505) | Silently discarded via `gcal_webhook_receipts` unique constraint |
| Webhook debounced | Delayed sync scheduled 12 seconds later — no change is lost |
| Concurrent sync | PostgreSQL advisory lock prevents duplicate runs |
| Duplicate task creation (23505) | Treated as idempotent success — logged and ignored |
| Google event not found (404/410) | `google_event_id` cleared — next sync creates a fresh event |
| Any other Google API error | Caught by `.catch()` — logged, task update unaffected |
