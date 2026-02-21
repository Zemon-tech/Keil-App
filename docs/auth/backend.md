# Backend Authentication Guide

## File Structure

```
backend/src/
├── config/
│   ├── index.ts              # App config (env vars)
│   ├── db.ts                 # MongoDB connection
│   └── supabase.ts           # Supabase Admin client
├── middlewares/
│   └── auth.middleware.ts     # JWT verification + user sync
├── models/
│   └── user.model.ts         # MongoDB User schema
└── routes/
    ├── index.ts               # Route registration
    └── user.routes.ts         # User endpoints
```

---

## Supabase Admin Client (`config/supabase.ts`)

The backend uses the **Admin/Service** client (with the secret key) for token verification. This client bypasses Row Level Security (RLS) — it is only used server-side.

```typescript
import { createClient } from "@supabase/supabase-js";
import { config } from "./index";

export const supabaseAdmin = createClient(
    config.supabaseUrl,
    config.supabaseSecretKey
);
```

> **Security:** Never expose `SUPABASE_SECRET_KEY` on the frontend. It has full admin access.

---

## User Model (`models/user.model.ts`)

The MongoDB schema that stores user data linked to Supabase.

### Schema Fields

| Field        | Type     | Required | Description                                          |
| ------------ | -------- | -------- | ---------------------------------------------------- |
| `supabaseId` | `String` | Yes      | Unique ID from Supabase Auth (links the two systems) |
| `fullName`   | `String` | No       | User's display name (synced from Supabase metadata)  |
| `email`      | `String` | Yes      | User's email (unique, lowercase, trimmed)            |
| `role`       | `String` | No       | `"user"` or `"admin"` (defaults to `"user"`)         |
| `createdAt`  | `Date`   | Auto     | Mongoose timestamp                                   |
| `updatedAt`  | `Date`   | Auto     | Mongoose timestamp                                   |

### Indexes
- `supabaseId`: unique + indexed (fast lookups during auth)
- `email`: unique

---

## Auth Middleware (`middlewares/auth.middleware.ts`)

The `protect` middleware is the core of backend authentication. It performs three jobs:

### 1. Token Extraction
Reads the JWT from the `Authorization: Bearer <token>` header.

### 2. Token Verification
Calls `supabaseAdmin.auth.getUser(token)` to verify the JWT with Supabase. This ensures:
- The token is valid and not expired
- The user exists in Supabase
- Returns the Supabase user object with metadata

### 3. User Sync (Find or Create)
After verification, the middleware checks MongoDB:
- **User exists:** Syncs email/name if changed, then attaches to request
- **User doesn't exist:** Creates a new MongoDB document, then attaches to request

```typescript
// Simplified flow
const { data: { user: supabaseUser } } = await supabaseAdmin.auth.getUser(token);

let user = await User.findOne({ supabaseId: supabaseUser.id });

if (!user) {
    user = await User.create({
        supabaseId: supabaseUser.id,
        email: supabaseUser.email,
        fullName: supabaseUser.user_metadata?.full_name || "",
        role: "user",
    });
}

(req as any).user = user;
next();
```

### Response Codes

| Status   | Meaning                                                              |
| -------- | -------------------------------------------------------------------- |
| `401`    | No token provided or token invalid/expired                           |
| `500`    | Internal error during verification or DB operation                   |
| (passes) | Token valid, user attached to `req`, control passed to route handler |

---

## Protecting a Route

Apply the `protect` middleware to any route that requires authentication:

```typescript
import { Router } from "express";
import { protect } from "../middlewares/auth.middleware";

const router = Router();

// This route requires authentication
router.get("/me", protect, (req, res) => {
    res.json({
        success: true,
        data: (req as any).user,
    });
});

// This route is public
router.get("/public", (req, res) => {
    res.json({ message: "Anyone can access this" });
});
```

### Accessing the User in Route Handlers

After the `protect` middleware runs, the authenticated MongoDB user document is available as `(req as any).user`:

```typescript
router.put("/profile", protect, async (req, res) => {
    const user = (req as any).user;
    
    user.fullName = req.body.fullName;
    await user.save();
    
    res.json({ success: true, data: user });
});
```

---

## Route Registration (`routes/index.ts`)

All routes are registered in the central router and mounted under `/api`:

```typescript
// routes/index.ts
router.use("/health", healthRoutes);   // /api/health
router.use("/users", userRoutes);      // /api/users/*

// app.ts
app.use("/api", routes);
```

---

## Adding a New Protected Endpoint

1. Create a new route file (e.g., `routes/project.routes.ts`):
   ```typescript
   import { Router } from "express";
   import { protect } from "../middlewares/auth.middleware";

   const router = Router();

   router.get("/", protect, async (req, res) => {
       const user = (req as any).user;
       // ... your logic using user._id, user.email, etc.
       res.json({ success: true, data: projects });
   });

   export default router;
   ```

2. Register it in `routes/index.ts`:
   ```typescript
   import projectRoutes from "./project.routes";
   router.use("/projects", projectRoutes);
   ```

3. The endpoint is now accessible at `GET /api/projects` (requires JWT)

---

## Troubleshooting

### `Cannot GET /api/...` (404)
- **Cause:** The route file may have a TypeScript compile error, preventing the entire module from loading.
- **Check:** Look at the backend terminal for `ts-node` errors.
- **Common fix:** Ensure all imports are valid and there are no type errors.

### `401 Not authorized`
- **Cause:** No `Authorization` header or invalid token.
- **Check:** Ensure the frontend's Axios interceptor is attaching the token.

### User not appearing in MongoDB
- **Cause:** The `AuthContext` sync call (`api.get('users/me')`) may be failing silently.
- **Check:** Open browser DevTools → Network tab → look for the `/api/users/me` request.
