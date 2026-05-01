# Google Calendar Integration Plan

## Context

One-way push sync (app → Google Calendar). When a user schedules a task on the calendar (drag-drop sets `start_date` + `due_date`), the backend immediately pushes it to their personal Google Calendar. Updates and deletions follow the same path. Works for both workspace/org tasks and personal tasks.

**Key constraints:**
- Google sync must never block or fail a task update — fire-and-forget, best-effort only
- Each user connects their own Google account (per-user OAuth, not a service account)
- Existing Google login uses Supabase OAuth — those tokens are NOT usable for Calendar. A separate OAuth grant with `calendar.events` scope is required
- Same Google Cloud project + Client ID/Secret can be reused from existing Google login setup
- `google_event_id` stored on the task row is the link between your task and the Google Calendar event — required for update/delete
- Personal tasks (`personal_tasks` table) also sync, not just workspace tasks

---

## Phase 1 — Database Migration

**File:** `backend/src/migrations/008_google_calendar_integration.sql`

### Changes

```sql
-- Store OAuth tokens per user per provider
CREATE TABLE public.user_integrations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  provider        TEXT NOT NULL,           -- 'google_calendar'
  access_token    TEXT,
  refresh_token   TEXT NOT NULL,
  token_expiry    TIMESTAMPTZ,
  calendar_id     TEXT NOT NULL DEFAULT 'primary',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, provider)
);

CREATE INDEX idx_user_integrations_user_id ON public.user_integrations(user_id);

-- Link tasks to their Google Calendar event
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS google_event_id TEXT;
ALTER TABLE public.personal_tasks ADD COLUMN IF NOT EXISTS google_event_id TEXT;
```

### Acceptance criteria
- [ ] Migration runs without error on existing DB
- [ ] `user_integrations` table exists with correct columns and constraints
- [ ] `google_event_id` column exists on both `tasks` and `personal_tasks`

---

## Phase 2 — Backend Config

**File:** `backend/src/config/index.ts`

Add to config object:
```ts
googleClientId: process.env.GOOGLE_CLIENT_ID || "",
googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
googleRedirectUri: process.env.GOOGLE_REDIRECT_URI || "",
googleOAuthStateSecret: process.env.GOOGLE_OAUTH_STATE_SECRET || "",
frontendUrl: process.env.FRONTEND_URL || "http://localhost:5173",
```

**File:** `backend/.env` — add:
```
GOOGLE_CLIENT_ID=          # same value already used for Supabase Google login
GOOGLE_CLIENT_SECRET=      # same value already used for Supabase Google login
GOOGLE_REDIRECT_URI=http://localhost:5000/api/v1/integrations/google/callback
GOOGLE_OAUTH_STATE_SECRET= # random string, e.g. openssl rand -hex 32
FRONTEND_URL=http://localhost:5173
```

**Package:** Add `googleapis` to backend dependencies.

### Acceptance criteria
- [ ] `config` object exports all 5 new fields
- [ ] `googleapis` installed and importable

---

## Phase 3 — Integration Repository

**File:** `backend/src/repositories/integration.repository.ts`

```ts
class IntegrationRepository {
  findByUserAndProvider(userId: string, provider: string): Promise<UserIntegration | null>
  upsert(userId: string, provider: string, data: UpsertIntegrationData): Promise<UserIntegration>
  updateTokens(userId: string, provider: string, accessToken: string, expiry: Date): Promise<void>
  delete(userId: string, provider: string): Promise<void>
}
```

Add `UserIntegration` interface to `backend/src/types/entities.ts`:
```ts
export interface UserIntegration {
  id: string;
  user_id: string;
  provider: string;
  access_token: string | null;
  refresh_token: string;
  token_expiry: Date | null;
  calendar_id: string;
  created_at: Date;
  updated_at: Date;
}
```

Export from `backend/src/repositories/index.ts`.

### Acceptance criteria
- [ ] All 4 methods work against the DB
- [ ] `upsert` uses `ON CONFLICT (user_id, provider) DO UPDATE`

---

## Phase 4 — Google Calendar Service

**File:** `backend/src/services/google-calendar.service.ts`

### `getAuthUrl(userId: string): string`
- Creates OAuth2 client with Client ID + Secret
- Generates URL with scope `https://www.googleapis.com/auth/calendar.events`
- `access_type: 'offline'`, `prompt: 'consent'`
- State param: `Buffer.from(JSON.stringify({ userId, ts: Date.now() })).toString('base64')` signed with `GOOGLE_OAUTH_STATE_SECRET` (use `crypto.createHmac`)

### `handleCallback(code: string, state: string): Promise<void>`
- Verify state HMAC — throw if invalid
- Decode state to get `userId`
- Exchange `code` for tokens via `oauth2Client.getToken(code)`
- Save to `user_integrations` via repository upsert
- Throws `ApiError(400, ...)` on invalid state or token exchange failure

### `getAuthorizedClient(userId: string): Promise<OAuth2Client | null>`
- Load integration row — return `null` if not found
- Set credentials on OAuth2 client
- If `token_expiry` is within 5 minutes, call `oauth2Client.refreshAccessToken()`, save new access token + expiry back to DB
- Return configured client

### `syncTaskToCalendar(userId: string, task: SyncableTask): Promise<void>`
```ts
interface SyncableTask {
  id: string;
  title: string;
  description?: string | null;
  start_date?: Date | null;
  due_date?: Date | null;
  is_all_day?: boolean;
  location?: string | null;
  status?: string;
  google_event_id?: string | null;
  // source table — needed to write google_event_id back
  source: 'tasks' | 'personal_tasks';
}
```

Logic:
```
if no start_date:
  if google_event_id exists → deleteCalendarEvent(userId, google_event_id), clear google_event_id on task row
  return

get authorized client → return if null (not connected)

build Google event object:
  summary: task.title
  description: task.description ?? undefined
  location: task.location ?? undefined
  status: map task status → 'confirmed' | 'tentative' | 'cancelled' (default 'confirmed')
  if is_all_day:
    start: { date: format(start_date, 'yyyy-MM-dd') }
    end: { date: format(due_date ?? addDays(start_date, 1), 'yyyy-MM-dd') }
  else:
    start: { dateTime: start_date.toISOString() }
    end: { dateTime: (due_date ?? addHours(start_date, 1)).toISOString() }

if google_event_id:
  call calendar.events.update(calendarId, google_event_id, event)
else:
  call calendar.events.insert(calendarId, event)
  save returned event.id as google_event_id on the task row
    → UPDATE tasks/personal_tasks SET google_event_id = $1 WHERE id = $2
```

### `deleteCalendarEvent(userId: string, googleEventId: string): Promise<void>`
- Get authorized client → return if null
- Call `calendar.events.delete(calendarId, googleEventId)`
- Ignore 404/410 errors (event already deleted in Google)

### Acceptance criteria
- [ ] `getAuthUrl` returns a valid Google OAuth URL
- [ ] `handleCallback` saves tokens to DB
- [ ] `syncTaskToCalendar` creates a Google event and writes `google_event_id` back to the task row
- [ ] `syncTaskToCalendar` updates existing event when `google_event_id` is present
- [ ] `syncTaskToCalendar` deletes Google event when `start_date` is cleared
- [ ] `deleteCalendarEvent` ignores 404/410
- [ ] All functions return early (no error thrown) when user has not connected Google Calendar

---

## Phase 5 — Integration Controller + Routes

**File:** `backend/src/controllers/integration.controller.ts`

```ts
// GET /api/v1/integrations/google/connect  (protected)
// Returns { url: string }
export const getGoogleConnectUrl = catchAsync(async (req, res) => {
  const userId = (req as any).user.id;
  const url = getAuthUrl(userId);
  res.json(new ApiResponse(200, { url }, "Auth URL generated"));
});

// GET /api/v1/integrations/google/callback  (public — Google redirects here)
export const handleGoogleCallback = catchAsync(async (req, res) => {
  const { code, state, error } = req.query;
  if (error || !code || !state) {
    return res.redirect(`${config.frontendUrl}/tasks?gcal=error`);
  }
  try {
    await handleCallback(code as string, state as string);
    res.redirect(`${config.frontendUrl}/tasks?gcal=connected`);
  } catch {
    res.redirect(`${config.frontendUrl}/tasks?gcal=error`);
  }
});

// GET /api/v1/integrations/google/status  (protected)
// Returns { connected: boolean, calendar_id?: string, connected_at?: string }
export const getGoogleStatus = catchAsync(async (req, res) => { ... });

// DELETE /api/v1/integrations/google  (protected)
export const disconnectGoogle = catchAsync(async (req, res) => { ... });
```

**File:** `backend/src/routes/integration.routes.ts`
```ts
router.get('/google/connect', protect, getGoogleConnectUrl);
router.get('/google/callback', handleGoogleCallback);       // no protect — public
router.get('/google/status', protect, getGoogleStatus);
router.delete('/google', protect, disconnectGoogle);
```

**File:** `backend/src/routes/v1.routes.ts` — add:
```ts
import integrationRoutes from './integration.routes';
router.use('/integrations', integrationRoutes);
```

### Acceptance criteria
- [ ] `GET /api/v1/integrations/google/connect` returns a URL (requires valid JWT)
- [ ] `GET /api/v1/integrations/google/callback` redirects to frontend with `?gcal=connected` on success
- [ ] `GET /api/v1/integrations/google/status` returns correct connected state
- [ ] `DELETE /api/v1/integrations/google` removes the integration row

---

## Phase 6 — Hook Sync into Task Services

### `backend/src/services/task.service.ts`

In `updateTask`, after the DB update succeeds:
```ts
// Fire-and-forget — never await, never throw
syncTaskToCalendar(userId, {
  ...updatedTask,
  source: 'tasks',
}).catch(err => console.error('[gcal] workspace task sync failed:', err.message));
```

In `deleteTask`, before soft-delete:
```ts
if (existingTask.google_event_id) {
  deleteCalendarEvent(userId, existingTask.google_event_id)
    .catch(err => console.error('[gcal] delete event failed:', err.message));
}
```

### `backend/src/services/personal-task.service.ts`

Same pattern in `updatePersonalTask` and `deletePersonalTask`.

### `backend/src/types/entities.ts`

Add `google_event_id?: string | null` to both `Task` and `PersonalTask` interfaces.

### Constraints
- `userId` must be passed through to the service functions — check that `updateTask` and `updatePersonalTask` already receive it (they do via controller)
- Do NOT await the sync call
- Do NOT let sync errors propagate to the HTTP response

### Acceptance criteria
- [ ] Scheduling a task (setting `start_date` + `due_date`) creates a Google Calendar event
- [ ] Rescheduling updates the existing event
- [ ] Clearing `start_date` deletes the Google event
- [ ] Deleting a task deletes the Google event
- [ ] Task update succeeds even if Google sync throws

---

## Phase 7 — Frontend Hook

**File:** `frontend/src/hooks/api/useGoogleCalendar.ts`

```ts
export interface GoogleCalendarStatus {
  connected: boolean;
  calendar_id?: string;
  connected_at?: string;
}

// Fetches connection status
export function useGoogleCalendarStatus(): UseQueryResult<GoogleCalendarStatus>

// Returns a function that calls /connect, gets the URL, redirects
export function useConnectGoogleCalendar(): () => Promise<void>

// Mutation that calls DELETE /integrations/google, invalidates status query
export function useDisconnectGoogleCalendar(): UseMutationResult
```

`useConnectGoogleCalendar` implementation:
```ts
const connect = async () => {
  const { data } = await api.get('v1/integrations/google/connect');
  window.location.href = data.data.url;  // full redirect to Google consent
};
```

### Acceptance criteria
- [ ] `useGoogleCalendarStatus` returns `{ connected: false }` when not connected
- [ ] `useConnectGoogleCalendar` redirects to Google consent page
- [ ] `useDisconnectGoogleCalendar` invalidates the status query on success

---

## Phase 8 — Frontend: Connectors Tab UI

**File:** `frontend/src/components/SettingsDialog.tsx` — update `ConnectorsTab`

Replace the hardcoded `connectors` array's Google Calendar entry with live data.

```tsx
function ConnectorsTab() {
  const { data: gcalStatus, isLoading: gcalLoading } = useGoogleCalendarStatus();
  const connectGcal = useConnectGoogleCalendar();
  const disconnectGcal = useDisconnectGoogleCalendar();

  // Keep other connectors (GitHub, Slack, etc.) as static placeholders
  // Only Google Calendar is wired up
}
```

Google Calendar row UI:
- Status indicator: green dot + "Connected" or grey dot + "Not connected"
- Button: "Connect" (default variant) or "Disconnect" (outline variant)
- While `gcalLoading`: show `<Loader2>` spinner on button, disable it
- While `disconnectGcal.isPending`: show spinner on Disconnect button

### Acceptance criteria
- [ ] Shows correct connected/disconnected state on load
- [ ] "Connect" button redirects to Google consent
- [ ] "Disconnect" button removes integration and updates UI
- [ ] Loading states are handled (no flash of wrong state)

---

## Phase 9 — Handle OAuth Redirect Back

**File:** `frontend/src/components/TasksPage.tsx`

Add `useEffect` at the top of the component:
```ts
useEffect(() => {
  const gcal = searchParams.get('gcal');
  if (gcal === 'connected') {
    toast.success('Google Calendar connected successfully');
    setSearchParams({}, { replace: true });
  } else if (gcal === 'error') {
    toast.error('Failed to connect Google Calendar. Please try again.');
    setSearchParams({}, { replace: true });
  }
}, []);  // run once on mount only
```

`searchParams` is already available in `TasksPage` via `useSearchParams`.

### Acceptance criteria
- [ ] Success toast shown when redirected back with `?gcal=connected`
- [ ] Error toast shown when redirected back with `?gcal=error`
- [ ] URL param cleaned immediately after toast

---

## Implementation Order

1. Phase 1 — Migration (run it)
2. Phase 2 — Config + install `googleapis`
3. Phase 3 — Integration repository
4. Phase 4 — Google Calendar service
5. Phase 5 — Controller + routes
6. Phase 6 — Hook into task services
7. Phase 7 — Frontend hook
8. Phase 8 — Connectors tab UI
9. Phase 9 — Redirect handler

---

## Out of Scope (Future Two-Way Sync)

- Google push notification webhook endpoint
- Polling Google for changes
- Mapping incoming Google events back to tasks via `google_event_id`
- Conflict resolution strategy
