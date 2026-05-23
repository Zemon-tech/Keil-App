const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const createChannel = async (
  workspaceId,
  orgId,
  spaceId,
  type,
  name,
  memberIds,
  creatorId,
) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    console.log("Creating channel in DB...");
    const channelResult = await client.query(
      `
        INSERT INTO public.channels (workspace_id, org_id, space_id, type, name)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id
      `,
      [workspaceId, orgId, spaceId, type, name],
    );

    const channelId = channelResult.rows[0].id;
    console.log("Channel created with ID:", channelId);

    for (const memberId of memberIds) {
      const role = type === "group" && memberId === creatorId ? "admin" : "member";
      console.log(`Inserting member ${memberId} with role ${role}`);
      await client.query(
        `
          INSERT INTO public.channel_members (channel_id, user_id, role)
          VALUES ($1, $2, $3)
          ON CONFLICT DO NOTHING
        `,
        [channelId, memberId, role],
      );
    }

    await client.query("COMMIT");
    return channelId;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

async function runTest() {
  try {
    // Let's get active org, space and users
    const spaceRes = await pool.query("SELECT id, org_id FROM public.spaces LIMIT 1");
    const userRes = await pool.query("SELECT id FROM public.users LIMIT 2");

    if (spaceRes.rows.length === 0 || userRes.rows.length === 0) {
      console.log("Not enough data in database to test.");
      return;
    }

    const orgId = spaceRes.rows[0].org_id;
    const spaceId = spaceRes.rows[0].id;
    const creatorId = userRes.rows[0].id;
    const otherUserId = userRes.rows[1] ? userRes.rows[1].id : creatorId;

    console.log(`Using Org: ${orgId}, Space: ${spaceId}, Creator: ${creatorId}, Other: ${otherUserId}`);

    const channelId = await createChannel(null, orgId, spaceId, "group", "Test Flow Group", [creatorId, otherUserId], creatorId);

    // Let's inspect roles
    const rolesRes = await pool.query("SELECT * FROM public.channel_members WHERE channel_id = $1", [channelId]);
    console.log("Inserted Roles:", rolesRes.rows);

    // Check deleteChannel controller logic
    console.log("Running delete role check...");
    const roleCheck = await pool.query(
      `
        SELECT cm.role, c.type
        FROM public.channel_members cm
        JOIN public.channels c ON c.id = cm.channel_id
        WHERE cm.channel_id = $1 AND cm.user_id = $2
      `,
      [channelId, creatorId],
    );
    console.log("Role check for creator:", roleCheck.rows);

    // Try deleting the channel
    console.log("Deleting channel...");
    const deleteRes = await pool.query("DELETE FROM public.channels WHERE id = $1", [channelId]);
    console.log("Delete result rowCount:", deleteRes.rowCount);

    // Check if cascaded
    const membersAfterDelete = await pool.query("SELECT * FROM public.channel_members WHERE channel_id = $1", [channelId]);
    console.log("Members left after delete:", membersAfterDelete.rows.length);

  } catch (err) {
    console.error("Test failed:", err);
  } finally {
    await pool.end();
  }
}

runTest();
