import { Router } from "express";
import { protect } from "../middlewares/auth.middleware";
import { locateTask } from "../controllers/task-locator.controller";

const router = Router();

// GET /api/v1/tasks/:taskId/locate
// Protected — requires a valid session. No org/space scoping needed;
// the controller itself enforces membership checks.
router.get("/:taskId/locate", protect, locateTask);

export default router;
