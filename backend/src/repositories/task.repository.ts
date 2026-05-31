import { PoolClient } from 'pg';
import { BaseRepository } from './base.repository';
import { Task, User } from '../types/entities';
import { TaskStatus } from '../types/enums';

export class TaskRepository extends BaseRepository<Task> {
  constructor() {
    super('tasks');
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
}
