# Backend Implementation Plan: Module 6 - Real-time Chat

This document provides a highly detailed, step-by-step guide for implementing the backend portion of the Real-time Chat feature (Module 6). Follow these steps sequentially.

## 🚀 Phase 1: Database Setup & Migrations

**Goal:** Create the underlying database structures, enforce security via Row Level Security (RLS), and set up automated triggers.

**Action Item:** Create a new migration file `backend/src/migrations/004_chat_schema.sql`.

**Implementation Details:**
1.  **Table 1: `channels`**
    *   **Columns:** `id` (UUID, Primary Key), `workspace_id` (UUID, Foreign Key referencing `workspaces.id`), `name` (VARCHAR, nullable, for groups), `type` (VARCHAR: 'direct' or 'group'), `created_at` (TIMESTAMP), `last_message_at` (TIMESTAMP).
2.  **Table 2: `channel_members`**
    *   **Columns:** `channel_id` (UUID, Foreign Key referencing `channels.id`), `user_id` (UUID, Foreign Key referencing `users.id`), `joined_at` (TIMESTAMP), `last_read_at` (TIMESTAMP, default `NOW()`).
    *   **Constraints:** Composite Primary Key on `(channel_id, user_id)` to prevent duplicate memberships.
3.  **Table 3: `messages`**
    *   **Columns:** `id` (UUID, Primary Key), `channel_id` (UUID, Foreign Key referencing `channels.id`), `sender_id` (UUID, Foreign Key referencing `users.id`), `content` (TEXT), `created_at` (TIMESTAMP).
4.  **Row Level Security (RLS) Policies:**
    *   Enable RLS on all three tables (`ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;`).
    *   **Channels:** Users can only `SELECT` channels where their user ID exists in the `channel_members` table for that specific channel.
    *   **Channel Members:** Users can only `SELECT` members of channels they are a part of.
    *   **Messages:** Users can `SELECT` and `INSERT` messages only if they are a member of the corresponding `channel_id`.
5.  **Database Trigger:**
    *   Write a PL/pgSQL function and trigger. Every time an `INSERT` happens on the `messages` table, the trigger must update the `last_message_at` column in the `channels` table for the corresponding `channel_id` to `NOW()`.

---

## 🚀 Phase 2: Socket.io Integration & Security

**Goal:** Upgrade the Express server to handle WebSockets securely using Supabase JWTs.

**Implementation Details:**
1.  **Dependencies:** `npm install socket.io` (and `@types/socket.io` for development).
2.  **Server Initialization (`backend/src/index.ts`):**
    *   Currently, Express might be listening directly. Change this to use Node's `http` module:
        `const server = http.createServer(app);`
    *   Initialize Socket.io: `const io = new Server(server, { cors: { origin: '*' } });`
    *   Listen on `server.listen(...)` instead of `app.listen(...)`.
3.  **Socket Authentication Middleware:**
    *   Create a middleware function for Socket.io (`io.use(...)`).
    *   Extract the token from `socket.handshake.auth.token`.
    *   Verify the token using `supabaseAdmin.auth.getUser(token)` (similar to your existing `protect` middleware).
    *   If invalid, call `next(new Error("unauthorized"))` to reject the connection.
    *   If valid, attach the user ID and workspace ID to the socket object: `socket.data.userId = user.id; socket.data.workspaceId = workspaceId;`.

---

## 🚀 Phase 3: REST API Controllers & Services

**Goal:** Build the business logic for fetching history, creating channels, and managing read states.

**Implementation Details:**
**A. Services (`backend/src/services/chat.service.ts`)**
*   Write modular database queries using your `pg` pool framework. Keeping DB queries isolated here makes controllers clean.

**B. Controllers (`backend/src/controllers/chat.controller.ts`)**
1.  `createDirectChannel(req, res)`:
    *   **Validation:** Verify `target_user_id` belongs to `req.workspaceId`.
    *   **Logic:** Check the DB if a 'direct' channel already exists containing EXACTLY `req.user.id` and `target_user_id`.
    *   **Action:** If it exists, return it (status 200). If not, create a new channel (type: 'direct') and insert BOTH users into `channel_members` (status 201).
    *   **Safeguard (The 3-Person Bug):** Strict hardcode logic ensuring no more than 2 entries are ever added to a `direct` channel.
2.  `createGroupChannel(req, res)`:
    *   **Validation:** Require `req.user` role to be 'admin' or 'owner' in the workspace. Verify all `member_ids` belong to `req.workspaceId`.
    *   **Action:** Create a channel (type: 'group', with provided `name`) and add the requested `member_ids` (along with the creator) to the `channel_members` table.
3.  `getChannels(req, res)`:
    *   **CRITICAL FIX (N+1 Bug):** Do NOT loop over channels to fetch unread counts.
    *   **Logic:** Write a single intelligent SQL query using `LEFT JOIN` and aggregations.
        *   Example conceptually: `SELECT c.*, json_agg(u.*) as members, COUNT(m.id) as unread_count FROM channels c LEFT JOIN channel_members cm ON c.id = cm.channel_id LEFT JOIN messages m ON m.channel_id = c.id AND m.created_at > cm.last_read_at WHERE cm.user_id = $1 AND c.workspace_id = $2 GROUP BY c.id`
4.  `getChannelMessages(req, res)`:
    *   **Logic:** Fetch messages where `channel_id = req.params.id`.
    *   **Constraints:** Enforce `ORDER BY created_at DESC LIMIT 50`. Add an optional `before_id` (UUID cursor) for pagination logic.
5.  `markAsRead(req, res)`:
    *   **Action:** Update `channel_members` table. Set `last_read_at = NOW()` where `channel_id = req.params.id` and `user_id = req.user.id`.

---

## 🚀 Phase 4: API Routing Setup

**Goal:** Expose the controllers via protected Express routes following standard patterns.

**Implementation Details:**
Create `backend/src/routes/chat.routes.ts`:
*   Import the existing `protect` middleware from your authentication setup.
*   Setup these distinct routes:
    *   `POST /api/v1/chat/channels/direct` -> `protect`, `createDirectChannel`
    *   `POST /api/v1/chat/channels/group`  -> `protect`, `createGroupChannel`
    *   `GET /api/v1/chat/channels`         -> `protect`, `getChannels`
    *   `GET /api/v1/chat/channels/:id/messages` -> `protect`, `getChannelMessages`
    *   `POST /api/v1/chat/channels/:id/read` -> `protect`, `markAsRead`
*   Mount this router module in `backend/src/routes/index.ts`.

---

## 🚀 Phase 5: Real-time Socket Event Handlers

**Goal:** Implement the bi-directional, push-based communication logic safely.

**Implementation Details:**
Inside your main Socket orchestration logic (e.g., `io.on('connection', async (socket) => {...})`):

1.  **On Connection (Room Initialization):**
    *   Query the database to fetch ALL `channel_id`s the authenticated user belongs to.
    *   Loop and strictly join those rooms: `socket.join(channelId)`.
    *   Also join a personalized room for targeted events: `socket.join('user:' + socket.data.userId)`.
2.  **Event: `send_message` (Client to Server):**
    *   **Input payload:** `{ channel_id: 'uuid', content: 'hello' }`.
    *   **Security Check:** VERIFY against the database that `socket.data.userId` is actively a member of `channel_id`. Do not trust the client.
    *   **Action 1 (Persistence):** Insert the message payload into the `messages` table.
    *   **Action 2 (Sender Red-Dot Fix):** Instantly execute an `UPDATE` on `channel_members`, setting `last_read_at = NOW()` for the **sender** in this channel. This ensures they don't see an unread badge for their own composed message.
    *   **Action 3 (Broadcast):** `io.to(channel_id).emit('receive_message', newMessageObject)`.
3.  **Event: `channel_added` (Triggered via API, Not Client Socket):**
    *   When the REST API (`chat.controller.ts`) successfully creates a *new* group or direct channel, it needs access to the `io` instance.
    *   **Action:** Iterate through all `member_ids` added to the channel. Execute `io.to('user:' + memberId).emit('channel_added', newChannelObj)`. This tells their frontend to refetch the channel list instantly.

---
---

## ✅ Backend Developer Task Checklist

Keep this file open and tick these off `[x]` as you complete them to ensure absolutely no requirements are skipped.

### 1. Database Foundation
- [x] Create migration file `004_chat_schema.sql`.
- [x] Write `CREATE TABLE` script for `channels` (MUST include `workspace_id`).
- [x] Write `CREATE TABLE` script for `channel_members` (Composite key: `channel_id, user_id`).
- [x] Write `CREATE TABLE` script for `messages`.
- [x] Execute `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` for all three tables.
- [x] Write strict `CREATE POLICY` statements ensuring users access only their designated channels.
- [x] Write a PL/pgSQL function & trigger to auto-update `channels.last_message_at` on message `INSERT`.

### 2. Socket Server & Infrastructure
- [x] Run `npm install socket.io`.
- [x] Convert `index.ts` to use Node `http.createServer()` explicitly with the Express app.
- [x] Initialize `socket.io` server attached to the HTTP server.
- [x] Implement socket authentication middleware extracting and verifying Supabase JWT.
- [x] Test that invalid tokens result in an immediate socket disconnection.

### 3. REST API Implementation
- [x] Create skeleton files `chat.service.ts` and `chat.controller.ts`.
- [x] **`createDirectChannel`**: Implement DB check for existing channels to prevent duplicates.
- [x] **`createDirectChannel`**: Add the absolute 2-member limit logic (**3-Person Bug safeguard**).
- [x] **`createGroupChannel`**: Implement Admin/Owner role validation check before creation.
- [x] **`getChannels`**: Write the optimized SQL JOIN query to fetch list + `unread_count` efficiently (**N+1 Bug Fix**).
- [x] **`getChannelMessages`**: Implement fetching with strict `LIMIT 50` and SQL cursor logic.
- [x] **`markAsRead`**: Endpoint logic to sync `last_read_at` timestamp.
- [x] Create `chat.routes.ts`, map standard responses `{"success": true|false}`, and attach to main router with `protect` middleware.

### 4. Socket Events Workflow
- [x] **On Connect**: Code logic to auto-query and force-join user into their authorized `channel_id` rooms.
- [x] **On Connect**: Force-join user into their private `user:<userId>` room.
- [x] **`send_message`**: Validate membership before processing.
- [x] **`send_message`**: Save message strictly to database.
- [x] **`send_message`**: Implement the **Sender Red-Dot Fix** DB update immediately after insert.
- [x] **`send_message`**: Broadcast using `.to(channel_id).emit()`.
- [x] **`channel_added`**: Bridge the controller to emit events to affected `user:<userId>` rooms upon channel creation.

### 5. Final QA Validation
- [x] Start server and verify PostgreSQL connection logs.
- [x] Inspect API code to ensure zero `console.log` loops inside array maps acting as N+1 query leaks.
- [x] Confirm all `POST/GET` routes strictly filter based on `req.workspaceId`.
