const { Pool } = require('pg');

// Connect to the default 'postgres' database to drop/create keil_test
const p = new Pool({ connectionString: 'postgresql://postgres:postgres@localhost:5432/postgres' });

async function main() {
    try {
        // Terminate existing connections to keil_test
        await p.query(`
            SELECT pg_terminate_backend(pid) 
            FROM pg_stat_activity 
            WHERE datname = 'keil_test' AND pid <> pg_backend_pid()
        `);
        console.log("Terminated existing connections");

        // Drop and recreate
        await p.query('DROP DATABASE IF EXISTS keil_test');
        console.log("Dropped keil_test");

        await p.query('CREATE DATABASE keil_test OWNER postgres');
        console.log("Created fresh keil_test database");

        // Now connect to keil_test and create auth schema + table
        const testPool = new Pool({ connectionString: 'postgresql://postgres:postgres@localhost:5432/keil_test' });
        
        await testPool.query('CREATE SCHEMA IF NOT EXISTS auth');
        await testPool.query(`
            CREATE TABLE IF NOT EXISTS auth.users (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                email TEXT UNIQUE,
                raw_user_meta_data JSONB,
                created_at TIMESTAMPTZ DEFAULT NOW()
            )
        `);
        console.log("Created auth schema and auth.users table");

        // Verify
        const res = await testPool.query("SELECT table_schema, table_name FROM information_schema.tables WHERE table_schema IN ('auth', 'public') ORDER BY table_schema, table_name");
        console.log("Tables:", res.rows);

        await testPool.end();
    } catch (e) {
        console.error("Error:", e.message);
    } finally {
        await p.end();
    }
}

main();
