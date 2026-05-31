/**
 * Vitest Global Setup
 * Runs ONCE before all test files in a separate process.
 * Responsibilities:
 *   1. Override DATABASE_URL to point to the local test database
 *   2. Create the auth.users table (Supabase manages this in prod, we simulate it locally)
 *   3. Run all SQL migrations against the test database
 */
import dotenv from "dotenv";
dotenv.config();

// Force DATABASE_URL to the local test database BEFORE any other module loads
const testDbUrl = process.env.TEST_DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/keil_test";
process.env.DATABASE_URL = testDbUrl;

import { Pool } from "pg";

export default async function () {
    // Create a dedicated pool for setup (not the app pool, which may have side effects)
    const pool = new Pool({
        connectionString: testDbUrl,
        ssl: false,
        max: 3,
    });

    console.log(`🚀 [Global Setup]: Connecting to test database...`);
    console.log(`   URL: ${testDbUrl.replace(/:[^:@]+@/, ':***@')}`);

    try {
        // Verify connection
        await pool.query("SELECT NOW()");

        // Create auth schema + auth.users + auth.uid() stub
        // (Supabase manages these in prod; we simulate them locally for tests)
        await pool.query("CREATE SCHEMA IF NOT EXISTS auth");
        await pool.query(`
            CREATE TABLE IF NOT EXISTS auth.users (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                email TEXT UNIQUE,
                raw_user_meta_data JSONB,
                created_at TIMESTAMPTZ DEFAULT NOW()
            )
        `);
        // Stub auth.uid() — used in RLS policies. Returns NULL in tests
        // (RLS is bypassed anyway since we connect as the table owner).
        await pool.query(`
            CREATE OR REPLACE FUNCTION auth.uid()
            RETURNS UUID
            LANGUAGE sql STABLE
            AS $$ SELECT NULL::UUID; $$
        `);
        console.log("✅ [Global Setup]: auth schema, auth.users, and auth.uid() stub ready");

        // Run migrations
        console.log("🚀 [Global Setup]: Running database migrations...");
        await runMigrations(pool);
        console.log("✅ [Global Setup]: All migrations applied successfully!");

    } catch (err) {
        console.error("💥 [Global Setup]: Failed:", err);
        throw err;
    } finally {
        await pool.end();
    }
}

async function runMigrations(pool: Pool) {
    const fs = await import("fs");
    const path = await import("path");

    const migrationsDir = path.join(__dirname, "../migrations");

    // Ensure migrations log table exists
    await pool.query(`
        CREATE TABLE IF NOT EXISTS public._migrations_log (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255) UNIQUE NOT NULL,
            applied_at TIMESTAMPTZ DEFAULT NOW()
        )
    `);

    const files = fs.readdirSync(migrationsDir)
        .filter((f: string) => f.endsWith(".sql"))
        .sort();

    for (const file of files) {
        // Skip already-applied migrations
        const check = await pool.query(
            "SELECT 1 FROM public._migrations_log WHERE name = $1",
            [file]
        );
        if (check.rowCount && check.rowCount > 0) {
            continue;
        }

        const filePath = path.join(migrationsDir, file);
        const sql = fs.readFileSync(filePath, "utf-8");

        // PostgreSQL cannot use new enum values in the same transaction where
        // ALTER TYPE ADD VALUE was executed. Detect and run those statement-by-statement.
        const hasEnumAddValue = /ALTER\s+TYPE.*ADD\s+VALUE/i.test(sql);

        try {
            if (hasEnumAddValue) {
                // Split into individual statements and run each separately (no transaction)
                // This allows ALTER TYPE ADD VALUE to commit before subsequent statements use the value
                const statements = splitSqlStatements(sql);
                for (const stmt of statements) {
                    if (stmt.trim()) {
                        await pool.query(stmt);
                    }
                }
            } else {
                await pool.query("BEGIN");
                await pool.query(sql);
                await pool.query("COMMIT");
            }
            await pool.query(
                "INSERT INTO public._migrations_log (name) VALUES ($1) ON CONFLICT (name) DO NOTHING",
                [file]
            );
        } catch (err: any) {
            if (!hasEnumAddValue) {
                await pool.query("ROLLBACK");
            }
            // Tolerate "already exists" errors (idempotent migrations)
            const isDuplicate = err.message.includes("already exists") ||
                err.message.includes("already a member") ||
                err.message.includes("already exists, skipping");
            if (isDuplicate) {
                await pool.query(
                    "INSERT INTO public._migrations_log (name) VALUES ($1) ON CONFLICT (name) DO NOTHING",
                    [file]
                );
            } else {
                console.error(`❌ Migration ${file} failed:`, err.message);
                throw err;
            }
        }
    }
}

/**
 * Split a SQL file into individual executable statements.
 * Handles:
 *   - Dollar-quoted blocks ($$...$$, $tag$...$tag$)
 *   - Single-line comments (--)
 *   - Block comments (/* ... *​/)
 *   - String literals ('...')
 *   - DO $$ ... $$ blocks, CREATE FUNCTION bodies, etc.
 *
 * Splits on semicolons that are NOT inside quotes, dollar-quotes, or comments.
 */
function splitSqlStatements(sql: string): string[] {
    const statements: string[] = [];
    let current = "";
    let i = 0;

    while (i < sql.length) {
        // Skip single-line comments
        if (sql[i] === "-" && sql[i + 1] === "-") {
            const end = sql.indexOf("\n", i);
            if (end === -1) {
                current += sql.slice(i);
                break;
            }
            current += sql.slice(i, end + 1);
            i = end + 1;
            continue;
        }

        // Skip block comments
        if (sql[i] === "/" && sql[i + 1] === "*") {
            const end = sql.indexOf("*/", i + 2);
            if (end === -1) {
                current += sql.slice(i);
                break;
            }
            current += sql.slice(i, end + 2);
            i = end + 2;
            continue;
        }

        // Handle dollar-quoted strings ($$...$$, $tag$...$tag$)
        if (sql[i] === "$") {
            // Find the end of the dollar-quote tag
            const tagMatch = sql.slice(i).match(/^(\$[a-zA-Z0-9_]*\$)/);
            if (tagMatch) {
                const tag = tagMatch[1];
                const closeIdx = sql.indexOf(tag, i + tag.length);
                if (closeIdx === -1) {
                    current += sql.slice(i);
                    break;
                }
                current += sql.slice(i, closeIdx + tag.length);
                i = closeIdx + tag.length;
                continue;
            }
        }

        // Handle single-quoted strings
        if (sql[i] === "'") {
            let j = i + 1;
            while (j < sql.length) {
                if (sql[j] === "'" && sql[j + 1] === "'") {
                    j += 2; // escaped quote
                } else if (sql[j] === "'") {
                    break;
                } else {
                    j++;
                }
            }
            current += sql.slice(i, j + 1);
            i = j + 1;
            continue;
        }

        // Statement terminator
        if (sql[i] === ";") {
            current += ";";
            const trimmed = current.trim();
            if (trimmed && trimmed !== ";") {
                statements.push(trimmed);
            }
            current = "";
            i++;
            continue;
        }

        current += sql[i];
        i++;
    }

    // Don't forget the last statement (if no trailing semicolon)
    const trimmed = current.trim();
    if (trimmed && trimmed !== ";") {
        statements.push(trimmed);
    }

    return statements;
}
