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
      ORDER BY o.created_at ASC
    `;

    const executor = client || this.pool;
    const result = await executor.query(query, [userId]);
    return result.rows as Array<Organisation & { membership_role: string }>;
  }
}
