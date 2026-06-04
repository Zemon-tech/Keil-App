import { Router } from "express";
import { protect } from "../middlewares/auth.middleware";
import * as aiController from "../controllers/ai.controller";

const router = Router();

// All AI routes require authentication
router.use(protect);

// Thread management
router.get("/threads", aiController.listThreads);
router.delete("/threads/:threadId", aiController.deleteThread);
router.get("/threads/:threadId/messages", aiController.getThreadMessages);
router.put("/threads/:threadId", aiController.renameThread);

export default router;
