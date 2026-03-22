import { PoolClient } from 'pg';
import { BaseRepository } from './base.repository';
import { Comment, User } from '../types/entities';
import { CommentQueryOptions } from '../types/repository';

export class CommentRepository extends BaseRepository<Comment> {
  constructor() {
    super('comments');
  }

  /**
   * Find comments by task with pagination
   */
  async findByTask(
    taskId: string,
    options: CommentQueryOptions = {},
    client?: PoolClient
  ): Promise<Array<Comment & { user: User }>> {
    let query = `
      SELECT 
        c.*,
        jsonb_build_object(
          'id', u.id,
          'email', u.email,
          'name', u.name,
          'created_at', u.created_at
        ) as user
      FROM ${this.tableName} c
      INNER JOIN users u ON c.user_id = u.id
      WHERE c.task_id = $1
    `;

    const params: any[] = [taskId];
    let paramIndex = 2;

    // Soft delete filter
    if (!options.includeDeleted) {
      query += ` AND c.deleted_at IS NULL`;
    }

    query += ` ORDER BY c.created_at ASC`;

    // Apply pagination
    if (options.pagination) {
      query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(options.pagination.limit, options.pagination.offset);
    }

    const executor = client || this.pool;
    const result = await executor.query(query, params);

    return result.rows as Array<Comment & { user: User }>;
  }

  /**
   * Find comments with nested replies (threaded structure)
   */
  async findThreaded(taskId: string, client?: PoolClient): Promise<Array<Comment & { user: User; replies: Array<Comment & { user: User }> }>> {
    const query = `
      WITH top_level_comments AS (
        SELECT
          c.id, c.task_id, c.user_id, c.content, c.parent_comment_id, c.created_at, c.deleted_at,
          jsonb_build_object(
            'id', u.id,
            'email', u.email,
            'name', u.name,
            'created_at', u.created_at
          ) as user
        FROM ${this.tableName} c
        INNER JOIN users u ON c.user_id = u.id
        WHERE c.task_id = $1
        AND c.parent_comment_id IS NULL
        AND c.deleted_at IS NULL
      ),
      replies AS (
        SELECT
          c.id, c.task_id, c.user_id, c.content, c.parent_comment_id, c.created_at, c.deleted_at,
          jsonb_build_object(
            'id', u.id,
            'email', u.email,
            'name', u.name,
            'created_at', u.created_at
          ) as user
        FROM ${this.tableName} c
        INNER JOIN users u ON c.user_id = u.id
        WHERE c.task_id = $1
        AND c.parent_comment_id IS NOT NULL
        AND c.deleted_at IS NULL
      )
      SELECT
        tlc.id, tlc.task_id, tlc.user_id, tlc.content, tlc.parent_comment_id,
        tlc.created_at, tlc.deleted_at, tlc.user,
        COALESCE(
          json_agg(r.*) FILTER (WHERE r.id IS NOT NULL),
          '[]'
        ) as replies
      FROM top_level_comments tlc
      LEFT JOIN replies r ON tlc.id = r.parent_comment_id
      GROUP BY tlc.id, tlc.task_id, tlc.user_id, tlc.content, tlc.parent_comment_id,
               tlc.created_at, tlc.deleted_at, tlc.user
      ORDER BY tlc.created_at ASC
    `;

    const executor = client || this.pool;
    const result = await executor.query(query, [taskId]);

    return result.rows as Array<Comment & { user: User; replies: Array<Comment & { user: User }> }>;
  }

  /**
   * Find all replies to a comment
   */
  async findReplies(parentCommentId: string, client?: PoolClient): Promise<Array<Comment & { user: User }>> {
    const query = `
      SELECT 
        c.*,
        jsonb_build_object(
          'id', u.id,
          'email', u.email,
          'name', u.name,
          'created_at', u.created_at
        ) as user
      FROM ${this.tableName} c
      INNER JOIN users u ON c.user_id = u.id
      WHERE c.parent_comment_id = $1
      AND c.deleted_at IS NULL
      ORDER BY c.created_at ASC
    `;

    const executor = client || this.pool;
    const result = await executor.query(query, [parentCommentId]);

    return result.rows as Array<Comment & { user: User }>;
  }
  /**
   * Soft delete all comments for a task
   */
  async softDeleteByTaskId(taskId: string, client?: PoolClient): Promise<void> {
    const query = `
      UPDATE ${this.tableName}
      SET deleted_at = NOW()
      WHERE task_id = $1 AND deleted_at IS NULL
    `;

    const executor = client || this.pool;
    await executor.query(query, [taskId]);
  }
}
