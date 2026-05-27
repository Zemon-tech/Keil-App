import { Router } from "express";
import { protect } from "../middlewares/auth.middleware";
import { getMe } from "../controllers/user.controller";

const router = Router();

/**
 * @desc    Get current user profile
 * @route   GET /api/users/me
 * @access  Private (Requires Supabase JWT)
 */
router.get("/me", protect, getMe);

export default router;
