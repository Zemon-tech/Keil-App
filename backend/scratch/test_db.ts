import "dotenv/config";
import pool from "../src/config/pg";

async function main() {
  try {
    const res = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
        AND table_name IN ('tasks', 'personal_tasks')
        AND column_name LIKE 'github_%';
    `);
    console.log("Database Columns found:", res.rows);
  } catch (err) {
    console.error("Database Query Failed:", err);
  } finally {
    process.exit(0);
  }
}

main();
