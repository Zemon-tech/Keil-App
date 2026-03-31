# Module 6 — Chat / Real-time Messaging

## Prerequisites
- Phase 0 (Foundation) must be fully merged. Socket.io requires the existing Supabase server-side auth to be stable.
- Both `workspaceId` and user authentication must be available for establishing the socket connection.

---

## Context for Developers

### What already exists
- `users`, `workspaces`, and `workspace_members` tables are fully functional.
- Supabase Auth JWT is available on the frontend for authenticating sockets.
- The standard Express setup in `backend/src/app.ts` or `index.ts`.

### What is missing
- Database tables for Chat (`channels`, `channel_members`, `messages`) and corresponding RLS policies.
- Socket.io server integration alongside the existing Express server.
- Chat UI (a global sidebar/drawer accessible from anywhere in the app).
- Read state tracking (red dots for unread messages).

---

## Branch Names
- `feature/chat-be` — Dev A
- `feature/chat-fe` — Dev B

---

## API & Socket Contract

Both developers must agree on and freeze these detailed shapes before starting their branches. All errors must use the standard shape: `{ "success": false, "error": { "message": "string" } }`.

### `POST /api/v1/chat/channels/direct`
**Description:** Starts or fetches an existing 1:1 channel with another member.
**Request body:**
```json
{
  "target_user_id": "uuid (required, must exist in workspace)"
}
```
**Response 200 (if exists) / 201 (if created):**
```json
{
  "success": true,
  "data": { "channel": { "id": "uuid", "type": "direct", "created_at": "ISO", "last_message_at": "ISO" } }
}
```

### `POST /api/v1/chat/channels/group`
**Description:** Creates a private group channel. (Admin/Owner only).
**Request body:**
```json
{
  "name": "string (required)",
  "member_ids": ["uuid", "uuid"]
}
```
**Response 201:** Channel object as above but `type: "group"`.

### `GET /api/v1/chat/channels`
**Description:** Gets all channels the current user is a member of.
**Query params:** none (uses `req.user.id`)
**Response 200:**
```json
{
  "success": true,
  "data": {
    "channels": [
      {
        "id": "uuid",
        "type": "direct",
        "name": null,
        "unread_count": 2, // Computed via grouped LEFT JOIN
        "last_message_at": "ISO",
        "members": [ { "id": "uuid", "name": "Alice" } ]
      }
    ]
  }
}
```

### `GET /api/v1/chat/channels/:id/messages`
**Description:** Load last 50 messages of a channel.
**Query params:** `limit=50`, `before_id=uuid` (optional cursor for pagination scrolling)
**Response 200:**
```json
{
  "success": true,
  "data": {
    "messages": [
      { "id": "uuid", "channel_id": "uuid", "sender": { "id": "uuid", "name": "Bob" }, "content": "Hi", "created_at": "ISO" }
    ]
  }
}
```

### `POST /api/v1/chat/channels/:id/read`
**Description:** Acknowledges all messages in the channel as read. Updates `last_read_at` to `NOW()`.
**Request body:** empty
**Response 200:** `{ "success": true, "message": "Channel marked as read" }`

---

## Socket.io Events Setup

**1. Connecting to the Server**
The client sends the authentication token.
```javascript
const socket = io("http://localhost:3000", { auth: { token: "SUPABASE_JWT_TOKEN" } });
```
*(Server-Side Security):* The backend verifies the JWT. **The backend automatically joins the socket to room `user:<userId>` AND to all `channel_id` rooms the user belongs to.** The client *never* sends a `join_channel` payload, preventing users from guessing UUIDs and eavesdropping.

**2. Sending a Message (Client → Server)**
- **Event:** `send_message`
- **Payload:** `{ "channel_id": "uuid", "content": "Hello team!" }`

**3. Receiving a Message (Server → Client)**
Server broadcasts string payload to the `channel_id` room.
- **Event:** `receive_message`
- **Payload:** Message Object

**4. New Channel Created (Server → Client)**
If Admin creates a channel, the server emits this to the personal `user:<userId>` rooms of the affected members.
- **Event:** `channel_added`
- **Payload:** Channel Object (Tells the frontend to instantly refresh the Channel List via React Query)

---

## Dev A — Backend Deliverables

> Branch: `feature/chat-be`

### Setup 
- [ ] Install `socket.io` alongside Express. Implement a Middleware that extracts the Supabase JWT, restricts connection if invalid, and identifies `req.user.id`.

### Database & Migrations (`004_chat_schema.sql`)
- [ ] Create `channels`, `channel_members`, and `messages` tables.
- [ ] **Mandatory Security:** Include `ALTER TABLE <table> ENABLE ROW LEVEL SECURITY;` for all three tables to block direct DB access.
- [ ] Add trigger to update `channels.last_message_at` exactly when a new message is inserted.

### Controllers & Services
- [ ] Implement the REST routes, returning consistent `{ "success": boolean, "error": {...} }` shapes.

### Validation Rules
- [ ] `target_user_id` and `member_ids`: Must be valid UUIDs belonging specifically to the user's current workspace. Block cross-workspace chat requests entirely.
- [ ] `name` (Group channels): Required, non-empty text, max 50 characters.
- [ ] `limit`: Must be a positive integer, clamp to a maximum of 100 to prevent database flooding.
- [ ] `createDirectChannel`: Check if a 1:1 already exists. If yes return it. If no, create it and add both to `channel_members`.
- [ ] **The "3-Person" Bug Fix:** Enforce strict validation: a `direct` channel can *never* exceed 2 members. Return 400 if attempted.
- [ ] `createGroupChannel`: Validate `req.user` role is `admin` or `owner`.
- [ ] `getUserChannels`: Return user's channels. **N+1 Bug Fix:** Do not calculate `unread_count` in a loop. Write a single SQL query using `LEFT JOIN messages ON messages.channel_id = channels.id AND messages.created_at > channel_members.last_read_at` grouped by channel ID.
- [ ] `getChannelMessages`: Enforce `LIMIT 50`. Support the `before_id` cursor param for future pagination.
- [ ] `markAsRead`: Update `last_read_at` for the current user in `channel_members`.

### Socket Logic (Server-Side Room Management)
- [ ] **On Connect:** Query the DB for all of the user's `channel_id`s. Automatically run `socket.join(channel_id)` for all of them, AND run `socket.join('user:' + userId)`. *(Fixes eavesdropping and offline notifications)*.
- [ ] **On 'send_message':** Validate the user is inside the channel room. Save message to DB. 
- [ ] **Sender Red-Dot Fix:** After saving the message, instantly update the *sender's* `last_read_at` in `channel_members` to `NOW()`, so they don't receive an unread badge for their own text.
- [ ] Broadcast `receive_message` strictly inside the `channel_id` socket room.
- [ ] When a new channel is created via REST, run `io.to('user:' + memberId).emit('channel_added')` for all members and explicitly make any active sockets join the new room.

---

## Dev B — Frontend Deliverables

> Branch: `feature/chat-fe`

### Setup & UI State Management (`src/store/useChatStore.ts`)
- [ ] Run `npm install zustand` to add lightweight UI state management.
- [ ] Create a Zustand store without prop drilling. State values: `isChatOpen` (boolean), `activeChannelId` (string | null).
- [ ] Provide actions: `openChat()`, `closeChat()`, `setActiveChannel(channelId)`.

### Socket & Cache Strategy Setup (`src/hooks/api/useChat.ts`)
- [ ] Set up a global singleton Socket connection when the user logs in. 
- [ ] **Teardown Fix:** Provide a logout function or unmount `useEffect` that explicitly calls `socket.disconnect()` to prevent zombie connections.
- [ ] Add `useChatChannels()` query hook. **Query Key:** `["chat", "channels", workspaceId]`.
- [ ] Add `useChatMessages(channelId)` query hook. **Query Key:** `["chat", "messages", channelId]`.
- [ ] Add `useReadChannel()` mutation hook. On success, invalidate `["chat", "channels"]` to clear the unread count dot.
- [ ] **Strict Cache Rule:** When `socket.on('receive_message')` fires, you MUST update the state using `queryClient.setQueryData(['chat', 'messages', channelId], ...)` to append the real-time message to the cache. Do not fork data into local React `useState`.
- [ ] Listen for `socket.on('channel_added')` to instantly invalidate/refetch the `["chat", "channels"]` query list.
- [ ] **"Tunnel Drop" Fix:** Listen for `socket.on('connect')` (fires on load & reconnect). When it fires, manually invalidate the `["chat", "messages", activeChannelId]` query cache to fetch any messages missed while offline.

### Wire UI Components
- [ ] **Global Chat Drawer/Sidebar:** Build a slide-out drawer accessible globally (reads `isChatOpen` from Zustand).
- [ ] **Channel List View:** Shows list. Derives Red Dot unread indicator if `channel.unread_count > 0` (computed from backend). Clicking calls `setActiveChannel(id)`.
- [ ] **Message View:** Show 50 fetched messages. Scrolling up utilizes the `before_id` cursor.
- [ ] **Read Status Triggers:** Whenever the user clicks into a channel, immediately call `useReadChannel()` (REST endpoint) to clear the unread badge on the backend, and update the cache.

---

## Files Modified Summary

| File | Who | Change |
|---|---|---|
| `backend/src/migrations/004_chat_schema.sql` | Dev A | Add explicitly secure tables with RLS |
| `backend/src/index.ts` | Dev A | Initialize Socket.io strictly |
| `backend/src/routes/chat.routes.ts` | Dev A | REST routes for channels/history |
| `backend/src/controllers/chat.controller.ts`| Dev A | Controllers without N+1 queries |
| `backend/src/services/chat.service.ts` | Dev A | Database logic & cursors |
| `frontend/src/store/useChatStore.ts` | Dev B | Zustand UI state (isChatOpen, activeChannelId) |
| `frontend/src/hooks/api/useChat.ts` | Dev B | REST hooks, robust caching & Socket logic |
| `frontend/src/components/layout/Navbar.tsx` | Dev B | Add Chat toggle button (uses Zustand `openChat`) |
| `frontend/src/components/chat/ChatDrawer.tsx` | Dev B | Main UI wrapper (reads Zustand state) |
| `frontend/src/components/chat/ChannelList.tsx`| Dev B | Wire Channel listing & red dot badging |
| `frontend/src/components/chat/MessageView.tsx`| Dev B | View messages loaded via React Query |

---

## Acceptance Criteria

- [ ] A global chat drawer can be toggled open/closed from anywhere in the app.
- [ ] **1:1 Chat:** Any member can start a private chat with any other member. No direct chat can exceed 2 members.
- [ ] **Group Chat:** Only users with role `admin` or `owner` can create groups and add users.
- [ ] React-Query handles message history while Socket.io injects new messages. Handled correctly on connection drops/tunnel losses.
- [ ] Unread badges (red dots) appear accurately and disappear instantly on channel open, without producing an N+1 scaling load on the backend.
- [ ] Users do *not* receive unread badges for messages they sent.
- [ ] App is perfectly secure: UUID guessing does not grant access to socket rooms, and RLS protects DB data.

---

## Impact on Other Modules

| Module | Impact |
|---|---|
| Module 1-5 Devs | None. Chat operates fully independently in its own database tables and API namespace using separate UI state control. |
| Owner (reviewer) | Verify Socket instance cleanly disconnects on logout, and `unread_count` properly fetches efficiently (Check backend API logs for N+1 prints). |

---

## Notes
- To prevent heavy polling, rely entirely on Socket.io for the *delivery* of new messages, and use React Query only for the initial load of the channel list and message history.
- Ensure the socket authorization strictly mimics Express Auth logic. A user should not be able to listen to a `channel_id` room they do not belong to.
