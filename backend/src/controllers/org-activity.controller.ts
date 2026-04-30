import { Request, Response } from "express";
import { catchAsync } from "../utils/catchAsync";
import { ApiError } from "../utils/ApiError";
import { ApiResponse } from "../utils/ApiResponse";
import { LogEntityType } from "../types/enums";
import { getSpaceDashboardBuckets } from "../services/space-dashboard.service";
import {
  getSpaceActivityFeed,
  getSpaceEntityActivity,
  getSpaceTaskActivity,
} from "../services/space-activity.service";

const asString = (value: string | string[] | undefined): string =>
  Array.isArray(value) ? value[0] : (value ?? "");

export const getDashboardInfo = catchAsync(async (req: Request, res: Response) => {
  const data = await getSpaceDashboardBuckets(asString(req.params.orgId), asString(req.params.spaceId));
  res.status(200).json(new ApiResponse(200, data, "Dashboard data retrieved successfully"));
});

export const getActivityFeed = catchAsync(async (req: Request, res: Response) => {
  const rawLimit = req.query.limit as string | undefined;
  const rawOffset = req.query.offset as string | undefined;
  const entityType = asString(req.query.entity_type as string | string[] | undefined) || undefined;
  const entityId = asString(req.query.entity_id as string | string[] | undefined) || undefined;

  const parsedLimit = rawLimit ? parseInt(rawLimit, 10) : 20;
  const parsedOffset = rawOffset ? parseInt(rawOffset, 10) : 0;
  const limit = Number.isNaN(parsedLimit) ? 20 : Math.min(Math.max(1, parsedLimit), 100);
  const offset = Number.isNaN(parsedOffset) ? 0 : parsedOffset;

  if (offset < 0) throw new ApiError(400, "offset must be a non-negative integer");

  if (entityType !== undefined) {
    const validEntityTypes = Object.values(LogEntityType);
    if (!validEntityTypes.includes(entityType as LogEntityType)) {
      throw new ApiError(400, `Invalid entity_type. Must be one of: ${validEntityTypes.join(", ")}`);
    }
  }

  if (entityId && !entityType) {
    throw new ApiError(400, "entity_type is required when entity_id is provided");
  }

  let data;
  if (entityId) {
    data =
      entityType === LogEntityType.TASK
        ? await getSpaceTaskActivity(asString(req.params.orgId), asString(req.params.spaceId), entityId)
        : await getSpaceEntityActivity(
            asString(req.params.orgId),
            asString(req.params.spaceId),
            entityType as LogEntityType,
            entityId,
          );
  } else {
    data = await getSpaceActivityFeed(asString(req.params.orgId), asString(req.params.spaceId), limit, offset);
  }

  res.status(200).json(new ApiResponse(200, data, "Activity feed retrieved successfully"));
});
