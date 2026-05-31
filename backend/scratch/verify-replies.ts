import pool from "../src/config/pg";
import { notificationRepository } from "../src/repositories";

async function verify() {
  console.log("Starting verification...");

  // Get first user, workspace, and space to avoid foreign key violations
  const userRes = await pool.query("SELECT id FROM public.users LIMIT 1");
  const workspaceRes = await pool.query("SELECT id FROM public.workspaces LIMIT 1");
  const spaceRes = await pool.query("SELECT id, org_id FROM public.spaces LIMIT 1");

  if (userRes.rows.length === 0 || workspaceRes.rows.length === 0 || spaceRes.rows.length === 0) {
    console.error("Please run database migrations and make sure you have at least one user, workspace, and space in the DB.");
    process.exit(1);
  }

  const userId = userRes.rows[0].id;
  const workspaceId = workspaceRes.rows[0].id;
  const spaceId = spaceRes.rows[0].id;
  const orgId = spaceRes.rows[0].org_id;

  // 1. Create a dummy task
  console.log("Creating dummy task...");
  const taskRes = await pool.query(
    `INSERT INTO public.tasks (workspace_id, space_id, org_id, title, status, priority, created_by)
     VALUES ($1, $2, $3, 'Verification Task', 'todo', 'medium', $4)
     RETURNING id`,
    [workspaceId, spaceId, orgId, userId]
  );
  const taskId = taskRes.rows[0].id;

  // 2. Create a notification payload for comment_created
  console.log("Creating comment notification...");
  const notifRes = await pool.query(
    `INSERT INTO public.notifications (workspace_id, org_id, space_id, recipient_id, sender_id, event_type, entity_type, entity_id, payload)
     VALUES ($1, $2, $3, $4, $4, 'comment_created', 'comment', $5, $6)
     RETURNING *`,
    [
      workspaceId,
      orgId,
      spaceId,
      userId,
      taskId,
      JSON.stringify({ sender_name: "Test Runner", comment_snippet: "Hello from verification script!" })
    ]
  );
  const notifId = notifRes.rows[0].id;

  try {
    // 3. Query using repository method
    console.log("Querying using findUnreadRepliesBySpace...");
    const replies = await notificationRepository.findUnreadRepliesBySpace(userId, spaceId);

    console.log("Query returned:", replies);

    // 4. Assert correctness
    const matchingReply = replies.find(r => r.id === notifId);
    if (!matchingReply) {
      throw new Error(`Test failed: Did not find notification ${notifId} in query results`);
    }

    // 'from' is populated from the users JOIN (real name/email), not payload
    if (!matchingReply.from || matchingReply.from.length === 0) {
      throw new Error(`Test failed: 'from' field is empty, expected a real user name/email`);
    }

    // 'message' must come from the comment_snippet in payload
    if (matchingReply.message !== "Hello from verification script!") {
      throw new Error(`Test failed: Expected message 'Hello from verification script!', got '${matchingReply.message}'`);
    }

    console.log(`✅ Verification successful!`);
    console.log(`   - Notification ID: ${matchingReply.id}`);
    console.log(`   - Sender (from DB user JOIN): '${matchingReply.from}'`);
    console.log(`   - Message (from payload): '${matchingReply.message}'`);
    console.log(`   Repository query works exactly as expected.`);
  } finally {
    // 5. Cleanup
    console.log("Cleaning up verification data...");
    await pool.query("DELETE FROM public.notifications WHERE id = $1", [notifId]);
    await pool.query("DELETE FROM public.tasks WHERE id = $1", [taskId]);
  }
}

verify()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error("❌ Verification failed with error:", err);
    process.exit(1);
  });
