import { Request, Response } from 'express';
import { catchAsync } from '../utils/catchAsync';
import { ApiResponse } from '../utils/ApiResponse';
import { ApiError } from '../utils/ApiError';
import * as motionService from '../services/motion.service';

/**
 * Create a new motion linked to a recording.
 */
export const createMotion = catchAsync(async (req: Request, res: Response) => {
  const { recordingId, ownerId, title, isPublic } = req.body;
  if (!recordingId || !ownerId) {
    throw new ApiError(400, 'recordingId and ownerId are required');
  }
  const motion = await motionService.createMotion({
    recordingId,
    ownerId,
    title,
    isPublic,
  });
  res.status(201).json(new ApiResponse(201, motion, 'Motion created'));
});

/**
 * Retrieve a motion by its public share token.
 */
export const getMotion = catchAsync(async (req: Request, res: Response) => {
  const tokenParam = Array.isArray(req.params.token) ? req.params.token[0] : req.params.token;
  const motion = await motionService.getMotionByToken(tokenParam);
  if (!motion) {
    throw new ApiError(404, 'Motion not found');
  }
  res.status(200).json(new ApiResponse(200, motion, 'Motion retrieved'));
});
