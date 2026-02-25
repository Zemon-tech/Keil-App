# Environment Variables

All environment variables required for the authentication system.

---

## Frontend (`frontend/.env`)

| Variable                                | Required | Description                                                    | Example                        |
| --------------------------------------- | -------- | -------------------------------------------------------------- | ------------------------------ |
| `VITE_SUPABASE_URL`                     | ✅        | Your Supabase project URL                                      | `https://abcdefgh.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY` | ✅        | Supabase publishable/anon key (safe for client)                | `sb_publishable_...`           |
| `VITE_API_URL`                          | ❌        | Backend API base URL (defaults to `http://localhost:5000/api`) | `http://localhost:5000/api`    |

### Example:
```env
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY=
VITE_API_URL=http://localhost:5000/api
```

> **Note:** All Vite environment variables must be prefixed with `VITE_` to be accessible via `import.meta.env`.

---

## Backend (`backend/.env`)

| Variable                   | Required | Description                                    | Example                                          |
| -------------------------- | -------- | ---------------------------------------------- | ------------------------------------------------ |
| `PORT`                     | ❌        | Server port (defaults to `5000`)               | `5000`                                           |
| `NODE_ENV`                 | ❌        | Environment mode                               | `development`                                    |
| `MONGODB_URI`              | ✅        | MongoDB connection string                      | `` |
| `SUPABASE_URL`             | ✅        | Your Supabase project URL (same as frontend)   | `https://abcdefgh.supabase.co`                   |
| `SUPABASE_PUBLISHABLE_KEY` | ✅        | Supabase publishable key                       | `sb_publishable_...`                             |
| `SUPABASE_SECRET_KEY`      | ✅        | Supabase service/secret key (**keep private**) | `sb_secret_...`                                  |

---

## Where to Find These Values

### Supabase Keys
1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Navigate to **Settings** → **API**
4. Copy the **Project URL**, **anon/public key** (publishable), and **service_role key** (secret)

### MongoDB URI
1. Go to [MongoDB Atlas](https://cloud.mongodb.com)
2. Select your cluster → **Connect**
3. Choose **Connect your application**
4. Copy the connection string and replace `<password>` with your database user's password

---

## Security Reminders

| ⚠️ Rule                                 | Details                                                            |
| -------------------------------------- | ------------------------------------------------------------------ |
| **Never commit `.env` files**          | Ensure `.env` is listed in `.gitignore`                            |
| **Never expose `SUPABASE_SECRET_KEY`** | This key has full admin access and bypasses all RLS                |
| **Publishable keys are safe**          | The `PUBLISHABLE_KEY` is designed to be used on the client         |
| **Use different keys per environment** | Create separate Supabase projects for dev, staging, and production |
