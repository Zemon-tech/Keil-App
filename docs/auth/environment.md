# Environment Variables

This document lists the configuration required for the authentication system as it exists today.

## Frontend (`frontend/.env`)

| Variable Name | Required | Description | Example |
| --- | --- | --- | --- |
| `VITE_SUPABASE_URL` | Yes | Supabase project URL used by the browser client | `https://abcdefgh.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY` | Yes | Supabase publishable key for frontend auth calls | `sb_publishable_...` |
| `VITE_API_URL` | No | Backend API base URL. Defaults to `http://localhost:5000/api` in code | `http://localhost:5000/api` |

Example:

```env
VITE_SUPABASE_URL=https://abcdefgh.supabase.co
VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY=sb_publishable_xxxxx
VITE_API_URL=http://localhost:5000/api
```

## Backend (`backend/.env`)

| Variable Name | Required | Description | Example |
| --- | --- | --- | --- |
| `PORT` | No | Express server port. Defaults to `5000` | `5000` |
| `NODE_ENV` | No | Runtime environment | `development` |
| `DATABASE_URL` | Yes | PostgreSQL connection string used by the backend pool | `postgresql://postgres:<password>@db.<project-ref>.supabase.co:5432/postgres` |
| `SUPABASE_URL` | Yes | Supabase project URL | `https://abcdefgh.supabase.co` |
| `SUPABASE_PUBLISHABLE_KEY` | Yes | Publishable key for server config consistency | `sb_publishable_...` |
| `SUPABASE_SECRET_KEY` | Yes | Service-role key used by the backend admin client | `sb_secret_...` |

Example:

```env
PORT=5000
NODE_ENV=development
DATABASE_URL=postgresql://postgres:<password>@db.<project-ref>.supabase.co:5432/postgres
SUPABASE_URL=https://abcdefgh.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxxxx
SUPABASE_SECRET_KEY=sb_secret_xxxxx
```

## Sourcing Instructions

### Supabase values

1. Open the Supabase dashboard.
2. Select the project.
3. Go to `Settings -> API`.
4. Copy:
   - project URL
   - publishable key
   - service-role key

### Database URL

1. Open the same Supabase project.
2. Go to the database connection settings.
3. Copy the Postgres connection string.
4. Replace placeholders such as `<password>` before using it locally.

## Security Reminders

| Rule | Details |
| --- | --- |
| Keep `SUPABASE_SECRET_KEY` private | It is backend-only and must never be exposed to the browser |
| Treat `DATABASE_URL` as sensitive | It grants direct database access |
| Publishable keys are safe for frontend use | They still depend on your backend and database security posture |
| Do not commit `.env` files | Keep local and deployed secrets outside version control |
| Separate environments cleanly | Use different Supabase projects or credentials for dev, staging, and production |
