# Google Calendar 2-Way Sync — Bug & Issue Tracker

> **Source files analyzed:**
> - `backend/src/services/google-calendar.service.ts`
> - `backend/src/controllers/integration.controller.ts`
> - `backend/src/repositories/integration.repository.ts`
> - `backend/src/services/gcal-watch-renewal.service.ts`
> - `backend/src/migrations/008_google_calendar_integration.sql`
> - `backend/src/migrations/011_gcal_two_way_sync.sql`

---

## 🔴 Critical Bugs

---

### BUG-01 — Advisory lock key mismatch between `registerWatch` and `doIncrementalSync`

**File:** `google-calendar.service.ts`

**Description:**
`registerWatch` and `doIncrementalSync` both use `pg_try_advisory_lock(hashtext($1))` but hash *different strings*. This means they do not mutually exclude each other. A full sync (triggered inside `registerWatch`) and an incremental sync (triggered by a webhook) can run concurrently for the same user, leading to a race condition that can corrupt the stored `gcal_sync_token`.

**Code:**
```ts
// registerWatch — hashes "gcal-watch:{userId}"
'SELECT pg_try_advisory_lock(hashtext($1))', [`gcal-watch:${userId}`]

// doIncrementalSync — hashes just "{userId}"
'SELECT pg_try_advisory_lock(hashtext($1))', [userId]
// These resolve to DIFFERENT integers — no mutual exclusion
```

**Impact:** Concurrent sync runs can overwrite each other's syncToken, causing missed events or duplicate task creation.

**Fix:** Use a consistent lock key for all sync operations for the same user, e.g., always prefix with `"gcal-sync:{userId}"`.

---

### BUG-02 — OAuth state timestamp is never validated — replay attack possible

**File:** `google-calendar.service.ts` → `verifyState()`

**Description:**
The OAuth `state` parameter includes a `ts` (timestamp) field in the signed payload, but `verifyState` never checks whether the timestamp is recent. A valid OAuth URL intercepted by an attacker can be replayed at any point in the future — the signature check passes but the age of the token is never enforced.

**Code:**
```ts
function verifyState(signedState: string): { userId: string; ts: number } {
  // ... validates HMAC signature correctly ...
  return JSON.parse(Buffer.from(payload, 'base64').toString('utf8'));
  // ❌ ts is decoded but never compared against Date.now()
}
```

**Impact:** An attacker who obtains a valid OAuth consent URL (e.g., via a shared link, logs, or browser history) can replay it later to hijack the Google Calendar connection for that user.

**Fix:**
```ts
const decoded = JSON.parse(Buffer.from(payload, 'base64').toString('utf8'));
if (Date.now() - decoded.ts > 10 * 60 * 1000) {
  throw new Error('State token expired — possible replay attack');
}
return decoded;
```

---

### BUG-03 — `sync_in_progress` flag can permanently stick `TRUE`

**File:** `google-calendar.service.ts` → `doIncrementalSync()`

**Description:**
`sync_in_progress` is set to `TRUE` early in the function body, before the main try/catch block. The flag is reset to `FALSE` inside the inner try/catch for known error codes (401, 403, 410, and general errors). However, the outer `finally` block only releases the advisory lock — it does **not** reset `sync_in_progress`. If an unexpected error escapes all inner catch branches (e.g., a DB connection failure mid-sync), the flag stays `TRUE` indefinitely with no self-healing.

**Code:**
```ts
// Set early — before inner try block
await pool.query(`SET sync_in_progress = TRUE ... WHERE user_id = $1`, [userId]);

try {
  // ... inner try/catch resets FALSE on known errors only
} catch (err: any) {
  if (err?.code === 401 || err?.code === 403) { /* resets */ return; }
  if (err?.code === 410) { /* resets */ return; }
  // General case: resets sync_in_progress = FALSE ✅
  await pool.query(`SET sync_in_progress = FALSE ...`);
}
// outer finally:
finally {
  if (acquired) { /* releases advisory lock only */ }
  lockClient.release();
  // ❌ sync_in_progress NOT reset here if something throws before inner catch
}
```

**Impact:** Users with a stuck `sync_in_progress = TRUE` will show incorrect sync status in any monitoring/dashboard. More critically, if you ever use this flag to gate sync execution, it becomes a silent permanent block.

**Fix:** Add `sync_in_progress = FALSE` reset to the outer `finally` block unconditionally, or use a single-level try/catch/finally structure.

---

### BUG-04 — No per-event error isolation in `doFullSync`

**File:** `google-calendar.service.ts` → `doFullSync()`

**Description:**
Events are processed sequentially with `await` and no individual error handling. If any single event in the list throws an unexpected error (malformed data, DB constraint, etc.), the entire full sync aborts mid-page. No `syncToken` is saved for that page, so the next run restarts from scratch. If one specific event consistently throws, the sync is permanently broken for that user.

**Code:**
```ts
for (const event of items) {
  await processIncomingGoogleEvent(userId, event); // ❌ one bad event kills the page
  totalProcessed++;
}
```

**Impact:** A single malformed Google Calendar event permanently prevents a user's full sync from completing. This also means `watch_status` may never reach `active`.

**Fix:**
```ts
for (const event of items) {
  try {
    await processIncomingGoogleEvent(userId, event);
    totalProcessed++;
  } catch (err) {
    log.error({ err, eventId: event.id, userId }, 'Failed to process event — skipping');
  }
}
```

---

### BUG-05 — `stopWatch` runs through the pool inside an advisory-locked `lockClient` scope

**File:** `google-calendar.service.ts` → `registerWatch()`

**Description:**
The advisory lock is acquired on a dedicated `lockClient` connection. Inside the lock scope, `stopWatch(userId)` is called, which internally uses the shared `pool` (not `lockClient`) to clear the watch channel data. If the pool and lock client land on different Postgres backends (common with pgBouncer in transaction mode), the cleared channel state becomes visible to other requests before the new channel is written — breaking the atomicity guarantee the advisory lock was meant to provide.

**Code:**
```ts
const lockClient = await pool.connect(); // dedicated connection for lock
// lock acquired on lockClient ...

await stopWatch(userId); // ❌ internally uses pool, not lockClient
// new channel written via pool after this
```

**Impact:** In environments using a connection pooler, there is a window where the DB shows no active watch channel, which could cause incoming webhooks to be discarded as "unknown channel".

**Fix:** Thread `lockClient` through `stopWatch` and `clearWatchChannel` so all writes within the lock scope use the same connection.

---

## 🟠 Edge Cases & Moderate Issues

---

### BUG-06 — All-day event `end` date is off by one day

**File:** `google-calendar.service.ts` → `processIncomingGoogleEvent()`

**Description:**
Google Calendar uses an **exclusive** end date for all-day events. An event "April 1–3" has `end.date = "2026-04-04"`. The code stores this date directly as `due_date`, meaning all-day events imported from Google have their due date set one day later than intended.

**Code:**
```ts
const dueDate = isAllDay
  ? new Date(event.end!.date!) // ❌ Google sends exclusive end — April 4 stored, event ends April 3
  : new Date(event.end!.dateTime!);
```

**Impact:** All-day events created in Google Calendar appear with a due date 1 day too late in KeilHQ.

**Fix:** Subtract one day for all-day event end dates:
```ts
const rawEnd = new Date(event.end!.date!);
const dueDate = isAllDay
  ? new Date(rawEnd.getTime() - 24 * 60 * 60 * 1000)
  : new Date(event.end!.dateTime!);
```

---

### BUG-07 — `getUserDefaultOrgSpace` is called N times per full sync (no caching)

**File:** `google-calendar.service.ts` → `processIncomingGoogleEvent()`

**Description:**
`getUserDefaultOrgSpace(userId)` executes a DB query on every event that has no matching task. During a full sync with hundreds of events, this query runs hundreds of times, always returning the same result for the same user.

**Code:**
```ts
// Inside processIncomingGoogleEvent — called for every event in the loop
const defaultOrgSpace = await getUserDefaultOrgSpace(userId); // ❌ DB hit every time
```

**Impact:** Full sync for a user with 200 calendar events generates 200+ identical `SELECT` queries against `organisations` and `spaces`. This adds latency and unnecessary DB load.

**Fix:** Resolve `getUserDefaultOrgSpace` once before the event loop in `doFullSync` and pass it as a parameter to `processIncomingGoogleEvent`.

---

### BUG-08 — `findTaskByGoogleEventIdOrIcalUidOrTaskId` runs two sequential DB queries per event

**File:** `google-calendar.service.ts`

**Description:**
The function first queries `personal_tasks`, and only if that returns nothing does it query `tasks`. This means every inbound event lookup costs 2 round-trips to the DB. With `OR` conditions on nullable columns (`ical_uid`), index usage is also suboptimal.

**Code:**
```ts
// Query 1
const personalResult = await pool.query(`SELECT ... FROM public.personal_tasks WHERE ...`);
if (personalResult.rows.length > 0) return ...;

// Query 2 — always runs if personal_tasks had no match
const orgResult = await pool.query(`SELECT ... FROM public.tasks WHERE ...`);
```

**Impact:** Every event processed (incremental or full sync) costs 2 DB queries minimum. For a full sync of 300 events, that's 600 queries just for lookups.

**Fix:** Use a `UNION ALL` query to hit both tables in a single round-trip.

---

### BUG-09 — `deleteCalendarEvent` has no API timeout

**File:** `google-calendar.service.ts` → `deleteCalendarEvent()`

**Description:**
`syncTaskToCalendar` creates its Google Calendar client with `timeout: 10000`, but `deleteCalendarEvent` creates its client without a timeout. A stalled or slow Google API response for a delete operation can hold a Node.js async handle open indefinitely.

**Code:**
```ts
// syncTaskToCalendar — has timeout ✅
const calendar = google.calendar({ version: 'v3', auth: authClient, timeout: 10000 } as any);

// deleteCalendarEvent — no timeout ❌
const calendar = google.calendar({ version: 'v3', auth: authClient });
```

**Fix:** Add `timeout: 10000` consistently to all `google.calendar()` instantiations.

---

### BUG-10 — `gcal_webhook_receipts` table grows unbounded

**File:** `backend/src/migrations/011_gcal_two_way_sync.sql`, `integration.controller.ts`

**Description:**
Every webhook notification inserts a row into `gcal_webhook_receipts`. There is no TTL, expiry column, or cleanup job. Receipts older than a few hours are useless for replay protection (Google does not replay webhooks after a short window), but they accumulate forever.

**Impact:** Over time, especially with many active users, this table can grow to millions of rows, degrading insert and index performance on the webhook hot path.

**Fix:** Add a scheduled cleanup (e.g., every 24h) deleting receipts older than 48 hours:
```sql
DELETE FROM public.gcal_webhook_receipts WHERE received_at < NOW() - INTERVAL '48 hours';
```
Or add a `RULE`/trigger. Also add a `received_at` index if not already present.

---

### BUG-11 — Debounce `setTimeout` is lost on server restart and broken in multi-instance deployments

**File:** `integration.controller.ts` → `handleGoogleWebhook()`

**Description:**
When a webhook is debounced, a 12-second `setTimeout` is scheduled to fire the delayed sync. If the server process restarts within those 12 seconds, the delayed sync is silently lost. In a multi-instance (horizontal scaling) setup, each instance independently receives the webhook and sets its own timer — there's no cross-instance coordination.

**Code:**
```ts
setTimeout(() => {
  doIncrementalSync(userId).catch(err => ...); // ❌ lost on crash/restart
}, 12000);
```

**Impact:** Calendar changes that arrive during a busy period may be permanently missed in production environments with auto-scaling or rolling restarts.

**Fix:** Use a persistent job queue (e.g., pg-boss, Bull) or a DB-backed scheduled task instead of in-process `setTimeout`.

---

### BUG-12 — `hashtext()` 32-bit collision risk for advisory locks

**File:** `google-calendar.service.ts` — all `pg_try_advisory_lock(hashtext($1))` calls

**Description:**
PostgreSQL's `hashtext()` returns a 32-bit integer. With a growing user base, two different userIds can hash to the same integer (birthday paradox — collisions become likely around √(2³²) ≈ 65,000 users). When this happens, one user's sync operation blocks another unrelated user's sync.

**Impact:** At scale, spurious lock contention between different users causes incremental syncs to be silently skipped (`lock not acquired → return`), resulting in missed calendar updates.

**Fix:** Use a 64-bit advisory lock with a fixed namespace XOR'd against the UUID:
```sql
SELECT pg_try_advisory_lock(
  ('google_cal'::text)::bigint # uuid_send($1::uuid)::bigint
)
```
Or use `pg_advisory_lock` with two int4 arguments (namespace + hash).

---

## Summary

| ID | Severity | Location | One-line description |
|---|---|---|---|
| BUG-01 | 🔴 Critical | `google-calendar.service.ts` | Advisory lock key mismatch — `registerWatch` and `doIncrementalSync` don't mutually exclude |
| BUG-02 | 🔴 Critical | `google-calendar.service.ts` → `verifyState` | OAuth state timestamp never checked — replay attack possible |
| BUG-03 | 🔴 Critical | `google-calendar.service.ts` → `doIncrementalSync` | `sync_in_progress` can permanently stick `TRUE` on unexpected errors |
| BUG-04 | 🔴 Critical | `google-calendar.service.ts` → `doFullSync` | No per-event error isolation — one bad event aborts the entire full sync |
| BUG-05 | 🔴 Critical | `google-calendar.service.ts` → `registerWatch` | `stopWatch` uses pool connection inside advisory-locked scope — breaks atomicity |
| BUG-06 | 🟠 Moderate | `google-calendar.service.ts` → `processIncomingGoogleEvent` | All-day event `end` date off by one day (Google uses exclusive end) |
| BUG-07 | 🟠 Moderate | `google-calendar.service.ts` → `processIncomingGoogleEvent` | `getUserDefaultOrgSpace` called N times per full sync — no caching |
| BUG-08 | 🟠 Moderate | `google-calendar.service.ts` → `findTaskByGoogleEventIdOrIcalUidOrTaskId` | Two sequential DB queries per event lookup — use UNION ALL instead |
| BUG-09 | 🟠 Moderate | `google-calendar.service.ts` → `deleteCalendarEvent` | Missing API timeout on Google Calendar client |
| BUG-10 | 🟠 Moderate | `integration.controller.ts`, migration 011 | `gcal_webhook_receipts` grows unbounded — no cleanup |
| BUG-11 | 🟠 Moderate | `integration.controller.ts` → `handleGoogleWebhook` | Debounce `setTimeout` lost on restart; broken in multi-instance deployments |
| BUG-12 | 🟡 Low | `google-calendar.service.ts` — all advisory lock calls | `hashtext()` 32-bit collision risk at scale |
