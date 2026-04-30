import { NextFunction, Request, Response } from "express";
import pool from "../config/pg";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const isUuid = (value: string | undefined): value is string =>
  typeof value === "string" && UUID_REGEX.test(value);

const asString = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value;

export const requireOrgMember = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const orgId = asString(req.params.orgId);
    const userId = (req as any).user?.id as string | undefined;

    if (!isUuid(orgId)) {
      res.status(400).json({ success: false, message: "Invalid organisation id" });
      return;
    }

    if (!userId) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const result = await pool.query(
      `
        SELECT
          o.*,
          om.role as membership_role
        FROM public.organisations o
        INNER JOIN public.organisation_members om
          ON om.org_id = o.id
        WHERE o.id = $1
          AND om.user_id = $2
          AND o.deleted_at IS NULL
        LIMIT 1
      `,
      [orgId, userId],
    );

    if (result.rows.length === 0) {
      res.status(403).json({ success: false, message: "Not a member of this organisation" });
      return;
    }

    (req as any).org = result.rows[0];
    next();
  } catch (error) {
    next(error);
  }
};

export const requireSpaceMember = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const orgId = asString(req.params.orgId);
    const spaceId = asString(req.params.spaceId);
    const userId = (req as any).user?.id as string | undefined;

    if (!isUuid(orgId) || !isUuid(spaceId)) {
      res.status(400).json({ success: false, message: "Invalid organisation or space id" });
      return;
    }

    if (!userId) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const result = await pool.query(
      `
        SELECT
          s.*,
          sm.role as membership_role,
          COALESCE(s.workspace_id, o.source_workspace_id) as compatibility_workspace_id
        FROM public.spaces s
        INNER JOIN public.space_members sm
          ON sm.space_id = s.id
        INNER JOIN public.organisations o
          ON o.id = s.org_id
        WHERE s.id = $1
          AND s.org_id = $2
          AND sm.user_id = $3
          AND s.deleted_at IS NULL
        LIMIT 1
      `,
      [spaceId, orgId, userId],
    );

    if (result.rows.length === 0) {
      res.status(403).json({ success: false, message: "Not a member of this space" });
      return;
    }

    (req as any).space = result.rows[0];
    next();
  } catch (error) {
    next(error);
  }
};
