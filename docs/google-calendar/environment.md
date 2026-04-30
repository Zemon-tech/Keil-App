# Environment Variables

## Backend (`backend/.env`)

These variables are required for the Google Calendar integration. All other existing backend variables remain unchanged.

| Variable Name | Required | Description | Example |
| --- | --- | --- | --- |
| `GOOGLE_CLIENT_ID` | Yes | OAuth 2.0 Client ID from Google Cloud Console | `123456789-abc.apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | Yes | OAuth 2.0 Client Secret from Google Cloud Console | `GOCSPX-xxxxxxxxxxxxxxxx` |
| `GOOGLE_REDIRECT_URI` | Yes | Backend callback URL registered in Google Cloud Console | `http://localhost:5000/api/v1/integrations/google/callback` |
| `GOOGLE_OAUTH_STATE_SECRET` | Yes | Random secret used to sign and verify the OAuth state parameter (CSRF protection) | `a3f8c2...` (64-char hex) |
| `FRONTEND_URL` | Yes | Frontend origin — used to redirect back after OAuth callback | `http://localhost:5173` |

Example addition to `backend/.env`:

```env
GOOGLE_CLIENT_ID=123456789-abc.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxxxxxx
GOOGLE_REDIRECT_URI=http://localhost:5000/api/v1/integrations/google/callback
GOOGLE_OAUTH_STATE_SECRET=a3f8c2d1e4b5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1
FRONTEND_URL=http://localhost:5173
```

## No Frontend Variables Required

The Google Calendar integration does not require any new frontend environment variables. All API calls go through the existing Axios client which already attaches the Supabase JWT.

## Sourcing Instructions

### `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`

These are the **same credentials** already used for Supabase Google login. You do not need to create new credentials.

1. Open [Google Cloud Console](https://console.cloud.google.com).
2. Select your existing project.
3. Go to **APIs & Services → Credentials**.
4. Find your existing **OAuth 2.0 Client ID** (type: Web application).
5. Copy the **Client ID** and **Client Secret**.

### `GOOGLE_REDIRECT_URI`

This must be added to your OAuth credentials in Google Cloud Console:

1. Open the same OAuth 2.0 Client ID in Google Cloud Console.
2. Under **Authorized redirect URIs**, click **Add URI**.
3. Add: `http://localhost:5000/api/v1/integrations/google/callback`
4. For production, also add your production callback URL.
5. Click **Save**.

### `GOOGLE_OAUTH_STATE_SECRET`

Generate a cryptographically random 32-byte hex string:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Use a different value for each environment (development, staging, production).

### `FRONTEND_URL`

Set to the origin of your frontend application:

| Environment | Value |
| --- | --- |
| Development | `http://localhost:5173` |
| Production | `https://your-app-domain.com` |

## Google Cloud Console — Additional Setup

Beyond credentials, two things must be configured in Google Cloud Console:

### 1. Enable the Google Calendar API

1. Go to **APIs & Services → Enable APIs and Services**.
2. Search for **Google Calendar API**.
3. Click **Enable**.

This is separate from the Google Identity/login API already enabled for Supabase login.

### 2. OAuth Consent Screen — Calendar Scope

If your app is in **Testing** mode in Google Cloud, only test users can connect. To allow any user:

1. Go to **APIs & Services → OAuth consent screen**.
2. Under **Scopes**, verify `https://www.googleapis.com/auth/calendar.events` is listed (it is added automatically when the Calendar API is enabled).
3. To allow all users: change the publishing status from **Testing** to **In production** (requires Google verification for sensitive scopes, or keep in Testing and add users manually during development).

## Production Checklist

| Item | Notes |
| --- | --- |
| Update `GOOGLE_REDIRECT_URI` | Must match the production backend URL exactly |
| Update `FRONTEND_URL` | Must match the production frontend origin |
| Add production redirect URI in Google Cloud Console | Same OAuth credential, add the production URI alongside the dev one |
| Rotate `GOOGLE_OAUTH_STATE_SECRET` | Use a different value from development |
| Publish OAuth consent screen | Required for users outside your Google Workspace to connect |

## Security Reminders

| Rule | Details |
| --- | --- |
| Keep `GOOGLE_CLIENT_SECRET` private | Backend-only. Never expose to the browser or commit to version control. |
| Keep `GOOGLE_OAUTH_STATE_SECRET` private | Used for CSRF protection. Rotating it invalidates any in-flight OAuth flows. |
| Refresh tokens are sensitive | Stored in `public.user_integrations`. They grant calendar write access on behalf of the user. Protect your database accordingly. |
| Refresh tokens alone are not enough | An attacker also needs `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` to use a stolen refresh token. |
| Do not commit `.env` files | Keep all secrets outside version control. |
