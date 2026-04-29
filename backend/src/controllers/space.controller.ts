import { Request, Response } from "express";
import { catchAsync } from "../utils/catchAsync";
import { ApiResponse } from "../utils/ApiResponse";
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
  const members = await spaceService.getSpaceMembers(orgId, spaceId);

  res
    .status(200)
    .json(new ApiResponse(200, { members }, "Space members retrieved successfully"));
});
