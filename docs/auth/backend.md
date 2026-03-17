# Backend Authentication Guide

## File Structure

```text
backend/src/
├── config/
│   ├── index.ts                    # Environment-backed app config
│   ├── pg.ts                       # PostgreSQL pool
│   └── supabase.ts                 # Supabase admin client
├── middlewares/
│   └── auth.middleware.ts          # Bearer token verification and user lookup
├── migrations/
│   ├── 001_initial_schema.sql      # Creates public.users and other app tables
│   └── 002_auth_users_trigger.sql  # Mirrors auth.users into public.users
└── routes/
    ├── index.ts                    # Mounts /api/users and /api/v1
    └── user.routes.ts              # GET /api/users/me
```

## Models / Schema

### `public.users`

The backend auth flow depends on `public.users`, not a MongoDB collection.

| Column | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | `UUID` | Yes | Matches `auth.users.id` |
| `email` | `TEXT` | Yes | Unique email address |
| `name` | `TEXT` | No | User name from Supabase metadata |
| `created_at` | `TIMESTAMPTZ` | Yes | Profile creation timestamp |

### Relationship to Supabase Auth

| Source | Target | Mechanism |
| --- | --- | --- |
| `auth.users` | `public.users` | Database trigger created in `002_auth_users_trigger.sql` |

## Middleware and Logic

### Supabase admin client

The backend creates a server-side Supabase client with:

- `SUPABASE_URL`
- `SUPABASE_SECRET_KEY`

This client is used for token verification only.

### `protect` middleware

`backend/src/middlewares/auth.middleware.ts` performs the current auth flow:

1. Read `Authorization: Bearer <token>`
2. Reject if no token exists
3. Verify the token with `supabaseAdmin.auth.getUser(token)`
4. Query `public.users` with the authenticated Supabase user id
5. Attach the row to `(req as any).user`

Simplified shape:

```ts
const {
  data: { user: supabaseUser },
  error,
} = await supabaseAdmin.auth.getUser(token);

const result = await pool.query(
  "SELECT * FROM public.users WHERE id = $1",
  [supabaseUser.id]
);

(req as any).user = result.rows[0];
```

### Current behavior

| Situation | Result |
| --- | --- |
| Missing bearer token | `401` |
| Invalid or expired token | `401` |
| Valid token but no `public.users` row | `401` |
| Unexpected middleware error | `500` |
| Valid token and user row found | request continues |

## Routing

### Route registration

`backend/src/routes/index.ts` mounts:

- `/api/health`
- `/api/users`
- `/api/v1`

### Auth-related endpoint

Currently documented and clearly wired:

| Method | Path | Protection | Purpose |
| --- | --- | --- | --- |
| `GET` | `/api/users/me` | `protect` | Return the authenticated `public.users` row |

Example:

```ts
router.get("/me", protect, (req, res) => {
  res.json({
    success: true,
    data: (req as any).user,
  });
});
```

## Protection Pattern

Use `protect` on any endpoint that requires identity:

```ts
import { Router } from "express";
import { protect } from "../middlewares/auth.middleware";

const router = Router();

router.get("/private", protect, (req, res) => {
  res.json({ user: (req as any).user });
});
```

## Current Gaps

- Auth middleware is live.
- User lookup is live.
- `users/me` is live.
- Many feature controllers under `/api/v1` are still placeholder handlers, so auth is implemented more completely than the rest of the application API.
