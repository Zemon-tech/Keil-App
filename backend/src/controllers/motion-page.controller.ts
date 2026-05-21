import { Request, Response } from 'express';
import { catchAsync } from '../utils/catchAsync';
import { ApiError } from '../utils/ApiError';
import { ApiResponse } from '../utils/ApiResponse';
import { MotionShareType, MotionPermission } from '../types/enums';
import * as motionPageService from '../services/motion-page.service';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const asString = (value: string | string[] | undefined): string =>
  Array.isArray(value) ? value[0] : (value ?? '');

const getContext = (req: Request) => ({
  orgId: asString(req.params.orgId),
  spaceId: asString(req.params.spaceId),
  userId: (req as any).user?.id as string,
});

const validateShareType = (value: unknown): value is MotionShareType =>
  value === MotionShareType.PUBLIC_LINK || value === MotionShareType.SPACE;

const validatePermission = (value: unknown): value is MotionPermission =>
  value === MotionPermission.VIEW || value === MotionPermission.EDIT;

// ─── Page CRUD ────────────────────────────────────────────────────────────────

export const listPages = catchAsync(async (req: Request, res: Response) => {
  const { orgId, spaceId } = getContext(req);
  const pages = await motionPageService.getPagesBySpace(orgId, spaceId);
  res.status(200).json(new ApiResponse(200, pages, 'Pages retrieved successfully'));
});

export const listTrash = catchAsync(async (req: Request, res: Response) => {
  const { orgId, spaceId } = getContext(req);
  const pages = await motionPageService.getTrashBySpace(orgId, spaceId);
  res.status(200).json(new ApiResponse(200, pages, 'Trash retrieved successfully'));
});

export const getPage = catchAsync(async (req: Request, res: Response) => {
  const { orgId, spaceId } = getContext(req);
  const pageId = asString(req.params.id);

  const page = await motionPageService.getPageById(orgId, spaceId, pageId);
  if (!page) throw new ApiError(404, 'Page not found');

  res.status(200).json(new ApiResponse(200, page, 'Page retrieved successfully'));
});

export const createPage = catchAsync(async (req: Request, res: Response) => {
  const { orgId, spaceId, userId } = getContext(req);
  const { parent_id, title, icon, cover_image } = req.body;

  const page = await motionPageService.createPage(orgId, spaceId, userId, {
    parent_id: parent_id ?? null,
    title,
    icon: icon ?? null,
    cover_image: cover_image ?? null,
  });

  res.status(201).json(new ApiResponse(201, page, 'Page created successfully'));
});

export const updatePage = catchAsync(async (req: Request, res: Response) => {
  const { orgId, spaceId, userId } = getContext(req);
  const pageId = asString(req.params.id);
  const { title, content, icon, cover_image, parent_id, small_text, full_width } = req.body;

  // Build updates object — only include fields that were explicitly sent
  const input: motionPageService.UpdateMotionPageInput = {};
  if (title !== undefined) {
    if (typeof title !== 'string' || title.trim() === '') {
      throw new ApiError(400, 'Title cannot be empty');
    }
    input.title = title;
  }
  if (content !== undefined) {
    if (typeof content !== 'object' || content === null) {
      throw new ApiError(400, 'Content must be a valid JSON object');
    }
    input.content = content;
  }
  if (icon !== undefined) input.icon = icon;
  if (cover_image !== undefined) input.cover_image = cover_image;
  if (parent_id !== undefined) input.parent_id = parent_id;
  if (small_text !== undefined) input.small_text = small_text;
  if (full_width !== undefined) input.full_width = full_width;

  const spaceRole = (req as any).space?.membership_role as string;
  const updated = await motionPageService.updatePage(orgId, spaceId, pageId, userId, input, spaceRole);
  if (!updated) throw new ApiError(404, 'Page not found');

  res.status(200).json(new ApiResponse(200, updated, 'Page updated successfully'));
});

export const softDeletePage = catchAsync(async (req: Request, res: Response) => {
  const { orgId, spaceId, userId } = getContext(req);
  const pageId = asString(req.params.id);

  const spaceRole = (req as any).space?.membership_role as string;
  await motionPageService.softDeletePage(orgId, spaceId, pageId, userId, spaceRole);
  res.status(200).json(new ApiResponse(200, {}, 'Page moved to trash'));
});

export const restorePage = catchAsync(async (req: Request, res: Response) => {
  const { orgId, spaceId, userId } = getContext(req);
  const pageId = asString(req.params.id);

  const spaceRole = (req as any).space?.membership_role as string;
  const page = await motionPageService.restorePage(orgId, spaceId, pageId, userId, spaceRole);
  res.status(200).json(new ApiResponse(200, page, 'Page restored successfully'));
});

export const hardDeletePage = catchAsync(async (req: Request, res: Response) => {
  const { orgId, spaceId, userId } = getContext(req);
  const pageId = asString(req.params.id);

  const spaceRole = (req as any).space?.membership_role as string;
  await motionPageService.hardDeletePage(orgId, spaceId, pageId, userId, spaceRole);
  res.status(200).json(new ApiResponse(200, {}, 'Page permanently deleted'));
});

// ─── Shares ───────────────────────────────────────────────────────────────────

export const listShares = catchAsync(async (req: Request, res: Response) => {
  const { orgId, spaceId } = getContext(req);
  const pageId = asString(req.params.id);

  const shares = await motionPageService.getSharesByPage(orgId, spaceId, pageId);
  res.status(200).json(new ApiResponse(200, shares, 'Shares retrieved successfully'));
});

export const createShare = catchAsync(async (req: Request, res: Response) => {
  const { orgId, spaceId, userId } = getContext(req);
  const pageId = asString(req.params.id);
  const { share_type, permission, target_org_id, target_space_id, expires_at } = req.body;

  if (!validateShareType(share_type)) {
    throw new ApiError(400, 'share_type must be "public_link" or "space"');
  }
  if (permission !== undefined && !validatePermission(permission)) {
    throw new ApiError(400, 'permission must be "view" or "edit"');
  }

  const spaceRole = (req as any).space?.membership_role as string;
  const share = await motionPageService.createShare(orgId, spaceId, pageId, userId, {
    share_type,
    permission,
    target_org_id: target_org_id ?? null,
    target_space_id: target_space_id ?? null,
    expires_at: expires_at ?? null,
  }, spaceRole);

  res.status(201).json(new ApiResponse(201, share, 'Share created successfully'));
});

export const revokeShare = catchAsync(async (req: Request, res: Response) => {
  const { orgId, spaceId, userId } = getContext(req);
  const pageId = asString(req.params.id);
  const shareId = asString(req.params.shareId);

  const spaceRole = (req as any).space?.membership_role as string;
  await motionPageService.revokeShare(orgId, spaceId, pageId, shareId, userId, spaceRole);
  res.status(200).json(new ApiResponse(200, {}, 'Share revoked successfully'));
});

// ─── Shared-to-space list ─────────────────────────────────────────────────────

export const listSharedToSpace = catchAsync(async (req: Request, res: Response) => {
  const { orgId, spaceId } = getContext(req);
  const pages = await motionPageService.getSharedToSpace(orgId, spaceId);
  res.status(200).json(new ApiResponse(200, pages, 'Shared pages retrieved successfully'));
});

// ─── Public token (no auth) ───────────────────────────────────────────────────

export const getPublicPage = catchAsync(async (req: Request, res: Response) => {
  const token = asString(req.params.token);

  if (!token || token.length !== 64) {
    throw new ApiError(400, 'Invalid share token');
  }

  const page = await motionPageService.getPageByPublicToken(token);
  if (!page) throw new ApiError(404, 'Page not found or link has expired');

  res.status(200).json(new ApiResponse(200, page, 'Page retrieved successfully'));
});
