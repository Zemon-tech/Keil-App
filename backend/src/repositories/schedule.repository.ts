import { PoolClient } from 'pg';
import { BaseRepository } from './base.repository';

export interface ScheduleBlockDTO {
  id: string;
  task_id: string;
  task_title: string;
  task_status: string;
  scheduled_start: string;
  scheduled_end: string;
}

export interface UnscheduledTaskDTO {
  id: string;
  title: string;
  start_date: string | null;
  due_date: string | null;
  status: string;
  priority: string;
  total_count?: number;
}

export interface GanttTaskDTO {
  id: string;
  title: string;
  status: string;
  start_date: string;
  due_date: string;
  parent_task_id: string | null;
  dependencies: string[];
}

export class ScheduleRepository extends BaseRepository<any> {
  constructor() {
    super('task_schedules');
  }

  async upsertTimeblock(
    taskId: string, 
    userId: string, 
    workspaceId: string, 
    start: Date, 
    end: Date, 
    client?: PoolClient
  ) {
    const query = `
      INSERT INTO ${this.tableName} (task_id, user_id, workspace_id, scheduled_start, scheduled_end)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (task_id, user_id) 
      DO UPDATE SET scheduled_start = EXCLUDED.scheduled_start, scheduled_end = EXCLUDED.scheduled_end
      RETURNING *
    `;
    const executor = client || this.pool;
    const result = await executor.query(query, [taskId, userId, workspaceId, start, end]);
    return result.rows[0];
  }

  async deleteTimeblock(
    taskId: string, 
    userId: string, 
    workspaceId: string, 
    client?: PoolClient
  ): Promise<void> {
    const query = `DELETE FROM ${this.tableName} WHERE task_id = $1 AND user_id = $2 AND workspace_id = $3`;
    const executor = client || this.pool;
    await executor.query(query, [taskId, userId, workspaceId]);
  }

  async deleteTimeblocksByUser(
    taskId: string, 
    userId: string, 
    client?: PoolClient
  ): Promise<void> {
    const query = `DELETE FROM ${this.tableName} WHERE task_id = $1 AND user_id = $2`;
    const executor = client || this.pool;
    await executor.query(query, [taskId, userId]);
  }

  async shiftTimeblocks(
    taskId: string, 
    deltaMs: number, 
    client?: PoolClient
  ): Promise<void> {
    const query = `
      UPDATE ${this.tableName} 
      SET scheduled_start = scheduled_start + ($2 || ' milliseconds')::interval,
          scheduled_end = scheduled_end + ($2 || ' milliseconds')::interval 
      WHERE task_id = $1
    `;
    const executor = client || this.pool;
    await executor.query(query, [taskId, deltaMs]);
  }

  async purgeOutOfBoundsTimeblocks(
    taskId: string, 
    newStart: Date, 
    newEnd: Date, 
    client?: PoolClient
  ): Promise<void> {
    const query = `
      DELETE FROM ${this.tableName} 
      WHERE task_id = $1 AND (scheduled_start < $2 OR scheduled_end > $3)
    `;
    const executor = client || this.pool;
    await executor.query(query, [taskId, newStart, newEnd]);
  }

  async getCalendarBlocks(
    userId: string, 
    workspaceId: string, 
    startRange: string, 
    endRange: string
  ): Promise<ScheduleBlockDTO[]> {
    const query = `
      SELECT ts.id, ts.task_id, t.title as task_title, t.status as task_status, ts.scheduled_start, ts.scheduled_end
      FROM ${this.tableName} ts
      INNER JOIN tasks t ON ts.task_id = t.id
      WHERE ts.workspace_id = $1 
        AND ts.user_id = $2 
        AND ts.scheduled_start < $3 
        AND ts.scheduled_end > $4 
        AND t.deleted_at IS NULL
    `;
    const executor = this.pool;
    // $3 is endRange, $4 is startRange according to the documentation: "ts.scheduled_start < $end_range AND ts.scheduled_end > $start_range"
    try {
      const result = await executor.query(query, [workspaceId, userId, endRange, startRange]);
      return result.rows as ScheduleBlockDTO[];
    } catch (err: any) {
      console.error('❌ [ScheduleRepository] getCalendarBlocks SQL Error:', err.message);
      throw err;
    }
  }

  async getUnscheduledTasks(
    userId: string, 
    workspaceId: string, 
    limit: number = 50, 
    offset: number = 0, 
    search?: string
  ): Promise<{ data: UnscheduledTaskDTO[], pagination: any }> {
    let query = `
      SELECT t.id, t.title, t.start_date, t.due_date, t.status, t.priority,
             COUNT(*) OVER() AS total_count
      FROM tasks t
      LEFT JOIN ${this.tableName} ts ON t.id = ts.task_id AND ts.user_id = $1
      WHERE t.workspace_id = $2
        AND t.deleted_at IS NULL
        AND t.status != 'done'
        AND ts.id IS NULL
    `;
    
    const params: any[] = [userId, workspaceId];
    let paramIndex = 3;

    if (search) {
      query += ` AND t.title ILIKE '%' || $${paramIndex} || '%'`;
      params.push(search);
      paramIndex++;
    }

    query += ` ORDER BY t.due_date ASC NULLS LAST LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const executor = this.pool;
    try {
      const result = await executor.query(query, params);

      const data = result.rows.map(r => ({
        id: r.id,
        title: r.title,
        start_date: r.start_date,
        due_date: r.due_date,
        status: r.status,
        priority: r.priority
      })) as UnscheduledTaskDTO[];

      const total = result.rows.length > 0 ? parseInt(result.rows[0].total_count, 10) : 0;

      return {
        data,
        pagination: { limit, offset, total }
      };
    } catch (err: any) {
      console.error('❌ [ScheduleRepository] getUnscheduledTasks SQL Error:', err.message);
      throw err;
    }
  }

  async getGanttTasks(workspaceId: string, scope: 'workspace' | 'user', userId?: string, projectId?: string): Promise<GanttTaskDTO[]> {
    let query = `
      SELECT t.id, t.title, t.status, 
             COALESCE(t.start_date, CURRENT_DATE) as start_date, 
             t.due_date, 
             t.parent_task_id, 
             COALESCE(
               json_agg(td.depends_on_task_id) FILTER (WHERE td.depends_on_task_id IS NOT NULL),
               '[]'
             ) as dependencies
      FROM tasks t
      LEFT JOIN task_dependencies td ON t.id = td.task_id
      WHERE t.deleted_at IS NULL AND t.due_date IS NOT NULL AND t.workspace_id = $1
    `;
    const params: any[] = [workspaceId];
    let paramIndex = 2;

    if (scope === 'user' && userId) {
      // Need inner join on task_assignees to enforce user subquery
      query += ` AND t.id IN (SELECT task_id FROM task_assignees WHERE user_id = $${paramIndex})`;
      params.push(userId);
      paramIndex++;
    }

    if (projectId) {
      query += ` AND (t.id = $${paramIndex} OR t.parent_task_id = $${paramIndex})`;
      params.push(projectId);
      paramIndex++;
    }

    query += ` GROUP BY t.id`;

    const executor = this.pool;
    const result = await executor.query(query, params);
    return result.rows as GanttTaskDTO[];
  }
}
