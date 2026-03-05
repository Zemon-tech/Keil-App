import { PoolClient } from 'pg';
import { BaseRepository } from './base.repository';
import { User, Workspace } from '../types/entities';

export class UserRepository extends BaseRepository<User> {
  constructor() {
    super('users');
  }

  /**
   * Find user by email
   */
  async findByEmail(email: string, client?: PoolClient): Promise<User | null> {
    const query = `
      SELECT * FROM ${this.tableName}
      WHERE email = $1
      LIMIT 1
    `;

    const executor = client || this.pool;
    const result = await executor.query(query, [email]);

    return result.rows.length > 0 ? (result.rows[0] as User) : null;
  }

  /**
   * Get user's workspace (since each user belongs to exactly one workspace)
   */
  async getUserWorkspace(userId: string, client?: PoolClient): Promise<Workspace | null> {
    const query = `
      SELECT w.*
      FROM workspaces w
      INNER JOIN workspace_members wm ON w.id = wm.workspace_id
      WHERE wm.user_id = $1
      AND w.deleted_at IS NULL
      LIMIT 1
    `;

    const executor = client || this.pool;
    const result = await executor.query(query, [userId]);

    return result.rows.length > 0 ? (result.rows[0] as Workspace) : null;
  }
}
