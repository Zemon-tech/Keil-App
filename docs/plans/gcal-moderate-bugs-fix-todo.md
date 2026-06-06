# Google Calendar Sync — Moderate & Edge-Case Bug Fixes (AI TODO)

> **Scope:** BUG-06, BUG-07, BUG-08, BUG-09, BUG-10, BUG-12 from `gcal-sync-bugs.md`.
> **Skipped:** BUG-11 (debounce `setTimeout` replacement) — deferred as a separate architectural change.
> **Goal:** Fix each bug without breaking existing functionality or UI.

---

## BUG-06 — All-day event `end` date is off by one day

**File:** `backend/src/services/google-calendar.service.ts` → `processIncomingGoogleEvent()` (~line 568)

### What to do

- [ ] In the date parsing section after the cancelled-event check (~lines 564-570), modify the `dueDate` assignment for the `isAllDay` branch to subtract one day from the Google-provided exclusive end date:
  ```ts
  const dueDate = isAllDay
    ? new Date(new Date(event.end!.date!).getTime() - 24 * 60 * 60 * 1000)
    : new Date(event.end!.dateTime!);
  ```
- [ ] **Do not** modify the `startDate` calculation — only the `dueDate` for all-day events.
- [ ] **Do not** modify the outbound `buildEventBody()` function — Google expects the exclusive end format, and the existing code already sends the raw `due_date` which will now be the inclusive end. If the outbound path sends all-day events, you may need to add +1 day there to convert back. Verify in `buildEventBody()` (~line 354) and adjust if needed.

---

## BUG-07 — `getUserDefaultOrgSpace` called N times per full sync (no caching)

**Files:** `backend/src/services/google-calendar.service.ts` → `processIncomingGoogleEvent()`, `doFullSync()`, `doIncrementalSync()`

### What to do

- [ ] Add an **optional** parameter `defaultOrgSpace` to `processIncomingGoogleEvent()`:
  ```ts
  export async function processIncomingGoogleEvent(
    userId: string,
    event: calendar_v3.Schema$Event,
    defaultOrgSpace?: { orgId: string; spaceId: string } | null
  ): Promise<void>
  ```
- [ ] Inside `processIncomingGoogleEvent`, in the "NO MATCHING TASK" branch (~line 576), use the passed-in `defaultOrgSpace` if provided, otherwise fall back to calling `getUserDefaultOrgSpace(userId)`:
  ```ts
  const orgSpace = defaultOrgSpace ?? await getUserDefaultOrgSpace(userId);
  ```
  Replace the existing `await getUserDefaultOrgSpace(userId)` call with this.
- [ ] In `doFullSync()` (~line 710), resolve `getUserDefaultOrgSpace(userId)` **once** before the pagination loop and pass it to every `processIncomingGoogleEvent()` call:
  ```ts
  const cachedOrgSpace = await getUserDefaultOrgSpace(userId);
  // ... inside loop:
  await processIncomingGoogleEvent(userId, event, cachedOrgSpace);
  ```
- [ ] In `doIncrementalSync()` (~line 984), similarly resolve once before the event loop and pass it:
  ```ts
  const cachedOrgSpace = await getUserDefaultOrgSpace(userId);
  // ... inside loop:
  await processIncomingGoogleEvent(userId, event, cachedOrgSpace);
  ```
- [ ] **Do not** change the `getUserDefaultOrgSpace` function itself — the caching is at the caller level.

---

## BUG-08 — `findTaskByGoogleEventIdOrIcalUidOrTaskId` runs two sequential queries

**File:** `backend/src/services/google-calendar.service.ts` → `findTaskByGoogleEventIdOrIcalUidOrTaskId()` (~line 443)

### What to do

- [ ] Replace the two sequential queries with a single `UNION ALL` query that searches both `personal_tasks` and `tasks` in one round-trip:
  ```sql
  (SELECT id, title, updated_at, start_date, due_date, owner_user_id, NULL::uuid AS created_by, location, meet_link, 'personal_tasks' AS source
   FROM public.personal_tasks
   WHERE deleted_at IS NULL
     AND (google_event_id = $1 OR (ical_uid IS NOT NULL AND ical_uid = $2) OR id = $3)
   LIMIT 1)
  UNION ALL
  (SELECT id, title, updated_at, start_date, due_date, NULL::uuid AS owner_user_id, created_by, location, meet_link, 'tasks' AS source
   FROM public.tasks
   WHERE deleted_at IS NULL
     AND (google_event_id = $1 OR (ical_uid IS NOT NULL AND ical_uid = $2) OR id = $3)
   LIMIT 1)
  LIMIT 1
  ```
- [ ] Map the returned `source` column to the `MatchedTask.source` field. The `owner_user_id` and `created_by` fields should be mapped from whichever column is non-null.
- [ ] **Preserve the priority order** — personal_tasks should still be preferred over org tasks if both match. Use `ORDER BY (CASE WHEN source = 'personal_tasks' THEN 0 ELSE 1 END)` before the outer `LIMIT 1`, or keep the current `UNION ALL` ordering (personal_tasks subquery first) which Postgres will respect with the outer `LIMIT 1`.
- [ ] Ensure the `MatchedTask` interface fields are still correctly populated from the union result.

---

## BUG-09 — `deleteCalendarEvent` has no API timeout

**File:** `backend/src/services/google-calendar.service.ts` → `deleteCalendarEvent()` (~line 337)

### What to do

- [ ] On line 337, add `timeout: 10000` to the `google.calendar()` instantiation, consistent with all other call sites:
  ```ts
  const calendar = google.calendar({ version: 'v3', auth: authClient, timeout: 10000 } as any);
  ```
- [ ] **Verify** there are no other `google.calendar()` instantiations in the file missing the timeout. Search for `google.calendar({` and confirm all include `timeout: 10000`.

---

## BUG-10 — `gcal_webhook_receipts` table grows unbounded

**Files:** `backend/src/services/gcal-watch-renewal.service.ts`, `backend/src/index.ts`

### What to do

- [ ] Add a new exported function `cleanupWebhookReceipts()` in `backend/src/services/gcal-watch-renewal.service.ts`:
  ```ts
  export async function cleanupWebhookReceipts(): Promise<void> {
    const result = await pool.query(
      `DELETE FROM public.gcal_webhook_receipts WHERE received_at < NOW() - INTERVAL '48 hours'`
    );
    log.info({ deletedCount: result.rowCount }, 'Cleaned up old webhook receipts');
  }
  ```
- [ ] In `backend/src/index.ts`, import `cleanupWebhookReceipts` alongside the existing renewal imports (~line 11).
- [ ] Add the cleanup call inside the existing 12-hour `setInterval` cron block (~line 90), after the `healDegradedWatchChannels` call:
  ```ts
  await cleanupWebhookReceipts().catch(err =>
    cronLog.error({ err }, "cleanupWebhookReceipts error")
  );
  ```
- [ ] **Do not** create a new migration for this — the `received_at` column and a usable index already exist in migration 011.
- [ ] **Optional improvement:** Add a partial index on `received_at` if the table is expected to grow very large. This can be deferred.

---

## BUG-12 — `hashtext()` 32-bit collision risk for advisory locks

**File:** `backend/src/services/google-calendar.service.ts` → `syncLockKey()` and all `pg_try_advisory_lock` / `pg_advisory_unlock` calls

### What to do

- [ ] Switch from single-argument `pg_try_advisory_lock(hashtext($1))` to the two-argument form `pg_try_advisory_lock($1, hashtext($2))` where `$1` is a fixed namespace integer and `$2` is the lock key string. This uses the full 64-bit lock space (two int4 values = 64 bits) instead of a single 32-bit hash.
- [ ] Define a constant for the namespace at the top of the file near `syncLockKey`:
  ```ts
  /** Fixed namespace for Google Calendar advisory locks (two-arg pg_advisory_lock form) */
  const GCAL_LOCK_NAMESPACE = 1735289200; // arbitrary stable integer
  ```
- [ ] Update **all four** lock/unlock call sites (2 in `registerWatch`, 2 in `doIncrementalSync`):
  - Lock: `'SELECT pg_try_advisory_lock($1, hashtext($2))'`, `[GCAL_LOCK_NAMESPACE, lockKey]`
  - Unlock: `'SELECT pg_advisory_unlock($1, hashtext($2))'`, `[GCAL_LOCK_NAMESPACE, lockKey]`
- [ ] **Verify** there are no other `pg_try_advisory_lock(hashtext(` calls elsewhere in the codebase that need updating.

---

## General verification

- [ ] After all fixes, confirm the backend compiles without errors: `npx tsc --noEmit` from the backend directory.
- [ ] Search the codebase for `google.calendar({` to confirm all instantiations include `timeout: 10000`.
- [ ] Spot-check that `processIncomingGoogleEvent` still works correctly when called without the optional `defaultOrgSpace` parameter (backward compatibility with any other callers).
