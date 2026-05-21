import { Router } from "express";
import { protect } from "../middlewares/auth.middleware";
import { getMyTasks } from "../controllers/my-tasks.controller";

const router = Router();

// GET /api/v1/my-tasks
// Protected — requires a valid session. No org/space scope needed;
// aggregates assigned tasks across all organisations.
router.get("/", protect, getMyTasks);

export default router;
