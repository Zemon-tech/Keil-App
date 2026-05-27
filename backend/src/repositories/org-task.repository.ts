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
    const params: any[] = [orgId, spaceId];

    const isMirror = !!options.filters?.mirror && !!options.filters?.userId;
    const userId = options.filters?.userId;

    let userIdParamIndex = 0;
    if (userId) {
      params.push(userId);
      userIdParamIndex = params.length;
    }

    let query = `
      SELECT
        t.*,
        o.name as org_name,
        s.name as space_name,
        (
          SELECT COUNT(*)
          FROM public.tasks s
          WHERE s.parent_task_id = t.id
            AND s.deleted_at IS NULL
        ) as subtask_count,
        ${userId ? `COALESCE(sm.role, 'member')` : `'member'`} as user_space_role
      FROM public.tasks t
      LEFT JOIN public.organisations o ON o.id = t.org_id
      LEFT JOIN public.spaces s ON s.id = t.space_id
      ${userId ? `LEFT JOIN public.space_members sm ON sm.space_id = t.space_id AND sm.user_id = $${userIdParamIndex}` : ''}
      WHERE t.deleted_at IS NULL
    `;

    if (isMirror) {
      query += `
        AND (
          (t.org_id = $1 AND t.space_id = $2)
          OR
          (
            t.space_id != $2
            AND t.id IN (
              SELECT task_id FROM public.task_assignees WHERE user_id = $${userIdParamIndex}
            )
            AND EXISTS (
              SELECT 1 FROM public.space_members sm2
              WHERE sm2.space_id = t.space_id AND sm2.user_id = $${userIdParamIndex}
            )
          )
        )
      `;
    } else {
      query += ` AND t.org_id = $1 AND t.space_id = $2`;
    }

    if (options.filters?.orgFilter) {
      params.push(options.filters.orgFilter);
      query += ` AND t.org_id = $${params.length}`;
    }

    if (options.filters?.spaceFilter) {
      params.push(options.filters.spaceFilter);
      query += ` AND t.space_id = $${params.length}`;
    }

    if (options.filters?.status) {
      params.push(options.filters.status);
      query += ` AND t.status = $${params.length}`;
    }

    if (options.filters?.priority) {
      params.push(options.filters.priority);
      query += ` AND t.priority = $${params.length}`;
    }

    if (options.filters?.assigneeId) {
      params.push(options.filters.assigneeId);
      query += ` AND t.id IN (
        SELECT task_id FROM public.task_assignees WHERE user_id = $${params.length}
      )`;
    }

    if (options.filters?.dueDateStart) {
      params.push(options.filters.dueDateStart);
      query += ` AND t.due_date >= $${params.length}`;
    }

    if (options.filters?.dueDateEnd) {
      params.push(options.filters.dueDateEnd);
      query += ` AND t.due_date <= $${params.length}`;
    }

    if (options.filters?.parentTaskId !== undefined) {
      if (options.filters.parentTaskId === null) {
        query += ` AND t.parent_task_id IS NULL`;
      } else {
        params.push(options.filters.parentTaskId);
        query += ` AND t.parent_task_id = $${params.length}`;
      }
    }

    if (options.sort) {
      query += ` ORDER BY ${options.sort.field} ${options.sort.order}`;
    } else {
      query += ` ORDER BY t.created_at DESC`;
    }

    if (options.pagination) {
      params.push(options.pagination.limit, options.pagination.offset);
      query += ` LIMIT $${params.length - 1} OFFSET $${params.length}`;
    }

    const executor = client || this.pool;
    const result = await executor.query(query, params);
    return result.rows as Task[];
  }

  async findWithAssignees(taskId: string, client?: PoolClient): Promise<(Task & { assignees: User[]; creator_name?: string | null; creator_email?: string | null }) | null> {
    const query = `
      SELECT
        t.*,
        creator.name as creator_name,
        creator.email as creator_email,
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
      LEFT JOIN public.users creator
        ON creator.id = t.created_by
      LEFT JOIN public.task_assignees ta
        ON ta.task_id = t.id
      LEFT JOIN public.users u
        ON u.id = ta.user_id
      WHERE t.id = $1
        AND t.deleted_at IS NULL
      GROUP BY t.id, creator.name, creator.email
    `;

    const executor = client || this.pool;
    const result = await executor.query(query, [taskId]);
    return result.rows[0] as (Task & { assignees: User[]; creator_name?: string | null; creator_email?: string | null }) | undefined ?? null;
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
