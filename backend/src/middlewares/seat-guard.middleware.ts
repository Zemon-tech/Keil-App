import { Request, Response, NextFunction } from "express";
import { orgSubscriptionRepository } from "../repositories";
import logger from "../lib/logger";

/**
 * Seat guard middleware for org member addition flows.
 * Blocks adding new members if the org has a Teams subscription and no available seats.
 *
 * Usage: Apply to routes that add members to an org (invite, join).
 * Expects orgId to be available in req.params.orgId or req.body.orgId.
 *
 * If no Teams subscription exists for the org, allows the request (free/Pro orgs have no seat limit).
 */
export const requireAvailableSeat = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const orgId = (req.params.orgId as string) || req.body?.orgId;

    if (!orgId) {
      // Can't determine org — skip check, let downstream handle
      next();
      return;
    }

    const orgSub = await orgSubscriptionRepository.findByOrgId(orgId);

    // No Teams subscription → no seat restriction
    if (!orgSub) {
      next();
      return;
    }

    // Teams subscription exists — check seat availability
    if (orgSub.seats_used >= orgSub.seats_purchased) {
      res.status(403).json({
        success: false,
        code: "NO_SEATS_AVAILABLE",
        message: `This organisation has used all ${orgSub.seats_purchased} purchased seats. The org owner must purchase more seats before adding new members.`,
        seats_purchased: orgSub.seats_purchased,
        seats_used: orgSub.seats_used,
      });
      return;
    }

    next();
  } catch (err) {
    // Don't block on billing system failures — allow the join
    logger.error({ err }, "Seat guard middleware error — allowing request");
    next();
  }
};
