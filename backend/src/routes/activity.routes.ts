import { Router } from "express";
import { protect } from "../middlewares/auth.middleware";
import { getDashboardInfo, getActivityFeed } from "../controllers/activity.controller";

const router = Router();

// Legacy dashboard + activity endpoints — kept for backward compatibility.
// These now return empty responses. The frontend uses org-scoped endpoints instead.
router.use(protect);

router.get("/dashboard", getDashboardInfo);
router.get("/activity", getActivityFeed);

export default router;
