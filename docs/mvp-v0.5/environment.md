# Environment Configuration (MVP v0.5)

## Config Tables

### Backend Configuration
All backend variables are stored in `backend/.env`.

| Variable Name              | Required | Description                                                                       | Example                                                       |
| :------------------------- | :------- | :-------------------------------------------------------------------------------- | :------------------------------------------------------------ |
| `PORT`                     | No       | Port on which the server will run. Defaults to 5000.                              | `5000`                                                        |
| `NODE_ENV`                 | No       | Node environment (development or production). Defaults to development.            | `development`                                                 |
| `DATABASE_URL`             | **Yes**  | Full PostgreSQL connection string (Direct Connection recommended for migrations). | `postgresql://postgres:password@db.supabase.co:5432/postgres` |
| `SUPABASE_URL`             | **Yes**  | Your Supabase Project API URL.                                                    | `https://your-project.supabase.co`                            |
| `SUPABASE_PUBLISHABLE_KEY` | **Yes**  | Your Supabase "anon" or "public" key.                                             | `sb_publishable_...`                                          |
| `SUPABASE_SECRET_KEY`      | **Yes**  | Your Supabase "service_role" or "secret" key. **DANGER: Do not leak.**            | `sb_secret_...`                                               |

### Frontend Configuration
All frontend variables are stored in `frontend/.env`.

| Variable Name                           | Required | Description                           | Example                            |
| :-------------------------------------- | :------- | :------------------------------------ | :--------------------------------- |
| `VITE_SUPABASE_URL`                     | **Yes**  | Your Supabase Project API URL.        | `https://your-project.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY` | **Yes**  | Your Supabase "anon" or "public" key. | `sb_publishable_...`               |

## Sourcing Instructions

### 1. PostgreSQL Connection String (`DATABASE_URL`)
- Open your Supabase Dashboard.
- Go to **Project Settings** > **Database**.
- Look for the **URI** section.
- Ensure the connection type is set to **Transaction Mode (6543)** or **Direct Connection (5432)** depending on your hosting needs.
- **Note**: For running database migrations, the direct connection (5432) is recommended.

### 2. Supabase API Keys
- Open your Supabase Dashboard.
- Go to **Project Settings** > **API**.
- The `SUPABASE_URL` is listed at the top.
- The `SUPABASE_PUBLISHABLE_KEY` is your "anon" key.
- The `SUPABASE_SECRET_KEY` is your "service_role" key.

## Security Reminders
- **Keep `SUPABASE_SECRET_KEY` safe**: This key bypasses Row Level Security (RLS) and is used for administrative tasks in the backend. 
- **Environment Ignored**: The `.env` file should remain in your `.gitignore` to prevent secret leakage in version control.
