import { Pool, PoolClient, QueryResult } from 'pg';
import pool from '../config/pg';
import { PaginationOptions } from '../types/repository';

export abstract class BaseRepository<T> {
  protected tableName: string;
  protected pool: Pool;

  constructor(tableName: string, poolInstance: Pool = pool) {
    this.tableName = tableName;
    this.pool = poolInstance;
  }

  /**
   * Get a client from the pool for transaction support
   */
  protected async getClient(): Promise<PoolClient> {
    return await this.pool.connect();
  }

  /**
   * Execute a callback within a transaction
   */
  async executeInTransaction<R>(
    callback: (client: PoolClient) => Promise<R>
  ): Promise<R> {
    const client = await this.getClient();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Find a single record by ID
   */
  async findById(
    id: string,
    client?: PoolClient,
    includeDeleted: boolean = false
  ): Promise<T | null> {
    const deletedClause = includeDeleted ? '' : 'AND deleted_at IS NULL';
    const query = `
      SELECT * FROM ${this.tableName}
      WHERE id = $1 ${deletedClause}
      LIMIT 1
    `;
    
    const executor = client || this.pool;
    const result: QueryResult = await executor.query(query, [id]);
    
    return result.rows.length > 0 ? (result.rows[0] as T) : null;
  }

  /**
   * Find all records with optional filters and pagination
   */
  async findAll(
    filters?: Partial<T>,
    pagination?: PaginationOptions,
    client?: PoolClient,
    includeDeleted: boolean = false
  ): Promise<T[]> {
    let query = `SELECT * FROM ${this.tableName} WHERE 1=1`;
    const params: any[] = [];
    let paramIndex = 1;

    // Add deleted_at filter
    if (!includeDeleted) {
      query += ` AND deleted_at IS NULL`;
    }

    // Add filters
    if (filters) {
      for (const [key, value] of Object.entries(filters)) {
        if (value !== undefined && value !== null) {
          query += ` AND ${key} = $${paramIndex}`;
          params.push(value);
          paramIndex++;
        }
      }
    }

    // Add pagination
    if (pagination) {
      query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(pagination.limit, pagination.offset);
    }

    const executor = client || this.pool;
    const result: QueryResult = await executor.query(query, params);
    
    return result.rows as T[];
  }

  /**
   * Create a new record
   */
  async create(data: Partial<T>, client?: PoolClient): Promise<T> {
    const validData = Object.fromEntries(
      Object.entries(data).filter(([_, value]) => value !== undefined)
    );
    const keys = Object.keys(validData);
    const values = Object.values(validData);
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
    const columns = keys.join(', ');

    const query = `
      INSERT INTO ${this.tableName} (${columns})
      VALUES (${placeholders})
      RETURNING *
    `;

    const executor = client || this.pool;
    const result: QueryResult = await executor.query(query, values);
    
    return result.rows[0] as T;
  }

  /**
   * Update a record by ID
   */
  async update(
    id: string,
    data: Partial<T>,
    client?: PoolClient
  ): Promise<T | null> {
    const validData = Object.fromEntries(
      Object.entries(data).filter(([_, value]) => value !== undefined)
    );
    const keys = Object.keys(validData);
    const values = Object.values(validData);
    
    if (keys.length === 0) {
      return this.findById(id, client);
    }

    const setClause = keys
      .map((key, i) => `${key} = $${i + 2}`)
      .join(', ');

    const query = `
      UPDATE ${this.tableName}
      SET ${setClause}
      WHERE id = $1 AND deleted_at IS NULL
      RETURNING *
    `;

    const executor = client || this.pool;
    const result: QueryResult = await executor.query(query, [id, ...values]);
    
    return result.rows.length > 0 ? (result.rows[0] as T) : null;
  }

  /**
   * Hard delete a record by ID
   */
  async delete(id: string, client?: PoolClient): Promise<void> {
    const query = `DELETE FROM ${this.tableName} WHERE id = $1`;
    
    const executor = client || this.pool;
    await executor.query(query, [id]);
  }

  /**
   * Soft delete a record by ID (set deleted_at)
   */
  async softDelete(id: string, client?: PoolClient): Promise<T | null> {
    const query = `
      UPDATE ${this.tableName}
      SET deleted_at = NOW()
      WHERE id = $1 AND deleted_at IS NULL
      RETURNING *
    `;

    const executor = client || this.pool;
    const result: QueryResult = await executor.query(query, [id]);
    
    return result.rows.length > 0 ? (result.rows[0] as T) : null;
  }

  /**
   * Restore a soft-deleted record (unset deleted_at)
   */
  async restore(id: string, client?: PoolClient): Promise<T | null> {
    const query = `
      UPDATE ${this.tableName}
      SET deleted_at = NULL
      WHERE id = $1 AND deleted_at IS NOT NULL
      RETURNING *
    `;

    const executor = client || this.pool;
    const result: QueryResult = await executor.query(query, [id]);
    
    return result.rows.length > 0 ? (result.rows[0] as T) : null;
  }

  /**
   * Count records with optional filters
   */
  async count(
    filters?: Partial<T>,
    client?: PoolClient,
    includeDeleted: boolean = false
  ): Promise<number> {
    let query = `SELECT COUNT(*) as count FROM ${this.tableName} WHERE 1=1`;
    const params: any[] = [];
    let paramIndex = 1;

    // Add deleted_at filter
    if (!includeDeleted) {
      query += ` AND deleted_at IS NULL`;
    }

    // Add filters
    if (filters) {
      for (const [key, value] of Object.entries(filters)) {
        if (value !== undefined && value !== null) {
          query += ` AND ${key} = $${paramIndex}`;
          params.push(value);
          paramIndex++;
        }
      }
    }

    const executor = client || this.pool;
    const result: QueryResult = await executor.query(query, params);
    
    return parseInt(result.rows[0].count, 10);
  }

  /**
   * Check database connection health
   */
  async checkConnection(): Promise<boolean> {
    try {
      await this.pool.query('SELECT 1');
      return true;
    } catch (error) {
      return false;
    }
  }
}
