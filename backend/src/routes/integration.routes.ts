import { Router } from 'express';
import { protect } from '../middlewares/auth.middleware';
import {
  getGoogleConnectUrl,
  handleGoogleCallback,
  getGoogleStatus,
  disconnectGoogle,
  handleGoogleWebhook,
  getGitHubConnectUrl,
  handleGitHubCallbackRoute,
  getGitHubStatus,
  disconnectGitHub,
} from '../controllers/integration.controller';

const router = Router();

// PUBLIC — Google calls this directly to deliver push notifications.
// Must be registered BEFORE any protect middleware routes.
router.post('/google/webhook', handleGoogleWebhook);

// Generate the Google OAuth consent URL (user must be logged in)
router.get('/google/connect', protect, getGoogleConnectUrl);

// Google redirects here after user grants/denies consent — no auth middleware
// because the JWT is not present in this redirect
router.get('/google/callback', handleGoogleCallback);

// Check connection status
router.get('/google/status', protect, getGoogleStatus);

// Disconnect Google Calendar
router.delete('/google', protect, disconnectGoogle);

// GitHub Integration
router.get('/github/connect', protect, getGitHubConnectUrl);
router.get('/github/callback', handleGitHubCallbackRoute);
router.get('/github/status', protect, getGitHubStatus);
router.delete('/github', protect, disconnectGitHub);

export default router;
