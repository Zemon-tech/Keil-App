import { Request, Response } from "express";
import { catchAsync } from "../utils/catchAsync";
import { ApiResponse } from "../utils/ApiResponse";
import { ApiError } from "../utils/ApiError";
import * as spaceService from "../services/space.service";

const asString = (value: string | string[] | undefined): string =>
  Array.isArray(value) ? value[0] : (value ?? "");

export const getSpaces = catchAsync(async (req: Request, res: Response) => {
  const orgId = asString(req.params.orgId);
  const userId = (req as any).user?.id as string;
  const spaces = await spaceService.getVisibleSpaces(orgId, userId);

  res.status(200).json(new ApiResponse(200, { spaces }, "Spaces retrieved successfully"));
});

export const getSpaceMembers = catchAsync(async (req: Request, res: Response) => {
  const orgId = asString(req.params.orgId);
  const spaceId = asString(req.params.spaceId);
  const userId = (req as any).user?.id as string;
  const members = await spaceService.getSpaceMembers(orgId, spaceId, userId);

  res
    .status(200)
    .json(new ApiResponse(200, { members }, "Space members retrieved successfully"));
});

export const createSpace = catchAsync(async (req: Request, res: Response) => {
  const orgId = asString(req.params.orgId);
  const userId = (req as any).user?.id as string;
  const { name } = req.body;

  if (!name || typeof name !== "string" || name.trim() === "") {
    throw new ApiError(400, "Space name is required");
  }

  const space = await spaceService.createSpace(orgId, userId, name);

  res.status(201).json(new ApiResponse(201, { space }, "Space created successfully"));
});

export const renameSpace = catchAsync(async (req: Request, res: Response) => {
  const orgId = asString(req.params.orgId);
  const spaceId = asString(req.params.spaceId);
  const userId = (req as any).user?.id as string;
  const { name } = req.body;

  if (!name || typeof name !== "string" || name.trim() === "") {
    throw new ApiError(400, "Space name is required");
  }

  const space = await spaceService.renameSpace(orgId, spaceId, userId, name);
  res.status(200).json(new ApiResponse(200, { space }, "Space renamed successfully"));
});

export const deleteSpace = catchAsync(async (req: Request, res: Response) => {
  const orgId = asString(req.params.orgId);
  const spaceId = asString(req.params.spaceId);
  const userId = (req as any).user?.id as string;

  await spaceService.deleteSpace(orgId, spaceId, userId);
  res.status(200).json(new ApiResponse(200, {}, "Space deleted successfully"));
});

export const restoreSpace = catchAsync(async (req: Request, res: Response) => {
  const orgId = asString(req.params.orgId);
  const spaceId = asString(req.params.spaceId);
  const userId = (req as any).user?.id as string;

  const space = await spaceService.restoreSpace(orgId, spaceId, userId);
  res.status(200).json(new ApiResponse(200, { space }, "Space restored successfully"));
});

export const hardDeleteSpace = catchAsync(async (req: Request, res: Response) => {
  const orgId = asString(req.params.orgId);
  const spaceId = asString(req.params.spaceId);
  const userId = (req as any).user?.id as string;

  await spaceService.hardDeleteSpace(orgId, spaceId, userId);
  res.status(200).json(new ApiResponse(200, {}, "Space permanently deleted"));
});

export const getDeletedSpaces = catchAsync(async (req: Request, res: Response) => {
  const orgId = asString(req.params.orgId);
  const userId = (req as any).user?.id as string;

  const spaces = await spaceService.getDeletedSpaces(orgId, userId);
  res.status(200).json(new ApiResponse(200, { spaces }, "Deleted spaces retrieved successfully"));
});

export const addSpaceMember = catchAsync(async (req: Request, res: Response) => {
  const orgId = asString(req.params.orgId);
  const spaceId = asString(req.params.spaceId);
  const userId = (req as any).user?.id as string;
  const { user_id: targetUserId } = req.body;

  if (!targetUserId || typeof targetUserId !== "string") {
    throw new ApiError(400, "user_id is required");
  }

  await spaceService.addSpaceMember(orgId, spaceId, userId, targetUserId);
  res.status(201).json(new ApiResponse(201, {}, "Member added to space"));
});

export const removeSpaceMember = catchAsync(async (req: Request, res: Response) => {
  const orgId = asString(req.params.orgId);
  const spaceId = asString(req.params.spaceId);
  const userId = (req as any).user?.id as string;
  const targetUserId = asString(req.params.userId);

  await spaceService.removeSpaceMember(orgId, spaceId, userId, targetUserId);
  res.status(200).json(new ApiResponse(200, {}, "Member removed from space"));
});

export const updateSpaceMemberRole = catchAsync(async (req: Request, res: Response) => {
  const orgId = asString(req.params.orgId);
  const spaceId = asString(req.params.spaceId);
  const targetUserId = asString(req.params.userId);
  const actorUserId = (req as any).user?.id as string;
  const { role } = req.body;

  if (!["admin", "manager", "member"].includes(role)) {
    throw new ApiError(400, "Role must be admin, manager, or member");
  }

  await spaceService.updateSpaceMemberRole(orgId, spaceId, actorUserId, targetUserId, role as any);
  res.status(200).json(new ApiResponse(200, {}, "Space member role updated successfully"));
});

