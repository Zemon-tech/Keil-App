# Chat Architecture

## Data Flow

```
┌──────────────┐     Socket.io      ┌──────────────┐     PostgreSQL     ┌─────────┐
│   Frontend   │ ◄───── WSS ──────► │   Backend    │ ◄───── SQL ──────► │   DB    │
│  (React 19)  │                    │ (Express v5) │                    │ (Pg)    │
└──────┬───────┘                    └──────┬────────┘                    └─────────┘
       │                                  │
       │  REST (Axios)                    │
       ├─────────────────────────────────►│  GET /channels
       │◄─────────────────────────────────┤  GET /channels/:id/messages
       ├─────────────────────────────────►│  POST /channels/direct
       ├─────────────────────────────────►│  POST /channels/group
       ├─────────────────────────────────►│  POST /channels/:id/read
       │                                  │
       │  WebSocket Events                │
       │  socket.emit("send_message")     │
       ├─────────────────────────────────►│  INSERT message
       │                                  │  io.to(room).emit("receive_message")
       │◄─────────────────────────────────┤
       │                                  │
       │  socket.emit("typing_start")     │
       ├─────────────────────────────────►│
       │◄─── socket.to(room).emit(...) ───┤
```

### Send Message Flow (detailed)

```
1. User types message → hits Enter
2. MessageView.handleSend()
   → useSendMessage(channelId, text)
     → socket.emit("send_message", { channel_id, content })
3. Server socket.ts "send_message" handler:
   a. Verifies sender is channel member (DB check on channel_members)
   b. Calls orgChatService.saveMessage():
      - INSERT INTO messages (channel_id, sender_id, content)
      - UPDATE channel_members SET last_read_at = NOW() (sender auto-read)
      - Returns message with sender info
   c. io.to(`channel:${channel_id}`).emit("receive_message", message)
4. Frontend useChatSocketListeners receives "receive_message":
   a. If viewing this channel → append to React Query messages cache
   b. If NOT viewing → bump unread_count in channel list cache only
   c. Remove sender from typingUsers
```

### Receive Message (real-time)

```
- All users connected to room `channel:<uuid>`
- Message broadcast via "receive_message" instantly to all room members
- No polling or refetching
```

## Key Design Decisions

### Why Socket.io for real-time instead of polling
- Redis-based polling would add DB load and latency.
- Socket.io provides bi-directional communication with automatic reconnection, room-based scoping, and fallback transports.
- The app already had Socket.io; extending it for chat was lower risk than introducing a new real-time layer.

### Why org/space scoping instead of workspace scoping
- The broader platform migrated from a flat workspace model to org/space tenancy.
- Chat routes are nested under `/orgs/:orgId/spaces/:spaceId/chat` to enforce data isolation.
- Channels store `org_id` and `space_id` alongside the legacy `workspace_id` for backward compatibility.

### Why React Query + socket injection instead of pure socket state
- REST APIs handle initial data load (pagination, channel list).
- Socket events inject deltas into the existing React Query cache.
- React Query handles deduplication, refetch-on-reconnect, and cache invalidation.
- Avoids the complexity of maintaining a separate socket state store.

### Why Zustand for UI-only state
- React Query manages server state (channels, messages).
- Zustand manages purely UI state: whether the drawer is open, which channel is active, which users are typing.
- Keeps concerns separated and avoids excessive re-renders.

## Security Model

### Authentication
- All REST routes pass through `protect` middleware (Supabase JWT verification).
- Socket.io connection requires a valid Supabase JWT in `handshake.auth.token`.
- Server verifies every socket event sender against `channel_members` table.

### Authorization (REST)
```
Middleware chain:
  1. protect              → JWT verification
  2. requireOrgMember     → user must be org member
  3. requireSpaceMember   → user must be space member
```

### Authorization (Socket)
- On connection: user is added to rooms only for channels they belong to (queried from `channel_members`).
- On `send_message`: server verifies membership before saving.
- On `typing_start/end`: server verifies membership before broadcasting.
- `broadcastNewChannel`: emits to each member's personal room `user:<id>`, not shared rooms.

### Row-Level Security (PostgreSQL)
- RLS policies on `channels`, `channel_members`, `messages` restrict access to channel members via `auth.uid()`.
- The backend uses a service-role connection (bypasses RLS), so application-level auth in middleware is the primary defense.
