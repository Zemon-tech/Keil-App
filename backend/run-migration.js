const fs = require('fs');
const { Client } = require('pg');
require('dotenv').config();

async function runMigration() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log("Connected to database");
    
    const migrations = [
      '004_chat_schema.sql'
    ];
    
    for (const file of migrations) {
      console.log(`Running ${file}...`);
      const sql = fs.readFileSync(`src/migrations/${file}`, 'utf8');
      await client.query(sql);
      console.log(`Successfully ran ${file}`);
    }
  } catch (err) {
    console.error("Migration failed:", err);
  } finally {
    await client.end();
  }
}

runMigration();
