import { Request, Response, NextFunction } from "express";
import { userSubscriptionRepository } from "../repositories";
import { SubscriptionStatus } from "../types/billing";
import logger from "../lib/logger";

/**
 * Global subscription enforcement middleware.
 * Runs AFTER auth middleware on all protected routes.
 *
 * Behavior:
 * - locked/expired → 403 (hard block, only /billing/export and /billing/plan allowed)
 * - past_due → passes through with x-plan-warning header
 * - trialing/active/cancelled → passes through normally
 *
 * Attaches subscription info to req for downstream handlers.
 */
export const requireActiveSubscription = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const userId = (req as any).user?.id as string;

  // If no user attached (shouldn't happen after auth middleware), skip
  if (!userId) {
    next();
    return;
  }

  // Allow billing and export endpoints even when locked
  const path = req.path;
  if (isBillingExempt(path)) {
    next();
    return;
  }

  try {
    const sub = await userSubscriptionRepository.findByUserId(userId);

    if (!sub) {
      // No subscription record — treat as locked (shouldn't happen due to trigger)
      res.status(403).json({
        success: false,
        code: "ACCOUNT_LOCKED",
        message: "No active subscription. Please subscribe to continue using KeilHQ.",
      });
      return;
    }

    // Attach subscription to request for downstream use
    (req as any).subscription = sub;

    switch (sub.status) {
      case SubscriptionStatus.LOCKED:
        res.status(403).json({
          success: false,
          code: "ACCOUNT_LOCKED",
          message: "Your account is locked. Please subscribe to regain access.",
          export_url: "/api/v1/billing/export",
        });
        return;

      case SubscriptionStatus.EXPIRED:
        res.status(403).json({
          success: false,
          code: "SUBSCRIPTION_EXPIRED",
          message: "Your trial has expired. Please subscribe to continue using KeilHQ.",
          subscribe_url: "/api/v1/billing/checkout",
        });
        return;

      case SubscriptionStatus.PAST_DUE:
        // Soft warning — allow access but signal the frontend
        res.setHeader("x-plan-warning", "payment_past_due");
        next();
        return;

      case SubscriptionStatus.TRIALING:
      case SubscriptionStatus.ACTIVE:
      case SubscriptionStatus.CANCELLED:
        // All good — cancelled still has access until period end
        next();
        return;

      default:
        next();
    }
  } catch (err) {
    // Don't block the request on billing system failures
    logger.error({ err, userId }, "Subscription middleware error — allowing request");
    next();
  }
};

/**
 * Paths that are exempt from subscription checks.
 * Users need access to billing endpoints to subscribe/export even when locked.
 */
function isBillingExempt(path: string): boolean {
  // Billing routes are all under /billing
  if (path.startsWith("/billing")) return true;
  // Health check
  if (path.startsWith("/health")) return true;
  return false;
}
