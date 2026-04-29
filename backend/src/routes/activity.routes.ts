import { Router } from "express";
import { attachWorkspaceContext, protect } from "../middlewares/auth.middleware";
import { getDashboardInfo, getActivityFeed } from "../controllers/activity.controller";

const router = Router();

// All activity and dashboard endpoints require authentication
router.use(protect, attachWorkspaceContext);

router.get("/dashboard", getDashboardInfo);
router.get("/activity", getActivityFeed);

export default router;
