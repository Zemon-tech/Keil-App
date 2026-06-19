const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

const isTest = process.argv.includes('--test');
const connectionString = isTest ? process.env.TEST_DATABASE_URL : process.env.DATABASE_URL;

if (!connectionString) {
  console.error(`Error: ${isTest ? 'TEST_DATABASE_URL' : 'DATABASE_URL'} is not defined in the environment variables.`);
  process.exit(1);
}

console.log(`Connecting to database: ${connectionString.replace(/:[^:@]+@/, ':***@')}`);

const isLocalDb = connectionString.includes('localhost') || connectionString.includes('127.0.0.1');

const pool = new Pool({
  connectionString,
  ssl: isLocalDb ? false : { rejectUnauthorized: false }
});

async function truncateData() {
  const client = await pool.connect();
  try {
    console.log('🔍 Fetching all tables in public and mastra schemas...');
    
    // Query all base tables in public and mastra schemas, excluding _migrations_log
    const res = await client.query(`
      SELECT quote_ident(table_schema) || '.' || quote_ident(table_name) AS full_table_name
      FROM information_schema.tables
      WHERE table_schema IN ('public', 'mastra')
        AND table_type = 'BASE TABLE'
        AND table_name NOT IN ('_migrations_log');
    `);

    const tables = res.rows.map(row => row.full_table_name);

    if (tables.length === 0) {
      console.log('ℹ️ No tables found to truncate. If this is a fresh database, please run the server or migrations first.');
      return;
    }

    console.log(`🗑️ Truncating ${tables.length} tables:`);
    console.log(tables.map(t => `  - ${t}`).join('\n'));

    // Construct a single TRUNCATE TABLE ... CASCADE query
    const truncateQuery = `TRUNCATE TABLE ${tables.join(', ')} CASCADE;`;
    
    await client.query('BEGIN');
    await client.query(truncateQuery);
    await client.query('COMMIT');

    console.log('⭐ All tables truncated successfully! (Data cleared, schema/triggers/functions intact)');
  } catch (err) {
    console.error('💥 Data truncation failed:', err.message);
    try {
      await client.query('ROLLBACK');
    } catch (rollbackErr) {
      // Ignore rollback errors if not in a transaction
    }
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

truncateData();
