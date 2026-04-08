import { PoolClient } from 'pg';
import { BaseRepository } from './base.repository';
import { Workspace, WorkspaceMember, User } from '../types/entities';
import { MemberRole } from '../types/enums';
import { PaginationOptions } from '../types/repository';

export class WorkspaceRepository extends BaseRepository<Workspace> {
  constructor() {
    super('workspaces');
  }

  /**
   * Find workspace by owner ID
   */
  async findByOwnerId(ownerId: string, client?: PoolClient): Promise<Workspace | null> {
    const query = `
      SELECT * FROM ${this.tableName}
      WHERE owner_id = $1
      AND deleted_at IS NULL
      LIMIT 1
    `;

    const executor = client || this.pool;
    const result = await executor.query(query, [ownerId]);

    return result.rows.length > 0 ? (result.rows[0] as Workspace) : null;
  }

  /**
   * Find workspace by user ID (member or owner)
   */
  async findByUserId(userId: string, client?: PoolClient): Promise<Workspace | null> {
    const query = `
      SELECT w.*
      FROM ${this.tableName} w
      INNER JOIN workspace_members wm ON w.id = wm.workspace_id
      WHERE wm.user_id = $1
      AND w.deleted_at IS NULL
      LIMIT 1
    `;

    const executor = client || this.pool;
    const result = await executor.query(query, [userId]);

    return result.rows.length > 0 ? (result.rows[0] as Workspace) : null;
  }

  /**
   * Find ALL workspaces by user ID (member or owner)
   */
  async findAllByUserId(userId: string, client?: PoolClient): Promise<Workspace[]> {
    const query = `
      SELECT w.*
      FROM ${this.tableName} w
      INNER JOIN workspace_members wm ON w.id = wm.workspace_id
      WHERE wm.user_id = $1
      AND w.deleted_at IS NULL
    `;

    const executor = client || this.pool;
    const result = await executor.query(query, [userId]);

    return result.rows as Workspace[];
  }

  /**
   * Get workspace members with user details
   */
  async getMembers(
    workspaceId: string,
    pagination?: PaginationOptions,
    client?: PoolClient
  ): Promise<Array<WorkspaceMember & { user: User }>> {
    let query = `
      SELECT 
        wm.*,
        json_build_object(
          'id', u.id,
          'email', u.email,
          'name', u.name,
          'created_at', u.created_at
        ) as user
      FROM workspace_members wm
      INNER JOIN users u ON wm.user_id = u.id
      WHERE wm.workspace_id = $1
      ORDER BY wm.created_at ASC
    `;

    const params: any[] = [workspaceId];

    if (pagination) {
      query += ` LIMIT $2 OFFSET $3`;
      params.push(pagination.limit, pagination.offset);
    }

    const executor = client || this.pool;
    const result = await executor.query(query, params);

    return result.rows as Array<WorkspaceMember & { user: User }>;
  }

  /**
   * Add member to workspace
   */
  async addMember(
    workspaceId: string,
    userId: string,
    role: MemberRole = MemberRole.MEMBER,
    client?: PoolClient
  ): Promise<WorkspaceMember> {
    const query = `
      INSERT INTO workspace_members (workspace_id, user_id, role)
      VALUES ($1, $2, $3)
      RETURNING *
    `;

    const executor = client || this.pool;
    const result = await executor.query(query, [workspaceId, userId, role]);

    return result.rows[0] as WorkspaceMember;
  }

  /**
   * Update member role
   */
  async updateMemberRole(
    workspaceId: string,
    userId: string,
    role: MemberRole,
    client?: PoolClient
  ): Promise<WorkspaceMember | null> {
    const query = `
      UPDATE workspace_members
      SET role = $3
      WHERE workspace_id = $1 AND user_id = $2
      RETURNING *
    `;

    const executor = client || this.pool;
    const result = await executor.query(query, [workspaceId, userId, role]);

    return result.rows.length > 0 ? (result.rows[0] as WorkspaceMember) : null;
  }

  /**
   * Remove member from workspace
   */
  async removeMember(
    workspaceId: string,
    userId: string,
    client?: PoolClient
  ): Promise<void> {
    const query = `
      DELETE FROM workspace_members
      WHERE workspace_id = $1 AND user_id = $2
    `;

    const executor = client || this.pool;
    await executor.query(query, [workspaceId, userId]);
  }

  /**
   * Check if user is a member of workspace
   */
  async isMember(
    workspaceId: string,
    userId: string,
    client?: PoolClient
  ): Promise<boolean> {
    const query = `
      SELECT 1 FROM workspace_members
      WHERE workspace_id = $1 AND user_id = $2
      LIMIT 1
    `;

    const executor = client || this.pool;
    const result = await executor.query(query, [workspaceId, userId]);

    return result.rows.length > 0;
  }
}
