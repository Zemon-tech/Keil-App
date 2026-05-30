import { Router } from "express";
import { protect } from "../middlewares/auth.middleware";
import * as preferencesController from "../controllers/user-preferences.controller";

const router = Router();

// All preference routes require authentication
router.use(protect);

// GET /api/v1/preferences — fetch user app preferences
router.get("/", preferencesController.getPreferences);

// PATCH /api/v1/preferences/stt-provider — update STT provider
router.patch("/stt-provider", preferencesController.updateSttProvider);

export default router;
