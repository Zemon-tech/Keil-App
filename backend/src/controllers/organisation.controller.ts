import { Request, Response } from "express";
import { catchAsync } from "../utils/catchAsync";
import { ApiResponse } from "../utils/ApiResponse";
import { ApiError } from "../utils/ApiError";
import * as organisationService from "../services/organisation.service";

const asString = (value: string | string[] | undefined): string =>
  Array.isArray(value) ? value[0] : (value ?? "");

export const getOrganisations = catchAsync(async (req: Request, res: Response) => {
  const userId = (req as any).user?.id as string;
  const organisations = await organisationService.getUserOrganisations(userId);

  res
    .status(200)
    .json(new ApiResponse(200, { organisations }, "Organisations retrieved successfully"));
});

export const createOrganisation = catchAsync(async (req: Request, res: Response) => {
  const userId = (req as any).user?.id as string;
  const { name } = req.body;

  if (!name || typeof name !== "string" || name.trim() === "") {
    throw new ApiError(400, "Organisation name is required");
  }

  const result = await organisationService.createOrganisation(userId, name);

  res
    .status(201)
    .json(new ApiResponse(201, result, "Organisation created successfully"));
});

export const createOrgInvite = catchAsync(async (req: Request, res: Response) => {
  const userId = (req as any).user?.id as string;
  const orgId = asString(req.params.orgId);

  const result = await organisationService.generateInviteToken(orgId, userId);

  res
    .status(200)
    .json(new ApiResponse(200, result, "Invite link generated successfully"));
});

export const joinOrg = catchAsync(async (req: Request, res: Response) => {
  const userId = (req as any).user?.id as string;
  const { token } = req.body;

  if (!token || typeof token !== "string") {
    throw new ApiError(400, "Invite token is required");
  }

  const result = await organisationService.joinOrganisation(token, userId);

  res
    .status(200)
    .json(new ApiResponse(200, result, "Joined organisation successfully"));
});

export const getOrgMembers = catchAsync(async (req: Request, res: Response) => {
  const orgId = asString(req.params.orgId);
  const members = await organisationService.getOrgMembers(orgId);

  res
    .status(200)
    .json(new ApiResponse(200, { members }, "Organisation members retrieved successfully"));
});

export const renameOrganisation = catchAsync(async (req: Request, res: Response) => {
  const userId = (req as any).user?.id as string;
  const orgId = asString(req.params.orgId);
  const { name } = req.body;

  if (!name || typeof name !== "string" || name.trim() === "") {
    throw new ApiError(400, "Organisation name is required");
  }

  const org = await organisationService.renameOrganisation(orgId, userId, name);

  res
    .status(200)
    .json(new ApiResponse(200, { org }, "Organisation renamed successfully"));
});

export const deleteOrganisation = catchAsync(async (req: Request, res: Response) => {
  const userId = (req as any).user?.id as string;
  const orgId = asString(req.params.orgId);

  await organisationService.deleteOrganisation(orgId, userId);

  res
    .status(200)
    .json(new ApiResponse(200, {}, "Organisation deleted successfully"));
});

export const updateOrgMemberRole = catchAsync(async (req: Request, res: Response) => {
  const userId = (req as any).user?.id as string;
  const orgId = asString(req.params.orgId);
  const targetUserId = asString(req.params.userId);
  const { role } = req.body;

  if (role !== "admin" && role !== "member") {
    throw new ApiError(400, "Role must be admin or member");
  }

  await organisationService.updateOrgMemberRole(orgId, userId, targetUserId, role);

  res
    .status(200)
    .json(new ApiResponse(200, {}, "Member role updated successfully"));
});

export const removeOrgMember = catchAsync(async (req: Request, res: Response) => {
  const userId = (req as any).user?.id as string;
  const orgId = asString(req.params.orgId);
  const targetUserId = asString(req.params.userId);

  await organisationService.removeOrgMember(orgId, userId, targetUserId);

  res
    .status(200)
    .json(new ApiResponse(200, {}, "Member removed successfully"));
});
