import { Request, Response } from 'express';
import { catchAsync } from '../utils/catchAsync';
import { ApiResponse } from '../utils/ApiResponse';
import { ApiError } from '../utils/ApiError';
import { config } from '../config';
import pool from '../config/pg';
import { integrationRepository, motionPageRepository } from '../repositories';
import {
  getNotionAuthUrl,
  handleNotionCallback,
  connectNotionWithManualToken,
  importNotionPage,
  exportMotionPage,
  syncNotionAndMotion,
} from '../services/notion.service';

const PROVIDER = 'notion';

/**
 * GET /api/v1/integrations/notion/connect
 * Returns the Notion OAuth consent URL.
 */
export const getNotionConnectUrl = catchAsync(async (req: Request, res: Response) => {
  const userId = (req as any).user?.id as string;
  if (!userId) throw new ApiError(401, 'Unauthorized');

  const url = getNotionAuthUrl(userId);
  res.json(new ApiResponse(200, { url }, 'Notion Auth URL generated'));
});

/**
 * GET /api/v1/integrations/notion/callback (Public)
 * Handles Notion redirect, exchanges code for token, and redirects back to frontend.
 */
export const handleNotionCallbackRoute = async (req: Request, res: Response): Promise<void> => {
  const { code, state, error } = req.query;

  if (error || !code || !state) {
    res.redirect(`${config.frontendUrl}/motion?notion=error`);
    return;
  }

  try {
    await handleNotionCallback(code as string, state as string);
    res.redirect(`${config.frontendUrl}/motion?notion=connected`);
  } catch (err) {
    res.redirect(`${config.frontendUrl}/motion?notion=error`);
  }
};

/**
 * POST /api/v1/integrations/notion/manual-connect
 * Connects Notion manually using an integration token.
 */
export const connectNotionManual = catchAsync(async (req: Request, res: Response) => {
  const userId = (req as any).user?.id as string;
  if (!userId) throw new ApiError(401, 'Unauthorized');

  const { token, workspaceName } = req.body;
  if (!token) throw new ApiError(400, 'Notion token is required');

  await connectNotionWithManualToken(userId, token, workspaceName);
  res.json(new ApiResponse(200, null, 'Notion connected successfully'));
});

/**
 * GET /api/v1/integrations/notion/status
 * Returns connection status and details.
 */
export const getNotionStatus = catchAsync(async (req: Request, res: Response) => {
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
        workspace_name: integration.calendar_id, // stored here as dummy metadata field
        connected_at: integration.created_at,
      },
      'Connected'
    )
  );
});

/**
 * DELETE /api/v1/integrations/notion
 * Disconnects Notion by deleting the integration tokens.
 */
export const disconnectNotion = catchAsync(async (req: Request, res: Response) => {
  const userId = (req as any).user?.id as string;
  if (!userId) throw new ApiError(401, 'Unauthorized');

  await integrationRepository.delete(userId, PROVIDER);

  // Clear all Notion links for this user's pages
  await pool.query(
    `UPDATE public.motion_pages
     SET notion_page_id = NULL, notion_last_synced_at = NULL
     WHERE created_by = $1`,
    [userId]
  );

  res.json(new ApiResponse(200, null, 'Notion disconnected successfully'));
});

/**
 * POST /api/v1/integrations/notion/import
 * Imports a Notion page.
 */
export const importPage = catchAsync(async (req: Request, res: Response) => {
  const userId = (req as any).user?.id as string;
  if (!userId) throw new ApiError(401, 'Unauthorized');

  const { notionPageId, orgId, spaceId, parentId } = req.body;
  if (!notionPageId || !orgId || !spaceId) {
    throw new ApiError(400, 'notionPageId, orgId, and spaceId are required');
  }

  const newPage = await importNotionPage(userId, notionPageId, orgId, spaceId, parentId);
  res.json(new ApiResponse(200, newPage, 'Page imported successfully'));
});

/**
 * POST /api/v1/integrations/notion/export
 * Exports a local page to Notion.
 */
export const exportPage = catchAsync(async (req: Request, res: Response) => {
  const userId = (req as any).user?.id as string;
  if (!userId) throw new ApiError(401, 'Unauthorized');

  const { motionPageId, parentNotionPageId, targetNotionPageId, mode } = req.body;
  if (!motionPageId) throw new ApiError(400, 'motionPageId is required');

  const updatedPage = await exportMotionPage(userId, motionPageId, parentNotionPageId, targetNotionPageId, mode || 'create');
  res.json(new ApiResponse(200, updatedPage, 'Page exported successfully'));
});

/**
 * POST /api/v1/integrations/notion/sync
 * Manually triggers a 2-way sync on a linked page.
 */
export const syncPage = catchAsync(async (req: Request, res: Response) => {
  const userId = (req as any).user?.id as string;
  if (!userId) throw new ApiError(401, 'Unauthorized');

  const { motionPageId } = req.body;
  if (!motionPageId) throw new ApiError(400, 'motionPageId is required');

  const updatedPage = await syncNotionAndMotion(userId, motionPageId);
  res.json(new ApiResponse(200, updatedPage, 'Page synced successfully'));
});

/**
 * POST /api/v1/integrations/notion/unlink
 * Unlinks a Motion page from its Notion page.
 */
export const unlinkPage = catchAsync(async (req: Request, res: Response) => {
  const userId = (req as any).user?.id as string;
  if (!userId) throw new ApiError(401, 'Unauthorized');

  const { motionPageId } = req.body;
  if (!motionPageId) throw new ApiError(400, 'motionPageId is required');

  const updatedPage = await motionPageRepository.update(motionPageId, {
    notion_page_id: null,
    notion_last_synced_at: null,
  });

  res.json(new ApiResponse(200, updatedPage, 'Page unlinked successfully'));
});
