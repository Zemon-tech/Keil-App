import { Router } from "express";
import { protect } from "../middlewares/auth.middleware";
import { requireOrgMember, requireSpaceMember } from "../middlewares/org-context.middleware";
import { getTasksCompletedDaily } from "../controllers/analytics.controller";

const router = Router({ mergeParams: true });

router.use(protect, requireOrgMember, requireSpaceMember);

router.get("/tasks-completed-daily", getTasksCompletedDaily);

export default router;
