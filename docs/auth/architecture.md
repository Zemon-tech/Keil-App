# Architecture

## Authentication Flow

The system uses a **frontend-driven** authentication model. All auth operations (signup, login, logout) happen on the client via the Supabase JS SDK. The backend only verifies tokens — it never handles passwords or sessions directly.

### Flow Diagram

```
┌──────────────────────────────────────────────────────────────────────┐
│                         FRONTEND (React)                             │
│                                                                      │
│  ┌──────────┐    ┌──────────────┐    ┌──────────────┐                │
│  │ AuthPage │───▶│ Supabase SDK │───▶│ AuthContext   │               │
│  │ (Login/  │    │ signUp()     │    │ session/user  │               │
│  │  Signup) │    │ signIn()     │    │ state mgmt    │               │
│  └──────────┘    └──────┬───────┘    └──────┬────────┘               │
│                         │                   │                        │
│                         │              onAuthStateChange              │
│                         │                   │                        │
│                         ▼                   ▼                        │
│                  ┌─────────────┐     ┌──────────────┐                │
│                  │  Supabase   │     │  api.get()   │                │
│                  │  Auth API   │     │  /users/me   │                │
│                  └─────────────┘     └──────┬───────┘                │
│                                             │                        │
│                              Axios interceptor auto-attaches JWT     │
└─────────────────────────────────────────────┼────────────────────────┘
                                              │
                                    Authorization: Bearer <JWT>
                                              │
┌─────────────────────────────────────────────┼────────────────────────┐
│                         BACKEND (Express)   │                        │
│                                             ▼                        │
│                                   ┌──────────────────┐               │
│                                   │ protect()        │               │
│                                   │ middleware       │               │
│                                   │                  │               │
│                                   │ 1. Extract JWT   │               │
│                                   │ 2. Verify via    │               │
│                                   │    Supabase Admin│               │
│                                   │ 3. Find/Create   │               │
│                                   │    MongoDB user  │               │
│                                   │ 4. Attach to req │               │
│                                   └────────┬─────────┘               │
│                                            │                         │
│                                            ▼                         │
│                                   ┌──────────────────┐               │
│                                   │ Route Handler    │               │
│                                   │ (req as any).user│               │
│                                   └────────┬─────────┘               │
│                                            │                         │
│                                            ▼                         │
│                                   ┌──────────────────┐               │
│                                   │ MongoDB          │               │
│                                   │ users collection │               │
│                                   └──────────────────┘               │
└──────────────────────────────────────────────────────────────────────┘
```

## Key Design Decisions

### 1. Frontend-Driven Auth
- **Why:** Supabase JS SDK is optimized for client-side use. It manages tokens, sessions, and token refresh automatically.
- **Alternative considered:** Server-side auth (backend handles login/signup). Rejected because it adds unnecessary complexity and doesn't leverage Supabase's built-in session management.

### 2. Automatic User Sync (Find-or-Create)
- **Why:** When a user authenticates with Supabase, they exist in Supabase's auth system but not in our MongoDB. The `protect` middleware automatically creates a MongoDB document on the first authenticated request.
- **How it's triggered:** The `AuthContext` immediately calls `GET /api/users/me` after detecting a valid session, ensuring the MongoDB user is created right after login/signup.

### 3. No Custom Type Augmentation
- **Why:** Express type augmentation via `declare global` in `.d.ts` files is fragile with `ts-node`. It caused backend crashes because `ts-node` couldn't resolve the global type, leading to compile errors that prevented route registration.
- **Solution:** Use `(req as any).user` for accessing the custom `user` property on the request object.

### 4. Conditional Rendering + React Router
- **Why:** Using `react-router-dom` with a `ProtectedRoute` wrapper component provides URL-based navigation. Unauthenticated users are redirected to `/login`, and authenticated users on `/login` are redirected to `/`.

## Security Model

| Layer                           | Mechanism                                         |
| ------------------------------- | ------------------------------------------------- |
| **Token Generation**            | Handled entirely by Supabase Auth (JWTs)          |
| **Token Storage**               | Managed by Supabase JS SDK (localStorage/cookies) |
| **Token Refresh**               | Automatic via Supabase SDK's `onAuthStateChange`  |
| **Token Verification**          | Backend uses `supabaseAdmin.auth.getUser(token)`  |
| **Route Protection (Frontend)** | `ProtectedRoute` component + `Navigate`           |
| **Route Protection (Backend)**  | `protect` middleware on Express routes            |
| **User Data**                   | Stored in MongoDB, linked via `supabaseId`        |
