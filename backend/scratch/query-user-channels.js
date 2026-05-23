const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    const userId = 'feeaf300-167d-473f-b377-2d300f6ab09d';
    
    // Find all channels where the user is a member
    const res = await pool.query(
      `
      SELECT cm.channel_id, cm.role, c.name, c.type, c.org_id, c.space_id
      FROM public.channel_members cm
      JOIN public.channels c ON c.id = cm.channel_id
      WHERE cm.user_id = $1
      `,
      [userId]
    );

    console.log(`Channels for user ${userId}:`, res.rows);

    for (const channel of res.rows) {
      const members = await pool.query(
        `SELECT cm.user_id, u.name, u.email, cm.role
         FROM public.channel_members cm
         JOIN public.users u ON u.id = cm.user_id
         WHERE cm.channel_id = $1`,
        [channel.channel_id]
      );
      console.log(`Members for channel ${channel.name || channel.channel_id}:`, members.rows);
    }
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

run();
