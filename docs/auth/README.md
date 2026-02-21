# Authentication System Documentation

## Overview

This project uses **Supabase Auth** for user authentication with a **MongoDB** backend for user data persistence. The architecture follows a **frontend-driven** authentication model where the Supabase JS SDK handles all auth flows on the client, and the backend verifies JWTs for protected API access.

## Table of Contents

| Document                                  | Description                                                 |
| ----------------------------------------- | ----------------------------------------------------------- |
| [Architecture](./architecture.md)         | High-level system design and auth flow diagrams             |
| [Frontend Guide](./frontend.md)           | Supabase client setup, AuthContext, protected routes        |
| [Backend Guide](./backend.md)             | JWT verification middleware, user sync, protected endpoints |
| [Environment Variables](./environment.md) | Required configuration for both frontend and backend        |

## Quick Start

### 1. Set up environment variables

**Frontend** (`frontend/.env`):
```env
VITE_SUPABASE_URL=<your-supabase-url>
VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY=<your-publishable-key>
VITE_API_URL=http://localhost:5000/api
```

**Backend** (`backend/.env`):
```env
SUPABASE_URL=<your-supabase-url>
SUPABASE_PUBLISHABLE_KEY=<your-publishable-key>
SUPABASE_SECRET_KEY=<your-secret-key>
MONGODB_URI=<your-mongodb-connection-string>
```

### 2. Install dependencies

```bash
# Frontend
cd frontend && npm install

# Backend
cd backend && npm install
```

### 3. Run both servers

```bash
# Frontend (Vite dev server on :5173)
cd frontend && npm run dev

# Backend (Express server on :5000)
cd backend && npm run dev
```

### 4. Test the flow

1. Navigate to `http://localhost:5173`
2. You will be redirected to `/login` (unauthenticated)
3. Sign up with email/password
4. On success, the frontend syncs with the backend and a MongoDB user document is created automatically
5. You are redirected to the protected home page

## Tech Stack

| Layer         | Technology           | Purpose                                               |
| ------------- | -------------------- | ----------------------------------------------------- |
| Auth Provider | Supabase Auth        | User signup, login, session management                |
| Frontend      | React + Vite         | UI, auth state management, route protection           |
| Backend       | Express + TypeScript | JWT verification, user sync, API                      |
| Database      | MongoDB (Mongoose)   | User data persistence                                 |
| HTTP Client   | Axios                | Frontend-to-backend API calls with auto-attached JWTs |
