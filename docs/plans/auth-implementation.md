# Auth Integration Plan: Supabase + MongoDB

## Phase 1: Backend Data & Middleware Setup
1. Create `src/models/user.model.ts`:
   - Fields: `supabaseId` (required, unique), `fullName` (string), `email` (string, required, unique), `role` (enum default 'user').
2. Update Types: 
   - Extend `express` Request interface in `src/types/express/index.d.ts` to include `user` containing the MongoDB User document.
3. Create Auth Middleware (`src/middlewares/auth.middleware.ts`):
   - Extract `Bearer` token from `Authorization` header.
   - Use `supabaseAdmin` to verify the JWT token via `getUser(token)`.
   - Extract user data from Supabase payload (ID, email, user metadata for full name).
   - Upsert (Find or Create) user in MongoDB using the `supabaseId`.
   - Attach MongoDB user object directly to the Express `req.user`.

## Phase 2: Frontend Auth Infrastructure
1. Setup Supabase Client:
   - Create `src/lib/supabase.ts` and initialize the standard `@supabase/supabase-js` client.
   - Ensure ENV vars (`VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY`) are present.
2. Setup Auth State Management:
   - Create an Auth Context/Provider (`src/contexts/AuthContext.tsx`) or use Zustand to globally track `session` and `user`.
   - Listen to `supabase.auth.onAuthStateChange` to keep UI in sync.

## Phase 3: Frontend UI Integration
1. Update `SignupForm.tsx`:
   - Handle form submission using `supabase.auth.signUp()`.
   - Pass `fullName` securely into the `options.data` payload.
2. Update `LoginForm.tsx`:
   - Handle form submission using `supabase.auth.signInWithPassword()`.
3. Add API Client Interceptor (Axios/Fetch):
   - Ensure all calls to backend automatically attach `Authorization: Bearer <supabase_session_token>`.

## Phase 4: Validation & Testing
1. Test signup flow (Verify user appears in Supabase Auth & MongoDB `users` collection upon first API request).
2. Test login flow.
3. Ensure protected routes accurately reject unauthenticated users with `401 Unauthorized`.
