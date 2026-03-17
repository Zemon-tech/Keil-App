# Architecture

## Authentication Flow

The system uses a **frontend-driven** authentication model:

- The frontend performs signup, login, logout, and session management through the Supabase JS SDK.
- Supabase issues the session and access token.
- The backend does not handle passwords.
- The backend verifies the JWT and loads the matching user from `public.users`.

## Flow Diagram

```text
+--------------------------- Frontend ----------------------------+
|                                                                |
|  AuthPage / LoginForm / SignupForm                             |
|            |                                                   |
|            v                                                   |
|      Supabase JS Client                                        |
|            |                                                   |
|            | signUp / signInWithPassword / signOut             |
|            v                                                   |
|       Supabase Auth                                            |
|            |                                                   |
|            | session + access token                            |
|            v                                                   |
|        AuthContext                                             |
|            |                                                   |
|            | onAuthStateChange                                 |
|            v                                                   |
|        Axios Client                                            |
|            |                                                   |
|            | Authorization: Bearer <jwt>                       |
+------------|---------------------------------------------------+
             |
             v
+---------------------------- Backend ----------------------------+
|                                                                |
|  Express Route -> protect middleware -> route handler          |
|                    |                                           |
|                    | verify token with Supabase Admin client   |
|                    v                                           |
|              Supabase Auth API                                 |
|                    |                                           |
|                    | user id                                   |
|                    v                                           |
|              PostgreSQL public.users                           |
|                    |                                           |
|                    | attach row to (req as any).user           |
|                    v                                           |
|               Protected endpoint response                      |
+----------------------------------------------------------------+

+-------------------------- Database -----------------------------+
| auth.users --trigger--> public.users                           |
+----------------------------------------------------------------+
```

## Key Design Decisions

### 1. Frontend-driven auth

- **Why:** Supabase already provides secure client auth flows and session lifecycle handling.
- **Result:** The app avoids duplicating password handling in Express.

### 2. Trigger-based user creation

- **Why:** The app needs a relational `public.users` row for foreign keys across workspaces, tasks, comments, and activity logs.
- **How:** `backend/src/migrations/002_auth_users_trigger.sql` copies new `auth.users` rows into `public.users`.
- **Result:** The backend can assume authenticated users should already exist in Postgres.

### 3. Backend verifies identity, not credentials

- **Why:** Backend APIs only need trusted user identity for authorization and data scoping.
- **How:** `protect` extracts the bearer token and calls `supabaseAdmin.auth.getUser(token)`.

### 4. PostgreSQL replaces the older MongoDB design

- **Why:** The current app architecture is relational and uses PostgreSQL across the rest of the domain model.
- **Result:** Auth documentation must match the live `public.users` table and trigger flow instead of the obsolete MongoDB sync model.

### 5. Minimal request typing

- **Why:** The backend currently attaches the authenticated user as `(req as any).user`.
- **Tradeoff:** This is less elegant than custom Express type augmentation, but matches the current implementation and avoids hidden compile-time coupling in the docs.

## Security Boundaries

| Boundary | Mechanism |
| --- | --- |
| Credential handling | Managed entirely by Supabase Auth |
| Session storage | Managed by Supabase JS SDK on the client |
| Frontend route protection | `ProtectedRoute` redirects unauthenticated users to `/login` |
| Backend route protection | `protect` middleware verifies JWTs before protected handlers |
| User profile lookup | Backend queries `public.users` by authenticated Supabase user id |
| Secret key exposure | `SUPABASE_SECRET_KEY` stays backend-only |

## Current Limits

- `GET /api/users/me` is the only clearly wired auth-related backend endpoint today.
- The auth flow is functional at the session/protection layer, but many feature controllers elsewhere in the app are still placeholders.
- The backend currently returns `401` if a valid Supabase user exists but the `public.users` trigger-created row is missing.
