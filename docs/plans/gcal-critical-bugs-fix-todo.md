# Google Calendar Sync — Critical Bug Fixes (AI TODO)

> **Scope:** Only the 5 🔴 Critical bugs from `gcal-sync-bugs.md` (BUG-01 through BUG-05).
> **Goal:** Fix each bug without breaking existing functionality or UI.

---

## BUG-01 — Advisory lock key mismatch between `registerWatch` and `doIncrementalSync`

**File:** `backend/src/services/google-calendar.service.ts`

### What to do

- [ ] Define a single lock-key builder function at the top of the file:
  ```
  function syncLockKey(userId: string): string { return `gcal-sync:${userId}`; }
  ```
- [ ] In `registerWatch()` (~line 801): replace `gcal-watch:${userId}` with `syncLockKey(userId)` in **both** the `pg_try_advisory_lock` call and the matching `pg_advisory_unlock` call in the `finally` block (~line 896).
- [ ] In `doIncrementalSync()` (~line 921): replace the bare `[userId]` with `[syncLockKey(userId)]` in **both** the `pg_try_advisory_lock` call and the matching `pg_advisory_unlock` call in the `finally` block (~line 1051).
- [ ] **Verify:** Both functions now hash the exact same string for the same userId, guaranteeing mutual exclusion.

---

## BUG-02 — OAuth state timestamp is never validated (replay attack)

**File:** `backend/src/services/google-calendar.service.ts` → `verifyState()` (~line 100)

### What to do

- [ ] After the `JSON.parse(...)` on line 117 that decodes the payload into `{ userId, ts }`, add a timestamp-expiry check **before** returning:
  - Compare `Date.now() - decoded.ts` against a 10-minute window (`10 * 60 * 1000`).
  - If the state is older than 10 minutes, throw a descriptive error: `'OAuth state expired — possible replay attack'`.
- [ ] Store the decoded result in a `const` variable (e.g. `const decoded = ...`) so you can inspect `decoded.ts` before returning it.
- [ ] **Do not change** the HMAC verification logic or the `signState()` function — only add the timestamp check.

---

## BUG-03 — `sync_in_progress` flag can permanently stick `TRUE`

**File:** `backend/src/services/google-calendar.service.ts` → `doIncrementalSync()` (~line 913)

### What to do

- [ ] In the **outer** `finally` block (~line 1047), **before** the advisory lock release, add an unconditional reset of `sync_in_progress`:
  ```
  await pool.query(
    `UPDATE public.user_integrations SET sync_in_progress = FALSE WHERE user_id = $1`,
    [userId]
  );
  ```
- [ ] Wrap this new query in its own `try/catch` so that a DB error here does not prevent the advisory lock from being released. Log the error if it fails.
- [ ] The existing `sync_in_progress = FALSE` writes inside the inner `try/catch` branches (lines 980, 1005, 1029, 1040) can remain — they are harmless since the outer `finally` now acts as a safety net. Do **not** remove them to avoid changing success-path behavior.

---

## BUG-04 — No per-event error isolation in `doFullSync`

**File:** `backend/src/services/google-calendar.service.ts` → `doFullSync()` (~line 697)

### What to do

- [ ] Wrap the `processIncomingGoogleEvent` call inside the `for` loop (~lines 724-727) in a `try/catch`:
  - On catch: log the error with `log.error(...)` including `eventId: event.id`, `userId`, and the error object.
  - Continue to the next event (do **not** rethrow).
  - Only increment `totalProcessed` inside the `try` block (on success).
- [ ] **Do not** change the outer pagination loop, `pageToken`/`syncToken` handling, or the function signature.
- [ ] **Also apply the same pattern** to the `doIncrementalSync` event loop (~lines 968-970) — wrap each `processIncomingGoogleEvent` call in a `try/catch` with error logging and continue. This ensures a single bad event in an incremental sync doesn't abort the entire batch and lose the new `syncToken`.

---

## BUG-05 — `stopWatch` uses pool connection inside advisory-locked scope

**File:** `backend/src/services/google-calendar.service.ts` → `registerWatch()` (~line 790) and `stopWatch()` (~line 744)

### What to do

- [ ] Add an **optional** `client` parameter to `stopWatch()`:
  ```
  export async function stopWatch(userId: string, client?: PoolClient): Promise<void>
  ```
  When `client` is provided, use it for the `clearWatchChannel` call instead of going through `integrationRepository` (which uses the shared pool).
- [ ] Add an **optional** `client` parameter to `integrationRepository.clearWatchChannel()`:
  ```
  async clearWatchChannel(userId: string, provider: string, client?: PoolClient): Promise<void>
  ```
  When `client` is provided, use `client.query(...)` instead of `pool.query(...)`.
- [ ] In `registerWatch()` (~line 817), pass `lockClient` as the second argument:
  ```
  await stopWatch(userId, lockClient);
  ```
- [ ] The existing call to `stopWatch(userId)` in `disconnectGoogle` (integration.controller.ts, line 107) remains unchanged (no `client` arg → defaults to pool, which is correct since there's no advisory lock scope there).
- [ ] **Also thread `lockClient`** through `integrationRepository.findByUserAndProvider()` inside `stopWatch` when a client is provided. Inside `stopWatch`, the `findByUserAndProvider` call (~line 745) should use the provided client to read the current watch channel data, keeping reads and writes on the same connection.
  - Add optional `client` parameter to `findByUserAndProvider` in `integration.repository.ts`.
  - When provided, use `client.query(...)` instead of `pool.query(...)`.

---

## General verification

- [ ] After all fixes, confirm the backend compiles without errors: `npx tsc --noEmit` from the backend directory.
- [ ] Search for any other `pg_try_advisory_lock(hashtext` calls in the codebase and ensure they all use the `syncLockKey()` helper (no more raw string inconsistencies).
- [ ] Confirm `stopWatch` is still called correctly in `disconnectGoogle` (controller) without a client arg — it must keep working via the shared pool when called outside an advisory lock scope.
