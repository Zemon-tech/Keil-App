import { Request, Response } from "express";
import { catchAsync } from "../utils/catchAsync";
import { ApiResponse } from "../utils/ApiResponse";
import { ApiError } from "../utils/ApiError";
import * as analyticsService from "../services/motion-analytics.service";

const asString = (value: any): string => {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return typeof value[0] === "string" ? value[0] : "";
  return "";
};

const getContext = (req: Request) => ({
  pageId: asString(req.params.pageId),
  userId: (req as any).user?.id as string,
});

export const recordPageView = catchAsync(async (req: Request, res: Response) => {
  const { pageId, userId } = getContext(req);
  const view = await analyticsService.recordPageView(pageId, userId ?? null);
  res.status(201).json(new ApiResponse(201, view, "View recorded successfully"));
});

export const getViewsSummary = catchAsync(async (req: Request, res: Response) => {
  const { pageId } = getContext(req);
  const range = req.query.range ? parseInt(asString(req.query.range), 10) : 28;
  if (isNaN(range) || range <= 0) {
    throw new ApiError(400, "Invalid range parameter");
  }

  const summary = await analyticsService.getViewsSummary(pageId, range);
  res.status(200).json(new ApiResponse(200, summary, "Views summary retrieved successfully"));
});

export const getViewPermission = catchAsync(async (req: Request, res: Response) => {
  const { pageId, userId } = getContext(req);
  const allowed = await analyticsService.getViewPermission(pageId, userId);
  res.status(200).json(new ApiResponse(200, { allowed }, "Permission retrieved successfully"));
});

export const setViewPermission = catchAsync(async (req: Request, res: Response) => {
  const { pageId, userId } = getContext(req);
  const { allow } = req.body;
  if (typeof allow !== "boolean") {
    throw new ApiError(400, "allow parameter must be a boolean");
  }

  const perm = await analyticsService.setViewPermission(pageId, userId, allow);
  res.status(200).json(new ApiResponse(200, perm, "Permission updated successfully"));
});

export const getViewers = catchAsync(async (req: Request, res: Response) => {
  const { pageId } = getContext(req);
  const viewers = await analyticsService.getViewers(pageId);
  res.status(200).json(new ApiResponse(200, viewers, "Viewers retrieved successfully"));
});

export const getUpdates = catchAsync(async (req: Request, res: Response) => {
  const { pageId } = getContext(req);
  console.log("🔍 [analytics-controller]: getUpdates endpoint hit for pageId:", pageId);
  const limit = req.query.limit ? parseInt(asString(req.query.limit), 10) : 20;
  const offset = req.query.offset ? parseInt(asString(req.query.offset), 10) : 0;

  if (isNaN(limit) || limit <= 0 || isNaN(offset) || offset < 0) {
    throw new ApiError(400, "Invalid pagination parameters");
  }

  const updates = await analyticsService.getUpdates(pageId, limit, offset);
  console.log("🔍 [analytics-controller]: returning updates count:", updates.length, JSON.stringify(updates));
  res.status(200).json(new ApiResponse(200, updates, "Updates retrieved successfully"));
});

export const getEditors = catchAsync(async (req: Request, res: Response) => {
  const { pageId } = getContext(req);
  const editors = await analyticsService.getEditors(pageId);
  res.status(200).json(new ApiResponse(200, editors, "Editors retrieved successfully"));
});
