const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function runTest() {
  try {
    console.log("Checking DB connection...");
    const res = await pool.query("SELECT NOW()");
    console.log("DB time:", res.rows[0]);

    // Let's find some channel and user
    const channelRes = await pool.query("SELECT * FROM public.channels LIMIT 5");
    console.log("Channels:", channelRes.rows);

    const membersRes = await pool.query("SELECT * FROM public.channel_members LIMIT 5");
    console.log("Channel members:", membersRes.rows);

    if (channelRes.rows.length > 0) {
      const channelId = channelRes.rows[0].id;
      console.log(`Testing roleCheck for channelId: ${channelId}`);
      // Let's see if we can do the roleCheck query
      const userRes = await pool.query("SELECT * FROM public.users LIMIT 1");
      if (userRes.rows.length > 0) {
        const userId = userRes.rows[0].id;
        const roleCheck = await pool.query(
          `
            SELECT cm.role, c.type
            FROM public.channel_members cm
            JOIN public.channels c ON c.id = cm.channel_id
            WHERE cm.channel_id = $1 AND cm.user_id = $2
          `,
          [channelId, userId],
        );
        console.log("Role check result:", roleCheck.rows);
      }
    }
  } catch (err) {
    console.error("Test failed with error:", err);
  } finally {
    await pool.end();
  }
}

runTest();
