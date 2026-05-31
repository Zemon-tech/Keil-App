/**
 * Vitest Per-File Setup
 * Runs before each test file. Responsibilities:
 *   1. Override DATABASE_URL to the local test database
 *   2. Mock external services (Supabase Auth, Google, AWS, ElevenLabs)
 *   3. Clean database between tests for isolation
 */
import dotenv from "dotenv";
dotenv.config();

// Override DATABASE_URL BEFORE any app module imports
const testDbUrl = process.env.TEST_DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/keil_test";
process.env.DATABASE_URL = testDbUrl;

import { beforeAll, afterAll, beforeEach, vi } from "vitest";

// ─── Mock Supabase Auth SDK ──────────────────────────────────────────────────
// The auth middleware calls supabaseAdmin.auth.getUser(token).
// We mock it to return a user based on the token value.
vi.mock("@supabase/supabase-js", () => {
    return {
        createClient: vi.fn(() => ({
            auth: {
                getUser: vi.fn(async (token: string) => {
                    if (!token || token === "invalid-token") {
                        return { data: { user: null }, error: new Error("Invalid token") };
                    }
                    // Convention: token = "mock-user-id-<uuid>" → extract uuid
                    const id = token.startsWith("mock-user-id-")
                        ? token.replace("mock-user-id-", "")
                        : "d3b07384-d113-4ec6-a53d-d16e001844b3";

                    return {
                        data: {
                            user: {
                                id,
                                email: "test@keilhq.in",
                                raw_user_meta_data: { full_name: "Test User" }
                            }
                        },
                        error: null
                    };
                })
            },
            storage: {
                from: vi.fn(() => ({
                    upload: vi.fn(async () => ({ data: { path: "test.txt" }, error: null })),
                    getPublicUrl: vi.fn(() => ({ data: { publicUrl: "https://test.com/test.txt" } }))
                }))
            }
        }))
    };
});

// ─── Mock Google AI SDK ──────────────────────────────────────────────────────
vi.mock("@ai-sdk/google", () => ({
    google: () => {}
}));

// ─── Mock ElevenLabs ─────────────────────────────────────────────────────────
vi.mock("@elevenlabs/elevenlabs-js", () => {
    class MockElevenLabsClient {
        generate = vi.fn();
        play = vi.fn();
    }
    return { ElevenLabsClient: MockElevenLabsClient };
});

// ─── Mock Google APIs (Calendar) ─────────────────────────────────────────────
vi.mock("googleapis", () => {
    class MockOAuth2 {
        setCredentials = vi.fn();
        getToken = vi.fn();
        refreshAccessToken = vi.fn();
    }
    return {
        google: {
            auth: { OAuth2: MockOAuth2 },
            calendar: vi.fn(() => ({
                events: {
                    list: vi.fn(async () => ({ data: { items: [] } })),
                    insert: vi.fn(async () => ({ data: { id: "test-event-id" } })),
                    patch: vi.fn(async () => ({ data: {} })),
                    delete: vi.fn(async () => ({}))
                },
                channels: { stop: vi.fn(async () => ({})) }
            }))
        }
    };
});

// ─── Mock AWS S3 ─────────────────────────────────────────────────────────────
vi.mock("@aws-sdk/client-s3", () => {
    class MockS3Client { send = vi.fn(); }
    return {
        S3Client: MockS3Client,
        PutObjectCommand: vi.fn(),
        GetObjectCommand: vi.fn()
    };
});

// ─── Database Lifecycle ──────────────────────────────────────────────────────
// Import pool AFTER env override so it connects to the test DB
import pool from "../config/pg";

beforeAll(async () => {
    // Safety: block if somehow pointing at a remote DB
    const url = process.env.DATABASE_URL || "";
    const isRemote = url.includes("supabase") || url.includes(".com") || url.includes(".co");
    if (isRemote && !url.includes("localhost") && !url.includes("127.0.0.1")) {
        throw new Error("🛡️ Safety Shield: Refusing to run tests against a remote database!");
    }

    // Verify connection
    await pool.query("SELECT NOW()");
});

beforeEach(async () => {
    await clearDatabase();
});

afterAll(async () => {
    await pool.end();
});

// ─── Database Cleanup ────────────────────────────────────────────────────────
async function clearDatabase() {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        // Get all public tables except migrations log
        const res = await client.query(`
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
              AND table_type = 'BASE TABLE'
              AND table_name NOT IN ('_migrations_log')
        `);

        const tables = res.rows.map((r: any) => `public."${r.table_name}"`);
        if (tables.length > 0) {
            await client.query(`TRUNCATE TABLE ${tables.join(", ")} CASCADE`);
        }

        // Also clean auth.users
        try {
            await client.query("DELETE FROM auth.users");
        } catch (_) {
            // Swallow if auth.users doesn't exist
        }

        await client.query("COMMIT");
    } catch (e) {
        await client.query("ROLLBACK");
        throw e;
    } finally {
        client.release();
    }
}
