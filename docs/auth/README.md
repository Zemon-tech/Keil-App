# Authentication System Documentation

## Overview

This project uses **Supabase Auth** for authentication with a **frontend-driven** login/signup flow and a **PostgreSQL (Supabase Postgres)** backend for application user profiles.

Supabase remains the source of truth for credentials and sessions. The app mirrors authenticated users into `public.users` through a database trigger, and the backend verifies JWTs before allowing access to protected endpoints.

## Table of Contents

| Document | Description |
| --- | --- |
| [Architecture](./architecture.md) | High-level auth flow, system boundaries, and design decisions |
| [Frontend Guide](./frontend.md) | Supabase client setup, auth context, forms, and protected routes |
| [Backend Guide](./backend.md) | JWT verification, user profile lookup, routing, and schema notes |
| [Environment Variables](./environment.md) | Required frontend/backend configuration and key handling |

## Quick Start

### 1. Configure environment variables

Frontend `frontend/.env`

```env
VITE_SUPABASE_URL=<your-supabase-url>
VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY=<your-publishable-key>
VITE_API_URL=http://localhost:5000/api
```

Backend `backend/.env`

```env
PORT=5000
NODE_ENV=development
DATABASE_URL=postgresql://postgres:<password>@db.<project-ref>.supabase.co:5432/postgres
SUPABASE_URL=<your-supabase-url>
SUPABASE_PUBLISHABLE_KEY=<your-publishable-key>
SUPABASE_SECRET_KEY=<your-secret-key>
```

### 2. Run the required database migrations

Run these in order against your Supabase/Postgres database:

1. `backend/src/migrations/001_initial_schema.sql`
2. `backend/src/migrations/002_auth_users_trigger.sql`
3. `backend/src/migrations/003_add_soft_delete.sql`

### 3. Start both apps

```bash
# frontend
cd frontend
npm install
npm run dev

# backend
cd backend
npm install
npm run dev
```

### 4. Test the auth flow

1. Open `http://localhost:5173`
2. Sign up or log in from `/login`
3. Supabase creates the auth user
4. The database trigger mirrors that user into `public.users`
5. The frontend stores the session and attaches the JWT to backend requests
6. `GET /api/users/me` confirms the backend can verify the token and load the user profile

## Tech Stack

| Layer | Technology | Purpose |
| --- | --- | --- |
| Auth Provider | Supabase Auth | Signup, login, JWT sessions, token refresh |
| Frontend | React + Vite + TypeScript | Auth UI, route protection, session state |
| HTTP Client | Axios | Backend requests with JWT interceptor |
| Backend | Express + TypeScript | Protected API, JWT verification, user lookup |
| Database | PostgreSQL (Supabase) | `public.users` and app data persistence |
| Admin Access | Supabase service client | Server-side token verification |
