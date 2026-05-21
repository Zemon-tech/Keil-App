# Chat — Environment Variables

## Backend

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `PORT` | Yes | Backend HTTP server port | `5001` |
| `FRONTEND_URL` | Yes | Frontend origin for Socket.io CORS | `http://localhost:5173` |
| `DATABASE_URL` | Yes | PostgreSQL connection string | `postgresql://postgres:pass@localhost:5432/keil` |
| `SUPABASE_ANON_KEY` | Yes | Supabase anonymous key | `eyJhbGciOiJIUzI1NiIs...` |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service role key (for JWT verification) | `eyJhbGciOiJIUzI1NiIs...` |
| `SUPABASE_URL` | Yes | Supabase project URL | `https://xxx.supabase.co` |

## Frontend

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `VITE_API_URL` | Yes | Backend API base URL | `http://localhost:5001/api` |
| `VITE_SOCKET_URL` | Yes | Socket.io server URL | `http://localhost:5001` |
| `VITE_SUPABASE_URL` | Yes | Supabase project URL | `https://xxx.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Yes | Supabase anonymous key | `eyJhbGciOiJIUzI1NiIs...` |

## Security Reminders

- `SUPABASE_SERVICE_ROLE_KEY` has admin privileges — never expose it to the frontend or commit it to version control.
- `SUPABASE_ANON_KEY` is public by design but should still follow your project's secret management policy.
- Socket.io JWT auth uses the same Supabase token as REST — token expiry can disconnect real-time; the frontend handles refresh via Supabase `onAuthStateChange`.
- `VITE_*` variables are embedded at build time and visible in the client bundle. Never put secrets here.
