# Plan: Robust In-App Notification System

This plan outlines the phase-wise architecture and implementation strategy for building a robust, production-ready, asynchronous, and real-time In-App Notification System for ClarityOS (Keil-App).

---

## Context & Objectives

*   **Goal**: Deliver a highly performant, non-blocking notification feed in the app's side drawer and full-screen dialog, keeping users informed of critical updates across their workspaces.
*   **Decoupled & Asynchronous Design (Option B)**: Core business transactions (like comments, task updates, and chats) must never block on notification generation or distribution. Actions will insert a lightweight job into a `notification_outbox` queue table within the same transaction. A background outbox worker will process these jobs asynchronously to ensure high system resilience.
*   **Exclusion of Actor**: Users will never receive notifications for actions they perform themselves (e.g., if User A assigns a task to User B, only User B is notified; if User A comments on a task, User A gets no notification).
*   **Real-time Push & Toasting**: New notifications will push immediately over WebSockets (via the existing Socket.io server) to online users, triggering an interactive floating toast and updating the unread badge count in real-time.
*   **Opt-In Preference Control**: Users can toggle notifications for specific categories via the updated `Notifications` tab in the Settings panel.

---

## System Architecture Flow

```mermaid
sequenceDiagram
    autonumber
    actor Actor as Triggering User
    participant API as Express API Service
    participant DB as Postgres Database
    participant Worker as Background Outbox Processor
    participant Socket as Socket.io Service
    actor Recipient as Target Recipient

    Actor->>API: 1. Dispatches action (e.g., Post Comment)
    
    rect rgb(240, 240, 245)
        Note over API,DB: Executed in a single atomic SQL Transaction
        API->>DB: 2a. Insert comment record
        API->>DB: 2b. Write Outbox Job (event_type, entity_id, actor_id, potential_recipients)
    end
    
    API-->>Actor: 3. Return 200 OK Response (Immediate / Non-blocking)

    Note over Worker,DB: Worker wakes up via LISTEN/NOTIFY or 2s Poller
    
    rect rgb(255, 250, 240)
        Note over Worker,DB: Process Job Asynchronously
        Worker->>DB: 4. Lock & Claim Outbox Job
        Worker->>DB: 5. Filter out actor & query recipient notification preferences
        Worker->>DB: 6. Insert rows into "notifications" table for opted-in recipients
        Worker->>DB: 7. Delete/Mark completed in "notification_outbox"
    end

    Worker->>Socket: 8. Trigger real-time broadcast (`io.to("user:recipient_id")`)
    Socket-->>Recipient: 9. Dynamic payload delivered: floating toast pops & unread count increments
```

---

## Phase-Wise Implementation

### Phase 1: Database Migration & Schema Setup

#### Task 1.1: Create Preferences & Notification Schema
Write a SQL migration file `018_notification_system.sql` in `backend/src/migrations` to create the required tables, default values, and performance-optimized indexes:

1.  **`public.user_notification_preferences`**:
    *   `user_id` (UUID, Primary Key, FK to `public.users` ON DELETE CASCADE)
    *   `notify_task_assigned` (BOOLEAN, DEFAULT true)
    *   `notify_message` (BOOLEAN, DEFAULT true)
    *   `notify_motion_shared` (BOOLEAN, DEFAULT true)
    *   `notify_status_changed` (BOOLEAN, DEFAULT true)
    *   `notify_membership_updated` (BOOLEAN, DEFAULT true)
    *   `notify_comment_mention` (BOOLEAN, DEFAULT true)
    *   `updated_at` (TIMESTAMPTZ, DEFAULT NOW())

2.  **`public.notifications`**:
    *   `id` (UUID, Primary Key, DEFAULT gen_random_uuid())
    *   `workspace_id` (UUID, FK to workspaces ON DELETE CASCADE)
    *   `org_id` (UUID, Nullable, FK to organisations ON DELETE CASCADE)
    *   `space_id` (UUID, Nullable, FK to spaces ON DELETE CASCADE)
    *   `recipient_id` (UUID, FK to users ON DELETE CASCADE)
    *   `sender_id` (UUID, Nullable, FK to users ON DELETE SET NULL)
    *   `event_type` (TEXT, NOT NULL) -- 'task_assigned', 'someone_messaged', 'motion_shared', etc.
    *   `entity_type` (TEXT, NOT NULL) -- 'task', 'comment', 'channel_message', etc.
    *   `entity_id` (UUID, NOT NULL)
    *   `payload` (JSONB, NOT NULL) -- stores dynamic parameters, like `{ "task_title": "Fix login", "sender_name": "Mike" }`
    *   `read_at` (TIMESTAMPTZ, Nullable, Default NULL)
    *   `created_at` (TIMESTAMPTZ, Default NOW())

3.  **`public.notification_outbox`**:
    *   `id` (UUID, Primary Key, DEFAULT gen_random_uuid())
    *   `workspace_id` (UUID, NOT NULL)
    *   `org_id` (UUID)
    *   `space_id` (UUID)
    *   `sender_id` (UUID, Nullable)
    *   `event_type` (TEXT, NOT NULL)
    *   `entity_type` (TEXT, NOT NULL)
    *   `entity_id` (UUID, NOT NULL)
    *   `payload` (JSONB, NOT NULL)
    *   `status` (TEXT, NOT NULL, DEFAULT 'pending') -- 'pending', 'processing', 'failed'
    *   `attempts` (INTEGER, DEFAULT 0)
    *   `created_at` (TIMESTAMPTZ, Default NOW())

4.  **Database Indexes**:
    *   Composite index on `notifications(recipient_id) WHERE read_at IS NULL` for rapid unread badge loading.
    *   Composite index on `notifications(recipient_id, created_at DESC)` for high-performing, paginated inbox rendering.
    *   Index on `notification_outbox(status)` to query pending jobs.

---

### Phase 2: Transactional Outbox Job Queue & Processor

#### Task 2.1: Implement Backend Outbox Repositories & Services
1.  Add `notification.repository.ts` under `backend/src/repositories/` to handle operations for `notifications`, `notification_outbox`, and `user_notification_preferences`.
2.  Define backend enum values for new event triggers in `backend/src/types/enums.ts`.
3.  Add TypeScript types mirroring the entity schemas in `backend/src/types/entities.ts`.

#### Task 2.2: Build the Background Outbox Worker
Create a reliable background processor service `notification-worker.service.ts` in `backend/src/services/` that handles queue processing asynchronously:
1.  **Polling/Listen loop**: Runs a polling timer every 2 seconds (or uses PostgreSQL `LISTEN/NOTIFY` pub-sub trigger on `notification_outbox` inserts) to wake up and fetch pending jobs.
2.  **Concurrency lock**: Safely locks rows (e.g. `SELECT ... FOR UPDATE SKIP LOCKED` or updating status to `processing`) to prevent duplicate processing by clustered Node instances.
3.  **Fan-out distribution logic**:
    *   Identifies the list of target recipients based on the event:
        *   `task_assigned`: The newly assigned user.
        *   `someone_messaged`: All channel members (excluding the sender).
        *   `motion_shared`: Shared users.
        *   `task_status_changed`: Task assignees.
        *   `membership_updates`: The affected member.
        *   `mention_in_comment`: The user whose username/email was tagged in the comment.
    *   Filters out the `sender_id` (actor) so they do not notify themselves.
    *   Queries `user_notification_preferences` for each recipient.
    *   If opted-in, generates a customized payload and writes a row to `notifications`.
4.  **Completion/Cleanup**: Deletes successfully fanned-out outbox records (or marks them as `completed` with a retention policy to delete logs older than 7 days) to keep the table size compact.

---

### Phase 3: Backend Hooks Integration

Integrate the outbox-write hooks within existing business services so that they record a job to the outbox queue inside their current active database transactions:

1.  **Task Service (`task.service.ts`, `org-task.service.ts`)**:
    *   Hook into task assignment/re-assignment → enqueue outbox job for `task_assigned`.
    *   Hook into task status update → enqueue outbox job for `task_status_changed`.
2.  **Comment Service (`comment.service.ts`)**:
    *   Regex-parse comment text for `@mentions` on comment insertion.
    *   If mentions exist, enqueue outbox jobs for `mention_in_comment`.
    *   If no mentions, enqueue `comment_created` for other task assignees.
3.  **Chat Service (`org-chat.service.ts`)**:
    *   On channel message insertion → enqueue outbox job for `someone_messaged`.
4.  **Motion Service (`motion-page.service.ts`)**:
    *   On page sharing configurations → enqueue outbox job for `motion_shared`.
5.  **Membership Service (`workspace.service.ts` or `organisation.service.ts`)**:
    *   On membership additions or changes → enqueue outbox job for `membership_updates`.

---

### Phase 4: API Endpoints & Real-Time Socket Gateway

#### Task 4.1: Define API Routes `/api/v1/notifications`
Implement standard RESTful endpoints under `/api/v1/notifications` mapped through a new controller and express route file:
*   `GET /api/v1/notifications`: Paginated feed of notifications scoped to the current user (excluding cleared ones).
*   `GET /api/v1/notifications/unread-count`: Returns the integer count of unread notifications for active badge rendering.
*   `PATCH /api/v1/notifications/:id/read`: Marks a single notification as read (updates `read_at = NOW()`).
*   `POST /api/v1/notifications/read-all`: Marks all notifications for the active user in the current workspace as read.
*   `DELETE /api/v1/notifications/clear-all`: Soft-deletes or archives all notifications for the user (updating a `cleared_at` field or executing a bulk delete) to empty their feed.

#### Task 4.2: Update Sockets (`socket.ts`)
1.  Whenever the background worker successfully creates a notification in the DB, invoke a function `broadcastNotification(recipientId, notificationPayload)` on the socket server.
2.  The socket server broadcasts the event: `io.to("user:recipientId").emit("new_notification", notificationPayload)`.

---

### Phase 5: Settings Preference Tab, Toasts & Feed UI

#### Task 5.1: Integrate Dynamic Settings Preference Toggles
Modify `NotificationsTab` inside [SettingsDialog.tsx](file:///s:/1-Project/Quild/Keil-App/frontend/src/components/SettingsDialog.tsx):
1.  Change the static switches to load values from `GET /api/v1/users/me/notification-preferences`.
2.  On toggle change, perform `PATCH /api/v1/users/me/notification-preferences` with the updated JSON state to store preferences permanently in Postgres.

#### Task 5.2: Implement Notification Drawer & Dialog Logic
1.  Create a unified `useNotifications` React hook or Context provider:
    *   Fetches unread counts and initial paginated lists of notifications.
    *   Configures the Socket.io hook to listen for `new_notification` events.
    *   Appends incoming socket notifications to the local array in real-time, incrementing the unread count.
2.  Integrate the hook inside [NotificationDrawer.tsx](file:///s:/1-Project/Quild/Keil-App/frontend/src/components/NotificationDrawer.tsx) and [NotificationDialog.tsx](file:///s:/1-Project/Quild/Keil-App/frontend/src/components/NotificationDialog.tsx):
    *   Render notification cards using the sleek, modern design implemented in the visual cleanup.
    *   Open action hook: When drawer or dialog mounts/opens, automatically trigger `POST /api/v1/notifications/read-all` to clear the unread count badge.
3.  **Floating Toasts**: On receipt of a socket notification when active in the app, trigger a highly visual floating toast (e.g., using `sonner` or a premium tailwind/glassmorphic custom layout) containing the notification title, description, and a quick "Mark as Read" action.

---

## Constraints & Edge Cases

1.  **Self-Action Filtering**: Ensure that the `sender_id` (actor) is strictly compared against the target recipient list at the worker level. No outbox fan-out can result in `recipient_id === sender_id`.
2.  **Outbox Worker Transaction Isolation**: Ensure database locks use `FOR UPDATE SKIP LOCKED` inside the worker query. This prevents concurrency lock contention or duplicate execution in multi-server or clustered production environments.
3.  **Authentication Constraints**: The socket initialization middleware in `socket.ts` enforces rigorous Supabase JWT verification. Socket rooms (`user:${user.id}`) are secure, preventing notification eavesdropping.
4.  **Outbox Table Growth**: If left unchecked, the outbox table will grow infinitely. Ensure processed or dead-letter outbox rows are systematically cleaned up by the worker once completed.

---

## Acceptance Criteria

### Backend Verification
*   **Transactional Safety**: Core actions (posting comment, updating task) complete successfully even if the notification worker process is stopped.
*   **Decoupling**: Outbox rows are inserted reliably during active database transactions.
*   **Worker Reliability**: When the background worker is started, it pulls pending outbox rows, queries recipient preferences, inserts customized rows in the `notifications` table, and deletes the processed outbox rows.
*   **Preferences Enforcement**: Setting a trigger toggle (e.g., `notify_task_assigned`) to `false` successfully blocks notification generation for that event.
*   **API Performance**: `/api/v1/notifications` endpoint returns a paginated list within < 50ms using indexing.

### Frontend & Visual Verification
*   **Real-Time Delivery**: Creating a task assignment instantly increments the unread count badge on the recipient's sidebar without requiring page refreshes.
*   **Toast Alert**: Active users receive a sleek, modern, glassmorphic toast notification at the screen corner with action buttons.
*   **Badge Auto-Clear**: Opening the Notification Drawer automatically marks notifications as read, clearing the unread count.
*   **Settings Synchrony**: Toggling notification categories in the Settings Dialog successfully persists preferences to the database, instantly affecting future events.
