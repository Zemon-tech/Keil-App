# Live Chat

Real-time direct messaging and group channels within an organisation space. Supports 1-on-1 DMs, group channels, typing indicators, unread counts, and live push via WebSockets.

## Table of Contents

- [Architecture](./architecture.md)
- [Frontend Guide](./frontend.md)
- [Backend Guide](./backend.md)
- [Environment Variables](./environment.md)

## Quick Start

### Prerequisites
- PostgreSQL database with migrations 004, 005, and 010 applied
- Backend server running (port 5001)
- Frontend dev server running (port 5173)

### Test the Feature
1. Open the app and navigate to an org space.
2. Click the chat button in the bottom-right or use the command palette to open chat.
3. Click **+** to start a new DM or group channel.
4. Select a space member to open a DM.
5. Type a message and press Enter — it appears instantly for all channel members.

## Tech Stack

| Layer | Technology | Role |
|-------|-----------|------|
| Backend framework | Express v5 + Node.js | HTTP server, REST API |
| Database | PostgreSQL (Supabase) | Channels, members, messages |
| Real-time | Socket.io v4 | Message push, typing indicators |
| Frontend framework | React 19 + Vite 7 | UI components |
| State (UI) | Zustand (`useChatStore`) | Drawer state, active channel, typing users |
| State (server cache) | TanStack React Query v5 | Channel/message caching, mutations |
| HTTP client | Axios | API calls with JWT interceptor |
