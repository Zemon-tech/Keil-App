import { Request, Response } from "express";
import { catchAsync } from "../utils/catchAsync";
import { ApiResponse } from "../utils/ApiResponse";
import * as healthService from "../services/health.service";

export const getHealth = catchAsync(async (req: Request, res: Response) => {
    const healthData = healthService.getHealthData();

    res.status(200).json(
        new ApiResponse(200, healthData, "Health status retrieved successfully")
    );
});
