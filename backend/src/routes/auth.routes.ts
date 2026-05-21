import { Router } from "express";
import { getGoogleAuthUrl, googleCallback } from "../controllers/auth.controller";
import { protect } from "../middlewares/auth.middleware";

const router = Router();

// GET /api/auth/google/url
// Returns the Google OAuth authorization URL
router.get("/google/url", protect, getGoogleAuthUrl);

// GET /api/auth/google/callback
// Handles the OAuth callback from Google
router.get("/google/callback", googleCallback);

export default router;
