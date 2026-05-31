import { PoolClient } from "pg";
import { BaseRepository } from "./base.repository";
import { ActivityLog } from "../types/entities";
import { LogEntityType, LogActionType } from "../types/enums";

export class ActivityRepository extends BaseRepository<ActivityLog> {
  constructor() {
    super("activity_logs");
  }

  /**
   * Log an activity (append-only, no updates)
   */
  async log(
    data: {
      org_id?: string | null;
      space_id?: string | null;
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
        (org_id, space_id, user_id, entity_type, entity_id, action_type, old_value, new_value)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;

    const executor = client || this.pool;
    const result = await executor.query(query, [
      data.org_id ?? null,
      data.space_id ?? null,
      data.user_id,
      data.entity_type,
      data.entity_id,
      data.action_type,
      data.old_value ? JSON.stringify(data.old_value) : null,
      data.new_value ? JSON.stringify(data.new_value) : null,
    ]);

    return result.rows[0] as ActivityLog;
  }

}
