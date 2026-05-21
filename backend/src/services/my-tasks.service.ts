import pool from "../config/pg";
import { TaskStatus, TaskPriority } from "../types/enums";

export interface MyTaskDTO {
  id: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  start_date: string | null;
  created_at: string;
  updated_at: string;
  org_id: string;
  org_name: string;
  space_id: string;
  space_name: string;
}

export interface MyTasksFilters {
  status?: TaskStatus;
  priority?: TaskPriority;
  org_id?: string;
}

const toISO = (val: Date | string | null | undefined): string | null => {
  if (!val) return null;
  return val instanceof Date ? val.toISOString() : (val as string);
};

export const getMyTasks = async (
  userId: string,
  filters: MyTasksFilters = {},
): Promise<MyTaskDTO[]> => {
  const queryStr = `
    SELECT
      t.id, t.title, t.status, t.priority,
      t.due_date, t.start_date, t.created_at, t.updated_at,
      o.id   AS org_id,   o.name   AS org_name,
      s.id   AS space_id, s.name   AS space_name
    FROM public.tasks t
    INNER JOIN public.task_assignees ta
      ON ta.task_id = t.id AND ta.user_id = $1
    INNER JOIN public.organisations o
      ON o.id = t.org_id AND o.deleted_at IS NULL
    INNER JOIN public.spaces s
      ON s.id = t.space_id AND s.deleted_at IS NULL
    INNER JOIN public.organisation_members om
      ON om.org_id = t.org_id AND om.user_id = $1
    WHERE t.deleted_at IS NULL
      AND ($2::task_status IS NULL OR t.status = $2)
      AND ($3::task_priority IS NULL OR t.priority = $3)
      AND ($4::uuid IS NULL OR t.org_id = $4)
    ORDER BY
      CASE WHEN t.due_date < NOW() THEN 0 ELSE 1 END ASC,
      t.due_date ASC NULLS LAST,
      t.created_at DESC
  `;

  const result = await pool.query(queryStr, [
    userId,
    filters.status || null,
    filters.priority || null,
    filters.org_id || null,
  ]);

  return result.rows.map((row) => ({
    id: row.id,
    title: row.title,
    status: row.status,
    priority: row.priority,
    due_date: toISO(row.due_date),
    start_date: toISO(row.start_date),
    created_at: toISO(row.created_at)!,
    updated_at: toISO(row.updated_at)!,
    org_id: row.org_id,
    org_name: row.org_name,
    space_id: row.space_id,
    space_name: row.space_name,
  }));
};
