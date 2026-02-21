# Frontend Authentication Guide

## File Structure

```
frontend/src/
├── lib/
│   ├── supabase.ts          # Supabase client initialization
│   └── api.ts               # Axios instance with JWT interceptor
├── contexts/
│   └── AuthContext.tsx       # Global auth state provider
├── components/auth/
│   ├── AuthPage.tsx          # Login/Signup page container
│   ├── LoginForm.tsx         # Login form with Supabase integration
│   ├── SignupForm.tsx        # Signup form with Supabase integration
│   └── ProtectedRoute.tsx    # Route guard component
├── App.tsx                   # Route definitions
└── main.tsx                  # App entry point with providers
```

## Supabase Client (`lib/supabase.ts`)

Initializes the Supabase client using environment variables.

```typescript
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

> **Note:** The publishable key is safe to expose on the frontend. It only allows operations permitted by your Supabase RLS policies.

---

## API Client (`lib/api.ts`)

An Axios instance that automatically attaches the user's JWT to every request.

### How the interceptor works:
1. Before every outgoing request, the interceptor calls `supabase.auth.getSession()`.
2. If a valid session exists, it extracts the `access_token` (JWT).
3. It attaches the token as `Authorization: Bearer <token>`.

```typescript
api.interceptors.request.use(async (config) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
        config.headers.Authorization = `Bearer ${session.access_token}`;
    }
    return config;
});
```

### Usage in components:
```typescript
import api from "@/lib/api";

// All requests are automatically authenticated
const response = await api.get("users/me");
const userData = response.data;
```

> **Important:** Use relative paths (e.g., `"users/me"` not `"/users/me"`) to ensure correct URL concatenation with the `baseURL`.

---

## Auth Context (`contexts/AuthContext.tsx`)

Provides global authentication state to the entire application.

### State:
| Property  | Type                  | Description                                      |
| --------- | --------------------- | ------------------------------------------------ |
| `session` | `Session \| null`     | Current Supabase session                         |
| `user`    | `User \| null`        | Current Supabase user object                     |
| `loading` | `boolean`             | Whether the initial session check is in progress |
| `signOut` | `() => Promise<void>` | Function to log the user out                     |

### Lifecycle:
1. **On mount:** Calls `supabase.auth.getSession()` to check for an existing session.
2. **Session found:** Sets the `user` and `session` state, then calls `api.get('users/me')` to sync the user with MongoDB.
3. **Auth state changes:** Listens via `supabase.auth.onAuthStateChange()`. On login, signup, or token refresh, it repeats the sync.

### Usage:
```tsx
import { useAuth } from "@/contexts/AuthContext";

function MyComponent() {
    const { user, loading, signOut } = useAuth();
    
    if (loading) return <p>Loading...</p>;
    if (!user) return <p>Not logged in</p>;
    
    return (
        <div>
            <p>Welcome, {user.user_metadata?.full_name}</p>
            <button onClick={signOut}>Logout</button>
        </div>
    );
}
```

---

## Route Protection (`components/auth/ProtectedRoute.tsx`)

A wrapper component that guards routes. Uses `react-router-dom` to redirect unauthenticated users.

### How it works:
```tsx
const ProtectedRoute = () => {
    const { user, loading } = useAuth();

    if (loading) return <LoadingSpinner />;
    if (!user) return <Navigate to="/login" replace />;
    
    return <Outlet />; // Renders child routes
};
```

### Route configuration in `App.tsx`:
```tsx
<Routes>
    {/* Public: Login page */}
    <Route path="/login" element={!user ? <AuthPage /> : <Navigate to="/" />} />

    {/* Protected: All routes inside here require auth */}
    <Route element={<ProtectedRoute />}>
        <Route path="/" element={<Layout><Dashboard /></Layout>} />
        {/* Add more protected routes here */}
    </Route>

    {/* Catch-all */}
    <Route path="*" element={<Navigate to="/" />} />
</Routes>
```

---

## Auth Forms

### LoginForm (`components/auth/LoginForm.tsx`)
- Fields: `email`, `password`
- Calls `supabase.auth.signInWithPassword({ email, password })`
- Error handling shown inline
- Includes social login buttons (Apple, Google, Meta — not yet wired)

### SignupForm (`components/auth/SignupForm.tsx`)
- Fields: `fullName`, `email`, `password`, `confirmPassword`
- Validates passwords match before submission
- Calls `supabase.auth.signUp()` with `full_name` in metadata:
  ```typescript
  supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
  });
  ```
- The `full_name` metadata is later synced to MongoDB by the backend middleware

---

## Adding a New Protected Page

1. Create your page component (e.g., `src/pages/Settings.tsx`)
2. Add a route inside the `<ProtectedRoute />` wrapper in `App.tsx`:
   ```tsx
   <Route element={<ProtectedRoute />}>
       <Route path="/" element={<Dashboard />} />
       <Route path="/settings" element={<Settings />} />
   </Route>
   ```
3. That's it — the route is automatically protected
