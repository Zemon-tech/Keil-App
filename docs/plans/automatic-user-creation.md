# Plan: Automatic User Creation in MongoDB

## Objective
Ensure that every user authenticated via Supabase has a corresponding document in the MongoDB `users` collection automatically, without manual intervention.

## Strategy: Hybrid Synchronization
We will use a combination of **Frontend Triggers** for immediate feedback and **Middleware Upsert** for reliable data consistency.

### Phase 1: Frontend Login Trigger
1. **Update `AuthProvider` (`frontend/src/contexts/AuthContext.tsx`)**:
   - In the `onAuthStateChange` listener, whenever a `session` becomes available (user logs in or returns), trigger an API call to the backend.
   - Use the `api.get('/users/me')` endpoint. This call doesn't need to do anything with the returned data; its purpose is to "ping" the backend.

### Phase 2: Backend "Find or Create" logic (Already Implemented)
1. **Confirm `protect` Middleware (`backend/src/middlewares/auth.middleware.ts`)**:
   - The middleware currently extracts the Supabase UID.
   - It performs a `findOne` on MongoDB.
   - If null, it performs a `create` with the `email` and `full_name` from Supabase metadata.
   - This ensures that *any* protected API call (including the "ping" from Phase 1) results in user creation.

### Phase 3: Supabase Webhooks (Advanced - Optional but Recommended)
1. **Create Webhook Endpoint (`backend/src/routes/webhook.routes.ts`)**:
   - Create a specific route that accepts `POST` requests from Supabase.
   - Secure it with a secret header key (to prevent spoofing).
2. **Logic**:
   - When a new user signs up, Supabase sends a webhook.
   - The backend creates the MongoDB document immediately.
   - *Advantage*: Works even if the user closes the browser before the frontend "ping" happens.

## Immediate Action
I will implement **Phase 1** (Frontend Trigger) now, as Phase 2 is already in place. This will provide the "automatic" behavior you requested.
