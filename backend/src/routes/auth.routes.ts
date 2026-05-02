import { Router } from "express";
import { getGoogleAuthUrl, googleCallback } from "../controllers/auth.controller";

const router = Router();

// GET /api/auth/google/url
// Returns the Google OAuth authorization URL
router.get("/google/url", getGoogleAuthUrl);

// GET /api/auth/google/callback
// Handles the OAuth callback from Google
router.get("/google/callback", googleCallback);

export default router;
