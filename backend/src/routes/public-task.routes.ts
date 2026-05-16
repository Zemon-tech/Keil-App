import { Router } from "express";
import { getPublicTask } from "../controllers/public-task.controller";

const router = Router();

// GET /api/v1/public/tasks/:taskId
// No auth middleware — unauthenticated public read-only endpoint.
// Rate limiting is handled inside the controller.
router.get("/tasks/:taskId", getPublicTask);

export default router;
