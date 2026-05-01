import { Router } from "express";
import workspaceRoutes from "./workspace.routes";
import taskRoutes from "./task.routes";
import commentRoutes from "./comment.routes";
import activityRoutes from "./activity.routes";
import chatRoutes from "./chat.routes";
import personalTaskRoutes from "./personal-task.routes";
import orgRoutes from "./org.routes";
import orgTaskRoutes from "./org-task.routes";
import orgChatRoutes from "./org-chat.routes";
import orgActivityRoutes from "./org-activity.routes";
import integrationRoutes from "./integration.routes";

const router = Router();

router.use("/workspaces", workspaceRoutes);
router.use("/tasks", taskRoutes);
router.use("/comments", commentRoutes);
router.use("/chat", chatRoutes);
router.use("/personal", personalTaskRoutes);
router.use("/orgs", orgRoutes);
router.use("/orgs/:orgId/spaces/:spaceId/tasks", orgTaskRoutes);
router.use("/orgs/:orgId/spaces/:spaceId/chat", orgChatRoutes);
router.use("/orgs/:orgId/spaces/:spaceId", orgActivityRoutes);
router.use("/integrations", integrationRoutes);

// Activity and Dashboard routes (using /api/v1 prefix)
router.use("/", activityRoutes);

export default router;
