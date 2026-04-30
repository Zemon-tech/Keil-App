import { PoolClient } from "pg";
import { BaseRepository } from "./base.repository";
import { PersonalTask } from "../types/entities";
import { TaskQueryOptions } from "../types/repository";

export class PersonalTaskRepository extends BaseRepository<PersonalTask> {
  constructor() {
    super("personal_tasks");
  }

  async findByOwner(
    ownerUserId: string,
    options: TaskQueryOptions = {},
    client?: PoolClient,
  ): Promise<PersonalTask[]> {
    let query = `
      SELECT *
      FROM public.personal_tasks
      WHERE owner_user_id = $1
        AND deleted_at IS NULL
    `;
    const params: Array<string | number | Date | string[]> = [ownerUserId];
    let paramIndex = 2;

    if (options.filters?.status) {
      query += ` AND status = $${paramIndex}`;
      params.push(options.filters.status);
      paramIndex++;
    }

    if (options.filters?.priority) {
      query += ` AND priority = $${paramIndex}`;
      params.push(options.filters.priority);
      paramIndex++;
    }

    if (options.filters?.parentTaskId !== undefined) {
      if (options.filters.parentTaskId === null) {
        query += ` AND parent_task_id IS NULL`;
      } else {
        query += ` AND parent_task_id = $${paramIndex}`;
        params.push(options.filters.parentTaskId);
        paramIndex++;
      }
    }

    query += ` ORDER BY created_at DESC`;

    if (options.pagination) {
      query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(options.pagination.limit, options.pagination.offset);
    }

    const executor = client || this.pool;
    const result = await executor.query(query, params);
    return result.rows as PersonalTask[];
  }
}
