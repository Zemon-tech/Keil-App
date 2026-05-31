import { BaseRepository } from "./base.repository";
import { Notification, UserNotificationPreference, NotificationOutbox } from "../types/entities";
import { PoolClient } from "pg";

export class NotificationRepository extends BaseRepository<Notification> {
  constructor() {
    super("notifications");
  }

  // Find notifications for a specific user
  async findByRecipient(
    recipientId: string,
    limit: number = 20,
    offset: number = 0,
    client?: PoolClient
  ): Promise<Notification[]> {
    const query = `
      SELECT * FROM ${this.tableName}
      WHERE recipient_id = $1
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
    `;
    const executor = client || this.pool;
    const result = await executor.query(query, [recipientId, limit, offset]);
    return result.rows as Notification[];
  }

  // Find unread comment/mention replies/messages in a specific space
  async findUnreadRepliesBySpace(
    recipientId: string,
    spaceId: string,
    client?: PoolClient
  ): Promise<Array<{ id: string; from: string; message: string }>> {
    const query = `
      SELECT n.id, u.name as sender_name, u.email as sender_email, n.payload
      FROM ${this.tableName} n
      LEFT JOIN public.users u ON n.sender_id = u.id
      WHERE n.recipient_id = $1
        AND n.space_id = $2
        AND n.read_at IS NULL
        AND n.event_type IN ('comment_created', 'mention_in_comment')
      ORDER BY n.created_at DESC
    `;
    const executor = client || this.pool;
    const result = await executor.query(query, [recipientId, spaceId]);
    return result.rows.map(row => ({
      id: row.id,
      from: row.sender_name || row.sender_email || 'Someone',
      message: row.payload?.comment_snippet || 'New comment'
    }));
  }
}

export class UserNotificationPreferenceRepository extends BaseRepository<UserNotificationPreference> {
  constructor() {
    super("user_notification_preferences");
  }

  // Safe find by user ID, creating default preferences if none exist (robust fallback)
  async findByUserId(userId: string, client?: PoolClient): Promise<UserNotificationPreference> {
    const executor = client || this.pool;
    const query = `SELECT * FROM ${this.tableName} WHERE user_id = $1 LIMIT 1`;
    const result = await executor.query(query, [userId]);
    
    if (result.rows.length > 0) {
      return result.rows[0] as UserNotificationPreference;
    }
    
    // Auto-create default row if missing
    return this.create({ user_id: userId }, client);
  }
}

export class NotificationOutboxRepository extends BaseRepository<NotificationOutbox> {
  constructor() {
    super("notification_outbox");
  }

  // Claim next batch of pending outbox rows atomically using FOR UPDATE SKIP LOCKED
  async claimPendingBatch(limit: number = 10, client: PoolClient): Promise<NotificationOutbox[]> {
    const query = `
      SELECT * FROM ${this.tableName}
      WHERE status = 'pending'
      ORDER BY created_at ASC
      LIMIT $1
      FOR UPDATE SKIP LOCKED
    `;
    const result = await client.query(query, [limit]);
    
    if (result.rows.length === 0) return [];
    
    const ids = result.rows.map(row => row.id);
    const updateQuery = `
      UPDATE ${this.tableName}
      SET status = 'processing', attempts = attempts + 1
      WHERE id = ANY($1)
      RETURNING *
    `;
    const updateResult = await client.query(updateQuery, [ids]);
    return updateResult.rows as NotificationOutbox[];
  }
}
