import { Request, Response } from "express";
import { catchAsync } from "../utils/catchAsync";
import { ApiResponse } from "../utils/ApiResponse";
import * as organisationService from "../services/organisation.service";

export const getOrganisations = catchAsync(async (req: Request, res: Response) => {
  const userId = (req as any).user?.id as string;
  const organisations = await organisationService.getUserOrganisations(userId);

  res
    .status(200)
    .json(new ApiResponse(200, { organisations }, "Organisations retrieved successfully"));
});
