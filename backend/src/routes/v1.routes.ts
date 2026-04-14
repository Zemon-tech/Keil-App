import { Router } from "express";
import workspaceRoutes from "./workspace.routes";
import taskRoutes from "./task.routes";
import commentRoutes from "./comment.routes";
import activityRoutes from "./activity.routes";
import chatRoutes from "./chat.routes";
import scheduleRoutes from "./schedule.routes";

const router = Router();

router.use("/workspaces", workspaceRoutes);
router.use("/tasks", taskRoutes);
router.use("/comments", commentRoutes);
router.use("/chat", chatRoutes);
router.use("/schedule", scheduleRoutes);

// Activity and Dashboard routes (using /api/v1 prefix)
router.use("/", activityRoutes);

export default router;
