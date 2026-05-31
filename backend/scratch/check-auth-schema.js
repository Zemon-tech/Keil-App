const { Pool } = require('pg');
const p = new Pool({ connectionString: 'postgresql://postgres:postgres@localhost:5432/keil_test' });

async function main() {
    try {
        const schemaRes = await p.query("SELECT schema_name FROM information_schema.schemata WHERE schema_name = 'auth'");
        console.log('auth schema exists:', schemaRes.rows.length > 0);

        const tableRes = await p.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'auth'");
        console.log('auth tables:', tableRes.rows);

        // Try creating the schema and table
        await p.query('CREATE SCHEMA IF NOT EXISTS auth');
        console.log('CREATE SCHEMA succeeded');

        await p.query(`
            CREATE TABLE IF NOT EXISTS auth.users (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                email TEXT UNIQUE,
                raw_user_meta_data JSONB,
                created_at TIMESTAMPTZ DEFAULT NOW()
            )
        `);
        console.log('CREATE TABLE auth.users succeeded');
    } catch (e) {
        console.error('Error:', e.message);
    } finally {
        await p.end();
    }
}

main();
