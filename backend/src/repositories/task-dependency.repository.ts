import { PoolClient } from 'pg';
import { BaseRepository } from './base.repository';
import { TaskDependency, Task } from '../types/entities';
import { TaskStatus } from '../types/enums';

export class TaskDependencyRepository extends BaseRepository<TaskDependency> {
  constructor() {
    super('task_dependencies');
  }

  /**
   * Add a dependency (taskId depends on dependsOnTaskId)
   */
  async addDependency(
    taskId: string,
    dependsOnTaskId: string,
    client?: PoolClient
  ): Promise<TaskDependency> {
    const query = `
      INSERT INTO ${this.tableName} (task_id, depends_on_task_id)
      VALUES ($1, $2)
      ON CONFLICT (task_id, depends_on_task_id) DO NOTHING
      RETURNING *
    `;

    const executor = client || this.pool;
    const result = await executor.query(query, [taskId, dependsOnTaskId]);

    return result.rows[0] as TaskDependency;
  }

  /**
   * Remove a dependency
   */
  async removeDependency(
    taskId: string,
    dependsOnTaskId: string,
    client?: PoolClient
  ): Promise<void> {
    const query = `
      DELETE FROM ${this.tableName}
      WHERE task_id = $1 AND depends_on_task_id = $2
    `;

    const executor = client || this.pool;
    await executor.query(query, [taskId, dependsOnTaskId]);
  }

  /**
   * Find all tasks that this task depends on
   */
  async findDependencies(taskId: string, client?: PoolClient): Promise<Task[]> {
    const query = `
      SELECT t.*
      FROM tasks t
      INNER JOIN ${this.tableName} td ON t.id = td.depends_on_task_id
      WHERE td.task_id = $1
      AND t.deleted_at IS NULL
      ORDER BY td.created_at ASC
    `;

    const executor = client || this.pool;
    const result = await executor.query(query, [taskId]);

    return result.rows as Task[];
  }

  /**
   * Find all tasks that are blocked by this task
   */
  async findBlockedTasks(taskId: string, client?: PoolClient): Promise<Task[]> {
    const query = `
      SELECT t.*
      FROM tasks t
      INNER JOIN ${this.tableName} td ON t.id = td.task_id
      WHERE td.depends_on_task_id = $1
      AND t.deleted_at IS NULL
      ORDER BY td.created_at ASC
    `;

    const executor = client || this.pool;
    const result = await executor.query(query, [taskId]);

    return result.rows as Task[];
  }

  /**
   * Check if all dependencies for a task are complete
   * Returns true if task can be marked as done
   */
  async checkAllDependenciesComplete(taskId: string, client?: PoolClient): Promise<boolean> {
    const query = `
      SELECT COUNT(*) as incomplete_count
      FROM ${this.tableName} td
      INNER JOIN tasks t ON td.depends_on_task_id = t.id
      WHERE td.task_id = $1
      AND t.status != $2
      AND t.deleted_at IS NULL
    `;

    const executor = client || this.pool;
    const result = await executor.query(query, [taskId, TaskStatus.DONE]);

    return parseInt(result.rows[0].incomplete_count, 10) === 0;
  }

  /**
   * Check if adding a dependency would create a circular dependency
   * Returns true if circular dependency would be created
   */
  async hasCircularDependency(
    taskId: string,
    dependsOnTaskId: string,
    client?: PoolClient
  ): Promise<boolean> {
    // Check if dependsOnTaskId depends on taskId (directly or indirectly)
    const query = `
      WITH RECURSIVE dependency_chain AS (
        -- Base case: direct dependencies of dependsOnTaskId
        SELECT task_id, depends_on_task_id
        FROM ${this.tableName}
        WHERE task_id = $1
        
        UNION
        
        -- Recursive case: follow the chain
        SELECT td.task_id, td.depends_on_task_id
        FROM ${this.tableName} td
        INNER JOIN dependency_chain dc ON td.task_id = dc.depends_on_task_id
      )
      SELECT 1
      FROM dependency_chain
      WHERE depends_on_task_id = $2
      LIMIT 1
    `;

    const executor = client || this.pool;
    const result = await executor.query(query, [dependsOnTaskId, taskId]);

    return result.rows.length > 0;
  }
}
