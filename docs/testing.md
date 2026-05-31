# Testing Framework & Architecture

This document describes the testing infrastructure for the Keil-App monorepo, covering both the backend (Express + Socket.io) and frontend (React + Zustand).

---

## Overview

| Layer | Tooling | Scope |
|-------|---------|-------|
| Backend API & Integration | Vitest + Supertest | Express routes, middleware, database queries |
| Backend Socket.io | Vitest + socket.io-client | Real-time messaging, auth, room management |
| Frontend State | Vitest | Zustand store logic |
| Frontend Components | Vitest + React Testing Library + happy-dom | UI rendering, user interactions |

---

## Backend Testing

### Prerequisites

- **Local PostgreSQL** running on `localhost:5432` (see [Docker setup guide](#setting-up-postgresql-with-docker) below)
- A database named `keil_test` (created automatically by the reset script)
- No Supabase CLI, no cloud services required

### Setting Up PostgreSQL with Docker

If you don't already have PostgreSQL running locally, the easiest way is Docker:

**1. Start a PostgreSQL container:**

```powershell
docker run -d ^
  --name keil-postgres ^
  -e POSTGRES_USER=postgres ^
  -e POSTGRES_PASSWORD=postgres ^
  -p 5432:5432 ^
  -v keil_pgdata:/var/lib/postgresql/data ^
  postgres:16
```

This creates a container named `keil-postgres` with:
- Username: `postgres`
- Password: `postgres`
- Port: `5432` (mapped to host)
- Persistent volume: `keil_pgdata` (data survives container restarts)

**2. Verify it's running:**

```powershell
docker ps
# Should show keil-postgres with status "Up"
```

**3. Create the test database:**

```powershell
cd backend
node scratch/reset-test-db.js
```

**Managing the container:**

```powershell
# Stop
docker stop keil-postgres

# Start again
docker start keil-postgres

# Remove completely (data preserved in volume)
docker rm keil-postgres

# Remove data volume too (full reset)
docker volume rm keil_pgdata
```

**Connecting manually (optional):**

```powershell
docker exec -it keil-postgres psql -U postgres -d keil_test
```

**Note:** If you already have PostgreSQL installed natively (not in Docker), that works too — just ensure it's accessible at `localhost:5432` with user `postgres` and password `postgres`. You can customize the connection by setting `TEST_DATABASE_URL` in `backend/.env`.

### Database Setup

The test database is a plain PostgreSQL instance that simulates Supabase's environment:

1. **`reset-test-db.js`** — Drops and recreates the `keil_test` database, pre-creates the `auth` schema and `auth.users` table
2. **`globalSetup.ts`** — Runs once before all tests: creates `auth.uid()` stub, runs all SQL migrations
3. **`setup.ts`** — Runs before each test file: truncates all tables for isolation

```
backend/
├── scratch/
│   └── reset-test-db.js          # One-time DB reset script
├── src/
│   ├── test/
│   │   ├── globalSetup.ts        # Vitest global setup (migrations)
│   │   ├── setup.ts              # Per-file setup (mocks, cleanup)
│   │   └── helpers.ts            # Seed functions (seedUser, seedOrg, etc.)
│   ├── __tests__/
│   │   └── socket.test.ts        # Socket.io integration tests
│   └── routes/
│       └── __tests__/
│           ├── health.routes.test.ts
│           └── org.routes.test.ts
└── vitest.config.ts
```

### How Auth Works in Tests

Production auth flow:
```
Client → Bearer token → supabaseAdmin.auth.getUser(token) → query public.users → req.user
```

Test auth flow (mocked):
```
Client → Bearer "mock-user-id-<uuid>" → mock returns { id: uuid } → query public.users → req.user
```

The `@supabase/supabase-js` module is mocked in `setup.ts`. The convention is:
- Token `"mock-user-id-<uuid>"` → Supabase mock extracts the UUID and returns it as the user ID
- The user must still exist in `public.users` (seeded via `seedUser()`)

### Supabase Compatibility Layer

Since we use plain PostgreSQL (not Supabase), the global setup creates stubs for Supabase-specific features:

| Feature | Stub |
|---------|------|
| `auth.users` table | Created with matching schema (id, email, raw_user_meta_data) |
| `auth.uid()` function | Returns `NULL::UUID` (RLS is bypassed since we connect as superuser) |
| RLS policies | Created but not enforced (superuser bypasses RLS) |

### Migration Runner

The `globalSetup.ts` migration runner handles PostgreSQL quirks:

- **Enum additions**: Migrations containing `ALTER TYPE ... ADD VALUE` are split into individual statements and run without a transaction (PostgreSQL requires new enum values to be committed before use)
- **Idempotent errors**: "already exists" errors are tolerated and the migration is marked as applied
- **Migration log**: `public._migrations_log` tracks which migrations have been applied

### External Service Mocks

All external services are mocked at the module level in `setup.ts`:

| Service | Mock Behavior |
|---------|---------------|
| `@supabase/supabase-js` | Returns user based on token convention |
| `@ai-sdk/google` | No-op |
| `@elevenlabs/elevenlabs-js` | No-op |
| `googleapis` | Returns empty calendar events |
| `@aws-sdk/client-s3` | No-op |

### Seed Helpers

Located in `src/test/helpers.ts`:

```typescript
seedUser(id, email, name)      // Creates auth.users + public.users rows
seedOrg(id, name, ownerUserId) // Creates org + adds owner as member
seedSpace(id, orgId, name, createdBy) // Creates space + adds creator as member
seedChannel(id, orgId, spaceId, name, createdBy) // Creates channel + adds creator
```

### Safety Shield

The `setup.ts` includes a safety check that blocks tests from running against remote databases:

```typescript
const isRemote = url.includes("supabase") || url.includes(".com") || url.includes(".co");
if (isRemote && !url.includes("localhost") && !url.includes("127.0.0.1")) {
    throw new Error("Safety Shield: Refusing to run tests against a remote database!");
}
```

---

## Frontend Testing

### Setup

```
frontend/
├── test/
│   └── setup.ts                  # RTL matchers, browser API polyfills
├── src/
│   └── store/
│       └── __tests__/
│           ├── useChatStore.test.ts
│           └── useMeetingStore.test.ts
└── vitest.config.ts
```

### Environment

- **happy-dom** — Fast browser simulation (no real browser needed)
- **@testing-library/jest-dom** — Custom matchers like `toBeInTheDocument()`
- **@testing-library/react** — Component rendering and interaction utilities

### Browser API Polyfills

`test/setup.ts` provides mocks for APIs not implemented in happy-dom:

- `ResizeObserver` — mocked with no-op observe/unobserve/disconnect
- `window.matchMedia` — returns `{ matches: false }` for all queries

### Testing Zustand Stores

Stores are tested directly using `getState()` and `setState()` without rendering components:

```typescript
import { useChatStore } from "../useChatStore";

beforeEach(() => {
    useChatStore.setState({ isChatOpen: false, activeChannelId: null });
});

it("should toggle chat", () => {
    useChatStore.getState().openChat();
    expect(useChatStore.getState().isChatOpen).toBe(true);
});
```

---

## Running Tests

### Backend

```powershell
# First time only: reset the test database
cd backend
node scratch/reset-test-db.js

# Run all tests (single execution)
npm run test

# Run in watch mode (re-runs on file changes)
npm run test:watch
```

### Frontend

```powershell
cd frontend

# Run all tests
npm run test

# Watch mode
npm run test:watch
```

---

## Configuration

### Backend `vitest.config.ts`

```typescript
export default defineConfig({
    test: {
        globals: true,
        environment: "node",
        globalSetup: ["./src/test/globalSetup.ts"],
        setupFiles: ["./src/test/setup.ts"],
        include: ["src/**/*.test.ts"],
        fileParallelism: false,  // Sequential to avoid port conflicts
        testTimeout: 15000,
    },
    resolve: {
        alias: { "@": path.resolve(__dirname, "./src") },
    },
});
```

### Frontend `vitest.config.ts`

```typescript
export default defineConfig({
    plugins: [react()],
    test: {
        globals: true,
        environment: "happy-dom",
        setupFiles: ["./test/setup.ts"],
        include: ["src/**/*.test.{ts,tsx}"],
    },
    resolve: {
        alias: { "@": path.resolve(__dirname, "./src") },
    },
});
```

---

## Environment Variables

The backend test setup reads from `.env` but overrides `DATABASE_URL`:

| Variable | Purpose | Default |
|----------|---------|---------|
| `TEST_DATABASE_URL` | Explicit test DB URL (optional) | — |
| `DATABASE_URL` | Overridden to test DB at runtime | `postgresql://postgres:postgres@localhost:5432/keil_test` |

If `TEST_DATABASE_URL` is set in `.env`, it takes priority. Otherwise the default local URL is used.

---

## Writing New Tests

### Backend Route Test

```typescript
import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../../app";
import { seedUser } from "../../test/helpers";

describe("POST /api/v1/your-endpoint", () => {
    const userId = "some-uuid";
    const token = `mock-user-id-${userId}`;

    it("should do something", async () => {
        await seedUser(userId, "user@test.com", "Test User");

        const response = await request(app)
            .post("/api/v1/your-endpoint")
            .set("Authorization", `Bearer ${token}`)
            .send({ key: "value" })
            .expect(200);

        expect(response.body.data).toHaveProperty("expectedField");
    });
});
```

### Backend Socket Test

```typescript
import { io as Client } from "socket.io-client";
import { seedUser } from "../test/helpers";

it("should handle socket event", async () => {
    await seedUser(userId, email, name);

    const socket = Client(`http://localhost:${port}`, {
        auth: { token: `mock-user-id-${userId}` },
        transports: ["websocket"],
    });

    await new Promise<void>((resolve, reject) => {
        socket.on("connect", () => { /* emit events */ });
        socket.on("expected_event", (data) => {
            expect(data).toHaveProperty("field");
            socket.disconnect();
            resolve();
        });
    });
});
```

### Frontend Store Test

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { useYourStore } from "../useYourStore";

describe("useYourStore", () => {
    beforeEach(() => {
        useYourStore.setState({ /* initial state */ });
    });

    it("should update state", () => {
        useYourStore.getState().someAction();
        expect(useYourStore.getState().someField).toBe(expectedValue);
    });
});
```

---

## Troubleshooting

### "relation public.users does not exist"

The test database needs migrations. Run:
```powershell
cd backend
node scratch/reset-test-db.js
npm run test
```

### "function auth.uid() does not exist"

The global setup creates this stub. If it fails, reset the database:
```powershell
node scratch/reset-test-db.js
```

### "unsafe use of new value of enum type"

This happens if a migration adds an enum value and uses it in the same transaction. The migration runner handles this automatically by splitting such migrations into individual statements.

### Tests connecting to production database

Check that `pg.ts` reads `process.env.DATABASE_URL` directly (not through `config.databaseUrl`). The test setup overrides `process.env.DATABASE_URL` before importing the pool module.

### Socket tests timing out

- Ensure the test seeds all required data (user, org, space, channel, memberships)
- Add a small delay between `join_channel` and `send_message` events
- Check that the `receive_message` assertion matches the actual response shape (`sender: { id, name }` not `sender_id`)
