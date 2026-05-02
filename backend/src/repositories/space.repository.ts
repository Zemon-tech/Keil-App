import { PoolClient } from "pg";
import { BaseRepository } from "./base.repository";
import { Space } from "../types/entities";

export class SpaceRepository extends BaseRepository<Space> {
  constructor() {
    super("spaces");
  }

  async findVisibleByOrgAndUser(
    orgId: string,
    userId: string,
    client?: PoolClient,
  ): Promise<Array<Space & { membership_role: string; compatibility_workspace_id: string | null }>> {
    const query = `
      SELECT
        s.*,
        sm.role as membership_role,
        COALESCE(s.workspace_id, o.source_workspace_id) as compatibility_workspace_id
      FROM public.spaces s
      INNER JOIN public.space_members sm
        ON sm.space_id = s.id
      INNER JOIN public.organisations o
        ON o.id = s.org_id
      WHERE s.org_id = $1
        AND sm.user_id = $2
        AND s.deleted_at IS NULL
      ORDER BY s.created_at ASC
    `;

    const executor = client || this.pool;
    const result = await executor.query(query, [orgId, userId]);
    return result.rows as Array<Space & { membership_role: string; compatibility_workspace_id: string | null }>;
  }

  async findMembers(
    orgId: string,
    spaceId: string,
    client?: PoolClient,
  ): Promise<Array<{ user_id: string; role: string; name: string | null; email: string }>> {
    const query = `
      SELECT
        sm.user_id,
        sm.role,
        u.name,
        u.email
      FROM public.space_members sm
      INNER JOIN public.users u
        ON u.id = sm.user_id
      WHERE sm.org_id = $1
        AND sm.space_id = $2
      ORDER BY COALESCE(u.name, u.email) ASC
    `;

    const executor = client || this.pool;
    const result = await executor.query(query, [orgId, spaceId]);
    return result.rows as Array<{ user_id: string; role: string; name: string | null; email: string }>;
  }

  /**
   * Creates a new space inside an org and adds the creator as owner.
   * Must be called inside a transaction.
   */
  async createWithOwner(
    orgId: string,
    name: string,
    createdBy: string,
    client: PoolClient,
  ): Promise<Space> {
    const spaceResult = await client.query<Space>(
      `INSERT INTO public.spaces (org_id, name, visibility, created_by)
       VALUES ($1, $2, 'private', $3)
       RETURNING *`,
      [orgId, name, createdBy],
    );
    const space = spaceResult.rows[0];

    await client.query(
      `INSERT INTO public.space_members (org_id, space_id, user_id, role)
       VALUES ($1, $2, $3, 'owner')`,
      [orgId, space.id, createdBy],
    );

    return space;
  }

  /**
   * Returns the first (oldest) space in an org — used as the "default" space for invites.
   */
  async findDefaultSpace(orgId: string, client?: PoolClient): Promise<Space | null> {
    const executor = client || this.pool;
    const result = await executor.query<Space>(
      `SELECT * FROM public.spaces
       WHERE org_id = $1 AND deleted_at IS NULL
       ORDER BY created_at ASC
       LIMIT 1`,
      [orgId],
    );
    return result.rows.length > 0 ? result.rows[0] : null;
  }

  /**
   * Adds a user to a space as a member. Idempotent — does nothing if already a member.
   */
  async addMember(
    orgId: string,
    spaceId: string,
    userId: string,
    role: string,
    client: PoolClient,
  ): Promise<void> {
    await client.query(
      `INSERT INTO public.space_members (org_id, space_id, user_id, role)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (space_id, user_id) DO NOTHING`,
      [orgId, spaceId, userId, role],
    );
  }

  // ── Space CRUD ────────────────────────────────────────────────────────────

  async rename(spaceId: string, name: string, client?: PoolClient): Promise<Space | null> {
    const executor = client || this.pool;
    const result = await executor.query<Space>(
      `UPDATE public.spaces SET name = $1, updated_at = NOW()
       WHERE id = $2 AND deleted_at IS NULL
       RETURNING *`,
      [name, spaceId],
    );
    return result.rows.length > 0 ? result.rows[0] : null;
  }

  async softDeleteSpace(spaceId: string, client: PoolClient): Promise<void> {
    await client.query(
      `UPDATE public.spaces SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL`,
      [spaceId],
    );
  }

  async restore(spaceId: string, client: PoolClient): Promise<Space | null> {
    const result = await client.query<Space>(
      `UPDATE public.spaces SET deleted_at = NULL WHERE id = $1 AND deleted_at IS NOT NULL
       RETURNING *`,
      [spaceId],
    );
    return result.rows.length > 0 ? result.rows[0] : null;
  }

  async hardDelete(spaceId: string, client: PoolClient): Promise<void> {
    await client.query(`DELETE FROM public.spaces WHERE id = $1`, [spaceId]);
  }

  async findDeletedByOrg(orgId: string, client?: PoolClient): Promise<Space[]> {
    const executor = client || this.pool;
    const result = await executor.query<Space>(
      `SELECT * FROM public.spaces
       WHERE org_id = $1 AND deleted_at IS NOT NULL
       ORDER BY deleted_at DESC`,
      [orgId],
    );
    return result.rows;
  }

  async countActiveByOrg(orgId: string, client?: PoolClient): Promise<number> {
    const executor = client || this.pool;
    const result = await executor.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM public.spaces
       WHERE org_id = $1 AND deleted_at IS NULL`,
      [orgId],
    );
    return parseInt(result.rows[0].count, 10);
  }

  async removeMember(spaceId: string, userId: string, client: PoolClient): Promise<void> {
    await client.query(
      `DELETE FROM public.space_members WHERE space_id = $1 AND user_id = $2`,
      [spaceId, userId],
    );
  }
}

