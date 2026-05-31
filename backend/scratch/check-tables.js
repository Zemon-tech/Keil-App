const { Pool } = require('pg');
const p = new Pool({ connectionString: 'postgresql://postgres:postgres@localhost:5432/keil_test' });

async function main() {
    try {
        const res = await p.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
            ORDER BY table_name
        `);
        console.log("Public tables:", res.rows.map(r => r.table_name));
    } catch (e) {
        console.error("Error:", e.message);
    } finally {
        await p.end();
    }
}

main();
