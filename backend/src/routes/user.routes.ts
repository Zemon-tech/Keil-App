import { Router } from "express";
import { protect } from "../middlewares/auth.middleware";
import { getMe, searchUsers } from "../controllers/user.controller";

const router = Router();

/**
 * @desc    Get current user profile
 * @route   GET /api/users/me
 * @access  Private (Requires Supabase JWT)
 */
router.get("/me", protect, getMe);

/**
 * @desc    Search users by name or email
 * @route   GET /api/users/search
 * @access  Private
 */
router.get("/search", protect, searchUsers);

export default router;
