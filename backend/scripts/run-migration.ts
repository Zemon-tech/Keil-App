/**
 * scripts/run-migration.ts
 * One-shot script to apply a specific migration SQL file.
 * Usage: npx ts-node scripts/run-migration.ts <migration-file>
 * Example: npx ts-node scripts/run-migration.ts src/migrations/005_channel_privacy.sql
 */

import fs from "fs";
import path from "path";
import { Pool } from "pg";
import dotenv from "dotenv";

dotenv.config();

const migrationFile = process.argv[2];
if (!migrationFile) {
  console.error("Usage: npx ts-node scripts/run-migration.ts <migration-file>");
  process.exit(1);
}

const sql = fs.readFileSync(path.resolve(migrationFile), "utf8");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function run() {
  const client = await pool.connect();
  try {
    console.log(`\n🚀 Running migration: ${migrationFile}\n`);
    await client.query(sql);
    console.log("✅ Migration applied successfully!\n");
  } catch (err) {
    console.error("❌ Migration failed:", err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
