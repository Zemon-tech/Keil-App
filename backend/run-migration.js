const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: 'postgresql://postgres.tmqklbarumarutqeygjx:RIEYRXbDFtBP3aJM@aws-1-ap-south-1.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function runMigration() {
  try {
    const sql = fs.readFileSync(path.join(__dirname, 'src', 'migrations', '005_add_events_support.sql'), 'utf8');
    await pool.query(sql);
    console.log('Migration applied successfully!');
  } catch (err) {
    console.error('Error applying migration:', err.message);
  } finally {
    pool.end();
  }
}

runMigration();
