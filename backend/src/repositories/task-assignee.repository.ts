import { PoolClient } from 'pg';
import { BaseRepository } from './base.repository';
import { TaskAssignee, User } from '../types/entities';

export class TaskAssigneeRepository extends BaseRepository<TaskAssignee> {
  constructor() {
    super('task_assignees');
  }

  /**
   * Assign a user to a task
   */
  async assign(taskId: string, userId: string, client?: PoolClient): Promise<TaskAssignee> {
    const query = `
      INSERT INTO ${this.tableName} (task_id, user_id)
      VALUES ($1, $2)
      ON CONFLICT (task_id, user_id) DO NOTHING
      RETURNING *
    `;

    const executor = client || this.pool;
    const result = await executor.query(query, [taskId, userId]);

    return result.rows[0] as TaskAssignee;
  }

  /**
   * Remove a user assignment from a task
   */
  async unassign(taskId: string, userId: string, client?: PoolClient): Promise<void> {
    const query = `
      DELETE FROM ${this.tableName}
      WHERE task_id = $1 AND user_id = $2
    `;

    const executor = client || this.pool;
    await executor.query(query, [taskId, userId]);
  }

  /**
   * Find all assignees for a task
   */
  async findByTask(taskId: string, client?: PoolClient): Promise<Array<TaskAssignee & { user: User }>> {
    const query = `
      SELECT 
        ta.*,
        json_build_object(
          'id', u.id,
          'email', u.email,
          'name', u.name,
          'created_at', u.created_at
        ) as user
      FROM ${this.tableName} ta
      INNER JOIN users u ON ta.user_id = u.id
      WHERE ta.task_id = $1
      ORDER BY ta.assigned_at ASC
    `;

    const executor = client || this.pool;
    const result = await executor.query(query, [taskId]);

    return result.rows as Array<TaskAssignee & { user: User }>;
  }

  /**
   * Find all task assignments for a user in a workspace
   */
  async findByUser(userId: string, workspaceId: string, client?: PoolClient): Promise<TaskAssignee[]> {
    const query = `
      SELECT ta.*
      FROM ${this.tableName} ta
      INNER JOIN tasks t ON ta.task_id = t.id
      WHERE ta.user_id = $1
      AND t.workspace_id = $2
      AND t.deleted_at IS NULL
      ORDER BY ta.assigned_at DESC
    `;

    const executor = client || this.pool;
    const result = await executor.query(query, [userId, workspaceId]);

    return result.rows as TaskAssignee[];
  }

  /**
   * Check if a user is assigned to a task
   */
  async isAssigned(taskId: string, userId: string, client?: PoolClient): Promise<boolean> {
    const query = `
      SELECT 1 FROM ${this.tableName}
      WHERE task_id = $1 AND user_id = $2
      LIMIT 1
    `;

    const executor = client || this.pool;
    const result = await executor.query(query, [taskId, userId]);

    return result.rows.length > 0;
  }
}
