const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  const taskId = 'e961ce2a-9693-478d-ba7a-4ec1f19bbf9b';
  const spaceId = 'e30ccebe-bbee-4441-bd76-a15bab297106';
  
  try {
    console.log("DATABASE_URL:", process.env.DATABASE_URL);
    
    // Inspect task
    const taskRes = await pool.query('SELECT * FROM public.tasks WHERE id = $1', [taskId]);
    console.log("Task row:", taskRes.rows[0]);
    
    // Inspect space
    const spaceRes = await pool.query('SELECT * FROM public.spaces WHERE id = $1', [spaceId]);
    console.log("Space row:", spaceRes.rows[0]);

    if (spaceRes.rows[0]) {
      const workspaceId = spaceRes.rows[0].workspace_id;
      // Inspect workspace
      const workspaceRes = await pool.query('SELECT * FROM public.workspaces WHERE id = $1', [workspaceId]);
      console.log("Workspace row:", workspaceRes.rows[0]);
    }
  } catch (error) {
    console.error("Error running query:", error);
  } finally {
    await pool.end();
  }
}

main();
