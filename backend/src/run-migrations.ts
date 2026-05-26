import fs from "fs";
import path from "path";
import pool from "./config/pg";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

const migrationsDir = path.join(__dirname, "migrations");

const runMigrations = async () => {
    console.log("🚀 [Migrations]: Starting database migrations runner...");

    try {
        // 1. Ensure migrations tracking table exists in the public schema
        await pool.query(`
            CREATE TABLE IF NOT EXISTS public._migrations_log (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) UNIQUE NOT NULL,
                applied_at TIMESTAMPTZ DEFAULT NOW()
            );
        `);

        // 2. Read and sort all migration SQL files
        const files = fs.readdirSync(migrationsDir)
            .filter(f => f.endsWith(".sql"))
            .sort();

        console.log(`🔍 [Migrations]: Found ${files.length} migration files in directory.`);

        // 3. Process each migration in a secure transaction block
        for (const file of files) {
            const check = await pool.query(
                "SELECT 1 FROM public._migrations_log WHERE name = $1",
                [file]
            );

            if (check.rowCount && check.rowCount > 0) {
                console.log(`✅ [Migrations]: Already applied: ${file}`);
                continue;
            }

            console.log(`⚙️ [Migrations]: Applying migration: ${file}...`);
            const filePath = path.join(migrationsDir, file);
            const sql = fs.readFileSync(filePath, "utf-8");

            const client = await pool.connect();
            try {
                await client.query("BEGIN");
                await client.query(sql);
                await client.query(
                    "INSERT INTO public._migrations_log (name) VALUES ($1)",
                    [file]
                );
                await client.query("COMMIT");
                console.log(`🎉 [Migrations]: Successfully applied: ${file}`);
            } catch (err: any) {
                await client.query("ROLLBACK");
                const isDuplicate = err.message.includes("already exists") || 
                                    err.message.includes("already a member") ||
                                    err.message.includes("already exists, skipping");
                if (isDuplicate) {
                    console.log(`⚠️ [Migrations]: ${file} contains database entities that already exist. Marking as applied.`);
                    await pool.query(
                        "INSERT INTO public._migrations_log (name) VALUES ($1) ON CONFLICT (name) DO NOTHING",
                        [file]
                    );
                } else {
                    console.error(`❌ [Migrations]: Error executing migration ${file}:`, err.message);
                    throw err;
                }
            } finally {
                client.release();
            }
        }

        console.log("⭐ [Migrations]: Database migrations processed successfully!");
        process.exit(0);
    } catch (err: any) {
        console.error("💥 [Migrations]: Critical failure in migration execution:", err.message);
        process.exit(1);
    }
};

runMigrations();
