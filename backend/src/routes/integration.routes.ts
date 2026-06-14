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
import {
  getNotionConnectUrl,
  handleNotionCallbackRoute,
  connectNotionManual,
  getNotionStatus,
  disconnectNotion,
  importPage,
  exportPage,
  syncPage,
  unlinkPage,
} from '../controllers/notion.controller';

const router = Router();

// PUBLIC — Google calls this directly to deliver push notifications.
// Must be registered BEFORE any protect middleware routes.
router.post('/google/webhook', handleGoogleWebhook);

// Google redirects here after user grants/denies consent — no auth middleware
// because the JWT is not present in this redirect
router.get('/google/callback', handleGoogleCallback);

// Google OAuth
router.get('/google/connect', protect, getGoogleConnectUrl);
router.get('/google/status', protect, getGoogleStatus);
router.delete('/google', protect, disconnectGoogle);

// GitHub Integration
router.get('/github/connect', protect, getGitHubConnectUrl);
router.get('/github/callback', handleGitHubCallbackRoute);
router.get('/github/status', protect, getGitHubStatus);
router.delete('/github', protect, disconnectGitHub);

// Notion Integration
router.get('/notion/connect', protect, getNotionConnectUrl);
router.get('/notion/callback', handleNotionCallbackRoute);
router.post('/notion/manual-connect', protect, connectNotionManual);
router.get('/notion/status', protect, getNotionStatus);
router.delete('/notion', protect, disconnectNotion);
router.post('/notion/import', protect, importPage);
router.post('/notion/export', protect, exportPage);
router.post('/notion/sync', protect, syncPage);
router.post('/notion/unlink', protect, unlinkPage);

export default router;
