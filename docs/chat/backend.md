# Chat — Backend Guide

## File Structure

```
backend/src/
├── socket.ts                          # Socket.io init, auth middleware, event handlers
├── controllers/
│   └── org-chat.controller.ts         # REST request handlers
├── services/
│   ├── org-chat.service.ts            # Active org-scoped chat service
│   └── chat.service.ts                # Legacy workspace-scoped (not used by routes)
├── routes/
│   ├── org-chat.routes.ts             # Chat route definitions
│   └── v1.routes.ts                   # Mount point for org-chat routes
├── middlewares/
│   ├── auth.middleware.ts             # protect (JWT verification)
│   └── org-context.middleware.ts      # requireOrgMember, requireSpaceMember
├── migrations/
│   ├── 004_chat_schema.sql            # Channels, members, messages tables
│   ├── 005_platform_organisation_space_schema.sql  # Adds org_id/space_id to channels
│   └── 010_chat_schema_fix.sql        # Drops NOT NULL on workspace_id
└── config/
    ├── pg.ts                          # PostgreSQL connection pool
    └── supabase.ts                    # Supabase admin client
```

## Database Schema

### `channels`
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK, default `gen_random_uuid()` | Channel identifier |
| workspace_id | UUID | **Nullable**, FK → workspaces | Legacy workspace mapping |
| org_id | UUID | NOT NULL, FK → organisations | Owning organisation |
| space_id | UUID | NOT NULL, FK → spaces | Owning space |
| name | VARCHAR(50) | Nullable | Group channel name (null for DMs) |
| type | VARCHAR(20) | NOT NULL, CHECK ('direct', 'group') | Channel type |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Creation timestamp |
| last_message_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Updated by trigger |

### `channel_members`
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| channel_id | UUID | NOT NULL, PK (composite) | Channel reference |
| user_id | UUID | NOT NULL, PK (composite) | User reference |
| role | VARCHAR(20) | NOT NULL, DEFAULT 'member', CHECK ('admin', 'member') | Membership role |
| joined_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Join timestamp |
| last_read_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | For unread count calculation |

### `messages`
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK, default `gen_random_uuid()` | Message identifier |
| channel_id | UUID | NOT NULL, FK → channels | Parent channel |
| sender_id | UUID | NOT NULL, FK → users | Message author |
| content | TEXT | NOT NULL | Message body |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Send timestamp |

### Relationships

```
channels 1───* channel_members *───1 users
channels 1───* messages       *───1 users (via sender_id)
```

### Trigger
```sql
-- Auto-update channels.last_message_at on new message
CREATE TRIGGER trg_update_channel_last_message_at
    AFTER INSERT ON public.messages
    FOR EACH ROW
    EXECUTE FUNCTION public.update_channel_last_message_at();
```

## Middleware

### protect (`auth.middleware.ts`)
- Extracts `Bearer` token from `Authorization` header.
- Verifies via `supabaseAdmin.auth.getUser(token)`.
- Attaches user object to `req`.

### requireOrgMember (`org-context.middleware.ts`)
- Validates `:orgId` param is a UUID.
- Queries `organisation_members` for the user.
- Returns 403 if not a member.
- Attaches org row to `(req as any).org`.

### requireSpaceMember (`org-context.middleware.ts`)
- Validates `:spaceId` param is a UUID.
- Queries `space_members` scoped to org.
- Returns 403 if not a member.
- Attaches space row (with `compatibility_workspace_id`) to `(req as any).space`.

## Routing

Routes are registered in `org-chat.routes.ts` with `mergeParams: true`:

```typescript
router.use(protect, requireOrgMember, requireSpaceMember);

router.post("/channels/direct", createDirectChannel);
router.post("/channels/group", createGroupChannel);
router.get("/channels", getUserChannels);
router.get("/channels/:id/messages", getChannelMessages);
router.post("/channels/:id/read", markChannelAsRead);
router.post("/channels/:id/members", addChannelMembers);
router.delete("/channels/:id/members/:userId", removeChannelMember);
```

Mounted at `/api/v1/orgs/:orgId/spaces/:spaceId/chat` in `v1.routes.ts`.

## Socket.io

### Initialization (`socket.ts`)
- Creates Socket.io server with CORS for frontend origins.
- **Auth middleware**: extracts JWT from `socket.handshake.auth.token`, verifies via Supabase, attaches user.
- On connection:
  - Joins personal room `user:<id>`.
  - Fetches all channel memberships and joins `channel:<id>` rooms.
  - Fetches space memberships and joins `space:<id>` rooms.

### Event Handlers

| Handler | Purpose | Key Logic |
|---------|---------|-----------|
| `send_message` | Save + broadcast | Verify channel membership → `orgChatService.saveMessage()` → broadcast `receive_message` to room |
| `typing_start` | Broadcast typing | Verify membership → broadcast to room (exclude sender) |
| `typing_end` | End typing | Verify membership → broadcast to room (exclude sender) |
| `join_channel` | Join room | Verify membership → `socket.join(channel:<id>)` |

### Helper Functions

```typescript
broadcastNewChannel(memberIds, channel)
// Emits "channel_added" to each member's personal room `user:<id>`

broadcastMotionChange(spaceId, payload)
// Emits "motion_change" to all members of a space (not chat-specific)
```

## Key Services

### `org-chat.service.ts`

| Function | Purpose |
|----------|---------|
| `findDirectChannel` | Check if DM already exists between two users |
| `createChannel` | Create channel + add members (transactional, validates space membership) |
| `getUserChannels` | List all channels for user in space with unread counts |
| `getChannelById` | Get single channel with members |
| `getChannelMessages` | Paginated messages (composite cursor `(created_at, id)`) |
| `saveMessage` | INSERT message + mark sender as read |
| `markAsRead` | UPDATE `last_read_at` |
| `addMembers` | Bulk add members to group channel |
| `removeMember` | Remove member from channel |

### `createChannel` Transaction
```
BEGIN
  Validate all memberIds belong to the space
  INSERT INTO channels
  For each member: INSERT INTO channel_members (admin role for group creator)
COMMIT
```

## Migration: Schema Fix

```sql
-- 010_chat_schema_fix.sql
ALTER TABLE public.channels ALTER COLUMN workspace_id DROP NOT NULL;
```
