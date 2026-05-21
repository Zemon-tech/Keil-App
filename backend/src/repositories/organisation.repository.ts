import { PoolClient } from "pg";
import { BaseRepository } from "./base.repository";
import { Organisation } from "../types/entities";

export class OrganisationRepository extends BaseRepository<Organisation> {
  constructor() {
    super("organisations");
  }

  async findByUserId(userId: string, client?: PoolClient): Promise<Array<Organisation & { membership_role: string }>> {
    const query = `
      SELECT
        o.*,
        om.role as membership_role
      FROM public.organisations o
      INNER JOIN public.organisation_members om
        ON om.org_id = o.id
      WHERE om.user_id = $1
        AND o.deleted_at IS NULL
      ORDER BY o.is_personal DESC, o.created_at ASC
    `;

    const executor = client || this.pool;
    const result = await executor.query(query, [userId]);
    return result.rows as Array<Organisation & { membership_role: string }>;
  }

  /**
   * Create a new organisation and add the owner as a member — all in one transaction.
   * Returns the new org row (without membership_role; caller adds that separately).
   */
  async createWithOwner(
    name: string,
    ownerUserId: string,
    client: PoolClient,
  ): Promise<Organisation> {
    const orgResult = await client.query<Organisation>(
      `INSERT INTO public.organisations (name, owner_user_id)
       VALUES ($1, $2)
       RETURNING *`,
      [name, ownerUserId],
    );
    const org = orgResult.rows[0];

    await client.query(
      `INSERT INTO public.organisation_members (org_id, user_id, role)
       VALUES ($1, $2, 'owner')`,
      [org.id, ownerUserId],
    );

    return org;
  }

  /**
   * Returns all members of an organisation with their roles and user details.
   */
  async findMembers(
    orgId: string,
    client?: PoolClient,
  ): Promise<Array<{ user_id: string; role: string; name: string | null; email: string }>> {
    const query = `
      SELECT
        om.user_id,
        om.role,
        u.name,
        u.email
      FROM public.organisation_members om
      INNER JOIN public.users u
        ON u.id = om.user_id
      WHERE om.org_id = $1
      ORDER BY COALESCE(u.name, u.email) ASC
    `;

    const executor = client || this.pool;
    const result = await executor.query(query, [orgId]);
    return result.rows as Array<{ user_id: string; role: string; name: string | null; email: string }>;
  }

  /**
   * Returns the caller's role in an org, or null if not a member.
   */
  async getMemberRole(
    orgId: string,
    userId: string,
    client?: PoolClient,
  ): Promise<string | null> {
    const executor = client || this.pool;
    const result = await executor.query(
      `SELECT role FROM public.organisation_members WHERE org_id = $1 AND user_id = $2 LIMIT 1`,
      [orgId, userId],
    );
    return result.rows.length > 0 ? result.rows[0].role : null;
  }

  /**
   * Adds a user to an org as a member. Idempotent — does nothing if already a member.
   */
  async addMember(
    orgId: string,
    userId: string,
    role: string,
    client: PoolClient,
  ): Promise<void> {
    await client.query(
      `INSERT INTO public.organisation_members (org_id, user_id, role)
       VALUES ($1, $2, $3)
       ON CONFLICT (org_id, user_id) DO NOTHING`,
      [orgId, userId, role],
    );
  }

  async updateMemberRole(
    orgId: string,
    userId: string,
    role: string,
    client?: PoolClient,
  ): Promise<void> {
    const executor = client || this.pool;
    await executor.query(
      `UPDATE public.organisation_members
       SET role = $3
       WHERE org_id = $1 AND user_id = $2`,
      [orgId, userId, role],
    );
  }

  async removeMember(
    orgId: string,
    userId: string,
    client?: PoolClient,
  ): Promise<void> {
    const executor = client || this.pool;
    await executor.query(
      `DELETE FROM public.organisation_members
       WHERE org_id = $1 AND user_id = $2`,
      [orgId, userId],
    );
  }
}
