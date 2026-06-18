import { Request, Response } from "express";
import { catchAsync } from "../utils/catchAsync";
import { ApiError } from "../utils/ApiError";
import { config } from "../config";
import * as subscriptionService from "../services/subscription.service";
import { createCheckoutSession, createPortalSession } from "../services/dodo.client";
import { userSubscriptionRepository, orgSubscriptionRepository } from "../repositories";
import { organisationRepository } from "../repositories";
import { SubscriptionPlan } from "../types/billing";
import { generateUserExport } from "../services/data-export.service";
import logger from "../lib/logger";

// =============================================================================
// GET /api/v1/billing/plan — Current user's plan, status, usage
// =============================================================================

export const getUserPlan = catchAsync(async (req: Request, res: Response) => {
  const userId = (req as any).user?.id as string;

  const plan = await subscriptionService.getUserPlan(userId);

  // Populate portal URL if user has a Dodo customer ID
  const sub = await userSubscriptionRepository.findByUserId(userId);
  if (sub?.dodo_customer_id) {
    try {
      plan.portal_url = await createPortalSession(sub.dodo_customer_id);
    } catch (err) {
      logger.warn({ err, userId }, "Failed to generate Dodo portal URL");
      plan.portal_url = null;
    }
  }

  res.status(200).json({ success: true, data: plan });
});

// =============================================================================
// POST /api/v1/billing/checkout — Create checkout session for Pro plan
// =============================================================================

export const createUserCheckout = catchAsync(async (req: Request, res: Response) => {
  const userId = (req as any).user?.id as string;
  const userEmail = (req as any).user?.email as string;
  const userName = (req as any).user?.name as string | undefined;

  if (!config.dodoProductPro) {
    throw new ApiError(500, "Dodo Pro product ID not configured");
  }

  // Check if user already has an active paid subscription
  const sub = await userSubscriptionRepository.findByUserId(userId);
  if (sub && sub.plan === SubscriptionPlan.PRO_PAID && sub.status === "active") {
    throw new ApiError(400, "You already have an active Pro subscription");
  }

  const { checkoutUrl } = await createCheckoutSession({
    productId: config.dodoProductPro,
    customerEmail: userEmail,
    customerName: userName || undefined,
    metadata: { user_id: userId },
    trialPeriodDays: sub?.status === "trialing" ? undefined : undefined, // Trial managed by Dodo product config
  });

  res.status(200).json({ success: true, checkout_url: checkoutUrl });
});

// =============================================================================
// GET /api/v1/billing/portal — Dodo Customer Portal URL
// =============================================================================

export const getPortalUrl = catchAsync(async (req: Request, res: Response) => {
  const userId = (req as any).user?.id as string;

  const sub = await userSubscriptionRepository.findByUserId(userId);
  if (!sub?.dodo_customer_id) {
    throw new ApiError(400, "No active subscription found. Subscribe first to manage your billing.");
  }

  const portalUrl = await createPortalSession(sub.dodo_customer_id);
  res.status(200).json({ success: true, portal_url: portalUrl });
});

// =============================================================================
// GET /api/v1/billing/org/:orgId/plan — Org's Teams subscription
// =============================================================================

export const getOrgPlan = catchAsync(async (req: Request, res: Response) => {
  const userId = (req as any).user?.id as string;
  const orgId = req.params.orgId as string;

  // Verify user is a member of this org
  const role = await organisationRepository.getMemberRole(orgId, userId);
  if (!role) {
    throw new ApiError(403, "You are not a member of this organisation");
  }

  const orgPlan = await subscriptionService.getOrgPlan(orgId);

  if (orgPlan) {
    // Populate portal URL if org has a Dodo customer ID
    const orgSub = await orgSubscriptionRepository.findByOrgId(orgId);
    if (orgSub?.dodo_customer_id && (role === "owner" || role === "admin")) {
      try {
        orgPlan.portal_url = await createPortalSession(orgSub.dodo_customer_id);
      } catch (err) {
        logger.warn({ err, orgId }, "Failed to generate Dodo portal URL for org");
        orgPlan.portal_url = null;
      }
    }
  }

  res.status(200).json({
    success: true,
    data: orgPlan || { plan: null, message: "No Teams subscription for this organisation" },
  });
});

// =============================================================================
// POST /api/v1/billing/org/:orgId/checkout — Create Teams checkout
// =============================================================================

export const createOrgCheckout = catchAsync(async (req: Request, res: Response) => {
  const userId = (req as any).user?.id as string;
  const userEmail = (req as any).user?.email as string;
  const userName = (req as any).user?.name as string | undefined;
  const orgId = req.params.orgId as string;
  const { seats } = req.body;

  if (!config.dodoProductTeams) {
    throw new ApiError(500, "Dodo Teams product ID not configured");
  }

  // Only org owner can purchase Teams
  const role = await organisationRepository.getMemberRole(orgId, userId);
  if (role !== "owner") {
    throw new ApiError(403, "Only the organisation owner can purchase a Teams subscription");
  }

  // Validate seats
  const seatCount = parseInt(seats, 10);
  if (!seatCount || seatCount < 1) {
    throw new ApiError(400, "Must purchase at least 1 seat");
  }

  // Check if org already has active Teams subscription
  const existingSub = await orgSubscriptionRepository.findByOrgId(orgId);
  if (existingSub && existingSub.status === "active") {
    throw new ApiError(400, "This organisation already has an active Teams subscription. Use the portal to manage seats.");
  }

  const { checkoutUrl } = await createCheckoutSession({
    productId: config.dodoProductTeams,
    customerEmail: userEmail,
    customerName: userName || undefined,
    quantity: seatCount,
    metadata: { user_id: userId, org_id: orgId },
  });

  res.status(200).json({ success: true, checkout_url: checkoutUrl });
});

// =============================================================================
// GET /api/v1/billing/export — Data export (works even when locked)
// =============================================================================

export const exportUserData = catchAsync(async (req: Request, res: Response) => {
  const userId = (req as any).user?.id as string;

  const exportData = await generateUserExport(userId);

  // Set headers for JSON download
  const filename = `keilhq-export-${new Date().toISOString().split("T")[0]}.json`;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

  res.status(200).json(exportData);
});
