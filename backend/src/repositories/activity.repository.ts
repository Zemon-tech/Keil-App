import { PoolClient } from "pg";
import { BaseRepository } from "./base.repository";
import { ActivityLog, User } from "../types/entities";
import { LogEntityType, LogActionType } from "../types/enums";
import { ActivityQueryOptions } from "../types/repository";

export class ActivityRepository extends BaseRepository<ActivityLog> {
  constructor() {
    super("activity_logs");
  }

  /**
   * Log an activity (append-only, no updates)
   */
  async log(
    data: {
      workspace_id: string;
      user_id: string | null;
      entity_type: LogEntityType;
      entity_id: string;
      action_type: LogActionType;
      old_value?: Record<string, any> | null;
      new_value?: Record<string, any> | null;
    },
    client?: PoolClient,
  ): Promise<ActivityLog> {
    const query = `
      INSERT INTO ${this.tableName}
        (workspace_id, user_id, entity_type, entity_id, action_type, old_value, new_value)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;

    const executor = client || this.pool;
    const result = await executor.query(query, [
      data.workspace_id,
      data.user_id,
      data.entity_type,
      data.entity_id,
      data.action_type,
      data.old_value ? JSON.stringify(data.old_value) : null,
      data.new_value ? JSON.stringify(data.new_value) : null,
    ]);

    return result.rows[0] as ActivityLog;
  }

  /**
   * Find activity logs by workspace with pagination
   */
  async findByWorkspace(
    workspaceId: string,
    options: ActivityQueryOptions = {},
    client?: PoolClient,
  ): Promise<Array<ActivityLog & { user: User | null }>> {
    let query = `
      SELECT
        al.*,
        CASE
          WHEN u.id IS NOT NULL THEN json_build_object(
            'id', u.id,
            'email', u.email,
            'name', u.name,
            'created_at', u.created_at
          )
          ELSE NULL
        END as user
      FROM ${this.tableName} al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE al.workspace_id = $1
    `;

    const params: any[] = [workspaceId];
    let paramIndex = 2;

    // Apply filters
    if (options.entityType) {
      query += ` AND al.entity_type = $${paramIndex}`;
      params.push(options.entityType);
      paramIndex++;
    }

    if (options.entityId) {
      query += ` AND al.entity_id = $${paramIndex}`;
      params.push(options.entityId);
      paramIndex++;
    }

    if (options.userId) {
      query += ` AND al.user_id = $${paramIndex}`;
      params.push(options.userId);
      paramIndex++;
    }

    query += ` ORDER BY al.created_at DESC`;

    // Apply pagination
    if (options.pagination) {
      query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(options.pagination.limit, options.pagination.offset);
    }

    const executor = client || this.pool;
    const result = await executor.query(query, params);

    return result.rows as Array<ActivityLog & { user: User | null }>;
  }

  /**
   * Find activity logs for a specific entity
   */
  async findByEntity(
    workspaceId: string,
    entityType: LogEntityType,
    entityId: string,
    client?: PoolClient,
  ): Promise<Array<ActivityLog & { user: User | null }>> {
    const query = `
      SELECT
        al.*,
        CASE
          WHEN u.id IS NOT NULL THEN json_build_object(
            'id', u.id,
            'email', u.email,
            'name', u.name,
            'created_at', u.created_at
          )
          ELSE NULL
        END as user
      FROM ${this.tableName} al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE al.workspace_id = $1
      AND al.entity_type = $2
      AND al.entity_id = $3
      ORDER BY al.created_at DESC
    `;

    const executor = client || this.pool;
    const result = await executor.query(query, [
      workspaceId,
      entityType,
      entityId,
    ]);

    return result.rows as Array<ActivityLog & { user: User | null }>;
  }

  /**
   * Find the full task timeline, including comment events attached to the task.
   */
  async findTaskHistory(
    workspaceId: string,
    taskId: string,
    client?: PoolClient,
  ): Promise<Array<ActivityLog & { user: User | null }>> {
    const query = `
      SELECT
        al.*,
        CASE
          WHEN u.id IS NOT NULL THEN json_build_object(
            'id', u.id,
            'email', u.email,
            'name', u.name,
            'created_at', u.created_at
          )
          ELSE NULL
        END as user
      FROM ${this.tableName} al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE al.workspace_id = $1
      AND (
        (al.entity_type = 'task' AND al.entity_id = $2::uuid)
        OR (
          al.entity_type = 'comment'
          AND COALESCE(al.new_value->>'task_id', al.old_value->>'task_id') = $3
        )
      )
      ORDER BY al.created_at DESC
    `;

    const executor = client || this.pool;
    const result = await executor.query(query, [workspaceId, taskId, taskId]);

    return result.rows as Array<ActivityLog & { user: User | null }>;
  }

  /**
   * Find activity logs by user in a workspace
   */
  async findByUser(
    userId: string,
    workspaceId: string,
    client?: PoolClient,
  ): Promise<Array<ActivityLog & { user: User | null }>> {
    const query = `
      SELECT
        al.*,
        json_build_object(
          'id', u.id,
          'email', u.email,
          'name', u.name,
          'created_at', u.created_at
        ) as user
      FROM ${this.tableName} al
      INNER JOIN users u ON al.user_id = u.id
      WHERE al.user_id = $1
      AND al.workspace_id = $2
      ORDER BY al.created_at DESC
    `;

    const executor = client || this.pool;
    const result = await executor.query(query, [userId, workspaceId]);

    return result.rows as Array<ActivityLog & { user: User | null }>;
  }

  /**
   * Find recent activity logs (limited)
   */
  async findRecent(
    workspaceId: string,
    limit: number = 50,
    client?: PoolClient,
  ): Promise<Array<ActivityLog & { user: User | null }>> {
    const query = `
      SELECT
        al.*,
        CASE
          WHEN u.id IS NOT NULL THEN json_build_object(
            'id', u.id,
            'email', u.email,
            'name', u.name,
            'created_at', u.created_at
          )
          ELSE NULL
        END as user
      FROM ${this.tableName} al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE al.workspace_id = $1
      ORDER BY al.created_at DESC
      LIMIT $2
    `;

    const executor = client || this.pool;
    const result = await executor.query(query, [workspaceId, limit]);

    return result.rows as Array<ActivityLog & { user: User | null }>;
  }
}
