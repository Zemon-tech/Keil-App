# Mastra Agent Architecture Refactor Plan

## 1. Context

### Current State

KeilHQ's backend (`backend/`) has two separate AI systems:

1. **Mastra Agents** (`src/agents/`) — A supervisor agent that delegates to task, chat, and motion sub-agents via manual tool wrappers. Uses `@mastra/core@1.36.0` and `@mastra/ai-sdk@1.4.3`. Exposed at `POST /api/v1/ai/chat`.
2. **Google ADK Agent** (`src/services/adk.service.ts`) — A standalone `@google/adk` agent with Gemini, using `InMemorySessionService`. Exposed at `POST /api/v1/adk/chat`.

The frontend (`frontend/src/components/AiAssistant.tsx`) uses a non-streaming `POST` call to the Mastra endpoint and renders responses synchronously.

### Problems

- **Outdated delegation pattern**: The supervisor uses manual `createTool` wrappers to delegate, losing conversation context (only a single `query` string is forwarded). Mastra v1.8+ has a native `agents` property for supervisor delegation.
- **No memory**: Conversations are stateless — no persistence across requests.
- **Duplicate AI systems**: Google ADK and Mastra serve overlapping purposes.
- **No streaming on frontend**: The UI waits for the full response before rendering.
- **Missing error handling**: Delegation tools don't catch sub-agent failures.
- **No `maxSteps`**: Default of 5 may be too low for multi-agent delegation.
- **Non-standard file structure**: Agents live in `src/agents/` instead of the Mastra-recommended `src/mastra/` layout.
- **Outdated packages**: `@mastra/core` and `@mastra/ai-sdk` are behind latest.

### Goals

- Consolidate to a single AI system (Mastra) with model selection (Gemini, OpenRouter, Local).
- Implement proper multi-agent delegation using Mastra's native `agents` property.
- Add conversation memory with thread persistence (resource-scoped working memory).
- Migrate frontend to AI SDK `useChat()` with real-time streaming.
- Use `@mastra/express` adapter for auto-registered agent endpoints.
- Follow Mastra's recommended project structure.
- Provide thread management UI (list, resume, delete conversations).

---

## 2. Decisions

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | Remove `@google/adk` and `@google/genai` entirely | Consolidate to one AI framework; Gemini accessible via `@ai-sdk/google` |
| 2 | Default model: `gemini-3.5-flash` via `@ai-sdk/google` | Latest Flash model, optimized for agentic workloads |
| 3 | Model selector: gemini / openrouter / local | Frontend sends `modelSelection`; backend resolves model dynamically |
| 4 | Use `@mastra/express` adapter | Auto-registers `/api/agents/{id}/stream` and `/api/agents/{id}/generate` |
| 5 | Frontend uses AI SDK `useChat()` with streaming | Real-time token streaming, proper SSE protocol |
| 6 | Move to `src/mastra/` folder structure | Follows Mastra convention; separates tools from agents |
| 7 | Memory stored in Supabase Postgres, schema `mastra` | Separate schema for isolation; reuse existing `pg.Pool` |
| 8 | Resource-scoped working memory | Agent remembers user preferences across all threads |
| 9 | Thread management endpoints | `GET /api/v1/ai/threads`, `DELETE /api/v1/ai/threads/:threadId` |
| 10 | Reuse `GOOGLE_ADK_API_KEY` as `GOOGLE_GENERATIVE_AI_API_KEY` | Same API key, just renamed for clarity |

---

## 3. Constraints

- **No breaking changes to non-AI features**: All existing routes (`/api/v1/personal/*`, `/api/v1/orgs/*`, chat, meetings, etc.) must remain untouched.
- **Supabase free tier**: Custom schemas are fully supported; 500 MB DB limit applies (Mastra tables are lightweight).
- **CommonJS project**: `backend/package.json` has `"type": "commonjs"`. All new packages must support CJS (verified: `@mastra/pg`, `@mastra/memory`, `@mastra/express` all ship CJS builds).
- **Node.js ≥ 22.13.0**: Required by `@mastra/ai-sdk` (already satisfied in deployment).
- **Frontend contract change**: The AI chat endpoint URL changes. Frontend must be updated in the same release.
- **Env var rename**: `GOOGLE_ADK_API_KEY` → `GOOGLE_GENERATIVE_AI_API_KEY` must be updated in deployment environment.

---

## 4. Phase-wise Implementation Plan

### Phase 1: Package Updates & Dependency Management

**Scope**: Update/install packages, remove deprecated ones.

**Actions**:
1. Install new packages:
   ```
   @mastra/core@latest
   @mastra/ai-sdk@latest
   @mastra/memory@latest
   @mastra/pg@latest
   @mastra/express@latest
   @ai-sdk/google@latest
   ```
2. Remove packages:
   ```
   @google/adk
   @google/genai
   ```
3. Keep unchanged:
   ```
   @ai-sdk/openai-compatible (OpenRouter + local LLM)
   ai (Vercel AI SDK core)
   zod
   ```

**Acceptance Criteria**:
- [ ] `npm install` succeeds without errors
- [ ] `npm run build` (TypeScript compilation) succeeds
- [ ] No runtime import errors on server start

---

### Phase 2: Backend File Structure Reorganization

**Scope**: Create new `src/mastra/` directory structure, move and refactor files.

**New structure**:
```
backend/src/
├── mastra/
│   ├── index.ts              ← Mastra instance (storage, agents, memory)
│   ├── models.ts             ← Model factory (gemini, openrouter, local)
│   ├── agents/
│   │   ├── supervisor.ts     ← Supervisor agent (native `agents` property)
│   │   ├── task.agent.ts     ← Task sub-agent with `description`
│   │   ├── chat.agent.ts     ← Chat sub-agent with `description`
│   │   └── motion.agent.ts   ← Motion sub-agent with `description`
│   └── tools/
│       ├── task.tools.ts     ← All task tools (personal + org CRUD)
│       ├── chat.tools.ts     ← All chat/messaging tools
│       └── motion.tools.ts   ← All notes/pages tools
├── controllers/
│   └── ai.controller.ts      ← Thread management only (list, delete)
├── routes/
│   └── ai.routes.ts          ← Thread CRUD routes
└── app.ts                    ← MastraServer integration added
```

**Deleted files**:
- `src/agents/` (entire old folder)
- `src/controllers/adk.controller.ts`
- `src/routes/adk.routes.ts`
- `src/services/adk.service.ts`

**Actions**:
1. Create `src/mastra/` directory with subdirectories
2. Extract tools from agent files into dedicated tool files
3. Create model factory in `src/mastra/models.ts`
4. Create supervisor using native `agents` property
5. Create Mastra instance in `src/mastra/index.ts`
6. Delete old agent files and ADK files
7. Remove ADK route from `src/routes/v1.routes.ts`
8. Update all internal imports

**Acceptance Criteria**:
- [ ] `npm run build` succeeds with new structure
- [ ] Old `src/agents/` directory is removed
- [ ] All ADK-related files are removed
- [ ] No dangling imports referencing deleted files

---

### Phase 3: Model Factory Implementation

**Scope**: Create a dynamic model resolver that picks the right provider based on request context.

**File**: `src/mastra/models.ts`

**Behavior**:
| `modelSelection` value | Provider | Model |
|------------------------|----------|-------|
| `"gemini"` (default) | `@ai-sdk/google` | `gemini-3.5-flash` |
| `"openrouter"` | `@ai-sdk/openai-compatible` | `env.OPENROUTER_MODEL` |
| `"local"` | `@ai-sdk/openai-compatible` | User-provided URL + model name |

**Actions**:
1. Create `createGeminiModel()` using `@ai-sdk/google` with `GOOGLE_GENERATIVE_AI_API_KEY`
2. Create `createOpenRouterModel()` using `@ai-sdk/openai-compatible`
3. Create `createLocalModel(baseUrl, modelName)` using `@ai-sdk/openai-compatible`
4. Export `resolveModel(requestContext)` that reads `modelSelection` from context and returns the appropriate model
5. Update `src/config/index.ts`: remove `googleAdkApiKey`, `googleAdkModel`; add `googleGenAiApiKey`

**Acceptance Criteria**:
- [ ] `resolveModel` returns a valid model for each selection value
- [ ] Gemini model works with the existing API key
- [ ] OpenRouter model works as before
- [ ] Local model works with custom URL/model name
- [ ] Missing API key throws a clear error (not a silent failure)

---

### Phase 4: Supervisor Agent Refactor (Native Delegation)

**Scope**: Rewrite the supervisor to use Mastra's native `agents` property instead of manual tool wrappers.

**File**: `src/mastra/agents/supervisor.ts`

**Key changes**:
1. Add `description` field to each sub-agent:
   - `taskAgent`: "Manages personal and organisation tasks: list, view, create, update, delete, filter by status/priority/assignee."
   - `chatAgent`: "Handles messaging operations: list channels, check unread messages, read channel messages."
   - `motionAgent`: "Manages notes and pages: search by keyword, retrieve page content."
2. Supervisor uses `agents: { taskAgent, chatAgent, motionAgent }` (no manual delegation tools)
3. Model resolved dynamically: `model: ({ requestContext }) => resolveModel(requestContext)`
4. Add `maxSteps: 10` in `defaultOptions`
5. Add delegation error handling via `delegation.onDelegationComplete`
6. Keep the same `instructions` content (system prompt)

**Acceptance Criteria**:
- [ ] Supervisor correctly delegates to task agent when asked about tasks
- [ ] Supervisor correctly delegates to chat agent when asked about messages
- [ ] Supervisor correctly delegates to motion agent when asked about notes
- [ ] Full conversation context is forwarded to sub-agents (not just a query string)
- [ ] Sub-agent failures don't crash the supervisor (graceful error in response)
- [ ] `maxSteps: 10` allows multi-step tool usage within sub-agents

---

### Phase 5: Memory Integration

**Scope**: Add conversation persistence with PostgreSQL storage and working memory.

**Storage setup**:
- Use `@mastra/pg` `PostgresStore` with `pool` (reuse existing `pg.Pool` from `src/config/pg.ts`)
- Schema: `mastra` (separate from `public`)
- Tables auto-created by Mastra on first init: `mastra_threads`, `mastra_messages`, `mastra_resources`, etc.

**Memory configuration**:
```typescript
new Memory({
  options: {
    lastMessages: 20,
    workingMemory: {
      enabled: true,
      scope: 'resource',
      template: `# User Profile
- Name:
- Role:
- Preferences:
- Current Focus:
`
    },
    generateTitle: true,
  },
})
```

**Actions**:
1. Create `PostgresStore` instance in `src/mastra/index.ts` using existing pool
2. Create `Memory` instance with working memory enabled
3. Attach memory to supervisor agent
4. Ensure `stream()` and `generate()` calls pass `memory: { thread, resource }` from request context
5. Run `CREATE SCHEMA IF NOT EXISTS mastra;` migration (or let PostgresStore auto-create)

**Acceptance Criteria**:
- [ ] First message creates a thread in `mastra.mastra_threads`
- [ ] Subsequent messages on same thread load history from DB
- [ ] Agent can recall information from earlier in the conversation
- [ ] Working memory persists user facts across different threads (same resource)
- [ ] Thread titles are auto-generated from first message
- [ ] `mastra` schema exists in Supabase with expected tables

---

### Phase 6: Express Integration with `@mastra/express`

**Scope**: Mount `MastraServer` on the existing Express app to auto-register agent endpoints.

**File**: `src/app.ts`

**Actions**:
1. Import `MastraServer` from `@mastra/express`
2. Import `mastra` instance from `src/mastra/index.ts`
3. Initialize: `const server = new MastraServer({ app, mastra, prefix: '/api' })`
4. Call `await server.init()` after existing middleware but before error handler
5. This auto-registers:
   - `POST /api/agents/keilhq-ai/stream`
   - `POST /api/agents/keilhq-ai/generate`
   - (and similar for sub-agents, though frontend only uses supervisor)

**Custom thread management routes** (keep in `ai.routes.ts`):
- `GET /api/v1/ai/threads` — list threads for authenticated user (resource = userId)
- `DELETE /api/v1/ai/threads/:threadId` — delete a thread and its messages

**Actions for thread controller** (`ai.controller.ts`):
1. Rewrite to only handle thread CRUD (remove old chat logic)
2. Use `mastra.getAgent('keilhq-ai').getMemory()` to access memory API
3. `listThreads`: query by `resourceId = userId`, paginated
4. `deleteThread`: delete thread + messages by threadId (verify ownership)

**Acceptance Criteria**:
- [ ] `POST /api/agents/keilhq-ai/stream` returns SSE stream with AI SDK protocol
- [ ] `POST /api/agents/keilhq-ai/generate` returns JSON response
- [ ] `GET /api/v1/ai/threads` returns paginated thread list for authenticated user
- [ ] `DELETE /api/v1/ai/threads/:threadId` removes thread and messages
- [ ] Existing routes (`/api/v1/personal/*`, `/api/v1/orgs/*`, etc.) still work
- [ ] Auth middleware protects all AI endpoints

---

### Phase 7: Frontend Migration

**Scope**: Migrate `AiAssistant.tsx` from non-streaming POST to AI SDK `useChat()` with streaming.

**Actions**:
1. Install frontend packages (if not already): `@ai-sdk/react`, `ai`
2. Replace `api.post("v1/ai/chat")` with `useChat()` hook:
   ```typescript
   const { messages, sendMessage, status } = useChat({
     transport: new DefaultChatTransport({
       api: `${API_BASE_URL}/api/agents/keilhq-ai/stream`,
       prepareSendMessagesRequest: ({ messages }) => ({
         body: {
           messages: [messages[messages.length - 1]], // only new message
           memory: { thread: threadId, resource: userId },
           modelSelection,
           ...(modelSelection === 'local' && { localAiBaseUrl, localAiModel }),
         },
       }),
     }),
   })
   ```
3. Add thread management:
   - Thread list sidebar/dropdown showing past conversations
   - "New Chat" creates a new threadId (UUID)
   - Clicking a past thread resumes it (sets threadId, loads messages)
   - Delete thread button
4. Add model selector dropdown (gemini / openrouter / local)
5. Remove old `requestAiReply` function and `AiChatResponse` type
6. Stream tokens render in real-time (no more "typing dots" waiting for full response)

**Acceptance Criteria**:
- [ ] Messages stream token-by-token in the UI
- [ ] Conversation persists across page reloads (same thread)
- [ ] Thread list shows past conversations with auto-generated titles
- [ ] Switching threads loads the correct conversation history
- [ ] "New Chat" starts a fresh thread
- [ ] Delete thread removes it from list and backend
- [ ] Model selector switches between gemini/openrouter/local
- [ ] Error states display gracefully (network error, API key missing, etc.)

---

### Phase 8: Cleanup & Environment Variables

**Scope**: Remove dead code, update env vars, update deployment config.

**Actions**:
1. Remove from `src/config/index.ts`:
   - `googleAdkApiKey`
   - `googleAdkModel`
2. Add to `src/config/index.ts`:
   - `googleGenAiApiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY || ""`
3. Update `.env` / `.env.example`:
   - Remove: `GOOGLE_ADK_API_KEY`, `GOOGLE_ADK_MODEL`
   - Add: `GOOGLE_GENERATIVE_AI_API_KEY`
4. Update deployment environment (Sevalla/GitHub Actions):
   - Rename env var in deployment config
5. Remove old `/api/v1/ai/chat` route (replaced by Mastra auto-route)
6. Remove old `/api/v1/adk/chat` route
7. Remove `scratch/test-sarvam-batch.ts` and other ADK scratch files if desired
8. Update `backend-deploy.yml` if it references ADK env vars

**Acceptance Criteria**:
- [ ] No references to `@google/adk` or `@google/genai` in codebase
- [ ] No references to old `/api/v1/adk/*` routes
- [ ] `.env.example` reflects new env var names
- [ ] Deployment succeeds with renamed env vars
- [ ] `npm run build` produces zero TypeScript errors

---

## 5. API Contract (Before → After)

| Before | After | Notes |
|--------|-------|-------|
| `POST /api/v1/ai/chat` | `POST /api/agents/keilhq-ai/stream` | AI SDK UI Message Stream Protocol |
| `POST /api/v1/adk/chat` | **REMOVED** | Consolidated into Mastra |
| — | `POST /api/agents/keilhq-ai/generate` | Non-streaming alternative |
| — | `GET /api/v1/ai/threads` | List user's conversation threads |
| — | `DELETE /api/v1/ai/threads/:threadId` | Delete a conversation |

### Request format for streaming endpoint:

```json
{
  "messages": [{ "id": "...", "role": "user", "parts": [{ "type": "text", "text": "..." }] }],
  "memory": { "thread": "thread-uuid", "resource": "user-uuid" },
  "modelSelection": "gemini",
  "localAiBaseUrl": "http://localhost:8080/v1",
  "localAiModel": "local-model"
}
```

### Response: Server-Sent Events (AI SDK UI Message Stream Protocol)

```
data: {"type":"start","messageId":"..."}
data: {"type":"text-delta","textDelta":"Hello"}
data: {"type":"text-delta","textDelta":" world"}
data: {"type":"finish","finishReason":"stop","usage":{...}}
data: [DONE]
```

---

## 6. Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Frontend/backend deployed out of sync | Deploy backend first with both old and new endpoints active; then deploy frontend; then remove old endpoints |
| Memory tables not created | `PostgresStore` auto-initializes on first interaction; add health check |
| Supabase connection pool exhaustion | Reuse existing pool (no new connections); `PostgresStore` accepts `pool` option |
| Model API key missing at runtime | `resolveModel()` throws descriptive `ApiError(500, "...")` if key is empty |
| Sub-agent tool failures | `delegation.onDelegationComplete` catches errors and returns feedback to supervisor |
| Large conversation history exceeds context | `lastMessages: 20` caps history; working memory summarizes key facts |
| CJS/ESM interop issues | All Mastra packages ship CJS builds; verified in `package.json` exports |

---

## 7. Testing Checklist

- [ ] Supervisor delegates to task agent for "show my tasks"
- [ ] Supervisor delegates to chat agent for "any unread messages?"
- [ ] Supervisor delegates to motion agent for "find my notes about X"
- [ ] Streaming works end-to-end (backend → frontend renders tokens)
- [ ] Thread created on first message, reused on subsequent messages
- [ ] Thread list returns correct threads for authenticated user
- [ ] Working memory persists user name across threads
- [ ] Model selector switches between gemini/openrouter/local
- [ ] Local LLM works with custom URL
- [ ] Error response when API key is missing
- [ ] Existing non-AI routes unaffected (tasks, chat, orgs, meetings)
- [ ] Build succeeds (`npm run build`)
- [ ] No TypeScript errors
- [ ] Deployment pipeline succeeds
