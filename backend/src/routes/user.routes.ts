import { Router } from "express";
import { protect } from "../middlewares/auth.middleware";
import {
    getMe,
    completeOnboarding,
    updateProfile,
    searchUsers,
    getUserSessions,
    revokeUserSession,
    revokeAllUserSessions,
    revokeCurrentSession
} from "../controllers/user.controller";

const router = Router();

/**
 * @desc    Get current user profile
 * @route   GET /api/users/me
 * @access  Private (Requires Supabase JWT)
 */
router.get("/me", protect, getMe);

/**
 * @desc    Update user profile name/avatar
 * @route   PATCH /api/users/profile
 * @access  Private
 */
router.patch("/profile", protect, updateProfile);

/**
 * @desc    Complete user onboarding and mark in DB
 * @route   PATCH /api/users/onboard
 * @access  Private
 */
router.patch("/onboard", protect, completeOnboarding);

/**
 * @desc    Search users by name or email
 * @route   GET /api/users/search
 * @access  Private
 */
router.get("/search", protect, searchUsers);

/**
 * @desc    Get active sessions for the current user
 * @route   GET /api/users/sessions
 * @access  Private
 */
router.get("/sessions", protect, getUserSessions);

/**
 * @desc    Revoke current browser session
 * @route   DELETE /api/users/sessions/current
 * @access  Private
 */
router.delete("/sessions/current", protect, revokeCurrentSession);

/**
 * @desc    Revoke a specific session
 * @route   DELETE /api/users/sessions/:id
 * @access  Private
 */
router.delete("/sessions/:id", protect, revokeUserSession);

/**
 * @desc    Revoke all sessions for the current user
 * @route   DELETE /api/users/sessions
 * @access  Private
 */
router.delete("/sessions", protect, revokeAllUserSessions);

export default router;
