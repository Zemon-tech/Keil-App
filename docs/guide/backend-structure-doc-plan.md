# 📘 Backend Structure — Documentation Plan

> **Source File:** `.agent/rules/backend-structure.md`
> **Purpose:** This plan explains every section of the backend structure rules in a simple, easy-to-follow way — so any developer (new or experienced) can instantly understand how the backend is organized and how to work with it.

---

## 📋 Table of Contents

| #  | Section                     | What it covers                                   |
|----|-----------------------------|--------------------------------------------------|
| 1  | What is This File?          | What the rule file is and when it applies        |
| 2  | Folder Structure            | Which folder does what                           |
| 3  | Code Patterns               | How we write and organize code                   |
| 4  | Utility Classes             | 3 key helper files every dev must know           |
| 5  | NPM Commands                | How to run, build, and develop the backend       |
| 6  | Tech Stack & Versions       | All libraries and their exact versions           |

---

## 1️⃣ What is This File?

**File:** `.agent/rules/backend-structure.md`

This file is an **agent rule** — it tells the AI assistant how the backend is structured so it gives accurate, consistent code help.

| Property    | Value                                               |
|-------------|-----------------------------------------------------|
| Trigger     | `model_decision` (AI reads this automatically)      |
| When Used   | When working on or making changes to the backend    |

> **Simple Rule:** Whenever you touch any backend code, this file is the reference guide the AI uses to understand how things should be organized.

---

## 2️⃣ Folder Structure — Which Folder Does What?

The backend lives inside the `src/` folder. Each sub-folder has one specific job.

```
src/
├── config/         ← Setup: MongoDB, Supabase, environment variables
├── controllers/    ← Request handlers — read input, call service, send response
├── middlewares/    ← Express middleware — logging, error handling
├── models/         ← Database schemas and TypeScript interfaces
├── routes/         ← URL endpoint definitions — connects URL to controller
├── services/       ← Business logic — the "brain" of each feature
├── types/          ← Custom TypeScript types and interfaces
└── utils/          ← Reusable helper classes used across the whole app
```

### 🔤 Folder Responsibilities — Quick Cheat Sheet

| Folder         | Job in 1 Sentence                                                    |
|----------------|----------------------------------------------------------------------|
| `config/`      | Connects to databases and loads environment variables                |
| `controllers/` | Receives HTTP request, calls a service, sends back a response        |
| `services/`    | Contains the actual business logic — no HTTP knowledge here          |
| `routes/`      | Maps a URL path + HTTP method to the right controller                |
| `models/`      | Defines what data looks like (DB schemas, TypeScript types)          |
| `middlewares/` | Runs code before/after requests — e.g., logging, error catching      |
| `types/`       | Shared TypeScript types reused across multiple files                 |
| `utils/`       | Small, reusable helper classes (`ApiError`, `ApiResponse`, etc.)     |

---

## 3️⃣ Code Patterns — How We Write & Organize Code

### Pattern 1 — Separation of Concerns (The 3-Layer Rule)

Every feature is split into exactly 3 layers. Each layer has ONE job:

```
Request comes in
      ↓
  [ Route ]        → defines the URL & HTTP method, attaches middleware
      ↓
  [ Controller ]   → reads request data, calls service, sends response
      ↓
  [ Service ]      → runs the real business logic, talks to database
```

| Layer        | What it DOES                              | What it does NOT do                        |
|--------------|-------------------------------------------|--------------------------------------------|
| `Route`      | Defines URL path & method                 | Does NOT contain any logic                 |
| `Controller` | Reads request, formats response           | Does NOT directly touch the database       |
| `Service`    | Business logic & DB queries               | Does NOT know about HTTP or responses      |

---

### Pattern 2 — Modular Routing

All route files live in `routes/` and follow this naming pattern:

```
routes/
├── health.routes.ts    ← one route file per feature
├── user.routes.ts
├── task.routes.ts
└── index.ts            ← aggregates ALL routes → keeps app.ts clean
```

> **Rule:** Never define routes directly in `app.ts`. Always add them to `routes/index.ts`.

---

### Pattern 3 — Global Error Handling (No Repetitive try-catch)

Instead of writing `try-catch` blocks inside every controller, we use:

```
catchAsync(fn)    ← wraps any async controller function
      ↓
  if error occurs → automatically passed to Express next()
      ↓
error.ts middleware ← handles ALL errors in one central place
```

> **Benefit:** Write error handling once. Every controller is automatically protected.

---

## 4️⃣ Utility Classes — 3 Files Every Developer Must Know

These 3 files in `src/utils/` are used everywhere in the backend:

---

### 🔴 `ApiError.ts` — Standard Error Object

Used to throw **consistent, structured errors** across the whole backend.

| Property   | What it holds                        |
|------------|--------------------------------------|
| statusCode | HTTP status code (e.g., 404, 500)    |
| success    | Always `false` for errors            |
| message    | Human-readable error description     |
| error      | Operational error details            |

**When to use:** In services or controllers when something goes wrong.

```ts
// Example
throw new ApiError(404, "Task not found");
```

---

### 🟢 `ApiResponse.ts` — Standard Success Response

Used by controllers to **send consistent JSON responses** for every success.

| Property   | What it holds                        |
|------------|--------------------------------------|
| statusCode | HTTP status code (e.g., 200, 201)    |
| data       | The actual response payload          |
| message    | Human-readable success message       |
| success    | Always `true` for success            |

**When to use:** In every controller when returning a successful result.

```ts
// Example
return res.status(200).json(new ApiResponse(200, task, "Task fetched successfully"));
```

---

### 🔵 `catchAsync.ts` — Async Error Wrapper

A **higher-order function** that wraps async controller functions to auto-catch errors.

**Without it:** Every controller needs its own try-catch.
**With it:** Just wrap the function — errors are handled automatically.

```ts
// Example
export const getTask = catchAsync(async (req, res) => {
  const task = await taskService.getById(req.params.id);
  res.json(new ApiResponse(200, task, "Success"));
});
```

---

## 5️⃣ NPM Commands — How to Run the Backend

| Command           | What it Does                                                      | When to Use              |
|-------------------|-------------------------------------------------------------------|--------------------------|
| `npm run dev`     | Starts server with `nodemon` — auto-restarts on file save         | During development       |
| `npm run build`   | Compiles TypeScript → JavaScript into the `dist/` folder          | Before deploying         |
| `npm start`       | Runs compiled JS from `dist/index.js` (no TypeScript)             | In production            |

> **Quick Rule:** Use `npm run dev` when coding. Use `npm run build` + `npm start` for production.

---

## 6️⃣ Tech Stack & Versions

| Category             | Technology                    | Version         |
|----------------------|-------------------------------|-----------------|
| **Runtime**          | Node.js                       | `@types/node` v25.3.0 |
| **Framework**        | Express.js                    | v5.2.1          |
| **Language**         | TypeScript                    | v5.9.3          |
| **TS Runner**        | ts-node                       | v10.9.2         |
| **Database**         | MongoDB + Mongoose             | v9.2.1          |
| **Cloud Storage**    | Supabase                      | v2.97.0         |
| **CORS Middleware**  | cors                          | v2.8.6          |
| **Env Variables**    | dotenv                        | v17.3.1         |
| **Dev Watcher**      | nodemon                       | v3.1.13         |

---

## ✅ Summary — The 5 Golden Rules of This Backend

| # | Rule                                                                                 |
|---|--------------------------------------------------------------------------------------|
| 1 | **Every feature = 3 layers**: Route → Controller → Service                           |
| 2 | **Routes never contain logic** — they only point to controllers                      |
| 3 | **Services never know about HTTP** — they only deal with data and business logic     |
| 4 | **Always use `ApiError` and `ApiResponse`** — never send raw JSON manually           |
| 5 | **Always wrap async controllers with `catchAsync`** — never write try-catch manually |

---

*Generated from: `.agent/rules/backend-structure.md` | Keil-App Backend Rules*
