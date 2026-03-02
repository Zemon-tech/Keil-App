import { Router } from "express";
import workspaceRoutes from "./workspace.routes";
import taskRoutes from "./task.routes";
import commentRoutes from "./comment.routes";
import activityRoutes from "./activity.routes";

const router = Router();

router.use("/workspaces", workspaceRoutes);
router.use("/tasks", taskRoutes);
router.use("/comments", commentRoutes);

// Activity and Dashboard routes (using /api/v1 prefix)
router.use("/", activityRoutes);

export default router;
