# Chat — Frontend Guide

## File Structure

```
frontend/src/
├── components/
│   └── chat/
│       ├── ChatDrawer.tsx          # Resizable right-side panel (main entry point)
│       ├── ChannelList.tsx         # Channel list with unread badges
│       ├── MessageView.tsx         # Message list + send input
│       ├── NewChatDialog.tsx       # Create DM or group channel dialog
│       ├── GroupSettingsDialog.tsx # Manage group members (admin only)
│       ├── ChatDialog.tsx          # Full-screen modal (alternative to drawer)
│       └── ChatPage.tsx            # Full-page chat at /chat route
├── hooks/
│   └── api/
│       └── useChat.ts              # All chat hooks + socket listeners
├── store/
│   └── useChatStore.ts             # Zustand store (UI-only state)
└── lib/
    └── socket.ts                   # Socket.io client singleton
```

## Core Concepts

### Zustand Store (`useChatStore`)
Manages three pieces of UI-only state:

| State | Type | Purpose |
|-------|------|---------|
| `isChatOpen` | `boolean` | Whether the drawer is visible |
| `activeChannelId` | `string \| null` | Active channel (null = showing list) |
| `typingUsers` | `Record<string, { userId, name }[]>` | Per-channel typing indicators |

**Important:** Server state (channels, messages) is handled by React Query, not Zustand.

### React Query Cache Layer
Two query keys structure the server cache:

| Key Pattern | Data | Stale Time |
|-------------|------|------------|
| `["chat", "channels", orgId, spaceId]` | Channel list | Default (refetch on mount) |
| `["chat", "messages", channelId]` | Message list | Infinity (socket events manage freshness) |

### Socket.io Client Singleton (`socket.ts`)
- Created once on login via `connectSocket(token)`.
- Destroyed on logout via `disconnectSocket()` — called BEFORE `supabase.auth.signOut()`.
- Token refresh support: listens for Supabase auth state changes and updates `socket.auth.token` + reconnects.
- Access via `getSocket()` anywhere in the app.

## Important Components

### ChatDrawer
- Renders globally inside `Layout.tsx`.
- Resizable (drag left edge, range 320–800px).
- Mounts `useChatSocketListeners` once (single point — not duplicated).
- Shows `ChannelList` when no channel is active, `MessageView` when a channel is selected.

### MessageView
- Renders message history with auto-scroll on new messages.
- Typing indicator at the bottom of the message list.
- Send input with Enter key or Send button.
- Debounces `typing_start` emits (500ms) to avoid flooding.

### NewChatDialog
- Two tabs: Direct Message and Group / Channel.
- DM: searches space members, creates via `useOpenDM` mutation.
- Group: name input + member multi-select with checkboxes.
- Automatically sets the created channel as active on success.

## API Integration

### REST Endpoints (via Axios)
All requests go through the Axios instance in `api.ts`, which:
- Prepends `/api/` to all URLs.
- Automatically attaches the Supabase JWT via request interceptor.
- All chat APIs are scoped to `/v1/orgs/:orgId/spaces/:spaceId/chat`.

### Socket Events
- Outgoing events use `getSocket().emit(event, payload)`.
- Incoming events are handled by `useChatSocketListeners` which updates the React Query cache.

## Usage Examples

### Open a DM programmatically
```tsx
import { useOpenDM } from "@/hooks/api/useChat";
import { useChatStore } from "@/store/useChatStore";

function MyComponent() {
  const { activeOrgId, activeSpaceId } = useAppContext();
  const openDM = useOpenDM(activeOrgId, activeSpaceId);
  const { setActiveChannel } = useChatStore();

  const startChat = (targetUserId: string) => {
    openDM.mutate(targetUserId, {
      onSuccess: (channel) => setActiveChannel(channel.id),
    });
  };
}
```

### Send a message
```tsx
const sendMessage = useSendMessage();
sendMessage(channelId, "Hello!");
```

### Listen for incoming messages (already handled globally)
No manual action needed — `useChatSocketListeners` in `ChatDrawer` handles all socket events.
