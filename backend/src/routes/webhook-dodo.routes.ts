import { Router, raw } from "express";
import { handleDodoWebhook } from "../controllers/webhook-dodo.controller";

const router = Router();

/**
 * POST /api/webhooks/dodo-payments
 *
 * Dodo Payments webhook receiver.
 * - NO auth middleware — authenticated via webhook signature
 * - Uses express.raw() to get the raw body for signature verification
 * - Rate-limited by Dodo's retry logic (not by us)
 */
router.post(
  "/dodo-payments",
  raw({ type: "application/json" }),
  handleDodoWebhook
);

export default router;
