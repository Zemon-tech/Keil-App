import { Request, Response } from 'express';
import { catchAsync } from '../utils/catchAsync';
import { ApiResponse } from '../utils/ApiResponse';
import { ApiError } from '../utils/ApiError';
import { config } from '../config';
import { integrationRepository } from '../repositories';
import pool from '../config/pg';
import {
  getAuthUrl,
  handleCallback,
  stopWatch,
  registerWatch,
  doIncrementalSync,
} from '../services/google-calendar.service';
import {
  getGitHubAuthUrl,
  handleGitHubCallback,
} from '../services/github.service';
import { createServiceLogger } from "../lib/logger";

const log = createServiceLogger("gcal-integration");

const PROVIDER = 'google_calendar';

/**
 * GET /api/v1/integrations/google/connect  (protected)
 * Returns the Google OAuth consent URL for the current user.
 */
export const getGoogleConnectUrl = catchAsync(async (req: Request, res: Response) => {
  const userId = (req as any).user?.id as string;
  if (!userId) throw new ApiError(401, 'Unauthorized');

  // Guard: Google OAuth must be configured
  if (!config.googleClientId || !config.googleClientSecret || !config.googleRedirectUri) {
    throw new ApiError(500, 'Google Calendar integration is not configured on this server');
  }

  const url = getAuthUrl(userId);
  res.json(new ApiResponse(200, { url }, 'Auth URL generated'));
});

/**
 * GET /api/v1/integrations/google/callback  (public — Google redirects here)
 * Exchanges the auth code for tokens and saves them.
 * Redirects back to the frontend with ?gcal=connected or ?gcal=error.
 * After redirect, fires registerWatch() as a non-blocking side-effect.
 */
export const handleGoogleCallback = async (req: Request, res: Response): Promise<void> => {
  const { code, state, error } = req.query;

  if (error || !code || !state) {
    res.redirect(`${config.frontendUrl}/tasks?gcal=error`);
    return;
  }

  try {
    const { userId } = await handleCallback(code as string, state as string);

    // Redirect first — watch registration must NEVER block or fail the connection
    res.redirect(`${config.frontendUrl}/tasks?gcal=connected`);

    // Fire-and-forget: register the push notification watch channel
    // Failure here is safe — the user is already connected and 1-way sync works
    registerWatch(userId).catch(err =>
      log.error({ err, userId }, "registerWatch failed after OAuth callback")
    );
  } catch (err) {
    log.error({ err }, "OAuth callback error");
    res.redirect(`${config.frontendUrl}/tasks?gcal=error`);
  }
};

/**
 * GET /api/v1/integrations/google/status  (protected)
 * Returns whether the current user has connected Google Calendar.
 */
export const getGoogleStatus = catchAsync(async (req: Request, res: Response) => {
  const userId = (req as any).user?.id as string;
  if (!userId) throw new ApiError(401, 'Unauthorized');

  const integration = await integrationRepository.findByUserAndProvider(userId, PROVIDER);

  if (!integration) {
    res.json(new ApiResponse(200, { connected: false }, 'Not connected'));
    return;
  }

  res.json(
    new ApiResponse(
      200,
      {
        connected: true,
        calendar_id: integration.calendar_id,
        connected_at: integration.created_at,
      },
      'Connected'
    )
  );
});

/**
 * POST /api/v1/integrations/google/sync  (protected)
 * Manually triggers an incremental Google Calendar sync for the current user.
 * Bypasses the 5-minute cooldown used for background polling.
 * Returns immediately — sync runs in the background.
 */
export const triggerGoogleSync = catchAsync(async (req: Request, res: Response) => {
  const userId = (req as any).user?.id as string;
  if (!userId) throw new ApiError(401, 'Unauthorized');

  const integration = await integrationRepository.findByUserAndProvider(userId, PROVIDER);
  if (!integration) {
    throw new ApiError(400, 'Google Calendar is not connected');
  }

  // Force a full reconciliation sync by clearing the sync token first
  await pool.query(
    `UPDATE public.user_integrations SET gcal_sync_token = NULL WHERE user_id = $1 AND provider = $2`,
    [userId, PROVIDER]
  );

  // Fire-and-forget — sync runs in the background
  doIncrementalSync(userId).catch(err =>
    log.error({ err, userId }, "Manual sync failed")
  );

  res.json(new ApiResponse(200, null, 'Sync triggered'));
});

/**
 * DELETE /api/v1/integrations/google  (protected)
 * Disconnects Google Calendar by stopping the watch channel and removing stored tokens.
 */
export const disconnectGoogle = catchAsync(async (req: Request, res: Response) => {
  const userId = (req as any).user?.id as string;
  if (!userId) throw new ApiError(401, 'Unauthorized');

  // Stop the active watch channel before deleting tokens
  // Errors are swallowed inside stopWatch — disconnect always succeeds
  await stopWatch(userId);

  await integrationRepository.delete(userId, PROVIDER);

  res.json(new ApiResponse(200, null, 'Google Calendar disconnected'));
});

// ─── Webhook Handler (2-Way Sync) ─────────────────────────────────────────────

/**
 * POST /api/v1/integrations/google/webhook  (PUBLIC — no auth middleware)
 * Receives Google Calendar push notifications.
 *
 * Security:
 * - Validates X-Goog-Channel-ID matches a known integration
 * - Validates X-Goog-Resource-ID matches the stored watch_resource_id
 * - Deduplicates via gcal_webhook_receipts table (X-Goog-Message-Number)
 * - 10-second debounce per user to prevent sync spam
 *
 * Always responds 200 immediately — Google retries on non-2xx responses.
 */
export const handleGoogleWebhook = async (req: Request, res: Response): Promise<void> => {
  // Respond 200 immediately — Google will retry if we are slow
  res.status(200).send();

  try {
    // Google's initial verification ping — just acknowledge it
    const resourceState = req.headers['x-goog-resource-state'] as string;
    if (resourceState === 'sync') {
      log.info("Webhook verification ping received — acknowledged");
      return;
    }

    const channelId = req.headers['x-goog-channel-id'] as string;
    const resourceId = req.headers['x-goog-resource-id'] as string;
    const messageNumberStr = req.headers['x-goog-message-number'] as string;

    if (!channelId || !resourceId || !messageNumberStr) {
      log.warn("Webhook received with missing headers — discarding");
      return;
    }

    // Look up which user owns this channel
    const integration = await integrationRepository.findByChannelId(channelId);
    if (!integration) {
      log.warn({ channelId }, "Webhook received for unknown channel — discarding");
      return;
    }

    // CRITICAL SECURITY CHECK: reject mismatched channel/resource pairs
    if (integration.watch_resource_id !== resourceId) {
      log.warn({
        channelId,
        expectedResourceId: integration.watch_resource_id,
        receivedResourceId: resourceId,
      }, "SECURITY: Mismatched resourceId — discarding");
      return;
    }

    // Webhook replay protection — insert receipt; 23505 = duplicate
    const messageNumber = BigInt(messageNumberStr);
    try {
      await pool.query(
        `INSERT INTO public.gcal_webhook_receipts (channel_id, resource_id, message_number)
         VALUES ($1, $2, $3)`,
        [channelId, resourceId, messageNumber]
      );
    } catch (err: any) {
      if (err.code === '23505') {
        log.debug({ channelId, messageNumber: messageNumberStr }, "Duplicate webhook message — discarding");
        return;
      }
      throw err;
    }

    const userId = integration.user_id;

    // 10-second debounce: skip if a sync was triggered within the last 10 seconds
    // If debounced, schedule a delayed sync instead of dropping it entirely
    const debounceResult = await pool.query(
      `UPDATE public.user_integrations
       SET last_sync_at = NOW()
       WHERE user_id = $1
         AND (last_sync_at IS NULL OR last_sync_at < NOW() - INTERVAL '10 seconds')
       RETURNING user_id`,
      [userId]
    );

    if (debounceResult.rows.length === 0) {
      log.debug({ userId }, 'Webhook debounced — scheduling delayed sync');
      // Schedule a delayed sync so the change isn't lost
      setTimeout(() => {
        doIncrementalSync(userId).catch(err =>
          log.error({ err, userId }, "Delayed incremental sync failed")
        );
      }, 12000);
      return;
    }

    log.info({ userId }, 'Webhook received — triggering incremental sync');

    // Enqueue incremental sync as a background job (never block the request chain)
    process.nextTick(() => {
      doIncrementalSync(userId).catch(err =>
        log.error({ err, userId }, 'Background incremental sync failed')
      );
    });

  } catch (err: any) {
    // Never let webhook processing errors propagate — 200 was already sent
    log.error({ err }, "Webhook handler error");
  }
};

// ─── GitHub Integration Handlers ──────────────────────────────────────────────

/**
 * GET /api/v1/integrations/github/connect  (protected)
 * Returns the GitHub OAuth consent URL for the current user.
 */
export const getGitHubConnectUrl = catchAsync(async (req: Request, res: Response) => {
  const userId = (req as any).user?.id as string;
  if (!userId) throw new ApiError(401, 'Unauthorized');

  if (!config.githubClientId || !config.githubClientSecret) {
    throw new ApiError(500, 'GitHub integration is not configured on this server');
  }

  const url = getGitHubAuthUrl(userId);
  res.json(new ApiResponse(200, { url }, 'GitHub Auth URL generated'));
});

/**
 * GET /api/v1/integrations/github/callback  (public — GitHub redirects here)
 * Exchanges the auth code for GitHub access token and saves it.
 * Redirects back to the frontend with ?github=connected or ?github=error.
 */
export const handleGitHubCallbackRoute = async (req: Request, res: Response): Promise<void> => {
  const { code, state, error } = req.query;

  if (error || !code || !state) {
    res.redirect(`${config.frontendUrl}/tasks?github=error`);
    return;
  }

  try {
    await handleGitHubCallback(code as string, state as string);
    res.redirect(`${config.frontendUrl}/tasks?github=connected`);
  } catch (err) {
    log.error({ err }, "GitHub OAuth callback error");
    res.redirect(`${config.frontendUrl}/tasks?github=error`);
  }
};

/**
 * GET /api/v1/integrations/github/status  (protected)
 * Returns whether the current user has connected GitHub.
 */
export const getGitHubStatus = catchAsync(async (req: Request, res: Response) => {
  const userId = (req as any).user?.id as string;
  if (!userId) throw new ApiError(401, 'Unauthorized');

  const integration = await integrationRepository.findByUserAndProvider(userId, 'github');

  if (!integration) {
    res.json(new ApiResponse(200, { connected: false }, 'Not connected'));
    return;
  }

  res.json(
    new ApiResponse(
      200,
      {
        connected: true,
        connected_at: integration.created_at,
      },
      'Connected'
    )
  );
});

/**
 * DELETE /api/v1/integrations/github  (protected)
 * Disconnects GitHub by removing stored tokens.
 */
export const disconnectGitHub = catchAsync(async (req: Request, res: Response) => {
  const userId = (req as any).user?.id as string;
  if (!userId) throw new ApiError(401, 'Unauthorized');

  await integrationRepository.delete(userId, 'github');

  res.json(new ApiResponse(200, null, 'GitHub disconnected'));
});

