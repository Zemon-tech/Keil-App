import { Router } from "express";
import { getDashboardInfo, getActivityFeed } from "../controllers/activity.controller";

const router = Router();

router.get("/dashboard", getDashboardInfo);
router.get("/activity", getActivityFeed);

export default router;
