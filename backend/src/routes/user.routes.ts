import { Router } from "express";
import { protect } from "../middlewares/auth.middleware";

const router = Router();

/**
 * @desc    Get current user profile (synced from MongoDB)
 * @route   GET /api/users/me
 * @access  Private (Requires Supabase JWT)
 */
router.get("/me", protect, (req, res) => {
    res.json({
        success: true,
        data: (req as any).user,
    });
});

export default router;
