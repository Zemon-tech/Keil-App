import { Router } from "express";
import activityRoutes from "./activity.routes";
import personalTaskRoutes from "./personal-task.routes";
import orgRoutes from "./org.routes";
import orgTaskRoutes from "./org-task.routes";
import orgChatRoutes from "./org-chat.routes";
import orgActivityRoutes from "./org-activity.routes";
import integrationRoutes from "./integration.routes";
import gmailRoutes from "./gmail.routes";
import motionPageRoutes from "./motion-page.routes";
import motionPublicRoutes from "./motion-public.routes";
import billingRoutes from "./billing.routes";
import { requireActiveSubscription } from "../middlewares/subscription.middleware";
import taskLocatorRoutes from "./task-locator.routes";
import publicTaskRoutes from "./public-task.routes";
import meetingRoutes from "./meeting.routes";
import motionRoutes from "./motion.routes";
import analyticsRoutes from "./analytics.routes";
import aiRoutes from "./ai.routes";
import notificationRoutes from "./notification.routes";
import preferencesRoutes from "./preferences.routes";
import s3UploadRoutes from "./s3-upload.routes";

const router = Router();

//--------Analytics-------
router.use("/orgs/:orgId/spaces/:spaceId/analytics", analyticsRoutes);

// ── Notifications ─────────────────────────────────────────────────────────────
router.use("/notifications", notificationRoutes);

// ── Public task read (no auth) — must be first to avoid auth middleware clash ──
router.use("/public", publicTaskRoutes);

// ── Billing & Subscriptions (Dodo Payments) — exempt from subscription check ─
router.use("/billing", billingRoutes);

// ── Subscription enforcement (blocks locked/expired users on all routes below) ─
router.use(requireActiveSubscription);

// ── Personal tasks ────────────────────────────────────────────────────────────
router.use("/personal", personalTaskRoutes);

// ── Organisation / space routes ───────────────────────────────────────────────
router.use("/orgs", orgRoutes);
router.use("/orgs/:orgId/spaces/:spaceId/tasks", orgTaskRoutes);
router.use("/orgs/:orgId/spaces/:spaceId/notes", motionPageRoutes);
router.use("/orgs/:orgId/spaces/:spaceId/chat", orgChatRoutes);
router.use("/orgs/:orgId/spaces/:spaceId", orgActivityRoutes);

// ── Cross-org task lookup (auth-only, no org/space scope) ─────────────────────
router.use("/tasks", taskLocatorRoutes);

// ── Gmail inbox integration ───────────────────────────────────────────────────
router.use("/gmail", gmailRoutes);

// ── Integrations ──────────────────────────────────────────────────────────────
router.use("/integrations", integrationRoutes);

// ── Meetings / Recordings ─────────────────────────────────────────────────────
router.use("/meetings", meetingRoutes);

// ── User App Preferences ──────────────────────────────────────────────────────
router.use("/preferences", preferencesRoutes);

// ── S3 General Uploads ────────────────────────────────────────────────────────
router.use("/s3-upload", s3UploadRoutes);

// ── AI (OpenRouter via Vercel AI SDK) ─────────────────────────────────────────
router.use("/ai", aiRoutes);

router.use("/motions", motionRoutes);

// ── Motion public links (no auth) ─────────────────────────────────────────────
// Must be registered before the catch-all activityRoutes below.
router.use("/", motionPublicRoutes);

// ── Legacy: dashboard + activity (kept for personal mode dashboard) ───────────
// v1/dashboard is still used by Dashboard.tsx in personal mode.
// Remove once personal mode has its own dashboard endpoint.
router.use("/", activityRoutes);

export default router;