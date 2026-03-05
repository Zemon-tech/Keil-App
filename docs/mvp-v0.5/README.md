# MVP v0.5 - ClarityOS Foundation

## Overview
MVP v0.5 focuses on establishing the core relational infrastructure for ClarityOS. It replaces the legacy MongoDB setup with a robust PostgreSQL schema and scaffolds the primary API endpoints for workspaces, tasks, and collaboration.

## Table of Contents
1. [Architecture Overview](./architecture.md) - System design, data flow, and key design decisions.
2. [Backend Documentation](./backend.md) - Database schema, API routing, and file structure.
3. [Environment Configuration](./environment.md) - Required environment variables and setup.

## Quick Start
To get the backend up and running with the new PostgreSQL schema:

1. **Install Dependencies**:
   ```bash
   cd backend
   npm install
   ```
2. **Setup PostgreSQL**:
   - Ensure you have a Supabase project or any PostgreSQL instance.
   - Run the migrations in order:
     1. `backend/src/migrations/001_initial_schema.sql`
     2. `backend/src/migrations/002_auth_users_trigger.sql` (requires Supabase Auth)
3. **Configure Environment**:
   - Create/Update `.env` with the required `DATABASE_URL` and Supabase keys (see [environment.md](./environment.md)).
4. **Run Dev Server**:
   ```bash
   npm run dev
   ```

## Tech Stack
| Tier      | Technology            | Purpose                 |
| :-------- | :-------------------- | :---------------------- |
| Runtime   | Node.js               | Execution environment   |
| Language  | TypeScript            | Type-safe development   |
| Framework | Express.js            | API server              |
| Database  | PostgreSQL (Supabase) | Relational data storage |
| Auth      | Supabase Auth         | User authentication     |
| Logger    | Pino                  | Structured logging      |
