const { Pool } = require('pg');
const p = new Pool({ connectionString: 'postgresql://postgres:postgres@localhost:5432/keil_test' });

async function main() {
    try {
        // Check current user
        const whoami = await p.query("SELECT current_user, current_database()");
        console.log("Connected as:", whoami.rows[0]);

        // Check if auth schema exists
        const schemaRes = await p.query("SELECT schema_name FROM information_schema.schemata WHERE schema_name = 'auth'");
        console.log("auth schema exists:", schemaRes.rows.length > 0);

        // Check schema owner
        const ownerRes = await p.query("SELECT schema_name, schema_owner FROM information_schema.schemata WHERE schema_name = 'auth'");
        console.log("auth schema owner:", ownerRes.rows);

        // Grant all on auth schema to postgres
        await p.query("GRANT ALL ON SCHEMA auth TO postgres");
        console.log("Granted ALL on auth schema to postgres");

        // Try creating the table now
        await p.query(`
            CREATE TABLE IF NOT EXISTS auth.users (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                email TEXT UNIQUE,
                raw_user_meta_data JSONB,
                created_at TIMESTAMPTZ DEFAULT NOW()
            )
        `);
        console.log("auth.users table created successfully");

        // Verify
        const tableRes = await p.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'auth'");
        console.log("auth tables:", tableRes.rows);
    } catch (e) {
        console.error("Error:", e.message);
    } finally {
        await p.end();
    }
}

main();
