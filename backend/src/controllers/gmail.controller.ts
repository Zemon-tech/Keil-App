import { Request, Response } from 'express';
import { catchAsync } from '../utils/catchAsync';
import { ApiResponse } from '../utils/ApiResponse';
import { ApiError } from '../utils/ApiError';
import { listInboxEmails, getEmailDetails } from '../services/gmail.service';
import { createServiceLogger } from '../lib/logger';

const log = createServiceLogger('gmail-controller');

/**
 * GET /api/v1/gmail/inbox
 * Fetches recent inbox emails.
 */
export const getInbox = catchAsync(async (req: Request, res: Response) => {
  const userId = (req as any).user?.id as string;
  if (!userId) throw new ApiError(401, 'Unauthorized');

  const searchQuery = req.query.query as string | undefined;

  try {
    const emails = await listInboxEmails(userId, searchQuery);
    res.json(new ApiResponse(200, emails, 'Inbox emails fetched successfully'));
  } catch (err: any) {
    log.error({ err, userId }, 'Get inbox emails failed');
    
    const errMessage = err.message || '';
    if (errMessage.toLowerCase().includes('disabled') || errMessage.toLowerCase().includes('has not been used')) {
      throw new ApiError(400, `Gmail API is not enabled in your Google Developer Console: ${errMessage}`);
    }
    
    // Check if error is due to missing integration or revoked scopes
    const isAuthError = 
      err.message === 'Google connection required' || 
      err.status === 401 || 
      err.status === 403 || 
      err.code === 401 || 
      err.code === 403 ||
      errMessage.toLowerCase().includes('scope');

    if (isAuthError) {
      throw new ApiError(403, 'Google Mail integration is not connected or requires re-authentication');
    }
    
    throw new ApiError(500, err.message || 'Internal server error while fetching emails');
  }
});

/**
 * GET /api/v1/gmail/messages/:id
 * Fetches detailed content for a single email.
 */
export const getMessageDetails = catchAsync(async (req: Request, res: Response) => {
  const userId = (req as any).user?.id as string;
  if (!userId) throw new ApiError(401, 'Unauthorized');

  const messageId = req.params.id as string;
  if (!messageId) throw new ApiError(400, 'Message ID is required');

  try {
    const email = await getEmailDetails(userId, messageId);
    res.json(new ApiResponse(200, email, 'Email details fetched successfully'));
  } catch (err: any) {
    log.error({ err, userId, messageId }, 'Get email details failed');

    const errMessage = err.message || '';
    if (errMessage.toLowerCase().includes('disabled') || errMessage.toLowerCase().includes('has not been used')) {
      throw new ApiError(400, `Gmail API is not enabled in your Google Developer Console: ${errMessage}`);
    }

    const isAuthError = 
      err.message === 'Google connection required' || 
      err.status === 401 || 
      err.status === 403 || 
      err.code === 401 || 
      err.code === 403 ||
      errMessage.toLowerCase().includes('scope');

    if (isAuthError) {
      throw new ApiError(403, 'Google Mail integration is not connected or requires re-authentication');
    }

    throw new ApiError(500, err.message || 'Internal server error while fetching email details');
  }
});
