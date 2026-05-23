# Environment Variables

## Backend (`backend/.env`)

These variables are required for the Google Calendar integration.

| Variable Name | Required | Description | Example |
| --- | --- | --- | --- |
| `GOOGLE_CLIENT_ID` | Yes | OAuth 2.0 Client ID from Google Cloud Console | `123456789-abc.apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | Yes | OAuth 2.0 Client Secret from Google Cloud Console | `GOCSPX-xxxxxxxxxxxxxxxx` |
| `GOOGLE_REDIRECT_URI` | Yes | Backend callback URL registered in Google Cloud Console | `http://localhost:5000/api/v1/integrations/google/callback` |
| `GOOGLE_OAUTH_STATE_SECRET` | Yes | Random secret used to sign and verify the OAuth state parameter (CSRF protection) | `a3f8c2...` (64-char hex) |
| `FRONTEND_URL` | Yes | Frontend origin — used to redirect back after OAuth callback | `http://localhost:5173` |
| `BACKEND_URL` | Yes | **New for 2-way sync.** Publicly accessible backend URL. Google sends webhooks here. | `https://your-backend.com` |

Example `backend/.env`:

```env
GOOGLE_CLIENT_ID=123456789-abc.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxxxxxx
GOOGLE_REDIRECT_URI=http://localhost:5000/api/v1/integrations/google/callback
GOOGLE_OAUTH_STATE_SECRET=a3f8c2d1e4b5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1
FRONTEND_URL=http://localhost:5173
BACKEND_URL=https://abc123.ngrok-free.app
```

## Frontend (`frontend/.env`)

| Variable Name | Required | Description | Example |
| --- | --- | --- | --- |
| `VITE_API_URL` | Yes | Backend API base URL | `http://localhost:5000/api` |
| `VITE_SOCKET_URL` | Yes | **New.** Backend Socket.io URL. Must match the backend port. | `http://localhost:5000` |

Example `frontend/.env`:

```env
VITE_API_URL=http://localhost:5000/api
VITE_SOCKET_URL=http://localhost:5000
```

> **Note:** If `VITE_SOCKET_URL` is not set, the frontend defaults to `localhost:5001`. If your backend runs on port 5000, you must set this variable explicitly.

---

## Sourcing Instructions

### `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`

These are the **same credentials** already used for Supabase Google login.

1. Open [Google Cloud Console](https://console.cloud.google.com).
2. Select your existing project.
3. Go to **APIs & Services → Credentials**.
4. Find your existing **OAuth 2.0 Client ID** (type: Web application).
5. Copy the **Client ID** and **Client Secret**.

### `GOOGLE_REDIRECT_URI`

Must be added to your OAuth credentials in Google Cloud Console:

1. Open the same OAuth 2.0 Client ID.
2. Under **Authorized redirect URIs**, click **Add URI**.
3. Add: `http://localhost:5000/api/v1/integrations/google/callback`
4. For production, also add your production callback URL.
5. Click **Save**.

### `GOOGLE_OAUTH_STATE_SECRET`

Generate a cryptographically random 32-byte hex string:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Use a different value for each environment.

### `BACKEND_URL` — for 2-way sync

This must be a **publicly accessible HTTPS URL** that Google can reach to deliver webhook notifications.

#### Development (using ngrok)

1. Download ngrok from [ngrok.com](https://ngrok.com) and sign up for a free account.
2. Run: `ngrok http 5000`
3. Copy the `Forwarding` URL (e.g. `https://abc123.ngrok-free.app`)
4. Set `BACKEND_URL=https://abc123.ngrok-free.app` in `backend/.env`
5. Restart the backend
6. Disconnect and reconnect Google Calendar in KeilHQ settings to register a new watch channel with the updated URL

> **Important:** The ngrok URL changes every time you restart ngrok (free plan). You must update `BACKEND_URL` and reconnect Google Calendar each time.

#### Production

Set `BACKEND_URL` to your deployed backend URL:

```env
BACKEND_URL=https://api.yourdomain.com
```

---

## Google Cloud Console — Additional Setup

### 1. Enable the Google Calendar API

1. Go to **APIs & Services → Enable APIs and Services**.
2. Search for **Google Calendar API**.
3. Click **Enable**.

### 2. OAuth Consent Screen — Calendar Scope

If your app is in **Testing** mode, only test users can connect. To allow any user:

1. Go to **APIs & Services → OAuth consent screen**.
2. Verify `https://www.googleapis.com/auth/calendar.events` is listed under Scopes.
3. To allow all users: change publishing status from **Testing** to **In production**.

---

## Production Checklist

| Item | Notes |
| --- | --- |
| Update `GOOGLE_REDIRECT_URI` | Must match the production backend URL exactly |
| Update `FRONTEND_URL` | Must match the production frontend origin |
| Set `BACKEND_URL` | Must be the production backend URL (not ngrok) |
| Add production redirect URI in Google Cloud Console | Add alongside the dev URI |
| Update `VITE_API_URL` and `VITE_SOCKET_URL` | Must point to production backend |
| Rotate `GOOGLE_OAUTH_STATE_SECRET` | Use a different value from development |
| Publish OAuth consent screen | Required for users outside your Google Workspace |

---

## Security Reminders

| Rule | Details |
| --- | --- |
| Keep `GOOGLE_CLIENT_SECRET` private | Backend-only. Never expose to the browser or commit to version control. |
| Keep `GOOGLE_OAUTH_STATE_SECRET` private | Used for CSRF protection. Rotating it invalidates any in-flight OAuth flows. |
| Refresh tokens are sensitive | Stored in `public.user_integrations`. They grant calendar write access on behalf of the user. |
| `BACKEND_URL` must be HTTPS | Google rejects webhook registrations to non-HTTPS URLs. |
| Do not commit `.env` files | Keep all secrets outside version control. |
