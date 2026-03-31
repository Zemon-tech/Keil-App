# Module 6 — Chat (Real-time Messaging)

> **Prerequisite:** Phase 0 (Foundation) must be fully merged. Socket.io requires the existing Supabase server-side auth to be stable.
> Both `workspaceId` and user authentication must be available for establishing the socket connection.

---

## Context

The Chat module introduces real-time messaging using Socket.io. It supports unrestricted 1:1 direct messages between any workspace members, and admin-only created private group channels.

**What already exists:**
- `users`, `workspaces`, and `workspace_members` tables are fully functional.
- Supabase Auth JWT is available on the frontend for authenticating sockets.
- The standard Express setup in `backend/src/app.ts` or `index.ts`.

**What is missing:**
- Database tables for Chat (`channels`, `channel_members`, `messages`).
- Socket.io server integration alongside the existing Express server.
- Chat UI (a global sidebar/drawer accessible from anywhere in the app).
- Read state tracking (red dots for unread messages).

---

## Architecture & Schema

**New Tables Needed (Migration `004_chat_schema.sql`):**

1. `channels`
   - `id` (UUID)
   - `workspace_id` (UUID, references `workspaces.id`)
   - `type` ('direct' | 'group')
   - `name` (nullable, text - for groups)
   - `created_by` (UUID, references `users.id`)
   - `created_at` (TIMESTAMPTZ)
   - `last_message_at` (TIMESTAMPTZ - updated whenever a message is sent to show recent chats)

2. `channel_members`
   - `channel_id` (UUID, references `channels.id`)
   - `user_id` (UUID, references `users.id`)
   - `joined_at` (TIMESTAMPTZ)
   - `last_read_at` (TIMESTAMPTZ - for calculating unread red dots)
   - *Constraint: UNIQUE(channel_id, user_id)*

3. `messages`
   - `id` (UUID)
   - `channel_id` (UUID, references `channels.id`)
   - `sender_id` (UUID, references `users.id`)
   - `content` (TEXT)
   - `created_at` (TIMESTAMPTZ)

---

## API & Socket Contract

Both developers must agree on and freeze these detailed shapes before starting their `feature/chat` branches.

### 1. `POST /api/v1/chat/channels/direct`
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
  "data": {
    "channel": {
      "id": "uuid",
      "type": "direct",
      "created_at": "ISO string",
      "last_message_at": "ISO string"
    }
  }
}
```

### 2. `POST /api/v1/chat/channels/group`
**Description:** Creates a private group channel. (Admin/Owner only).
**Request body:**
```json
{
  "name": "string (required, max 50 chars)",
  "member_ids": ["uuid", "uuid"]
}
```
**Response 201:**
```json
{
  "success": true,
  "data": {
    "channel": {
      "id": "uuid",
      "name": "Team Alpha",
      "type": "group",
      "created_at": "ISO string",
      "last_message_at": "ISO string"
    }
  }
}
```

### 3. `GET /api/v1/chat/channels`
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
        "unread_count": 2,
        "last_message_at": "ISO string",
        "members": [
          { "id": "uuid", "name": "Alice" },
          { "id": "uuid", "name": "Bob" }
        ]
      }
    ]
  }
}
```

### 4. `GET /api/v1/chat/channels/:id/messages`
**Description:** Load last 50 messages of a channel.
**Query params:** `limit=50`
**Response 200:**
```json
{
  "success": true,
  "data": {
    "messages": [
      {
        "id": "uuid",
        "channel_id": "uuid",
        "sender": { "id": "uuid", "name": "string" },
        "content": "Hey there!",
        "created_at": "ISO string"
      }
    ]
  }
}
```

### 5. `POST /api/v1/chat/channels/:id/read`
**Description:** Acknowledges all messages in the channel as read. Updates `last_read_at` to `NOW()`.
**Request body:** empty
**Response 200:**
```json
{
  "success": true,
  "message": "Channel marked as read"
}
```

### Socket.io Events Setup

**1. Connecting to the Server**
The client must send the authentication token when connecting:
```javascript
const socket = io("http://localhost:3000", {
  auth: { token: "SUPABASE_JWT_TOKEN" }
});
```

**2. Joining a Channel (Client → Server)**
Fired automatically when the user clicks a chat in their list.
- **Event:** `join_channel`
- **Payload:** `{ "channel_id": "uuid" }`

**3. Sending a Message (Client → Server)**
- **Event:** `send_message`
- **Payload:**
```json
{
  "channel_id": "uuid",
  "content": "Hello team!"
}
```

**4. Receiving a Message (Server → Client)**
Server broadcasts string payload to everyone in the `channel_id` room.
- **Event:** `receive_message`
- **Payload:**
```json
{
  "id": "uuid",
  "channel_id": "uuid",
  "sender": { "id": "uuid", "name": "Jane Doe" },
  "content": "Hello team!",
  "created_at": "ISO string"
}
```

---

## Developer A — Backend

> Branch: `feature/chat-be`

### Setup
- [ ] Install `socket.io` and configure it in `backend/src/index.ts` alongside the Express HTTP server.
- [ ] Implement a Socket Middleware that extracts the Supabase JWT token, verifies it, and attaches the user to the socket.

### Database & Migrations
- [ ] Create `004_chat_schema.sql` with `channels`, `channel_members`, and `messages` tables.
- [ ] Add trigger to update `channels.last_message_at` exactly when a new message is inserted.

### Controllers & Services
- [ ] Implement `chat.controller.ts`, `chat.service.ts`, and `chat.repository.ts`.
- [ ] `createDirectChannel`: Check if a 1:1 already exists between the two users. If yes, return it. If no, create it and add both to `channel_members`.
- [ ] `createGroupChannel`: Validate `req.user` role is `admin` or `owner`. Create channel, add requested users to `channel_members`.
- [ ] `getUserChannels`: Return user's channels. **Compute unread state** by checking if `channel.last_message_at > channel_member.last_read_at`.
- [ ] `getChannelMessages`: Enforce `LIMIT 50` ascending/descending. Ensure user is a member of the channel.
- [ ] `markAsRead`: Update `last_read_at` for the current user in `channel_members`.

### Socket Logic
- [ ] On `send_message`: Validate user is in channel. Save message to DB. Emit `receive_message` strictly to users in that `channel_id` room.

---

## Developer B — Frontend

> Branch: `feature/chat-fe`

### Setup & Phase 0 Checks
- [ ] Run `npm install zustand` to add lightweight UI state management.
- [ ] Ensure Supabase JWT is accessible so it can be passed to the `Socket` instance.

### UI State Management (`src/store/useChatStore.ts`)
- [ ] Create a Zustand store to manage global chat UI state without prop drilling.
- [ ] Provide state values: `isChatOpen` (boolean default `false`) and `activeChannelId` (string | null).
- [ ] Provide actions: `openChat()`, `closeChat()`, `setActiveChannel(channelId)`.

### Create Hooks & Socket Setup (`src/hooks/api/useChat.ts`)
- [ ] Set up a global singleton Socket connection when the user logs in.
- [ ] `useChatChannels()` — Query for the sidebar list of channels.
- [ ] `useChatMessages(channelId)` — Query to load the initial 50 messages.
- [ ] `useReadChannel()` — Mutation to hit `POST /.../read`.
- [ ] Wire `socket.on('receive_message')` to update the React Query cache dynamically (or append to a local React state if preferred for chat).

### Wire UI Components
- [ ] **Global Chat Drawer/Sidebar:** Build a slide-out drawer accessible globally (reads `isChatOpen` from Zustand).
- [ ] **Channel List View:** Show list of 1:1s and Groups. Clicking a channel calls `setActiveChannel(id)` in the Zustand store.
- [ ] **Unread Indicators:** Show a red dot or bold text on channels where `last_message_at > last_read_at` (derived from backend response).
- [ ] **Message View:** Show 50 fetched messages + any new real-time messages at the bottom.
- [ ] **Read Status Triggers:** Whenever the user clicks into a channel, immediately call `useReadChannel()` to clear the unread badge.
- [ ] **Admin Control:** Only render the "Create Group" button if the current user profile has role `admin` or `owner`.

---

## Files Modified

### Backend
| File | Change |
|---|---|
| `backend/src/migrations/004_chat_schema.sql` | **New file** |
| `backend/src/index.ts` | Initialize Socket.io |
| `backend/src/routes/chat.routes.ts` | **New file** — REST routes for channels/history |
| `backend/src/controllers/chat.controller.ts` | **New file** |
| `backend/src/services/chat.service.ts` | **New file** |

### Frontend
| File | Change |
|---|---|
| `frontend/src/store/useChatStore.ts` | **New file** — Zustand UI state (isChatOpen, activeChannelId) |
| `frontend/src/hooks/api/useChat.ts` | **New file** — REST hooks & Socket logic |
| `frontend/src/components/layout/Navbar.tsx` | Add Chat toggle button (uses Zustand `openChat`) |
| `frontend/src/components/chat/ChatDrawer.tsx` | **New file** — Main UI wrapper (reads Zustand state) |
| `frontend/src/components/chat/ChannelList.tsx`| **New file** |
| `frontend/src/components/chat/MessageView.tsx`| **New file** |

---

## Acceptance Criteria

- [ ] A global chat drawer can be toggled open/closed from anywhere in the app.
- [ ] **1:1 Chat:** Any member can start a private chat with any other member.
- [ ] **Group Chat:** Only users with role `admin` or `owner` can create groups and add users.
- [ ] Privacy: A user only sees channels/groups they are a member of.
- [ ] Real-time: Sending a message instantly shows up on the receiver's screen without a browser refresh.
- [ ] Payload constraints: Only text messages (no rich media/attachments). No edit/delete features.
- [ ] Message history loads a max of 50 recent messages.
- [ ] Unread badges (red dots) appear precisely when a new message arrives, and explicitly disappear when the user opens the respective chat.

---

## Impact on Other Developers

| Who | Impact |
|---|---|
| **Module 1-5 Devs** | None. Chat operates fully independently in its own database tables and API namespace. |
| **Owner (reviewer)** | Must verify Socket instance cleanly disconnects on logout, and cannot be accessed without valid JWT. |

---

## Notes
- To prevent heavy polling, rely entirely on Socket.io for the *delivery* of new messages, and use React Query only for the initial load of the channel list and message history.
- Ensure the socket authorization strictly mimics Express Auth logic. A user should not be able to listen to a `channel_id` room they do not belong to.
