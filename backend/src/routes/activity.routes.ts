import { Router } from "express";
import { protect } from "../middlewares/auth.middleware";
import { getDashboardInfo, getActivityFeed } from "../controllers/activity.controller";

const router = Router();

// Legacy dashboard + activity — kept for personal mode dashboard in Dashboard.tsx.
// Uses protect only; workspaceId is resolved inside the controller from the user's
// first workspace membership. Returns empty gracefully when no workspace exists.
router.use(protect);

router.get("/dashboard", getDashboardInfo);
router.get("/activity", getActivityFeed);

export default router;
