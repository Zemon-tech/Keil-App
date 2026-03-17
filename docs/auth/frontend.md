# Frontend Authentication Guide

## File Structure

```text
frontend/src/
├── lib/
│   ├── supabase.ts                 # Frontend Supabase client
│   └── api.ts                      # Axios client with JWT interceptor
├── contexts/
│   └── AuthContext.tsx             # Global auth/session state
├── components/auth/
│   ├── AuthPage.tsx                # Login/signup page shell
│   ├── LoginForm.tsx               # Email/password login form
│   ├── SignupForm.tsx              # Signup form with full_name metadata
│   └── ProtectedRoute.tsx          # Route guard for authenticated pages
└── App.tsx                         # Public and protected route definitions
```

## Core Concepts

### Supabase client

`frontend/src/lib/supabase.ts` initializes the browser client with:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY`

```ts
import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY
);
```

### AuthContext

`frontend/src/contexts/AuthContext.tsx` is the global auth provider.

It is responsible for:

- loading the initial session with `supabase.auth.getSession()`
- storing `session`, `user`, and `loading`
- subscribing to `supabase.auth.onAuthStateChange()`
- calling `api.get("users/me")` in the background after auth changes to confirm backend auth works

### Protected routing

`frontend/src/components/auth/ProtectedRoute.tsx` blocks access to app routes until:

- the initial auth check completes
- a valid user exists

Protected routes in `frontend/src/App.tsx` currently include:

- `/`
- `/chat`
- `/tasks`
- `/schedule`

## Important Components

### `AuthPage.tsx`

- switches between login and signup modes
- renders a dedicated public auth surface at `/login`

### `LoginForm.tsx`

- uses `supabase.auth.signInWithPassword({ email, password })`
- shows inline loading and error states
- includes placeholder social buttons that are not wired yet

### `SignupForm.tsx`

- validates password confirmation
- uses `supabase.auth.signUp(...)`
- writes `full_name` into Supabase user metadata

```ts
await supabase.auth.signUp({
  email,
  password,
  options: {
    data: {
      full_name: fullName,
    },
  },
});
```

## API Integration

`frontend/src/lib/api.ts` creates an Axios client pointed at:

- `VITE_API_URL`, or
- `http://localhost:5000/api` by default

Before every request, it loads the current Supabase session and adds:

```http
Authorization: Bearer <access_token>
```

```ts
api.interceptors.request.use(async (config) => {
  const { data: { session } } = await supabase.auth.getSession();

  if (session?.access_token) {
    config.headers.Authorization = `Bearer ${session.access_token}`;
  }

  return config;
});
```

## Usage Examples

### Reading auth state in a component

```tsx
import { useAuth } from "@/contexts/AuthContext";

export function ProfileSummary() {
  const { user, loading, signOut } = useAuth();

  if (loading) return <p>Loading...</p>;
  if (!user) return <p>Not authenticated</p>;

  return (
    <div>
      <p>{user.email}</p>
      <button onClick={signOut}>Sign out</button>
    </div>
  );
}
```

### Calling a protected backend endpoint

```ts
import api from "@/lib/api";

const response = await api.get("users/me");
console.log(response.data);
```

## Current State

- Frontend auth is implemented and wired to Supabase.
- Session-based route protection is implemented.
- `AuthContext` performs a backend auth check through `users/me`.
- The frontend is not yet broadly integrated with the task/workspace backend; most feature pages still use mock data.
