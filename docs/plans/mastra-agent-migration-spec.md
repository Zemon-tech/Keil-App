# Mastra AI Agent Migration — Developer Spec

## Overview

Replace the current dual AI system (Vercel AI SDK simple chat + Google ADK agent) with a unified **Mastra** agent framework. Mastra is built on top of Vercel AI SDK, giving us multi-agent orchestration, persistent memory, streaming, and provider-agnostic model routing — all in TypeScript.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (React)                         │
│  Dashboard.tsx / AiAssistant.tsx → useChat() or fetch       │
│  (Vercel AI SDK ai/react kept for streaming UI)             │
└──────────────────────────┬──────────────────────────────────┘
                           │ POST /api/v1/ai/chat (streaming)
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                  Backend (Express + Mastra)                  │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │          Supervisor Agent — "keilhq-ai"               │  │
│  │                                                       │  │
│  │  • Handles general conversation DIRECTLY              │  │
│  │  • Delegates to specialists only when tools needed    │  │
│  └───────────────┬──────────────┬──────────────┬────────┘  │
│                  │              │              │             │
│                  ▼              ▼              ▼             │
│          ┌──────────┐   ┌──────────┐   ┌────────┐          │
│          │  Task    │   │  Chat    │   │ Motion │          │
│          │  Agent   │   │  Agent   │   │ Agent  │          │
│          │          │   │          │   │        │          │
│          │ 10 tools │   │ 3 tools  │   │2 tools │          │
│          └──────────┘   └──────────┘   └────────┘          │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Existing Service Layer (reused, not duplicated)      │  │
│  │  personal-task.service / org-task.service /           │  │
│  │  org-chat.service / motion-page.service              │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

**Key design decision**: The supervisor handles general chat directly (writing help, questions, brainstorming, analysis) without delegating. It only routes to specialist agents when the user needs tool-based operations (task CRUD, message checking, page search). This avoids an unnecessary extra agent and reduces LLM round-trips for simple conversations.

---

## Dependencies

### Install
```bash
npm install @mastra/core @ai-sdk/google @ai-sdk/openai-compatible
```

### Remove
```bash
npm uninstall @google/adk @google/genai
```

### Keep
- `ai` (Vercel AI SDK — Mastra uses it internally)
- `@ai-sdk/openai-compatible` (for OpenRouter)

---

## Environment Variables

```env
# Keep existing
OPENROUTER_API_KEY=...
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
OPENROUTER_MODEL=anthropic/claude-sonnet-4

# Add (optional — for Google Gemini as alternative provider)
GOOGLE_GENERATIVE_AI_API_KEY=...

# Remove
# GOOGLE_ADK_API_KEY (no longer needed)
# GOOGLE_ADK_MODEL (no longer needed)
```

---

## Agent Definitions

### 1. Supervisor Agent — `keilhq-ai`

**Purpose**: The primary agent users interact with. Handles general conversation directly and delegates to specialist agents only when tool-based operations are needed.

**Instructions**:
> You are KeilHQ AI, a concise and helpful work assistant inside a productivity app.
> 
> **Direct handling** (no delegation):
> - General questions, writing help, brainstorming, analysis, planning
> - Explaining concepts, summarizing text, drafting emails
> - Any conversation that doesn't require accessing the user's data
>
> **Delegate to specialists** only when the user needs:
> - Task operations (view, create, edit, delete, schedule, assign tasks) → Task Agent
> - Chat/messaging operations (check messages, unread, channels) → Chat Agent
> - Notes/pages operations (search, find motion pages) → Motion Agent
>
> Keep responses clear, actionable, and professional. Be concise unless the user asks for detail.

---

### 2. Task Agent — `keilhq-task-agent`

**Purpose**: Handles all personal and org task operations with RBAC enforcement.

**Instructions**:
> You are the KeilHQ Task Agent. You help users manage their personal tasks and organisation tasks.
> Always call tools to get real data — never fabricate task details.
> When creating or modifying tasks, confirm the action back to the user.
> For org tasks, respect the user's space role. Members can only modify tasks assigned to them.
> Format task lists clearly with title, status, priority, and due date.

**Tools** (10):

| # | Tool Name | Description | Parameters | Service Method |
|---|-----------|-------------|------------|----------------|
| 1 | `get_personal_tasks` | List user's personal tasks | `status?`, `priority?`, `limit?` (default 10) | `personalTaskService.getPersonalTasks(userId, options)` |
| 2 | `get_personal_task` | Get a single personal task by ID | `taskId` | `personalTaskService.getPersonalTaskById(taskId, userId)` |
| 3 | `create_personal_task` | Create a new personal task | `title`, `description?`, `priority?`, `status?`, `start_date?`, `due_date?` | `personalTaskService.createPersonalTask(input)` |
| 4 | `update_personal_task` | Update an existing personal task | `taskId`, `title?`, `description?`, `priority?`, `status?`, `start_date?`, `due_date?` | `personalTaskService.updatePersonalTask(taskId, userId, input)` |
| 5 | `delete_personal_task` | Delete a personal task | `taskId` | `personalTaskService.deletePersonalTask(taskId, userId)` |
| 6 | `get_org_tasks` | List tasks in user's org/space | `orgId`, `spaceId`, `status?`, `priority?`, `assigneeId?`, `limit?` | `orgTaskService.getTasksBySpace(orgId, spaceId, options)` |
| 7 | `get_org_task` | Get a single org task with details | `taskId` | `orgTaskService.getTaskById(taskId)` |
| 8 | `create_org_task` | Create a task in org/space | `orgId`, `spaceId`, `title`, `description?`, `priority?`, `status?`, `type?`, `start_date?`, `due_date?`, `assignee_ids?` | `orgTaskService.createTask(context, input)` |
| 9 | `update_org_task` | Update an org task | `taskId`, `orgId`, `spaceId`, `title?`, `description?`, `priority?`, `status?`, `start_date?`, `due_date?` | `orgTaskService.updateTask(context, taskId, userId, input)` |
| 10 | `delete_org_task` | Delete an org task | `taskId`, `orgId`, `spaceId` | `orgTaskService.deleteTask(context, taskId, userId)` |

**RBAC Rules** (enforced inside tool execute functions):
- Personal tasks: Only the owner can CRUD
- Org tasks (admin/manager): Full CRUD on all tasks in the space
- Org tasks (member): Can view all, but can only edit/delete tasks assigned to them

**Context Required**: `userId`, `userOrgRole`, `userSpaceRole` (passed via tool context)

---

### 3. Chat Agent — `keilhq-chat-agent`

**Purpose**: Checks for new messages and provides channel information.

**Instructions**:
> You are the KeilHQ Chat Agent. You help users check their messages and channels.
> When reporting unread messages, be concise: show channel name, sender, and a preview.
> You cannot send messages on behalf of the user — only read/check status.

**Tools** (3):

| # | Tool Name | Description | Parameters | Service Method |
|---|-----------|-------------|------------|----------------|
| 1 | `get_user_channels` | List all channels the user is in (with unread counts) | `orgId`, `spaceId` | `orgChatService.getUserChannels(userId, orgId, spaceId)` |
| 2 | `get_channel_messages` | Get recent messages from a channel | `channelId`, `limit?` (default 20) | `orgChatService.getChannelMessages(channelId, limit)` |
| 3 | `check_unread_messages` | Check if user has unread messages across all channels | `orgId`, `spaceId` | Custom query: channels with `last_message_at > last_read_at` |

**RBAC Rules**:
- User can only access channels they are a member of (validated via `channel_members` table)

---

### 4. Motion Agent — `keilhq-motion-agent`

**Purpose**: Searches and retrieves Motion pages (notes/docs).

**Instructions**:
> You are the KeilHQ Motion Agent. You help users find their notes and documents.
> Search by title keywords. Return page title, a brief content preview, and when it was last updated.
> You cannot create or edit pages — only search and retrieve.

**Tools** (2):

| # | Tool Name | Description | Parameters | Service Method |
|---|-----------|-------------|------------|----------------|
| 1 | `search_motion_pages` | Search pages by title keyword | `orgId`, `spaceId`, `query` (title search string) | Custom query: `SELECT id, title, updated_at FROM motion_pages WHERE org_id = $1 AND space_id = $2 AND title ILIKE '%' || $3 || '%' AND deleted_at IS NULL ORDER BY updated_at DESC LIMIT 10` |
| 2 | `get_motion_page` | Get a specific page's content | `pageId`, `orgId`, `spaceId` | `motionPageService.getPageById(orgId, spaceId, pageId)` |

**RBAC Rules**:
- User must be a member of the space to search/view pages

---

---

## File Structure

```
backend/src/
├── agents/
│   ├── index.ts              # Mastra instance + supervisor agent setup
│   ├── task.agent.ts         # Task agent + tools
│   ├── chat.agent.ts         # Chat agent + tools
│   ├── motion.agent.ts       # Motion agent + tools
├── routes/
│   └── ai.routes.ts          # Updated: single /chat endpoint using Mastra
├── controllers/
│   └── ai.controller.ts      # Updated: calls Mastra supervisor
└── services/
    └── ai.service.ts         # REMOVE (replaced by Mastra agents)
    └── adk.service.ts        # REMOVE (replaced by Mastra agents)
```

---

## API Contract

### `POST /api/v1/ai/chat`

**Request**:
```json
{
  "messages": [
    { "role": "user", "content": "What are my urgent tasks?" }
  ],
  "orgId": "uuid",       // current active org
  "spaceId": "uuid",     // current active space
  "stream": true         // optional, default false
}
```

**Response (non-streaming)**:
```json
{
  "success": true,
  "data": {
    "content": "You have 3 urgent tasks: ...",
    "model": "anthropic/claude-sonnet-4"
  }
}
```

**Response (streaming)**: Server-Sent Events (SSE) compatible with Vercel AI SDK's `useChat()` hook.

---

## RBAC Enforcement Strategy

Tools do NOT trust the LLM to enforce permissions. Each tool's `execute` function:

1. Receives `userId` from the authenticated request (not from the LLM)
2. Queries the user's role in the relevant org/space
3. Validates permissions before executing the operation
4. Returns an error message to the agent if denied (agent relays to user)

```typescript
execute: async ({ taskId, orgId, spaceId }, { userId }) => {
  // 1. Check user's space role
  const member = await pool.query(
    'SELECT role FROM space_members WHERE org_id=$1 AND space_id=$2 AND user_id=$3',
    [orgId, spaceId, userId]
  );
  if (!member.rows[0]) return { error: "You don't have access to this space." };
  
  const role = member.rows[0].role;
  
  // 2. For members, check assignment
  if (role === 'member') {
    const isAssigned = await taskAssigneeRepository.isAssigned(taskId, userId);
    if (!isAssigned) return { error: "You can only modify tasks assigned to you." };
  }
  
  // 3. Execute operation
  return await orgTaskService.deleteTask({ orgId, spaceId }, taskId, userId);
}
```

---

## Streaming Implementation

Mastra inherits Vercel AI SDK's streaming. The controller:

```typescript
import { supervisor } from "../agents";

export const chat = catchAsync(async (req, res) => {
  const { messages, orgId, spaceId, stream } = req.body;
  const userId = req.user.id;

  if (stream) {
    const result = await supervisor.stream(messages, {
      context: { userId, orgId, spaceId }
    });
    // Pipe SSE stream to response
    result.pipeDataStreamToResponse(res);
  } else {
    const result = await supervisor.generate(messages, {
      context: { userId, orgId, spaceId }
    });
    res.json({ success: true, data: { content: result.text } });
  }
});
```

---

## Migration Steps

### Phase 1: Setup (Day 1)
1. Install Mastra dependencies
2. Create `backend/src/agents/` directory structure
3. Define the supervisor agent (handles general chat + delegates to specialists)
4. Wire up the new `/ai/chat` endpoint to use Mastra
5. Verify basic conversation works (supervisor answers directly, no tools yet)

### Phase 2: Task Agent (Day 2-3)
1. Implement all 10 task tools using existing service layer
2. Add RBAC validation inside each tool
3. Test: personal task CRUD, org task CRUD, permission denials
4. Wire task agent into supervisor

### Phase 3: Chat + Motion Agents (Day 4)
1. Implement 3 chat tools
2. Implement 2 motion tools
3. Wire into supervisor
4. Test: unread message checks, page search

### Phase 4: Streaming + Frontend (Day 5)
1. Enable streaming in the controller
2. Update frontend `Dashboard.tsx` to use `useChat()` or streaming fetch
3. Update `AiAssistant.tsx` to use the same endpoint
4. Remove old `/api/v1/adk/chat` route

### Phase 5: Cleanup (Day 6)
1. Remove `adk.service.ts`, `adk.controller.ts`, `adk.routes.ts`
2. Remove old `ai.service.ts` (simple chat)
3. Remove `@google/adk` and `@google/genai` from package.json
4. Update environment variable documentation
5. Test end-to-end

---

## Future Enhancements (Post-MVP)

| Feature | Description |
|---------|-------------|
| **RAG Knowledge Base** | Add vector store + embeddings to the supervisor agent for company docs |
| **Persistent Memory** | Use Mastra's memory system to remember user preferences across sessions |
| **Chat Persistence** | Save conversations to DB for history/recall |
| **Task Creation from Chat** | Agent proactively suggests creating tasks from conversation context |
| **Multi-model routing** | Use cheaper models for simple queries, powerful models for complex reasoning |
| **Rate Limiting** | Per-user rate limiting on the AI endpoint |
| **Usage Tracking** | Log token usage per user for cost monitoring |
| **Audit Logging** | Flag AI-created entities with `source: 'ai_agent'` |

---

## Success Criteria

- [ ] Single `/api/v1/ai/chat` endpoint handles all AI interactions
- [ ] Streaming responses work token-by-token in the frontend
- [ ] Personal task CRUD works via natural language
- [ ] Org task CRUD respects RBAC (admin/manager/member)
- [ ] Unread message checking works
- [ ] Motion page search by title works
- [ ] General conversation works without tools
- [ ] Google ADK dependencies fully removed
- [ ] No regression in existing non-AI features
