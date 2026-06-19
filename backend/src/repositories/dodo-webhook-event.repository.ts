import { PoolClient } from "pg";
import { BaseRepository } from "./base.repository";
import { DodoWebhookEvent } from "../types/billing";

export class DodoWebhookEventRepository extends BaseRepository<DodoWebhookEvent> {
  constructor() {
    super("dodo_webhook_events");
  }

  /**
   * Check if an event has already been processed (idempotency guard).
   */
  async existsByEventId(eventId: string, client?: PoolClient): Promise<boolean> {
    const executor = client || this.pool;
    const result = await executor.query(
      `SELECT 1 FROM public.dodo_webhook_events WHERE event_id = $1 LIMIT 1`,
      [eventId]
    );
    return result.rows.length > 0;
  }

  /**
   * Record a processed webhook event.
   */
  async record(
    eventId: string,
    eventType: string,
    payload: Record<string, any>,
    client?: PoolClient
  ): Promise<DodoWebhookEvent> {
    const executor = client || this.pool;
    const result = await executor.query(
      `INSERT INTO public.dodo_webhook_events (event_id, event_type, payload)
       VALUES ($1, $2, $3)
       ON CONFLICT (event_id) DO NOTHING
       RETURNING *`,
      [eventId, eventType, JSON.stringify(payload)]
    );
    return result.rows[0] as DodoWebhookEvent;
  }
}
