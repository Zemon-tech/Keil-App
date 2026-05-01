# Backend Guide

## File Structure

```text
backend/src/
├── config/
│   └── index.ts                          # Added: googleClientId, googleClientSecret,
│                                         #        googleRedirectUri, googleOAuthStateSecret,
│                                         #        frontendUrl
├── controllers/
│   └── integration.controller.ts         # NEW: OAuth connect, callback, status, disconnect
├── migrations/
│   └── 008_google_calendar_integration.sql  # NEW: user_integrations table + google_event_id columns
├── repositories/
│   ├── index.ts                          # Updated: exports integrationRepository
│   └── integration.repository.ts        # NEW: CRUD for user_integrations table
├── routes/
│   ├── integration.routes.ts             # NEW: /integrations/google/* routes
│   └── v1.routes.ts                      # Updated: mounts /integrations
├── services/
│   ├── google-calendar.service.ts        # NEW: OAuth URL, callback, sync, delete
│   ├── task.service.ts                   # Updated: fire-and-forget sync in updateTask/deleteTask
│   └── personal-task.service.ts         # Updated: fire-and-forget sync in updatePersonalTask/deletePersonalTask
└── types/
    └── entities.ts                       # Updated: google_event_id on Task and PersonalTask,
                                          #          new UserIntegration interface
```

## Database Schema

### `public.user_integrations`

Stores one row per user per connected provider.

| Column | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | `UUID` | Yes | Primary key |
| `user_id` | `UUID` | Yes | References `public.users(id)` — cascades on delete |
| `provider` | `TEXT` | Yes | Integration identifier, e.g. `google_calendar` |
| `access_token` | `TEXT` | No | Short-lived access token (refreshed automatically) |
| `refresh_token` | `TEXT` | Yes | Long-lived token used to obtain new access tokens |
| `token_expiry` | `TIMESTAMPTZ` | No | Expiry time of the current access token |
| `calendar_id` | `TEXT` | Yes | Google Calendar ID to sync to. Defaults to `primary` |
| `created_at` | `TIMESTAMPTZ` | Yes | Row creation timestamp |
| `updated_at` | `TIMESTAMPTZ` | Yes | Auto-updated on every change via trigger |

Unique constraint: `(user_id, provider)` — one row per user per provider.

### `public.tasks` — added column

| Column | Type | Description |
| --- | --- | --- |
| `google_event_id` | `TEXT` | Google Calendar event ID. `NULL` if not synced. |

### `public.personal_tasks` — added column

| Column | Type | Description |
| --- | --- | --- |
| `google_event_id` | `TEXT` | Google Calendar event ID. `NULL` if not synced. |

## API Endpoints

All endpoints are mounted under `/api/v1/integrations`.

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| `GET` | `/integrations/google/connect` | `protect` | Returns the Google OAuth consent URL |
| `GET` | `/integrations/google/callback` | Public | Handles Google redirect, saves tokens, redirects to frontend |
| `GET` | `/integrations/google/status` | `protect` | Returns connection status for the current user |
| `DELETE` | `/integrations/google` | `protect` | Disconnects Google Calendar, removes stored tokens |

### `GET /integrations/google/connect`

Returns a Google OAuth URL. The frontend redirects the browser to this URL.

```json
{
  "success": true,
  "data": {
    "url": "https://accounts.google.com/o/oauth2/v2/auth?..."
  }
}
```

### `GET /integrations/google/callback`

Public endpoint — Google redirects here after the user approves or denies consent. Not called by the frontend directly.

- On success: redirects to `FRONTEND_URL/tasks?gcal=connected`
- On error or denial: redirects to `FRONTEND_URL/tasks?gcal=error`

### `GET /integrations/google/status`

```json
// Not connected
{ "success": true, "data": { "connected": false } }

// Connected
{
  "success": true,
  "data": {
    "connected": true,
    "calendar_id": "primary",
    "connected_at": "2026-04-30T10:00:00.000Z"
  }
}
```

### `DELETE /integrations/google`

```json
{ "success": true, "data": null, "message": "Google Calendar disconnected" }
```

## Service Logic

### `google-calendar.service.ts`

The core service. All functions are exported and used by the controller and task services.

#### `getAuthUrl(userId)`

Generates the Google OAuth consent URL. The `state` parameter is a base64-encoded JSON payload `{ userId, ts }` signed with HMAC-SHA256 using `GOOGLE_OAUTH_STATE_SECRET`.

OAuth parameters:
- `access_type: 'offline'` — requests a refresh token
- `prompt: 'consent'` — forces Google to always return a refresh token (even on re-connect)
- `scope: ['https://www.googleapis.com/auth/calendar.events']`

#### `handleCallback(code, state)`

1. Verifies the HMAC signature on the state parameter
2. Decodes `userId` from the state payload
3. Exchanges the auth code for tokens via `oauth2Client.getToken(code)`
4. Upserts the tokens into `user_integrations`

Throws if the state is invalid or Google does not return a refresh token.

#### `getAuthorizedClient(userId)`

1. Loads the `user_integrations` row for the user
2. Returns `null` if not found (user not connected)
3. Checks if the access token expires within 5 minutes
4. If so, calls `oauth2Client.refreshAccessToken()` and saves the new token to the DB
5. Returns the configured `OAuth2Client`

Returns `null` (silent skip) if token refresh fails — this happens when the user revokes access in their Google account settings.

#### `syncTaskToCalendar(userId, task)`

The main sync function. Must always be called fire-and-forget:

```ts
syncTaskToCalendar(userId, { ...task, source: 'tasks' })
  .catch(err => console.error('[gcal] sync failed:', err.message));
```

`SyncableTask` interface:

```ts
interface SyncableTask {
  id: string;
  title: string;
  description?: string | null;
  start_date?: Date | null;
  due_date?: Date | null;
  is_all_day?: boolean;
  location?: string | null;
  status?: string | null;
  google_event_id?: string | null;
  source: 'tasks' | 'personal_tasks';
}
```

Event body mapping:

| Task field | Google Calendar field |
| --- | --- |
| `title` | `summary` |
| `description` | `description` |
| `start_date` | `start.dateTime` (or `start.date` if `is_all_day`) |
| `due_date` | `end.dateTime` (or `end.date` if `is_all_day`). Falls back to `start_date + 1 hour` if null. |
| `location` | `location` |
| `status` | `status` — mapped to `confirmed` / `tentative` / `cancelled` |

#### `deleteCalendarEvent(userId, googleEventId)`

Deletes a Google Calendar event. Silently ignores `404` and `410` responses (event already deleted in Google).

### Integration into task services

Both `task.service.ts` and `personal-task.service.ts` call `syncTaskToCalendar` after a successful DB update, and `deleteCalendarEvent` before a soft delete.

```ts
// In updateTask — after transaction completes
syncTaskToCalendar(userId, {
  ...updatedTask,
  start_date: updatedTask.start_date ? new Date(updatedTask.start_date) : null,
  due_date: updatedTask.due_date ? new Date(updatedTask.due_date) : null,
  source: 'tasks',
}).catch(err => console.error('[gcal] workspace task sync failed:', err.message));

// In deleteTask — before soft delete
if (task.google_event_id) {
  deleteCalendarEvent(userId, task.google_event_id)
    .catch(err => console.error('[gcal] delete event failed:', err.message));
}
```

## Integration Repository

`integration.repository.ts` provides four methods:

| Method | Description |
| --- | --- |
| `findByUserAndProvider(userId, provider)` | Load the integration row. Returns `null` if not connected. |
| `upsert(userId, provider, data)` | Insert or update tokens. Uses `ON CONFLICT DO UPDATE`. |
| `updateTokens(userId, provider, accessToken, expiry)` | Update only the access token after a refresh. |
| `delete(userId, provider)` | Remove the integration row (disconnect). |

## Error Handling

| Scenario | Behaviour |
| --- | --- |
| User not connected | `getAuthorizedClient` returns `null` — sync silently skipped |
| Token refresh fails (revoked) | `getAuthorizedClient` returns `null` — sync silently skipped |
| Google event not found (404/410) | `google_event_id` cleared on task row — next sync creates a fresh event |
| Any other Google API error | Caught by `.catch()` at call site — logged, task update unaffected |
| Invalid OAuth state | `handleCallback` throws — callback redirects to `?gcal=error` |
| Missing refresh token from Google | `handleCallback` throws — callback redirects to `?gcal=error` |
| Google Calendar API not configured | `getGoogleConnectUrl` returns `500` with descriptive message |
