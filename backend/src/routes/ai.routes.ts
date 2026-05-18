import { Router } from "express";
import { protect } from "../middlewares/auth.middleware";
import * as aiController from "../controllers/ai.controller";

const router = Router();

router.use(protect);
router.post("/chat", aiController.chat);

export default router;
