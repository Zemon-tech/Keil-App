import { PoolClient } from 'pg';
import { BaseRepository } from './base.repository';
import { Task, User } from '../types/entities';
import { TaskStatus, TaskPriority } from '../types/enums';
import { TaskQueryOptions } from '../types/repository';

export class TaskRepository extends BaseRepository<Task> {
  constructor() {
    super('tasks');
  }

  /**
   * Find tasks by workspace with advanced filtering, sorting, and pagination
   */
  async findByWorkspace(
    workspaceId: string,
    options: TaskQueryOptions = {},
    client?: PoolClient
  ): Promise<Task[]> {
    let query = `SELECT * FROM ${this.tableName} WHERE workspace_id = $1`;
    const params: any[] = [workspaceId];
    let paramIndex = 2;

    // Soft delete filter
    if (!options.includeDeleted) {
      query += ` AND deleted_at IS NULL`;
    }

    // Apply filters
    if (options.filters) {
      const { status, priority, assigneeId, dueDateStart, dueDateEnd, parentTaskId, createdBy } = options.filters;

      if (status) {
        if (Array.isArray(status)) {
          query += ` AND status = ANY($${paramIndex})`;
          params.push(status);
        } else {
          query += ` AND status = $${paramIndex}`;
          params.push(status);
        }
        paramIndex++;
      }

      if (priority) {
        if (Array.isArray(priority)) {
          query += ` AND priority = ANY($${paramIndex})`;
          params.push(priority);
        } else {
          query += ` AND priority = $${paramIndex}`;
          params.push(priority);
        }
        paramIndex++;
      }

      if (assigneeId) {
        query += ` AND id IN (SELECT task_id FROM task_assignees WHERE user_id = $${paramIndex})`;
        params.push(assigneeId);
        paramIndex++;
      }

      if (dueDateStart) {
        query += ` AND due_date >= $${paramIndex}`;
        params.push(dueDateStart);
        paramIndex++;
      }

      if (dueDateEnd) {
        query += ` AND due_date <= $${paramIndex}`;
        params.push(dueDateEnd);
        paramIndex++;
      }

      if (parentTaskId !== undefined) {
        if (parentTaskId === null) {
          query += ` AND parent_task_id IS NULL`;
        } else {
          query += ` AND parent_task_id = $${paramIndex}`;
          params.push(parentTaskId);
          paramIndex++;
        }
      }

      if (createdBy) {
        query += ` AND created_by = $${paramIndex}`;
        params.push(createdBy);
        paramIndex++;
      }
    }

    // Apply sorting
    if (options.sort) {
      query += ` ORDER BY ${options.sort.field} ${options.sort.order}`;
    } else {
      query += ` ORDER BY created_at DESC`;
    }

    // Apply pagination
    if (options.pagination) {
      query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(options.pagination.limit, options.pagination.offset);
    }

    const executor = client || this.pool;
    const result = await executor.query(query, params);

    return result.rows as Task[];
  }

  /**
   * Find all subtasks of a parent task
   */
  async findSubtasks(parentTaskId: string, client?: PoolClient): Promise<Task[]> {
    const query = `
      SELECT * FROM ${this.tableName}
      WHERE parent_task_id = $1
      AND deleted_at IS NULL
      ORDER BY created_at ASC
    `;

    const executor = client || this.pool;
    const result = await executor.query(query, [parentTaskId]);

    return result.rows as Task[];
  }

  /**
   * Find task with assignee details
   */
  async findWithAssignees(taskId: string, client?: PoolClient): Promise<Task & { assignees: User[] } | null> {
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
      FROM ${this.tableName} t
      LEFT JOIN task_assignees ta ON t.id = ta.task_id
      LEFT JOIN users u ON ta.user_id = u.id
      WHERE t.id = $1
      AND t.deleted_at IS NULL
      GROUP BY t.id
    `;

    const executor = client || this.pool;
    const result = await executor.query(query, [taskId]);

    return result.rows.length > 0 ? (result.rows[0] as Task & { assignees: User[] }) : null;
  }

  /**
   * Find task with dependency details
   */
  async findWithDependencies(
    taskId: string,
    client?: PoolClient
  ): Promise<Task & { dependencies: Task[]; blockedTasks: Task[] } | null> {
    const query = `
      SELECT 
        t.*,
        COALESCE(
          json_agg(DISTINCT dep_task.*) FILTER (WHERE dep_task.id IS NOT NULL),
          '[]'
        ) as dependencies,
        COALESCE(
          json_agg(DISTINCT blocked_task.*) FILTER (WHERE blocked_task.id IS NOT NULL),
          '[]'
        ) as blocked_tasks
      FROM ${this.tableName} t
      LEFT JOIN task_dependencies td_dep ON t.id = td_dep.task_id
      LEFT JOIN tasks dep_task ON td_dep.depends_on_task_id = dep_task.id AND dep_task.deleted_at IS NULL
      LEFT JOIN task_dependencies td_blocked ON t.id = td_blocked.depends_on_task_id
      LEFT JOIN tasks blocked_task ON td_blocked.task_id = blocked_task.id AND blocked_task.deleted_at IS NULL
      WHERE t.id = $1
      AND t.deleted_at IS NULL
      GROUP BY t.id
    `;

    const executor = client || this.pool;
    const result = await executor.query(query, [taskId]);

    return result.rows.length > 0 ? (result.rows[0] as Task & { dependencies: Task[]; blockedTasks: Task[] }) : null;
  }

  /**
   * Find tasks assigned to a user
   */
  async findByAssignee(
    userId: string,
    workspaceId: string,
    client?: PoolClient
  ): Promise<Task[]> {
    const query = `
      SELECT t.*
      FROM ${this.tableName} t
      INNER JOIN task_assignees ta ON t.id = ta.task_id
      WHERE ta.user_id = $1
      AND t.workspace_id = $2
      AND t.deleted_at IS NULL
      ORDER BY t.created_at DESC
    `;

    const executor = client || this.pool;
    const result = await executor.query(query, [userId, workspaceId]);

    return result.rows as Task[];
  }

  /**
   * Find tasks due within a date range
   */
  async findByDueDate(
    workspaceId: string,
    startDate: Date,
    endDate: Date,
    client?: PoolClient
  ): Promise<Task[]> {
    const query = `
      SELECT * FROM ${this.tableName}
      WHERE workspace_id = $1
      AND due_date >= $2
      AND due_date <= $3
      AND deleted_at IS NULL
      ORDER BY due_date ASC
    `;

    const executor = client || this.pool;
    const result = await executor.query(query, [workspaceId, startDate, endDate]);

    return result.rows as Task[];
  }

  /**
   * Update task status
   */
  async updateStatus(
    taskId: string,
    newStatus: TaskStatus,
    client?: PoolClient
  ): Promise<Task | null> {
    const query = `
      UPDATE ${this.tableName}
      SET status = $2, updated_at = NOW()
      WHERE id = $1
      AND deleted_at IS NULL
      RETURNING *
    `;

    const executor = client || this.pool;
    const result = await executor.query(query, [taskId, newStatus]);

    return result.rows.length > 0 ? (result.rows[0] as Task) : null;
  }

  /**
   * Dashboard: Find urgent tasks near due date
   */
  async findUrgentAndNearDue(
    workspaceId: string,
    hoursThreshold: number = 48,
    client?: PoolClient
  ): Promise<Task[]> {
    const query = `
      SELECT * FROM ${this.tableName}
      WHERE workspace_id = $1
      AND priority = $2
      AND due_date IS NOT NULL
      AND due_date <= NOW() + INTERVAL '${hoursThreshold} hours'
      AND status != $3
      AND deleted_at IS NULL
      ORDER BY due_date ASC
    `;

    const executor = client || this.pool;
    const result = await executor.query(query, [workspaceId, TaskPriority.URGENT, TaskStatus.DONE]);

    return result.rows as Task[];
  }

  /**
   * Dashboard: Find tasks due today
   */
  async findDueToday(workspaceId: string, client?: PoolClient): Promise<Task[]> {
    const query = `
      SELECT * FROM ${this.tableName}
      WHERE workspace_id = $1
      AND due_date::date = CURRENT_DATE
      AND status != $2
      AND deleted_at IS NULL
      ORDER BY priority DESC, due_date ASC
    `;

    const executor = client || this.pool;
    const result = await executor.query(query, [workspaceId, TaskStatus.DONE]);

    return result.rows as Task[];
  }

  /**
   * Dashboard: Find blocked tasks (tasks with incomplete dependencies)
   */
  async findBlocked(workspaceId: string, client?: PoolClient): Promise<Task[]> {
    const query = `
      SELECT DISTINCT t.*
      FROM ${this.tableName} t
      INNER JOIN task_dependencies td ON t.id = td.task_id
      INNER JOIN tasks dep ON td.depends_on_task_id = dep.id
      WHERE t.workspace_id = $1
      AND dep.status != $2
      AND t.status != $2
      AND t.deleted_at IS NULL
      AND dep.deleted_at IS NULL
      ORDER BY t.created_at DESC
    `;

    const executor = client || this.pool;
    const result = await executor.query(query, [workspaceId, TaskStatus.DONE]);

    return result.rows as Task[];
  }

  /**
   * Dashboard: Find backlog tasks
   */
  async findBacklog(workspaceId: string, client?: PoolClient): Promise<Task[]> {
    const query = `
      SELECT * FROM ${this.tableName}
      WHERE workspace_id = $1
      AND status = $2
      AND deleted_at IS NULL
      ORDER BY priority DESC, created_at DESC
    `;

    const executor = client || this.pool;
    const result = await executor.query(query, [workspaceId, TaskStatus.BACKLOG]);

    return result.rows as Task[];
  }
}
