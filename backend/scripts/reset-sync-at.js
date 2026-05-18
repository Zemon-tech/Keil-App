require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
pool.query("UPDATE public.user_integrations SET last_sync_at = NULL WHERE provider = 'google_calendar'")
  .then(r => { console.log('Reset last_sync_at for', r.rowCount, 'rows'); pool.end(); })
  .catch(e => { console.error(e.message); pool.end(); });
