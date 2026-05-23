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
import taskLocatorRoutes from "./task-locator.routes";
import publicTaskRoutes from "./public-task.routes";
import meetingRoutes from "./meeting.routes";
import aiRoutes from "./ai.routes";
import adkRoutes from "./adk.routes"; // ← ADD THIS

const router = Router();

// ── Public task read (no auth) — must be first to avoid auth middleware clash ──
router.use("/public", publicTaskRoutes);

// ── Personal tasks ────────────────────────────────────────────────────────────
router.use("/personal", personalTaskRoutes);

// ── Organisation / space routes ───────────────────────────────────────────────
router.use("/orgs", orgRoutes);
router.use("/orgs/:orgId/spaces/:spaceId/tasks", orgTaskRoutes);
router.use("/orgs/:orgId/spaces/:spaceId/notes", motionPageRoutes);
router.use("/orgs/:orgId/spaces/:spaceId/chat", orgChatRoutes);
router.use("/orgs/:orgId/spaces/:spaceId", orgActivityRoutes);

// ── Cross-workspace task lookup (auth-only, no org/space scope) ───────────────
router.use("/tasks", taskLocatorRoutes);

// ── Integrations ──────────────────────────────────────────────────────────────
router.use("/integrations", integrationRoutes);

// ── Meetings / Recordings ─────────────────────────────────────────────────────
router.use("/meetings", meetingRoutes);

// ── AI (OpenRouter via Vercel AI SDK) ─────────────────────────────────────────
router.use("/ai", aiRoutes);

// ── Google ADK agent ──────────────────────────────────────────────────────────
router.use("/adk", adkRoutes); // ← ADD THIS

// ── Motion public links (no auth) ─────────────────────────────────────────────
// Must be registered before the catch-all activityRoutes below.
router.use("/", motionPublicRoutes);

// ── Legacy: dashboard + activity (kept for personal mode dashboard) ───────────
// v1/dashboard is still used by Dashboard.tsx in personal mode.
// Remove once personal mode has its own dashboard endpoint.
router.use("/", activityRoutes);

export default router;