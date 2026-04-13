# 🚀 Chat Implementation Guide (Simple Mode)

This guide shows you **what** to fix, **how** it will look for the user, and **how** to code it.

---

### 1. 📂 File Uploads
*   **How it works:** User drags a file into chat. They see an image or file icon in the message.
*   **How to implement:** 
    1.  Create `POST /api/upload` route in backend.
    2.  Use **Multer** or **Supabase Storage** to save the file.
    3.  In `SmartInput.tsx`, call the upload API and send the resulting URL in the message.

### 2. ✅ Message-to-Task
*   **How it works:** Click "Convert to Task" on a message. It instantly appears in the Task Board.
*   **How to implement:** 
    1.  In `MessageTaskModal.tsx`, use the `useCreateTask` hook (from the tasks module).
    2.  In `handleCreate`, call `createTask.mutate()` with the chat message content.

### 3. 🟢 Real Online Status (Presence)
*   **How it works:** You see a green dot only if the person is **actually** on the website right now.
*   **How to implement:** 
    1.  In `backend/socket.ts`, use `io.on('connection')` to track active users.
    2.  Store active user IDs in **Redis** or a global array.
    3.  Emit a `presence_update` event to all users when someone joins or leaves.

### 4. 🔍 Deep Message Search
*   **How it works:** Type "Meeting notes" in search. It shows you the exact message from 3 months ago.
*   **How to implement:** 
    1.  Add a `GET /api/messages/search?q=...` route.
    2.  Use a SQL `LIKE %query%` or **PostgreSQL Full-Text Search**.
    3.  Update `ChatSearch.tsx` to call this API when you type.

### 5. 🗑️ Delete Channel
*   **How it works:** Admin clicks "Delete Channel." The channel disappears for everyone instantly.
*   **How to implement:** 
    1.  Create `DELETE /api/channels/:id` route.
    2.  Verify the user is an **Admin** in the database.
    3.  After deleting, emit a `channel_deleted` socket event so everyone's UI updates live.

### 6. 🔔 Persistent Mute
*   **How it works:** You mute a channel. It stays muted even after you refresh or close the tab.
*   **How to implement:** 
    1.  Add a `is_muted` boolean column to the `channel_members` table.
    2.  Create a `PATCH /api/channels/:id/mute` route.
    3.  Frontend: Toggle the database value, don't just change local React state.

### 7. 🧵 Live Thread Counts
*   **How it works:** If you are looking at the main chat and someone replies to a thread, the "5 replies" label turns into "6 replies" instantly.
*   **How to implement:** 
    1.  When a reply is sent, the backend sends a `thread_count_update` socket event.
    2.  The frontend `useChatMessages` query is invalidated or updated manually to show the new count.

### 8. 🤖 Real AI Suggestions
*   **How it works:** The input box suggests the next word or a reply based on the **actual** conversation.
*   **How to implement:** 
    1.  Create `POST /api/ai/suggest` route.
    2.  Send the last 10 messages to **Gemini API**.
    3.  The `SmartInput.tsx` calls this whenever the user pauses typing for a second.
