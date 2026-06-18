import { Router } from "express";
import { protect } from "../middlewares/auth.middleware";
import {
  getUserPlan,
  createUserCheckout,
  getPortalUrl,
  getOrgPlan,
  createOrgCheckout,
  exportUserData,
} from "../controllers/billing.controller";

const router = Router();

// All billing routes require authentication
router.use(protect);

// ── User-level billing ────────────────────────────────────────────────────────

/** GET /api/v1/billing/plan — Get current user's plan, status, usage, limits */
router.get("/plan", getUserPlan);

/** POST /api/v1/billing/checkout — Create Pro plan checkout session */
router.post("/checkout", createUserCheckout);

/** GET /api/v1/billing/portal — Get Dodo Customer Portal URL */
router.get("/portal", getPortalUrl);

/** GET /api/v1/billing/export — Export user data (accessible even when locked) */
router.get("/export", exportUserData);

// ── Org-level billing (Teams) ─────────────────────────────────────────────────

/** GET /api/v1/billing/org/:orgId/plan — Get org's Teams subscription */
router.get("/org/:orgId/plan", getOrgPlan);

/** POST /api/v1/billing/org/:orgId/checkout — Create Teams checkout for org */
router.post("/org/:orgId/checkout", createOrgCheckout);

export default router;
