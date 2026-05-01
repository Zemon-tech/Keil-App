import { Request, Response } from 'express';
import { catchAsync } from '../utils/catchAsync';
import { ApiResponse } from '../utils/ApiResponse';
import { ApiError } from '../utils/ApiError';
import { config } from '../config';
import { integrationRepository } from '../repositories';
import {
  getAuthUrl,
  handleCallback,
} from '../services/google-calendar.service';

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
 */
export const handleGoogleCallback = async (req: Request, res: Response): Promise<void> => {
  const { code, state, error } = req.query;

  if (error || !code || !state) {
    res.redirect(`${config.frontendUrl}/tasks?gcal=error`);
    return;
  }

  try {
    await handleCallback(code as string, state as string);
    res.redirect(`${config.frontendUrl}/tasks?gcal=connected`);
  } catch (err) {
    console.error('[gcal] OAuth callback error:', (err as Error).message);
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
 * DELETE /api/v1/integrations/google  (protected)
 * Disconnects Google Calendar by removing stored tokens.
 */
export const disconnectGoogle = catchAsync(async (req: Request, res: Response) => {
  const userId = (req as any).user?.id as string;
  if (!userId) throw new ApiError(401, 'Unauthorized');

  await integrationRepository.delete(userId, PROVIDER);

  res.json(new ApiResponse(200, null, 'Google Calendar disconnected'));
});
