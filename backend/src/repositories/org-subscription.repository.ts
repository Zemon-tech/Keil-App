import { PoolClient } from "pg";
import { BaseRepository } from "./base.repository";
import { OrgSubscription, SubscriptionStatus, SubscriptionPlan } from "../types/billing";

export class OrgSubscriptionRepository extends BaseRepository<OrgSubscription> {
  constructor() {
    super("org_subscriptions");
  }

  /**
   * Find a subscription by org ID (each org has at most one).
   */
  async findByOrgId(orgId: string, client?: PoolClient): Promise<OrgSubscription | null> {
    const executor = client || this.pool;
    const result = await executor.query(
      `SELECT * FROM public.org_subscriptions WHERE org_id = $1 LIMIT 1`,
      [orgId]
    );
    return result.rows.length > 0 ? (result.rows[0] as OrgSubscription) : null;
  }

  /**
   * Find a subscription by Dodo subscription ID.
   */
  async findByDodoSubscriptionId(dodoSubscriptionId: string, client?: PoolClient): Promise<OrgSubscription | null> {
    const executor = client || this.pool;
    const result = await executor.query(
      `SELECT * FROM public.org_subscriptions WHERE dodo_subscription_id = $1 LIMIT 1`,
      [dodoSubscriptionId]
    );
    return result.rows.length > 0 ? (result.rows[0] as OrgSubscription) : null;
  }

  /**
   * Find a subscription by Dodo customer ID.
   */
  async findByDodoCustomerId(dodoCustomerId: string, client?: PoolClient): Promise<OrgSubscription | null> {
    const executor = client || this.pool;
    const result = await executor.query(
      `SELECT * FROM public.org_subscriptions WHERE dodo_customer_id = $1 LIMIT 1`,
      [dodoCustomerId]
    );
    return result.rows.length > 0 ? (result.rows[0] as OrgSubscription) : null;
  }

  /**
   * Create a new org subscription (Teams checkout completed).
   */
  async createForOrg(
    orgId: string,
    data: {
      dodo_customer_id: string;
      dodo_subscription_id: string;
      dodo_product_id: string;
      seats_purchased: number;
      current_period_start: Date;
      current_period_end: Date;
    },
    client?: PoolClient
  ): Promise<OrgSubscription> {
    const executor = client || this.pool;
    const result = await executor.query(
      `INSERT INTO public.org_subscriptions
         (org_id, dodo_customer_id, dodo_subscription_id, dodo_product_id, plan, status,
          seats_purchased, seats_used, current_period_start, current_period_end)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (org_id) DO UPDATE SET
         dodo_customer_id = EXCLUDED.dodo_customer_id,
         dodo_subscription_id = EXCLUDED.dodo_subscription_id,
         dodo_product_id = EXCLUDED.dodo_product_id,
         plan = EXCLUDED.plan,
         status = EXCLUDED.status,
         seats_purchased = EXCLUDED.seats_purchased,
         current_period_start = EXCLUDED.current_period_start,
         current_period_end = EXCLUDED.current_period_end,
         updated_at = NOW()
       RETURNING *`,
      [
        orgId,
        data.dodo_customer_id,
        data.dodo_subscription_id,
        data.dodo_product_id,
        SubscriptionPlan.TEAMS,
        SubscriptionStatus.ACTIVE,
        data.seats_purchased,
        1, // seats_used starts at 1 (owner)
        data.current_period_start,
        data.current_period_end,
      ]
    );
    return result.rows[0] as OrgSubscription;
  }

  /**
   * Update subscription status.
   */
  async updateStatus(
    orgId: string,
    status: SubscriptionStatus,
    extra?: Partial<Pick<OrgSubscription, "cancelled_at" | "current_period_start" | "current_period_end">>,
    client?: PoolClient
  ): Promise<OrgSubscription | null> {
    const executor = client || this.pool;
    const sets: string[] = ["status = $2", "updated_at = NOW()"];
    const values: any[] = [orgId, status];
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
      `UPDATE public.org_subscriptions SET ${sets.join(", ")} WHERE org_id = $1 RETURNING *`,
      values
    );
    return result.rows.length > 0 ? (result.rows[0] as OrgSubscription) : null;
  }

  /**
   * Update seat counts. Called when members join/leave or seats are purchased.
   */
  async updateSeats(
    orgId: string,
    updates: { seats_purchased?: number; seats_used?: number },
    client?: PoolClient
  ): Promise<OrgSubscription | null> {
    const executor = client || this.pool;
    const sets: string[] = ["updated_at = NOW()"];
    const values: any[] = [orgId];
    let idx = 2;

    if (updates.seats_purchased !== undefined) {
      sets.push(`seats_purchased = $${idx}`);
      values.push(updates.seats_purchased);
      idx++;
    }
    if (updates.seats_used !== undefined) {
      sets.push(`seats_used = $${idx}`);
      values.push(updates.seats_used);
      idx++;
    }

    const result = await executor.query(
      `UPDATE public.org_subscriptions SET ${sets.join(", ")} WHERE org_id = $1 RETURNING *`,
      values
    );
    return result.rows.length > 0 ? (result.rows[0] as OrgSubscription) : null;
  }

  /**
   * Increment seats_used by 1 (when a member joins the org).
   * Returns null if no subscription exists.
   */
  async incrementSeatsUsed(orgId: string, client?: PoolClient): Promise<OrgSubscription | null> {
    const executor = client || this.pool;
    const result = await executor.query(
      `UPDATE public.org_subscriptions
       SET seats_used = seats_used + 1, updated_at = NOW()
       WHERE org_id = $1
       RETURNING *`,
      [orgId]
    );
    return result.rows.length > 0 ? (result.rows[0] as OrgSubscription) : null;
  }

  /**
   * Decrement seats_used by 1 (when a member leaves the org).
   * Ensures seats_used never goes below 1.
   */
  async decrementSeatsUsed(orgId: string, client?: PoolClient): Promise<OrgSubscription | null> {
    const executor = client || this.pool;
    const result = await executor.query(
      `UPDATE public.org_subscriptions
       SET seats_used = GREATEST(seats_used - 1, 1), updated_at = NOW()
       WHERE org_id = $1
       RETURNING *`,
      [orgId]
    );
    return result.rows.length > 0 ? (result.rows[0] as OrgSubscription) : null;
  }

  /**
   * Check if the org has available seats (seats_used < seats_purchased).
   */
  async hasAvailableSeats(orgId: string, client?: PoolClient): Promise<boolean> {
    const sub = await this.findByOrgId(orgId, client);
    if (!sub) return true; // No Teams subscription = no seat restriction (free/pro orgs)
    return sub.seats_used < sub.seats_purchased;
  }
}
