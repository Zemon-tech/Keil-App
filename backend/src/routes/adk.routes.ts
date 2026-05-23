import { Router } from "express";
import { protect } from "../middlewares/auth.middleware";
import * as adkController from "../controllers/adk.controller";

const router = Router();

// All ADK routes require an authenticated user
router.use(protect);

/**
 * POST /api/v1/adk/chat
 * Body: { message: string, sessionId?: string }
 */
router.post("/chat", adkController.chat);

export default router;
