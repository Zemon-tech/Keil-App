import { PoolClient } from 'pg';
import { BaseRepository } from './base.repository';
import { User } from '../types/entities';

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
}
