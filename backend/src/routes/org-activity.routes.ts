import { Router } from "express";
import { protect } from "../middlewares/auth.middleware";
import { requireOrgMember, requireSpaceMember } from "../middlewares/org-context.middleware";
import { getActivityFeed, getDashboardInfo } from "../controllers/org-activity.controller";

const router = Router({ mergeParams: true });

router.use(protect, requireOrgMember, requireSpaceMember);

router.get("/dashboard", getDashboardInfo);
router.get("/activity", getActivityFeed);

export default router;
