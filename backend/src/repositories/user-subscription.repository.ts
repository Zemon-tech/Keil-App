import { PoolClient } from "pg";
import { BaseRepository } from "./base.repository";
import { UserSubscription, SubscriptionStatus, SubscriptionPlan } from "../types/billing";

export class UserSubscriptionRepository extends BaseRepository<UserSubscription> {
  constructor() {
    super("user_subscriptions");
  }

  /**
   * Find a subscription by user ID (each user has at most one).
   */
  async findByUserId(userId: string, client?: PoolClient): Promise<UserSubscription | null> {
    const executor = client || this.pool;
    const result = await executor.query(
      `SELECT * FROM public.user_subscriptions WHERE user_id = $1 LIMIT 1`,
      [userId]
    );
    return result.rows.length > 0 ? (result.rows[0] as UserSubscription) : null;
  }

  /**
   * Find a subscription by Dodo customer ID.
   */
  async findByDodoCustomerId(dodoCustomerId: string, client?: PoolClient): Promise<UserSubscription | null> {
    const executor = client || this.pool;
    const result = await executor.query(
      `SELECT * FROM public.user_subscriptions WHERE dodo_customer_id = $1 LIMIT 1`,
      [dodoCustomerId]
    );
    return result.rows.length > 0 ? (result.rows[0] as UserSubscription) : null;
  }

  /**
   * Find a subscription by Dodo subscription ID.
   */
  async findByDodoSubscriptionId(dodoSubscriptionId: string, client?: PoolClient): Promise<UserSubscription | null> {
    const executor = client || this.pool;
    const result = await executor.query(
      `SELECT * FROM public.user_subscriptions WHERE dodo_subscription_id = $1 LIMIT 1`,
      [dodoSubscriptionId]
    );
    return result.rows.length > 0 ? (result.rows[0] as UserSubscription) : null;
  }

  /**
   * Upsert a subscription for a user (create if not exists, update if exists).
   */
  async upsert(
    userId: string,
    data: Partial<Omit<UserSubscription, "id" | "user_id" | "created_at">>,
    client?: PoolClient
  ): Promise<UserSubscription> {
    const executor = client || this.pool;

    const setClauses: string[] = [];
    const values: any[] = [userId];
    let paramIdx = 2;

    const fields = Object.entries(data).filter(([_, v]) => v !== undefined);
    for (const [key, value] of fields) {
      setClauses.push(`${key} = $${paramIdx}`);
      values.push(value);
      paramIdx++;
    }

    // Always update updated_at
    setClauses.push(`updated_at = NOW()`);

    const result = await executor.query(
      `INSERT INTO public.user_subscriptions (user_id, ${fields.map(([k]) => k).join(", ")})
       VALUES ($1, ${fields.map((_, i) => `$${i + 2}`).join(", ")})
       ON CONFLICT (user_id) DO UPDATE SET ${setClauses.join(", ")}
       RETURNING *`,
      values
    );

    return result.rows[0] as UserSubscription;
  }

  /**
   * Update subscription status for a user.
   */
  async updateStatus(
    userId: string,
    status: SubscriptionStatus,
    extra?: Partial<Pick<UserSubscription, "cancelled_at" | "locked_at" | "current_period_start" | "current_period_end">>,
    client?: PoolClient
  ): Promise<UserSubscription | null> {
    const executor = client || this.pool;
    const sets: string[] = ["status = $2", "updated_at = NOW()"];
    const values: any[] = [userId, status];
    let idx = 3;

    if (extra) {
      for (const [key, value] of Object.entries(extra)) {
        if (value !== undefined) {
          sets.push(`${key} = $${idx}`);
          values.push(value);
          idx++;
        }
      }
    }

    const result = await executor.query(
      `UPDATE public.user_subscriptions SET ${sets.join(", ")} WHERE user_id = $1 RETURNING *`,
      values
    );
    return result.rows.length > 0 ? (result.rows[0] as UserSubscription) : null;
  }

  /**
   * Activate a subscription after successful payment.
   */
  async activate(
    userId: string,
    data: {
      dodo_customer_id: string;
      dodo_subscription_id: string;
      dodo_product_id: string;
      current_period_start: Date;
      current_period_end: Date;
    },
    client?: PoolClient
  ): Promise<UserSubscription | null> {
    const executor = client || this.pool;
    const result = await executor.query(
      `UPDATE public.user_subscriptions
       SET plan = $2, status = $3, dodo_customer_id = $4, dodo_subscription_id = $5,
           dodo_product_id = $6, current_period_start = $7, current_period_end = $8, updated_at = NOW()
       WHERE user_id = $1
       RETURNING *`,
      [
        userId,
        SubscriptionPlan.PRO_PAID,
        SubscriptionStatus.ACTIVE,
        data.dodo_customer_id,
        data.dodo_subscription_id,
        data.dodo_product_id,
        data.current_period_start,
        data.current_period_end,
      ]
    );
    return result.rows.length > 0 ? (result.rows[0] as UserSubscription) : null;
  }

  /**
   * Find all expired trials (trial_ends_at has passed, still in trialing status).
   */
  async findExpiredTrials(client?: PoolClient): Promise<UserSubscription[]> {
    const executor = client || this.pool;
    const result = await executor.query(
      `SELECT * FROM public.user_subscriptions
       WHERE status = 'trialing' AND trial_ends_at < NOW()`
    );
    return result.rows as UserSubscription[];
  }

  /**
   * Find expired subscriptions past the grace period (7 days after trial_ends_at).
   */
  async findLockable(client?: PoolClient): Promise<UserSubscription[]> {
    const executor = client || this.pool;
    const result = await executor.query(
      `SELECT * FROM public.user_subscriptions
       WHERE status = 'expired' AND trial_ends_at + INTERVAL '7 days' < NOW()`
    );
    return result.rows as UserSubscription[];
  }

  /**
   * Bulk update status for multiple user IDs.
   */
  async bulkUpdateStatus(
    userIds: string[],
    status: SubscriptionStatus,
    extraSets?: string,
    client?: PoolClient
  ): Promise<number> {
    if (userIds.length === 0) return 0;
    const executor = client || this.pool;
    const extra = extraSets ? `, ${extraSets}` : "";
    const result = await executor.query(
      `UPDATE public.user_subscriptions
       SET status = $1, updated_at = NOW()${extra}
       WHERE user_id = ANY($2)`,
      [status, userIds]
    );
    return result.rowCount ?? 0;
  }
}
