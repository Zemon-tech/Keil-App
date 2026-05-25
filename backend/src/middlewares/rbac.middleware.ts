import { NextFunction, Request, Response } from "express";
import { OrgRole, SpaceRole } from "../types/enums";
import logger from "../lib/logger";

export const requireOrgRole = (...allowedRoles: OrgRole[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const userId = (req as any).user?.id as string | undefined;
      const actualRole = (req as any).org?.membership_role as OrgRole | undefined;

      if (!actualRole || !allowedRoles.includes(actualRole)) {
        logger.warn({
          userId: userId ?? "unknown",
          requiredRoles: allowedRoles,
          actualRole: actualRole ?? "none",
          method: req.method,
          url: req.originalUrl,
        }, "RBAC denied — insufficient org permissions");
        res.status(403).json({ success: false, message: "Insufficient permissions" });
        return;
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

export const requireSpaceRole = (...allowedRoles: SpaceRole[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const userId = (req as any).user?.id as string | undefined;
      const actualRole = (req as any).space?.membership_role as SpaceRole | undefined;

      if (!actualRole || !allowedRoles.includes(actualRole)) {
        logger.warn({
          userId: userId ?? "unknown",
          requiredRoles: allowedRoles,
          actualRole: actualRole ?? "none",
          method: req.method,
          url: req.originalUrl,
        }, "RBAC denied — insufficient space permissions");
        res.status(403).json({ success: false, message: "Insufficient permissions" });
        return;
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};
