import { Router } from "express";
import activityRoutes from "./activity.routes";
import personalTaskRoutes from "./personal-task.routes";
import orgRoutes from "./org.routes";
import orgTaskRoutes from "./org-task.routes";
import orgChatRoutes from "./org-chat.routes";
import orgActivityRoutes from "./org-activity.routes";
import integrationRoutes from "./integration.routes";
import motionPageRoutes from "./motion-page.routes";
import motionPublicRoutes from "./motion-public.routes";
import meetingRoutes from "./meeting.routes";

const router = Router();

// ── Personal tasks ────────────────────────────────────────────────────────────
router.use("/personal", personalTaskRoutes);

// ── Organisation / space routes ───────────────────────────────────────────────
router.use("/orgs", orgRoutes);
router.use("/orgs/:orgId/spaces/:spaceId/tasks", orgTaskRoutes);
router.use("/orgs/:orgId/spaces/:spaceId/notes", motionPageRoutes);
router.use("/orgs/:orgId/spaces/:spaceId/chat", orgChatRoutes);
router.use("/orgs/:orgId/spaces/:spaceId", orgActivityRoutes);

// ── Integrations ──────────────────────────────────────────────────────────────
router.use("/integrations", integrationRoutes);

// ── Meetings / Recordings ─────────────────────────────────────────────────────
router.use("/meetings", meetingRoutes);

// ── Motion public links (no auth) ─────────────────────────────────────────────
// Must be registered before the catch-all activityRoutes below.
router.use("/", motionPublicRoutes);

// ── Legacy: dashboard + activity (kept for personal mode dashboard) ───────────
// v1/dashboard is still used by Dashboard.tsx in personal mode.
// Remove once personal mode has its own dashboard endpoint.
router.use("/", activityRoutes);

export default router;
