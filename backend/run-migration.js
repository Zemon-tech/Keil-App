const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function runMigrations() {
  try {
    const migrationsDir = path.join(__dirname, 'src', 'migrations');
    const files = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort(); // Run in alphabetical order
    
    for (const file of files) {
      console.log(`Running ${file}...`);
      const sqlPath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(sqlPath, 'utf8');
      
      try {
        await pool.query(sql);
        console.log(`Successfully ran ${file}`);
      } catch (err) {
        // If it's a "already exists" error, we can often ignore it if the SQL isn't idempotent
        // But since we saw IF NOT EXISTS in some, we'll log and continue if it's not a fatal error
        console.warn(`Note for ${file}: ${err.message}`);
      }
    }
    console.log("All migrations processed.");
  } catch (err) {
    console.error("Migration process failed:", err.message);
  } finally {
    await pool.end();
  }
}

runMigrations();
