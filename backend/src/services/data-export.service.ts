import pool from "../config/pg";
import logger from "../lib/logger";

/**
 * Data Export Service
 *
 * Generates a JSON export of all user data for download.
 * Used when accounts are locked to allow users to take their data.
 *
 * Exports:
 * - Personal tasks (from personal org)
 * - Assigned org tasks (across all orgs)
 * - Motion pages created by the user
 * - Calendar events (tasks with type='event')
 * - Chat messages sent by the user
 */

export interface ExportData {
  exported_at: string;
  user: {
    id: string;
    email: string;
    name: string | null;
  };
  tasks: ExportTask[];
  events: ExportEvent[];
  pages: ExportPage[];
  messages: ExportMessage[];
}

interface ExportTask {
  id: string;
  title: string;
  description: string | null;
  objective: string | null;
  success_criteria: string | null;
  status: string;
  priority: string;
  start_date: string | null;
  due_date: string | null;
  org_name: string | null;
  space_name: string | null;
  created_at: string;
}

interface ExportEvent {
  id: string;
  title: string;
  description: string | null;
  status: string;
  start_date: string | null;
  due_date: string | null;
  location: string | null;
  is_all_day: boolean;
  org_name: string | null;
  created_at: string;
}

interface ExportPage {
  id: string;
  title: string;
  content: any;
  org_name: string | null;
  space_name: string | null;
  created_at: string;
  updated_at: string;
}

interface ExportMessage {
  id: string;
  content: string;
  channel_name: string | null;
  org_name: string | null;
  created_at: string;
}

/**
 * Generate a full data export for a user.
 */
export async function generateUserExport(userId: string): Promise<ExportData> {
  const startTime = Date.now();

  // Fetch user info
  const userResult = await pool.query(
    `SELECT id, email, name FROM public.users WHERE id = $1`,
    [userId]
  );
  const user = userResult.rows[0];
  if (!user) {
    throw new Error("User not found");
  }

  // Run all queries in parallel for speed
  const [tasks, events, pages, messages] = await Promise.all([
    exportTasks(userId),
    exportEvents(userId),
    exportPages(userId),
    exportMessages(userId),
  ]);

  const duration = Date.now() - startTime;
  logger.info(
    { userId, tasks: tasks.length, events: events.length, pages: pages.length, messages: messages.length, durationMs: duration },
    "Data export generated"
  );

  return {
    exported_at: new Date().toISOString(),
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
    },
    tasks,
    events,
    pages,
    messages,
  };
}

async function exportTasks(userId: string): Promise<ExportTask[]> {
  const result = await pool.query(
    `SELECT
       t.id, t.title, t.description, t.objective, t.success_criteria,
       t.status, t.priority, t.start_date, t.due_date, t.created_at,
       o.name as org_name, s.name as space_name
     FROM public.tasks t
     LEFT JOIN public.organisations o ON o.id = t.org_id
     LEFT JOIN public.spaces s ON s.id = t.space_id
     WHERE t.type = 'task'
       AND t.deleted_at IS NULL
       AND (
         t.created_by = $1
         OR t.id IN (SELECT task_id FROM public.task_assignees WHERE user_id = $1)
       )
     ORDER BY t.created_at DESC
     LIMIT 10000`,
    [userId]
  );

  return result.rows.map((r) => ({
    id: r.id,
    title: r.title,
    description: r.description,
    objective: r.objective,
    success_criteria: r.success_criteria,
    status: r.status,
    priority: r.priority,
    start_date: r.start_date ? new Date(r.start_date).toISOString() : null,
    due_date: r.due_date ? new Date(r.due_date).toISOString() : null,
    org_name: r.org_name,
    space_name: r.space_name,
    created_at: new Date(r.created_at).toISOString(),
  }));
}

async function exportEvents(userId: string): Promise<ExportEvent[]> {
  const result = await pool.query(
    `SELECT
       t.id, t.title, t.description, t.status, t.start_date, t.due_date,
       t.location, t.is_all_day, t.created_at,
       o.name as org_name
     FROM public.tasks t
     LEFT JOIN public.organisations o ON o.id = t.org_id
     WHERE t.type = 'event'
       AND t.deleted_at IS NULL
       AND (
         t.created_by = $1
         OR t.id IN (SELECT task_id FROM public.task_assignees WHERE user_id = $1)
       )
     ORDER BY t.start_date DESC NULLS LAST
     LIMIT 5000`,
    [userId]
  );

  return result.rows.map((r) => ({
    id: r.id,
    title: r.title,
    description: r.description,
    status: r.status,
    start_date: r.start_date ? new Date(r.start_date).toISOString() : null,
    due_date: r.due_date ? new Date(r.due_date).toISOString() : null,
    location: r.location,
    is_all_day: r.is_all_day,
    org_name: r.org_name,
    created_at: new Date(r.created_at).toISOString(),
  }));
}

async function exportPages(userId: string): Promise<ExportPage[]> {
  const result = await pool.query(
    `SELECT
       mp.id, mp.title, mp.content, mp.created_at, mp.updated_at,
       o.name as org_name, s.name as space_name
     FROM public.motion_pages mp
     LEFT JOIN public.organisations o ON o.id = mp.org_id
     LEFT JOIN public.spaces s ON s.id = mp.space_id
     WHERE mp.created_by = $1
       AND mp.deleted_at IS NULL
     ORDER BY mp.updated_at DESC
     LIMIT 5000`,
    [userId]
  );

  return result.rows.map((r) => ({
    id: r.id,
    title: r.title,
    content: r.content,
    org_name: r.org_name,
    space_name: r.space_name,
    created_at: new Date(r.created_at).toISOString(),
    updated_at: new Date(r.updated_at).toISOString(),
  }));
}

async function exportMessages(userId: string): Promise<ExportMessage[]> {
  const result = await pool.query(
    `SELECT
       m.id, m.content, m.created_at,
       c.name as channel_name,
       o.name as org_name
     FROM public.messages m
     LEFT JOIN public.channels c ON c.id = m.channel_id
     LEFT JOIN public.organisations o ON o.id = c.org_id
     WHERE m.sender_id = $1
     ORDER BY m.created_at DESC
     LIMIT 10000`,
    [userId]
  );

  return result.rows.map((r) => ({
    id: r.id,
    content: r.content,
    channel_name: r.channel_name,
    org_name: r.org_name,
    created_at: new Date(r.created_at).toISOString(),
  }));
}
