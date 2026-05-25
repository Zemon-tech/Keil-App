# Bugs & Issues Tracker

## Open Issues — ADK Agent (Backend)

### 4. InMemorySessionService — No Persistence
- **Location**: `backend/src/services/adk.service.ts`
- **Problem**: All ADK chat sessions are stored in server memory. Lost on restart/deploy. Cannot scale horizontally.
- **Impact**: High — conversations disappear on every deploy.
- **Recommended Fix**: Replace with a persistent session store (Redis or Postgres-backed).

### 5. No Rate Limiting on AI Endpoints
- **Location**: `backend/src/routes/ai.routes.ts`, `backend/src/routes/adk.routes.ts`
- **Problem**: No per-user rate limiting. Users can spam endpoints, burning API credits and DB connections.
- **Impact**: Medium — cost and availability risk.
- **Recommended Fix**: Add per-user rate limiting middleware (e.g., 20 requests/min).

### 6. No Timeout on ADK Agent Execution
- **Location**: `backend/src/services/adk.service.ts` → `runAdkAgent()`
- **Problem**: If Gemini hangs or enters a tool-call loop, the HTTP request blocks indefinitely.
- **Impact**: Medium — can exhaust server connections.
- **Recommended Fix**: Wrap `collectFinalText()` in a timeout (e.g., 30s max), return a graceful error.

### 7. No Error Boundaries in Tool Execution
- **Location**: `backend/src/services/adk.service.ts` — all `FunctionTool.execute` handlers
- **Problem**: If a DB query fails inside a tool, the error propagates up and crashes the request. The agent doesn't get a graceful "tool failed" response.
- **Impact**: Medium — one bad query kills the entire conversation turn.
- **Recommended Fix**: Wrap each tool's execute in try/catch, return `{ error: "description" }` so the agent can inform the user gracefully.

### 8. Raw SQL in Tools Instead of Reusing Services
- **Location**: `backend/src/services/adk.service.ts`
- **Problem**: 4 out of 5 tools write raw SQL instead of using the existing service/repository layer (`org-task.service.ts`, `personal-task.service.ts`). Duplicated logic, risk of drift.
- **Impact**: Low (maintenance) — works but harder to keep in sync.
- **Recommended Fix**: Refactor tools to call existing service methods.

### 9. No Audit Logging for AI-Created Entities
- **Location**: `backend/src/services/adk.service.ts` → `create_personal_task` tool
- **Problem**: Tasks created by the AI agent have no record that they were AI-initiated. No way to distinguish AI-created vs user-created tasks.
- **Impact**: Low — traceability concern.
- **Recommended Fix**: Add a `source` or `created_by_agent` flag to task records.

### 10. No Cost/Usage Tracking
- **Location**: `backend/src/services/ai.service.ts`, `backend/src/services/adk.service.ts`
- **Problem**: No logging of token usage per user for either OpenRouter or Gemini calls.
- **Impact**: Low — billing blind spot.
- **Recommended Fix**: Log `usage` data from API responses, aggregate per user.

### 11. ADK Agent Not Wired to Frontend
- **Location**: Frontend (`Dashboard.tsx`, `AiAssistant.tsx`) only calls `/api/v1/ai/chat`
- **Problem**: The ADK agent (`/api/v1/adk/chat`) with database tools exists but no frontend component uses it. Dead code from the user's perspective.
- **Impact**: Low — feature not exposed.
- **Recommended Fix**: Either wire the Dashboard to use ADK for task-related queries, or implement a router that dispatches to simple AI vs ADK based on intent.

### 12. Chat Conversations Not Persisted
- **Location**: Frontend (`Dashboard.tsx`, `AiAssistant.tsx`) — `useState` only
- **Problem**: All chat history is lost on page refresh or navigation. No localStorage, no DB persistence.
- **Impact**: Medium — poor UX for returning users.
- **Recommended Fix**: Persist conversations to a `chat_sessions` / `chat_messages` table, or at minimum localStorage for the current session.

---

## Priority Summary

| Priority | Issues |
|----------|--------|
| **High** | #4 (session persistence) |
| **Medium** | #5 (rate limiting), #6 (timeout), #7 (error boundaries), #12 (chat persistence) |
| **Low** | #8 (raw SQL), #9 (audit logging), #10 (cost tracking), #11 (ADK not wired) |
