# Fix: Organisation Selector Not Persisting Across Refresh

## Context

The organisation selector in the sidebar does not persist the user's selection across page refresh. Every time the page is refreshed, the app resets to the personal organisation's private space, regardless of which org/space the user had selected.

### Root Cause

The bug is in `frontend/src/contexts/AppContext.tsx`. The **membership validation effect** runs a check that compares the stored `activeOrgId` against the fetched `organisations` array. On page refresh, there is a timing issue:

1. `activeOrgId` is correctly restored from `localStorage("keil_active_org")`.
2. `useOrganisations()` fires immediately — but it has **no `enabled` guard** tied to auth readiness.
3. The Supabase session may not be ready yet when the axios interceptor calls `getSession()`. The request goes out without a token → 401 → retry is disabled for 401 → query resolves with the fallback empty array `[]`.
4. The membership validation effect sees `isLoadingOrgs = false` + `organisations = []` + `activeOrgId` is set. It concludes the user is "no longer a member" and **falls back to the personal org**.
5. Moments later, the auth state change fires, session becomes available, orgs refetch, but by then the stored org has already been overwritten with the personal org ID.

Additionally, even if the 401 doesn't happen (e.g., session restores fast enough from the persisted IndexedDB cache), the membership validation effect has **no guard against the `organisations` array being empty due to initial hydration**. It treats an empty array the same as "user has no orgs."

### Affected Files

- `frontend/src/contexts/AppContext.tsx` — primary fix location
- `frontend/src/hooks/api/useOrganisations.ts` — needs `enabled` guard
- `frontend/src/contexts/AuthContext.tsx` — read-only, provides auth state

---

## Constraints

1. **No breaking changes to the `useAppContext()` API** — all consumers must continue working without modification.
2. **No UI changes** — the sidebar selector, dropdown, and space submenu must remain visually identical.
3. **No backend changes** — the fix is purely frontend.
4. **Must not introduce flickering** — the app should not briefly show the personal org then switch to the correct org after data loads.
5. **Must handle edge cases gracefully:**
   - User removed from an org between sessions (should fall back to personal).
   - User's only org is the personal org.
   - User has multiple orgs.
   - Network failure on refresh (should retain last known selection, not reset).
6. **Must work with the existing TanStack Query + IndexedDB persistence layer** — don't fight the cache, leverage it.
7. **localStorage remains the persistence mechanism** — no migration to URL-based routing or cookies.

---

## TODO

### 1. Expose auth readiness from AuthContext

- [x] Add a `isAuthenticated` (or use existing `!!user`) boolean that `AppContext` can consume.
- [x] Alternatively, export a stable `useIsAuthenticated()` hook that returns `true` only after the initial session check completes (i.e., `loading === false && user !== null`).

### 2. Guard `useOrganisations()` with auth readiness

- [x] In `useOrganisations.ts`, add an `enabled` option so the query only fires when the user is authenticated.
- [x] This can be done by accepting an `enabled` parameter or by using `useAuth()` internally.
- [x] Preferred approach: accept an `enabled?: boolean` param to keep the hook decoupled from auth context, and pass it from `AppContext`.

### 3. Fix the membership validation effect in AppContext

- [x] Add a guard: do NOT run the membership validation logic when `organisations.length === 0` AND the query has never successfully fetched (i.e., distinguish "genuinely empty" from "not yet loaded").
- [x] Use TanStack Query's `isSuccess` or `dataUpdatedAt > 0` to confirm the data is real, not a default.
- [x] Alternative: track a `hasHydrated` flag that becomes `true` only after the first successful org fetch.

### 4. Prevent the auto-select effect from overwriting valid stored state

- [x] The "auto-select personal org if none active" effect should only run when `activeOrgId` is genuinely `null` (never been set), not when it was cleared by the validation effect during the race window.
- [x] Consider combining the auto-select and validation into a single effect to avoid ordering issues between multiple `useEffect` hooks.

### 5. Add a loading/hydrating state to AppContext

- [ ] While orgs are loading for the first time (no cached data, no successful fetch yet), the context should expose a `isHydrating: true` state.
- [ ] Consumers (like the sidebar) can use this to avoid rendering stale org info during the brief hydration window.
- [ ] This prevents any flash of "Personal Workspace" before the real org loads.

> **Note**: Step 5 is deferred — the core fix (steps 1–4) eliminates the bug. The hydrating state is a UX polish enhancement that can be added later if flicker is observed.

### 6. Verify no regressions

- [ ] Confirm switching orgs still works and persists.
- [ ] Confirm switching spaces within an org still works and persists.
- [ ] Confirm refresh after switching retains the correct org + space.
- [ ] Confirm signing out and signing back in resets to personal (or last used).
- [ ] Confirm a user removed from an org gracefully falls back to personal on next refresh.
- [ ] Confirm the sidebar dropdown still shows the correct active org/space with checkmarks.
- [ ] Confirm tasks, motion pages, and other org-scoped features load data for the correct org after refresh.

---

## Acceptance Criteria

1. **Persistence works**: After selecting a non-personal org and space, refreshing the page retains that exact org and space selection.
2. **No flash/flicker**: The UI does not briefly show "Personal Workspace" before switching to the correct org on refresh.
3. **Graceful degradation**: If the stored org is no longer valid (user removed, org deleted), the app falls back to the personal org only after confirming the org list has been successfully fetched.
4. **Network failure resilience**: If the orgs API call fails on refresh (network error, timeout), the app retains the last known selection from localStorage rather than resetting.
5. **Auth timing safe**: The orgs query does not fire until the Supabase session is confirmed available, eliminating 401 race conditions.
6. **No API contract changes**: `useAppContext()` returns the same shape. Existing consumers (sidebar, tasks, motion, dashboard) work without modification.
7. **Works in dev and production**: The fix is not sensitive to React StrictMode double-renders or HMR re-mounts.
