import { PoolClient } from "pg";
import { BaseRepository } from "./base.repository";
import { Task, User } from "../types/entities";
import { TaskPriority, TaskStatus } from "../types/enums";
import { TaskQueryOptions } from "../types/repository";

export class OrgTaskRepository extends BaseRepository<Task> {
  constructor() {
    super("tasks");
  }

  async findBySpace(
    orgId: string,
    spaceId: string,
    options: TaskQueryOptions = {},
    client?: PoolClient,
  ): Promise<Task[]> {
    let query = `
      SELECT
        t.*,
        (
          SELECT COUNT(*)
          FROM public.tasks s
          WHERE s.parent_task_id = t.id
            AND s.deleted_at IS NULL
        ) as subtask_count
      FROM public.tasks t
      WHERE t.org_id = $1
        AND t.space_id = $2
        AND t.deleted_at IS NULL
    `;
    const params: Array<string | number | Date | string[]> = [orgId, spaceId];
    let paramIndex = 3;

    if (options.filters?.status) {
      query += ` AND t.status = $${paramIndex}`;
      params.push(options.filters.status);
      paramIndex++;
    }

    if (options.filters?.priority) {
      query += ` AND t.priority = $${paramIndex}`;
      params.push(options.filters.priority);
      paramIndex++;
    }

    if (options.filters?.assigneeId) {
      query += ` AND t.id IN (
        SELECT task_id FROM public.task_assignees WHERE user_id = $${paramIndex}
      )`;
      params.push(options.filters.assigneeId);
      paramIndex++;
    }

    if (options.filters?.dueDateStart) {
      query += ` AND t.due_date >= $${paramIndex}`;
      params.push(options.filters.dueDateStart);
      paramIndex++;
    }

    if (options.filters?.dueDateEnd) {
      query += ` AND t.due_date <= $${paramIndex}`;
      params.push(options.filters.dueDateEnd);
      paramIndex++;
    }

    if (options.filters?.parentTaskId !== undefined) {
      if (options.filters.parentTaskId === null) {
        query += ` AND t.parent_task_id IS NULL`;
      } else {
        query += ` AND t.parent_task_id = $${paramIndex}`;
        params.push(options.filters.parentTaskId);
        paramIndex++;
      }
    }

    if (options.sort) {
      query += ` ORDER BY ${options.sort.field} ${options.sort.order}`;
    } else {
      query += ` ORDER BY t.created_at DESC`;
    }

    if (options.pagination) {
      query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(options.pagination.limit, options.pagination.offset);
    }

    const executor = client || this.pool;
    const result = await executor.query(query, params);
    return result.rows as Task[];
  }

  async findWithAssignees(taskId: string, client?: PoolClient): Promise<(Task & { assignees: User[] }) | null> {
    const query = `
      SELECT
        t.*,
        COALESCE(
          json_agg(
            json_build_object(
              'id', u.id,
              'email', u.email,
              'name', u.name,
              'created_at', u.created_at
            )
          ) FILTER (WHERE u.id IS NOT NULL),
          '[]'
        ) as assignees
      FROM public.tasks t
      LEFT JOIN public.task_assignees ta
        ON ta.task_id = t.id
      LEFT JOIN public.users u
        ON u.id = ta.user_id
      WHERE t.id = $1
        AND t.deleted_at IS NULL
      GROUP BY t.id
    `;

    const executor = client || this.pool;
    const result = await executor.query(query, [taskId]);
    return result.rows[0] as (Task & { assignees: User[] }) | undefined ?? null;
  }

  async findWithDependencies(taskId: string, client?: PoolClient): Promise<(Task & { dependencies: Task[] }) | null> {
    const query = `
      SELECT
        t.*,
        COALESCE(
          json_agg(DISTINCT dep_task.*) FILTER (WHERE dep_task.id IS NOT NULL),
          '[]'
        ) as dependencies
      FROM public.tasks t
      LEFT JOIN public.task_dependencies td
        ON td.task_id = t.id
      LEFT JOIN public.tasks dep_task
        ON dep_task.id = td.depends_on_task_id
       AND dep_task.deleted_at IS NULL
      WHERE t.id = $1
        AND t.deleted_at IS NULL
      GROUP BY t.id
    `;

    const executor = client || this.pool;
    const result = await executor.query(query, [taskId]);
    return result.rows[0] as (Task & { dependencies: Task[] }) | undefined ?? null;
  }

  async findSubtasks(taskId: string, client?: PoolClient): Promise<Task[]> {
    const query = `
      SELECT *
      FROM public.tasks
      WHERE parent_task_id = $1
        AND deleted_at IS NULL
      ORDER BY created_at ASC
    `;
    const executor = client || this.pool;
    const result = await executor.query(query, [taskId]);
    return result.rows as Task[];
  }

  async updateStatus(taskId: string, status: TaskStatus, client?: PoolClient): Promise<Task | null> {
    const query = `
      UPDATE public.tasks
      SET status = $2, updated_at = NOW()
      WHERE id = $1
        AND deleted_at IS NULL
      RETURNING *
    `;
    const executor = client || this.pool;
    const result = await executor.query(query, [taskId, status]);
    return result.rows.length > 0 ? (result.rows[0] as Task) : null;
  }

  async findUrgentAndNearDue(orgId: string, spaceId: string, hoursThreshold: number, client?: PoolClient): Promise<Task[]> {
    const query = `
      SELECT *
      FROM public.tasks
      WHERE org_id = $1
        AND space_id = $2
        AND priority = $3
        AND due_date IS NOT NULL
        AND due_date <= NOW() + INTERVAL '${hoursThreshold} hours'
        AND status != $4
        AND deleted_at IS NULL
      ORDER BY due_date ASC
    `;
    const executor = client || this.pool;
    const result = await executor.query(query, [orgId, spaceId, TaskPriority.URGENT, TaskStatus.DONE]);
    return result.rows as Task[];
  }

  async findDueToday(orgId: string, spaceId: string, client?: PoolClient): Promise<Task[]> {
    const query = `
      SELECT *
      FROM public.tasks
      WHERE org_id = $1
        AND space_id = $2
        AND due_date::date = CURRENT_DATE
        AND status != $3
        AND deleted_at IS NULL
      ORDER BY priority DESC, due_date ASC
    `;
    const executor = client || this.pool;
    const result = await executor.query(query, [orgId, spaceId, TaskStatus.DONE]);
    return result.rows as Task[];
  }

  async findBlocked(orgId: string, spaceId: string, client?: PoolClient): Promise<Task[]> {
    const query = `
      SELECT DISTINCT t.*
      FROM public.tasks t
      INNER JOIN public.task_dependencies td
        ON td.task_id = t.id
      INNER JOIN public.tasks dep
        ON dep.id = td.depends_on_task_id
      WHERE t.org_id = $1
        AND t.space_id = $2
        AND dep.status != $3
        AND t.status != $3
        AND t.deleted_at IS NULL
        AND dep.deleted_at IS NULL
      ORDER BY t.created_at DESC
    `;
    const executor = client || this.pool;
    const result = await executor.query(query, [orgId, spaceId, TaskStatus.DONE]);
    return result.rows as Task[];
  }

  async findBacklog(orgId: string, spaceId: string, client?: PoolClient): Promise<Task[]> {
    const query = `
      SELECT *
      FROM public.tasks
      WHERE org_id = $1
        AND space_id = $2
        AND status = $3
        AND deleted_at IS NULL
      ORDER BY priority DESC, created_at DESC
    `;
    const executor = client || this.pool;
    const result = await executor.query(query, [orgId, spaceId, TaskStatus.BACKLOG]);
    return result.rows as Task[];
  }
}
