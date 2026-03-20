# 📘 Documentation Plan — Repository Layer Architecture

> **File Source**: `docs/repository/architecture.md`
> **Goal**: Understand how the backend is structured — from a request coming in to data going out.

---

## 🗺️ What Is This File About?

This file explains **how the backend works** under the hood.

It describes a **3-layer system** that keeps code clean and organized:

| Layer | Who Does It | Job |
|---|---|---|
| **Controller** | HTTP Layer | Receives requests, sends responses |
| **Service** | Business Logic | Validates rules, transforms data |
| **Repository** | Data Access | Talks to the database |

> Think of it like a restaurant: **Controller = Waiter**, **Service = Chef**, **Repository = Storeroom**

---

## 📋 Documentation Plan — Section by Section

---

### ✅ Section 1: System Flow
**What it covers**: How a request travels through the 3 layers.

**Simple Explanation**:
```
Browser/Client
     ↓
Controller  →  Gets the request
     ↓
Service     →  Checks rules & processes data
     ↓
Repository  →  Reads/Writes to Database
     ↓
PostgreSQL  →  Stores everything
```

**Doc Goal**: Draw a simple flow diagram. Show what each layer does in 1 line.

---

### ✅ Section 2: Key Design Decisions (6 Decisions)

> These are the **"why did we build it this way?"** answers.

#### Decision 1 — Raw SQL instead of ORM
- **What**: Direct SQL queries, no frameworks like TypeORM/Prisma.
- **Why**: Faster, more control, team already knows SQL.
- **Downside**: More code to write manually.

---

#### Decision 2 — Entity → DTO Conversion in Services
- **What**: Database gives back an **Entity** (raw DB object). Service converts it to a **DTO** (clean API response).
- **Why**: Keeps separation clean. Same data can be shown differently to different endpoints.
- **Example**:
  ```
  Repository → returns raw Task object (Entity)
  Service    → converts to TaskDTO for API response
  ```

---

#### Decision 3 — Soft Delete by Default
- **What**: Records are NEVER truly deleted. A `deleted_at` timestamp is set instead.
- **Why**: Safety net. Users can recover data. Keeps audit history.
- **How it works**:
  ```
  deleted_at = NULL     → Record is ACTIVE ✅
  deleted_at = (date)   → Record is DELETED 🗑️
  ```

---

#### Decision 4 — Transaction Support
- **What**: Multiple DB operations are wrapped in a single transaction.
- **Why**: If any step fails, ALL steps are rolled back. No half-done actions.
- **Example**: Create task + Log activity → Both succeed or both fail.

---

#### Decision 5 — Activity Logging in Services (not Repositories)
- **What**: Only Services log user activities, not Repositories.
- **Why**: Logging is a business decision. Repositories should only care about data.

---

#### Decision 6 — Singleton Repository Instances
- **What**: One single copy of each Repository is created and shared across the whole app.
- **Why**: Saves memory, shares the database connection pool efficiently.

---

### ✅ Section 3: Data Flow Patterns (3 Patterns)

> These show **HOW data moves** in different scenarios.

| Pattern | When Used | Steps |
|---|---|---|
| **Simple Query** | Fetch one item | Controller → Service → Repository → DB → DTO → Response |
| **Transaction** | Create + Log activity together | Same flow but wrapped in begin/commit/rollback |
| **Filtered Query** | List with search/filter params | Extract params → Build filters → SQL → Map to DTOs |

---

### ✅ Section 4: Security Model (4 Rules)

> How the app stays **safe and secure**.

| Rule | Who Handles It | What It Does |
|---|---|---|
| **Input Validation** | Controllers + Services + DB | Checks right format, types, and constraints |
| **Authorization** | Middleware + Services | JWT login check, workspace membership check |
| **SQL Injection** | Repositories | Use `$1, $2` placeholders — NEVER raw string SQL |
| **Soft Delete Security** | Repositories | Deleted records are hidden by default |

---

### ✅ Section 5: Performance Considerations (4 Topics)

> How the app stays **fast under load**.

| Topic | Key Detail |
|---|---|
| **Connection Pooling** | Max 20 DB connections, idle timeout 30s |
| **Query Optimization** | Indexes on all foreign keys + soft delete columns |
| **Pagination** | Default 20–50 items per page (Limit/Offset) |
| **Caching** | ❌ Not yet implemented — Redis planned for future |

---

### ✅ Section 6: Scalability

> How the app handles **more users / more load**.

| Type | How |
|---|---|
| **Horizontal Scaling** | Services are stateless → just add more servers |
| **Vertical Scaling** | Increase DB pool size, upgrade PostgreSQL server |

---

### ✅ Section 7: Error Handling (3 Layers)

> How **errors are caught and reported** at each layer.

```
Repository Layer
  → Throws raw DB errors (connection issues, constraint failures)
         ↓
Service Layer
  → Catches those errors
  → Throws clean `ApiError` with a user-friendly message
         ↓
Controller Layer
  → Uses `catchAsync` wrapper
  → Sends a standardized JSON error response
```

---

### ✅ Section 8: Future Enhancements (7 Ideas)

> Things **planned for later** — not yet built.

| # | Enhancement | Benefit |
|---|---|---|
| 1 | Read Replicas | Faster reads by routing to separate DB |
| 2 | Redis Caching | Speed up repeated data fetches |
| 3 | Type-safe Query Builder | Fewer manual SQL errors |
| 4 | Better Audit Logging | More detail on who did what |
| 5 | Soft Delete Archival | Move old deleted data to separate table |
| 6 | Performance Monitoring | Track slow queries |
| 7 | Pool Health Dashboard | Monitor DB connections in real time |

---

## 🧠 Quick Summary (TL;DR)

```
Request comes in
       ↓
Controller  → Reads params/body, calls Service
       ↓
Service     → Validates rules, calls Repository, converts Entity→DTO
       ↓
Repository  → Runs raw SQL, returns Entity
       ↓
PostgreSQL  → Stores/returns data
       ↓
Response sent back to client ✅
```

**Core Principles in one line each:**
- 🔒 **Security** → JWT auth + parameterized SQL + soft delete
- ⚡ **Performance** → Connection pool + indexed queries + pagination
- 🔄 **Reliability** → Transactions + error handling at every layer
- 📦 **Clean Code** → Entity/DTO split + Singleton repos + Service-only logging

---

*Documentation plan created for `docs/repository/architecture.md`*
