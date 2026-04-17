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
   * Find comments with nested replies (threaded structure, unlimited depth)
   * Uses a recursive CTE to fetch all descendants, then builds the tree in JS.
   */
  async findThreaded(taskId: string, client?: PoolClient): Promise<Array<Comment & { user: User; replies: Array<Comment & { user: User }> }>> {
    // Fetch ALL non-deleted comments for the task (flat), then build tree in JS
    const query = `
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
        AND c.deleted_at IS NULL
      ORDER BY c.created_at ASC
    `;

    const executor = client || this.pool;
    const result = await executor.query(query, [taskId]);
    const rows = result.rows as Array<Comment & { user: User }>;

    // Build tree: map id → node, then attach children to parents
    type TreeNode = Comment & { user: User; replies: Array<Comment & { user: User }> };
    const nodeMap = new Map<string, TreeNode>();
    const roots: TreeNode[] = [];

    for (const row of rows) {
      nodeMap.set(row.id, { ...row, replies: [] });
    }

    for (const row of rows) {
      const node = nodeMap.get(row.id)!;
      if (row.parent_comment_id) {
        const parent = nodeMap.get(row.parent_comment_id);
        if (parent) {
          parent.replies.push(node);
        } else {
          // Parent was deleted or not found — treat as root
          roots.push(node);
        }
      } else {
        roots.push(node);
      }
    }

    return roots;
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
