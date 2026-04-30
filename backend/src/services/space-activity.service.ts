import pool from "../config/pg";
import { LogEntityType } from "../types/enums";

export interface SpaceActivityLogDTO {
  id: string;
  workspace_id: string;
  org_id: string | null;
  space_id: string | null;
  user_id: string | null;
  entity_type: string;
  entity_id: string;
  action_type: string;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  created_at: string;
  user: {
    id: string;
    email: string;
    name: string | null;
    created_at: string;
  } | null;
}

const mapRow = (row: any): SpaceActivityLogDTO => ({
  id: row.id,
  workspace_id: row.workspace_id,
  org_id: row.org_id,
  space_id: row.space_id,
  user_id: row.user_id,
  entity_type: row.entity_type,
  entity_id: row.entity_id,
  action_type: row.action_type,
  old_value: row.old_value,
  new_value: row.new_value,
  created_at: new Date(row.created_at).toISOString(),
  user: row.user
    ? {
        id: row.user.id,
        email: row.user.email,
        name: row.user.name,
        created_at: new Date(row.user.created_at).toISOString(),
      }
    : null,
});

export const getSpaceActivityFeed = async (
  orgId: string,
  spaceId: string,
  limit: number,
  offset: number,
): Promise<SpaceActivityLogDTO[]> => {
  const result = await pool.query(
    `
      SELECT
        al.*,
        CASE
          WHEN u.id IS NOT NULL THEN json_build_object(
            'id', u.id,
            'email', u.email,
            'name', u.name,
            'created_at', u.created_at
          )
          ELSE NULL
        END as user
      FROM public.activity_logs al
      LEFT JOIN public.users u
        ON u.id = al.user_id
      WHERE al.org_id = $1
        AND al.space_id = $2
      ORDER BY al.created_at DESC
      LIMIT $3 OFFSET $4
    `,
    [orgId, spaceId, limit, offset],
  );

  return result.rows.map(mapRow);
};

export const getSpaceEntityActivity = async (
  orgId: string,
  spaceId: string,
  entityType: LogEntityType,
  entityId: string,
): Promise<SpaceActivityLogDTO[]> => {
  const result = await pool.query(
    `
      SELECT
        al.*,
        CASE
          WHEN u.id IS NOT NULL THEN json_build_object(
            'id', u.id,
            'email', u.email,
            'name', u.name,
            'created_at', u.created_at
          )
          ELSE NULL
        END as user
      FROM public.activity_logs al
      LEFT JOIN public.users u
        ON u.id = al.user_id
      WHERE al.org_id = $1
        AND al.space_id = $2
        AND al.entity_type = $3
        AND al.entity_id = $4
      ORDER BY al.created_at DESC
    `,
    [orgId, spaceId, entityType, entityId],
  );

  return result.rows.map(mapRow);
};

export const getSpaceTaskActivity = async (
  orgId: string,
  spaceId: string,
  taskId: string,
): Promise<SpaceActivityLogDTO[]> => {
  const result = await pool.query(
    `
      SELECT
        al.*,
        CASE
          WHEN u.id IS NOT NULL THEN json_build_object(
            'id', u.id,
            'email', u.email,
            'name', u.name,
            'created_at', u.created_at
          )
          ELSE NULL
        END as user
      FROM public.activity_logs al
      LEFT JOIN public.users u
        ON u.id = al.user_id
      WHERE al.org_id = $1
        AND al.space_id = $2
        AND (
          (al.entity_type = 'task' AND al.entity_id = $3::uuid)
          OR (
            al.entity_type = 'comment'
            AND COALESCE(al.new_value->>'task_id', al.old_value->>'task_id') = $4
          )
        )
      ORDER BY al.created_at DESC
    `,
    [orgId, spaceId, taskId, taskId],
  );

  return result.rows.map(mapRow);
};
