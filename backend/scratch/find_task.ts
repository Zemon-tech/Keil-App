import "dotenv/config";
import pool from "../src/config/pg";

async function main() {
  try {
    console.log("Searching in public.tasks...");
    const resTasks = await pool.query(`
      SELECT id, title, org_id, space_id, created_by 
      FROM public.tasks 
      WHERE title ILIKE '%Update AI agent%';
    `);
    console.log("Tasks found:", resTasks.rows);

    console.log("Searching in public.personal_tasks...");
    const resPersonal = await pool.query(`
      SELECT id, title, owner_user_id 
      FROM public.personal_tasks 
      WHERE title ILIKE '%Update AI agent%';
    `);
    console.log("Personal Tasks found:", resPersonal.rows);
  } catch (err) {
    console.error("Search failed:", err);
  } finally {
    process.exit(0);
  }
}

main();
