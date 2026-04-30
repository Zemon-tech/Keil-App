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
}
