const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function runMigration() {
  try {
    const migrations = [
      '004_chat_schema.sql',
      '005_add_events_support.sql'
    ];
    
    for (const file of migrations) {
      console.log(`Running ${file}...`);
      const sqlPath = path.join(__dirname, 'src', 'migrations', file);
      if (fs.existsSync(sqlPath)) {
        const sql = fs.readFileSync(sqlPath, 'utf8');
        await pool.query(sql);
        console.log(`Successfully ran ${file}`);
      } else {
        console.warn(`Migration file ${file} not found at ${sqlPath}`);
      }
    }
  } catch (err) {
    console.error("Migration failed:", err.message);
  } finally {
    await pool.end();
  }
}

runMigration();
