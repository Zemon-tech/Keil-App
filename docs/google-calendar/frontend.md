# Frontend Guide

## File Structure

```text
frontend/src/
├── components/
│   ├── SettingsDialog.tsx          # Updated: ConnectorsTab wired to live Google Calendar status
│   └── TasksPage.tsx               # Updated: handles ?gcal= redirect params, shows toast
└── hooks/api/
    └── useGoogleCalendar.ts        # NEW: status query, connect function, disconnect mutation
```

## Core Concepts

### `useGoogleCalendarStatus`

Fetches the current user's Google Calendar connection status from the backend. Returns `{ connected: false }` when not connected.

```ts
import { useGoogleCalendarStatus } from "@/hooks/api/useGoogleCalendar";

const { data: gcalStatus, isLoading } = useGoogleCalendarStatus();

gcalStatus?.connected      // boolean
gcalStatus?.calendar_id    // "primary" or custom calendar ID
gcalStatus?.connected_at   // ISO timestamp of when the user connected
```

The query is cached for 30 seconds (`staleTime: 30_000`). It is invalidated automatically after a successful disconnect or after the OAuth redirect completes.

### `useConnectGoogleCalendar`

Returns an async function. When called, it fetches the OAuth consent URL from the backend and performs a full-page redirect to Google.

```ts
import { useConnectGoogleCalendar } from "@/hooks/api/useGoogleCalendar";

const connectGcal = useConnectGoogleCalendar();

// Call on button click
<Button onClick={connectGcal}>Connect</Button>
```

This is a full redirect (`window.location.href = url`), not a popup. Google OAuth requires this for web applications.

### `useDisconnectGoogleCalendar`

A TanStack mutation that calls `DELETE /api/v1/integrations/google`. On success, it invalidates the status query and shows a success toast.

```ts
import { useDisconnectGoogleCalendar } from "@/hooks/api/useGoogleCalendar";

const disconnectGcal = useDisconnectGoogleCalendar();

<Button
  disabled={disconnectGcal.isPending}
  onClick={() => disconnectGcal.mutate()}
>
  Disconnect
</Button>
```

### Query key

The status query key is exported for use in other parts of the app (e.g. invalidating after the OAuth redirect):

```ts
import { integrationKeys } from "@/hooks/api/useGoogleCalendar";

queryClient.invalidateQueries({ queryKey: integrationKeys.googleStatus });
```

## Important Components

### `ConnectorsTab` in `SettingsDialog.tsx`

The Google Calendar row in the Connectors tab is fully wired. The other connectors (GitHub, Slack, Jira, Figma) remain as static "Coming soon" placeholders.

Behaviour:
- On load: shows a spinner on the button while `gcalLoading` is true
- Not connected: green "Connect" button, grey status dot
- Connected: "Disconnect" button (outline), green status dot, description changes to "Scheduled tasks sync automatically"
- While disconnecting: spinner on the Disconnect button, button disabled

### `TasksPage.tsx` — OAuth redirect handler

After the Google OAuth flow completes, Google redirects the browser to the backend callback, which then redirects to `FRONTEND_URL/tasks?gcal=connected` (or `?gcal=error`).

A `useEffect` in `TasksPage` runs once on mount, checks for these params, shows the appropriate toast, invalidates the status query, and cleans the URL:

```ts
useEffect(() => {
  const gcal = searchParams.get("gcal");
  if (gcal === "connected") {
    toast.success("Google Calendar connected successfully");
    queryClient.invalidateQueries({ queryKey: integrationKeys.googleStatus });
    setSearchParams({}, { replace: true });
  } else if (gcal === "error") {
    toast.error("Failed to connect Google Calendar. Please try again.");
    setSearchParams({}, { replace: true });
  }
}, []); // runs once on mount
```

## API Integration

All three hooks use the shared Axios client from `@/lib/api`, which automatically attaches the Supabase JWT to every request.

| Hook | Method | Endpoint |
| --- | --- | --- |
| `useGoogleCalendarStatus` | `GET` | `v1/integrations/google/status` |
| `useConnectGoogleCalendar` | `GET` | `v1/integrations/google/connect` |
| `useDisconnectGoogleCalendar` | `DELETE` | `v1/integrations/google` |

## Usage Example

Full example of a custom connect/disconnect button:

```tsx
import {
  useGoogleCalendarStatus,
  useConnectGoogleCalendar,
  useDisconnectGoogleCalendar,
} from "@/hooks/api/useGoogleCalendar";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

export function GoogleCalendarButton() {
  const { data: status, isLoading } = useGoogleCalendarStatus();
  const connect = useConnectGoogleCalendar();
  const disconnect = useDisconnectGoogleCalendar();

  if (isLoading) return <Loader2 className="animate-spin" />;

  if (status?.connected) {
    return (
      <Button
        variant="outline"
        disabled={disconnect.isPending}
        onClick={() => disconnect.mutate()}
      >
        {disconnect.isPending ? <Loader2 className="animate-spin" /> : "Disconnect Google Calendar"}
      </Button>
    );
  }

  return (
    <Button onClick={connect}>
      Connect Google Calendar
    </Button>
  );
}
```
