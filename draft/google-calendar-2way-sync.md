# Google Calendar: 1-Way Sync (Current) → 2-Way Sync (Goal)

---

## Part 1: Current 1-Way Sync — Complete Implementation Detail

### Overview
The system uses a **per-user OAuth 2.0 model**. Every user who wants Google Calendar sync must independently connect their own Google account. The backend stores their OAuth tokens and uses them to push calendar events on their behalf whenever they schedule a task in KeilHQ.

The flow is strictly **one direction: App → Google Calendar**. Nothing ever flows back from Google into KeilHQ.

---

### 1.1 Database Structure

**Table: `public.user_integrations`** (Migration `008_google_calendar_integration.sql`)

| Column | Type | Purpose |
| :--- | :--- | :--- |
| `id` | UUID | Primary key |
| `user_id` | UUID | FK to `public.users(id)`, CASCADE DELETE |
| `provider` | TEXT | Always `'google_calendar'` for now |
| `access_token` | TEXT (nullable) | Short-lived token, expires in ~1 hour |
| `refresh_token` | TEXT (NOT NULL) | Long-lived token, used to get new access tokens |
| `token_expiry` | TIMESTAMPTZ (nullable) | When the current access token expires |
| `calendar_id` | TEXT | Which Google calendar to sync to, defaults to `'primary'` |
| `created_at` | TIMESTAMPTZ | When user first connected |
| `updated_at` | TIMESTAMPTZ | Auto-updated by trigger |
| UNIQUE | `(user_id, provider)` | One row per user per provider |

**Column: `google_event_id`** on both `public.tasks` and `public.personal_tasks`
- This is the critical link between a KeilHQ task and a Google Calendar event.
- It is `NULL` when the task has never been synced to Google.
- It is populated after the first sync with the event's ID returned by the Google Calendar API.
- It is set back to `NULL` when the task is unscheduled or the Google event is deleted.

---

### 1.2 OAuth Connection Flow (Step-by-Step)

This is how a user connects their Google Calendar for the first time.

**Step 1 — User clicks "Connect" in Settings**
- Frontend calls `GET /api/v1/integrations/google/connect` with the user's JWT.
- Controller (`integration.controller.ts`) calls `getAuthUrl(userId)` from the Google Calendar service.

**Step 2 — Backend generates a secure OAuth URL**
- `getAuthUrl(userId)` in `google-calendar.service.ts` creates an `OAuth2Client` using `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_REDIRECT_URI`.
- A **signed state parameter** is generated for CSRF protection:
  1. A JSON payload `{ userId, ts: Date.now() }` is base64-encoded.
  2. This payload is then signed with `HMAC-SHA256` using the `GOOGLE_OAUTH_STATE_SECRET` env variable.
  3. The final state string is `"{base64payload}.{hmacSignature}"`.
- The OAuth URL is generated with scope `https://www.googleapis.com/auth/calendar.events`, `access_type: 'offline'`, and `prompt: 'consent'` (to always force Google to return a refresh token).
- The URL is returned to the frontend as `{ url: "https://accounts.google.com/..." }`.

**Step 3 — User is redirected to Google**
- Frontend does `window.location.href = url` — a full page redirect to Google's consent screen.

**Step 4 — User approves access on Google's consent screen**
- Google redirects the user's browser to `GOOGLE_REDIRECT_URI` (which is the backend endpoint `GET /api/v1/integrations/google/callback`) with two query params: `?code=AUTH_CODE&state=SIGNED_STATE`.

**Step 5 — Backend handles the callback**
- `handleCallback(code, state)` in `google-calendar.service.ts`:
  1. **Verifies the HMAC signature** on the state to prevent CSRF attacks. If the signature doesn't match, it throws an error.
  2. **Decodes the userId** from the base64 payload.
  3. **Exchanges the auth code** for tokens by calling `oauth2Client.getToken(code)`, which returns `{ access_token, refresh_token, expiry_date }`.
  4. If `refresh_token` is missing (can happen if the user already granted access before and didn't revoke it), it throws an error telling the user to revoke and reconnect.
  5. **Saves tokens** to `user_integrations` via `integrationRepository.upsert()`, which uses `ON CONFLICT (user_id, provider) DO UPDATE` to handle reconnections gracefully.
- The controller then **redirects the user** back to the frontend at `/tasks?gcal=connected`.

**Step 6 — Frontend shows success toast**
- The frontend detects the `?gcal=connected` query param and shows a success toast.

---

### 1.3 Task Sync Flow (The Core Logic)

This is triggered whenever a task is updated (rescheduled, renamed, deleted, etc.).

**Where is sync triggered?**

Currently, `syncTaskToCalendar()` is called in **two places**:
1. `personal-task.service.ts` → `updatePersonalTask()` — after a personal task is updated in the DB.
2. `task.service.ts` → `updateTask()` — (for workspace/legacy tasks).

> **⚠️ Known Bug:** `syncTaskToCalendar` is NOT called after `createPersonalTask()`. So a brand new personal task never gets pushed to Google Calendar until the user edits it for the first time.

**How is it called?**
```typescript
// Fire-and-forget — the task update is NOT delayed waiting for Google
syncTaskToCalendar(userId, { ...task, source: 'personal_tasks' })
  .catch(err => console.error('[gcal] sync failed:', err.message));
```
The sync is **fire-and-forget** — it never blocks the HTTP response. If Google is down, the task is still saved in your DB successfully.

---

### 1.4 Inside `syncTaskToCalendar()` — Decision Tree

```
syncTaskToCalendar(userId, task)
│
├── Does task have a start_date?
│   └── NO:
│       ├── Does it have a google_event_id?
│       │   └── YES → deleteCalendarEvent(userId, google_event_id)
│       │           → UPDATE tasks SET google_event_id = NULL WHERE id = task.id
│       └── Return (nothing to push)
│
├── Get authorized OAuth client for this user
│   └── Returns NULL? → Return silently (user not connected or token revoked)
│
├── Build the Google Calendar event body:
│   ├── is_all_day = TRUE →
│   │   start: { date: "YYYY-MM-DD" }  ← no time component
│   │   end:   { date: "YYYY-MM-DD" }  ← due_date, or start+1day if no due_date
│   └── is_all_day = FALSE →
│       start: { dateTime: "ISO string" }
│       end:   { dateTime: "ISO string" }  ← due_date, or start+1hour if no due_date
│
├── Does task already have a google_event_id?
│   ├── YES → calendar.events.update(calendarId, eventId, body)
│   └── NO  → calendar.events.insert(calendarId, body)
│             → Save returned event.id back: UPDATE tasks SET google_event_id = event.id
│
└── On 404/410 error from Google (event was deleted in Google directly):
    → Clear google_event_id: UPDATE tasks SET google_event_id = NULL
```

---

### 1.5 Token Refresh (Transparent Auto-Refresh)

Inside `getAuthorizedClient(userId)`:
1. Loads the integration row from DB.
2. Checks if `token_expiry` is within 5 minutes of now.
3. If yes, calls `oauth2Client.refreshAccessToken()` to get a new short-lived access token.
4. Saves the new `access_token` and `token_expiry` back to `user_integrations`.
5. If the refresh call fails (e.g., user revoked access in Google settings), it logs the error and returns `null`, causing sync to be silently skipped.

---

### 1.6 `IntegrationRepository` — 4 Methods

| Method | SQL | When Used |
| :--- | :--- | :--- |
| `findByUserAndProvider(userId, provider)` | SELECT | Before every sync, in `getAuthorizedClient` |
| `upsert(userId, provider, data)` | INSERT … ON CONFLICT DO UPDATE | On OAuth callback success |
| `updateTokens(userId, provider, token, expiry)` | UPDATE | After auto token refresh |
| `delete(userId, provider)` | DELETE | When user clicks "Disconnect" |

---

## Part 2: What is 2-Way Sync?

**Current state (1-way):** KeilHQ → Google Calendar only.
- You schedule a task in KeilHQ → it appears in Google Calendar. ✅
- You move the event in Google Calendar → KeilHQ doesn't know. ❌

**2-way sync:** Both directions work simultaneously.
- KeilHQ → Google: Same as now (already done). ✅
- Google → KeilHQ: If you move, rename, or delete an event in Google Calendar (from phone, another app, or directly on calendar.google.com), that change is automatically reflected in KeilHQ. ✅ (To be built)

---

## Part 3: How to Implement 2-Way Sync

There are two approaches Google supports. You need to understand both.

### Approach A: Polling (Simple but Inefficient)
- Every few minutes, your backend fetches all events from Google Calendar for all connected users and compares them with your DB.
- **Problem:** If you have 1000 users, you're making 1000 API calls every few minutes. Google will rate-limit you. This is not scalable.

### Approach B: Push Notifications (Webhook) — Correct Approach

Google's Calendar API supports **Push Notifications** (also called "Channel Watch"). Here's how it works:

1. **Your backend registers a "Watch"** on a user's calendar by calling `calendar.events.watch()`. You give Google a URL (your webhook endpoint) and it gives you back a `channelId` and a `resourceId`.
2. **Google calls your webhook** every time anything changes on that calendar (event created, moved, renamed, deleted).
3. **Your backend processes the notification**, figures out what changed, and updates your DB accordingly.

The webhook notification from Google does NOT tell you what changed — it only tells you "something changed". You then have to fetch the changes yourself using a `syncToken` (explained below).

---

## Part 4: Edge Cases

This is the section that makes 2-way sync hard. You must handle every one of these:

### Edge Case 1: The Sync Loop (Most Critical)
- **Scenario:** User updates a task in KeilHQ → KeilHQ pushes change to Google → Google detects a change on the calendar → Google calls your webhook → Your backend updates the task in KeilHQ → KeilHQ pushes to Google again → **Infinite loop**.
- **Solution:** Use **Google's `extendedProperties`** on the event. When KeilHQ creates/updates a Google event, it sets a private extended property like `{ private: { source: "keilhq" } }`. When the webhook fires, your backend checks if the incoming event has this property. If yes, it knows KeilHQ made this change and **skips the DB update** entirely.

### Edge Case 2: Watch Channel Expiration
- Google's push notification channels have a **maximum TTL of 7 days**. After 7 days, Google stops sending notifications.
- **Solution:** You must store the channel expiry date and set up a **cron job** that renews all channels that expire within 24 hours by calling `calendar.events.watch()` again.

### Edge Case 3: `syncToken` Expiration
- The `syncToken` (used for incremental sync, see Step 5 in implementation) also expires, typically after **a few days of inactivity**.
- **Solution:** When Google returns a `410 Gone` error for an expired `syncToken`, you must do a **full sync** (fetch all events from scratch) and get a fresh `syncToken`.

### Edge Case 4: Event Created in Google has No Matching KeilHQ Task
- **Scenario:** User creates a new event directly in Google Calendar (not from KeilHQ). Google fires a webhook. Your backend has no task with a matching `google_event_id`.
- **Decision you must make:** Should you create a new KeilHQ task for this Google event? Or ignore it?
- **Decision:** As per the finalized product decisions, we will **create a new Personal Task** in KeilHQ for events created externally in Google, provided they fall within the 30-day sync window.

### Edge Case 5: An Event is Deleted in Google
- The webhook fires. You fetch the events. The event is marked with `status: 'cancelled'` in the Google API response (Google never hard-deletes events from the sync feed — it marks them cancelled).
- **Decision:** We will **soft-delete the matching KeilHQ task** (set `deleted_at`) but keep the record in our DB.

### Edge Case 6: Conflict Resolution (Both Sides Changed)
- **Scenario:** User updates the task in KeilHQ (offline or quickly), and also moves the event in Google at the same time.
- **Solution:** Use **"last write wins"** based on `updated_at`. Compare the task's `updated_at` timestamp in your DB with the event's `updated` timestamp from the Google API. Whichever is newer wins.

### Edge Case 7: User Revokes Access in Google
- The user goes to their Google account settings and manually revokes KeilHQ's calendar access.
- The next time `getAuthorizedClient()` tries to refresh the token, it will fail.
- **Current behavior:** Already handled — it returns `null` and sync is silently skipped.
- **Additional step needed for 2-way sync:** The watch channel for that user will also stop working. You need to detect the revocation (via a `401` on the watch call) and clean up the `user_integrations` row.

### Edge Case 8: Google Webhook Verification
- Google will send a first **sync message** to your webhook endpoint immediately after you register a watch. This is a `HEAD` or `POST` request with a `X-Goog-Resource-State: sync` header. Your endpoint must respond with `200 OK` to confirm the webhook URL is valid.
- **Solution:** Add a check at the top of your webhook handler for `X-Goog-Resource-State: sync` and return 200 immediately.

### Edge Case 9: Webhook Receives Events for Multiple Users
- Each user has their own watch channel (registered with their own `channelId`).
- Google sends each notification with a `X-Goog-Channel-ID` header which matches the `channelId` you registered.
- **Solution:** You must look up which user owns that `channelId` and fetch changes using that user's OAuth token.

---

## Part 5: Why is This Hard?

1. **Your webhook endpoint must be publicly reachable by Google.** During development, `localhost` doesn't work. You need a tool like `ngrok` to expose your local server, or you deploy to a staging server. This makes local testing very slow.

2. **Google doesn't tell you WHAT changed**, only that SOMETHING changed. You have to do a second API call (with the `syncToken`) to find out what. This is two network hops per notification.

3. **You can't test it easily.** To trigger the webhook, you have to actually make a change in Google Calendar and wait for the notification. You can't unit test the full flow without mocking the entire Google API.

4. **The sync loop problem has no "clean" solution.** Extended properties are the standard approach but they add complexity to every single push operation you do.

5. **Channel renewal is an operational concern.** It's easy to forget that channels expire in 7 days and suddenly all your 2-way sync silently breaks for all users.

6. **Token expiry interacts with everything.** You need a valid OAuth token to both receive (watch) and process (fetch) changes. Token refresh can fail at any point.

---

## Part 6: Step-by-Step Implementation Guide (Backend Only)

### Step 1 — Database Migration (New file: `009_gcal_two_way_sync.sql`)

Add these columns to `user_integrations` to support channel management:

```sql
ALTER TABLE public.user_integrations
  ADD COLUMN IF NOT EXISTS watch_channel_id    TEXT,
  ADD COLUMN IF NOT EXISTS watch_resource_id   TEXT,
  ADD COLUMN IF NOT EXISTS watch_expires_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS gcal_sync_token     TEXT;

-- Index for fast lookup by channel_id on webhook arrival
CREATE INDEX IF NOT EXISTS idx_user_integrations_channel_id
  ON public.user_integrations(watch_channel_id)
  WHERE watch_channel_id IS NOT NULL;
```

| New Column | Purpose |
| :--- | :--- |
| `watch_channel_id` | UUID you generate when registering a watch. Used to identify which user a webhook notification belongs to. |
| `watch_resource_id` | Returned by Google on `events.watch()`. Required to STOP the watch (unsubscribe) when user disconnects. |
| `watch_expires_at` | When Google will stop sending notifications. Must be renewed before this date. |
| `gcal_sync_token` | The token Google gives you after a full sync or incremental sync. Used to fetch only the events that changed since the last check. |

---

### Step 2 — Add 3 New Methods to `IntegrationRepository`

```typescript
// Save watch channel details after registering a watch with Google
saveWatchChannel(userId: string, provider: string, data: {
  channelId: string;
  resourceId: string;
  expiresAt: Date;
}): Promise<void>

// Look up a user by their watch channelId (called on every webhook hit)
findByChannelId(channelId: string): Promise<UserIntegration | null>

// Save the syncToken returned by Google after processing changes
saveSyncToken(userId: string, provider: string, syncToken: string): Promise<void>

// Clear watch channel details (called on disconnect or revocation)
clearWatchChannel(userId: string, provider: string): Promise<void>
```

---

### Step 3 — Add `registerWatch()` to `google-calendar.service.ts`

This function is called **once per user** after they connect their Google Calendar.

```typescript
export async function registerWatch(userId: string): Promise<void> {
  const authClient = await getAuthorizedClient(userId);
  if (!authClient) return;

  const integration = await integrationRepository.findByUserAndProvider(userId, PROVIDER);
  if (!integration) return;

  const calendar = google.calendar({ version: 'v3', auth: authClient });
  const channelId = uuidv4(); // generate a unique ID for this watch channel
  const ttlMs = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

  const response = await calendar.events.watch({
    calendarId: integration.calendar_id || 'primary',
    requestBody: {
      id: channelId,
      type: 'web_hook',
      address: `${config.backendUrl}/api/v1/integrations/google/webhook`,
      expiration: String(Date.now() + ttlMs),
    },
  });

  await integrationRepository.saveWatchChannel(userId, PROVIDER, {
    channelId,
    resourceId: response.data.resourceId!,
    expiresAt: new Date(Date.now() + ttlMs),
  });

  // Also do a full initial sync to get the first syncToken
  await doFullSync(userId, integration.calendar_id || 'primary', authClient);
}
```

---

### Step 4 — Add `doFullSync()` and `doIncrementalSync()` to `google-calendar.service.ts`

**`doFullSync()`** — Called once when a watch is first registered, or when a `syncToken` expires (410 error):
```typescript
async function doFullSync(userId: string, calendarId: string, authClient: OAuth2Client): Promise<void> {
  const calendar = google.calendar({ version: 'v3', auth: authClient });
  
  // Fetch all events. This returns a syncToken at the end of the last page.
  let pageToken: string | undefined;
  let syncToken: string | undefined;

  do {
    const response = await calendar.events.list({
      calendarId,
      singleEvents: true,
      pageToken,
    });
    
    // Process events — we now import events that aren't already in KeilHQ
    for (const event of response.data.items ?? []) {
      await processIncomingGoogleEvent(userId, event);
    }
    
    pageToken = response.data.nextPageToken ?? undefined;
    syncToken = response.data.nextSyncToken ?? undefined;
  } while (pageToken);

  if (syncToken) {
    await integrationRepository.saveSyncToken(userId, PROVIDER, syncToken);
  }
}
```

**`doIncrementalSync()`** — Called every time a webhook fires for this user:
```typescript
export async function doIncrementalSync(userId: string): Promise<void> {
  const authClient = await getAuthorizedClient(userId);
  if (!authClient) return;

  const integration = await integrationRepository.findByUserAndProvider(userId, PROVIDER);
  if (!integration || !integration.gcal_sync_token) return;

  const calendar = google.calendar({ version: 'v3', auth: authClient });

  try {
    const response = await calendar.events.list({
      calendarId: integration.calendar_id || 'primary',
      syncToken: integration.gcal_sync_token,
    });

    // Process each changed event
    for (const event of response.data.items ?? []) {
      await processIncomingGoogleEvent(userId, event);
    }

    // Save the new syncToken for the next incremental sync
    if (response.data.nextSyncToken) {
      await integrationRepository.saveSyncToken(userId, PROVIDER, response.data.nextSyncToken);
    }

  } catch (err: any) {
    if (err?.code === 410) {
      // syncToken expired — do a full sync to get a fresh one
      await doFullSync(userId, integration.calendar_id || 'primary', authClient);
    } else {
      throw err;
    }
  }
}
```

---

### Step 5 — Add `processIncomingGoogleEvent()` — The Core Inbound Logic

```typescript
async function processIncomingGoogleEvent(userId: string, event: calendar_v3.Schema$Event): Promise<void> {
  // --- SYNC LOOP PREVENTION ---
  // If this event was pushed by KeilHQ, skip it to avoid an infinite loop.
  const source = event.extendedProperties?.private?.source;
  if (source === 'keilhq') return;

  const googleEventId = event.id;
  if (!googleEventId) return;

  // Find if we have a matching task in our DB
  const matchingTask = await findTaskByGoogleEventId(googleEventId);
  // (This requires a new helper that queries both `tasks` and `personal_tasks`)

  if (!matchingTask) {
    // Edge Case 4: Event not created by us — CREATE as Personal Task
    // Only import if it's within our 30-day window and not in the past
    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    
    const isAllDay = !!event.start?.date;
    const startDate = isAllDay ? new Date(event.start!.date!) : new Date(event.start!.dateTime!);
    
    if (startDate >= now && startDate <= thirtyDaysFromNow) {
      await personalTaskRepository.create({
        owner_user_id: userId,
        title: event.summary || 'Untitled Google Event',
        start_date: startDate,
        due_date: isAllDay ? new Date(event.end!.date!) : new Date(event.end!.dateTime!),
        google_event_id: googleEventId,
        status: 'backlog', // Default status
        priority: 'medium', // Default priority
      });
    }
    return;
  }

  // Edge Case 5: Event was deleted in Google
  if (event.status === 'cancelled') {
    // Soft-delete the matching KeilHQ task as per product decision
    await softDeleteTask(matchingTask.id, matchingTask.source);
    return;
  }

  // --- Parse the incoming event dates ---
  const isAllDay = !!event.start?.date; // Google uses `date` for all-day, `dateTime` for timed
  const startDate = isAllDay
    ? new Date(event.start!.date!)
    : new Date(event.start!.dateTime!);
  const dueDate = isAllDay
    ? new Date(event.end!.date!)
    : new Date(event.end!.dateTime!);
  const newTitle = event.summary ?? matchingTask.title;

  // --- Conflict Resolution: Last Write Wins ---
  const googleUpdatedAt = new Date(event.updated!);
  const ourUpdatedAt = new Date(matchingTask.updated_at);

  if (googleUpdatedAt <= ourUpdatedAt) {
    // Our version is newer — Google's change is stale, ignore it
    return;
  }

  // Google's version is newer — update our task
  if (matchingTask.source === 'personal_tasks') {
    await personalTaskRepository.update(matchingTask.id, {
      title: newTitle,
      start_date: startDate,
      due_date: dueDate,
    });
  } else {
    await orgTaskRepository.update(matchingTask.id, {
      title: newTitle,
      start_date: startDate,
      due_date: dueDate,
    });
  }
}

---

### Step 5.1 — New Helper Functions

These helpers are required to manage the link between Google Events and KeilHQ tasks across both `tasks` (Org) and `personal_tasks` tables.

```typescript
async function findTaskByGoogleEventId(googleEventId: string): Promise<{ id: string, source: 'tasks' | 'personal_tasks', title: string, updated_at: Date } | null> {
  // 1. Search in Personal Tasks
  const personalResult = await pool.query(
    'SELECT id, title, updated_at FROM public.personal_tasks WHERE google_event_id = $1',
    [googleEventId]
  );
  if (personalResult.rows.length > 0) {
    return { ...personalResult.rows[0], source: 'personal_tasks' };
  }

  // 2. Search in Org Tasks
  const orgResult = await pool.query(
    'SELECT id, title, updated_at FROM public.tasks WHERE google_event_id = $1',
    [googleEventId]
  );
  if (orgResult.rows.length > 0) {
    return { ...orgResult.rows[0], source: 'tasks' };
  }

  return null;
}

async function softDeleteTask(id: string, source: 'tasks' | 'personal_tasks'): Promise<void> {
  const table = source === 'tasks' ? 'public.tasks' : 'public.personal_tasks';
  await pool.query(
    `UPDATE ${table} SET deleted_at = NOW(), google_event_id = NULL WHERE id = $1`,
    [id]
  );
}

async function clearGoogleEventId(id: string, source: 'tasks' | 'personal_tasks'): Promise<void> {
  const table = source === 'tasks' ? 'public.tasks' : 'public.personal_tasks';
  await pool.query(
    `UPDATE ${table} SET google_event_id = NULL WHERE id = $1`,
    [id]
  );
}
```

---

### Step 6 — Update `syncTaskToCalendar()` to Tag Events as KeilHQ-Owned

Add `extendedProperties` to every event body your backend sends to Google:

```typescript
// Inside buildEventBody(task):
extendedProperties: {
  private: {
    source: 'keilhq',      // Identifies events created by us
    taskId: task.id,        // Optional but useful for debugging
  }
}
```

This is the fix for **Edge Case 1 (Sync Loop)**.

---

### Step 7 — Add Webhook Handler to `integration.controller.ts`

```typescript
export const handleGoogleWebhook = async (req: Request, res: Response): Promise<void> => {
  // Step 1: Always respond 200 immediately. Google will retry if you're slow.
  res.status(200).send();

  // Step 2: Handle Google's initial sync verification ping
  const resourceState = req.headers['x-goog-resource-state'];
  if (resourceState === 'sync') return; // Just a verification ping, ignore

  // Step 3: Identify which user this notification is for
  const channelId = req.headers['x-goog-channel-id'] as string;
  if (!channelId) return;

  const integration = await integrationRepository.findByChannelId(channelId);
  if (!integration) return; // Unknown channel, ignore

  // Step 4: Run incremental sync for this user (fire-and-forget)
  doIncrementalSync(integration.user_id)
    .catch(err => console.error(`[gcal] incremental sync failed for user ${integration.user_id}:`, err.message));
};
```

---

### Step 8 — Register the Webhook Route

In `integration.routes.ts`, add:
```typescript
// PUBLIC — Google calls this, no JWT middleware
router.post('/google/webhook', handleGoogleWebhook);
```

> **CRITICAL:** This route must be **publicly accessible** from the internet. During development you must use `ngrok` or a similar tunnel. Google cannot call `localhost`.

---

### Step 9 — Register Watch After User Connects

In `handleGoogleCallback()` inside `integration.controller.ts`, after saving tokens, call:
```typescript
// Fire-and-forget — don't block the redirect
registerWatch(userId)
  .catch(err => console.error('[gcal] watch registration failed:', err.message));
```

Also call `stopWatch()` in `disconnectGoogle()`:
```typescript
export async function stopWatch(userId: string): Promise<void> {
  const integration = await integrationRepository.findByUserAndProvider(userId, PROVIDER);
  if (!integration?.watch_channel_id || !integration?.watch_resource_id) return;

  const authClient = await getAuthorizedClient(userId);
  if (!authClient) return;

  const calendar = google.calendar({ version: 'v3', auth: authClient });
  await calendar.channels.stop({
    requestBody: {
      id: integration.watch_channel_id,
      resourceId: integration.watch_resource_id,
    },
  });

  await integrationRepository.clearWatchChannel(userId, PROVIDER);
}
```

---

### Step 10 — Channel Renewal Cron Job

Add to `task-overdue-worker.service.ts` (or a new file `gcal-watch-renewal.service.ts`):

```typescript
export async function renewExpiringWatchChannels(): Promise<void> {
  const result = await pool.query(`
    SELECT user_id FROM public.user_integrations
    WHERE provider = 'google_calendar'
      AND watch_expires_at IS NOT NULL
      AND watch_expires_at < NOW() + INTERVAL '24 hours'
  `);

  for (const row of result.rows) {
    await registerWatch(row.user_id)
      .catch(err => console.error(`[gcal] watch renewal failed for user ${row.user_id}:`, err.message));
  }
}
```

Run this cron every 12 hours.

---

## All Product Decisions — LOCKED ✅

| Decision | Answer |
| :--- | :--- |
| New Google event (not from KeilHQ) → create KeilHQ task? | **Yes** — create as personal task with default status/priority |
| Date cutoff for imported events | **Today onwards only** (ignore past events) |
| Recurring events — how many occurrences to import? | **Next 30 days** of occurrences only |
| Google event deleted → KeilHQ task? | **Soft-delete the KeilHQ task** |
| Holidays source | **User's own Google Calendar** holiday subscriptions |
| Holidays for non-connected users | **Don't show** holidays if not connected to Google |

---

## Event Mapping: Tasks vs. Events

Google Calendar only has **Events**. KeilHQ has both **Tasks** and **Events**.

1.  **Inbound (Google → KeilHQ):**
    *   All new events from Google are created as **Personal Tasks** in KeilHQ.
    *   They use `status: 'backlog'` and `priority: 'medium'` by default.
    *   If the Google event has a time (`dateTime`), it maps to KeilHQ's timed scheduling. If it only has a `date`, it maps to KeilHQ's **All-day** flag.

2.  **Outbound (KeilHQ → Google):**
    *   Both `tasks` and `personal_tasks` are pushed to Google as events.
    *   For `tasks`, if `type === 'event'`, we can optionally include the `location` and `event_type` in the Google description or extended properties.

---

## National Holidays Implementation

### How It Works
Google users can subscribe to holiday calendars (e.g., "Holidays in India") inside their Google Calendar. These appear in their `calendarList` with IDs like `en.indian#holiday@group.v.calendar.google.com`.

### New DB Column on `user_integrations`
```sql
ALTER TABLE public.user_integrations
  ADD COLUMN IF NOT EXISTS holiday_calendar_ids TEXT[] DEFAULT '{}';
```

### New Table: `user_holiday_events`
```sql
CREATE TABLE public.user_holiday_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  google_event_id TEXT NOT NULL,
  title           TEXT NOT NULL,
  date            DATE NOT NULL,
  country_code    TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, google_event_id)
);
```

### Flow
1. On connect: call `calendarList.list()`, find calendars with `#holiday` in their ID, save IDs to `holiday_calendar_ids`.
2. Fetch events from each holiday calendar for current year → store in `user_holiday_events`.
3. Serve via `GET /api/v1/integrations/google/holidays?year=YYYY`.
4. Cron job on Jan 1st every year: re-fetch for all connected users.
5. If no holiday calendar subscribed in Google → table stays empty → no holidays shown in KeilHQ.

---

## Complete Finalized Architecture

```
User connects Google Calendar
          │
          ▼
1. Save OAuth tokens to user_integrations
2. calendarList.list() → find holiday calendars → save IDs to holiday_calendar_ids
3. Fetch holiday events for current year → store in user_holiday_events
4. registerWatch() on primary calendar (7-day TTL)
5. doFullSync():
   ├── events.list(calendarId='primary', timeMin=TODAY, timeMax=TODAY+30days,
   │             singleEvents=true)  ← expands recurring events
   │     For each event:
   │     ├── extendedProperties.private.source === 'keilhq'? → Skip
   │     ├── Has matching google_event_id in DB? → Skip (already ours)
   │     └── New external event, date >= TODAY? → Create personal task
   └── Save syncToken

Webhook POST /api/v1/integrations/google/webhook
          │
          ▼
1. Respond 200 immediately
2. X-Goog-Resource-State === 'sync'? → return (verification ping)
3. Look up user via X-Goog-Channel-ID → find user_integrations row
4. doIncrementalSync() [fire-and-forget]:
   ├── events.list(syncToken=saved_token)
   │     For each changed event:
   │     ├── source === 'keilhq'? → SKIP (sync loop prevention)
   │     ├── status === 'cancelled'? → soft-delete matching KeilHQ task
   │     ├── Matches google_event_id in DB? → update task (last-write-wins by updated_at)
   │     └── No match + date >= TODAY and <= TODAY+30days? → create personal task
   └── Save new syncToken (or full resync on 410)

Cron: Every 12 hours
   → Renew any watch channels expiring within 24 hours

Cron: Every January 1st
   → Re-fetch holiday events for all connected users
```

---

# Part 7: Final Implementation Roadmap (Checklist)

Follow these steps in order to build the feature safely:

### Phase 1: Database & Repository Setup
- [ ] **1.1 Migration:** Run `009_gcal_two_way_sync.sql` to add channel tracking and sync tokens.
- [ ] **1.2 Repository Methods:** Add `saveWatchChannel`, `findByChannelId`, and `saveSyncToken` to `IntegrationRepository`.
- [ ] **1.3 Cross-Table Helpers:** Implement `findTaskByGoogleEventId`, `softDeleteTask`, and `clearGoogleEventId` (Step 5.1).

### Phase 2: Outbound Logic (Loop Prevention)
- [ ] **2.1 Tagging:** Update `syncTaskToCalendar` to include `extendedProperties.private.source: 'keilhq'` in the Google event body.

### Phase 3: Webhook & Inbound Logic
- [ ] **3.1 Public Route:** Add the `/api/v1/integrations/google/webhook` route (POST). Ensure it is public.
- [ ] **3.2 Webhook Handler:** Implement `handleGoogleWebhook` with 200 OK response and `sync` verification check.
- [ ] **3.3 Sync Logic:** Implement `doIncrementalSync` and `doFullSync`.
- [ ] **3.4 Processor:** Implement `processIncomingGoogleEvent` (with task creation and soft-delete logic).

### Phase 4: Lifecycle & Operations
- [ ] **4.1 Registration:** Call `registerWatch()` inside the OAuth callback controller.
- [ ] **4.2 Cleanup:** Call `stopWatch()` during the "Disconnect Google" flow.
- [ ] **4.3 Cron Job:** Add the watch renewal cron job (runs every 12 hours).

### Phase 5: Holidays & Polish
- [ ] **5.1 Holiday Sync:** Implement the holiday calendar discovery and event fetching flow.
- [ ] **5.2 Testing:** Use `ngrok` to verify the webhook receives events from a real Google Calendar.
